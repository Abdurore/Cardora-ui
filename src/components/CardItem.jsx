import { useState } from 'react'
import { getTierInfo } from '../utils/tier.js'
import ReportModal from './ReportModal.jsx'
import { CARD_TYPE_ICONS } from './CardIcons.jsx'

const truncateText = (text, wordLimit = 10) => {
  if (!text) return text
  const words = text.split(/\s+/)
  if (words.length <= wordLimit) return text
  return words.slice(0, wordLimit).join(' ') + '...'
}

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
  likeCount,
  userCount,
  usageCount,
  viewCount,
  tier = 'classic',
  type,
  variant = 'one',
  showOccasion = true,
  showTypeBadge = true,
  previewImage,
  onClick,
  isLiked,
  onToggleLike,
  hoverLabel = 'Open Template',
  isTemplate = true,
  giftEffect,
  artistName,
  artistAvatar,
  isFoundingArtist,
  price,
  isUnlocked = true,
}) {
  const tierInfo = getTierInfo(tier)
  const displayLikes = Number(likeCount ?? likes ?? 0) || 0
  const displayUsers = Number(usageCount ?? userCount ?? String(meta || '').replace(/users?|views?/i, '').trim() ?? 0) || 0
  const displayViews = Number(viewCount ?? 0) || 0
  const [showReport, setShowReport] = useState(false)
  const giftEnabled = !isTemplate && giftEffect?.enabled && giftEffect?.effectKey && giftEffect.effectKey !== 'none'
  const giftClaimed = giftEnabled && giftEffect?.status === 'claimed'
  const templatePrice = Number(price || 0)
  const unlockLabel = templatePrice <= 0 ? 'Use free' : isUnlocked ? 'Use' : `${templatePrice} CC`

  return (
    <div
      role="button"
      tabIndex={0}
      className={`card ${variant} ${!isTemplate ? 'personal-card' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.() }}
    >
      {/* Like button — reflects backend likes */}
      {isTemplate && (
        <button
          type="button"
          className={`card-like-btn ${isLiked ? 'liked' : ''}`}
          aria-pressed={isLiked}
          title={isLiked ? 'Unlike template' : 'Like template'}
          aria-label={isLiked ? 'Unlike template' : 'Like template'}
          onClick={(e) => { e.stopPropagation(); onToggleLike?.(id) }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span>{displayLikes}</span>
        </button>
      )}
      
      {isTemplate && (
        <button
          type="button"
          className="card-report-btn"
          title="Report template"
          aria-label="Report template"
          onClick={(e) => { e.stopPropagation(); setShowReport(true) }}
        >
          &#9873;
        </button>
      )}

      <div className="card-thumb">
        {previewImage ? <img src={previewImage} alt={title || ''} className="card-thumb-image" /> : null}
        <div className="card-thumb-glow" />
        <div className="card-thumb-aura" />
      </div>

      {showTypeBadge && TYPE_BADGE[type] && (
        isTemplate ? (
          <span className={`card-type-badge ${TYPE_BADGE[type].cls}`}>
            {TYPE_BADGE[type].label}
          </span>
        ) : (
          (() => {
            const TypeIcon = CARD_TYPE_ICONS[type] || CARD_TYPE_ICONS.personal
            return (
              <div className="card-type-icon-badge" title={TYPE_BADGE[type].label}>
                <TypeIcon size={16} />
              </div>
            )
          })()
        )
      )}

      {giftEnabled && (
        <span className={`card-gift-badge ${giftClaimed ? 'card-gift-badge-claimed' : 'card-gift-badge-pending'}`}>
          {giftClaimed ? 'Gift claimed' : 'Gift attached'}
        </span>
      )}

      {isTemplate && (
        <span className={`card-unlock-badge ${templatePrice <= 0 ? 'card-unlock-badge-free' : isUnlocked ? 'card-unlock-badge-owned' : 'card-unlock-badge-priced'}`}>
          {unlockLabel}
        </span>
      )}

      <div className="card-info">
        {showOccasion && occasion ? <p className="card-eyebrow">{occasion}</p> : null}
        <h4>{title}</h4>
        {isTemplate && artistName ? (
          <p className="card-artist-credit">
            {artistAvatar ? <img className="card-artist-avatar" src={artistAvatar} alt="" /> : null}
            by {artistName}
            {isFoundingArtist ? <span className="card-founding-badge" title="Founding Artist">★ Founding Artist</span> : null}
          </p>
        ) : null}
        {subtitle ? <p className="card-subtitle">{truncateText(subtitle, 10)}</p> : null}
        {isTemplate && (
          <div className="card-stats">
            <span className="card-stat"><strong>{tierInfo.cost}</strong> CC</span>
            <span className="card-stat"><strong>{displayLikes}</strong> Likes</span>
            <span className="card-stat"><strong>{displayUsers}</strong> Users</span>
            <span className="card-stat"><strong>{displayViews}</strong> Views</span>
            <span className={`card-stat tier-stat ${tierInfo.badgeClass}`}><strong>{tierInfo.label}</strong></span>
          </div>
        )}
      </div>

      <div className="card-overlay">
        <div className="card-overlay-copy">
          <p>{hoverLabel}</p>
          <span>Preview the full Cardora experience</span>
        </div>
      </div>

      {showReport && isTemplate && (
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
