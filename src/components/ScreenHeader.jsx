import logo from '../assets/icons/logo.png'

function ScreenHeader({ user, onAuthOpen, balance = 0 }) {
  return (
    <header className="screen-header">
      <div className="brand">
        <div className="brand-lockup">
          <img src={logo} alt="Cardora logo" className="brand-logo" />
          <span className="brand-wordmark">Cardora</span>
        </div>
      </div>
      <div className="header-actions">
        <div className="cc-chip">{balance} CC</div>
        <button className="user-chip" type="button" onClick={onAuthOpen}>
          <span className="user-dot" style={{ background: user?.avatarColor }} />
          <span>{user ? user.username || user.name : 'Sign in'}</span>
        </button>
      </div>
    </header>
  )
}

export default ScreenHeader
