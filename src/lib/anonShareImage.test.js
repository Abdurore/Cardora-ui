import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateAnonShareImage, shareOrDownloadAnonImage } from './anonShareImage.js'

// 6.6: "Auto-generate a 1080x1920 share image... prompt text in the
// display serif, themed background, short link legible at thumbnail size,
// owner's display name." html2canvas is mocked -- jsdom has no real canvas
// rasteriser -- so these tests cover the DOM template it's asked to
// capture (colors, link, prompt text, cleanup) rather than the actual
// pixels.

let capturedContainer = null
const fakeBlob = new Blob(['fake-png-bytes'], { type: 'image/png' })

// jsdom's CSSOM normalizes a hex string assigned to `el.style.X` into
// `rgb(...)` on read-back (real browsers do the same for computed styles)
// -- a literal `#rrggbb` substring check on `.style.background` would
// never match, regardless of which color was actually used.
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

vi.mock('html2canvas', () => ({
  default: vi.fn(async (container) => {
    capturedContainer = container
    return {
      toBlob: (cb) => cb(fakeBlob),
    }
  }),
}))

describe('generateAnonShareImage', () => {
  afterEach(() => {
    capturedContainer = null
  })

  it('renders the prompt text, the /ask/:username link, and the byline', async () => {
    await generateAnonShareImage({ prompt: 'What do you really think of me?', username: 'ada' })

    expect(capturedContainer.innerHTML).toContain('What do you really think of me?')
    expect(capturedContainer.innerHTML).toContain('/ask/ada')
    expect(capturedContainer.innerHTML).toContain('from @ada')
  })

  it('is sized at exactly 1080x1920', async () => {
    await generateAnonShareImage({ prompt: 'Ask away', username: 'ada' })

    expect(capturedContainer.style.width).toBe('1080px')
    expect(capturedContainer.style.height).toBe('1920px')
  })

  it('uses the given theme colors when valid hex values are provided', async () => {
    await generateAnonShareImage({ prompt: 'Ask away', username: 'ada', colors: { background: '#112233', accent: '#ff00aa' } })

    expect(capturedContainer.style.backgroundColor).toBe(hexToRgb('#112233'))
    expect(capturedContainer.innerHTML).toContain('#ff00aa')
  })

  it('falls back to Cardora defaults for missing or invalid colors', async () => {
    await generateAnonShareImage({ prompt: 'Ask away', username: 'ada', colors: { background: 'not-a-color', accent: '' } })

    expect(capturedContainer.style.backgroundColor).toBe(hexToRgb('#0b0f12'))
    expect(capturedContainer.innerHTML).toContain('#7ef7ff')
  })

  it('uses the given display font for the prompt text', async () => {
    await generateAnonShareImage({ prompt: 'Ask away', username: 'ada', fontFamily: 'Playfair Display' })

    expect(capturedContainer.innerHTML).toContain("'Playfair Display', serif")
  })

  it('cleans up the offscreen container after capture', async () => {
    await generateAnonShareImage({ prompt: 'Ask away', username: 'ada' })

    expect(document.body.contains(capturedContainer)).toBe(false)
  })

  it('resolves with the blob html2canvas produced', async () => {
    const blob = await generateAnonShareImage({ prompt: 'Ask away', username: 'ada' })

    expect(blob).toBe(fakeBlob)
  })

  it('still cleans up the container if html2canvas rejects', async () => {
    const html2canvas = (await import('html2canvas')).default
    html2canvas.mockImplementationOnce(async (container) => {
      capturedContainer = container
      throw new Error('canvas boom')
    })

    await expect(generateAnonShareImage({ prompt: 'Ask away', username: 'ada' })).rejects.toThrow('canvas boom')
    expect(document.body.contains(capturedContainer)).toBe(false)
  })
})

describe('shareOrDownloadAnonImage', () => {
  const originalCanShare = navigator.canShare
  const originalShare = navigator.share

  afterEach(() => {
    navigator.canShare = originalCanShare
    navigator.share = originalShare
    vi.restoreAllMocks()
  })

  it('uses navigator.share with the file when the browser supports it', async () => {
    navigator.canShare = vi.fn(() => true)
    navigator.share = vi.fn(async () => {})

    await shareOrDownloadAnonImage(fakeBlob)

    expect(navigator.share).toHaveBeenCalledOnce()
    const call = navigator.share.mock.calls[0][0]
    expect(call.files).toHaveLength(1)
    expect(call.files[0].type).toBe('image/png')
  })

  it('falls back to a download link when the Web Share API is unavailable', async () => {
    navigator.canShare = undefined
    navigator.share = undefined
    const createObjectURL = vi.fn(() => 'blob:fake-url')
    const revokeObjectURL = vi.fn()
    globalThis.URL.createObjectURL = createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await shareOrDownloadAnonImage(fakeBlob, 'my-inbox.png')

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
