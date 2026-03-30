export const TIER_INFO = {
  simple: {
    key: 'simple',
    label: 'Basic',
    cost: 5,
    badgeClass: 'tier-simple',
    features: [
      'Simple card animation',
      'Standard border',
      'No background music',
      'Basic text reveal',
    ],
  },
  special: {
    key: 'special',
    label: 'Premium',
    cost: 15,
    badgeClass: 'tier-special',
    features: [
      'Music + signature sound',
      'Gradient card borders',
      'Better visual effects',
      'Interactive questions',
      'Fade & typewriter text',
    ],
  },
  signature: {
    key: 'signature',
    label: 'Premium+',
    cost: 30,
    badgeClass: 'tier-signature',
    features: [
      'Full confetti & particle effects',
      'Animated glowing borders',
      'Premium background music',
      'Gift effect animations',
      'All interaction modes',
      'Priority send delivery',
    ],
  },
}

export const getTierInfo = (tier = 'simple') => TIER_INFO[tier] || TIER_INFO.simple

export const getTierCost = (tier) => getTierInfo(tier).cost
