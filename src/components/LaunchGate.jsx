import { useEffect, useRef, useState } from 'react'

const LAUNCH_KEY = import.meta.env.VITE_LAUNCH_KEY || ''
const STORAGE_KEY = 'cardora:launch_v1'

export default function LaunchGate({ children }) {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    // Gate is disabled when no env var is set (local dev / post-launch)
    if (!LAUNCH_KEY) { setUnlocked(true); return }
    if (localStorage.getItem(STORAGE_KEY) === LAUNCH_KEY) setUnlocked(true)
  }, [])

  if (unlocked) return children

  const attempt = () => {
    if (input.trim() === LAUNCH_KEY) {
      localStorage.setItem(STORAGE_KEY, LAUNCH_KEY)
      setUnlocked(true)
    } else {
      setError(true)
      setShake(true)
      setInput('')
      setTimeout(() => setShake(false), 600)
      setTimeout(() => { setError(false); inputRef.current?.focus() }, 1800)
    }
  }

  return (
    <div className="lg-root">
      <div className="lg-bg" aria-hidden="true" />
      <div className={`lg-card${shake ? ' lg-shake' : ''}`}>
        <img src="/cardora-logo.png?v=4" alt="Cardora" className="lg-logo" />
        <h1 className="lg-brand">Cardora</h1>
        <p className="lg-tagline">Something special is launching soon.</p>
        <p className="lg-hint">Enter your access code to continue.</p>
        <input
          ref={inputRef}
          type="password"
          className={`lg-input${error ? ' lg-input--error' : ''}`}
          placeholder="Access code"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          autoFocus
          autoComplete="off"
        />
        {error && <p className="lg-error">Incorrect code — try again.</p>}
        <button type="button" className="lg-btn" onClick={attempt}>Enter →</button>
        <p className="lg-footer">© {new Date().getFullYear()} Cardora</p>
      </div>
    </div>
  )
}
