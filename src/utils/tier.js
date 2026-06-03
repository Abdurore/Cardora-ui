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

export const VALID_TIERS_BY_TYPE = {
  personal: ['classic', 'premium', 'elite'],
  poll: ['classic', 'elite'],
  chain: ['classic', 'elite'],
  trivia: ['classic', 'elite'],
  anonymous: ['classic', 'elite'],
}

export const CARD_TYPE_PRICING = {
  personal: { classic: 0, premium: 25, elite: 35 },
  poll: { classic: 0, elite: 35 },
  chain: { classic: 0, elite: 40 },
  trivia: { classic: 0, elite: 50 },
  anonymous: { classic: 0, elite: 45 },
}

const TIER_ALIASES = {
  simple: 'classic',
  special: 'premium',
  signature: 'elite',
}

const TYPE_ALIASES = {
  moment: 'personal',
  standard: 'personal',
  anon: 'anonymous',
}

function normaliseKey(tier) {
  if (!tier) return 'classic'
  const key = String(tier).toLowerCase()
  return TIER_ALIASES[key] || key
}

function normaliseType(type) {
  if (!type) return 'personal'
  const key = String(type).toLowerCase()
  return TYPE_ALIASES[key] || key
}

export const getTierInfo = (tier = 'classic') => TIER_INFO[normaliseKey(tier)] || TIER_INFO.classic

export const getValidTiersForType = (type = 'personal') => VALID_TIERS_BY_TYPE[normaliseType(type)] || VALID_TIERS_BY_TYPE.personal

export const isValidTierForType = (type = 'personal', tier = 'classic') => getValidTiersForType(type).includes(normaliseKey(tier))

export const getCardCost = (type = 'personal', tier = 'classic', prices = null) => {
  const resolvedType = normaliseType(type)
  const resolvedTier = normaliseKey(tier)
  const priceMap = prices?.[resolvedType] || prices?.[type] || CARD_TYPE_PRICING[resolvedType] || CARD_TYPE_PRICING.personal
  return Number(priceMap?.[resolvedTier] ?? CARD_TYPE_PRICING[resolvedType]?.[resolvedTier] ?? 0)
}

export const getTierCost = (tier, type = 'personal', prices = null) => getCardCost(type, tier, prices)
