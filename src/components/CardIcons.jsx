// Custom SVG icons for Cardora card types — clean stroke-based design

export function PersonalCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2.5" stroke={color} strokeWidth="1.6" />
      <path d="M2 8l9.1 6a1.6 1.6 0 0 0 1.8 0L22 8" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function PollCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 20V15" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10 20V9" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M15 20V13" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20 20V5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20" cy="4" r="1.8" fill={color} />
    </svg>
  )
}

export function TriviaCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Answer sheet lines */}
      <path d="M5 7h7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 11h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 15h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      {/* Checkmark */}
      <path d="M14 12.5l2.3 2.5L20 10" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {/* Card border */}
      <rect x="2" y="3" width="20" height="18" rx="2.5" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

export function ChainCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Front card */}
      <rect x="2" y="5" width="12" height="9" rx="2" stroke={color} strokeWidth="1.6" />
      {/* Back card */}
      <rect x="10" y="10" width="12" height="9" rx="2" stroke={color} strokeWidth="1.5" opacity="0.55" />
      {/* Link arrow */}
      <path d="M14 9.5l2.5 2-2.5 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AnonCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Eye shape */}
      <path d="M2 12S5.5 5 12 5s10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.8" stroke={color} strokeWidth="1.5" />
      {/* Slash line for anonymous */}
      <line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// Map from card type id → icon component (for convenience)
export const CARD_TYPE_ICONS = {
  personal:  PersonalCardIcon,
  poll:      PollCardIcon,
  trivia:    TriviaCardIcon,
  chain:     ChainCardIcon,
  anonymous: AnonCardIcon,
}
