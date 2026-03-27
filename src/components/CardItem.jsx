import { getTierInfo } from '../utils/tier.js'

function CardItem({
  id,
  title,
  meta,
  likes,
  tier = 'simple',
  variant = 'one',
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
      <span className={`tier-badge ${tierInfo.badgeClass}`}>{tierInfo.label}</span>
      <div className="card-thumb" />
      <div className="card-info">
        <h4>{title}</h4>
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
        <button
          type="button"
          className="overlay-btn"
          onClick={(event) => {
            event.stopPropagation()
            onClick?.()
          }}
        >
          Preview
        </button>
        <button
          type="button"
          className="overlay-btn primary"
          onClick={(event) => {
            event.stopPropagation()
            onClick?.()
          }}
        >
          Use Template
        </button>
      </div>
    </div>
  )
}

export default CardItem
