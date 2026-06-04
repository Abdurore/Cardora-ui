import { GiftIcon } from './GiftCard.jsx'

const GIFT_EFFECT_ALIASES = {
  spark: 'tiny',
  sweetHeart: 'sweet',
  purpleLove: 'purple',
  oceanHeart: 'ocean',
  emeraldHeart: 'emerald',
  passionHeart: 'passion',
  goldenHeart: 'golden',
  crystalHeart: 'crystal',
  diamondHeart: 'diamond',
  legendaryHeart: 'legendary',
}

function formatGiftName(name) {
  return String(name || 'Gift')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, char => char.toUpperCase())
    .trim()
}

function formatAmount(value) {
  const amount = Number(value || 0)
  return amount > 0 ? `NGN ${amount.toLocaleString()}` : ''
}

function InventoryCard({ title, amount, effectKey, giftName, name, priceNgn, valueNgn, status, variant }) {
  const resolvedName = giftName || name || title || effectKey
  const resolvedEffect = effectKey || GIFT_EFFECT_ALIASES[resolvedName] || resolvedName
  const resolvedAmount = amount || formatAmount(valueNgn ?? priceNgn)
  const isPending = status === 'unverified' || status === 'pending'
  const statusLabel = isPending ? 'Pending' : (status || 'Owned')

  return (
    <div className={`inventory-card ${variant || ''} ${isPending ? 'inventory-card-pending' : ''}`}>
      <div className="inventory-icon">
        <GiftIcon effectKey={resolvedEffect} size={36} />
      </div>
      <div className="inventory-info">
        <p className="inventory-title">{formatGiftName(resolvedName)}</p>
        {resolvedAmount ? <p className="inventory-amount">{resolvedAmount}</p> : null}
      </div>
      <span className={`inventory-owned-badge ${isPending ? 'inventory-owned-badge-pending' : ''}`}>
        {statusLabel}
      </span>
    </div>
  )
}

export default InventoryCard
