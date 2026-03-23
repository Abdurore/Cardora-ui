function InventoryCard({ title, amount, action, variant }) {
  return (
    <div className={`inventory-card ${variant}`}>
      <div>
        <p className="inventory-title">{title}</p>
        <p className="inventory-amount">{amount}</p>
      </div>
      <button className="inventory-action">{action}</button>
    </div>
  )
}

export default InventoryCard
