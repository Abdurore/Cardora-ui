import { describe, it, expect, vi } from 'vitest'
import {
  cardObjectToBackendPayload,
  backendCardToCardObject,
  unwrapData,
  getResponseMessage,
  resolveBalance,
  mapBackendCard,
  mapCouponPackage,
  mapTemplateToCard,
} from './backendMappers.js'
import { defaultCardObject } from '../data/cardDefaults.js'
import { applyPalette } from './palettes.js'

// backendMappers is the only translator between the client `cardObject` and the
// backend's { config, enhancements, layoutdata } payload, in both directions.
// Every rename and clamp below mirrors a real Joi rule in
// Backend/Cardora/src/cards/schema.js — and every one of them corresponds to a
// bug that already shipped once (see the "Common AI mistakes" list in
// CLAUDE.md). A regression here is a 400 on send, or a card that renders with
// the wrong colours for the recipient.

function card(overrides = {}) {
  return { ...structuredClone(defaultCardObject), ...overrides }
}

describe('cardObjectToBackendPayload — config.colors', () => {
  it('maps palette anchors onto the backend colour slots', () => {
    // applyPalette() is what Studio actually calls when a palette chip is
    // picked -- it seeds card.backgroundColor/theme.accentColor from the
    // palette, exactly like the real app. Setting c.palette directly without
    // that step doesn't represent anything the app produces.
    let c = card()
    c = applyPalette(c, { primary: '#ff0000', accent: '#00ff00', surface: '#123456', ink: '#ffffff' })
    c.background.colors = []
    const { config } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'classic' })

    // palette.surface → colors.background, palette.primary → accent + gradient[0],
    // palette.accent → gradient[1]. palette.ink is deliberately NOT stored.
    expect(config.colors.background).toBe('#123456')
    expect(config.colors.accent).toBe('#ff0000')
    expect(config.colors.gradient[0]).toBe('#ff0000')
    expect(config.colors.gradient[1]).toBe('#00ff00')
    expect(config.colors).not.toHaveProperty('ink')
  })

  it('prefers a hand-picked Card Background over a stale palette anchor', () => {
    // Studio's "Card Style" panel writes card.backgroundColor directly via a
    // plain path-setter that never touches cardObject.palette
    // (CardStudio.jsx's `update()`). So once a sender hand-picks a background
    // after applying a palette, palette.surface goes stale while
    // card.backgroundColor (what the Studio preview actually renders) holds
    // the true current value. The payload sent to the backend must match
    // what the sender saw in Studio, not the palette's original seed colour.
    let c = card()
    c = applyPalette(c, { primary: '#ff0000', accent: '#00ff00', surface: '#123456', ink: '#ffffff' })
    c.background.colors = []
    c.card.backgroundColor = '#654321'
    const { config } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'classic' })

    expect(config.colors.background).toBe('#654321')
  })

  it('always emits exactly two gradient stops, never two identical ones', () => {
    // colorSchema requires array.length(2); the backend also renders a visible
    // gradient, so two identical stops would be a flat block.
    const c = card()
    c.palette = { primary: '#abcdef', accent: '#abcdef', surface: '#111111' }
    c.background.colors = []
    const { config } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'classic' })

    expect(config.colors.gradient).toHaveLength(2)
    expect(config.colors.gradient[0]).not.toBe(config.colors.gradient[1])
  })

  it('falls back to safe colours for a null cardObject instead of throwing', () => {
    const payload = cardObjectToBackendPayload(null)
    expect(payload.config.colors.gradient).toHaveLength(2)
    expect(payload.enhancements).toEqual({})
  })
})

