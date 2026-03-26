import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import PremiumGiftReveal, { getGiftEffect } from './PremiumGiftReveal.jsx'

function GiftPreviewModal({ gift, onClose, onBuy, disabled, autoPreview = false }) {
  const [showEffect, setShowEffect] = useState(autoPreview)
  const effectConfig = useMemo(
    () => (gift?.effectKey ? getGiftEffect(gift.effectKey) : null),
    [gift],
  )

  useEffect(() => {
    setShowEffect(autoPreview)
  }, [autoPreview, gift])

  if (!gift) return null

  return createPortal(
    <section className="preview-modal" role="dialog" aria-modal="true">
      <div className="preview-backdrop" onClick={onClose} />
      <div className="preview-card">
        <div className="preview-hero">
          <div className="preview-glow" />
          {effectConfig ? (
            <svg className="preview-icon" viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <linearGradient id="previewGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={effectConfig.gradient[0]} />
                  <stop offset="100%" stopColor={effectConfig.gradient[1]} />
                </linearGradient>
              </defs>
              <path d={effectConfig.path} fill="url(#previewGradient)" />
            </svg>
          ) : null}
        </div>
        <div className="preview-body">
          <p className="preview-eyebrow">Gift Effect Preview</p>
          <h3>{gift.title}</h3>
          <p className="detail-subtitle">{gift.note}</p>
          <div className="detail-meta">
            <span>{gift.amount}</span>
            <span className="dot" />
            <span>Effect placeholder</span>
          </div>
          <div className="detail-actions">
            <button className="ghost" type="button" onClick={() => setShowEffect(true)}>
              Preview Effect
            </button>
            <button className="primary" type="button" onClick={onBuy} disabled={disabled}>
              Buy Gift
            </button>
            <button className="ghost" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
      {showEffect ? (
        <PremiumGiftReveal
          effect={gift.effectKey}
          onComplete={() => setShowEffect(false)}
        />
      ) : null}
    </section>,
    document.body,
  )
}

export default GiftPreviewModal
