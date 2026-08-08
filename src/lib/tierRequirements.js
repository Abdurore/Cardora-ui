// Single source of truth for "what does this card cost and why" under the
// computed-tier model ("design free, pay at send"). No upfront tier choice —
// the sender uses whatever features they want and the tier/cost is derived
// live from what's actually on the card. Pips, the send receipt, and the
// "trim extras & send free" action all read this same rule list, so they can
// never drift from each other.
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
export const TIER_COST_BY_TYPE = {
  personal: { classic: 0, premium: 25, elite: 35 },
  poll: { classic: 0, premium: null, elite: 35 },
  trivia: { classic: 0, premium: null, elite: 50 },
  chain: { classic: 0, premium: null, elite: 40 },
  anonymous: { classic: 0, premium: null, elite: 45 },
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
  {
    id: 'anonMedia', label: 'Voice & photo replies', tier: 'elite',
    test: (c, ctx) => !!ctx.allowAnonMedia,
    trim: (c, ctx) => { ctx.allowAnonMedia = false },
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
    id: 'richBg', label: 'Animated background', tier: 'premium',
    test: (c) => ['gradient', 'animated'].includes(c?.background?.type),
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
export function computeCardTier(cardObject, { type = 'personal', pollData = null, triviaData = null, chainData = null, isArtist = false, allowAnonMedia = false } = {}) {
  if (isArtist) return { tier: 'elite', reasons: [] }
  const ctx = { type, pollData, triviaData, chainData, allowAnonMedia }
  const reasons = RULES
    .filter((r) => safeTest(r, cardObject, ctx))
    .map((r) => ({
      id: r.id,
      label: labelFor(r, cardObject, ctx),
      // Premium only exists for personal cards — every other type escalates
      // straight to elite (matches MainLayout.handleCreateCard's own
      // premium→elite normalization for non-personal types).
      tier: r.tier === 'premium' && type !== 'personal' ? 'elite' : r.tier,
    }))
  const tier = reasons.reduce((t, r) => (TIER_RANK[r.tier] > TIER_RANK[t] ? r.tier : t), 'classic')
  return { tier, reasons }
}

/**
 * Returns a deep-cloned, trimmed-down version of the card (+ typed content)
 * that computes to `targetTier` or below, plus the list of what got removed
 * — powers "Trim extras & send free" in the send receipt.
 */
export function trimCardToTier(cardObject, targetTier, { type = 'personal', pollData = null, triviaData = null, chainData = null, allowAnonMedia = false } = {}) {
  const clonedCard = structuredClone(cardObject)
  const ctx = {
    type,
    pollData: pollData ? structuredClone(pollData) : null,
    triviaData: triviaData ? structuredClone(triviaData) : null,
    chainData: chainData ? structuredClone(chainData) : null,
    allowAnonMedia,
  }
  const removed = []
  const targetRank = TIER_RANK[targetTier] ?? 0

  // Apply every rule whose (possibly-escalated) tier exceeds the target,
  // repeating in case one trim exposes another (e.g. removing a palette
  // could theoretically change what "custom colors" sees on a later pass).
  for (let pass = 0; pass < 3; pass++) {
    let changed = false
    for (const r of RULES) {
      const effectiveTier = r.tier === 'premium' && type !== 'personal' ? 'elite' : r.tier
      if (TIER_RANK[effectiveTier] <= targetRank) continue
      if (!safeTest(r, clonedCard, ctx)) continue
      const label = labelFor(r, clonedCard, ctx)
      r.trim(clonedCard, ctx)
      if (!safeTest(r, clonedCard, ctx)) {
        removed.push({ id: r.id, label, tier: effectiveTier })
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
    allowAnonMedia: ctx.allowAnonMedia,
    removed,
  }
}
