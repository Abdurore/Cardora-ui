import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

function AuthModal({ open, onClose, currentUser, onLogout }) {
  if (!open) return null

  return createPortal(
    <section className="auth-modal" role="dialog" aria-modal="true">
      <div className="auth-backdrop" onClick={onClose} />
      <div className="auth-card">
        <div className="auth-header">
          <h3>{currentUser ? 'Account' : 'Authentication'}</h3>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {currentUser ? (
          <div className="auth-profile">
            <div className="auth-avatar" style={{ background: currentUser.avatarColor }}>
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.username || currentUser.name} />
              ) : (
                <span>{(currentUser.username || currentUser.name || '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="auth-name">{currentUser.username || currentUser.name}</p>
              <p className="auth-email">{currentUser.email}</p>
            </div>
            <button
              className="primary"
              type="button"
              onClick={() => {
                onLogout?.()
                onClose()
              }}
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="auth-profile">
            <p className="auth-email">
              Cardora authentication now uses the dedicated backend-powered login and signup pages.
            </p>
            <Link className="primary" to="/login" onClick={onClose}>
              Go to login
            </Link>
            <Link className="ghost" to="/signup" onClick={onClose}>
              Create account
            </Link>
          </div>
        )}
      </div>
    </section>,
    document.body,
  )
}

export default AuthModal
