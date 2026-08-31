// Single source of truth for "what does this card cost and why" under the
// computed-tier model ("design free, pay at send"). No upfront tier choice —
// the sender uses whatever features they want and the tier/cost is derived
// live from what's actually on the card. The tier meter and the send receipt
// both read this same rule list, so they can never drift from each other.
//
// Mirrors the backend's real gates — keep in sync with:
//   Backend/Cardora/src/cards/engine.js `assertNoInvalidEnhancements`
//     (premium is personal-only; premium cards may never carry video
//     background, music, an openEffect, or media — those are elite-only)
//   src/lib/tierLimits.js (per-tier caps: poll options, trivia questions,
//     chain rules, allowCustomPalette, etc.)
import { getPaletteById, expectedEnvelopeColors } from './palettes.js'
import { AMBIENT_EFFECTS } from './studioEffects.js'
import { FONTS_BASIC, FONTS_PREMIUM, defaultCardObject } from '../data/cardDefaults.js'

export const TIER_RANK = { classic: 0, premium: 1, elite: 2 }

// Same fallback pricing table CardStudio/QuickCreate already hardcode —
// dedupe: both should import TIER_COST_BY_TYPE from here instead of keeping
// their own copies.
// 3.2: every type now has a real premium rung -- mirrors
// Backend/Cardora/src/cards/constants.js CARD_COSTS exactly. Premium used
// to be personal-only (every other type auto-escalated straight to elite);
// that restriction is gone on both sides.
export const TIER_COST_BY_TYPE = {
  personal: { classic: 0, premium: 10, elite: 20 },
  poll: { classic: 0, premium: 8, elite: 16 },
  trivia: { classic: 0, premium: 8, elite: 16 },
  chain: { classic: 0, premium: 8, elite: 16 },
  anonymous: { classic: 0, premium: 6, elite: 12 },
}

// Additive surcharges on top of the base type/tier cost above -- mirrors
// Backend/Cardora/src/cards/constants.js FEATURE_SURCHARGES exactly. Kept
// as a fallback the same way TIER_COST_BY_TYPE is: normalizeFeatureSurcharges
// prefers the live GET /cards/prices response when available.
export const FEATURE_SURCHARGES_FALLBACK = {
  additionalPhoto: 1, // per photo beyond the first
  music: 2,
  premiumTheme: 2,
  lock: 2,
  questionBlock: 2,
  galaxyExperience: 8,
}

export function normalizeFeatureSurcharges(payload) {
  const source = payload?.featureSurcharges || payload?.data?.featureSurcharges || {}
  const normalized = { ...FEATURE_SURCHARGES_FALLBACK }
  for (const key of Object.keys(normalized)) {
    const rawValue = source[key]
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      normalized[key] = Number(rawValue)
    }
  }
  return normalized
}

// Normalizes a `getCardPrices()` API response against the fallback table —
// moved here (from CardStudio.jsx) so QuickCreate can share it too.
export function normalizeCardPrices(payload) {
  const source = payload?.prices || payload?.data?.prices || payload?.data || payload || {}
  const normalized = {}
  for (const type of Object.keys(TIER_COST_BY_TYPE)) {
    const rawType = source[type] || source[type === 'anonymous' ? 'anon' : type] || {}
    normalized[type] = { ...TIER_COST_BY_TYPE[type] }
    for (const tier of Object.keys(normalized[type])) {
      const rawValue = rawType[tier] ?? rawType[`${tier}Cost`] ?? rawType[`${tier}Cc`]
      if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
        normalized[type][tier] = Number(rawValue)
      }
    }
  }
  return normalized
}

export function getTierCost(tier, type, cardPrices) {
  const table = cardPrices?.[type] || cardPrices?.personal || TIER_COST_BY_TYPE[type] || TIER_COST_BY_TYPE.personal
  return table?.[tier] ?? 0
}

