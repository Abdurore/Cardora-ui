import { describe, it, expect, vi, afterEach } from 'vitest'
import handler from './card-meta.js'

// 5.1/5.3: every request to /card/:slug (not just bots) must get a real,
// server-rendered gate -- sender name, card title, Open Card button --
// plus the app's real JS/CSS preloaded so it's warm by the time someone
// taps Open. The OG unfurl must say who a card is from, falling back to
// "Someone" (never blank) when the backend has no username to give.

const FAKE_INDEX_HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="/assets/index-ABC123.css" />
</head><body><div id="root"></div>
<script type="module" src="/assets/index-XYZ789.js"></script>
</body></html>`

function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader: vi.fn((k, v) => { res.headers[k] = v }),
    status: vi.fn((code) => { res.statusCode = code; return res }),
    send: vi.fn((body) => { res.body = body; return res }),
  }
  return res
}

function mockFetchImpl(cardPayload) {
  return vi.fn(async (url) => {
    if (String(url).includes('/index.html')) {
      return { ok: true, text: async () => FAKE_INDEX_HTML }
    }
    return { ok: true, json: async () => cardPayload }
  })
}

describe('api/card-meta.js', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('interpolates the resolved senderName into the OG description', async () => {
    global.fetch = mockFetchImpl({ card: { type: 'personal', senderName: 'Ada', name: 'Happy Birthday!' } })

    const res = createRes()
    await handler({ query: { slug: 'abc123' } }, res)

    expect(res.body).toContain('Ada sent you something made to be opened, not just viewed.')
  })

  it('falls back to "Someone", never blank, when the backend has no username', async () => {
    global.fetch = mockFetchImpl({ card: { type: 'personal', name: 'Happy Birthday!' } })

    const res = createRes()
    await handler({ query: { slug: 'abc123' } }, res)

    expect(res.body).toContain('Someone sent you something')
    expect(res.body).not.toMatch(/undefined sent you/i)
  })

  it('does the same for a poll card', async () => {
    global.fetch = mockFetchImpl({ card: { type: 'poll', senderName: 'Bo' } })

    const res = createRes()
    await handler({ query: { slug: 'xyz' } }, res)

    expect(res.body).toContain('Bo wants to know what you think')
  })

  it('renders a real gate — sender, title, and an Open Card button — inside #root', async () => {
    global.fetch = mockFetchImpl({ card: { type: 'personal', senderName: 'Ada', name: 'Happy Birthday!' } })

    const res = createRes()
    await handler({ query: { slug: 'abc123' } }, res)

    expect(res.body).toContain('id="root"')
    expect(res.body).toContain('Ada sent you a card')
    expect(res.body).toContain('Happy Birthday!')
    expect(res.body).toContain('Open Card')
  })

  it('preloads the real built JS bundle so it is warm before the user taps Open', async () => {
    global.fetch = mockFetchImpl({ card: { type: 'personal', senderName: 'Ada' } })

    const res = createRes()
    await handler({ query: { slug: 'abc123' } }, res)

    expect(res.body).toContain('rel="modulepreload" href="/assets/index-XYZ789.js"')
    expect(res.body).toContain('<script type="module" src="/assets/index-XYZ789.js"></script>')
    expect(res.body).toContain('rel="stylesheet" href="/assets/index-ABC123.css"')
  })

  it('embeds only non-owner-safe fields for the client to read on mount, never response content', async () => {
    global.fetch = mockFetchImpl({
      card: {
        type: 'anonymous',
        senderName: 'Ada',
        name: 'Ask me anything',
        state: { responses: [{ text: 'a secret reply nobody but the owner should see' }] },
      },
    })

    const res = createRes()
    await handler({ query: { slug: 'abc123' } }, res)

    expect(res.body).toContain('window.__CARDORA_SSR_CARD__')
    expect(res.body).not.toContain('a secret reply')
  })

  it('still 200s with a generic gate when the card fetch fails, and lets the SPA handle it', async () => {
    global.fetch = mockFetchImpl(null)
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/index.html')) return { ok: true, text: async () => FAKE_INDEX_HTML }
      return { ok: false }
    })

    const res = createRes()
    await handler({ query: { slug: 'missing-slug' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('id="root"')
    expect(res.body).toContain('<script type="module"')
  })
})
