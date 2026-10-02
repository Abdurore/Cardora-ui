import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  estimateTier,
  isJanky,
  getPerfTier,
  downgradePerfTier,
  setPerfOverride,
  watchFramePacing,
  subscribePerfTier,
  __resetPerfTierForTests,
} from './perfTier.js'
import { getMotionIntensity, getDepthProfile, getGalaxyProfile } from './deviceCapability.js'

const nav = (over = {}) => ({ hardwareConcurrency: 8, deviceMemory: undefined, connection: undefined, ...over })

beforeEach(() => {
  localStorage.clear()
  __resetPerfTierForTests()
  document.documentElement.removeAttribute('data-perf')
  window.history.replaceState({}, '', '/')
})

describe('estimateTier', () => {
  it('starts a many-core device at high', () => {
    expect(estimateTier({ navigator: nav() })).toBe('high')
  })
  it('puts 4 cores or <=4GB at mid, 2 cores or <=2GB at low', () => {
    expect(estimateTier({ navigator: nav({ hardwareConcurrency: 4 }) })).toBe('mid')
    expect(estimateTier({ navigator: nav({ deviceMemory: 4 }) })).toBe('mid')
    expect(estimateTier({ navigator: nav({ hardwareConcurrency: 2 }) })).toBe('low')
    expect(estimateTier({ navigator: nav({ deviceMemory: 2 }) })).toBe('low')
  })
  it('treats data-saver and 2g as low regardless of hardware', () => {
    expect(estimateTier({ navigator: nav({ connection: { saveData: true } }) })).toBe('low')
    expect(estimateTier({ navigator: nav({ connection: { effectiveType: '2g' } }) })).toBe('low')
    expect(estimateTier({ navigator: nav({ connection: { effectiveType: 'slow-2g' } }) })).toBe('low')
    expect(estimateTier({ navigator: nav({ connection: { effectiveType: '4g' } }) })).toBe('high')
  })
})

describe('isJanky', () => {
  it('passes a steady 60fps window', () => {
    expect(isJanky(Array(45).fill(16.7))).toBe(false)
  })
  it('flags a window where >25% of frames are slower than 40ms', () => {
    expect(isJanky([...Array(30).fill(16), ...Array(15).fill(70)])).toBe(true)
  })
  it('tolerates the odd hitch', () => {
    expect(isJanky([...Array(43).fill(16), 90, 120])).toBe(false)
  })
  it('flags a uniformly slow window by its mean', () => {
    expect(isJanky(Array(45).fill(36))).toBe(true)
  })
})

describe('tier selection, overrides and persistence', () => {
  it('stamps <html data-perf> when first read', () => {
    getPerfTier()
    expect(['high', 'mid', 'low']).toContain(document.documentElement.dataset.perf)
  })

  it('?perf= in the URL wins, and is never downgraded', () => {
    window.history.replaceState({}, '', '/?perf=high')
    expect(getPerfTier()).toBe('high')
    expect(downgradePerfTier()).toBe(false)
    expect(getPerfTier()).toBe('high')
  })

  it('a learned (downgraded) tier is remembered for the next session', () => {
    localStorage.setItem('cardora:perfLearned', JSON.stringify({ tier: 'low', at: Date.now() }))
    // jsdom reports 0/undefined hardware -> estimate is mid-or-better; the
    // learned tier only ever *lowers* it
    expect(getPerfTier()).toBe('low')
  })

  it('ignores a learned tier older than 7 days', () => {
    localStorage.setItem('cardora:perfLearned', JSON.stringify({ tier: 'low', at: Date.now() - 8 * 86400000 }))
    expect(getPerfTier()).not.toBe('low')
  })

  it('a runtime downgrade steps one tier, persists, and notifies subscribers', () => {
    setPerfOverride('auto')
    const before = getPerfTier()
    const seen = []
    const off = subscribePerfTier((t) => seen.push(t))
    // force a known starting point without an override
    localStorage.removeItem('cardora:perf')
    if (before === 'low') return off()
    expect(downgradePerfTier()).toBe(true)
    off()
    expect(seen).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem('cardora:perfLearned')).tier).toBe(seen[0])
    expect(document.documentElement.dataset.perf).toBe(seen[0])
  })

  it('setPerfOverride("auto") clears an override and any learned tier', () => {
    setPerfOverride('low')
    expect(getPerfTier()).toBe('low')
    setPerfOverride('auto')
    expect(localStorage.getItem('cardora:perf')).toBeNull()
    expect(localStorage.getItem('cardora:perfLearned')).toBeNull()
  })
})

