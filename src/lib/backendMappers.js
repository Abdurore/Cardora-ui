import { backfillEnvelope } from '../data/cardDefaults.js'

const ROLE_MAP = {
  admin: 'Admin',
  artist: 'Artist',
  creator: 'User',
  user: 'User',
}

function capitalize(value = '') {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function extractNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function resolveBalance(...sources) {
  const candidateKeys = [
    'couponBalance',
    'ccBalance',
    'balance',
    'coupons',
    'availableCoupons',
    'currentCoupons',
    'numberOfCC',
    'cc',
    'totalCC',
  ]

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of candidateKeys) {
      const value = extractNumber(source[key])
      if (value !== null) return value
    }
    if (Array.isArray(source.coupons)) {
      const couponSum = source.coupons.reduce((sum, item) => sum + (extractNumber(item?.amount) || 0), 0)
      if (couponSum) return couponSum
    }
  }

  return 0
}

export function normalizeUser(userPayload, extras = {}, couponPayload = null) {
  const user = userPayload?.user || userPayload?.data?.user || userPayload?.data || userPayload || {}
  const roleValue = String(user.role || user.accountType || 'user').toLowerCase()
  const userId = user._id || user.id || user.userId || user.email || `u-${Date.now()}`

  return {
    id: userId,
    name: user.username || user.name || user.displayName || 'Cardora User',
    username: user.username || user.handle || user.name || 'cardora',
    email: user.email || '',
    role: ROLE_MAP[roleValue] || capitalize(roleValue),
    currency: user.currency || couponPayload?.currency || 'NGN',
    balance: resolveBalance(user, couponPayload),
    bio: user.bio || '',
    referralCode: user.referralCode || '',
    referralLink: user.referralLink || '',
    referralsCount: user.referralsCount || 0,
    ccIncomeHistory: user.ccIncomeHistory || [],
    isVerified: user.isVerified ?? true,
    createdAt: user.createdAt || '',
    avatarColor: extras.avatarColor || 'linear-gradient(135deg, #7ef7ff, #62ffa2)',
    avatarUrl: extras.avatarUrl || user.profilePictureUrl || '',
    favorites: extras.favorites || [],
    inventory: extras.inventory || [],
  }
}

export function mapTemplateToCard(template, index = 0) {
  const layout = template.layoutConfig || template.layoutdata || {}
  const content = layout.content || {}
  const title = template.name || content.heading || `Cardora Template ${index + 1}`
  const message = content.body || content.extendedBody || 'A Cardora interactive card experience.'
  const likeCount =
    template.likesCount ??
    template.likes?.length ??
    template.analytics?.likes ??
    template.popularityScore ??
    0
  const userCount =
    template.viewCount ??
    template.analytics?.views ??
    template.uses ??
    template.usageCount ??
    0

  const createdBy = template.createdBy || template.artist || template.author || template.owner || template.userId || null
  const ownerId =
    (createdBy && typeof createdBy === 'object' ? createdBy._id || createdBy.id || createdBy.userId : createdBy) || null

  return {
    id: template.templateId || template._id || `template-${index}`,
    templateId: template.templateId || template._id || null,
    title,
    subtitle: template.description || message,
    message,
    occasion: capitalize(template.category || 'General'),
    meta: `${userCount} Views`,
    likes: String(likeCount),
    likeCount,
    userCount,
    category: (template.category || 'scratch').toLowerCase(),
    type: (template.type || layout.type || 'standard').toLowerCase(),
    tier: (template.couponType || template.tier || layout.couponType || 'simple').toLowerCase(),
    previewImage: template.previewImage || layout.previewImage || layout.media?.images?.[0] || '',
    tag: template.status ? capitalize(template.status) : '',
    ownerId,
    poll: template.poll || layout.poll || null,
    trivia: template.trivia || layout.trivia || null,
    chain: template.chain || layout.chain || null,
    anonTier: template.anonTier || layout.anonTier || null,
    backendTemplate: template,
  }
}

const CURRENCY_LOCALE = {
  NGN: 'en-NG', USD: 'en-US', GBP: 'en-GB', EUR: 'de-DE',
  GHS: 'en-GH', KES: 'sw-KE', ZAR: 'en-ZA',
}

