import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCardBySlug } from './api.js'

// A card password must never be in the URL: a query string lands in access
// logs, browser history and Referer headers. It travels as a header.
describe('getCardBySlug password transport', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubFetch() {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ card: { slug: 'abc123' } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('sends the password in X-Card-Password, not the query string', async () => {
    const fetchMock = stubFetch()
    await getCardBySlug('abc123', 'open sesame')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).not.toMatch(/password/i)
    expect(init.headers['X-Card-Password']).toBe('open sesame')
  })

  it('sends no password header when there is no password', async () => {
    const fetchMock = stubFetch()
    await getCardBySlug('abc123')
    expect(fetchMock.mock.calls[0][1].headers['X-Card-Password']).toBeUndefined()
  })
})
