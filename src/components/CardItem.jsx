import { getTierInfo } from '../utils/tier.js'

function CardItem({
  id,
  title,
  meta,
  likes,
  tag,
  tier = 'simple',
  variant = 'one',
  onClick,
  isFavorite,
  onToggleFavorite,
}) {
  const tierInfo = getTierInfo(tier)

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
      <span className="card-cost">{tierInfo.cost} CC</span>
      {tag ? <span className={`badge ${tag.toLowerCase()}`}>{tag}</span> : null}
      <div className="card-thumb" />
      <div className="card-info">
        <h4>{title}</h4>
        <div className="card-meta">
          <span>{meta}</span>
          <span className="dot" />
          <span>{likes}</span>
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
