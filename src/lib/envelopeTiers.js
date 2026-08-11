import { getDepthProfile } from './deviceCapability.js'

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

export function getEnvelopeTierProfile(tier) {
  const key = resolveTierKey(tier)
  const base = { ...BASE_PROFILES[key] }
  const depth = getDepthProfile()

  // Depth is no longer tied to tier or pointer type. Parallax used to be off
  // for classic and off again for every touch device, which between them left
  // the envelope a completely static image on phones — the main way cards get
  // opened. It now tracks device capability alone, and getDepthProfile()
  // already scales the tilt down (or to zero) where that's warranted.
  base.parallax = depth.tilt > 0
  base.depth = depth.level

  if (depth.level === 'none') {
    return {
      ...base,
      particles: 0,
      ambientAudio: false,
      letterbox: false,
      closingFold: false,
      reducedMotion: true,
    }
  }

  if (depth.level === 'lite') {
    return {
      ...base,
      particles: Math.min(base.particles, 4),
      letterbox: false,
      closingFold: false,
      downgraded: true,
    }
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
