import { GiftIcon } from './GiftCard.jsx'

function InventoryCard({ title, amount, effectKey, variant }) {
  return (
    <div className={`inventory-card ${variant || ''}`}>
      <div className="inventory-icon">
        <GiftIcon effectKey={effectKey} size={36} />
      </div>
      <div className="inventory-info">
        <p className="inventory-title">{title}</p>
        <p className="inventory-amount">{amount}</p>
      </div>
      <span className="inventory-owned-badge">Owned</span>
    </div>
  )
}

export default InventoryCard
