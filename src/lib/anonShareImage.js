import { ensureFonts } from './fontLoader.js'

// 6.6: "Auto-generate a 1080x1920 share image on inbox creation: prompt
// text in the display serif, themed background, short link legible at
// thumbnail size, owner's display name. Offer as Share to status.
// Regenerate on prompt change." Generated fresh client-side every time
// it's requested (not persisted anywhere) -- that's what makes
// "regenerate on prompt change" free: there's nothing to go stale.

const WIDTH = 1080
const HEIGHT = 1920

function normaliseHex(value, fallback) {
  const v = String(value || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback
}

// Same fast perceived-luminance approximation backendMappers.js's
// isLightColor uses -- duplicated rather than imported to keep this
// module independent (it also isn't exported there).
function isLightColor(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.55
}

/**
 * Renders a 1080x1920 PNG Blob for sharing an anonymous inbox link.
 * @param {object} opts
 * @param {string} opts.prompt      The inbox's own message/prompt text.
 * @param {string} opts.username    Owner's username (for the link + byline).
 * @param {object} [opts.colors]    { background, accent } hex colors (falls back to Cardora defaults).
 * @param {string} [opts.fontFamily] Display serif font family (falls back to Cinzel).
 * @returns {Promise<Blob>}
 */
export async function generateAnonShareImage({ prompt, username, colors = {}, fontFamily = 'Cinzel' }) {
  const background = normaliseHex(colors.background, '#0b0f12')
  const accent = normaliseHex(colors.accent, '#7ef7ff')
  const textColor = isLightColor(background) ? '#111111' : '#ffffff'
  const link = `${window.location.origin}/ask/${username}`.replace(/^https?:\/\//, '')

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.width = `${WIDTH}px`
  container.style.height = `${HEIGHT}px`
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.alignItems = 'center'
  container.style.justifyContent = 'space-between'
  container.style.padding = '96px 72px'
  container.style.boxSizing = 'border-box'
  container.style.backgroundColor = background
  container.style.backgroundImage = `radial-gradient(ellipse 90% 60% at 50% 0%, ${accent}33, transparent 60%)`
  container.style.color = textColor
  container.style.fontFamily = "'Inter', sans-serif"
  container.style.textAlign = 'center'

  container.innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; opacity:0.85;">
      <span style="font-size:34px; font-weight:700; letter-spacing:0.02em;">Cardora</span>
    </div>
    <div style="display:flex; flex-direction:column; align-items:center; gap:40px;">
      <p style="margin:0; font-size:30px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.7; font-weight:600;">
        Send me an anonymous message
      </p>
      <p style="margin:0; font-family:'${fontFamily}', serif; font-size:64px; line-height:1.3; max-width:880px; font-weight:600;">
        ${String(prompt || 'Ask me anything').slice(0, 200)}
      </p>
    </div>
    <div style="display:flex; flex-direction:column; align-items:center; gap:24px;">
      <div style="padding:20px 40px; border-radius:999px; border:2px solid ${accent}; font-size:36px; font-weight:700; color:${accent};">
        ${link}
      </div>
      <p style="margin:0; font-size:28px; opacity:0.7;">from @${username}</p>
    </div>
  `

  document.body.appendChild(container)
  try {
    // html2canvas (~200KB) and this image's fonts are only needed when the
    // user actually taps "share" -- loaded here, not into the pages' bundles
    // or the first paint. The fonts have to be in before the snapshot or the
    // image renders in the fallback face.
    const [{ default: html2canvas }] = await Promise.all([
      import('html2canvas'),
      ensureFonts(['Inter', fontFamily]),
    ])
    if (document.fonts?.ready) await document.fonts.ready
    const canvas = await html2canvas(container, {
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: background,
      useCORS: true,
    })
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render the share image.'))), 'image/png')
    })
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Shares (via the Web Share API's file support) or downloads the
 * generated image, whichever the browser supports.
 */
export async function shareOrDownloadAnonImage(blob, filename = 'cardora-ask-me.png') {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Cardora', text: 'Ask me anything, anonymously.' })
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
