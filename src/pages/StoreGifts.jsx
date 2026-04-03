import { Link, useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'

// Gift Store is intentionally disabled for now due to current technical issues.
// Keep this page file in place so the route can be restored quickly later
// without recreating the screen structure from scratch.
function StoreGifts() {
  const { currentUser, openAuthModal, balance } = useOutletContext()

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="tabs">
          <Link className="tab" to="/store">
            Get CC
          </Link>
          <span className="tab active">Gifts Coming Soon</span>
        </div>
        <div className="admin-empty gift-coming-soon">
          <span className="admin-empty-icon">Soon</span>
          <p>Buy Gifts is coming soon.</p>
          <p className="admin-empty-sub">
            The gift store has been temporarily disabled while technical issues are being resolved.
          </p>
        </div>
      </div>
      <ScreenNav />
    </div>
  )
}

export default StoreGifts
