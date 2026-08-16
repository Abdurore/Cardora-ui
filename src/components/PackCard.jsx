// 3.1: `bonus` is now the pack's explicit badge text (e.g. "POPULAR",
// "20% MORE") rather than a generic "Featured" flag, and `effectiveRate`
// (₦/CC) is shown so a buyer can compare packs at a glance without doing
// the division themselves.
function PackCard({ title, amount, price, bonus, effectiveRate, onSelect }) {
  return (
    <button type="button" className="pack" onClick={onSelect}>
      {bonus ? <span className="badge bonus">{bonus}</span> : null}
      <p className="pack-title">{title}</p>
      <h3>{amount}</h3>
      <p className="pack-price">{price}</p>
      {effectiveRate ? <p className="pack-effective-rate">{effectiveRate}</p> : null}
    </button>
  )
}

export default PackCard
