import { useState } from 'react'
import { Link } from 'react-router-dom'

// The send-time receipt: replaces the old opaque "this costs N CC" confirm
// step with a transparent breakdown of exactly which features raised the
// price, plus a one-tap way to strip them and send free instead of forcing
// the sender back into the studio to hunt for what to remove.
function SendReceipt({
  reasons = [],
  tier = 'classic',
  cost = 0,
  balance = 0,
  sending = false,
  onSend,
  onTrim,
  trimPreview = null,
  onCancel,
}) {
  const [confirmingTrim, setConfirmingTrim] = useState(false)
  const short = balance < cost
  const tierLabel = tier === 'classic' ? 'Classic' : tier === 'premium' ? 'Premium' : 'Elite'

  if (confirmingTrim) {
    const removed = trimPreview?.removed || []
    return (
      <div className="cs-send-confirm cs-send-receipt">
        <div className="cs-send-confirm-icon">✂️</div>
        <h3>Trim these and send free?</h3>
        {removed.length === 0 ? (
          <p className="cs-send-confirm-note">This card is already free — nothing to trim.</p>
        ) : (
          <ul className="cs-tier-meter-reasons cs-send-receipt-removed">
            {removed.map((r) => (
              <li key={r.id} className={`cs-tier-meter-reason cs-tier-meter-reason-${r.tier}`}>
                <span>{r.label}</span>
                <span className="cs-tier-meter-reason-tag">removed</span>
              </li>
            ))}
          </ul>
        )}
        <div className="cs-send-confirm-actions">
          <button type="button" className="cs-send-confirm-btn primary" onClick={() => onTrim?.()} disabled={sending}>
            {sending ? 'Sending…' : 'Trim & send free'}
          </button>
          <button type="button" className="cs-send-confirm-btn ghost" onClick={() => setConfirmingTrim(false)} disabled={sending}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cs-send-confirm cs-send-receipt">
      <div className="cs-send-confirm-icon">{cost > 0 ? '✦' : '✓'}</div>
      <h3>{cost > 0 ? `Send this ${tierLabel} card?` : 'Ready to send'}</h3>

      {reasons.length > 0 ? (
        <ul className="cs-tier-meter-reasons cs-send-receipt-reasons">
          {reasons.map((r) => (
            <li key={r.id} className={`cs-tier-meter-reason cs-tier-meter-reason-${r.tier}`}>
              <span>{r.label}</span>
              <span className="cs-tier-meter-reason-tag">{r.tier === 'elite' ? 'Elite' : 'Premium'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cs-send-confirm-note">No premium touches — this card is free to send.</p>
      )}

      <div className="cs-send-receipt-total">
        <span>Total</span>
        <strong>{cost > 0 ? `${cost} CC` : 'Free'}</strong>
      </div>
      {cost > 0 && (
        <div className="cs-send-receipt-balance">
          <span>Your balance</span>
          <strong>{balance} CC</strong>
        </div>
      )}
      {short && (
        <p className="cs-send-confirm-note cs-send-receipt-short">
          You need {cost - balance} more CC. <Link to="/store">Top up CC</Link>
        </p>
      )}

      <div className="cs-send-confirm-actions">
        <button
          type="button"
          className="cs-send-confirm-btn primary"
          onClick={() => onSend?.()}
          disabled={sending || short}
        >
          {sending ? 'Sending…' : cost > 0 ? `Send · ${cost} CC` : 'Send free'}
        </button>
        {cost > 0 && (
          <button type="button" className="cs-send-confirm-btn ghost" onClick={() => setConfirmingTrim(true)} disabled={sending}>
            Trim extras & send free
          </button>
        )}
        <button type="button" className="cs-send-confirm-btn ghost" onClick={() => onCancel?.()} disabled={sending}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default SendReceipt
