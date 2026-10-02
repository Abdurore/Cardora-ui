// Loads Google Fonts on demand instead of one render-blocking stylesheet for
// 30+ families on every page.
//
// index.html used to request every font a card or the Studio could use
// (Abril Fatface ... Tangerine) up front, as one stylesheet the browser has to
// fetch and parse before first paint -- on every route, including pages that
// show no card at all. Now index.html only asks for the two families the app
// chrome uses (Manrope, Cinzel); a card's own font loads when a card is
// rendered, and the Studio's font picker loads the full set when it opens.
//
// Each family is its own small stylesheet (`font-display: swap`, so text
// shows immediately in the fallback and swaps in), requested at most once.

// Google Fonts families the app can use, as css2 `family=` parameters (same
// weights/styles the single mega-stylesheet in index.html used to request).
export const FONT_PARAMS = {
  'Abril Fatface': 'Abril+Fatface',
  'Allura': 'Allura',
  'Amatic SC': 'Amatic+SC:wght@400;700',
  'Bebas Neue': 'Bebas+Neue',
  'Caveat': 'Caveat:wght@400;600',
  'Cinzel': 'Cinzel:wght@500;600;700',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,400;0,600;1,400',
  'Dancing Script': 'Dancing+Script:wght@400;600;700',
  'DM Serif Display': 'DM+Serif+Display:ital@0;1',
  'EB Garamond': 'EB+Garamond:ital,wght@0,400;0,600;1,400',
  'Great Vibes': 'Great+Vibes',
  'Inter': 'Inter:wght@300;400;500;600;700',
  'Italianno': 'Italianno',
  'Josefin Sans': 'Josefin+Sans:wght@300;400;500;600',
  'Lobster': 'Lobster',
  'Lora': 'Lora:ital,wght@0,400;0,600;1,400',
  'Manrope': 'Manrope:wght@300;400;500;600;700',
  'Merriweather': 'Merriweather:ital,wght@0,400;0,700;1,400',
  'Montserrat': 'Montserrat:wght@300;400;500;600;700',
  'Nunito': 'Nunito:wght@300;400;600;700',
  'Outfit': 'Outfit:wght@300;400;500;600;700',
  'Pacifico': 'Pacifico',
  'Parisienne': 'Parisienne',
  'Playfair Display': 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400',
  'Poppins': 'Poppins:wght@300;400;500;600;700',
  'Quicksand': 'Quicksand:wght@300;400;500;600;700',
  'Raleway': 'Raleway:wght@300;400;500;600;700',
  'Sacramento': 'Sacramento',
  'Satisfy': 'Satisfy',
  'Tangerine': 'Tangerine:wght@400;700',
}

const requested = new Map()

function normalise(family) {
  return String(family || '').replace(/^['"]|['"]$/g, '').split(',')[0].trim()
}

// Returns a promise that resolves when the family is usable (or after a short
// timeout/failure -- callers never need to await it; swap handles display).
export function ensureFont(family) {
  const name = normalise(family)
  const param = FONT_PARAMS[name]
  if (!param || typeof document === 'undefined') return Promise.resolve(false)
  if (requested.has(name)) return requested.get(name)

  const promise = new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${param}&display=swap`
    link.dataset.cardoraFont = name
    const done = () => {
      // Kick the actual font file download now rather than at first use.
      const load = document.fonts?.load?.(`16px "${name}"`)
      if (load) load.then(() => resolve(true), () => resolve(false))
      else resolve(true)
    }
    link.onload = done
    link.onerror = () => resolve(false)
    document.head.appendChild(link)
    setTimeout(() => resolve(false), 4000)
  })
  requested.set(name, promise)
  return promise
}

export function ensureFonts(families) {
  return Promise.all([...new Set((families || []).map(normalise))].filter(Boolean).map(ensureFont))
}

// Fonts the card render tree and a few app screens reference by name in CSS
// (not through a card's chosen font). Loaded once the app is idle so they
// never compete with first paint.
const SECONDARY_FONTS = ['Great Vibes', 'Cormorant Garamond', 'Playfair Display']

export function loadSecondaryFontsWhenIdle() {
  if (typeof window === 'undefined') return
  const run = () => ensureFonts(SECONDARY_FONTS)
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}

// Test hook.
export function __resetFontLoaderForTests() {
  requested.clear()
}
