import { NavLink, useOutletContext } from 'react-router-dom'

const navItems = [
  {
    label: 'Home',
    to: '/',
    icon: (
      <svg className="nav-icon nav-icon-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: 'Explore',
    to: '/explore',
    icon: (
      <svg className="nav-icon nav-icon-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  // Center FAB handled separately
  {
    label: 'Store',
    to: '/store',
    icon: (
      <svg className="nav-icon nav-icon-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
  },
]

function ScreenNav() {
  const context = useOutletContext() || {}
  const { openCardTypeModal } = context

  return (
    <nav className="screen-nav">
      {navItems.slice(0, 2).map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label={item.label}
          end={item.to === '/'}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button type="button" className="nav-create-fab" aria-label="Create card" onClick={() => openCardTypeModal?.()}>
        <span className="nav-create-plus">+</span>
        <span className="nav-create-label">Create</span>
      </button>
      {navItems.slice(2).map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label={item.label}
          end={item.to === '/'}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default ScreenNav
