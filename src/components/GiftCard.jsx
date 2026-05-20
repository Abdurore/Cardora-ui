import { getGiftEffect } from './PremiumGiftReveal.jsx'

function GiftIcon({ effectKey, size = 48 }) {
  const config = getGiftEffect(effectKey || 'tiny')
  const gradId = `gift-static-${effectKey}`
  const isRainbow = config.gradient.length > 2
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={{ display: 'block', filter: `drop-shadow(0 0 8px ${config.gradient[1]}44)` }}
      aria-hidden="true"
    >
      <defs>
        {isRainbow ? (
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            {config.gradient.map((color, i) => (
              <stop
                key={i}
                offset={`${(i / (config.gradient.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </linearGradient>
        ) : (
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={config.gradient[0]} />
            <stop offset="100%" stopColor={config.gradient[1]} />
          </linearGradient>
        )}
      </defs>
      <path d={config.path} fill={`url(#${gradId})`} />
    </svg>
  )
}

const TIER_CLASSES = {
  common: 'gift-tier-common',
  rare: 'gift-tier-rare',
  epic: 'gift-tier-epic',
  legendary: 'gift-tier-legendary',
  mythic: 'gift-tier-mythic',
}

function GiftCard({ title, amount, note, variant, effectKey, actionLabel, onAction, disabled, tier, color }) {
  const tierClass = TIER_CLASSES[tier] || ''
  return (
    <div className={`gift ${variant || ''} ${tierClass}`}>
      <div className="gift-icon-wrap">
        <GiftIcon effectKey={effectKey} size={52} />
      </div>
      {tier && <span className={`gift-tier-badge ${tierClass}`}>{tier}</span>}
      <h4>{title}</h4>
      <p className="gift-amount">{amount}</p>
      {color && <p className="gift-color-label">{color}</p>}
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
