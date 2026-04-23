// Tier keys now match the backend card engine: classic | premium | elite.
// Legacy frontend keys (simple/special/signature) are kept as aliases so any
// older draft or cached payload still resolves to the correct tier info.

export const TIER_INFO = {
  classic: {
    key: 'classic',
    label: 'Classic',
    cost: 0,
    badgeClass: 'tier-classic',
    features: [
      'Free tier',
      'Clean animated reveal',
      'Standard border',
      'No music or ambient effects',
    ],
  },
  premium: {
    key: 'premium',
    label: 'Premium',
    cost: 25,
    badgeClass: 'tier-premium',
    features: [
      'Background music + video',
      'Gradient card borders',
      'Ambient particles + open effects',
      'Fade & typewriter text',
    ],
  },
  elite: {
    key: 'elite',
    label: 'Elite',
    cost: 35,
    badgeClass: 'tier-elite',
    features: [
      'Full cinematic experience',
      'Animated glowing borders',
      'Gifts + interactive questions',
      'Premium music + video',
      'All effects unlocked',
    ],
  },
}

const TIER_ALIASES = {
  simple: 'classic',
  special: 'premium',
  signature: 'elite',
}

function normaliseKey(tier) {
  if (!tier) return 'classic'
  const key = String(tier).toLowerCase()
  return TIER_ALIASES[key] || key
}

export const getTierInfo = (tier = 'classic') => TIER_INFO[normaliseKey(tier)] || TIER_INFO.classic

export const getTierCost = (tier) => getTierInfo(tier).cost
