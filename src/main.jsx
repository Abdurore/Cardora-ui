import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { getPerfTier } from './lib/perfTier.js'
import { loadSecondaryFontsWhenIdle } from './lib/fontLoader.js'

// Only card media is shielded from the context menu. Blocking it everywhere
// removed "open in new tab", copy, and inspect for no real protection.
window.addEventListener('contextmenu', (e) => {
  if (e.target instanceof Element && e.target.closest('img, video, canvas')) e.preventDefault()
})

function applyInitialTheme() {
  try {
    const stored = localStorage.getItem('cardora-theme')
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
    const theme = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersLight ? 'light' : 'dark')
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : ''
  } catch {
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
    document.documentElement.dataset.theme = prefersLight ? 'light' : ''
  }
}

applyInitialTheme()
// Resolves the performance tier and stamps <html data-perf> before the first
// render, so the tiered CSS is in effect from the first paint.
getPerfTier()
loadSecondaryFontsWhenIdle()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