// 3.2: additive surcharges on top of the base tier cost. Mirrors
// Backend/Cardora/src/cards/engine.js computeFeatureSurcharges exactly —
// same six triggers, same "first photo free" rule, same font-based proxy
// for "premium theme" (the backend can't see ambient effects/borders/
// palette id, only the plain config.font string, so that's the one part of
// this bundled concept checked on both sides). Keep the two in sync.
export function computeFeatureSurcharges(cardObject, ctx = {}, featureSurcharges = FEATURE_SURCHARGES_FALLBACK) {
  const breakdown = []
  let total = 0
  const add = (id, label, amount) => {
    if (amount <= 0) return
    breakdown.push({ id, label, amount })
    total += amount
  }

  const photoCount = cardObject?.media?.images?.length || 0
  if (photoCount > 1) {
    const extra = photoCount - 1
    add('additionalPhoto', `${extra} extra photo${extra === 1 ? '' : 's'}`, extra * featureSurcharges.additionalPhoto)
  }
  if (nonEmpty(cardObject?.background?.music?.url)) {
    add('music', 'Background music', featureSurcharges.music)
  }
  if (fontTier(cardObject?.theme?.fontFamily) === 'premium') {
    add('premiumTheme', 'Premium theme', featureSurcharges.premiumTheme)
  }
  if ((cardObject?.interaction?.lock?.type || 'none') !== 'none') {
    add('lock', 'Card lock', featureSurcharges.lock)
  }
  if ((ctx.type || 'personal') === 'personal' && nonEmpty(cardObject?.questions?.items?.[0]?.text)) {
    add('questionBlock', 'Question block', featureSurcharges.questionBlock)
  }
  if (cardObject?.experience?.type === 'galaxy') {
    add('galaxyExperience', 'Galaxy experience', featureSurcharges.galaxyExperience)
  }

  return { total, breakdown }
}

// The full amount the sender will actually be charged: base type/tier cost
// + feature surcharges. The backend is still the source of truth at charge
// time (cardController.js's getCardTotalCost) -- this is what the live tier
// meter/send receipt show so the two never visibly disagree.
export function getCardTotalCost(cardObject, tier, type, cardPrices, ctx = {}, featureSurcharges = FEATURE_SURCHARGES_FALLBACK) {
  const base = getTierCost(tier, type, cardPrices)
  const { total } = computeFeatureSurcharges(cardObject, { ...ctx, type }, featureSurcharges)
  return base + total
}

const AMBIENT_TIER = AMBIENT_EFFECTS.reduce((map, e) => {
  map[e.value] = e.tier
  return map
}, {})

export function fontTier(fontFamily) {
  const f = fontFamily || ''
  if (FONTS_BASIC.includes(f)) return 'classic'
  if (FONTS_PREMIUM.includes(f)) return 'premium'
  return 'elite'
}

function nonEmpty(v) {
  return typeof v === 'string' ? v.trim().length > 0 : !!v
}

// Detects hand-picked colors that don't match any applied palette's cascade
// — `allowCustomPalette` (elite-only) is really about *deviating* from a
// palette, not about having colors at all (every card has colors, free
// palettes included).
// A blank draft's starting colors depend on the *viewer's own* site theme at
// creation time (CardStudio.jsx seeds light-mode-friendly card/closedState
// colors for a brand-new draft when the studio itself is in light mode) —
// neither variant is "hand-picked", so both count as untouched baselines.
function isUntouchedBaselineColors(card) {
  const d = defaultCardObject
  const themeUntouched = (
    card?.theme?.accentColor === d.theme.accentColor &&
    card?.theme?.textColor === d.theme.textColor &&
    card?.theme?.headingColor === d.theme.headingColor
  )
  if (!themeUntouched) return false
  const matchesDark = (
    card?.card?.backgroundColor === d.card.backgroundColor &&
    card?.card?.textColor === d.card.textColor &&
    card?.card?.headingColor === d.card.headingColor
  )
  const matchesLight = (
    card?.card?.backgroundColor === '#ffffff' &&
    card?.card?.textColor === '#111111' &&
    card?.card?.headingColor === '#000000'
  )
  return matchesDark || matchesLight
}

