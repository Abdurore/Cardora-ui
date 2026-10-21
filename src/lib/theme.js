// Site theme (light/dark). One place for the rules main.jsx and the header
// toggle both follow -- they used to each carry their own copy.
//
// - An explicit choice lives in localStorage['cardora-theme']. Only the
//   toggle writes it: persisting the OS theme on first mount made it look
//   like a choice, so a device that later switched OS theme never followed.
// - With no explicit choice the site follows prefers-color-scheme, live.
// - index.html's inline <head> script mirrors resolveTheme() for the very
//   first paint; keep the two in step.

export const THEME_STORAGE_KEY = 'cardora-theme'

// Mirrors --bg in index.css, for the mobile browser bar.
const THEME_COLOR = { light: '#f4f8fb', dark: '#0b0f12' }

export function getDeviceTheme() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

export function resolveTheme() {
  return getStoredTheme() || getDeviceTheme()
}

export function storeTheme(theme) {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* storage unavailable */ }
}

export function applyTheme(theme) {
  const root = document.documentElement
  root.dataset.theme = theme === 'light' ? 'light' : ''
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = THEME_COLOR[theme === 'light' ? 'light' : 'dark']
}
