import { backfillEnvelope, defaultCardObject } from '../data/cardDefaults.js'
import { formatGiftName, giftNameToEffectKey, formatGiftAmount } from './gifts.js'


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

function normalizeAttachedGift(card = {}) {
  const attachment =
    card.giftAttachment ||
    card.gift_attachment ||
    card.gift ||
    card.attachedGift ||
    card.attached_gift ||
    card.giftEffect ||
    card.gift_effect ||
    card.enhancements?.gift ||
    card.layoutdata?.giftEffect ||
    card.layoutdata?.gift_effect ||
    card.layoutData?.giftEffect ||
    card.layoutData?.gift_effect ||
    null

  if (!attachment) return null

  const nested =
    attachment.gift ||
    attachment.giftItem ||
    attachment.inventoryItem ||
    attachment.inventory ||
    attachment.item ||
    {}

  return {
    ...nested,
    ...attachment,
    giftName: attachment.giftName || attachment.name || nested.giftName || nested.name || nested.effectKey,
    name: attachment.name || attachment.giftName || nested.name || nested.giftName,
    effectKey: attachment.effectKey || nested.effectKey || attachment.giftName || attachment.name || nested.giftName || nested.name,
    title: attachment.giftTitle || attachment.title || nested.title,
    amount: attachment.giftAmount || attachment.amount || attachment.valueNgn || attachment.priceNgn || nested.amount || nested.valueNgn || nested.priceNgn,
    inventoryId: attachment.inventoryId || attachment.giftInventoryId || attachment.giftId || nested.inventoryId || nested._id || nested.id,
    id: attachment.giftId || attachment.inventoryId || attachment._id || attachment.id || nested._id || nested.id,
    enabled: attachment.enabled !== false && attachment.status !== 'removed',
  }
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

// Phase 2.1: the balance contract is frozen on `cc` (always an absolute
// integer) across every endpoint that returns one -- see the backend's
// CLAUDE.md for the full list. This reads `cc` only; the block below is a
// single fallback path, not a silent guess-and-hope waterfall, and it warns
// loudly so any remaining drift from the frozen contract stays visible
// instead of being quietly absorbed.
export function resolveBalance(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    const value = extractNumber(source.cc)
    if (value !== null) return value
  }

  const legacyKeys = [
    'couponBalance',
    'ccBalance',
    'balance',
    'availableCoupons',
    'currentCoupons',
    'numberOfCC',
    'totalCC',
  ]
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of legacyKeys) {
      const value = extractNumber(source[key])
      if (value !== null) {
        console.warn(`[resolveBalance] No "cc" field found -- fell back to legacy key "${key}". The backend contract should always return "cc"; report this source:`, source)
        return value
      }
    }
    if (Array.isArray(source.coupons)) {
      const couponSum = source.coupons.reduce((sum, item) => sum + (extractNumber(item?.amount) || 0), 0)
      if (couponSum) {
        console.warn('[resolveBalance] No "cc" field found -- fell back to summing a `coupons` array. Report this source:', source)
        return couponSum
      }
    }
  }

  return 0
}