describe('watchFramePacing', () => {
  let rafCb
  let clock
  beforeEach(() => {
    clock = 0
    rafCb = null
    vi.stubGlobal('requestAnimationFrame', (cb) => { rafCb = cb; return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => { rafCb = null })
  })
  afterEach(() => vi.unstubAllGlobals())

  // Advances `n` frames of `ms` each.
  const frames = (n, ms) => {
    for (let i = 0; i < n && rafCb; i++) {
      clock += ms
      const cb = rafCb
      rafCb = null
      cb(clock)
    }
  }
  const startHigh = () => {
    window.history.replaceState({}, '', '/')
    localStorage.setItem('cardora:perf', 'high')
    __resetPerfTierForTests()
    localStorage.removeItem('cardora:perf') // monitor refuses to run under an override
    // Force the estimate to 'high' by clearing any hardware-derived lower tier.
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true })
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true })
    return getPerfTier()
  }

  it('downgrades after two consecutive janky windows', () => {
    expect(startHigh()).toBe('high')
    const onDowngrade = vi.fn()
    watchFramePacing({ onDowngrade })
    frames(20, 16) // warmup (>900ms)
    frames(60, 60) // janky window 1
    frames(60, 60) // janky window 2
    expect(onDowngrade).toHaveBeenCalledTimes(1)
    expect(getPerfTier()).toBe('mid')
  })

  it('does not downgrade for a single bad window followed by good ones', () => {
    startHigh()
    const onDowngrade = vi.fn()
    watchFramePacing({ onDowngrade })
    frames(20, 16)
    frames(26, 60) // one janky window (closes at ~1.5s)
    frames(300, 16) // healthy afterwards
    expect(onDowngrade).not.toHaveBeenCalled()
    expect(getPerfTier()).toBe('high')
  })

  it('notices a severely struggling device quickly (time-bounded window, not 45 frames)', () => {
    startHigh()
    const onDowngrade = vi.fn()
    watchFramePacing({ onDowngrade })
    frames(20, 16)
    // 250ms frames: 45 frames would be 11s; windows close at ~1.5s instead
    frames(12, 250)
    expect(onDowngrade).toHaveBeenCalledTimes(1)
  })

  it('ignores the huge gap from a backgrounded tab', () => {
    startHigh()
    const onDowngrade = vi.fn()
    watchFramePacing({ onDowngrade })
    frames(20, 16)
    for (let i = 0; i < 3; i++) { frames(44, 16); frames(1, 5000) }
    expect(onDowngrade).not.toHaveBeenCalled()
  })

  it('refuses to run under an explicit override', () => {
    startHigh()
    localStorage.setItem('cardora:perf', 'high')
    const stop = watchFramePacing()
    expect(rafCb).toBeNull()
    stop()
  })
})

describe('capability profiles follow the tier', () => {
  it('depth: only high keeps the idle drift and tracking shadow', () => {
    setPerfOverride('high')
    expect(getDepthProfile()).toMatchObject({ level: 'full', idle: true, shadows: true })
    setPerfOverride('mid')
    expect(getDepthProfile()).toMatchObject({ level: 'lite', layers: true, idle: false, shadows: false, gyro: true })
    setPerfOverride('low')
    expect(getDepthProfile()).toMatchObject({ level: 'lite', layers: true, idle: false, gyro: false })
  })

  it('motion intensity falls with the tier but never reaches zero', () => {
    setPerfOverride('high')
    const high = getMotionIntensity()
    setPerfOverride('mid')
    const mid = getMotionIntensity()
    setPerfOverride('low')
    const low = getMotionIntensity()
    expect(high).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(low)
    expect(low).toBeGreaterThan(0)
  })
})

describe('galaxy profile', () => {
  it('uses fewer stars and a frame cap on weaker tiers', () => {
    const canvas = HTMLCanvasElement.prototype
    const original = canvas.getContext
    canvas.getContext = () => ({})
    try {
      setPerfOverride('high')
      const high = getGalaxyProfile()
      setPerfOverride('low')
      const low = getGalaxyProfile()
      expect(low.starCount).toBeLessThan(high.starCount)
      expect(low.dpr).toBe(1)
      expect(low.fpsCap).toBeGreaterThan(0)
    } finally {
      canvas.getContext = original
    }
  })
})
