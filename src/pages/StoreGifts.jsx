import { Link } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import GiftCard from '../components/GiftCard.jsx'
import { storeGifts } from '../data/catalog.js'

function StoreGifts() {
  return (
    <div className="page-body">
      <ScreenHeader />
      <div className="screen-body">
        <div className="tabs">
          <Link className="tab" to="/store">
            Get CC
          </Link>
          <span className="tab active">Buy Gifts</span>
        </div>
        <p className="section-title">Featured Gifts</p>
        <div className="gift-grid">
          {storeGifts.map((gift, index) => (
            <GiftCard key={`${gift.title}-${index}`} {...gift} variant={`v${(index % 4) + 1}`} />
          ))}
        </div>
      </div>
      <ScreenNav />
    </div>
  )
}

export default StoreGifts
