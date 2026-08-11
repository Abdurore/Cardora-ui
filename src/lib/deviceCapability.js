// Single source of truth for "is this device weak" — previously PremiumGiftReveal had
// its own private check (a real capability signal: CPU cores, narrow viewport, or
// reduced-motion) while CardPreviewModal had a separate, much narrower one
// (prefers-reduced-motion only, which almost nobody with a merely slow phone has ever
// turned on). The two never agreed, so a mid-range phone got full-intensity ambient
// particles/confetti/gift reveal everywhere except the one place that happened to
// check hardwareConcurrency.

export function isLowPowerDevice() {
  if (typeof window === 'undefined') return false
  const cores = navigator.hardwareConcurrency || 4
  const narrow = window.innerWidth < 768
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return narrow || cores <= 4 || reduceMotion
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
}

// Graduated 0-1 scalar for scaling particle counts/durations, rather than a binary
// on/off — a weak device should get a smaller, faster effect, not the full thing or
// nothing. Reduced-motion stacks with low-power (both true = most conservative).
export function getMotionIntensity() {
  const lowPower = isLowPowerDevice()
  const reduceMotion = prefersReducedMotion()
  if (lowPower && reduceMotion) return 0.25
  if (lowPower || reduceMotion) return 0.5
  return 1
}

// Weak *hardware*, as distinct from isLowPowerDevice() — which also counts any
// viewport under 768px and so treats every phone as low-power. That's the right
// call for spawning hundreds of particles, but wrong for anything a phone is
// the primary consumer of.
function isWeakHardware() {
  if (typeof navigator === 'undefined') return false
  return (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2
}

// Depth is graduated rather than on/off. `layers` stays true even on weak
// hardware: translateZ separation is a compositor-only operation and costs
// essentially nothing, so the sense of depth survives the downgrade and only
// the input-driven motion is trimmed. Reduced-motion is the only thing that
// flattens the scene entirely.
export function getDepthProfile() {
  if (prefersReducedMotion()) {
    return { level: 'none', layers: false, tilt: 0, idle: false, gyro: false, shadows: false }
  }
  if (isWeakHardware()) {
    return { level: 'lite', layers: true, tilt: 0.5, idle: true, gyro: false, shadows: false }
  }
  return { level: 'full', layers: true, tilt: 1, idle: true, gyro: true, shadows: true }
}

let webglSupport = null
export function hasWebGL() {
  if (webglSupport !== null) return webglSupport
  if (typeof document === 'undefined') return (webglSupport = false)
  try {
    const canvas = document.createElement('canvas')
    webglSupport = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    webglSupport = false
  }
  return webglSupport
}

// `fallback` renders a plain DOM memory list instead of a canvas. Note this
// deliberately does NOT gate on viewport width — phones are the primary way a
// card link gets opened, and they handle a few thousand points fine.
export function getGalaxyProfile() {
  if (!hasWebGL() || prefersReducedMotion()) {
    return { mode: 'fallback', starCount: 0, dpr: 1, autoRotate: false }
  }
  if (isWeakHardware()) {
    return { mode: 'reduced', starCount: 2200, dpr: 1, autoRotate: false }
  }
  return { mode: 'full', starCount: 6000, dpr: 2, autoRotate: true }
}
