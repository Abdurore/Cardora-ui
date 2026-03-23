import { Link } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PackCard from '../components/PackCard.jsx'
import { storePacks } from '../data/catalog.js'

function Store() {
  return (
    <div className="page-body">
      <ScreenHeader />
      <div className="screen-body">
        <div className="tabs">
          <span className="tab active">Get CC</span>
          <Link className="tab" to="/store/gifts">
            Buy Gifts
          </Link>
        </div>
        <div className="pack-grid">
          {storePacks.map((pack, index) => (
            <PackCard key={`${pack.title}-${index}`} {...pack} />
          ))}
        </div>
      </div>
      <ScreenNav />
    </div>
  )
}

export default Store
