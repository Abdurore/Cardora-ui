import { describe, it, expect } from 'vitest'
import { optimizedImageUrl, defaultImageWidth } from './imageUrl.js'

const RAW = 'https://res.cloudinary.com/demo/image/upload/v1700000000/cards/a.jpg'

describe('optimizedImageUrl', () => {
  it('adds format/quality/width to a raw Cloudinary upload', () => {
    expect(optimizedImageUrl(RAW, { width: 640 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640,c_limit/v1700000000/cards/a.jpg',
    )
  })

  it('uses tighter quality on weaker tiers', () => {
    expect(optimizedImageUrl(RAW, { width: 640, tier: 'mid' })).toContain('q_auto:good')
    expect(optimizedImageUrl(RAW, { width: 640, tier: 'low' })).toContain('q_auto:eco')
  })

  it('does not stack on an existing transformation', () => {
    const t = 'https://res.cloudinary.com/demo/image/upload/w_400,c_fill/v1/a.jpg'
    expect(optimizedImageUrl(t, { width: 640 })).toBe(t)
  })

  it('passes through blob/data/other-host/non-string values', () => {
    for (const v of ['blob:http://x/1', 'data:image/png;base64,AAA', 'https://picsum.photos/1/2', null, undefined]) {
      expect(optimizedImageUrl(v, { width: 640 })).toBe(v)
    }
  })

  it('buckets the default width and keeps it in range', () => {
    const w = defaultImageWidth('high')
    expect(w % 160).toBe(0)
    expect(w).toBeGreaterThanOrEqual(480)
    expect(w).toBeLessThanOrEqual(1600)
  })
})
