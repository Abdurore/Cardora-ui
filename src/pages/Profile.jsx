import { useOutletContext, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import InventoryCard from '../components/InventoryCard.jsx'
import AvatarCropModal from '../components/AvatarCropModal.jsx'
import { exploreCards, homeCards, profileCreations } from '../data/catalog.js'

const ROLE_CONFIG = {
  Artist: { badge: 'role-artist', icon: '🎨', desc: 'Create and publish templates to the marketplace' },
  User: { badge: 'role-user', icon: '✨', desc: 'Build and send personalized card experiences' },
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
    getUserCardsFromBackend,
    deleteCardOnBackend,
    onDeleteAccount,
    onLogout,
    artistApplyAction,
  } = useOutletContext()
  const navigate = useNavigate()
  const [cropSrc, setCropSrc] = useState(null)
  const [userCards, setUserCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [showArtistForm, setShowArtistForm] = useState(false)
  const [artistForm, setArtistForm] = useState({ portfolio: '', bio: '', contact: '' })
  const [artistMsg, setArtistMsg] = useState({ text: '', ok: false })
  const [isApplying, setIsApplying] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const allCards = [...homeCards, ...exploreCards, ...profileCreations]
  const favoriteCards = allCards.filter((card) => favorites.includes(card.id))
  const giftInventory = currentUser?.inventory || []
  const roleName = currentUser?.role || 'Visitor'
  const roleInfo = ROLE_CONFIG[roleName] || ROLE_CONFIG.Visitor
  const isAdmin = roleName === 'Admin'
  const isArtist = roleName === 'Artist'

  // Load user cards from backend
  useEffect(() => {
    if (!currentUser || !getUserCardsFromBackend) return
    let cancelled = false
    setLoadingCards(true)
    ;(async () => {
      const result = await getUserCardsFromBackend()
      if (!cancelled) {
        setUserCards(result.cards || [])
        setLoadingCards(false)
      }
    })()
    return () => { cancelled = true }
  }, [currentUser, getUserCardsFromBackend])

  const handleDeleteCard = async (cardId) => {
    const result = await deleteCardOnBackend(cardId)
    if (result.ok) {
      setUserCards(prev => prev.filter(c => c.id !== cardId))
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    const result = await onDeleteAccount()
    if (result.ok) {
      navigate('/')
    } else {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleArtistSubmit = async () => {
    if (!artistForm.portfolio.trim() || !artistForm.bio.trim() || !artistForm.contact.trim()) {
      setArtistMsg({ text: 'All fields are required.', ok: false })
      return
    }
    setIsApplying(true)
    const result = await artistApplyAction(artistForm)
    setArtistMsg({ text: result.message, ok: result.ok })
    setIsApplying(false)
    if (result.ok) setShowArtistForm(false)
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

          {/* Bio */}
          {currentUser?.bio && <p className="profile-bio">{currentUser.bio}</p>}

          {/* Referral Code */}
          {currentUser?.referralCode && (
            <div className="profile-referral">
              <span className="profile-referral-label">Referral Code:</span>
              <code className="profile-referral-code">{currentUser.referralCode}</code>
            </div>
          )}

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
            <div className="profile-stat">
              <strong>{userCards.length}</strong>
              <span>Cards</span>
            </div>
            {currentUser?.referralsCount > 0 && (
              <div className="profile-stat">
                <strong>{currentUser.referralsCount}</strong>
                <span>Referrals</span>
              </div>
            )}
          </div>

          {/* Admin quick link */}
          {isAdmin && (
            <Link to="/admin" className="profile-admin-link">
              <span>⚡</span> Open Admin Dashboard
            </Link>
          )}

          {/* Artist Apply */}
          {!isArtist && !isAdmin && currentUser && (
            <button
              className="profile-artist-apply-btn"
              type="button"
              onClick={() => setShowArtistForm(true)}
            >
              🎨 Apply as Artist
            </button>
          )}
        </div>

        {!currentUser ? (
          <p className="empty-state">Sign in to personalize your profile.</p>
        ) : null}

        {/* My Cards (from backend) */}
        {currentUser && (
          <div>
            <h4 className="section-title">My Cards</h4>
            {loadingCards ? (
              <div className="profile-cards-loading">
                <div className="chat-loading-spinner" />
                <p>Loading your cards...</p>
              </div>
            ) : userCards.length > 0 ? (
              <div className="card-grid compact">
                {userCards.map((card, index) => (
                  <div key={card.id} className="profile-card-wrap">
                    <CardItem
                      {...card}
                      variant={`v${(index % 4) + 1}`}
                      isFavorite={favorites.includes(card.id)}
                      onToggleFavorite={toggleFavorite}
                      onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                    />
                    <div className="profile-card-actions">
                      {card.slug && (
                        <button
                          className="profile-card-action-btn share"
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}/card/${card.slug}`
                            navigator.clipboard?.writeText(url)
                          }}
                          title="Copy link"
                        >
                          🔗
                        </button>
                      )}
                      <button
                        className="profile-card-action-btn delete"
                        type="button"
                        onClick={() => handleDeleteCard(card.id)}
                        title="Delete card"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">You haven't created any cards yet. Head to the Studio to make one!</p>
            )}
          </div>
        )}

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

        {/* Gift Inventory — display only */}
        <div>
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
            <p className="empty-state">Gift inventory is coming soon.</p>
          )}
        </div>

        {/* CC Income History */}
        {currentUser?.ccIncomeHistory?.length > 0 && (
          <div>
            <h4 className="section-title">CC Income History</h4>
            <div className="profile-income-list">
              {currentUser.ccIncomeHistory.slice(0, 10).map((entry, i) => (
                <div key={`income-${i}`} className="profile-income-row">
                  <span className="profile-income-type">{(entry.type || entry.source || 'unknown').replace(/_/g, ' ')}</span>
                  <span className="profile-income-amount">+{entry.amount || entry.cc || 0} CC</span>
                  <span className="profile-income-date">{entry.date || entry.createdAt ? new Date(entry.date || entry.createdAt).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {currentUser && (
          <div className="profile-danger-zone">
            <h4 className="section-title">Account</h4>
            <button className="ghost" type="button" onClick={onLogout}>
              Log Out
            </button>
            <button
              className="profile-delete-btn"
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Account
            </button>
          </div>
        )}
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

      {/* Artist Application Modal */}
      {showArtistForm && (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => setShowArtistForm(false)} />
          <div className="detail-card artist-apply-modal">
            <p className="eyebrow">Artist Program</p>
            <h3>Apply to become an Artist</h3>
            <p className="detail-subtitle">Share your creative background and we'll review your application.</p>
            <label className="detail-field">
              Portfolio URL
              <input
                type="url"
                value={artistForm.portfolio}
                onChange={e => setArtistForm(prev => ({ ...prev, portfolio: e.target.value }))}
                placeholder="https://your-portfolio.com"
              />
            </label>
            <label className="detail-field">
              Bio / Experience
              <textarea
                rows={3}
                value={artistForm.bio}
                onChange={e => setArtistForm(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell us about your creative background..."
              />
            </label>
            <label className="detail-field">
              Contact Email
              <input
                type="email"
                value={artistForm.contact}
                onChange={e => setArtistForm(prev => ({ ...prev, contact: e.target.value }))}
                placeholder="artist@example.com"
              />
            </label>
            {artistMsg.text && <p className={`store-earn-msg ${artistMsg.ok ? 'success' : 'error'}`}>{artistMsg.text}</p>}
            <div className="detail-actions">
              <button className="primary" type="button" onClick={handleArtistSubmit} disabled={isApplying}>
                {isApplying ? 'Submitting...' : 'Submit Application'}
              </button>
              <button className="ghost" type="button" onClick={() => setShowArtistForm(false)}>Cancel</button>
            </div>
          </div>
        </section>
      )}

      {/* Delete Account Confirm Modal */}
      {showDeleteConfirm && (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => setShowDeleteConfirm(false)} />
          <div className="detail-card delete-confirm-modal">
            <span className="delete-confirm-icon">⚠️</span>
            <h3>Delete your account?</h3>
            <p className="detail-subtitle">This action is permanent. All your cards, CC balance, and data will be lost.</p>
            <div className="detail-actions">
              <button
                className="profile-delete-btn"
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
              </button>
              <button className="ghost" type="button" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default Profile
