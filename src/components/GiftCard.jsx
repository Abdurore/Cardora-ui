function GiftCard({ title, amount, note, variant, actionLabel, onAction, disabled }) {
  return (
    <div className={`gift ${variant}`}>
      <div className="gift-icon" />
      <h4>{title}</h4>
      <p className="gift-amount">{amount}</p>
      <p className="gift-note">{note}</p>
      {actionLabel ? (
        <button className="gift-action" type="button" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export default GiftCard