describe('cardObjectToBackendPayload — tier gating', () => {
  it('sends an empty enhancements object for classic', () => {
    // The engine stringifies and compares: anything non-default is rejected.
    const c = card()
    c.background.music.url = 'https://cdn.example.com/song.mp3'
    c.animation.openEffect = 'confetti'
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'classic' })
    expect(enhancements).toEqual({})
  })

  it('withholds music, openEffect and media from premium', () => {
    const c = card()
    c.background.music.url = 'https://cdn.example.com/song.mp3'
    c.animation.openEffect = 'confetti'
    c.media.images = [{ url: 'https://cdn.example.com/a.png' }]
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'premium' })

    expect(enhancements.music).toBeUndefined()
    expect(enhancements.openEffect).toBeUndefined()
    expect(enhancements.media).toBeUndefined()
    expect(enhancements.background).toBeDefined()
  })

  it('downgrades a video background to animated below elite', () => {
    const c = card()
    c.background.type = 'video'
    c.background.videoUrl = 'https://cdn.example.com/clip.mp4'
    const premium = cardObjectToBackendPayload(c, { type: 'personal', tier: 'premium' })
    const elite = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })

    expect(premium.enhancements.background.type).toBe('animated')
    expect(elite.enhancements.background.type).toBe('video')
  })
})

describe('cardObjectToBackendPayload — renames and clamps', () => {
  it("renames the lock type 'time' to the backend's 'timer'", () => {
    const c = card()
    c.interaction.lock = { type: 'time', value: '2030-01-01T00:00:00.000Z' }
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    expect(enhancements.lock.type).toBe('timer')
    expect(enhancements.lock.value).toBe('2030-01-01T00:00:00.000Z')
  })

  it('never emits an empty value for an active lock', () => {
    // password/timer with an empty value fails the backend's custom validator.
    const c = card()
    c.interaction.lock = { type: 'password', value: '   ' }
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    expect(enhancements.lock.value.length).toBeGreaterThan(0)
  })

  it("uses an empty value for locks that aren't enforced server-side", () => {
    const c = card()
    c.interaction.lock = { type: 'tap', value: '' }
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    expect(enhancements.lock).toEqual({ type: 'tap', value: '' })
  })

  it('rejects an unknown lock type rather than passing it through', () => {
    const c = card()
    c.interaction.lock = { type: 'fingerprint', value: 'x' }
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    expect(enhancements.lock.type).toBe('none')
  })

  it("renames music.url to music.track", () => {
    const c = card()
    c.background.music = { url: 'https://cdn.example.com/song.mp3', volume: 0.5 }
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    expect(enhancements.music).toEqual({ track: 'https://cdn.example.com/song.mp3', volume: 0.5 })
    expect(enhancements.music).not.toHaveProperty('url')
  })

  it('emits exactly three non-empty openEffect colours', () => {
    // colorSchema is min(1) per entry and the array is length(3) — empty
    // strings from an unset picker used to 400 the whole send.
    const c = card()
    c.animation.openEffect = 'confetti'
    c.animation.confettiColors = ['', '  ', '#ff0000']
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })

    expect(enhancements.openEffect.colors).toHaveLength(3)
    for (const colour of enhancements.openEffect.colors) {
      expect(colour.trim().length).toBeGreaterThan(0)
    }
    expect(enhancements.openEffect.colors[2]).toBe('#ff0000')
  })

  it('maps studio-only open effects onto backend enum values', () => {
    const c = card()
    c.animation.openEffect = 'hearts'
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    expect(enhancements.openEffect.type).toBe('heartsBurst')
  })

  it('drops media URLs the backend cannot accept', () => {
    // media[].url is Joi.uri() — blob:/file: from an un-flushed local upload fail.
    const c = card()
    c.media.images = [
      { url: 'blob:http://localhost:5173/8f0e' },
      { url: 'file:///C:/tmp/a.png' },
      { url: '' },
      { url: 'https://cdn.example.com/real.png' },
    ]
    const { enhancements } = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    expect(enhancements.media).toEqual([{ type: 'image', url: 'https://cdn.example.com/real.png' }])
  })
})

