const ROLE_MAP = {
  admin: 'Admin',
  artist: 'Artist',
  creator: 'Creator',
  user: 'Creator',
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
  const roleValue = String(user.role || user.accountType || 'creator').toLowerCase()
  const userId = user._id || user.id || user.userId || user.email || `u-${Date.now()}`

  return {
    id: userId,
    name: user.username || user.name || user.displayName || 'Cardora User',
    username: user.username || user.handle || user.name || 'cardora',
    email: user.email || '',
    role: ROLE_MAP[roleValue] || capitalize(roleValue),
    currency: user.currency || couponPayload?.currency || 'NGN',
    balance: resolveBalance(user, couponPayload),
    avatarColor: extras.avatarColor || 'linear-gradient(135deg, #7ef7ff, #62ffa2)',
    avatarUrl: extras.avatarUrl || '',
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

  return {
    id: template.templateId || template._id || `template-${index}`,
    title,
    subtitle: template.description || message,
    message,
    occasion: capitalize(template.category || 'General'),
    meta: `${userCount} Views`,
    likes: String(likeCount),
    category: (template.category || 'scratch').toLowerCase(),
    tier: (template.couponType || template.tier || layout.couponType || 'simple').toLowerCase(),
    previewImage: template.previewImage || layout.previewImage || layout.media?.images?.[0] || '',
    tag: template.status ? capitalize(template.status) : '',
    backendTemplate: template,
  }
}

export function mapCouponPackage(pack) {
  const ccAmount = pack.numberOfCC || pack.quantity || 0
  const currency = pack.priceCurrency || pack.currency || 'NGN'
  const formatter = new Intl.NumberFormat('en-NG')
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
