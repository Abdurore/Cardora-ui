import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getTierInfo } from '../utils/tier.js'
import { getTemplateById } from '../lib/api.js'
import ReportModal from './ReportModal.jsx'

const SHARE_PLATFORMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    getUrl: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#2AABEE',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
    getUrl: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    color: '#1DA1F2',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    getUrl: (url, title) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
]

function CardDetailModal({
  card,
  onClose,
  balance = 0,
  currentUser,
  onRequireAuth,
  onDeductCC,
  openCardTypeModal,
  isLiked = false,
  onToggleLike,
  onTemplateUse,
}) {
  const [view, setView] = useState('main') // 'main' | 'share'
  const [showReport, setShowReport] = useState(false)
  const [copied, setCopied] = useState(false)
  const [startY, setStartY] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!card) return undefined
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handleKey)
    }
  }, [card, onClose])

  useEffect(() => {
    setView('main')
    setCopied(false)
  }, [card])

  if (!card) return null

  const tierInfo = getTierInfo(card?.tier)
  const isPremium = tierInfo.key !== 'classic'

  const handleTouchStart = (e) => setStartY(e.touches[0].clientY)
  const handleTouchMove = (e) => {
    if (startY === null) return
    if (e.touches[0].clientY - startY > 120) onClose()
  }

  // Template share URL — links directly to the template so friends can use it
  const templateUrl = card
    ? `${window.location.origin}/explore?template=${card.id || card.slug}`
    : ''
  const shareTitle = card
    ? `Use this "${card.title}" template on Cardora ✉`
    : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(templateUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* ignore */ }
  }

  const handleNativeShare = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({ title: card.title, text: shareTitle, url: templateUrl })
    } catch { /* cancelled */ }
  }

  const handleUseTemplate = async () => {
    const rawType = (card?.type || 'personal').toLowerCase()
    // Pass the type directly — studio now uses backend-aligned type names
    const type = rawType
    const tier = card?.tier || 'classic'

    // Ensure we carry the artist's full layoutConfig into the studio. Listing
    // endpoints sometimes omit it; fetch the full template on demand.
    let fullCard = card
    const hasLayout = card?.layoutConfig && Object.keys(card.layoutConfig).length > 0
    if (!hasLayout && (card?.templateId || card?.id)) {
      try {
        const tid = card.templateId || card.id
        const res = await getTemplateById(tid)
        const tmpl = res?.template || res?.data || res || null
        const layout = tmpl?.layoutConfig || tmpl?.layoutdata || null
        if (layout) fullCard = { ...card, layoutConfig: layout }
      } catch { /* fall through with what we have */ }
    }

    onTemplateUse?.(card)
    onClose()
    navigate(`/studio?type=${type}&tier=${tier}`, { state: { cardData: fullCard } })
  }

  const content = card.layoutConfig?.content || card.backendTemplate?.layoutConfig?.content || {}
  const modalTitle = card.title || content.heading || content.question || 'Template'
  const modalSubtitle = card.subtitle || content.body || content.message || ''
  const modalMessage = card.message || content.extendedBody || content.body || content.message || ''
  const likeCount = Number(card.likeCount ?? card.likes ?? 0)
  const usageCount = Number(card.usageCount ?? card.userCount ?? 0)
  const viewCount = Number(card.viewCount ?? 0)

  return createPortal(
    <section className="detail-modal" role="dialog" aria-modal="true">
      <div className="detail-backdrop" onClick={onClose} />
      <div
        className="detail-card cdm-redesign"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Drag handle */}
        <div className="cdm-drag-handle" aria-hidden="true" />

        {/* Preview thumb */}
        <div className={`detail-thumb ${card.variant || ''}`}>
          {card.previewImage
            ? <img src={card.previewImage} alt={modalTitle || ''} className="detail-thumb-image" />
            : null}
          <div className="detail-thumb-overlay">
            <div className="detail-thumb-top">
              <p className="detail-eyebrow">{card.occasion}</p>
              <span className={`tier-badge ${tierInfo.badgeClass}`}>{tierInfo.label}</span>
            </div>
            <div className="detail-thumb-copy">
              <h3>{modalTitle}</h3>
              <p>{modalSubtitle}</p>
            </div>
          </div>
          {isPremium ? <span className="detail-upgrade">Unlock full experience</span> : null}
        </div>

        {/* Body */}
        <div className="detail-body">
          {/* Meta row */}
          <div className="cdm-meta-row">
            <div className="cdm-meta-pill">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" opacity=".7">
                <path d="M8 1.5a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5.5A.5.5 0 0 1 7.5 7.5V2a.5.5 0 0 1 .5-.5z" />
                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z" />
              </svg>
              {tierInfo.cost === 0 ? 'Free' : `${tierInfo.cost} CC`}
            </div>
            <button
              type="button"
              className={`cdm-meta-pill cdm-like-pill ${isLiked ? 'liked' : ''}`}
              aria-pressed={isLiked}
              onClick={() => onToggleLike?.(card.id)}
            >
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" opacity=".7">
                  <path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" />
                </svg>
              {isLiked ? 'Liked' : 'Like'} · {likeCount}
            </button>
            <div className="cdm-meta-pill">{usageCount} users</div>
            <div className="cdm-meta-pill">{viewCount} views</div>
          </div>

          {tierInfo.features ? (
            <ul className="tier-features cdm-features">
              {tierInfo.features.map((f) => (
                <li key={f}><span className="tier-check">+</span> {f}</li>
              ))}
            </ul>
          ) : null}

          {modalMessage ? <p className="detail-message">{modalMessage}</p> : null}

          {/* ── Main view ── */}
          {view === 'main' && (
            <div className="cdm-actions">
              <button className="cdm-btn-primary" type="button" onClick={handleUseTemplate}>
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="6" height="6" rx="1" />
                  <rect x="11" y="3" width="6" height="6" rx="1" />
                  <rect x="3" y="11" width="6" height="6" rx="1" />
                  <path d="M14 11v6M11 14h6" />
                </svg>
                Use Template
              </button>
              <button className="cdm-btn-share" type="button" onClick={() => setView('share')}>
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="15" cy="4" r="2" />
                  <circle cx="5" cy="10" r="2" />
                  <circle cx="15" cy="16" r="2" />
                  <path d="M7 11.3l6.1 3.4M13.1 5.3L7 8.7" />
                </svg>
                Share Card
              </button>
              <button className="cdm-close-link cdm-report-link" type="button" onClick={() => setShowReport(true)}>
                Report template
              </button>
              <button className="cdm-close-link" type="button" onClick={onClose}>Dismiss</button>
            </div>
          )}

          {/* ── Share view ── */}
          {view === 'share' && (
            <div className="cdm-share-panel">
              <p className="cdm-share-heading">Share this template</p>
              <p className="cdm-share-sub">Anyone who opens this link can use the same template.</p>

              <div className="cdm-share-link-row">
                <span className="cdm-share-link-pill" title={templateUrl}>
                  {templateUrl.replace(/^https?:\/\//, '')}
                </span>
                <button
                  type="button"
                  className={`cdm-share-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <div className="cdm-share-platforms">
                {SHARE_PLATFORMS.map((p) => (
                  <a
                    key={p.id}
                    href={p.getUrl(templateUrl, shareTitle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cdm-platform-btn"
                    style={{ '--platform-color': p.color }}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                  </a>
                ))}
                {navigator.share && (
                  <button
                    type="button"
                    className="cdm-platform-btn"
                    style={{ '--platform-color': 'rgba(118,239,255,0.7)' }}
                    onClick={handleNativeShare}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    <span>More</span>
                  </button>
                )}
              </div>

              <button className="cdm-back-btn" type="button" onClick={() => setView('main')}>
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <ReportModal
          type="template"
          targetId={card?.id || card?.templateId || card?.slug}
          targetName={card?.title}
          onClose={() => setShowReport(false)}
        />
      )}
    </section>,
    document.body,
  )
}

export default CardDetailModal