describe('cardObjectToBackendPayload — per-type content', () => {
  it('drops poll options with empty text and assigns ids', () => {
    const c = card()
    const poll = { question: 'Best colour?', options: [{ text: 'Red' }, { text: '   ' }, { text: 'Blue' }] }
    const { config } = cardObjectToBackendPayload(c, { type: 'poll', tier: 'classic', poll })

    expect(config.content.options).toHaveLength(2)
    expect(config.content.options.map(o => o.text)).toEqual(['Red', 'Blue'])
    for (const o of config.content.options) expect(o.id).toBeTruthy()
  })

  it('drops empty chain rules', () => {
    const c = card()
    const chain = { prompt: 'Keep it going', rules: ['Be kind', '', '   ', 'Tag a friend'] }
    const { config } = cardObjectToBackendPayload(c, { type: 'chain', tier: 'classic', chain })
    expect(config.content.rules).toEqual(['Be kind', 'Tag a friend'])
  })

  it('drops trivia questions with fewer than two options', () => {
    const c = card()
    const trivia = {
      questions: [
        { text: 'Only one option', options: ['a'], correctIndex: 0 },
        { text: 'Valid', options: ['a', 'b'], correctIndex: 1 },
        { text: '', options: ['a', 'b'], correctIndex: 0 },
      ],
    }
    const { config } = cardObjectToBackendPayload(c, { type: 'trivia', tier: 'classic', trivia })
    expect(config.content.questions).toHaveLength(1)
    expect(config.content.questions[0].question).toBe('Valid')
  })

  it('clamps correctIndex into range', () => {
    // The backend has a custom validator: correctIndex must be < options.length.
    const c = card()
    const trivia = {
      questions: [
        { text: 'Out of range', options: ['a', 'b'], correctIndex: 7 },
        { text: 'Not a number', options: ['a', 'b'], correctIndex: 'nope' },
        { text: 'Negative', options: ['a', 'b'], correctIndex: -3 },
      ],
    }
    const { config } = cardObjectToBackendPayload(c, { type: 'trivia', tier: 'classic', trivia })
    const indexes = config.content.questions.map(q => q.correctIndex)
    expect(indexes).toEqual([1, 0, 0])
    for (const q of config.content.questions) {
      expect(q.correctIndex).toBeLessThan(q.options.length)
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
    }
  })

  it('sends a top-level name for interactive types only', () => {
    const c = card()
    c.content.heading = 'My Poll'
    const poll = cardObjectToBackendPayload(c, {
      type: 'poll', tier: 'classic', poll: { question: 'Q?', options: [{ text: 'a' }, { text: 'b' }] },
    })
    const personal = cardObjectToBackendPayload(c, { type: 'personal', tier: 'classic' })

    expect(poll.name).toBeTruthy()
    expect(personal.name).toBeUndefined()
  })

  it('treats moment/standard as personal', () => {
    const c = card()
    c.content.heading = 'Hello'
    c.content.body = 'There'
    const { config } = cardObjectToBackendPayload(c, { type: 'moment', tier: 'classic' })
    expect(config.content.header).toBe('Hello')
    expect(config.content.body).toBe('There')
  })

  it('attaches a gift only on personal cards, under a single key', () => {
    // The schema uses .oxor("giftInventoryId", "inventoryId") — sending both 400s.
    const c = card()
    c.giftEffect = { enabled: true, giftInventoryId: 'inv_123' }
    const personal = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    const poll = cardObjectToBackendPayload(c, {
      type: 'poll', tier: 'elite', poll: { question: 'Q?', options: [{ text: 'a' }, { text: 'b' }] },
    })

    expect(personal.giftInventoryId).toBe('inv_123')
    expect(personal.inventoryId).toBeUndefined()
    expect(poll.giftInventoryId).toBeUndefined()
  })

  it('never emits fields the backend rejects under allowUnknown: false', () => {
    const c = card()
    c.giftEffect = { enabled: true, giftInventoryId: 'inv_1' }
    const payload = cardObjectToBackendPayload(c, { type: 'personal', tier: 'elite' })
    const allowed = new Set([
      'id', 'name', 'type', 'tier', 'config', 'enhancements', 'layoutdata',
      'state', 'giftInventoryId', 'inventoryId', 'meta',
    ])
    for (const key of Object.keys(payload)) expect(allowed).toContain(key)
  })
})

