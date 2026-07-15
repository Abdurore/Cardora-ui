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

export function formatGiftAmount(value) {
  if (typeof value === 'string' && value.trim() && !/^\d+(\.\d+)?$/.test(value.trim())) return value.trim()
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return ''
  return `₦${num.toLocaleString()}`
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

export function rememberConfirmedGift(userId, gift) {
  const resolvedName = gift?.giftName || gift?.name || gift?.effectKey
  if (!userId || !resolvedName) return
  const key = `cardora:confirmedGiftInventory:${userId}`
  try {
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const reference = gift.reference || gift.txRef || gift.transactionRef || ''
    const entry = {
      giftName: resolvedName,
      name: resolvedName,
      status: 'available',
      inventoryId: gift.inventoryId || gift.giftInventoryId || gift.giftId || gift._id || gift.id || `local-${reference || Date.now()}`,
      reference,
      priceNgn: gift.priceNgn || gift.price || 0,
      valueNgn: gift.valueNgn || gift.priceNgn || gift.price || 0,
      isLocalConfirmed: true,
      confirmedAt: Date.now(),
    }
    const dedupe = reference
      ? existing.some(item => item.reference === reference)
      : existing.some(item => item.inventoryId === entry.inventoryId)
    if (!dedupe) localStorage.setItem(key, JSON.stringify([...existing, entry].slice(-25)))
  } catch { /* ignore storage failures */ }
}

export function getConfirmedGiftInventory(userId) {
  if (!userId) return []
  try {
    const raw = JSON.parse(localStorage.getItem(`cardora:confirmedGiftInventory:${userId}`) || '[]')
    return Array.isArray(raw) ? raw.filter(item => item?.name && item.status === 'available') : []
  } catch {
    return []
  }
}

export function forgetConfirmedGift(userId, giftId) {
  if (!userId || !giftId) return
  const key = `cardora:confirmedGiftInventory:${userId}`
  try {
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(existing)) return
    const needle = String(giftId)
    const next = existing.filter(item => ![
      item.inventoryId,
      item.giftInventoryId,
      item.giftId,
      item._id,
      item.id,
      item.reference,
      item.txRef,
      item.transactionRef,
    ].filter(Boolean).some(value => String(value) === needle))
    localStorage.setItem(key, JSON.stringify(next))
  } catch { /* ignore storage failures */ }
}

export function normalizeGiftInventory(rawInventory = [], includeUnverified = false) {
  if (!Array.isArray(rawInventory)) return []

  const normalized = []
  rawInventory
    .filter(item => {
      if (!item) return false
      const status = String(item.status || '').toLowerCase()
      if (!status || ['available', 'active', 'verified', 'owned', 'complete', 'completed'].includes(status)) return true
      if (includeUnverified && ['unverified', 'pending'].includes(status)) return true
      return false
    })
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
          status: (() => {
            const normalizedStatus = String(item.status || '').toLowerCase()
            if (item.isPendingLocal) return item.status || 'unverified'
            if (['unverified', 'active', 'verified', 'owned', 'complete', 'completed'].includes(normalizedStatus)) return 'available'
            return item.status || 'available'
          })(),
          unitIndex,
        })
      }
    })

  return normalized
}
