import { createPortal } from 'react-dom'

function CardEditModal({ open, onClose, onSave, onSend, inventory, canSend }) {
  if (!open) return null

  return createPortal(
    <section className="preview-modal" role="dialog" aria-modal="true">
      <div className="preview-backdrop" onClick={onClose} />
      <div className="preview-card">
        <div className="preview-hero editor-hero">
          <div className="preview-glow" />
        </div>
        <div className="preview-body">
          <p className="preview-eyebrow">Card Editor (Placeholder)</p>
          <h3>Customize your card</h3>
          <p className="detail-subtitle">
            Apply gifts, adjust colors, and add music before sending.
          </p>
          <div className="editor-block">
            <h4>Available Gifts</h4>
            {inventory.length ? (
              <div className="editor-gifts">
                {inventory.map((gift) => (
                  <span key={gift.id || gift.title} className="editor-tag">
                    {gift.title}
                  </span>
                ))}
              </div>
            ) : (
              <p className="detail-message">No gifts purchased yet.</p>
            )}
          </div>
          <div className="editor-block">
            <h4>Colors</h4>
            <div className="editor-swatches">
              <span className="swatch s1" />
              <span className="swatch s2" />
              <span className="swatch s3" />
              <span className="swatch s4" />
            </div>
          </div>
          <div className="editor-block">
            <h4>Music</h4>
            <div className="editor-music">Add a track (coming soon)</div>
          </div>
          <div className="detail-actions">
            <button className="primary" type="button" onClick={onSend} disabled={!canSend}>
              Send Card
            </button>
            <button className="ghost" type="button" onClick={onSave}>
              Save Changes
            </button>
            <button className="ghost" type="button" onClick={onClose}>
              Back
            </button>
          </div>
          {!canSend ? <p className="form-error">Save changes to unlock sending.</p> : null}
        </div>
      </div>
    </section>,
    document.body,
  )
}

export default CardEditModal
