import { useNavigate } from 'react-router-dom'

// 3.4: "Surface immediately after first signup as a moment, not a toast."
// Previously the only signup-bonus UI anywhere was a pre-signup teaser
// banner ("New accounts get 15 free CC") -- nothing ever told a new sender
// the bonus had actually landed. MainLayout.jsx sets a one-time localStorage
// flag when handleSignup succeeds, then consumes it (clearing it so this
// can never show again) the first time hydrateSession() sees
// signupBonusApplied on the freshly-verified account -- see
// PENDING_STARTER_GRANT_KEY there.
//
// A real overlay, not an auto-dismissing corner banner like
// WelcomeBackBanner -- this is a one-time, positive event worth making the
// sender actually stop and register, not something to risk missing.
function StarterGrantMoment({ amount, onDismiss }) {
  const navigate = useNavigate()
  if (!amount) return null

  const handleCreate = () => {
    onDismiss?.()
    navigate('/create')
  }

  return (
    <div className="sgm-overlay" role="dialog" aria-modal="true" aria-label="Welcome bonus">
      <div className="sgm-backdrop" onClick={onDismiss} />
      <div className="sgm-card">
        <button className="sgm-close" type="button" onClick={onDismiss} aria-label="Dismiss">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </button>
        <div className="sgm-icon" aria-hidden="true">🎉</div>
        <p className="sgm-eyebrow">Welcome to Cardora</p>
        <h2 className="sgm-amount">+{amount} CC</h2>
        <p className="sgm-sub">You're starting with {amount} free Cardora Credits — enough to send your first premium card. Use it within 30 days.</p>
        <div className="sgm-actions">
          <button className="sgm-cta" type="button" onClick={handleCreate}>Send your first card</button>
          <button className="sgm-dismiss" type="button" onClick={onDismiss}>Maybe later</button>
        </div>
      </div>
    </div>
  )
}

export default StarterGrantMoment
