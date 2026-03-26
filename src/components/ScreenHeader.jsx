import logo from '../assets/icons/logo.png'

function ScreenHeader({ favoriteActive = false, onFavoriteToggle, user, onAuthOpen, balance = 0 }) {
  return (
    <header className="screen-header">
      <button
        className={`icon-button ${favoriteActive ? 'favorite-active' : ''}`}
        aria-label="Favorites"
        aria-pressed={favoriteActive}
        onClick={onFavoriteToggle}
        type="button"
      >
        <svg className="heart" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20.5s-6.7-4.6-9.2-8.3C.7 9.3 2 6.1 4.9 5.2c2-.6 4.1.2 5.1 1.9 1-1.7 3.2-2.5 5.1-1.9 2.9.9 4.2 4.1 2.1 7-2.5 3.7-9.2 8.3-9.2 8.3z" />
        </svg>
      </button>
      <div className="brand">
        <img src={logo} alt="Cardora logo" className="brand-logo" />
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
