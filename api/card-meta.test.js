import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from './card-meta.js'

// 5.3: the OG unfurl for a shared card link must say who it's from, falling
// back to "Someone" (never blank) when the backend has no username to give.

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

describe('api/card-meta.js — sender attribution', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('interpolates the resolved senderName into the OG description', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ card: { type: 'personal', senderName: 'Ada', name: 'Happy Birthday!' } }),
    })

    const res = createRes()
    await handler({ query: { slug: 'abc123' } }, res)

    expect(res.body).toContain('Ada sent you something made to be opened, not just viewed.')
  })

  it('falls back to "Someone", never blank, when the backend has no username', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ card: { type: 'personal', name: 'Happy Birthday!' } }),
    })

    const res = createRes()
    await handler({ query: { slug: 'abc123' } }, res)

    expect(res.body).toContain('Someone sent you something')
    expect(res.body).not.toMatch(/undefined sent you/i)
  })

  it('does the same for a poll card', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ card: { type: 'poll', senderName: 'Bo' } }),
    })

    const res = createRes()
    await handler({ query: { slug: 'xyz' } }, res)

    expect(res.body).toContain('Bo wants to know what you think')
  })
})