function hasCustomColors(card) {
  const palette = getPaletteById(card?.palette?.id)
  if (!palette) return !isUntouchedBaselineColors(card)
  return (
    card?.theme?.accentColor !== palette.accent ||
    card?.theme?.textColor !== palette.ink ||
    card?.theme?.headingColor !== palette.primary ||
    card?.card?.backgroundColor !== palette.surface ||
    card?.card?.textColor !== palette.ink ||
    card?.card?.headingColor !== palette.primary
  )
}

// Envelope colors cascade from the applied palette for every card, including
// free ones (see `applyPalette` in palettes.js) — only flag it as a paid
// "signature touch" when the sender deviated from that cascade, or touched
// one of the non-color signature fields.
function envelopeDeviates(card) {
  const envelope = card?.closedState?.envelope
  if (!envelope) return false
  const palette = getPaletteById(card?.palette?.id)
  const expected = palette ? expectedEnvelopeColors(palette) : {
    bodyColor: defaultCardObject.closedState.envelope.bodyColor,
    flapColor: defaultCardObject.closedState.envelope.flapColor,
    sealColor: defaultCardObject.closedState.envelope.sealColor,
  }
  const colorsDeviate = (
    envelope.bodyColor !== expected.bodyColor ||
    envelope.flapColor !== expected.flapColor ||
    envelope.sealColor !== expected.sealColor
  )
  return (
    colorsDeviate ||
    (envelope.sealIcon && envelope.sealIcon !== 'monogram') ||
    (envelope.paperTexture && envelope.paperTexture !== 'smooth') ||
    (envelope.pacing && envelope.pacing !== 'normal') ||
    nonEmpty(envelope.recipientCaption)
  )
}

function bgFx(card) {
  return card?.animation?.backgroundEffect?.type || 'none'
}

