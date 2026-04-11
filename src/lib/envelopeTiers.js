const BASE_PROFILES = {
  simple: {
    parallax: false,
    particles: 0,
    monogram: false,
    caption: false,
    ambientAudio: false,
    letterbox: false,
    closingFold: false,
  },
  special: {
    parallax: true,
    particles: 6,
    monogram: true,
    caption: true,
    ambientAudio: true,
    letterbox: false,
    closingFold: false,
  },
  signature: {
    parallax: true,
    particles: 12,
    monogram: true,
    caption: true,
    ambientAudio: true,
    letterbox: true,
    closingFold: true,
  },
}

const ALIAS = {
  classic: 'simple',
  premium: 'special',
  elite: 'signature',
  basic: 'simple',
}

function resolveTierKey(tier) {
  if (!tier) return 'simple'
  const key = String(tier).toLowerCase()
  return ALIAS[key] || (BASE_PROFILES[key] ? key : 'simple')
}

function isLowEndDevice() {
  if (typeof navigator === 'undefined') return false
  const cores = navigator.hardwareConcurrency || 8
  const memory = navigator.deviceMemory || 8
  return cores <= 4 || memory <= 2
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isTouchOnly() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches
}

export function getEnvelopeTierProfile(tier) {
  const key = resolveTierKey(tier)
  const base = { ...BASE_PROFILES[key] }

  if (prefersReducedMotion()) {
    return {
      ...base,
      parallax: false,
      particles: 0,
      ambientAudio: false,
      letterbox: false,
      closingFold: false,
      reducedMotion: true,
    }
  }

  if (isLowEndDevice()) {
    return {
      ...BASE_PROFILES.simple,
      monogram: base.monogram,
      caption: base.caption,
      ambientAudio: base.ambientAudio,
      downgraded: true,
    }
  }

  if (isTouchOnly()) {
    base.parallax = false
  }

  return base
}

export const PACING_MULTIPLIERS = {
  quick: 0.65,
  normal: 1,
  cinematic: 1.45,
}

export function getPacingMultiplier(pacing) {
  return PACING_MULTIPLIERS[pacing] || 1
}
