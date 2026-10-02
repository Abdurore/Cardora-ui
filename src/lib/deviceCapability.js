// Single source of truth for "is this device weak" — previously PremiumGiftReveal had
// its own private check (a real capability signal: CPU cores, narrow viewport, or
// reduced-motion) while CardPreviewModal had a separate, much narrower one
// (prefers-reduced-motion only, which almost nobody with a merely slow phone has ever
// turned on). The two never agreed, so a mid-range phone got full-intensity ambient
// particles/confetti/gift reveal everywhere except the one place that happened to
// check hardwareConcurrency.

import { getPerfTier } from './perfTier.js'

// Everything below reads the shared performance tier (perfTier.js) instead
// of each keeping its own hardware heuristic. The tier starts from a static
// estimate and is corrected at runtime from measured frame times, so a phone
// that claims 8 cores but struggles gets downgraded, and a capable phone is
// no longer assumed weak just because its viewport is narrow.

export function isLowPowerDevice() {
  if (typeof window === 'undefined') return false
  return getPerfTier() === 'low' || prefersReducedMotion()
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
}

// Graduated 0-1 scalar for scaling particle counts/durations, rather than a binary
// on/off — a weak device should get a smaller, faster effect, not the full thing or
// nothing. Reduced-motion stacks with the tier (both = most conservative).
//
// A phone's full-screen canvas is fill-rate bound even when its CPU is fine,
// so touch devices cap a little below desktop at each tier.
export function getMotionIntensity() {
  const touch = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  const byTier = touch
    ? { high: 0.75, mid: 0.55, low: 0.35 }
    : { high: 1, mid: 0.7, low: 0.4 }
  const base = byTier[getPerfTier()] ?? 0.75
  return prefersReducedMotion() ? Math.min(base, 0.25) : base
}

// Depth is graduated rather than on/off. `layers` stays true at every tier:
// translateZ separation is a compositor-only operation and costs essentially
// nothing, so the sense of depth survives the downgrade and only the
// input-driven motion is trimmed. What gets cut on weaker tiers is the
// *continuous* work: the idle drift (a perpetual rAF loop restyling the card
// every frame) and the tracking shadow/sheen repaints. Reduced-motion is the
// only thing that flattens the scene entirely.
export function getDepthProfile() {
  if (prefersReducedMotion()) {
    return { level: 'none', layers: false, tilt: 0, idle: false, gyro: false, shadows: false }
  }
  const tier = getPerfTier()
  if (tier === 'low') return { level: 'lite', layers: true, tilt: 0.5, idle: false, gyro: false, shadows: false }
  if (tier === 'mid') return { level: 'lite', layers: true, tilt: 0.7, idle: false, gyro: true, shadows: false }
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
    return { mode: 'fallback', starCount: 0, dpr: 1, autoRotate: false, fpsCap: 0 }
  }
  const tier = getPerfTier()
  if (tier === 'low') return { mode: 'reduced', starCount: 1600, dpr: 1, autoRotate: false, fpsCap: 30 }
  if (tier === 'mid') return { mode: 'reduced', starCount: 3200, dpr: 1, autoRotate: true, fpsCap: 45 }
  return { mode: 'full', starCount: 6000, dpr: 2, autoRotate: true, fpsCap: 0 }
}
