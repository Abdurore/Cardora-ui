// Per-tier content caps. Sits alongside TOOLS_BY_TYPE_TIER (which controls tool
// visibility): a tool may be visible but its content capped here.
//
// - `content` tool is never limited — users always edit heading/body/extended text freely.
// - Artists bypass every cap (see getTierLimits({ isArtist: true })).
// - Classic is heavily capped because it's the free tier.
// - Only Personal + Chain cards render an envelope; other types skip straight to the card.

const CLASSIC = {
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

const PREMIUM = {
  maxImages: 3,
  allowMusic: true,
  allowVideoBackground: true,
  allowGradientBorder: true,
  allowAnimatedBorder: false,
  allowOpenEffects: true,
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

// Personal + Chain are the narrative formats — they keep the envelope reveal.
// Poll, Trivia, Anonymous jump straight to content (no envelope metaphor).
const ENVELOPE_TYPES = new Set(['personal', 'chain'])

export function shouldShowEnvelope(studioType) {
  return ENVELOPE_TYPES.has(studioType)
}

export function getTierLimits(tier, { isArtist = false } = {}) {
  if (isArtist) return ARTIST
  return TIER_LIMITS[tier] || CLASSIC
}
