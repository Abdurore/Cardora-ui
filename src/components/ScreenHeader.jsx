import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { MdLightMode, MdDarkMode } from 'react-icons/md'

const BRAND_LOGO = '/cardora-icon.png?v=3'

function getDeviceTheme() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function ScreenHeader({ user, onAuthOpen, balance = 0 }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('cardora-theme')
      return stored === 'light' || stored === 'dark' ? stored : getDeviceTheme()
    } catch {
      return getDeviceTheme()
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : ''
    try { localStorage.setItem('cardora-theme', theme) } catch {}
  }, [theme])

  useEffect(() => {
    let stored = null
    try { stored = localStorage.getItem('cardora-theme') } catch {}
    if (stored === 'light' || stored === 'dark') return undefined
    const media = window.matchMedia?.('(prefers-color-scheme: light)')
    if (!media) return undefined
    const handleChange = () => setTheme(media.matches ? 'light' : 'dark')
    media.addEventListener?.('change', handleChange)
    return () => media.removeEventListener?.('change', handleChange)
  }, [])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  return (
    <header className="screen-header">
      <div className="brand">
        <span className="brand-wordmark">CARDORA</span>
      </div>
      <div className="header-actions">
        <button
          type="button"
          className="header-theme-btn"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {theme === 'light' ? <MdDarkMode size={20} /> : <MdLightMode size={20} />}
        </button>
        {user ? (
          <Link to="/profile" className="header-user-capsule" aria-label="Profile">
            <span className="header-capsule-avatar">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="header-avatar-img" />
              ) : (
                <span className="header-avatar-dot" style={{ background: user.avatarColor || 'linear-gradient(135deg, #7ef7ff, #62ffa2)' }}>
                  {(user.username || user.name || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="header-capsule-info">
              <span className="header-capsule-name">{user.username || user.name || 'User'}</span>
              <span className="header-capsule-balance">
                <span className="header-cc-icon">◈</span> {balance} CC
              </span>
            </span>
          </Link>
        ) : (
          <button className="user-chip" type="button" onClick={onAuthOpen}>
            <span className="user-dot" />
            <span>Sign in</span>
          </button>
        )}
      </div>
    </header>
  )
}

export default ScreenHeader
