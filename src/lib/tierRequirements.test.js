import { describe, it, expect } from 'vitest'
import { computeCardTier } from './tierRequirements.js'
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

  it('escalates a premium-tagged reason to elite for non-personal types', () => {
    // Premium only exists for personal cards — every other type escalates
    // (matches MainLayout.handleCreateCard's own premium->elite normalization).
    const card = freshCard()
    card.card.cardBorder.type = 'gradient'
    const { tier, reasons } = computeCardTier(card, { type: 'poll' })
    expect(tier).toBe('elite')
    expect(reasons.find((r) => r.id === 'gradBorder')?.tier).toBe('elite')
  })
})
