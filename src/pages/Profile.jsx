import { useOutletContext, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import InventoryCard from '../components/InventoryCard.jsx'
import AvatarCropModal from '../components/AvatarCropModal.jsx'
import { exploreCards, homeCards, profileCreations } from '../data/catalog.js'

const ROLE_CONFIG = {
  Artist: { badge: 'role-artist', icon: '🎨', desc: 'Create and publish templates to the marketplace' },
  Creator: { badge: 'role-creator', icon: '✨', desc: 'Build and send personalized card experiences' },
  Admin: { badge: 'role-admin', icon: '⚡', desc: 'Monitor platform activity and manage content' },
  Visitor: { badge: 'role-visitor', icon: '👤', desc: 'Sign in to start creating' },
}

function Profile() {
  const {
    openCardDetails,
    favorites,
    toggleFavorite,
    balance,
    currentUser,
    openAuthModal,
    updateAvatar,
    updateProfile,
  } = useOutletContext()
  const [cropSrc, setCropSrc] = useState(null)
  const [profileForm, setProfileForm] = useState({
    username: currentUser?.username || '',
    email: currentUser?.email || '',
  })
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const allCards = [...homeCards, ...exploreCards, ...profileCreations]
  const favoriteCards = allCards.filter((card) => favorites.includes(card.id))
  const giftInventory = currentUser?.inventory || []
  const roleName = currentUser?.role || 'Visitor'
  const roleInfo = ROLE_CONFIG[roleName] || ROLE_CONFIG.Visitor
  const isAdmin = roleName === 'Admin'
  const isArtist = roleName === 'Artist'

  // Placeholder stats
  const publishedCount = isArtist
    ? JSON.parse(localStorage.getItem('cardora:publishedTemplates') || '[]').length
    : 0

  useEffect(() => {
    setProfileForm({
      username: currentUser?.username || '',
      email: currentUser?.email || '',
    })
  }, [currentUser?.email, currentUser?.username])

  const resetProfileForm = () => {
    setProfileForm({
      username: currentUser?.username || '',
      email: currentUser?.email || '',
    })
    setProfileError('')
    setProfileMessage('')
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    setProfileError('')
    setProfileMessage('')
    setIsSavingProfile(true)
    const result = await updateProfile?.({
      username: profileForm.username.trim(),
      email: profileForm.email.trim(),
    })
    setIsSavingProfile(false)
    if (!result?.ok) {
      setProfileError(result?.message || 'Could not update your profile.')
      return
    }
    setProfileMessage('Profile updated successfully.')
    setTimeout(() => setProfileMessage(''), 2200)
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        {/* Profile Card */}
        <div className="profile profile-enhanced">
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

          {/* Role Badge */}
          <div className={`profile-role-badge ${roleInfo.badge}`}>
            <span className="role-icon">{roleInfo.icon}</span>
            <span className="role-name">{roleName}</span>
          </div>
          <p className="profile-role-desc">{roleInfo.desc}</p>

          {/* Stats Row */}
          <div className="profile-stats">
            <div className="profile-stat">
              <strong>{balance}</strong>
              <span>CC Balance</span>
            </div>
            <div className="profile-stat">
              <strong>{favoriteCards.length}</strong>
              <span>Saved</span>
            </div>
            <div className="profile-stat">
              <strong>{giftInventory.length}</strong>
              <span>Gifts</span>
            </div>
            {isArtist && (
              <div className="profile-stat">
                <strong>{publishedCount}</strong>
                <span>Published</span>
              </div>
            )}
          </div>

          {/* Admin quick link */}
          {isAdmin && (
            <Link to="/admin" className="profile-admin-link">
              <span>⚡</span> Open Admin Dashboard
            </Link>
          )}
        </div>

        {!currentUser ? (
          <p className="empty-state">Sign in to personalize your profile.</p>
        ) : null}

        {currentUser ? (
          <div className="auth-card profile-settings-card">
            <div className="profile-settings-head">
              <div>
                <p className="eyebrow">Account</p>
                <h4 className="section-title">Backend Profile Settings</h4>
              </div>
              <span className="cc-chip">{currentUser.currency || 'NGN'}</span>
            </div>
            <form className="auth-form" onSubmit={handleProfileSubmit}>
              <label className="detail-field">
                Username
                <small className="detail-hint">Matches the backend `update-profile` username field.</small>
                <input
                  name="username"
                  type="text"
                  value={profileForm.username}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, username: event.target.value }))
                  }
                  placeholder="cardora_user"
                />
              </label>
              <label className="detail-field">
                Email
                <small className="detail-hint">Matches the backend `update-profile` email field.</small>
                <input
                  name="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="you@example.com"
                />
              </label>
              {profileMessage ? <p className="auth-status">{profileMessage}</p> : null}
              {profileError ? <p className="auth-error">{profileError}</p> : null}
              <div className="detail-actions">
                <button className="primary" type="submit" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={resetProfileForm}
                  disabled={isSavingProfile}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* Saved Cards */}
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

        {/* My Creations */}
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

          {/* Gift Inventory — display only */}
          <h4 className="section-title">Gift Inventory</h4>
          {giftInventory.length ? (
            <div className="inventory inventory-clean">
              {giftInventory.map((gift, index) => (
                <InventoryCard
                  key={`${gift.title}-${index}`}
                  {...gift}
                  variant={`v${(index % 4) + 1}`}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">No gift effects purchased yet. Visit the Store to browse gifts.</p>
          )}
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
