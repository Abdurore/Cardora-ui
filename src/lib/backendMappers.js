import { backfillEnvelope } from '../data/cardDefaults.js'

const ROLE_MAP = {
  admin: 'Admin',
  artist: 'Artist',
  creator: 'User',
  user: 'User',
  moderator: 'Moderator',
  enterprise: 'Enterprise',
}

function capitalize(value = '') {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function extractNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function unwrapData(payload) {
  if (!payload || typeof payload !== 'object') return payload
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload
}

export function getResponseMessage(payload, fallback = '') {
  if (!payload || typeof payload !== 'object') return fallback
  return (
    payload.message ||
    payload.data?.message ||
    payload.result?.message ||
    payload.statusMessage ||
    fallback
  )
}

export function getPrimaryUser(payload) {
  const root = unwrapData(payload)
  return (
    root?.user ||
    root?.currentUser ||
    root?.profile ||
    root?.account ||
    root ||
    {}
  )
}

export function getCollection(payload, keys = []) {
  const root = unwrapData(payload)
  if (Array.isArray(root)) return root
  for (const key of keys) {
    if (Array.isArray(root?.[key])) return root[key]
  }
  return []
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
  const user = getPrimaryUser(userPayload) || {}
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
    avatarUrl: user.profilePictureUrl || extras.avatarUrl || '',
    favorites: extras.favorites || [],
    inventory: extras.inventory || [],
  }
}

const TYPE_ALIASES = {
  standard: 'personal',
  moment: 'personal',
  anon: 'anonymous',
}

const TIER_ALIASES = {
  simple: 'classic',
  special: 'premium',
  signature: 'elite',
}

function normaliseType(value) {
  const key = String(value || '').toLowerCase()
  return TYPE_ALIASES[key] || key || 'personal'
}

function normaliseTier(value) {
  const key = String(value || '').toLowerCase()
  return TIER_ALIASES[key] || key || 'classic'
}

