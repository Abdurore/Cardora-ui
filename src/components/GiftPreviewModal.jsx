import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import PremiumGiftReveal, { getGiftEffect } from './PremiumGiftReveal.jsx'
import GiftHeartPreview from './GiftHeartPreview.jsx'


function GiftPreviewModal({ gift, onClose, onBuy, disabled, autoPreview = false }) {
  const [showEffect, setShowEffect] = useState(autoPreview)
  const [justPurchased, setJustPurchased] = useState(false)
  const effectConfig = useMemo(
    () => (gift?.effectKey ? getGiftEffect(gift.effectKey) : null),
    [gift],
  )

  useEffect(() => {
    setShowEffect(autoPreview)
    setJustPurchased(false)
  }, [autoPreview, gift])

  if (!gift) return null

  return createPortal(
    <section className="preview-modal" role="dialog" aria-modal="true">
      <div className="preview-backdrop" onClick={onClose} />
      <div className="preview-card">
        <div className="preview-hero">
          <div className="preview-glow" />
          {effectConfig ? (
            <div className="preview-shape-wrap">
              <GiftHeartPreview effectKey={gift.effectKey} />
            </div>
          ) : null}
        </div>
        <div className="preview-body">
          <p className="preview-eyebrow">Gift Effect Preview</p>
          <h3>{gift.title}</h3>
          <p className="detail-subtitle">{gift.note}</p>
          <div className="detail-meta">
            <span>{gift.amount}</span>
            <span className="dot" />
            <span>{effectConfig?.price ? `$${effectConfig.price} tier` : 'Effect preview'}</span>
          </div>
          <div className="detail-actions">
            <button className="ghost" type="button" onClick={() => setShowEffect(true)}>
              Preview Effect
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => {
                onBuy?.()
                if (!disabled) {
                  setJustPurchased(true)
                  setShowEffect(true)
                }
              }}
              disabled={disabled}
            >
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
          onComplete={() => {
            setShowEffect(false)
            if (justPurchased) {
              setJustPurchased(false)
              onClose?.()
            }
          }}
        />
      ) : null}
    </section>,
    document.body,
  )
}

export default GiftPreviewModal
