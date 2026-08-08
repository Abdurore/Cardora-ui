import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

function AuthModal({ open, onClose, currentUser, onLogout, title, message }) {
  if (!open) return null

  const heading = currentUser ? 'Account' : (title || 'Sign in to continue')
  const subtitle = currentUser
    ? null
    : (message || "You'll need an account to continue — it only takes a moment, and you'll land right back here once you're signed in.")

  return createPortal(
    <section className="auth-modal" role="dialog" aria-modal="true">
      <div className="auth-backdrop" onClick={onClose} />
      <div className="auth-card">
        <div className="auth-header">
          <h3>{heading}</h3>
          <button className="ghost auth-close-btn" type="button" onClick={onClose} aria-label="Close">
            &#10005;
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
          <div className="auth-prompt">
            <p className="auth-prompt-message">{subtitle}</p>
            <div className="auth-prompt-actions">
              <Link className="primary auth-prompt-btn" to="/login" onClick={onClose}>
                Log In
              </Link>
              <Link className="ghost auth-prompt-btn" to="/signup" onClick={onClose}>
                Create Free Account
              </Link>
            </div>
            <p className="auth-prompt-footnote">No spam, no card required — just an email and a password.</p>
          </div>
        )}
      </div>
    </section>,
    document.body,
  )
}

export default AuthModal
