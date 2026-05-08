import { useState } from 'react'
import { getTierInfo } from '../utils/tier.js'
import ReportModal from './ReportModal.jsx'

const TYPE_BADGE = {
  personal:  { label: 'Personal',  cls: 'type-badge-personal' },
  poll:      { label: 'Poll',      cls: 'type-badge-poll' },
  trivia:    { label: 'Trivia',    cls: 'type-badge-trivia' },
  chain:     { label: 'Chain',     cls: 'type-badge-chain' },
  anonymous: { label: 'Anonymous', cls: 'type-badge-anonymous' },
  standard:  { label: 'Personal',  cls: 'type-badge-personal' },
  moment:    { label: 'Personal',  cls: 'type-badge-personal' },
  anon:      { label: 'Anonymous', cls: 'type-badge-anonymous' },
}

function CardItem({
  id,
  title,
  subtitle,
  occasion,
  meta,
  likes,
  tier = 'classic',
  type,
  variant = 'one',
  showOccasion = true,
  showTypeBadge = true,
  previewImage,
  onClick,
  isFavorite,
  onToggleFavorite,
}) {
  const tierInfo = getTierInfo(tier)
  const audienceCount = String(meta || '').replace(/views?/i, '').trim()
  const [showReport, setShowReport] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      className={`card ${variant}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.() }}
    >
      <button
        type="button"
        className={`card-favorite ${isFavorite ? 'active' : ''}`}
        aria-pressed={isFavorite}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(id) }}
      >
        {'❤'}
      </button>
      <button
        type="button"
        className="card-report-btn"
        title="Report template"
        aria-label="Report template"
        onClick={(e) => { e.stopPropagation(); setShowReport(true) }}
      >
        &#9873;
      </button>

      <div className="card-thumb">
        {previewImage ? <img src={previewImage} alt={title || ''} className="card-thumb-image" /> : null}
        <div className="card-thumb-glow" />
        <div className="card-thumb-aura" />
      </div>

      {showTypeBadge && TYPE_BADGE[type] && (
        <span className={`card-type-badge ${TYPE_BADGE[type].cls}`}>
          {TYPE_BADGE[type].label}
        </span>
      )}

      <div className="card-info">
        {showOccasion && occasion ? <p className="card-eyebrow">{occasion}</p> : null}
        <h4>{title}</h4>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
        <div className="card-stats">
          <span className="card-stat"><strong>{tierInfo.cost}</strong> CC</span>
          <span className="card-stat"><strong>{likes}</strong> Likes</span>
          <span className="card-stat"><strong>{audienceCount || '0'}</strong> Users</span>
          <span className={`card-stat tier-stat ${tierInfo.badgeClass}`}><strong>{tierInfo.label}</strong></span>
        </div>
      </div>

      <div className="card-overlay">
        <div className="card-overlay-copy">
          <p>Open Template</p>
          <span>Preview the full Cardora experience</span>
        </div>
      </div>

      {showReport && (
        <ReportModal
          type="template"
          targetId={id}
          targetName={title}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}

export default CardItem
