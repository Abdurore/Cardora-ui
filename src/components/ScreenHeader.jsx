function ScreenHeader() {
  return (
    <header className="screen-header">
      <button className="icon-button" aria-label="Favorites">
        <svg className="heart" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20.5s-6.7-4.6-9.2-8.3C.7 9.3 2 6.1 4.9 5.2c2-.6 4.1.2 5.1 1.9 1-1.7 3.2-2.5 5.1-1.9 2.9.9 4.2 4.1 2.1 7-2.5 3.7-9.2 8.3-9.2 8.3z" />
        </svg>
      </button>
      <div className="brand" />
      <button className="toggle" aria-label="Toggle theme">
        <span className="toggle-dot" />
      </button>
    </header>
  )
}

export default ScreenHeader
