import { useOutletContext, Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import InventoryCard from '../components/InventoryCard.jsx'
import Dropdown from '../components/Dropdown.jsx'
import AvatarCropModal from '../components/AvatarCropModal.jsx'
import ShareCardModal from '../components/ShareCardModal.jsx'
import StatusModal from '../components/StatusModal.jsx'
import { useAppConfirm } from '../hooks/useAppConfirm.jsx'
import { uploadToCloudinary, dataUrlToBlob } from '../lib/cloudinary.js'

const CURRENCY_FALLBACK = ['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'KES', 'ZAR']
import { getUserAnalytics, getCurrencies, updateCurrency, getUserCurrency, getCardAnalytics, getMyTemplates } from '../lib/api.js'
import { mapTemplateToCard } from '../lib/backendMappers.js'

const STUDIO_DRAFT_PREFIX = 'cardora:studioDrafts:'

const ROLE_CONFIG = {
  Artist: { badge: 'role-artist', icon: '🎨', desc: 'Create and publish templates to the marketplace' },
  User: { badge: 'role-user', icon: '✨', desc: 'Build and send personalized card experiences' },
  Admin: { badge: 'role-admin', icon: '⚡', desc: 'Monitor platform activity and manage content' },
  Moderator: { badge: 'role-moderator', icon: '🛡', desc: 'Help keep Cardora safe and welcoming' },
  Enterprise: { badge: 'role-enterprise', icon: '🏢', desc: 'Business account with analytics and ad management' },
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
    updateProfile,
    getUserCardsFromBackend,
    deleteCardOnBackend,
    onDeleteAccount,
    onLogout,
    artistApplyAction,
    marketplaceTemplates,
    deleteMarketplaceTemplate,
    onCurrencyChange,
  } = useOutletContext()
  const navigate = useNavigate()
  const { confirm: appConfirm, ConfirmModal } = useAppConfirm()
  const [statusModal, setStatusModal] = useState(null)
  const avatarInputRef = useRef(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState('')
  const [userCards, setUserCards] = useState([])
  const [savedDrafts, setSavedDrafts] = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [showArtistForm, setShowArtistForm] = useState(false)
  const [artistForm, setArtistForm] = useState({ portfolio: '', bio: '', contact: '' })
  const [artistMsg, setArtistMsg] = useState({ text: '', ok: false })
  const [isApplying, setIsApplying] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', username: '', bio: '' })
  const [editMsg, setEditMsg] = useState({ text: '', ok: false })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [currencies, setCurrencies] = useState([])
  const [userCurrency, setUserCurrency] = useState('')
  const [isSavingCurrency, setIsSavingCurrency] = useState(false)
  const [showAllStats, setShowAllStats] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [cardAnalytics, setCardAnalytics] = useState({}) // keyed by slug
  const [loadingCardAnalytics, setLoadingCardAnalytics] = useState({}) // keyed by slug
  const [shareTarget, setShareTarget] = useState(null) // { url, title } | null
  const [myTemplates, setMyTemplates] = useState(null) // null = not loaded yet

  const fetchCardAnalytics = async (slug) => {
    if (!slug || cardAnalytics[slug] !== undefined) return
    setLoadingCardAnalytics(prev => ({ ...prev, [slug]: true }))
    try {
      const res = await getCardAnalytics(slug)
      setCardAnalytics(prev => ({ ...prev, [slug]: res?.analytics || res?.data || res || null }))
    } catch {
      setCardAnalytics(prev => ({ ...prev, [slug]: null }))
    } finally {
      setLoadingCardAnalytics(prev => ({ ...prev, [slug]: false }))
    }
  }

  // Favorites resolve against whatever the user has favorited from the live
  // marketplace — no demo-data fallback.
  const favoriteCards = (marketplaceTemplates || []).filter((card) => favorites.includes(card.id))
  const giftInventory = currentUser?.inventory || []
  const roleName = currentUser?.role || 'Visitor'
  const totalCardCount = userCards.length + savedDrafts.length
  const roleInfo = ROLE_CONFIG[roleName] || ROLE_CONFIG.Visitor
  const isAdmin = roleName === 'Admin'
  const isArtist = roleName === 'Artist'
  const isModerator = roleName === 'Moderator'
  const isEnterprise = roleName === 'Enterprise'

  // Prefer own templates (incl. pending) from dedicated endpoint; fall back to public marketplace filter
  const publishedTemplates = myTemplates !== null
    ? myTemplates
    : (marketplaceTemplates || []).filter((t) => {
        if (!isArtist || !currentUser?.id) return false
        return t.ownerId && String(t.ownerId) === String(currentUser.id)
      })

  useEffect(() => {
    if (currentUser?.id) {
      setSavedDrafts(JSON.parse(localStorage.getItem(`${STUDIO_DRAFT_PREFIX}${currentUser.id}`) || '[]'))
    } else {
      setSavedDrafts([])
    }
  }, [currentUser])


  useEffect(() => {
    if (!cropSrc || !cropSrc.startsWith('blob:')) return undefined
    return () => URL.revokeObjectURL(cropSrc)
  }, [cropSrc])

  // Load analytics, currencies, user currency, and own templates
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    ;(async () => {
      try {
        const isArtistRole = (currentUser.role || '').toLowerCase() === 'artist'
        const [a, c, uc, myT] = await Promise.all([
          getUserAnalytics().catch(() => null),
          getCurrencies().catch(() => null),
          getUserCurrency().catch(() => null),
          isArtistRole ? getMyTemplates().catch(() => null) : Promise.resolve(null),
        ])
        if (cancelled) return
        if (a) setAnalytics(a.analytics || a.data || a)
        if (c) {
          const raw = c.currencies || c.data || (Array.isArray(c) ? c : [])
          const fromApi = raw.map(item => typeof item === 'string' ? item : item.code || item)
          const merged = [...new Set([...CURRENCY_FALLBACK, ...fromApi])]
          setCurrencies(merged)
        } else {
          setCurrencies(CURRENCY_FALLBACK)
        }
        if (uc) setUserCurrency(uc.currency || uc.code || uc.data?.currency || '')
        if (myT) {
          const raw = myT.templates || myT.data?.templates || myT.data || (Array.isArray(myT) ? myT : null)
          if (Array.isArray(raw)) setMyTemplates(raw.map((t, i) => mapTemplateToCard(t, i)))
        }
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [currentUser])

  const handleSaveProfile = async () => {
    if (!editForm.name.trim()) {
      setEditMsg({ text: 'Name is required.', ok: false })
      return
    }
    setIsSavingProfile(true)
    try {
      const result = await updateProfile({
        name: editForm.name.trim(),
        username: editForm.username.trim(),
        bio: editForm.bio.trim(),
      })
      if (!result?.ok) {
        setEditMsg({ text: result?.message || 'Could not update profile.', ok: false })
        return
      }
      setEditMsg({ text: 'Profile updated!', ok: true })
      setTimeout(() => { setShowEditProfile(false); setEditMsg({ text: '', ok: false }) }, 900)
    } catch (err) {
      setEditMsg({ text: err?.message || 'Could not update profile.', ok: false })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleCurrencyChange = async (code) => {
    setUserCurrency(code)
    setIsSavingCurrency(true)
    try {
      await (onCurrencyChange ? onCurrencyChange(code) : updateCurrency({ currency: code }))
    } catch { /* ignore */ }
    setIsSavingCurrency(false)
  }

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
    const confirmed = await appConfirm('Delete Card', 'This card and its link will be permanently deleted.', { confirm: 'Delete', danger: true })
    if (!confirmed) return
    try {
      const result = await deleteCardOnBackend(cardId)
      if (result.ok) {
        setUserCards(prev => prev.filter(c => (c._id || c.id) !== cardId))
      } else {
        setStatusModal({ type: 'error', message: result.message || 'Could not delete this card.' })
      }
    } catch {
      setStatusModal({ type: 'error', message: 'Could not delete this card. Please try again.' })
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
          <button
            className={`avatar upload-avatar${isUploadingAvatar ? ' uploading' : ''}`}
            type="button"
            onClick={() => !isUploadingAvatar && currentUser && avatarInputRef.current?.click()}
            disabled={isUploadingAvatar}
            title={isUploadingAvatar ? 'Uploading avatar...' : 'Change avatar'}
          >
            {isUploadingAvatar ? (
              <span className="avatar-uploading-spinner" />
            ) : currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" draggable="false" />
            ) : (
              <span>{currentUser ? currentUser.name.charAt(0) : '?'}</span>
            )}
          </button>
          <input
            ref={avatarInputRef}
            className="upload-avatar-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file || !currentUser) return
              if (cropSrc && cropSrc.startsWith('blob:')) {
                URL.revokeObjectURL(cropSrc)
              }
              setCropSrc(URL.createObjectURL(file))
              event.target.value = ''
            }}
          />
          {avatarUploadError && (
            <p className="store-earn-msg error" style={{ marginBottom: 4 }}>{avatarUploadError}</p>
          )}
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
              <button
                type="button"
                className={`profile-referral-code profile-referral-copy ${codeCopied ? 'copied' : ''}`}
                title="Click to copy"
                onClick={() => {
                  navigator.clipboard?.writeText(currentUser.referralCode).then(() => {
                    setCodeCopied(true)
                    setTimeout(() => setCodeCopied(false), 1600)
                  }).catch(() => {})
                }}
              >
                {codeCopied ? '✓ Copied!' : currentUser.referralCode}
              </button>
            </div>
          )}

          {/* Stats Row — primary stats always visible, secondary behind toggle */}
          <div className="profile-stats">
            <div className="profile-stat">
              <strong>{balance}</strong>
              <span>CC Balance</span>
            </div>
            <div className="profile-stat">
              <strong>{totalCardCount}</strong>
              <span>Cards</span>
            </div>
            <div className="profile-stat">
              <strong>{analytics?.totalViews ?? analytics?.views ?? 0}</strong>
              <span>Views</span>
            </div>
            <div className="profile-stat">
              <strong>{analytics?.totalLikes ?? analytics?.likes ?? 0}</strong>
              <span>Likes</span>
            </div>

            {showAllStats && (
              <>
                <div className="profile-stat">
                  <strong>{analytics?.totalEarned ?? analytics?.ccEarned ?? 0}</strong>
                  <span>CC Earned</span>
                </div>
                <div className="profile-stat">
                  <strong>{favoriteCards.length}</strong>
                  <span>Saved</span>
                </div>
                <div className="profile-stat">
                  <strong>{giftInventory.length}</strong>
                  <span>Gifts</span>
                </div>
                {currentUser?.referralsCount > 0 && (
                  <div className="profile-stat">
                    <strong>{currentUser.referralsCount}</strong>
                    <span>Referrals</span>
                  </div>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            className="profile-stats-toggle"
            onClick={() => setShowAllStats(prev => !prev)}
          >
            {showAllStats ? 'Show less' : 'More stats'}
          </button>

          {/* Edit profile */}
          {currentUser && (
            <button
              className="profile-edit-btn"
              type="button"
              onClick={() => {
                setEditForm({
                  name: currentUser.name || '',
                  username: currentUser.username || '',
                  bio: currentUser.bio || '',
                })
                setEditMsg({ text: '', ok: false })
                setShowEditProfile(true)
              }}
            >
              Edit Profile
            </button>
          )}

          {/* Role dashboard quick links */}
          {isAdmin && (
            <Link to="/admin" className="profile-admin-link">
              <span>⚡</span> Open Admin Dashboard
            </Link>
          )}
          {isModerator && (
            <Link to="/moderator" className="profile-admin-link">
              <span>🛡</span> Open Moderator Dashboard
            </Link>
          )}
          {isEnterprise && (
            <Link to="/enterprise" className="profile-admin-link">
              <span>🏢</span> Open Enterprise Dashboard
            </Link>
          )}

          {/* Artist Apply */}
          {!isArtist && !isAdmin && !isModerator && !isEnterprise && currentUser && (
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

        {/* Currency preference */}
        {currentUser && (
          <div className="profile-currency">
            <h4 className="section-title">Display Currency</h4>
            <div className="profile-currency-row">
              <Dropdown
                value={userCurrency}
                onChange={handleCurrencyChange}
                disabled={isSavingCurrency}
                placeholder="Select currency"
                options={(currencies.length ? currencies : CURRENCY_FALLBACK).map((c) => ({
                  value: typeof c === 'string' ? c : c.code,
                  label: typeof c === 'string' ? c : `${c.code}${c.name ? ` — ${c.name}` : ''}`,
                }))}
              />
              {isSavingCurrency && <span className="profile-currency-saving">Saving...</span>}
            </div>
          </div>
        )}

        {currentUser && savedDrafts.length > 0 ? (
          <div>
            <h4 className="section-title">Drafts</h4>
            <div className="card-grid compact">
              {savedDrafts.map((draft, index) => (
                <div key={draft.id} className="profile-card-wrap">
                  <CardItem
                    {...draft}
                    variant={`v${(index % 4) + 1}`}
                    isFavorite={false}
                    onToggleFavorite={() => {}}
                    onClick={() =>
                      navigate('/studio', {
                        state: {
                          cardData: draft,
                          draftId: draft.id,
                          draftCardObject: draft.cardObject,
                        },
                      })
                    }
                  />
                  <div className="profile-card-actions">
                    <button
                      className="profile-card-action-btn profile-card-action-pill edit"
                      type="button"
                      onClick={() =>
                        navigate('/studio', {
                          state: {
                            cardData: draft,
                            draftId: draft.id,
                            draftCardObject: draft.cardObject,
                          },
                        })
                      }
                      title="Edit draft"
                    >
                      Edit
                    </button>
                    <button
                      className="profile-card-action-btn profile-card-action-pill delete"
                      type="button"
                      onClick={() => {
                        if (!currentUser?.id) return
                        const nextDrafts = savedDrafts.filter((item) => item.id !== draft.id)
                        localStorage.setItem(`${STUDIO_DRAFT_PREFIX}${currentUser.id}`, JSON.stringify(nextDrafts))
                        setSavedDrafts(nextDrafts)
                      }}
                      title="Delete draft"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Published Templates (artists only) — owner-scoped: deletion happens here only */}
        {isArtist && (
          <div>
            <h4 className="section-title">
              Published Templates
              {publishedTemplates.length > 0 && <span className="section-count"> ({publishedTemplates.length})</span>}
            </h4>
            {publishedTemplates.length > 0 ? (
              <div className="card-grid compact">
                {publishedTemplates.map((card, index) => (
                  <div key={card.id} className="profile-card-wrap">
                    <CardItem
                      {...card}
                      variant={`v${(index % 4) + 1}`}
                      isFavorite={favorites.includes(card.id)}
                      onToggleFavorite={toggleFavorite}
                      onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                    />
                    <div className="profile-template-analytics">
                      <span className={`profile-template-status profile-template-status-${(card.status || 'approved')}`}>
                        {card.tag || 'Live'}
                      </span>
                      <span className="profile-template-stat">
                        <strong>{card.userCount ?? 0}</strong> views
                      </span>
                      <span className="profile-template-stat">
                        <strong>{card.likeCount ?? 0}</strong> likes
                      </span>
                    </div>
                    <div className="profile-card-actions">
                      <button
                        type="button"
                        className="profile-card-action-btn delete"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!await appConfirm('Delete Template', `Delete "${card.title}"? This cannot be undone.`, { variant: 'danger', confirmLabel: 'Delete' })) return
                          const res = await deleteMarketplaceTemplate?.(card.templateId || card.id)
                          if (res?.ok) {
                            setMyTemplates(prev => prev !== null ? prev.filter(t => (t.templateId || t.id) !== (card.templateId || card.id)) : null)
                          } else {
                            setStatusModal({ type: 'error', message: res?.message || 'Delete failed.' })
                          }
                        }}
                        title="Delete template"
                        aria-label="Delete template"
                      >
                        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h14M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 6l1 11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2l1-11" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                You haven't published any templates yet. Create one in the Studio and click Publish.
              </p>
            )}
          </div>
        )}

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
                {userCards.map((card) => {
                  const typeVariant = { personal: 'v1', poll: 'v2', trivia: 'v3', chain: 'v4', anonymous: 'v5' }[card.type] || 'v1'
                  return (
                  <div key={card.id} className={`profile-card-wrap profile-card-type-${card.type || 'personal'}`}>
                    <CardItem
                      {...card}
                      variant={typeVariant}
                      showTypeBadge={true}
                      isFavorite={favorites.includes(card.id)}
                      onToggleFavorite={toggleFavorite}
                      onClick={() => card.slug
                        ? navigate(`/card/${card.slug}/responses`)
                        : openCardDetails({ ...card, variant: typeVariant })
                      }
                    />
                    <div className="profile-card-actions">
                      {card.slug && (
                        <button
                          className="profile-card-action-btn share"
                          type="button"
                          onClick={() => setShareTarget({
                            url: `${window.location.origin}/card/${card.slug}`,
                            title: `Check out this "${card.title || 'card'}" I made on Cardora`,
                          })}
                          title="Share card"
                        >
                          🔗
                        </button>
                      )}
                      {card.slug && (
                        <button
                          className="profile-card-action-btn stats"
                          type="button"
                          onClick={() => fetchCardAnalytics(card.slug)}
                          title="View analytics"
                        >
                          📊
                        </button>
                      )}
                      <button
                        className="profile-card-action-btn delete"
                        type="button"
                        onClick={() => handleDeleteCard(card._id || card.id)}
                        title="Delete card"
                      >
                        🗑
                      </button>
                    </div>
                    {card.slug && cardAnalytics[card.slug] !== undefined && (
                      <div className="profile-card-analytics">
                        {loadingCardAnalytics[card.slug] ? (
                          <span className="profile-card-analytics-loading">Loading…</span>
                        ) : cardAnalytics[card.slug] ? (
                          <>
                            <span>{cardAnalytics[card.slug].views ?? 0} views</span>
                            <span>{cardAnalytics[card.slug].likes ?? 0} likes</span>
                            <span>{cardAnalytics[card.slug].responses ?? cardAnalytics[card.slug].replies ?? 0} replies</span>
                          </>
                        ) : (
                          <span className="profile-card-analytics-empty">No data yet</span>
                        )}
                      </div>
                    )}
                  </div>
                  )
                })}
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
              {currentUser.ccIncomeHistory.slice().reverse().slice(0, 10).map((entry, i) => (
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
        onSave={async (dataUrl) => {
          setCropSrc(null)
          setIsUploadingAvatar(true)
          setAvatarUploadError('')
          try {
            const blob = dataUrlToBlob(dataUrl)
            const cloudUrl = await uploadToCloudinary(blob, 'image')
            const result = await updateProfile({ profilePictureUrl: cloudUrl })
            if (!result?.ok) {
              throw new Error(result?.message || 'Avatar sync failed.')
            }
          } catch (err) {
            setAvatarUploadError('Avatar upload failed. Please try again.')
            console.error('Avatar upload error:', err)
          } finally {
            setIsUploadingAvatar(false)
          }
        }}
      />

      <ShareCardModal
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        url={shareTarget?.url || ''}
        title={shareTarget?.title || 'Check out this card I made on Cardora'}
      />

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => setShowEditProfile(false)} />
          <div className="detail-card artist-apply-modal">
            <p className="eyebrow">Profile</p>
            <h3>Edit your profile</h3>
            <label className="detail-field">
              Name
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
              />
            </label>
            <label className="detail-field">
              Username
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="@username"
              />
            </label>
            <label className="detail-field">
              Bio
              <textarea
                rows={3}
                value={editForm.bio}
                onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="A short bio..."
              />
            </label>
            {editMsg.text && <p className={`store-earn-msg artist-apply-msg ${editMsg.ok ? 'success' : 'error'}`}>{editMsg.text}</p>}
            <div className="detail-actions artist-apply-actions">
              <button className="primary" type="button" onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="ghost" type="button" onClick={() => setShowEditProfile(false)}>Cancel</button>
            </div>
          </div>
        </section>
      )}

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
            {artistMsg.text && <p className={`store-earn-msg artist-apply-msg ${artistMsg.ok ? 'success' : 'error'}`}>{artistMsg.text}</p>}
            <div className="detail-actions artist-apply-actions">
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
          <div className="detail-backdrop" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }} />
          <div className="detail-card delete-confirm-modal">
            <span className="delete-confirm-icon">⚠️</span>
            <h3>Delete your account?</h3>
            <p className="detail-subtitle">This action is permanent. All your cards, CC balance, and data will be lost.</p>
            <p className="delete-confirm-instruction">Type <strong>DELETE</strong> to confirm:</p>
            <input
              className="delete-confirm-input"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <div className="detail-actions artist-apply-actions">
              <button
                className="profile-delete-btn"
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== 'DELETE'}
              >
                {isDeleting ? 'Deleting...' : 'Yes, delete my account'}
              </button>
              <button className="ghost" type="button" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}>Cancel</button>
            </div>
          </div>
        </section>
      )}
      {ConfirmModal}
      {statusModal && (
        <StatusModal
          type={statusModal.type}
          message={statusModal.message}
          onClose={() => setStatusModal(null)}
        />
      )}
    </div>
  )
}

export default Profile













