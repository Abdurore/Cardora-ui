import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import InventoryCard from '../components/InventoryCard.jsx'
import AvatarCropModal from '../components/AvatarCropModal.jsx'
import { exploreCards, homeCards, inventory, profileCreations } from '../data/catalog.js'

function Profile() {
  const {
    openCardDetails,
    favorites,
    toggleFavorite,
    balance,
    currentUser,
    openAuthModal,
    updateAvatar,
  } = useOutletContext()
  const [cropSrc, setCropSrc] = useState(null)
  const allCards = [...homeCards, ...exploreCards, ...profileCreations]
  const favoriteCards = allCards.filter((card) => favorites.includes(card.id))

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="profile">
          <label className="avatar upload-avatar">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" />
            ) : (
              <span>{currentUser ? currentUser.name.charAt(0) : '?'}</span>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file || !currentUser) return
                const reader = new FileReader()
                reader.onload = () => {
                  if (typeof reader.result === 'string') setCropSrc(reader.result)
                }
                reader.readAsDataURL(file)
                event.target.value = ''
              }}
            />
          </label>
          <h3>{currentUser ? currentUser.name : 'Guest'}</h3>
          {currentUser?.username ? <p className="profile-handle">@{currentUser.username}</p> : null}
          <p className="role">Role: {currentUser ? currentUser.role : 'Visitor'}</p>
          <div className="balance">Current Balance: {balance} CC</div>
        </div>
        {!currentUser ? (
          <p className="empty-state">Sign in to personalize your profile.</p>
        ) : null}
        {favoriteCards.length ? (
          <div>
            <h4 className="section-title">Saved Cards</h4>
            <div className="card-grid compact">
              {favoriteCards.map((card, index) => (
                <CardItem
                  key={`${card.title}-${index}`}
                  {...card}
                  variant={`v${(index % 4) + 1}`}
                  isFavorite={favorites.includes(card.id)}
                  onToggleFavorite={toggleFavorite}
                  onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div>
          <h4 className="section-title">My Creations</h4>
          <div className="card-grid compact">
            {profileCreations.map((card, index) => (
              <CardItem
                key={`${card.title}-${index}`}
                {...card}
                tag={card.tag}
                variant={`v${(index % 4) + 1}`}
                isFavorite={favorites.includes(card.id)}
                onToggleFavorite={toggleFavorite}
                onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
              />
            ))}
          </div>
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
      <ScreenNav />
      <AvatarCropModal
        open={Boolean(cropSrc)}
        src={cropSrc}
        onCancel={() => setCropSrc(null)}
        onSave={(dataUrl) => {
          updateAvatar(dataUrl)
          setCropSrc(null)
        }}
      />
    </div>
  )
}

export default Profile
