import { getTierInfo } from '../utils/tier.js'

function CardItem({
  id,
  title,
  subtitle,
  occasion,
  meta,
  likes,
  tier = 'simple',
  variant = 'one',
  showOccasion = true,
  previewImage,
  onClick,
  isFavorite,
  onToggleFavorite,
}) {
  const tierInfo = getTierInfo(tier)
  const audienceCount = String(meta || '')
    .replace(/views?/i, '')
    .trim()

  return (
    <div
      role="button"
      tabIndex={0}
      className={`card ${variant}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onClick?.()
      }}
    >
      <button
        type="button"
        className={`card-favorite ${isFavorite ? 'active' : ''}`}
        aria-pressed={isFavorite}
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite?.(id)
        }}
      >
        {'\u2764'}
      </button>
      <div className="card-thumb">
        {previewImage ? <img src={previewImage} alt={title || ''} className="card-thumb-image" /> : null}
        <div className="card-thumb-glow" />
        <div className="card-thumb-aura" />
      </div>
      <div className="card-info">
        {showOccasion && occasion ? <p className="card-eyebrow">{occasion}</p> : null}
        <h4>{title}</h4>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
        <div className="card-stats">
          <span className="card-stat">
            <strong>{tierInfo.cost}</strong> CC
          </span>
          <span className="card-stat">
            <strong>{likes}</strong> Likes
          </span>
          <span className="card-stat">
            <strong>{audienceCount || '0'}</strong> Users
          </span>
          <span className={`card-stat tier-stat ${tierInfo.badgeClass}`}>
            <strong>{tierInfo.label}</strong>
          </span>
        </div>
      </div>
      <div className="card-overlay">
        <div className="card-overlay-copy">
          <p>Open Template</p>
          <span>Preview the full Cardora experience</span>
        </div>
      </div>
    </div>
  )
}

export default CardItem

