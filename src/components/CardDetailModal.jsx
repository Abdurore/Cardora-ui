import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getTierInfo } from '../utils/tier.js'

function CardDetailModal({
  card,
  onClose,
  balance = 0,
  currentUser,
  onRequireAuth,
  onDeductCC,
}) {
  const [showForm, setShowForm] = useState(false)
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

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/card/${card.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch (shareError) {
      console.error('Copy failed', shareError)
    }
  }

  return createPortal(
    <section className="detail-modal" role="dialog" aria-modal="true">
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-card" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
        <div className={`detail-thumb ${card.variant || ''}`}>
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

          {!showForm ? (
            <div className="detail-actions">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  onClose()
                  navigate('/studio', { state: { cardData: card } })
                }}
              >
                Use Template
              </button>
              <button className="ghost detail-strong" type="button" onClick={() => setShowForm(true)}>
                Send Card
              </button>
              <button className="ghost" type="button" onClick={handleShare}>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button className="ghost" type="button" onClick={onClose}>
                Close
              </button>
              {error ? <p className="form-error">{error}</p> : null}
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

