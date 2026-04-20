import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SESSION_SHOWN_KEY = 'cardora:bannerShownThisSession'
const DISPLAY_DELAY_MS = 2200
const AUTO_DISMISS_MS = 9000

function WelcomeBackBanner({ currentUser }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!currentUser) return

    const alreadyShown = sessionStorage.getItem(SESSION_SHOWN_KEY)
    if (alreadyShown) return

    const timer = setTimeout(() => {
      setVisible(true)
      sessionStorage.setItem(SESSION_SHOWN_KEY, '1')
    }, DISPLAY_DELAY_MS)

    return () => clearTimeout(timer)
  }, [currentUser])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => dismiss(), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => setVisible(false), 380)
  }

  const handleEarn = () => {
    dismiss()
    navigate('/store')
  }

  if (!visible) return null

  return (
    <div className={`wb-banner ${exiting ? 'wb-banner--exit' : ''}`} role="status" aria-live="polite">
      <div className="wb-banner-glow" aria-hidden="true" />
      <div className="wb-banner-inner">
        <div className="wb-banner-icon" aria-hidden="true">✦</div>
        <div className="wb-banner-text">
          <p className="wb-banner-title">Welcome back, {currentUser.name?.split(' ')[0] || currentUser.username}!</p>
          <p className="wb-banner-sub">You've got new ways to earn Cardora Credits today.</p>
        </div>
        <button className="wb-banner-cta" type="button" onClick={handleEarn}>
          Earn CC
        </button>
        <button className="wb-banner-close" type="button" onClick={dismiss} aria-label="Dismiss">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </button>
      </div>
      <div className="wb-banner-progress" />
    </div>
  )
}

export default WelcomeBackBanner
