import { Link, useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PackCard from '../components/PackCard.jsx'
import { storePacks } from '../data/catalog.js'

function Store() {
  const { balance, cart, addToCart, currentUser, openAuthModal } = useOutletContext()

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="balance-bar">
          <div>
            <p className="balance-label">Current Balance</p>
            <p className="balance-value">{balance} CC</p>
          </div>
          <div className="cart-chip">
            {cart.length} item{cart.length === 1 ? '' : 's'} added
          </div>
        </div>
        <div className="tabs">
          <span className="tab active">Get CC</span>
          <Link className="tab" to="/store/gifts">
            Buy Gifts
          </Link>
        </div>
        <div className="pack-grid">
          {storePacks.map((pack, index) => (
            <PackCard
              key={`${pack.title}-${index}`}
              {...pack}
              onSelect={() => addToCart(pack)}
            />
          ))}
        </div>
      </div>
      <ScreenNav />
    </div>
  )
}

export default Store
