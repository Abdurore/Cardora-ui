// Right-sizes Cloudinary images at delivery time.
//
// Uploads are the original camera file (often 4000x3000, several MB) and were
// rendered as-is: a recipient on mobile data downloaded the whole thing to
// show it ~400 CSS px wide, and the Galaxy turned each into a GPU texture of
// that full size. Cloudinary can resize/re-encode on the fly from the same
// URL by adding a transformation segment:
//   f_auto      -> WebP/AVIF where the browser supports it
//   q_auto[:..] -> perceptual quality, tighter on weaker tiers
//   w_N,c_limit -> never wider than N px (and never upscaled)
// Anything that isn't a Cloudinary image URL (blob:/data: previews of a
// pending upload, other hosts) passes through untouched.

const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/

// An existing transformation segment ("w_400,c_fill/") precedes the version
// ("v1234/") -- don't stack a second one on top of it.
const HAS_TRANSFORM = /^(?!v\d+\/)[a-z]{1,3}_[^/]+\//i

const QUALITY = { high: 'q_auto', mid: 'q_auto:good', low: 'q_auto:eco' }

// Width buckets keep the number of distinct URLs (and so CDN/browser cache
// entries) small instead of one per exact viewport width.
const BUCKET = 160

export function defaultImageWidth(tier = 'high') {
  if (typeof window === 'undefined') return 1024
  const dprCap = tier === 'high' ? 2 : 1.5
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
  const cssWidth = Math.min(window.innerWidth || 400, 900)
  const px = Math.ceil((cssWidth * dpr) / BUCKET) * BUCKET
  return Math.min(Math.max(px, 480), 1600)
}

export function optimizedImageUrl(url, { width, tier = 'high' } = {}) {
  if (typeof url !== 'string') return url
  const match = CLOUDINARY_UPLOAD.exec(url)
  if (!match) return url
  const [, base, rest] = match
  if (HAS_TRANSFORM.test(rest)) return url
  const w = width || defaultImageWidth(tier)
  return `${base}f_auto,${QUALITY[tier] || QUALITY.high},w_${w},c_limit/${rest}`
}
