import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function CardDetailModal({ card, onClose }) {
  const [showForm, setShowForm] = useState(false)
  const [sent, setSent] = useState(false)
  const [startY, setStartY] = useState(null)
  const [copied, setCopied] = useState(false)

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
  }, [card])

  if (!card) return null

  const handleTouchStart = (event) => {
    setStartY(event.touches[0].clientY)
  }

  const handleTouchMove = (event) => {
    if (startY === null) return
    const deltaY = event.touches[0].clientY - startY
    if (deltaY > 120) {
      onClose()
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSent(true)
    setTimeout(() => {
      setShowForm(false)
      setSent(false)
    }, 1600)
  }

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/card/${card.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  return createPortal(
    <section className="detail-modal" role="dialog" aria-modal="true">
      <div className="detail-backdrop" onClick={onClose} />
      <div
        className="detail-card"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className={`detail-thumb ${card.variant || ''}`} />
        <div className="detail-body">
          <div>
            <p className="detail-eyebrow">{card.occasion}</p>
            <h3>{card.title}</h3>
            <p className="detail-subtitle">{card.subtitle}</p>
          </div>
          <p className="detail-message">{card.message}</p>
          <div className="detail-meta">
            <span>{card.meta}</span>
            <span className="dot" />
            <span>{card.likes}</span>
          </div>
          {!showForm ? (
            <div className="detail-actions">
              <button className="primary" type="button" onClick={() => setShowForm(true)}>
                Send Card
              </button>
              <button className="ghost" type="button" onClick={handleShare}>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button className="ghost" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          ) : (
            <form className="detail-form" onSubmit={handleSubmit}>
              {!sent ? (
                <>
                  <label className="detail-field">
                    Recipient Name
                    <input type="text" placeholder="e.g. Ada" required />
                  </label>
                  <label className="detail-field">
                    Email
                    <input type="email" placeholder="ada@email.com" required />
                  </label>
                  <label className="detail-field">
                    Personal Note
                    <textarea rows="3" placeholder="Write something sweet..." />
                  </label>
                  <div className="detail-actions">
                    <button className="primary" type="submit">
                      Send Now
                    </button>
                    <button className="ghost" type="button" onClick={() => setShowForm(false)}>
                      Back
                    </button>
                  </div>
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
