function PackCard({ title, amount, price, bonus, onSelect }) {
  return (
    <button type="button" className="pack" onClick={onSelect}>
      {bonus ? <span className="badge bonus">{bonus}</span> : null}
      <p className="pack-title">{title}</p>
      <h3>{amount}</h3>
      <p className="pack-price">{price}</p>
    </button>
  )
}

export default PackCard
