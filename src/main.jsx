import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import LaunchGate from './components/LaunchGate.jsx'

window.addEventListener('contextmenu', (e) => e.preventDefault())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LaunchGate>
        <App />
      </LaunchGate>
    </BrowserRouter>
  </StrictMode>,
)
