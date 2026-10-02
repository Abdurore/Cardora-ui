import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { MdLightMode, MdDarkMode, MdNotificationsNone } from 'react-icons/md'
import { getNotifications, markNotificationRead } from '../lib/api.js'

const BRAND_LOGO = '/cardora-icon.png?v=3'

function getDeviceTheme() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function ScreenHeader({ user, onAuthOpen, balance = 0 }) {
  const navigate = useNavigate()
  // 6.2: this header re-mounts on every route change (each page renders its
  // own <ScreenHeader>, there's no persistent layout instance) -- self-
  // contained fetch-on-mount rather than threading notification state
  // through MainLayout's outlet context for every page that uses this.
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    getNotifications().then((res) => {
      if (cancelled) return
      setNotifications(res?.notifications || res?.data?.notifications || [])
      setUnreadCount(res?.unreadCount ?? res?.data?.unreadCount ?? 0)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  const handleOpenNotification = async (notification) => {
    setShowNotifications(false)
    if (!notification.read) {
      markNotificationRead(notification.id).catch(() => {})
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    // 6.7 fix: two existing notification producers (6.3's scheduled-send
    // wa.me share, 6.4's chain-delivery link) already emit a full absolute
    // URL, not an in-app route -- react-router's navigate() can't handle
    // an absolute/external URL (it tries to treat the whole string as a
    // path within this app). Route those through a real navigation
    // instead; only a genuine relative path goes through navigate().
    if (notification.actionUrl) {
      if (/^https?:\/\//i.test(notification.actionUrl)) {
        window.open(notification.actionUrl, '_blank', 'noopener,noreferrer')
      } else {
        navigate(notification.actionUrl)
      }
    }
  }

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
    try { localStorage.setItem('cardora-theme', theme) } catch { /* storage unavailable */ }
  }, [theme])

  useEffect(() => {
    let stored = null
    try { stored = localStorage.getItem('cardora-theme') } catch { /* storage unavailable */ }
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
        {user && (
          <div className="header-notifications">
            <button
              type="button"
              className="header-notif-btn"
              onClick={() => setShowNotifications((v) => !v)}
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <MdNotificationsNone size={20} />
              {unreadCount > 0 && <span className="header-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {showNotifications && (
              <>
                <div className="header-notif-backdrop" onClick={() => setShowNotifications(false)} />
                <div className="header-notif-panel">
                  <p className="header-notif-title">Notifications</p>
                  {notifications.length === 0 ? (
                    <p className="header-notif-empty">Nothing yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`header-notif-item ${n.read ? '' : 'unread'}`}
                        onClick={() => handleOpenNotification(n)}
                      >
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {user ? (
          // 7.16: was a <Link to="/profile"> -- duplicated the bottom nav's
          // own Profile tab as a second path to the same screen. This stays
          // a plain identity/balance readout; the nav tab is the one way in.
          <div className="header-user-capsule" aria-label={`${user.username || user.name || 'User'}, ${balance} CC`}>
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
          </div>
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
