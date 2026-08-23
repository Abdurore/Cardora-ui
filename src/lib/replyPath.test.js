import { describe, it, expect } from 'vitest'
import { buildSendOneBackPath } from './replyPath.js'

// 6.5: "Send one back" -- the reply path's query-string construction is the
// one bug-prone part of this feature reachable without driving the whole
// CardPreviewModal component through its 'end' stage (which has no test
// seam: asset-loading, envelope-open, and letterPeek all gate on internal
// timers). See the commit message / completion notes for what this does
// NOT cover -- the button's own render conditions and the signed-in/
// signed-out branch in handleSendOneBack are unverified beyond code review.

describe('buildSendOneBackPath', () => {
  it('includes both the card id and a URL-encoded sender name', () => {
    const path = buildSendOneBackPath('abc123', 'Ada Lovelace')
    expect(path).toBe('/quick?type=personal&replyTo=abc123&replySender=Ada%20Lovelace')
  })

  it('omits replySender entirely when no sender name is given', () => {
    const path = buildSendOneBackPath('abc123', '')
    expect(path).toBe('/quick?type=personal&replyTo=abc123')
  })

  it('URL-encodes special characters in the card id', () => {
    const path = buildSendOneBackPath('abc/123?x=1', 'Bo')
    expect(path).toContain('replyTo=abc%2F123%3Fx%3D1')
  })

  it('never breaks the query string when the sender name contains an ampersand', () => {
    const path = buildSendOneBackPath('abc123', 'Ada & Bo')
    expect(path).toBe('/quick?type=personal&replyTo=abc123&replySender=Ada%20%26%20Bo')
    // Exactly three real params (type, replyTo, replySender) -- the
    // encoded `&` inside the sender name must not read as a fourth.
    expect(path.split('&')).toHaveLength(3)
  })
})
