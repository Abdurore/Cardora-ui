import { getGiftEffect } from './PremiumGiftReveal.jsx'

function GiftIcon({ effectKey, size = 48 }) {
  const config = getGiftEffect(effectKey || 'heart')
  const gradId = `gift-static-${effectKey}`
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={{ display: 'block', filter: `drop-shadow(0 0 8px ${config.gradient[1]}44)` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={config.gradient[0]} />
          <stop offset="100%" stopColor={config.gradient[1]} />
        </linearGradient>
      </defs>
      <path d={config.path} fill={`url(#${gradId})`} />
    </svg>
  )
}

function GiftCard({ title, amount, note, variant, effectKey, actionLabel, onAction, disabled }) {
  return (
    <div className={`gift ${variant || ''}`}>
      <div className="gift-icon-wrap">
        <GiftIcon effectKey={effectKey} size={52} />
      </div>
      <h4>{title}</h4>
      <p className="gift-amount">{amount}</p>
      <p className="gift-note">{note}</p>
      {actionLabel ? (
        <button className="gift-action" type="button" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export { GiftIcon }
export default GiftCard
