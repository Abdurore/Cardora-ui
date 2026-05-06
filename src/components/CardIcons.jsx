// Custom SVG icons for Cardora card types — consistent stroke-based design

export function PersonalCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Envelope body */}
      <rect x="2" y="5" width="20" height="15" rx="2.5" stroke={color} strokeWidth="1.6" />
      {/* Fold lines forming V flap */}
      <path d="M2 8.5L10.5 14.5C11.4 15.1 12.6 15.1 13.5 14.5L22 8.5" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {/* Wax-seal star on the envelope */}
      <circle cx="12" cy="13.5" r="2.8" fill={color} opacity="0.12" />
      <path
        d="M12 11.2l.6 1.8h1.9l-1.5 1.1.6 1.8-1.6-1.2-1.6 1.2.6-1.8-1.5-1.1h1.9z"
        fill={color}
        opacity="0.75"
      />
    </svg>
  )
}

export function PollCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* 4 bars rising left→right */}
      <path d="M4 20V16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 20V11" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 20V14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M19 20V7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {/* Baseline */}
      <path d="M2 20h20" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      {/* Selection dot on tallest bar */}
      <circle cx="19" cy="6" r="1.8" fill={color} opacity="0.7" />
    </svg>
  )
}

export function TriviaCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Lightning bolt */}
      <path
        d="M13.5 2.5L5 13.5H12L10.5 21.5L19 10.5H12L13.5 2.5Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ChainCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Back card (right-shifted) */}
      <rect x="9" y="8" width="13" height="10" rx="2" stroke={color} strokeWidth="1.5" opacity="0.5" />
      {/* Front card */}
      <rect x="2" y="5" width="13" height="10" rx="2" stroke={color} strokeWidth="1.6" />
      {/* Arrow pointing right (connecting the two) */}
      <path d="M16 10L20 12L16 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AnonCardIcon({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Ghost body */}
      <path
        d="M12 3C8.13 3 5 6.13 5 10v9l2.5-2 2.5 2 2.5-2 2.5 2 2.5-2V10c0-3.87-3.13-7-7-7z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Left eye */}
      <circle cx="9.5" cy="11" r="1.2" fill={color} opacity="0.75" />
      {/* Right eye */}
      <circle cx="14.5" cy="11" r="1.2" fill={color} opacity="0.75" />
      {/* Mouth — neutral / anonymous */}
      <path d="M10 14.5h4" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
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