export function normalizeUser(userPayload, extras = {}, couponPayload = null) {
  const user = getPrimaryUser(userPayload) || {}
  const roleValue = String(user.role || user.accountType || 'user').toLowerCase()
  const userId = user._id || user.id || user.userId || user.email || `u-${Date.now()}`
  const giftsInventory =
    user.giftsInventory ||
    user.giftInventory ||
    user.gifts ||
    user.inventory?.gifts ||
    []

  return {
    ...user,
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
    isPremiumActive: !!(couponPayload?.isPremiumActive || user.isPremiumActive),
    premiumUntil: couponPayload?.premiumUntil || user.premiumUntil || null,
    giftsInventory: Array.isArray(giftsInventory) ? giftsInventory : [],
    giftWalletNgn: user.giftWalletNgn ?? user.giftWallet ?? user.giftBalanceNgn ?? 0,
    profileBackground: user.equippedProfileBackground || user.profileBackground || user.equippedBackground || user.selectedProfileBackground || user.background || null,
    equippedBackground: user.equippedProfileBackground || user.equippedBackground || user.profileBackground || user.selectedProfileBackground || null,
    profileBackgroundUrl: user.profileBackgroundUrl || user.equippedProfileBackground?.url || user.backgroundUrl || user.selectedProfileBackgroundUrl || user.profileBackground?.url || user.equippedBackground?.url || user.selectedProfileBackground?.url || '',
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
    template.likeCount ??
    template.likedCount ??
    template.likes_count ??
    (Array.isArray(template.likes) ? template.likes.length : undefined) ??
    (Number.isFinite(Number(template.likes)) ? Number(template.likes) : undefined) ??
    template.analytics?.likes ??
    template.analytics?.likeCount ??
    template.stats?.likeCount ??
    template.stats?.likes ??
    template.popularityScore ??
    0
  const viewCount =
    template.viewCount ??
    template.views ??
    template.views_count ??
    template.analytics?.views ??
    template.stats?.views ??
    0
  const usageCount =
    template.usageCount ??
    template.usage_count ??
    template.uses ??
    template.useCount ??
    template.analytics?.uses ??
    template.stats?.uses ??
    0

  const createdBy = template.createdBy || template.artist || template.author || template.owner || template.userId || null
  const ownerId =
    (createdBy && typeof createdBy === 'object' ? createdBy._id || createdBy.id || createdBy.userId : createdBy) || null
  const artistName = template.artistName || template.ownerName || (createdBy && typeof createdBy === 'object' ? createdBy.username || createdBy.name : '') || ''
  const artistAvatar = template.artistAvatar || template.ownerAvatar || (createdBy && typeof createdBy === 'object' ? createdBy.profilePictureUrl || createdBy.avatarUrl : '') || ''

  return {
    id: template.id || template.templateId || template._id || `template-${index}`,
    templateId: template.id || template.templateId || template._id || null,
    title,
    subtitle: template.description || message,
    message,
    occasion: capitalize(template.category || 'General'),
    meta: `${usageCount} Users`,
    likes: String(likeCount),
    likeCount,
    isLiked: !!(template.isLiked || template.liked || template.viewerHasLiked || template.hasLiked),
    userCount: usageCount,
    usageCount,
    viewCount,
    category: (template.category || 'scratch').toLowerCase(),
    type: normaliseType(template.type || layout.type),
    tier: normaliseTier(findTier(template)),
    previewImage: template.previewImage || layout.previewImage || layout.media?.images?.[0] || '',
    status: (template.status || 'approved').toLowerCase(),
    tag: template.status ? capitalize(template.status) : '',
    ownerId,
    artistName,
    artistAvatar,
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
  const priceAmount = Number(pack.price || pack.basePrice || 0)
  // 3.1: "display the effective per-CC rate and badge on every tile" --
  // badge is now the pack's own explicit label (e.g. "POPULAR", "20% MORE")
  // rather than a generic featured flag; effectiveRate is the derived
  // price-per-CC shown so a buyer can compare packs without doing the
  // division themselves. Only meaningful in the pack's own priceCurrency
  // (NGN by default) -- a currency-converted price would need its own
  // effective-rate conversion, not attempted here.
  const effectiveRate = ccAmount > 0
    ? `${currency} ${formatter.format(Math.round((priceAmount / ccAmount) * 100) / 100)}/CC`
    : ''
  return {
    id: pack.packageId || pack._id,
    packageId: pack.packageId || pack._id,
    title: pack.name || `${ccAmount} CC Pack`,
    amount: `${ccAmount} CC`,
    cc: ccAmount,
    price: `${currency} ${formatter.format(priceAmount)}`,
    effectiveRate,
    bonus: pack.badge || (pack.featured ? 'Featured' : ''),
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
    root?.link ||
    root?.paymentLink ||
    root?.payment_link ||
    root?.sessionUrl ||
    payload?.authorization_url ||
    payload?.authorizationUrl ||
    payload?.data?.authorization_url ||
    payload?.data?.authorizationUrl ||
    payload?.checkoutUrl ||
    payload?.url ||
    payload?.link ||
    payload?.paymentLink ||
    payload?.payment_link ||
    payload?.sessionUrl ||
    payload?.data?.url ||
    payload?.data?.link ||
    payload?.data?.paymentLink ||
    payload?.data?.payment_link ||
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
      root.txRef ||
      root.tx_ref ||
      payload?.txRef ||
      payload?.tx_ref ||
      payload?.data?.txRef ||
      payload?.data?.tx_ref ||
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
   CARD MAPPERS — frontend cardObject ↔ backend payload
   Source of truth: Backend API Handbook (README_21)
   ═══════════════════════════════════════════════ */

// Normalise short or non-standard hex → 7-char #rrggbb.
function normaliseHex(input, fallback = '#76efff') {
  if (typeof input !== 'string') return fallback
  let v = input.trim().toLowerCase()
  if (!v.startsWith('#')) return fallback
  if (v.length === 4) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  return fallback
}

// Returns true when a hex color is light enough that dark text is needed.
// Uses a fast perceived-luminance formula (same as WCAG relative luminance approx).
function isLightColor(hex) {
  const h = normaliseHex(hex, '#000000').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55
}

/**
 * cardObjectToLayoutData — returns the layoutdata branch.
 * Per the API handbook, layoutdata only carries paperTexture metadata.
 * The backend forces layoutdata.tier to match the card's tier automatically.
 *
 * NOTE: Gift data does NOT go here — the backend strips unknown fields
 * (stripUnknown: true). Gift attachment data travels via the separate
 * giftAttachment field created by POST /cards/attach-gift.
 */
export function cardObjectToLayoutData(cardObject = null, { allowAnonMedia = false } = {}) {
  const layoutdata = {
    paperTexture: {
      type: 'none',
      opacity: 0,
      blendMode: 'normal',
    },
  }
  if (cardObject?.closedState) layoutdata.closedState = structuredClone(cardObject.closedState)
  // `enhancements.background/animation` only round-trip through a lossy,
  // tier-degrading path on the way back (cardBorder isn't sent at all;
  // elite-only ambients like aurora/lanterns are rewritten to a backend-safe
  // enum before send — see AMBIENT_EFFECT_MAP/OPEN_EFFECT_MAP below). Since
  // `layoutdata` is stored and echoed back verbatim (schema.js's
  // layoutDataSchema is `.unknown(true)`), persist the true values here so
  // backendCardToCardObject can prefer them over the degraded derivation —
  // frontend-only fix, no backend change needed.
  if (cardObject) {
    layoutdata.styleExtras = {
      cardBorder: cardObject.card?.cardBorder ? structuredClone(cardObject.card.cardBorder) : undefined,
      ambientType: cardObject.animation?.backgroundEffect?.type,
      openEffectType: cardObject.animation?.openEffect,
      textBodyAnimation: cardObject.card?.textBodyAnimation ? structuredClone(cardObject.card.textBodyAnimation) : undefined,
      // The Surface Transparency slider — same "persist the true value in
      // layoutdata" fix as cardBorder/textBodyAnimation above.
      // backgroundOpacity was previously never written here at all, so
      // backendCardToCardObject had nothing to read back and hardcoded it
      // to 0 on every reload/send — the slider reset to fully opaque no
      // matter what the sender picked.
      backgroundOpacity: cardObject.card?.backgroundOpacity,
      // Elite-only opt-in: lets an anonymous card's responders attach a
      // voice note or photo/video. Read server-side by
      // submitAnonymousMessage to gate whether those fields are kept.
      allowAnonMedia: allowAnonMedia || undefined,
      // The lock gate's hint text (e.g. "ask me for the password") — backend
      // enhancements.lock only carries {type, value}, no hint field, so this
      // was previously never sent at all: it showed correctly in the
      // sender's own Studio preview (pure local state) but silently vanished
      // before the real recipient ever saw it. Same "persist in layoutdata"
      // fix as the fields above.
      lockHint: cardObject.interaction?.lock?.hint || undefined,
      // The palette system's 4th anchor (primary/surface/accent are real,
      // stored colors — ink/text never was). backendCardToCardObject always
      // derived text color from background luminance instead, so a hand-
      // picked ink color (via Theme > Advanced colors) silently reset to
      // plain black/white on every reload. Same "persist in layoutdata" fix.
      inkColor: cardObject.theme?.textColor || undefined,
    }
  }
  // The galaxy scene. Memories index into media.images, and that array gets
  // filtered on the way out (blob:/file: URLs fail Joi.uri()), so any entry
  // pointing past the surviving images is dropped here rather than left to
  // resolve to a missing photo on the recipient's side.
  if (cardObject?.experience?.type && cardObject.experience.type !== 'none') {
    const experience = structuredClone(cardObject.experience)
    const imageCount = (cardObject.media?.images || [])
      .filter(img => /^(https?:|data:)/.test(img?.url || '')).length
    experience.memories = (experience.memories || [])
      .filter(m => Number.isInteger(m?.mediaIndex) && m.mediaIndex >= 0 && m.mediaIndex < imageCount)
    layoutdata.experience = experience
  }
  return layoutdata
}

/**
 * cardObjectToBackendPayload — transforms the frontend cardObject into the
 * three backend payload branches: { config, enhancements, layoutdata }.
 *
 * Branch ownership (from API handbook):
 *   config      → colors, font, type-specific content text
 *   enhancements → visual FX: background, music, lock, ambientEffect,
 *                  openEffect, media, animation
 *   layoutdata  → paperTexture only (tier managed by backend)
 *
 * Tier gates (handbook):
 *   classic → enhancements: {} (backend rejects non-default enhancements)
 *   premium → background, lock, ambientEffect, animation
 *             (NO music, video bg, openEffect, media)
 *   elite   → full enhancement set
 *
 * @param {object} cardObject  Frontend card state
 * @param {object} opts
 * @param {string} opts.type   Card type: personal|poll|chain|trivia|anonymous
 * @param {string} opts.tier   Card tier: classic|premium|elite
 * @param {object} opts.poll   Poll state from CardStudio { question, options[] }
 * @param {object} opts.trivia Trivia state { questions[{ text, options[], correctIndex }] }
 * @param {object} opts.chain  Chain state { prompt, rules[] }
 */
export function cardObjectToBackendPayload(cardObject, {
  type = 'personal',
  tier = 'classic',
  poll = null,
  trivia = null,
  chain = null,
  allowAnonMedia = false,
} = {}) {
  const FB = { background: '#0b0f12', gradient: ['#76efff', '#62ffa2'], accent: '#76efff' }

  if (!cardObject) {
    return {
      config: { colors: FB, font: 'Cinzel', content: {} },
      enhancements: {},
      layoutdata: cardObjectToLayoutData(),
    }
  }

  const normalType = (type === 'moment' || type === 'standard' || !type) ? 'personal' : type
  const resolvedTier = (tier || 'classic').toLowerCase()

  // ── config.colors
  // palette.primary = heading/border color (→ config.colors.accent + gradient[0])
  // palette.accent  = UI highlight/seal/secondary (→ config.colors.gradient[1])
  // palette.surface = dark card base (→ config.colors.background)
  const palette = cardObject.palette || {}
  const feColors = Array.isArray(cardObject.background?.colors) ? cardObject.background.colors : []

  // Gradient stops: prefer explicit background.colors, fall back to palette anchors.
  // Never use headingColor (a text colour) as a gradient stop.
  const raw1 = feColors[0] || palette.primary || cardObject.theme?.accentColor
  const raw2 = feColors[feColors.length - 1] || palette.accent || FB.gradient[1]
  const stop1 = normaliseHex(raw1, FB.gradient[0])
  let stop2 = normaliseHex(raw2, FB.gradient[1])
  if (stop2 === stop1) stop2 = FB.gradient[1] === stop1 ? FB.gradient[0] : FB.gradient[1]

  const colors = {
    // surface/dark base — never use a gradient stop as fallback here
    background: normaliseHex(palette.surface || cardObject.card?.backgroundColor, FB.background),
    gradient: [stop1, stop2],
    // primary accent (heading/border emphasis colour, = palette.primary)
    accent: normaliseHex(palette.primary || cardObject.theme?.accentColor || stop1, FB.accent),
  }
  const font = cardObject.theme?.fontFamily || 'Cinzel'

  // ── config.content (type-specific — handbook §7 "Canonical Field Ownership")
  // Backend Joi rules (cards/schema.js):
  //   personal  → header (1-200), body (1-4000) BOTH REQUIRED min(1)
  //   poll      → question (1-500) REQUIRED, options array min(2) max(25); each {id min 1, text min 1}
  //   chain     → challenge (1-600) REQUIRED, rules array max(25); each rule min(1)
  //   trivia    → questions min(1) max(50); each {question min(1), options array min(2) max(8) each min(1), correctIndex < options.length}
  //   anonymous → message (1-2000) REQUIRED min(1)
  // Empty strings on required fields = 400 validation error. UI must block submit before this is called.
  let content = {}
  if (normalType === 'personal') {
    const items = Array.isArray(cardObject.questions?.items) ? cardObject.questions.items : []
    content = {
      header: cardObject.content?.heading || '',
      body: cardObject.content?.body || '',
      questionBlock: {
        enabled: items.length > 0 && Boolean((items[0]?.text || '').trim()),
        question: items[0]?.text || '',
        suspenseTexts: items.slice(1).map(q => (q.text || '').trim()).filter(Boolean),
        type: 'yes_no',
      },
    }
  } else if (normalType === 'poll' && poll) {
    const rawOptions = Array.isArray(poll.options) ? poll.options : []
    content = {
      name: poll.name || poll.title || cardObject.content?.heading || poll.question || '',
      question: poll.question || '',
      options: rawOptions
        .map((o, i) => {
          const text = typeof o === 'string' ? o : (o?.text || '')
          const id = (typeof o === 'object' && o?.id) ? o.id : `opt_${i}`
          return { id, text: String(text).trim() }
        })
        .filter(o => o.text), // drop empty-text options (each text needs min(1))
    }
  } else if (normalType === 'chain') {
    const c = chain || {}
    content = {
      name: c.name || c.title || cardObject.content?.heading || c.prompt || c.challenge || '',
      challenge: c.prompt || c.challenge || '',
      // each rule needs min(1) — drop empty entries
      rules: Array.isArray(c.rules) ? c.rules.map(r => String(r || '').trim()).filter(Boolean) : [],
    }
  } else if (normalType === 'trivia' && trivia) {
    const rawQuestions = Array.isArray(trivia.questions) ? trivia.questions : []
    content = {
      name: trivia.name || trivia.title || cardObject.content?.heading || rawQuestions[0]?.text || rawQuestions[0]?.question || '',
      questions: rawQuestions
        .map(q => {
          const options = (Array.isArray(q.options) ? q.options : [])
            .map(opt => String(opt || '').trim())
            .filter(Boolean) // each option text needs min(1)
          const parsedCorrectIndex = parseInt(q.correctIndex, 10)
          const correctIndex = isNaN(parsedCorrectIndex) ? 0 : parsedCorrectIndex
          return {
            question: String(q.text || q.question || '').trim(),
            options,
            // clamp correctIndex within bounds (backend custom validator rejects out-of-range)
            correctIndex: Math.max(0, Math.min(correctIndex, Math.max(0, options.length - 1))),
          }
        })
        // drop questions that fail backend constraints (question text required, options min(2))
        .filter(q => q.question && q.options.length >= 2),
    }
  } else if (normalType === 'anonymous') {
    content = {
      name: cardObject.content?.heading || '',
      message: cardObject.content?.body || cardObject.content?.heading || '',
    }
  }

  // ── enhancements (handbook §7 enhancements spec)
  // Classic cards send empty object — backend rejects non-default enhancements.
  let enhancements = {}

  // ── Strict enum whitelists (backend validates these even when layoutdata is freeform)
  const VALID_AMBIENT   = new Set(['none', 'starfield', 'snow', 'bubbles', 'fountain', 'fireflies', 'floating'])
  const VALID_OPEN_FX   = new Set(['none', 'confetti', 'fireworks', 'heartsBurst', 'starShower', 'balloons', 'emojiRain'])
  const VALID_LOCK      = new Set(['none', 'tap', 'scratch', 'timer', 'password'])
  const VALID_BG        = new Set(['color', 'gradient', 'video', 'animated'])
  const VALID_ENTRY     = new Set(['fade', 'slide', 'zoom'])

  const safeEnum = (val, allowed, fallback = 'none') => allowed.has(val) ? val : fallback

  if (resolvedTier !== 'classic') {
    const isElite = resolvedTier === 'elite'

    // Background type — video is elite-only; downgrade for premium
    const VALID_BG_TYPES = new Set(['color', 'gradient', 'video', 'animated'])
    let bgType = cardObject.background?.type || 'color'
    if (!VALID_BG_TYPES.has(bgType)) bgType = 'color'
    if (!isElite && (bgType === 'video' || bgType === 'image')) bgType = 'animated'
    if (bgType === 'image') bgType = 'color'
    bgType = safeEnum(bgType, VALID_BG, 'color')

    // background.value: per handbook examples —
    //   color:    hex color value (e.g. '#0b0f12')
    //   gradient: preset token (e.g. 'midnight-gradient') or color hex
    //   animated: preset token (e.g. 'aurora-soft') or color hex
    //   video:    video URL
    // Backend custom validator rejects empty string for gradient/animated.
    let bgValue = ''
    if (bgType === 'color') {
      bgValue = normaliseHex(feColors[0] || colors.background, FB.background)
    } else if (bgType === 'video') {
      bgValue = cardObject.background?.videoUrl || ''
    } else {
      // gradient / animated: use primary color as the value token if no preset is stored
      bgValue = normaliseHex(feColors[0] || colors.accent || colors.background, FB.background)
    }

    // lock.type: FE uses 'time', backend requires 'timer' (handbook Common AI Mistakes #3)
    const rawLock = cardObject.interaction?.lock?.type || 'none'
    const lockType = safeEnum(rawLock === 'time' ? 'timer' : rawLock, VALID_LOCK)

    const AMBIENT_EFFECT_MAP = {
      shimmer: 'starfield',
      aurora: 'starfield',
      lanterns: 'floating',
      petals: 'floating',
      embers: 'fireflies',
      rain: 'snow',
      meteors: 'starfield',
    }

    // ambientEffect.type: whitelist to backend-allowed values only
    const rawAmbient = cardObject.animation?.backgroundEffect?.type || 'none'
    const ambientType = safeEnum(AMBIENT_EFFECT_MAP[rawAmbient] || rawAmbient, VALID_AMBIENT)

    // animation.entry: whitelist
    const rawEntry = Number(cardObject.card?.textBodyAnimation?.selfTypeSpeed) > 0 ? 'slide'
      : Number(cardObject.card?.textBodyAnimation?.fadeInDuration) > 0 ? 'fade'
      : 'fade'

    const bgObj = {
        type: bgType,
        value: bgValue,
      }
      // videoSettings: only relevant for video backgrounds (handbook §7)
      if (bgType === 'video') {
        bgObj.videoSettings = {
          blur: 0,
          darkTint: 0.15,
          tintLevel: 0,
          tintColor: '',
        }
      }
      // gradientAnimation: only relevant for animated backgrounds
      if (bgType === 'animated') {
        bgObj.gradientAnimation = {
          enabled: true,
          duration: Number(cardObject.background?.animationDuration) || 8,
        }
      }

    enhancements = {
      background: bgObj,
      // lock.type: FE uses 'time', backend requires 'timer' (handbook Common AI Mistakes #3)
      // lock.value: per handbook samples, type 'none' uses value '' (empty string).
      // Active lock types (password/timer) require a non-empty value.
      lock: (() => {
        const lt = cardObject.interaction?.lock?.type || 'none'
        const lockType = safeEnum(lt === 'time' ? 'timer' : lt, VALID_LOCK)
        if (lockType === 'none' || lockType === 'tap' || lockType === 'scratch') {
          return { type: lockType, value: '' }
        }
        // password/timer — must have a non-empty value
        const rawVal = cardObject.interaction?.lock?.value
        const lockValue = (rawVal != null && String(rawVal).trim())
          ? String(rawVal).trim()
          : (lockType === 'timer' ? new Date(Date.now() + 86400000).toISOString() : '0000')
        return { type: lockType, value: lockValue }
      })(),
      ambientEffect: {
        type: ambientType,
        emojis: Array.isArray(cardObject.animation?.backgroundEffect?.emojis)
          ? cardObject.animation.backgroundEffect.emojis : [],
      },
      animation: {
        entry: safeEnum(rawEntry, VALID_ENTRY, 'fade'),
        speed: (() => {
          const sp = Number(cardObject.card?.textBodyAnimation?.selfTypeSpeed) || 0
          const fd = Number(cardObject.card?.textBodyAnimation?.fadeInDuration) || 0
          return sp > 0 ? sp : (fd > 0 ? fd : 1)
        })(),
      },
    }

    // Elite-only: music, openEffect, media
    if (isElite) {
      const music = cardObject.background?.music || {}
      enhancements.music = {
        track: music.url || '',
        volume: typeof music.volume === 'number' ? music.volume : 0,
      }

      // openEffect.colors: backend requires array.length(3) where each item satisfies
      // colorSchema (min 1 char). Empty strings fail — fill with '#ffffff' as safe default.
      const cc = Array.isArray(cardObject.animation?.confettiColors) ? cardObject.animation.confettiColors : []
      const fillColor = colors.accent || '#ffffff'
      const OPEN_EFFECT_MAP = {
        hearts: 'heartsBurst',
        stars: 'starShower',
        glitterBurst: 'confetti',
        goldenBloom: 'confetti',
        rosePetals: 'heartsBurst',
        cometTrail: 'starShower',
        heartsBurst: 'heartsBurst',
        starShower: 'starShower',
        confetti: 'confetti',
        fireworks: 'fireworks',
        balloons: 'balloons',
        emojiRain: 'emojiRain',
        sparkleRain: 'starShower',
        none: 'none',
      }
      const rawOpenEffect = cardObject.animation?.openEffect || 'none'
      enhancements.openEffect = {
        type: OPEN_EFFECT_MAP[rawOpenEffect] || 'none',
        colors: [
          (cc[0] && String(cc[0]).trim()) || fillColor,
          (cc[1] && String(cc[1]).trim()) || fillColor,
          (cc[2] && String(cc[2]).trim()) || fillColor,
        ],
      }

      // media[].url: backend Joi.string().uri().required() — drop blob:/file:/empty URLs.
      enhancements.media = Array.isArray(cardObject.media?.images)
        ? cardObject.media.images
            .map(img => (typeof img === 'string' ? img : img?.url))
            .filter(url => typeof url === 'string' && /^https?:/i.test(url.trim()))
            .map(url => ({ type: 'image', url: url.trim() }))
        : []
    }
  }

  // Include layoutdata for paper texture metadata.
  // The backend stores layoutdata and returns it with GET /cards/:slug.
  const layoutdata = cardObjectToLayoutData(cardObject, { allowAnonMedia: type === 'anonymous' && tier === 'elite' && allowAnonMedia })

  const payload = {
    config: { colors, font, content },
    enhancements,
    layoutdata,
  }

  if (normalType !== 'personal' && content.name) {
    payload.name = content.name
  }

  const giftInventoryId = cardObject.giftEffect?.giftInventoryId || cardObject.giftEffect?.inventoryId || cardObject.giftEffect?.giftId
  if (normalType === 'personal' && giftInventoryId) {
    // Backend schema uses .oxor("giftInventoryId", "inventoryId") — send only one.
    payload.giftInventoryId = giftInventoryId
  }

  return payload
}

/**
 * backendCardToCardObject — reconstructs a frontend cardObject from the backend
 * card structure { config, enhancements, layoutdata } returned by GET /cards/:slug.
 */
export function backendCardToCardObject(card) {
  if (!card) return backfillEnvelope(structuredClone(defaultCardObject))

  const config = card.config || {}
  const enhancements = card.enhancements || {}
  const colors = config.colors || {}
  const content = config.content || {}
  const layoutdata = card.layoutdata || {}
  // Sender-persisted true values for fields that only round-trip through a
  // lossy path via `enhancements` (cardBorder isn't sent to the backend at
  // all; elite-only ambients/openEffects get rewritten to a backend-safe
  // enum before send — see cardObjectToBackendPayload's AMBIENT_EFFECT_MAP /
  // OPEN_EFFECT_MAP). Prefer these when present so the recipient sees what
  // the sender actually built, not the degraded backend-safe version.
  const styleExtras = layoutdata.styleExtras || {}

  const attachedGift = normalizeAttachedGift(card)
  const storedGiftEffect = card.cardObject?.giftEffect || card.layoutdata?.giftEffect || card.layoutConfig?.giftEffect || card.giftEffect || {}

  const bgType = enhancements.background?.type || 'color'
  const isVideo = bgType === 'video'
  const bgColors = bgType === 'color'
    ? [enhancements.background?.value || colors.background || '#0a0a0a']
    : (colors.gradient?.length >= 2 ? [...colors.gradient] : ['#0a0a0a', '#1a1a2e'])

  const entryAnim = enhancements.animation?.entry || 'fade'
  const entrySpeed = Number(enhancements.animation?.speed) || 1

  const lockType = (() => {
    const lt = enhancements.lock?.type || 'none'
    return lt === 'timer' ? 'time' : lt
  })()

  // primaryAccent = palette.primary (heading/border/border-emphasis colour)
  // uiAccent      = palette.accent  (buttons, seal, secondary highlight)
  // These are stored as colors.accent and colors.gradient[1] respectively.
  const primaryAccent = colors.accent || '#76efff'
  const uiAccent = colors.gradient?.[1] || primaryAccent
  const bgColor = colors.background || '#111111'
  const fontFamily = config.font || 'Cinzel'

  // Derive text / heading colour from background luminance so light-surface
  // palettes (paper-ink, jade-parchment) don't render white text on cream —
  // but prefer a sender's actual hand-picked ink color when one was set
  // (Theme > Advanced colors), the same "persist in layoutdata" pattern as
  // cardBorder/backgroundOpacity/lockHint above.
  const onLight = isLightColor(bgColor)
  const baseTextColor = styleExtras.inkColor || (onLight ? '#1a1a1a' : '#ffffff')
  const baseHeadingColor = onLight ? '#0a0a0a' : '#ffffff'

  const questionItems = content.questionBlock?.enabled && content.questionBlock?.question
    ? [
        { text: content.questionBlock.question, id: 'q1', type: 'text', options: [] },
        ...(content.questionBlock.suspenseTexts || []).map((t, i) => ({
          text: t, id: `q${i + 2}`, type: 'text', options: [],
        })),
      ]
    : []

  return backfillEnvelope({
    // Partial palette: enough for Studio color pickers to show the right values.
    // id is null because we don't store palette.id through the backend.
    palette: {
      id: null,
      surface: bgColor,
      primary: primaryAccent,
      accent: uiAccent,
      ink: baseTextColor,
    },
    background: {
      type: bgType,
      colors: bgColors,
      animationDuration: Number(enhancements.background?.gradientAnimation?.duration) || 2,
      imageUrl: '',
      videoUrl: isVideo ? (enhancements.background?.value || '') : '',
      music: {
        url: enhancements.music?.track || '',
        isUploaded: false,
        volume: typeof enhancements.music?.volume === 'number' ? enhancements.music.volume : 0.8,
        startSec: 0,
        endSec: 0,
      },
    },
    theme: {
      fontFamily,
      headingSize: 28,
      bodySize: 16,
      // uiAccent = palette.accent (secondary highlight used for buttons/seal/emphasis)
      accentColor: uiAccent,
      textColor: baseTextColor,
      headingColor: baseHeadingColor,
    },
    card: {
      backgroundColor: bgColor,
      backgroundOpacity: styleExtras.backgroundOpacity ?? 0,
      textColor: baseTextColor,
      headingColor: baseHeadingColor,
      // primaryAccent = palette.primary (the card's main emphasis/border colour)
      cardBorder: styleExtras.cardBorder || { type: 'solid', colors: [primaryAccent], width: 2, animationDuration: 2 },
      scrollbarColor: primaryAccent,
      textBodyAnimation: styleExtras.textBodyAnimation || {
        fadeInDuration: entryAnim === 'fade' ? entrySpeed : 0,
        selfTypeSpeed: entryAnim === 'slide' ? entrySpeed : 0,
      },
    },
    // Sender-configured envelope/closed-state values (persisted in layoutdata.closedState)
    // take priority; derived-from-palette values are only a fallback for cards that
    // never set them (e.g. templates, or cards created before this was configurable).
    closedState: (() => {
      const persisted = layoutdata.closedState || {}
      const defaultButton = {
        text: 'Open',
        backgroundColor: primaryAccent,
        textColor: onLight ? '#ffffff' : bgColor,
        borderColor: primaryAccent,
        shape: 'pill',
      }
      const defaultEnvelope = structuredClone(defaultCardObject.closedState.envelope)
      return {
        backgroundColor: bgColor,
        borderColor: primaryAccent,
        textColor: baseTextColor,
        headingColor: baseHeadingColor,
        headingFont: fontFamily,
        headingText: content.header || 'You have a surprise',
        bodyText: 'Someone special sent you something beautiful.',
        ...persisted,
        button: { ...defaultButton, ...(persisted.button || {}) },
        envelope: { ...defaultEnvelope, ...(persisted.envelope || {}) },
      }
    })(),
    animation: {
      openEffect: styleExtras.openEffectType || enhancements.openEffect?.type || 'none',
      confettiColors: (enhancements.openEffect?.colors || []).filter(Boolean),
      backgroundEffect: {
        type: styleExtras.ambientType || enhancements.ambientEffect?.type || 'none',
        emojis: enhancements.ambientEffect?.emojis || [],
      },
    },
    media: {
      images: (enhancements.media || []).map(m => ({
        url: typeof m === 'string' ? m : (m?.url || ''),
        caption: '',
        fit: 'cover',
        positionX: 50,
        positionY: 50,
      })),
    },
    interaction: {
      lock: { type: lockType, value: enhancements.lock?.value || '', hint: styleExtras.lockHint || '' },
    },
    content: {
      heading: content.header || content.message || content.challenge || content.question || content.name || content.questions?.[0]?.question || '',
      body: content.body || content.message || '',
      extendedBody: '',
    },
    questions: {
      items: questionItems,
      button: { textColor: onLight ? bgColor : '#ffffff', borderColor: primaryAccent, backgroundColor: primaryAccent },
      denyBehavior: 'none',
    },
    giftEffect: attachedGift ? {
      enabled: attachedGift.enabled !== false,
      effectKey: giftNameToEffectKey(attachedGift.effectKey || attachedGift.giftName || attachedGift.name || storedGiftEffect.effectKey || 'none'),
      giftTitle: attachedGift.giftTitle || attachedGift.title || formatGiftName(attachedGift.giftName || attachedGift.name || attachedGift.effectKey || storedGiftEffect.giftName || storedGiftEffect.effectKey),
      giftAmount: attachedGift.giftAmount || formatGiftAmount(attachedGift.amount) || storedGiftEffect.giftAmount || '',
      giftId: attachedGift.giftId || attachedGift.inventoryId || attachedGift.id || storedGiftEffect.giftId || '',
      giftName: attachedGift.giftName || attachedGift.name || storedGiftEffect.giftName || '',
      status: attachedGift.status || storedGiftEffect.status || 'available',
    } : (storedGiftEffect.enabled ? storedGiftEffect : { enabled: false, effectKey: 'none', giftTitle: '', giftAmount: '', status: 'available' }),
    experience: (() => {
      const stored = layoutdata.experience
      const base = structuredClone(defaultCardObject.experience)
      if (!stored || stored.type !== 'galaxy') return base
      const imageCount = (enhancements.media || []).length
      return {
        ...base,
        ...stored,
        memories: (stored.memories || []).filter(m =>
          Number.isInteger(m?.mediaIndex) && m.mediaIndex >= 0 && m.mediaIndex < imageCount),
        coreNotes: (stored.coreNotes || []).filter(Boolean),
      }
    })(),
  })
}

/**
 * Map a backend card (from /usercards or /cards/:slug) to a frontend-usable shape.
 * Uses backendCardToCardObject to reconstruct from config+enhancements per API handbook.
 */
export function mapBackendCard(card) {
  // Phase 2.2: every card-returning endpoint puts `slug` at the top level
  // of the card object (backend CLAUDE.md, cards.schema.js). The
  // _id/cardId fallback below only exists for a contract violation and
  // warns loudly if it ever fires.
  let slug = card.slug || ''
  if (!slug) {
    slug = card._id || card.cardId || ''
    if (slug) {
      console.warn('[mapBackendCard] Card had no `slug` field -- fell back to _id/cardId. Report this card shape:', JSON.stringify(card)?.slice(0, 400))
    }
  }
  const config = card.config || {}
  const layout = card.layoutdata || card.layoutData || card.layoutConfig || {}
  const content = config.content || card.content || layout.content || {}
  const enhancements = card.enhancements || {}

  const type = normaliseType(card.type)
  const tier = normaliseTier(card.tier || card.layoutdata?.tier)
  const pollContent = content.poll || config.poll || card.poll || layout.poll || content
  const chainContent = content.chain || config.chain || card.chain || layout.chain || content
  const triviaContent = content.trivia || config.trivia || card.trivia || layout.trivia || content
  const pollOptions = Array.isArray(pollContent.options)
    ? pollContent.options.map((opt, i) => (
        typeof opt === 'object'
          ? { id: opt.id || `opt_${i}`, text: opt.text || opt.label || opt.value || '' }
          : { id: `opt_${i}`, text: String(opt || '') }
      )).filter(opt => opt.text)
    : []
  const triviaQuestions = Array.isArray(triviaContent.questions)
    ? triviaContent.questions.map(q => ({
        ...q,
        text: q.text || q.question || '',
        question: q.question || q.text || '',
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: isNaN(parseInt(q.correctIndex, 10)) ? 0 : parseInt(q.correctIndex, 10),
      }))
    : []

  const lockType = (() => {
    const lt = enhancements.lock?.type || 'none'
    return lt === 'timer' ? 'time' : lt
  })()
  const title = (
    card.name ||
    card.title ||
    content.name ||
    config.content?.name ||
    content.header ||
    pollContent.question ||
    chainContent.challenge ||
    chainContent.prompt ||
    triviaQuestions[0]?.question ||
    triviaQuestions[0]?.text ||
    content.message ||
    'Untitled Card'
  )

  return {
    id: card.cardId || card.id || card._id || slug,
    slug,
    title,
    subtitle: content.body || '',
    message: content.body || content.message || '',
    type,
    templateId: card.templateId || '',
    tier,
    createdAt: card.createdAt || '',
    senderName: card.senderName || card.creatorName || card.createdBy?.username || card.createdBy?.name || card.user?.username || '',
    // Use card.type as primary signal — content field heuristics as fallback.
    poll: type === 'poll'
      ? { question: pollContent.question || '', options: pollOptions, allowMultiple: !!pollContent.allowMultiple }
      : (pollContent.question && !content.header ? { question: pollContent.question, options: pollOptions } : null),
    chain: type === 'chain'
      ? { challenge: chainContent.challenge || chainContent.prompt || '', prompt: chainContent.prompt || chainContent.challenge || '', rules: chainContent.rules || [] }
      : (chainContent.challenge || chainContent.prompt ? { challenge: chainContent.challenge || chainContent.prompt, rules: chainContent.rules || [] } : null),
    trivia: type === 'trivia'
      ? { questions: triviaQuestions }
      : (triviaQuestions.length ? { questions: triviaQuestions } : null),
    anonymous: type === 'anonymous'
      ? { message: content.message || '' }
      : null,
    layoutdata: card.layoutdata || {},
    cardObject: backendCardToCardObject(card),
    tag: type === 'personal' ? '' : capitalize(type),
    interaction: enhancements,
    locked: lockType !== 'none',
    lockType,
    // Carry forward backend state for interaction rendering (vote counts, responses, etc.)
    state: card.state || {},
  }
}

/**
 * Map a chat message for the frontend
 */
export function mapChatMessage(msg) {
  const user = msg.user || msg.sender || msg.author || {}
  return {
    id: msg.id || msg._id || `msg-${Date.now()}-${Math.random()}`,
    userId: msg.userId || msg.senderId || msg.authorId || user.id || user._id || '',
    username: msg.username || user.username || user.name || 'Anonymous',
    content: msg.content || msg.message || msg.text || '',
    profilePictureUrl: msg.profilePictureUrl || msg.avatarUrl || user.profilePictureUrl || user.avatarUrl || null,
    role: msg.role || user.role || '',
    createdAt: msg.createdAt || new Date().toISOString(),
    ...(msg.type === 'template_share' ? {
      type: 'template_share',
      templateId: msg.templateId || '',
      templateName: msg.templateName || '',
      templatePreviewImage: msg.templatePreviewImage || '',
      templateCategory: msg.templateCategory || '',
    } : {}),
  }
}

