import { describe, it, expect } from 'vitest'
import { computeCardTier, trimCardToTier, computeFeatureSurcharges, getCardTotalCost } from './tierRequirements.js'
import { defaultCardObject } from '../data/cardDefaults.js'

// `computeCardTier` is the single source of truth for what a card costs and
// why (see the file header) — it drives the tier meter, the send receipt,
// and "trim extras & send free". Getting it wrong either overcharges every
// sender or lets paid features through for free, so it's the most
// consequential piece of logic in the app to leave untested.

function freshCard() {
  return structuredClone(defaultCardObject)
}

describe('computeCardTier', () => {
  it('computes classic with no reasons for an untouched dark-baseline draft', () => {
    const { tier, reasons } = computeCardTier(freshCard(), { type: 'personal' })
    expect(tier).toBe('classic')
    expect(reasons).toEqual([])
  })

  it('does NOT flag a light-mode baseline draft as hand-picked colors', () => {
    // Regression test for the bug documented in CLAUDE.md: a blank draft's
    // starting colors depend on the viewer's own site theme at creation
    // time. Comparing only against the dark baseline (or against mere
    // truthiness) flags every fresh light-mode card as a paid feature.
    const card = freshCard()
    card.card.backgroundColor = '#ffffff'
    card.card.textColor = '#111111'
    card.card.headingColor = '#000000'
    const { tier, reasons } = computeCardTier(card, { type: 'personal' })
    expect(tier).toBe('classic')
    expect(reasons.find((r) => r.id === 'customColors')).toBeUndefined()
  })

  it('flags genuinely hand-picked colors as elite', () => {
    const card = freshCard()
    card.card.backgroundColor = '#ff00ff'
    const { tier, reasons } = computeCardTier(card, { type: 'personal' })
    expect(tier).toBe('elite')
    expect(reasons.some((r) => r.id === 'customColors')).toBe(true)
  })

  it('flags background music as elite regardless of type', () => {
    const card = freshCard()
    card.background.music.url = 'https://example.com/track.mp3'
    const { tier, reasons } = computeCardTier(card, { type: 'personal' })
    expect(tier).toBe('elite')
    expect(reasons.some((r) => r.id === 'music')).toBe(true)
  })

  it('flags any non-none open effect as elite', () => {
    const card = freshCard()
    card.animation.openEffect = 'confetti'
    const { tier } = computeCardTier(card, { type: 'personal' })
    expect(tier).toBe('elite')
  })

  it('is always elite with no reasons for artists, regardless of content', () => {
    const card = freshCard()
    const { tier, reasons } = computeCardTier(card, { type: 'personal', isArtist: true })
    expect(tier).toBe('elite')
    expect(reasons).toEqual([])
  })

  it('keeps a premium-tagged reason at premium for a personal card', () => {
    const card = freshCard()
    card.card.cardBorder.type = 'gradient'
    const { tier, reasons } = computeCardTier(card, { type: 'personal' })
    expect(tier).toBe('premium')
    expect(reasons.find((r) => r.id === 'gradBorder')?.tier).toBe('premium')
  })

  it('does not escalate a premium-tagged reason for non-personal types (3.2: every type has a real premium rung)', () => {
    const card = freshCard()
    card.card.cardBorder.type = 'gradient'
    const { tier, reasons } = computeCardTier(card, { type: 'poll' })
    expect(tier).toBe('premium')
    expect(reasons.find((r) => r.id === 'gradBorder')?.tier).toBe('premium')
  })

  it('flags the galaxy experience as elite', () => {
    const card = freshCard()
    card.experience.type = 'galaxy'
    const { tier, reasons } = computeCardTier(card, { type: 'personal' })
    expect(tier).toBe('elite')
    expect(reasons.some((r) => r.id === 'galaxyExperience')).toBe(true)
  })

  it('trims the galaxy experience back to free', () => {
    const card = freshCard()
    card.experience.type = 'galaxy'
    const trimmed = trimCardToTier(card, 'classic', { type: 'personal' })
    expect(trimmed.cardObject.experience.type).toBe('none')
    expect(computeCardTier(trimmed.cardObject, { type: 'personal' }).tier).toBe('classic')
  })
})

// 3.2: additive surcharges on top of the base tier cost. Mirrors
// Backend/Cardora tests/card.engine.test.js's "3.2 feature surcharges" —
// keep the two in sync.
describe('computeFeatureSurcharges', () => {
  it('charges nothing for a plain card', () => {
    expect(computeFeatureSurcharges(freshCard(), { type: 'personal' }).total).toBe(0)
  })

  it('does not charge for the first photo, only photos beyond it', () => {
    const card = freshCard()
    card.media.images = ['a.jpg']
    expect(computeFeatureSurcharges(card, { type: 'personal' }).total).toBe(0)

    card.media.images = ['a.jpg', 'b.jpg', 'c.jpg']
    const { total, breakdown } = computeFeatureSurcharges(card, { type: 'personal' })
    expect(total).toBe(2) // 2 extra photos * 1 CC
    expect(breakdown[0].id).toBe('additionalPhoto')
  })

  it('charges for music, lock, question block, and galaxy independently', () => {
    const card = freshCard()
    card.background.music.url = 'https://example.com/song.mp3'
    card.interaction.lock.type = 'password'
    card.questions.items = [{ text: 'Will you?' }]
    card.experience.type = 'galaxy'

    const { total, breakdown } = computeFeatureSurcharges(card, { type: 'personal' })
    expect(total).toBe(2 + 2 + 2 + 8) // music + lock + questionBlock + galaxy
    expect(breakdown.map((b) => b.id).sort()).toEqual(
      ['galaxyExperience', 'lock', 'music', 'questionBlock'].sort(),
    )
  })

  it('does not charge for a question block on non-personal types', () => {
    const card = freshCard()
    card.questions.items = [{ text: 'Will you?' }]
    expect(computeFeatureSurcharges(card, { type: 'poll' }).total).toBe(0)
  })

  it('charges for a premium-tier font as "premium theme"', () => {
    const card = freshCard()
    card.theme.fontFamily = 'Lora' // premium-only font
    expect(computeFeatureSurcharges(card, { type: 'personal' }).total).toBe(2)
  })
})

describe('getCardTotalCost', () => {
  it('adds the base tier cost and feature surcharges together', () => {
    const card = freshCard()
    card.experience.type = 'galaxy'
    const total = getCardTotalCost(card, 'elite', 'personal', null, { type: 'personal' })
    expect(total).toBe(20 + 8) // elite personal base + galaxy surcharge
  })

  it('classic cards with no surcharge-triggering features cost 0', () => {
    const total = getCardTotalCost(freshCard(), 'classic', 'personal', null, { type: 'personal' })
    expect(total).toBe(0)
  })
})
