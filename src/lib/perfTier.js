// One performance tier for the whole app: 'high' | 'mid' | 'low'.
//
// Why a tier, and why it adapts:
//  - Static signals alone are unreliable. `navigator.hardwareConcurrency` is
//    capped/randomised by some browsers, `deviceMemory` doesn't exist in
//    Safari/Firefox, and an 8-core budget Android can still be slower than a
//    4-core iPhone. The old check (`narrow viewport || cores <= 4`) therefore
//    treated every phone identically and never noticed a device that was
//    actually struggling.
//  - So the tier starts from the best static estimate and is then corrected
//    by *measurement*: heavy scenes (particles, galaxy, the open card) run a
//    frame-time monitor, and a device that can't hold ~30fps is stepped down
//    a tier. The learned tier is remembered (localStorage, 7 days) so the
//    next card opens at the right quality from its first frame.
//
// Everything that decides "how much decoration" reads this: particle count/
// resolution/frame cap, depth motion, galaxy star count, and -- via the
// `data-perf` attribute on <html> -- the CSS (backdrop blurs, infinite
// decorative animations). Capable devices keep full quality; weak ones get
// the same designs with the expensive paint-heavy parts simplified.
//
// Overrides (support / testing): `?perf=low|mid|high|auto` in the URL, or
// localStorage['cardora:perf'] (the Profile "Effects" setting writes this).

export const TIERS = ['high', 'mid', 'low']

const OVERRIDE_KEY = 'cardora:perf'
const LEARNED_KEY = 'cardora:perfLearned'
const LEARNED_TTL_MS = 7 * 24 * 60 * 60 * 1000

const isTier = (v) => TIERS.includes(v)

function safeStorage(fn, fallback = null) {
  try {
    return fn()
  } catch {
    return fallback
  }
}

function readOverride() {
  if (typeof window === 'undefined') return null
  const fromUrl = safeStorage(() => new URLSearchParams(window.location.search).get('perf'))
  if (isTier(fromUrl)) return fromUrl
  const stored = safeStorage(() => window.localStorage.getItem(OVERRIDE_KEY))
  return isTier(stored) ? stored : null
}

function readLearned() {
  if (typeof window === 'undefined') return null
  const raw = safeStorage(() => window.localStorage.getItem(LEARNED_KEY))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (isTier(parsed?.tier) && Date.now() - Number(parsed.at || 0) < LEARNED_TTL_MS) return parsed.tier
  } catch {
    /* ignore */
  }
  return null
}

// Best static guess, no measurement. Exported for tests.
export function estimateTier(env = {}) {
  const nav = env.navigator ?? (typeof navigator !== 'undefined' ? navigator : {})
  const cores = nav.hardwareConcurrency || 4
  const memory = nav.deviceMemory // Chrome/Edge only, GB, capped at 8
  const conn = nav.connection

  // Data saver / slow network is a strong "keep it light" signal on its own.
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '')) return 'low'

  if ((memory && memory <= 2) || cores <= 2) return 'low'
  if ((memory && memory <= 4) || cores <= 4) return 'mid'

  // More than 4 cores and no memory red flag: start at 'high'. This is only
  // a starting point -- a phone that claims 8 cores but can't hold 30fps in
  // a heavy scene is stepped down by watchFramePacing().
  return 'high'
}

let currentTier = null
const listeners = new Set()

function resolveInitialTier() {
  const override = readOverride()
  if (override) return override
  const estimate = estimateTier()
  const learned = readLearned()
  if (learned && TIERS.indexOf(learned) > TIERS.indexOf(estimate)) return learned
  return estimate
}

function applyAttribute(tier) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.perf = tier
}

export function getPerfTier() {
  if (currentTier === null) {
    currentTier = resolveInitialTier()
    applyAttribute(currentTier)
  }
  return currentTier
}

