import { NavLink } from 'react-router-dom'
import homeIcon from '../assets/icons/home.png'
import searchIcon from '../assets/icons/search.png'
import cartIcon from '../assets/icons/shopping-cart.png'
import userIcon from '../assets/icons/user.png'

const navItems = [
  { label: 'Home', to: '/', icon: homeIcon },
  { label: 'Explore', to: '/explore', icon: searchIcon },
  { label: 'Store', to: '/store', icon: cartIcon },
  { label: 'Profile', to: '/profile', icon: userIcon },
]

function ScreenNav() {
  return (
    <nav className="screen-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label={item.label}
          end={item.to === '/'}
        >
          <img className="nav-icon" src={item.icon} alt="" aria-hidden="true" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default ScreenNav