// Each rule: { id, label, tier, test(card, ctx) => boolean, trim(clone, ctx) }
// `trim` mutates the deep-cloned card/ctx it's given (never the original).
const RULES = [
  // ── elite ──
  {
    id: 'music', label: 'Background music', tier: 'elite',
    test: (c) => !!c?.background?.music?.url,
    trim: (c) => { if (c.background?.music) { c.background.music.url = ''; c.background.music.isUploaded = false } },
  },
  {
    id: 'videoBg', label: 'Video background', tier: 'elite',
    test: (c) => c?.background?.type === 'video' && !!c?.background?.videoUrl,
    trim: (c) => { if (c.background) c.background.type = 'color' },
  },
  {
    id: 'animatedBg', label: 'Animated background', tier: 'elite',
    test: (c) => c?.background?.type === 'animated',
    trim: (c) => { if (c.background) c.background.type = 'color' },
  },
  {
    id: 'galaxyExperience', label: 'Galaxy experience', tier: 'elite',
    test: (c) => c?.experience?.type === 'galaxy',
    trim: (c) => { if (c.experience) c.experience.type = 'none' },
  },
  {
    id: 'openEffect', label: 'Opening effect', tier: 'elite',
    // Any non-'none' open effect is elite-only in practice — the backend
    // rejects openEffect on premium cards outright regardless of which
    // effect's own `tier` tag in studioEffects.js says (some are tagged
    // 'premium' there, which is only used for the Studio's picker gating).
    test: (c) => (c?.animation?.openEffect || 'none') !== 'none',
    trim: (c) => { if (c.animation) c.animation.openEffect = 'none' },
  },
  {
    id: 'media',
    label: (c) => {
      const n = c?.media?.images?.length || 0
      return `${n} photo${n === 1 ? '' : 's'}`
    },
    tier: 'elite',
    test: (c) => (c?.media?.images?.length || 0) > 0,
    trim: (c) => { if (c.media) c.media.images = [] },
  },
  {
    id: 'lock', label: 'Card lock', tier: 'elite',
    test: (c) => (c?.interaction?.lock?.type || 'none') !== 'none',
    trim: (c) => { if (c.interaction?.lock) c.interaction.lock = { type: 'none', value: '' } },
  },
  {
    id: 'question', label: 'Question block', tier: 'elite',
    test: (c) => nonEmpty(c?.questions?.items?.[0]?.text),
    trim: (c) => { if (c.questions) c.questions.items = [] },
  },
  {
    id: 'gift', label: 'Attached gift', tier: 'elite',
    test: (c) => !!c?.giftEffect?.enabled,
    trim: (c) => { if (c.giftEffect) c.giftEffect = { enabled: false, effectKey: 'none', giftTitle: '', giftAmount: '' } },
  },
  {
    id: 'animBorder', label: 'Animated border', tier: 'elite',
    test: (c) => c?.card?.cardBorder?.type === 'animated',
    trim: (c) => { if (c.card?.cardBorder) c.card.cardBorder.type = 'solid' },
  },
  {
    id: 'eliteAmbient', label: 'Elite ambient effect', tier: 'elite',
    test: (c) => AMBIENT_TIER[bgFx(c)] === 'elite',
    trim: (c) => { if (c.animation?.backgroundEffect) c.animation.backgroundEffect.type = 'none' },
  },
  {
    id: 'elitePalette', label: 'Elite palette', tier: 'elite',
    test: (c) => getPaletteById(c?.palette?.id)?.tier === 'elite',
    trim: () => {}, // color reset is redundant with customColors trim below
  },
  {
    id: 'customColors', label: 'Hand-picked colors', tier: 'elite',
    test: hasCustomColors,
    trim: () => {}, // intentionally left — re-applying a palette is a design act the sender should do explicitly
  },
  {
    id: 'eliteFont', label: 'Elite font', tier: 'elite',
    test: (c) => fontTier(c?.theme?.fontFamily) === 'elite',
    trim: (c) => { if (c.theme) c.theme.fontFamily = 'Cinzel' },
  },
  {
    id: 'envelope', label: 'Envelope signature touches', tier: 'elite',
    test: envelopeDeviates,
    trim: (c) => {
      const palette = getPaletteById(c?.palette?.id)
      const expected = expectedEnvelopeColors(palette)
      if (c.closedState?.envelope) {
        if (expected) Object.assign(c.closedState.envelope, expected)
        c.closedState.envelope.sealIcon = 'monogram'
        c.closedState.envelope.paperTexture = 'smooth'
        c.closedState.envelope.pacing = 'normal'
        c.closedState.envelope.recipientCaption = ''
      }
    },
  },
  {
    id: 'pollSize', label: 'More than 5 poll options', tier: 'elite',
    test: (c, ctx) => (ctx.pollData?.options?.filter(nonEmpty).length || 0) > 5,
    trim: (c, ctx) => { if (ctx.pollData) ctx.pollData.options = ctx.pollData.options.slice(0, 5) },
  },
  {
    id: 'triviaSize', label: 'More than 10 trivia questions', tier: 'elite',
    test: (c, ctx) => (ctx.triviaData?.questions?.length || 0) > 10,
    trim: (c, ctx) => { if (ctx.triviaData) ctx.triviaData.questions = ctx.triviaData.questions.slice(0, 10) },
  },
  {
    id: 'chainSize', label: 'More than 5 chain rules', tier: 'elite',
    test: (c, ctx) => (ctx.chainData?.rules?.length || 0) > 5,
    trim: (c, ctx) => { if (ctx.chainData?.rules) ctx.chainData.rules = ctx.chainData.rules.slice(0, 5) },
  },
  // ── premium (personal only — escalates to elite for every other type) ──
  {
    id: 'ambient', label: 'Ambient effect', tier: 'premium',
    test: (c) => AMBIENT_TIER[bgFx(c)] === 'premium',
    trim: (c) => { if (c.animation?.backgroundEffect) c.animation.backgroundEffect.type = 'none' },
  },
  {
    id: 'gradBorder', label: 'Gradient border', tier: 'premium',
    test: (c) => c?.card?.cardBorder?.type === 'gradient',
    trim: (c) => { if (c.card?.cardBorder) c.card.cardBorder.type = 'solid' },
  },
  {
    id: 'richBg', label: 'Gradient background', tier: 'premium',
    test: (c) => c?.background?.type === 'gradient',
    trim: (c) => { if (c.background) c.background.type = 'color' },
  },
  {
    id: 'premiumFont', label: 'Premium font', tier: 'premium',
    test: (c) => fontTier(c?.theme?.fontFamily) === 'premium',
    trim: (c) => { if (c.theme) c.theme.fontFamily = 'Cinzel' },
  },
  {
    id: 'typewriter', label: 'Typewriter text', tier: 'premium',
    test: (c) => Number(c?.card?.textBodyAnimation?.selfTypeSpeed) > 0,
    trim: (c) => { if (c.card?.textBodyAnimation) c.card.textBodyAnimation.selfTypeSpeed = 'none' },
  },
  {
    id: 'premiumPalette', label: 'Premium palette', tier: 'premium',
    test: (c) => getPaletteById(c?.palette?.id)?.tier === 'premium',
    trim: () => {},
  },
]

