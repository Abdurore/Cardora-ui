import { describe, it, expect, vi, afterEach } from 'vitest'
import handler from './ask-meta.js'

// 5.1: every request to /ask/:username (not just bots) must get a real
// response instead of the bare SPA shell. /ask/:username's own real
// behavior (AnonSend.jsx) is "resolve the active anonymous card, then go
// there" -- so the fast path is a real HTTP redirect straight to
// /card/:slug, which the existing unconditional /card/:slug rewrite
// already gives a full SSR gate. Only when nothing resolves does this
// render its own gate.

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
    redirected: null,
    setHeader: vi.fn((k, v) => { res.headers[k] = v }),
    status: vi.fn((code) => { res.statusCode = code; return res }),
    send: vi.fn((body) => { res.body = body; return res }),
    redirect: vi.fn((code, location) => { res.redirected = { code, location }; return res }),
  }
  return res
}

function mockFetchImpl({ anonymousCard, profile } = {}) {
  return vi.fn(async (url) => {
    const s = String(url)
    if (s.includes('/index.html')) return { ok: true, text: async () => FAKE_INDEX_HTML }
    if (s.includes('/anonymous-card')) {
      return anonymousCard ? { ok: true, json: async () => anonymousCard } : { ok: false }
    }
    if (s.includes('/profile')) {
      return profile ? { ok: true, json: async () => profile } : { ok: false }
    }
    return { ok: false }
  })
}

describe('api/ask-meta.js', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('redirects straight to /card/:slug when the username has an active anonymous card', async () => {
    global.fetch = mockFetchImpl({ anonymousCard: { slug: 'card-slug-1' } })

    const res = createRes()
    await handler({ query: { username: 'ada' } }, res)

    expect(res.redirected).toEqual({ code: 302, location: '/card/card-slug-1' })
    expect(res.send).not.toHaveBeenCalled()
  })

  it('renders a gate with the profile username when there is no active card', async () => {
    global.fetch = mockFetchImpl({ profile: { profile: { username: 'ada', profilePictureUrl: '' } } })

    const res = createRes()
    await handler({ query: { username: 'ada' } }, res)

    expect(res.redirected).toBeNull()
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Ask @ada anonymously')
    expect(res.body).toContain('id="root"')
  })

  it('404s with a "user not found" gate when neither an active card nor a profile resolve', async () => {
    global.fetch = mockFetchImpl({})

    const res = createRes()
    await handler({ query: { username: 'nobody' } }, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toContain('User not found')
  })

  it('404s with a generic gate when no username is given at all', async () => {
    const res = createRes()
    await handler({ query: {} }, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toContain('Ask anonymously on Cardora')
  })

  it('preloads the real built JS bundle on the fallback gate', async () => {
    global.fetch = mockFetchImpl({ profile: { profile: { username: 'ada' } } })

    const res = createRes()
    await handler({ query: { username: 'ada' } }, res)

    expect(res.body).toContain('rel="modulepreload" href="/assets/index-XYZ789.js"')
    expect(res.body).toContain('<script type="module" src="/assets/index-XYZ789.js"></script>')
  })

  it('never redirects for a username with no active card, even if a profile exists', async () => {
    global.fetch = mockFetchImpl({ profile: { profile: { username: 'ada' } } })

    const res = createRes()
    await handler({ query: { username: 'ada' } }, res)

    expect(res.redirect).not.toHaveBeenCalled()
  })
})
