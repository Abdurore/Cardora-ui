import { Link, useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PackCard from '../components/PackCard.jsx'
import { storePacks } from '../data/catalog.js'

function Store() {
  const { balance, cart, addToCart, currentUser, openAuthModal, couponPackages } = useOutletContext()
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const packs = couponPackages?.length ? couponPackages : storePacks

  const handleSelect = async (pack) => {
    const result = await addToCart(pack)
    if (!result?.ok && result?.reason) {
      setCheckoutMessage(result.reason === 'auth' ? 'Please sign in to continue.' : result.reason)
      setTimeout(() => setCheckoutMessage(''), 2200)
    }
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="wallet-hero">
          <div className="wallet-copy">
            <p className="eyebrow">Wallet</p>
            <h2 className="wallet-title">Keep your next surprise ready to send.</h2>
            <p className="subtext">
              Add credits, unlock premium templates, and power interactive gifts without
              leaving the experience.
            </p>
          </div>
          <button className="primary" type="button">
            Add CC
          </button>
        </div>

        <div className="balance-bar wallet-balance">
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

        <div className="wallet-package-note">
          {packs.slice(0, 4).map((pack) => (
            <span key={pack.id || pack.title}>{pack.amount}</span>
          ))}
        </div>
        {checkoutMessage ? <p className="form-error">{checkoutMessage}</p> : null}

        <div className="pack-grid">
          {packs.map((pack, index) => (
            <PackCard
              key={pack.id || `${pack.title}-${index}`}
              {...pack}
              onSelect={() => handleSelect(pack)}
            />
          ))}
        </div>
      </div>
      <ScreenNav />
    </div>
  )
}

export default Store
