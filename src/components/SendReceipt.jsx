import { Link } from 'react-router-dom'

// The send-time receipt: replaces the old opaque "this costs N CC" confirm
// step with a transparent breakdown of exactly which features raised the
// price. 7.6: this used to also offer a one-tap "trim extras & send free"
// escape hatch, back when this receipt was the first place a sender saw
// the cost at all. Now the tier/cost is live in the Studio/Quick Create
// header (TierMeter) the whole time a card is being built, so trimming
// here would just be a second, later place to do what the header already
// invites the sender to do while editing -- removed rather than kept as a
// redundant path.
function SendReceipt({
  reasons = [],
  tier = 'classic',
  cost = 0,
  // 3.2: base type/tier price this card's reasons put it at — `cost` is the
  // full charge (tierFloor + sum of surcharges), kept separate so the
  // receipt can show the floor as its own line rather than implying the
  // tier alone explains the whole total.
  tierFloor = 0,
  // [{ id, label, amount }] — additive per-feature surcharges on top of
  // tierFloor (background music, Galaxy, lock, question block, extra
  // photos, premium-tier font). See src/lib/tierRequirements.js.
  surcharges = [],
  balance = 0,
  sending = false,
  onSend,
  onCancel,
}) {
  const short = balance < cost
  const tierLabel = tier === 'classic' ? 'Classic' : tier === 'premium' ? 'Premium' : 'Elite'

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

      {cost > 0 && (
        <ul className="cs-send-receipt-lineitems">
          <li>
            <span>{tierLabel} card</span>
            <span>{tierFloor > 0 ? `${tierFloor} CC` : 'Free'}</span>
          </li>
          {surcharges.map((s) => (
            <li key={s.id}>
              <span>{s.label}</span>
              <span>+{s.amount} CC</span>
            </li>
          ))}
        </ul>
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
          className="cs-send-confirm-btn"
          onClick={() => onSend?.()}
          disabled={sending || short}
        >
          {sending ? 'Sending…' : cost > 0 ? `Send · ${cost} CC` : 'Send free'}
        </button>
        <button type="button" className="cs-send-confirm-cancel" onClick={() => onCancel?.()} disabled={sending}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default SendReceipt
