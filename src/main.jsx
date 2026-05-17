import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

window.addEventListener('contextmenu', (e) => e.preventDefault())

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
