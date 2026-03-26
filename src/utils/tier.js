export const TIER_INFO = {
  simple: {
    key: 'simple',
    label: '\u{1F48C} Simple',
    cost: 5,
    badgeClass: 'tier-simple',
  },
  special: {
    key: 'special',
    label: '\u2728 Special',
    cost: 15,
    badgeClass: 'tier-special',
  },
  signature: {
    key: 'signature',
    label: '\u{1F381} Signature',
    cost: 30,
    badgeClass: 'tier-signature',
  },
}

export const getTierInfo = (tier = 'simple') => TIER_INFO[tier] || TIER_INFO.simple

export const getTierCost = (tier) => getTierInfo(tier).cost