export function mapCouponPackage(pack, targetCurrency) {
  const ccAmount = pack.numberOfCC || pack.quantity || 0
  const currency = targetCurrency || pack.priceCurrency || pack.currency || 'NGN'
  const locale = CURRENCY_LOCALE[currency] || 'en-US'
  const formatter = new Intl.NumberFormat(locale)
  return {
    id: pack.packageId || pack._id,
    packageId: pack.packageId || pack._id,
    title: pack.name || `${ccAmount} CC Pack`,
    amount: `${ccAmount} CC`,
    cc: ccAmount,
    price: `${currency} ${formatter.format(pack.price || pack.basePrice || 0)}`,
    bonus: pack.featured ? 'Featured' : '',
    description: pack.description || '',
    raw: pack,
  }
}

export function extractCheckoutUrl(payload) {
  return (
    payload?.authorization_url ||
    payload?.authorizationUrl ||
    payload?.data?.authorization_url ||
    payload?.data?.authorizationUrl ||
    payload?.checkoutUrl ||
    payload?.url ||
    payload?.sessionUrl ||
    payload?.data?.url ||
    null
  )
}

/* ═══════════════════════════════════════════════
   CARD MAPPERS — Transform frontend cardObject
   to/from backend layoutdata format
   ═══════════════════════════════════════════════ */

/**
 * Transform frontend cardObject → backend layoutdata
 * Backend expects media.images as string[], frontend uses object[]
 */
export function cardObjectToLayoutData(cardObject) {
  if (!cardObject) return {}
  const layout = structuredClone(cardObject)

  // Transform media.images from [{url, caption, fit}] → string[]
  if (layout.media?.images && Array.isArray(layout.media.images)) {
    layout.media.images = layout.media.images
      .map(img => typeof img === 'string' ? img : img?.url)
      .filter(Boolean)
  }

  // Ensure numbers where backend expects numbers
  if (layout.card?.textBodyAnimation) {
    const fade = layout.card.textBodyAnimation.fadeInDuration
    if (fade !== 'none' && fade !== undefined) {
      layout.card.textBodyAnimation.fadeInDuration = Number(fade) || 0
    }
  }

  return layout
}

/**
 * Transform backend layoutdata → frontend cardObject
 * Backend sends media.images as string[], frontend expects object[]
 */
export function layoutDataToCardObject(layoutdata) {
  if (!layoutdata) return {}
  const obj = structuredClone(layoutdata)

  if (obj.media?.images && Array.isArray(obj.media.images)) {
    obj.media.images = obj.media.images.map(img =>
      typeof img === 'string'
        ? { url: img, caption: '', fit: 'cover', positionX: 50, positionY: 50 }
        : img
    )
  }

  backfillEnvelope(obj)

  return obj
}

/**
 * Map a backend card (from /usercards or /cards/:slug) to a frontend-usable shape
 */
export function mapBackendCard(card) {
  const slug = card.slug || card._id || card.cardId || ''
  const layout = card.layoutdata || card.layoutData || {}
  const content = layout.content || {}

  return {
    id: card.cardId || card._id || slug,
    slug,
    title: card.title || content.heading || 'Untitled Card',
    subtitle: content.body || '',
    message: content.body || '',
    type: card.type || 'standard',
    templateId: card.templateId || '',
    tier: (card.couponType || layout.couponType || 'simple').toLowerCase(),
    createdAt: card.createdAt || '',
    poll: card.poll || null,
    chain: card.chain || null,
    trivia: card.trivia || null,
    layoutdata: layout,
    cardObject: layoutDataToCardObject(layout),
    tag: card.type === 'standard' ? '' : capitalize(card.type || ''),
    interaction: layout.interaction || {},
    locked: layout.interaction?.lock?.type === 'password' || layout.interaction?.lock?.type === 'time',
    lockType: layout.interaction?.lock?.type || 'none',
  }
}

/**
 * Map a chat message for the frontend
 */
export function mapChatMessage(msg) {
  return {
    id: msg.id || msg._id || `msg-${Date.now()}-${Math.random()}`,
    userId: msg.userId || '',
    username: msg.username || 'Anonymous',
    content: msg.content || '',
    profilePictureUrl: msg.profilePictureUrl || null,
    createdAt: msg.createdAt || new Date().toISOString(),
  }
}

/**
 * Map an admin user row
 */
export function mapAdminUser(user) {
  return {
    id: user._id || user.id || user.userId,
    username: user.username || user.name || 'Unknown',
    email: user.email || '',
    role: capitalize(user.role || 'user'),
    cc: user.cc ?? user.balance ?? 0,
    isVerified: user.isVerified ?? false,
    isBanned: user.isBanned ?? false,
    createdAt: user.createdAt || '',
  }
}
