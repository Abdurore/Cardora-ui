import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getTierInfo } from '../utils/tier.js'

const SHARE_PLATFORMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
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
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
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
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
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
}) {
  const [showForm, setShowForm] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [sent, setSent] = useState(false)
  const [startY, setStartY] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!card) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [card, onClose])

  useEffect(() => {
    setShowForm(false)
    setShowShare(false)
    setSent(false)
    setCopied(false)
    setError('')
    setIsSending(false)
  }, [card])

  if (!card) return null

  const tierInfo = getTierInfo(card?.tier)
  const isPremium = tierInfo.key !== 'simple'
  const isLocked = currentUser ? balance < tierInfo.cost : false

  const handleTouchStart = (event) => {
    setStartY(event.touches[0].clientY)
  }

  const handleTouchMove = (event) => {
    if (startY === null) return
    const deltaY = event.touches[0].clientY - startY
    if (deltaY > 120) onClose()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!currentUser) {
      onRequireAuth?.()
      return
    }
    if (!onDeductCC?.(tierInfo.cost)) {
      setError('Not enough CC to send this card yet.')
      return
    }
    setIsSending(true)
    const formData = new FormData(event.currentTarget)
    const recipient = (formData.get('recipient') || '').toString()
    const recipientEmail = (formData.get('email') || '').toString()
    const note = (formData.get('note') || '').toString()
    const stored = JSON.parse(localStorage.getItem('cardora:sentCards') || '[]')
    const newCard = {
      id: `card-${Date.now()}`,
      templateId: card.id,
      title: card.title,
      subtitle: card.subtitle,
      message: note || card.message,
      recipient,
      recipientEmail,
      sender: currentUser?.name || currentUser?.username || 'Cardora User',
      tier: tierInfo.key,
      createdAt: new Date().toISOString(),
      previewVariant: card.variant,
    }
    stored.unshift(newCard)
    localStorage.setItem('cardora:sentCards', JSON.stringify(stored))
    setSent(true)
    setTimeout(() => {
      setShowForm(false)
      setSent(false)
      setIsSending(false)
      onClose()
      navigate(`/card/${newCard.id}`)
    }, 900)
  }

  const shareUrl = card ? `${window.location.origin}/card/${card.id || card.slug}` : ''
  const shareTitle = card ? `Check out this card: ${card.title}` : ''

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  const handleNativeShare = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({ title: card.title, text: shareTitle, url: shareUrl })
    } catch { /* user cancelled */ }
  }

  return createPortal(
    <section className="detail-modal" role="dialog" aria-modal="true">
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-card" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
        <div className={`detail-thumb ${card.variant || ''}`}>
          {card.previewImage ? <img src={card.previewImage} alt={card.title || ''} className="detail-thumb-image" /> : null}
          <div className="detail-thumb-overlay">
            <div className="detail-thumb-top">
              <p className="detail-eyebrow">{card.occasion}</p>
              <span className={`tier-badge ${tierInfo.badgeClass}`}>{tierInfo.label}</span>
            </div>
            <div className="detail-thumb-copy">
              <h3>{card.title}</h3>
              <p>{card.subtitle}</p>
            </div>
          </div>
          {isPremium ? <span className="detail-upgrade">Unlock full experience</span> : null}
        </div>

        <div className="detail-body">
          <div className="detail-summary">
            <div className="detail-tier">
              <span className="tier-cost">{tierInfo.cost} CC</span>
              {card.likes ? <span className="tier-cost">{card.likes} Likes</span> : null}
              {card.meta ? <span className="tier-cost">{card.meta}</span> : null}
            </div>
            {tierInfo.features ? (
              <ul className="tier-features">
                {tierInfo.features.map((feature) => (
                  <li key={feature}>
                    <span className="tier-check">+</span> {feature}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <p className="detail-message">{card.message}</p>

          {!showForm && !showShare ? (
            <div className="detail-actions">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  onClose()
                  if (openCardTypeModal) {
                    openCardTypeModal()
                  } else {
                    navigate('/studio', { state: { cardData: card } })
                  }
                }}
              >
                Use Template
              </button>
              <button className="ghost detail-strong" type="button" onClick={() => setShowForm(true)}>
                Send Card
              </button>
              <button className="ghost" type="button" onClick={() => setShowShare(true)}>
                Share
              </button>
              <button className="ghost" type="button" onClick={onClose}>
                Close
              </button>
              {error ? <p className="form-error">{error}</p> : null}
            </div>
          ) : showShare ? (
            <div className="detail-share-panel">
              <div className="detail-share-link-row">
                <span className="detail-share-link-pill" title={shareUrl}>
                  {shareUrl.replace(/^https?:\/\//, '')}
                </span>
                <button
                  type="button"
                  className={`detail-share-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyLink}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <p className="detail-share-label">Share via</p>
              <div className="detail-share-platforms">
                {SHARE_PLATFORMS.map((p) => (
                  <a
                    key={p.id}
                    href={p.getUrl(shareUrl, shareTitle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="detail-share-platform-btn"
                    style={{ '--platform-color': p.color }}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                  </a>
                ))}
                {navigator.share && (
                  <button
                    type="button"
                    className="detail-share-platform-btn"
                    style={{ '--platform-color': 'rgba(118,239,255,0.7)' }}
                    onClick={handleNativeShare}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    <span>More</span>
                  </button>
                )}
              </div>
              <button className="ghost" type="button" onClick={() => setShowShare(false)} style={{ marginTop: 8 }}>
                ← Back
              </button>
            </div>
          ) : (
            <form className="detail-form" onSubmit={handleSubmit}>
              {!sent ? (
                <>
                  <label className="detail-field">
                    Recipient Name
                    <input name="recipient" type="text" placeholder="e.g. Ada" required />
                  </label>
                  <label className="detail-field">
                    Email
                    <input name="email" type="email" placeholder="ada@email.com" required />
                  </label>
                  <label className="detail-field">
                    Personal Note
                    <textarea name="note" rows="3" placeholder="Write something sweet..." />
                  </label>
                  <div className="detail-actions">
                    <button className="primary" type="submit" disabled={isLocked || isSending}>
                      {isSending ? 'Sending...' : `Send Now (${tierInfo.cost} CC)`}
                    </button>
                    <button className="ghost" type="button" onClick={() => setShowForm(false)}>
                      Back
                    </button>
                  </div>
                  {isLocked ? <p className="form-error">Top up your CC balance to send this card.</p> : null}
                  {error ? <p className="form-error">{error}</p> : null}
                </>
              ) : (
                <div className="detail-sent success-pop">
                  <p>Card sent successfully. We saved your message.</p>
                  <button className="primary" type="button" onClick={onClose}>
                    Done
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </section>,
    document.body,
  )
}

export default CardDetailModal


