// Per-tier content caps. Sits alongside TOOLS_BY_TYPE_TIER (which controls tool
// visibility): a tool may be visible but its content capped here.
//
// - `content` tool is never limited — users always edit heading/body/extended text freely.
// - Artists bypass every cap (see getTierLimits({ isArtist: true })).
// - Classic is heavily capped because it's the free tier.
// - Only Personal + Chain cards render an envelope; other types skip straight to the card.

// Mirrors Backend/Cardora/src/cards/constants.js RESPONSE_LIMITS and
// Backend/Cardora/src/cards/schema.js CONTENT_LIMITS — keep in sync.
const CLASSIC = {
  maxResponses: 15,
  maxPollOptions: 5,
  maxChainRules: 5,
  maxTriviaQuestions: 10,
  maxImages: 1,
  allowMusic: false,
  allowVideoBackground: false,
  allowGradientBorder: false,
  allowAnimatedBorder: false,
  allowOpenEffects: false,
  allowAmbientEffects: false,
  allowCustomFonts: false,
  allowGifts: false,
  allowQuestions: false,
  allowTypewriter: false,
  allowFadeIn: true,
  allowCustomPalette: false, // Elite+ can hand-pick palette colors
  envelopeProfile: 'basic',
}

// The backend engine (Backend/Cardora/src/cards/engine.js
// `assertNoInvalidEnhancements`) hard-rejects premium cards that carry a
// video background, music, an openEffect, or any media — these four must
// stay false/0 here or the Studio UI offers controls the send will 400 on
// (or, before this was caught, silently drop with no warning at all).
const PREMIUM = {
  maxResponses: 30,
  maxPollOptions: 25,
  maxChainRules: 25,
  maxTriviaQuestions: 50,
  maxImages: 0,
  allowMusic: false,
  allowVideoBackground: false,
  allowGradientBorder: true,
  allowAnimatedBorder: false,
  allowOpenEffects: false,
  allowAmbientEffects: true,
  allowCustomFonts: true,
  allowGifts: false,
  allowQuestions: false,
  allowTypewriter: true,
  allowFadeIn: true,
  allowCustomPalette: false,
  envelopeProfile: 'premium',
}

const ELITE = {
  maxResponses: 50,
  maxPollOptions: 25,
  maxChainRules: 25,
  maxTriviaQuestions: 50,
  maxImages: 8,
  allowMusic: true,
  allowVideoBackground: true,
  allowGradientBorder: true,
  allowAnimatedBorder: true,
  allowOpenEffects: true,
  allowAmbientEffects: true,
  allowCustomFonts: true,
  allowGifts: true,
  allowQuestions: true,
  allowTypewriter: true,
  allowFadeIn: true,
  allowCustomPalette: true,
  envelopeProfile: 'elite',
}

const ARTIST = {
  maxResponses: Infinity,
  maxPollOptions: Infinity,
  maxChainRules: Infinity,
  maxTriviaQuestions: Infinity,
  maxImages: Infinity,
  allowMusic: true,
  allowVideoBackground: true,
  allowGradientBorder: true,
  allowAnimatedBorder: true,
  allowOpenEffects: true,
  allowAmbientEffects: true,
  allowCustomFonts: true,
  allowGifts: true,
  allowQuestions: true,
  allowTypewriter: true,
  allowFadeIn: true,
  allowCustomPalette: true,
  envelopeProfile: 'elite',
}

export const TIER_LIMITS = { classic: CLASSIC, premium: PREMIUM, elite: ELITE }

// Personal cards keep the envelope reveal. Poll, Trivia, Chain, Anonymous skip straight to content.
const ENVELOPE_TYPES = new Set(['personal'])

export function shouldShowEnvelope(studioType) {
  return ENVELOPE_TYPES.has(studioType)
}

export function getTierLimits(tier, { isArtist = false } = {}) {
  if (isArtist) return ARTIST
  return TIER_LIMITS[tier] || CLASSIC
}