describe('backendCardToCardObject — reconstruction', () => {
  const backendCard = {
    config: {
      colors: { background: '#101010', accent: '#ff0000', gradient: ['#ff0000', '#00ff00'] },
      font: 'Cinzel',
      content: { header: 'Hi', body: 'There', questionBlock: { enabled: false } },
    },
    enhancements: {
      background: { type: 'color', value: '#101010' },
      lock: { type: 'timer', value: '2030-01-01T00:00:00.000Z' },
    },
    layoutdata: {},
  }

  it('rebuilds theme.accentColor from gradient[1], not colors.accent', () => {
    // colors.accent is palette.primary (headings/borders); the button/seal
    // colour is palette.accent, which lives in gradient[1]. Reading the wrong
    // one silently recoloured every recipient's buttons.
    const obj = backendCardToCardObject(backendCard)
    expect(obj.theme.accentColor).toBe('#00ff00')
  })

  it("renames the backend's 'timer' lock back to the studio's 'time'", () => {
    const obj = backendCardToCardObject(backendCard)
    expect(obj.interaction.lock.type).toBe('time')
  })

  it('derives readable text colour from background luminance', () => {
    const onLight = backendCardToCardObject({
      ...backendCard,
      config: { ...backendCard.config, colors: { ...backendCard.config.colors, background: '#fffbe6' } },
    })
    const onDark = backendCardToCardObject(backendCard)

    expect(onLight.theme.textColor).not.toBe(onDark.theme.textColor)
    expect(onLight.theme.textColor.toLowerCase()).not.toBe('#ffffff')
  })

  it('survives the fields the backend strips before sending to a recipient', () => {
    // sanitizeCardForClient removes lock.value for password locks and
    // correctIndex from every trivia question.
    const sanitized = {
      config: {
        colors: { background: '#101010', accent: '#ff0000', gradient: ['#ff0000', '#00ff00'] },
        content: { questions: [{ question: 'Q?', options: ['a', 'b'] }] },
      },
      enhancements: { lock: { type: 'password' } },
      layoutdata: {},
    }
    expect(() => backendCardToCardObject(sanitized)).not.toThrow()
    const obj = backendCardToCardObject(sanitized)
    expect(obj.interaction.lock.type).toBe('password')
  })

  it('returns a usable default object for a null card', () => {
    const obj = backendCardToCardObject(null)
    expect(obj.theme).toBeDefined()
    expect(obj.card).toBeDefined()
  })
})

describe('round trip', () => {
  it('preserves the sender\'s palette through send and re-fetch', () => {
    const c = card()
    c.palette = { primary: '#ff0000', accent: '#00ff00', surface: '#123456', ink: '#ffffff' }
    c.background.colors = []

    const payload = cardObjectToBackendPayload(c, { type: 'personal', tier: 'classic' })
    const rebuilt = backendCardToCardObject({ ...payload, layoutdata: payload.layoutdata })

    // primary drives heading emphasis; accent drives buttons/seal.
    expect(rebuilt.theme.accentColor).toBe('#00ff00')
  })
})

describe('mapTemplateToCard — Explore/Marketplace consolidation', () => {
  it('carries price, lock state, and Founding Artist status through for the Explore grid', () => {
    const mapped = mapTemplateToCard({
      id: 'tmpl-1', name: 'Sunset Birthday', category: 'birthday',
      price: 8, isLocked: true, isUnlocked: false, isFoundingArtist: true,
      artistName: 'Ada', artistAvatar: 'https://x/avatar.png',
    })
    expect(mapped.price).toBe(8)
    expect(mapped.isLocked).toBe(true)
    expect(mapped.isUnlocked).toBe(false)
    expect(mapped.isFoundingArtist).toBe(true)
  })

  it('defaults a free template to unlocked with no Founding Artist badge', () => {
    const mapped = mapTemplateToCard({ id: 'tmpl-2', name: 'Free One', category: 'birthday', price: 0 })
    expect(mapped.price).toBe(0)
    expect(mapped.isUnlocked).toBe(true)
    expect(mapped.isFoundingArtist).toBe(false)
  })
})