export function subscribePerfTier(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function setTier(next, { persist = false } = {}) {
  if (!isTier(next) || next === currentTier) return
  currentTier = next
  applyAttribute(next)
  if (persist) {
    safeStorage(() => window.localStorage.setItem(LEARNED_KEY, JSON.stringify({ tier: next, at: Date.now() })))
  }
  listeners.forEach((cb) => cb(next))
}

// Explicit user choice ('auto' clears it). Used by the Profile setting.
export function setPerfOverride(value) {
  if (typeof window === 'undefined') return
  if (isTier(value)) {
    safeStorage(() => window.localStorage.setItem(OVERRIDE_KEY, value))
    setTier(value)
  } else {
    safeStorage(() => window.localStorage.removeItem(OVERRIDE_KEY))
    safeStorage(() => window.localStorage.removeItem(LEARNED_KEY))
    currentTier = null
    const next = getPerfTier()
    listeners.forEach((cb) => cb(next))
  }
}

export function getPerfOverride() {
  return readOverride()
}

export function downgradePerfTier() {
  // A user/URL override is a decision -- never second-guess it.
  if (readOverride()) return false
  const idx = TIERS.indexOf(getPerfTier())
  if (idx >= TIERS.length - 1) return false
  setTier(TIERS[idx + 1], { persist: true })
  return true
}

// ── Frame-time monitor ───────────────────────────────────────────────────

// Pure so it's testable: is this window of frame deltas (ms) a struggling one?
// >25% of frames slower than 40ms (i.e. under ~25fps), or a mean over 32ms.
export function isJanky(deltas) {
  if (!deltas.length) return false
  const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length
  const slow = deltas.filter((d) => d > 40).length / deltas.length
  return slow > 0.25 || mean > 32
}

const WARMUP_MS = 900 // particle/engine init and first paint are always slow
const WINDOW_FRAMES = 45
// A window also closes on time: at 4fps, waiting for 45 frames would take
// 11 seconds to notice a device that is obviously struggling.
const WINDOW_MAX_MS = 1500
const WINDOW_MIN_FRAMES = 5
// A mean frame over this is hopeless, not borderline -- one window is enough.
const SEVERE_MEAN_MS = 100
const MAX_WINDOWS = 6

let activeMonitors = 0

// Watches frame pacing while a heavy scene is on screen and steps the tier
// down when two consecutive windows are janky (one bad window is usually a
// GC pause or a route transition, not the device). Stops itself after a few
// healthy windows so it costs nothing in steady state. Returns a stop fn.
export function watchFramePacing({ onDowngrade } = {}) {
  if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') return () => {}
  if (readOverride() || getPerfTier() === 'low') return () => {}
  if (activeMonitors > 0) return () => {} // one monitor at a time is enough

  activeMonitors += 1
  let raf = null
  let stopped = false
  let last = 0
  let startedAt = 0
  let deltas = []
  let windowStart = 0
  let strikes = 0
  let healthy = 0
  let windows = 0

  const finish = () => {
    if (stopped) return
    stopped = true
    activeMonitors -= 1
    if (raf != null) cancelAnimationFrame(raf)
  }

  const tick = (now) => {
    if (stopped) return
    raf = requestAnimationFrame(tick)
    if (document.hidden) { last = 0; return }
    if (!startedAt) startedAt = now
    if (now - startedAt < WARMUP_MS) { last = now; return }
    if (last) {
      const d = now - last
      // A huge gap is the tab being backgrounded/throttled, not a slow frame.
      if (d < 500) deltas.push(d)
    }
    last = now
    if (!windowStart) windowStart = now
    const windowAge = now - windowStart
    const full = deltas.length >= WINDOW_FRAMES
    const timedOut = windowAge >= WINDOW_MAX_MS && deltas.length >= WINDOW_MIN_FRAMES
    if (!full && !timedOut) return

    windows += 1
    const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length
    if (isJanky(deltas)) {
      strikes += mean > SEVERE_MEAN_MS ? 2 : 1
      healthy = 0
    } else {
      strikes = 0
      healthy += 1
    }
    deltas = []
    windowStart = 0

    if (strikes >= 2) {
      strikes = 0
      if (downgradePerfTier()) {
        onDowngrade?.(getPerfTier())
        startedAt = now // let the lighter scene re-init before judging it
        last = 0
        windowStart = 0
        if (getPerfTier() === 'low') finish()
      } else {
        finish()
      }
    } else if (healthy >= 3 || windows >= MAX_WINDOWS) {
      finish()
    }
  }

  raf = requestAnimationFrame(tick)
  return finish
}

// Test hook.
export function __resetPerfTierForTests() {
  currentTier = null
  listeners.clear()
  activeMonitors = 0
}
