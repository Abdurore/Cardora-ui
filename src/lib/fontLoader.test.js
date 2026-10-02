import { describe, it, expect, beforeEach } from 'vitest'
import { ensureFont, ensureFonts, FONT_PARAMS, __resetFontLoaderForTests } from './fontLoader.js'

const links = () => [...document.head.querySelectorAll('link[data-cardora-font]')]

describe('fontLoader', () => {
  beforeEach(() => {
    __resetFontLoaderForTests()
    links().forEach((l) => l.remove())
  })

  it('injects one stylesheet per family, once', () => {
    ensureFont('Lobster')
    ensureFont('Lobster')
    ensureFont('"Lobster", cursive')
    expect(links()).toHaveLength(1)
    expect(links()[0].href).toContain('family=Lobster')
    expect(links()[0].href).toContain('display=swap')
  })

  it('ignores unknown/system families', async () => {
    expect(await ensureFont('Comic Sans MS')).toBe(false)
    expect(await ensureFont(undefined)).toBe(false)
    expect(links()).toHaveLength(0)
  })

  it('dedupes a batch', () => {
    ensureFonts(['Inter', 'Inter', 'Lora', 'nope'])
    expect(links().map((l) => l.dataset.cardoraFont).sort()).toEqual(['Inter', 'Lora'])
  })

  it('covers the families the app chrome and cards rely on', () => {
    for (const f of ['Cinzel', 'Manrope', 'Great Vibes', 'Playfair Display']) expect(FONT_PARAMS[f]).toBeTruthy()
  })
})