// Try every field the backend might have used for the template's tier. The
// new schema stripped many fields during template create, so the value can
// end up nested inside layoutConfig, config, or as an alias key. Returns
// undefined if nothing usable found, letting downstream code apply its
// preferred fallback.
function findTier(template) {
  const layout = template?.layoutConfig || template?.layoutdata || {}
  const candidates = [
    template?.tier,
    template?.couponType,
    template?.cardTier,
    layout.tier,
    layout.couponType,
    layout.config?.tier,
    template?.config?.tier,
    template?.enhancements?.tier,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c
  }
  return undefined
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
    type: normaliseType(template.type || layout.type),
    tier: normaliseTier(findTier(template)),
    previewImage: template.previewImage || layout.previewImage || layout.media?.images?.[0] || '',
    status: (template.status || 'approved').toLowerCase(),
    tag: template.status ? capitalize(template.status) : '',
    ownerId,
    poll: template.poll || layout.poll || null,
    trivia: template.trivia || layout.trivia || null,
    chain: template.chain || layout.chain || null,
    anonTier: template.anonTier || layout.anonTier || null,
    layoutConfig: layout,
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
  const root = unwrapData(payload)
  return (
    root?.authorization_url ||
    root?.authorizationUrl ||
    root?.checkoutUrl ||
    root?.url ||
    root?.sessionUrl ||
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

export function normalizeCheckoutSession(payload) {
  const root = unwrapData(payload) || {}
  return {
    checkoutUrl: extractCheckoutUrl(payload),
    reference:
      root.reference ||
      root.paymentReference ||
      root.checkoutReference ||
      root.transactionRef ||
      '',
    message: getResponseMessage(payload, ''),
    raw: payload,
  }
}

export function normalizeAuthResponse(payload) {
  const root = unwrapData(payload) || {}
  const token =
    payload?.token ||
    root?.token ||
    payload?.accessToken ||
    root?.accessToken ||
    payload?.jwt ||
    root?.jwt ||
    payload?.user?.token ||
    root?.user?.token ||
    payload?.result?.token ||
    root?.result?.token ||
    null

  return {
    token,
    user: getPrimaryUser(payload),
    message: getResponseMessage(payload, ''),
    requiresVerification:
      Boolean(root?.requiresVerification) ||
      Boolean(payload?.requiresVerification) ||
      (!token && /verify/i.test(getResponseMessage(payload, ''))),
    requiresLogin:
      Boolean(root?.requiresLogin) ||
      Boolean(payload?.requiresLogin),
    raw: payload,
  }
}

export function normalizeUserSession(userPayload, couponPayload = null, extras = {}) {
  const user = getPrimaryUser(userPayload)
  const normalized = normalizeUser(userPayload, extras, couponPayload)
  return {
    user,
    normalized,
    balance: normalized.balance,
    currency: normalized.currency,
    raw: userPayload,
  }
}

export function normalizeCouponPackagesResponse(payload, targetCurrency) {
  const packages = getCollection(payload, ['packages', 'couponPackages', 'items'])
  return {
    packages: packages.map((pack) => mapCouponPackage(pack, targetCurrency)),
    raw: payload,
  }
}

export function normalizeTemplatesResponse(payload) {
  const templates = getCollection(payload, ['templates', 'items', 'results'])
  return {
    templates: templates.map(mapTemplateToCard),
    raw: payload,
  }
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
 * Split a full cardObject into the backend card-engine's three top-level
 * payload keys: { config, enhancements, state }.
 *
 * Schema rules learned so far (from validator errors):
 *   - top-level `tier` is NOT allowed (tier comes from the endpoint path)
 *   - config.colors must be an OBJECT, not an array — uses palette anchors
 *     { primary, surface, ink, accent }
 *   - enhancements.background only accepts { type } so far; `type` must be
 *     one of [color, video, animated]
 *   - enhancements.media must be an ARRAY of URL strings (not {images:[...]})
 *   - enhancements.animation rejects {openEffect, confettiColors, backgroundEffect}
 *     — backend uses different keys; we send {} until we know them
 *   - enhancements rejects: theme, card, closedState, giftEffect, previewImage,
 *     previewUrl — these have no bucket in the schema yet (FE-only)
 *
 * Anything FE-only is preserved in the cardObject for the studio preview but
 * not transmitted; the recipient's rendered card is reconstructed from
 * { colors, font, content, background.type, media, interaction, questions }.
 */

// FE background.type → backend background.type
const BG_TYPE_MAP = {
  color: 'color',
  video: 'video',
  gradient: 'animated',
  animated: 'animated',
  image: 'color', // backend has no 'image' option; send a flat color as a fallback
}

// Backend custom validators sometimes reject short-hex (#fff) or rgb()/named
// colors. Normalise everything to 7-char #rrggbb. Falls back to a sentinel
// when input is unrecognisable.
function normaliseHex(input, fallback = '#76efff') {
  if (typeof input !== 'string') return fallback
  let v = input.trim().toLowerCase()
  if (!v.startsWith('#')) return fallback
  if (v.length === 4) {
    // #abc → #aabbcc
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  }
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  return fallback
}

export function cardObjectToBackendPayload(cardObject) {
  // Backend `config.colors` schema (validator-confirmed):
  //   background : string  (required)
  //   gradient   : array of strings (required)
  //   accent     : string  (required)
  // Mapping from our palette anchors:
  //   background ← palette.surface
  //   gradient   ← background.colors[] from FE (gradient stops) or [primary, accent]
  //   accent     ← palette.primary (the hero/eye-catching color)
  const fallbackColors = {
    background: '#0b0f12',
    gradient: ['#76efff', '#62ffa2'],
    accent: '#76efff',
  }
  if (!cardObject) {
    return {
      config: { colors: fallbackColors, font: 'Cinzel' },
      enhancements: {},
      state: {},
    }
  }

  // ── config.colors (REQUIRED: { background, gradient[2], accent })
  // All values must be valid 7-char hex strings; gradient[0] !== gradient[1].
  const palette = cardObject.palette || {}
  const feGradientStops = Array.isArray(cardObject.background?.colors)
    ? cardObject.background.colors
    : []
  const rawStop1 =
    feGradientStops[0] ||
    palette.primary ||
    cardObject.theme?.accentColor
  const rawStop2 =
    feGradientStops[feGradientStops.length - 1] ||
    palette.accent ||
    cardObject.theme?.headingColor
  const stop1 = normaliseHex(rawStop1, fallbackColors.gradient[0])
  let stop2 = normaliseHex(rawStop2, fallbackColors.gradient[1])
  if (stop2 === stop1) stop2 = fallbackColors.gradient[1] === stop1 ? fallbackColors.gradient[0] : fallbackColors.gradient[1]
  const gradient = [stop1, stop2]

  const colors = {
    background: normaliseHex(
      palette.surface || cardObject.card?.backgroundColor || feGradientStops[0],
      fallbackColors.background,
    ),
    gradient,
    accent: normaliseHex(
      palette.primary || cardObject.theme?.accentColor || stop1,
      fallbackColors.accent,
    ),
  }
  const font = cardObject.theme?.fontFamily || 'Cinzel'

  // ── enhancements.media: ARRAY OF OBJECTS, each requires { url, type }.
  // We only have image media on the FE today; type is always 'image'.
  const mediaItems = Array.isArray(cardObject.media?.images)
    ? cardObject.media.images
        .map((img) => {
          if (!img) return null
          if (typeof img === 'string') return { url: img, type: 'image' }
          if (img.url) return { url: img.url, type: img.type || 'image' }
          return null
        })
        .filter(Boolean)
    : []

  // ── enhancements.background: only `type` is accepted right now
  const bgType = BG_TYPE_MAP[cardObject.background?.type] || 'color'

  // ── enhancements.interaction: lock, password, reveal behaviour
  const interaction = cardObject.interaction && Object.keys(cardObject.interaction).length
    ? cardObject.interaction
    : undefined

  // ── enhancements.questions: Q&A array attached to a card
  // cardObject.questions is { items: [...], button: {...}, denyBehavior }
  // Only the items array belongs in enhancements; button/denyBehavior are visual/FE-only.
  const questions = Array.isArray(cardObject.questions?.items) && cardObject.questions.items.length
    ? cardObject.questions.items
    : undefined

  // Build the payload. Always include `media` (as empty array if no images)
  // since some schemas require the key to be present. Same for any other
  // optional buckets — empty is safer than absent for strict validators.
  const enhancements = {
    background: { type: bgType },
    media: mediaItems,
  }
  if (interaction) enhancements.interaction = interaction
  if (questions)   enhancements.questions   = questions

  const payload = {
    config: {
      colors,
      font,
      // content is REQUIRED. Send heading/body/extendedBody.
      content: {
        heading: cardObject.content?.heading || '',
        body: cardObject.content?.body || '',
        extendedBody: cardObject.content?.extendedBody || '',
      },
    },
    enhancements,
  }

  // Poll / trivia / chain data live at the top level of the card payload
  // (alongside config + enhancements), not nested inside enhancements.
  if (cardObject.poll    && cardObject.poll.question)    payload.poll    = cardObject.poll
  if (cardObject.trivia  && cardObject.trivia.questions) payload.trivia  = cardObject.trivia
  if (cardObject.chain   !== undefined)                  payload.chain   = cardObject.chain

  return payload
}

// Back-compat shim — older call sites still import the old name.
export function cardObjectToBackendConfig(cardObject) {
  return cardObjectToBackendPayload(cardObject).config
}

/**
 * Transform backend layoutdata → frontend cardObject
 * Backend sends media.images as string[], frontend expects object[]
 * Also reconstructs palette/theme from config.colors so the Studio
 * theme panel shows the correct colors when editing a saved card.
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

  // Reconstruct palette, theme and background.colors from backend config.colors
  // so the Studio colour pickers are pre-filled when a card is re-opened.
  if (obj.config?.colors) {
    const c = obj.config.colors
    if (!obj.palette) obj.palette = {}
    if (!obj.palette.surface && c.background)   obj.palette.surface = c.background
    if (!obj.palette.primary && c.accent)        obj.palette.primary = c.accent
    if (!obj.palette.accent  && c.gradient?.[1]) obj.palette.accent  = c.gradient[1]
    if (!obj.theme) obj.theme = {}
    if (!obj.theme.accentColor && c.accent)         obj.theme.accentColor  = c.accent
    if (!obj.theme.fontFamily  && obj.config?.font) obj.theme.fontFamily   = obj.config.font
    if (!obj.background) obj.background = {}
    if ((!obj.background.colors || !obj.background.colors.length) && c.gradient?.length) {
      obj.background.colors = [...c.gradient]
    }
    if (!obj.background.primaryColor && c.background) {
      obj.background.primaryColor = c.background
    }
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

  const type = normaliseType(card.type || layout.type)
  return {
    id: card.cardId || card._id || slug,
    slug,
    title: card.title || content.heading || 'Untitled Card',
    subtitle: content.body || '',
    message: content.body || '',
    type,
    templateId: card.templateId || '',
    tier: normaliseTier(findTier({ ...card, layoutConfig: layout, layoutdata: layout })),
    createdAt: card.createdAt || '',
    poll: card.poll || null,
    chain: card.chain || null,
    trivia: card.trivia || null,
    layoutdata: layout,
    cardObject: layoutDataToCardObject(layout),
    tag: type === 'personal' ? '' : capitalize(type),
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
    role: msg.role || '',
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
