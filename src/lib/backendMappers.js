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
 */
export function cardObjectToLayoutData() {
  return {
    paperTexture: {
      type: 'none',
      opacity: 0,
      blendMode: 'normal',
    },
  }
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
      challenge: c.prompt || c.challenge || '',
      // each rule needs min(1) — drop empty entries
      rules: Array.isArray(c.rules) ? c.rules.map(r => String(r || '').trim()).filter(Boolean) : [],
    }
  } else if (normalType === 'trivia' && trivia) {
    const rawQuestions = Array.isArray(trivia.questions) ? trivia.questions : []
    content = {
      questions: rawQuestions
        .map(q => {
          const options = (Array.isArray(q.options) ? q.options : [])
            .map(opt => String(opt || '').trim())
            .filter(Boolean) // each option text needs min(1)
          const correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : 0
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

    // ambientEffect.type: whitelist to backend-allowed values only
    const rawAmbient = cardObject.animation?.backgroundEffect?.type || 'none'
    const ambientType = safeEnum(rawAmbient, VALID_AMBIENT)

    // animation.entry: whitelist
    const rawEntry = Number(cardObject.card?.textBodyAnimation?.selfTypeSpeed) > 0 ? 'slide'
      : Number(cardObject.card?.textBodyAnimation?.fadeInDuration) > 0 ? 'fade'
      : 'fade'

    enhancements = {
      background: {
        type: bgType,
        value: bgValue,
        videoSettings: {
          blur: 0,
          darkTint: bgType === 'video' ? 0.15 : 0,
          tintLevel: 0,
          tintColor: '',
        },
        gradientAnimation: {
          enabled: bgType === 'animated',
          duration: Number(cardObject.background?.animationDuration) || 8,
        },
      },
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
        type: safeEnum(cardObject.animation?.backgroundEffect?.type || 'none', VALID_AMBIENT),
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
        heartsBurst: 'heartsBurst',
        starShower: 'starShower',
        confetti: 'confetti',
        fireworks: 'fireworks',
        balloons: 'balloons',
        emojiRain: 'emojiRain',
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
            .filter(url => typeof url === 'string' && /^(https?:|data:)/i.test(url.trim()))
            .map(url => ({ type: 'image', url: url.trim() }))
        : []
    }
  }

  // layoutdata is NOT sent — backend does not have a confirmed schema for it
  // and allowUnknown:false causes Joi to fail the entire payload with
  // "'value' failed custom validation because" when unknown keys are present.
  return {
    config: { colors, font, content },
    enhancements,
  }
}

// Back-compat shim.
export function cardObjectToBackendConfig(cardObject) {
  return cardObjectToBackendPayload(cardObject).config
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
  // palettes (paper-ink, jade-parchment) don't render white text on cream.
  const onLight = isLightColor(bgColor)
  const baseTextColor = onLight ? '#1a1a1a' : '#ffffff'
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
      backgroundOpacity: 0,
      textColor: baseTextColor,
      headingColor: baseHeadingColor,
      // primaryAccent = palette.primary (the card's main emphasis/border colour)
      cardBorder: { type: 'solid', colors: [primaryAccent], width: 2, animationDuration: 2 },
      scrollbarColor: primaryAccent,
      textBodyAnimation: {
        fadeInDuration: entryAnim === 'fade' ? entrySpeed : 0,
        selfTypeSpeed: entryAnim === 'slide' ? entrySpeed : 0,
      },
    },
    closedState: {
      backgroundColor: bgColor,
      borderColor: primaryAccent,
      textColor: baseTextColor,
      headingColor: baseHeadingColor,
      headingFont: fontFamily,
      headingText: content.header || 'You have a surprise',
      bodyText: 'Someone special sent you something beautiful.',
      button: {
        text: 'Open',
        backgroundColor: primaryAccent,
        textColor: onLight ? '#ffffff' : bgColor,
        borderColor: primaryAccent,
        shape: 'pill',
      },
      envelope: structuredClone(defaultCardObject.closedState.envelope),
    },
    animation: {
      openEffect: enhancements.openEffect?.type || 'none',
      confettiColors: (enhancements.openEffect?.colors || []).filter(Boolean),
      backgroundEffect: {
        type: enhancements.ambientEffect?.type || 'none',
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
      lock: { type: lockType, value: enhancements.lock?.value || '' },
      reveal: { type: 'tap', hint: '' },
    },
    content: {
      heading: content.header || content.message || content.challenge || content.question || '',
      body: content.body || content.message || '',
      extendedBody: '',
    },
    questions: {
      items: questionItems,
      button: { textColor: onLight ? bgColor : '#ffffff', borderColor: primaryAccent, backgroundColor: primaryAccent },
      denyBehavior: 'none',
    },
    giftEffect: { enabled: false, effectKey: 'none', giftTitle: '', giftAmount: '' },
  })
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
 * Map a backend card (from /usercards or /cards/:slug) to a frontend-usable shape.
 * Uses backendCardToCardObject to reconstruct from config+enhancements per API handbook.
 */
export function mapBackendCard(card) {
  const slug = card.slug || card._id || card.cardId || ''
  const config = card.config || {}
  const content = config.content || {}
  const enhancements = card.enhancements || {}

  const type = normaliseType(card.type)
  const tier = normaliseTier(card.tier || card.layoutdata?.tier)

  const lockType = (() => {
    const lt = enhancements.lock?.type || 'none'
    return lt === 'timer' ? 'time' : lt
  })()

  return {
    id: card.cardId || card._id || slug,
    slug,
    title: card.title || content.header || content.question || content.challenge || 'Untitled Card',
    subtitle: content.body || '',
    message: content.body || content.message || '',
    type,
    templateId: card.templateId || '',
    tier,
    createdAt: card.createdAt || '',
    // Use card.type as primary signal — content field heuristics as fallback.
    poll: type === 'poll'
      ? { question: content.question || '', options: content.options || [], allowMultiple: !!content.allowMultiple }
      : (content.question && !content.header ? { question: content.question, options: content.options || [] } : null),
    chain: type === 'chain'
      ? { challenge: content.challenge || '', rules: content.rules || [] }
      : (content.challenge ? { challenge: content.challenge, rules: content.rules || [] } : null),
    trivia: type === 'trivia'
      ? { questions: content.questions || [] }
      : (content.questions ? { questions: content.questions } : null),
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
