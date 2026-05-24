const BACKEND_TO_EFFECT = {
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

export const EFFECT_TO_BACKEND = {
  tiny: 'spark',
  sweet: 'sweetHeart',
  purple: 'purpleLove',
  ocean: 'oceanHeart',
  emerald: 'emeraldHeart',
  passion: 'passionHeart',
  golden: 'goldenHeart',
  crystal: 'crystalHeart',
  diamond: 'diamondHeart',
  legendary: 'legendaryHeart',
}

const GIFT_TITLES = {
  tiny: 'Tiny Heart',
  sweet: 'Sweet Heart',
  purple: 'Purple Love',
  ocean: 'Ocean Heart',
  emerald: 'Emerald Heart',
  passion: 'Passion Heart',
  golden: 'Golden Heart',
  crystal: 'Crystal Heart',
  diamond: 'Diamond Heart',
  legendary: 'Legendary Heart',
}

export function giftNameToEffectKey(name) {
  return BACKEND_TO_EFFECT[name] || name || 'tiny'
}

export function effectKeyToGiftName(effectKey) {
  return EFFECT_TO_BACKEND[effectKey] || effectKey || ''
}

export function formatGiftName(name) {
  const effectKey = giftNameToEffectKey(name)
  return GIFT_TITLES[effectKey] || String(name || 'Gift')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim()
}

function formatNgn(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return ''
  return `NGN ${num.toLocaleString()}`
}

function getQuantity(item) {
  const explicit = item.quantity ?? item.qty ?? item.count ?? item.units ?? item.availableCount ?? item.availableQuantity ?? item.remainingQuantity
  const parsedExplicit = Number(explicit)
  if (Number.isInteger(parsedExplicit) && parsedExplicit > 0) return Math.min(parsedExplicit, 100)

  // Older local pending gifts and some backend aggregates use amount as a unit
  // count. Gift cash values are much larger, so small integers are safe counts.
  const parsedAmount = Number(item.amount)
  if (Number.isInteger(parsedAmount) && parsedAmount > 0 && parsedAmount <= 100) {
    return parsedAmount
  }

  return 1
}

function getValueText(item) {
  if (typeof item.amount === 'string' && item.amount.trim()) return item.amount.trim()
  if (typeof item.amountText === 'string' && item.amountText.trim()) return item.amountText.trim()
  return formatNgn(item.valueNgn ?? item.priceNgn ?? item.value ?? item.price ?? (Number(item.amount) > 100 ? item.amount : null))
}

export function normalizeGiftInventory(rawInventory = []) {
  if (!Array.isArray(rawInventory)) return []

  const normalized = []
  rawInventory
    .filter(item => item && (item.status === 'available' || !item.status))
    .forEach((item, itemIndex) => {
      const giftName = item.giftName || item.name || effectKeyToGiftName(item.effectKey) || ''
      const effectKey = giftNameToEffectKey(item.effectKey || giftName)
      const sourceId = item.inventoryId || item._id || item.id || item.giftId || `${giftName || effectKey}-${itemIndex}`
      const quantity = getQuantity(item)
      const valueText = getValueText(item)
      const title = item.title || formatGiftName(giftName || effectKey)

      for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
        normalized.push({
          ...item,
          id: `${sourceId}::${unitIndex}`,
          inventoryId: sourceId,
          giftId: sourceId,
          giftName,
          name: giftName,
          effectKey,
          title,
          amount: valueText,
          status: item.status || 'available',
          unitIndex,
        })
      }
    })

  return normalized
}
