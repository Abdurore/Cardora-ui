import { useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import InventoryCard from '../components/InventoryCard.jsx'
import { inventory, profileCreations } from '../data/catalog.js'

function Profile() {
  const { openExperience } = useOutletContext()

  return (
    <div className="page-body">
      <ScreenHeader />
      <div className="screen-body">
        <div className="profile">
          <div className="avatar" />
          <h3>The Creator</h3>
          <p className="role">Role: Artist</p>
          <div className="balance">Current Balance: 34 CC</div>
        </div>
        <div className="split">
          <div>
            <h4 className="section-title">My Creations</h4>
            <div className="card-grid compact">
              {profileCreations.map((card, index) => (
                <CardItem
                  key={`${card.title}-${index}`}
                  {...card}
                  tag={card.tag}
                  variant={`v${(index % 4) + 1}`}
                  onClick={openExperience}
                />
              ))}
            </div>
          </div>
          <div>
            <h4 className="section-title">Gift Inventory</h4>
            <div className="inventory">
              {inventory.map((gift, index) => (
                <InventoryCard
                  key={`${gift.title}-${index}`}
                  {...gift}
                  variant={`v${(index % 4) + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <ScreenNav />
    </div>
  )
}

export default Profile
