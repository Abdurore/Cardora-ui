import { Link } from 'react-router-dom'

const BRAND_LOGO = '/cardora-logo.png?v=4'

function ScreenHeader({ user, onAuthOpen, balance = 0 }) {
  return (
    <header className="screen-header">
      <div className="brand">
        <div className="brand-lockup">
          <img src={BRAND_LOGO} alt="Cardora logo" className="brand-logo" />
          <span className="brand-wordmark">Cardora</span>
        </div>
      </div>
      <div className="header-actions">
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
