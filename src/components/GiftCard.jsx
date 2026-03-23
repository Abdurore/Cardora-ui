function GiftCard({ title, amount, note, variant }) {
  return (
    <div className={`gift ${variant}`}>
      <div className="gift-icon" />
      <h4>{title}</h4>
      <p className="gift-amount">{amount}</p>
      <p className="gift-note">{note}</p>
    </div>
  )
}

export default GiftCard