describe('response envelope tolerance', () => {
  it('unwraps a data-wrapped payload but leaves a flat one alone', () => {
    expect(unwrapData({ data: { id: 1 } })).toEqual({ id: 1 })
    expect(unwrapData({ id: 1 })).toEqual({ id: 1 })
    expect(unwrapData(null)).toBeNull()
  })

  it('finds a message wherever the backend puts it', () => {
    expect(getResponseMessage({ message: 'a' })).toBe('a')
    expect(getResponseMessage({ data: { message: 'b' } })).toBe('b')
    expect(getResponseMessage({}, 'fallback')).toBe('fallback')
  })
})

// Phase 2.1: the backend's CC balance contract is frozen on `cc`, always an
// absolute integer, across every endpoint that returns one.
describe('resolveBalance', () => {
  it('reads the canonical cc field', () => {
    expect(resolveBalance({ cc: 42 })).toBe(42)
  })

  it('checks every source in order, still preferring cc over a legacy key', () => {
    expect(resolveBalance({ balance: 99 }, { cc: 7 })).toBe(7)
  })

  it('warns and falls back to a legacy key when cc is absent from every source', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveBalance({ couponBalance: 15 })).toBe(15)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('returns 0 and never throws when nothing matches', () => {
    expect(resolveBalance({}, null, undefined, { unrelated: 1 })).toBe(0)
  })
})

// Phase 2.2: every card-returning endpoint puts `slug` at the top level of
// the card object.
// 6.4: Chain Card terminal recipient + unlock condition rides in
// layoutdata.styleExtras.chainTerminal -- the exact path the backend reads
// (createCardInternal's bounds check, getCardBySlug/checkChainDateUnlocks).
describe('cardObjectToBackendPayload — chain terminal recipient (6.4)', () => {
  it('sends chainTerminal when the originator turned it on and named a recipient', () => {
    const c = card()
    const { layoutdata } = cardObjectToBackendPayload(c, {
      type: 'chain',
      tier: 'classic',
      chain: {
        prompt: 'Add your memory',
        terminal: { enabled: true, recipientName: 'Ada', recipientEmail: 'ada@example.com', unlockType: 'count', unlockCount: '5' },
      },
    })
    expect(layoutdata.styleExtras.chainTerminal).toEqual({
      recipientName: 'Ada',
      recipientEmail: 'ada@example.com',
      unlockType: 'count',
      unlockAt: undefined,
      unlockCount: 5,
    })
  })

  it('omits chainTerminal entirely when the toggle is off', () => {
    const c = card()
    const { layoutdata } = cardObjectToBackendPayload(c, {
      type: 'chain',
      tier: 'classic',
      chain: { prompt: 'Add your memory', terminal: { enabled: false, recipientName: '', unlockType: 'count', unlockCount: 5 } },
    })
    expect(layoutdata.styleExtras?.chainTerminal).toBeUndefined()
  })

  it('omits chainTerminal when enabled but no recipient name was given', () => {
    // Sending an obviously-incomplete config is pointless -- the backend's
    // own bounds check would reject it anyway ("recipient name required").
    const c = card()
    const { layoutdata } = cardObjectToBackendPayload(c, {
      type: 'chain',
      tier: 'classic',
      chain: { prompt: 'Add your memory', terminal: { enabled: true, recipientName: '   ', unlockType: 'count', unlockCount: 5 } },
    })
    expect(layoutdata.styleExtras?.chainTerminal).toBeUndefined()
  })

  it('sends the date field, not the count field, for a date-based unlock', () => {
    const c = card()
    const { layoutdata } = cardObjectToBackendPayload(c, {
      type: 'chain',
      tier: 'classic',
      chain: { prompt: 'x', terminal: { enabled: true, recipientName: 'Ada', unlockType: 'date', unlockAt: '2030-01-01T00:00:00.000Z', unlockCount: 5 } },
    })
    expect(layoutdata.styleExtras.chainTerminal.unlockAt).toBe('2030-01-01T00:00:00.000Z')
    expect(layoutdata.styleExtras.chainTerminal.unlockCount).toBeUndefined()
  })

  it('never sends chainTerminal for a non-chain type even if terminal data is present', () => {
    const c = card()
    const { layoutdata } = cardObjectToBackendPayload(c, {
      type: 'personal',
      tier: 'elite',
      chain: { terminal: { enabled: true, recipientName: 'Ada', unlockType: 'count', unlockCount: 5 } },
    })
    expect(layoutdata.styleExtras?.chainTerminal).toBeUndefined()
  })
})