function safeTest(rule, card, ctx) {
  try {
    return !!rule.test(card, ctx)
  } catch {
    return false
  }
}

function labelFor(rule, card, ctx) {
  return typeof rule.label === 'function' ? rule.label(card, ctx) : rule.label
}

/**
 * Computes the tier a card actually requires from what's on it right now.
 * Artists are informational-only (always shown as elite/unlocked, never
 * charged — their flow is Publish, not Send).
 */
export function computeCardTier(cardObject, { type = 'personal', pollData = null, triviaData = null, chainData = null, isArtist = false } = {}) {
  if (isArtist) return { tier: 'elite', reasons: [] }
  const ctx = { type, pollData, triviaData, chainData }
  const reasons = RULES
    .filter((r) => safeTest(r, cardObject, ctx))
    .map((r) => ({
      id: r.id,
      label: labelFor(r, cardObject, ctx),
      // 3.2: premium used to be personal-only, so every other type escalated
      // straight to elite. Every type now has a real premium rung, so a
      // rule's own tier is used as-is.
      tier: r.tier,
    }))
  const tier = reasons.reduce((t, r) => (TIER_RANK[r.tier] > TIER_RANK[t] ? r.tier : t), 'classic')
  return { tier, reasons }
}

/**
 * Returns a deep-cloned, trimmed-down version of the card (+ typed content)
 * that computes to `targetTier` or below, plus the list of what got removed.
 * Not currently wired to any UI action (7.6 removed the "trim extras & send
 * free" button, once the tier meter made the live cost visible while
 * editing rather than only at send time) — kept as the tested primitive a
 * future trim-style action would build on.
 */
export function trimCardToTier(cardObject, targetTier, { type = 'personal', pollData = null, triviaData = null, chainData = null } = {}) {
  const clonedCard = structuredClone(cardObject)
  const ctx = {
    type,
    pollData: pollData ? structuredClone(pollData) : null,
    triviaData: triviaData ? structuredClone(triviaData) : null,
    chainData: chainData ? structuredClone(chainData) : null,
  }
  const removed = []
  const targetRank = TIER_RANK[targetTier] ?? 0

  // Apply every rule whose (possibly-escalated) tier exceeds the target,
  // repeating in case one trim exposes another (e.g. removing a palette
  // could theoretically change what "custom colors" sees on a later pass).
  for (let pass = 0; pass < 3; pass++) {
    let changed = false
    for (const r of RULES) {
      // 3.2: no more premium -> elite escalation for non-personal types.
      if (TIER_RANK[r.tier] <= targetRank) continue
      if (!safeTest(r, clonedCard, ctx)) continue
      const label = labelFor(r, clonedCard, ctx)
      r.trim(clonedCard, ctx)
      if (!safeTest(r, clonedCard, ctx)) {
        removed.push({ id: r.id, label, tier: r.tier })
        changed = true
      }
    }
    if (!changed) break
  }

  return {
    cardObject: clonedCard,
    pollData: ctx.pollData,
    triviaData: ctx.triviaData,
    chainData: ctx.chainData,
    removed,
  }
}
