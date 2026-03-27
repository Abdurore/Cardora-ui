export const TIER_INFO = {
  simple: {
    key: 'simple',
    label: 'Basic',
    cost: 5,
    badgeClass: 'tier-simple',
  },
  special: {
    key: 'special',
    label: 'Premium',
    cost: 15,
    badgeClass: 'tier-special',
  },
  signature: {
    key: 'signature',
    label: 'Premium+',
    cost: 30,
    badgeClass: 'tier-signature',
  },
}

export const getTierInfo = (tier = 'simple') => TIER_INFO[tier] || TIER_INFO.simple

export const getTierCost = (tier) => getTierInfo(tier).cost