describe('mapBackendCard — chain terminal + delivery status (6.4)', () => {
  function chainBackendCard(overrides = {}) {
    return {
      slug: 'chain-1',
      type: 'chain',
      config: { content: { challenge: 'Add your memory', rules: [] } },
      enhancements: {},
      layoutdata: {},
      ...overrides,
    }
  }

  it('surfaces chainTerminal from layoutdata.styleExtras onto chain.terminal', () => {
    const terminal = { recipientName: 'Ada', unlockType: 'count', unlockCount: 5 }
    const mapped = mapBackendCard(chainBackendCard({ layoutdata: { styleExtras: { chainTerminal: terminal } } }))
    expect(mapped.chain.terminal).toEqual(terminal)
  })

  it('chain.terminal is null when no terminal was ever set', () => {
    const mapped = mapBackendCard(chainBackendCard())
    expect(mapped.chain.terminal).toBeNull()
  })

  it('surfaces chainDelivered at the top level', () => {
    const delivered = mapBackendCard(chainBackendCard({ chainDelivered: true }))
    const notDelivered = mapBackendCard(chainBackendCard())
    expect(delivered.chainDelivered).toBe(true)
    expect(notDelivered.chainDelivered).toBe(false)
  })
})

describe('mapBackendCard slug resolution', () => {
  it('uses the top-level slug without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mapped = mapBackendCard({ slug: 'abc123', type: 'personal', config: {}, enhancements: {} })
    expect(mapped.slug).toBe('abc123')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('warns and falls back to _id/cardId when slug is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mapped = mapBackendCard({ _id: 'legacy-id', type: 'personal', config: {}, enhancements: {} })
    expect(mapped.slug).toBe('legacy-id')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

// 3.1: "display the effective per-CC rate and badge on every tile."
describe('mapCouponPackage', () => {
  it('computes the effective per-CC rate', () => {
    const mapped = mapCouponPackage({ packageId: 'p1', name: 'Popular Pack', numberOfCC: 70, price: 2500, priceCurrency: 'NGN' })
    expect(mapped.effectiveRate).toBe('NGN 35.71/CC')
  })

  it('uses the package\'s own badge text, not a generic "Featured" label', () => {
    const mapped = mapCouponPackage({ packageId: 'p1', name: 'Popular Pack', numberOfCC: 70, price: 2500, priceCurrency: 'NGN', badge: 'POPULAR', featured: true })
    expect(mapped.bonus).toBe('POPULAR')
  })

  it('falls back to "Featured" for a legacy package with no badge', () => {
    const mapped = mapCouponPackage({ packageId: 'p1', name: 'Old Pack', numberOfCC: 100, price: 4000, priceCurrency: 'NGN', featured: true })
    expect(mapped.bonus).toBe('Featured')
  })
})
