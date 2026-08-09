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
