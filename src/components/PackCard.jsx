function PackCard({ title, amount, price, bonus }) {
  return (
    <div className="pack">
      {bonus ? <span className="badge bonus">{bonus}</span> : null}
      <p className="pack-title">{title}</p>
      <h3>{amount}</h3>
      <p className="pack-price">{price}</p>
    </div>
  )
}

export default PackCard
