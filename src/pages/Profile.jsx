import { useOutletContext, Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { MdPalette, MdBolt, MdDomain } from 'react-icons/md'
import { IoSparkles, IoPersonOutline } from 'react-icons/io5'
import { BiShield } from 'react-icons/bi'
import { FaCrown } from 'react-icons/fa'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import Dropdown from '../components/Dropdown.jsx'
import AvatarCropModal from '../components/AvatarCropModal.jsx'
import ShareCardModal from '../components/ShareCardModal.jsx'
import StatusModal from '../components/StatusModal.jsx'
import PushNotificationToggle from '../components/PushNotificationToggle.jsx'
import { useAppConfirm } from '../hooks/useAppConfirm.jsx'
import { uploadToCloudinary, dataUrlToBlob } from '../lib/cloudinary.js'

const CURRENCY_FALLBACK = ['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'KES', 'ZAR']
import { getUserAnalytics, getCurrencies, updateCurrency, getUserCurrency, getMyTemplates, createPremiumCheckout, giftPremium, getProfileBackgrounds, equipProfileBackground, updateTemplate, getEnterpriseAdStats, getReminders, createReminder, deleteReminder } from '../lib/api.js'
import { validateUsername } from '../lib/username.js'
import { mapTemplateToCard, normalizeCheckoutSession } from '../lib/backendMappers.js'
import { EXPLORE_OCCASION_TABS } from '../lib/occasionTaxonomy.js'

const STUDIO_DRAFT_PREFIX = 'cardora:studioDrafts:'

const ROLE_CONFIG = {
  Artist: { badge: 'role-artist', icon: <MdPalette size={16} />, desc: 'Create and publish templates to the marketplace' },
  User: { badge: 'role-user', icon: <IoSparkles size={16} />, desc: 'Build and send personalized card experiences' },
  Admin: { badge: 'role-admin', icon: <MdBolt size={16} />, desc: 'Monitor platform activity and manage content' },
  Moderator: { badge: 'role-moderator', icon: <BiShield size={16} />, desc: 'Help keep Cardora safe and welcoming' },
  Enterprise: { badge: 'role-enterprise', icon: <MdDomain size={16} />, desc: 'Business account with analytics and ad management' },
  Visitor: { badge: 'role-visitor', icon: <IoPersonOutline size={16} />, desc: 'Sign in to start creating' },
}

function pickList(res, ...keys) {
  for (const key of keys) {
    if (Array.isArray(res?.[key])) return res[key]
    if (Array.isArray(res?.data?.[key])) return res.data[key]
  }
  if (Array.isArray(res?.data)) return res.data
  if (Array.isArray(res)) return res
  return []
}

function normalizeProfileBackground(bg) {
  const url = bg.url || bg.imageUrl || bg.image || bg.assetUrl || bg.cloudinaryUrl || ''
  return {
    ...bg,
    id: bg.id || bg.backgroundId || bg._id,
    name: bg.name || bg.title || 'Profile Background',
    url,
  }
}

// 6.2: "Manageable and deletable from profile." Extracted rather than
// inlined into the already-huge Profile() body -- self-contained state,
// only needs currentUser to know whether to render at all.
function RemindersSection({ currentUser }) {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [occasion, setOccasion] = useState('Birthday')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const loadReminders = () => {
    getReminders().then((res) => {
      setReminders(pickList(res, 'reminders'))
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!currentUser) return
    loadReminders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  if (!currentUser) return null

  const handleAdd = async () => {
    if (!recipientName.trim() || !date) return
    setSaving(true)
    try {
      await createReminder({ recipientName: recipientName.trim(), occasion, date })
      setRecipientName('')
      setDate('')
      setShowAddForm(false)
      loadReminders()
    } catch { /* keep the form open so they can retry */ } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteReminder(id)
      setReminders((prev) => prev.filter((r) => r.id !== id))
    } catch { /* leave it in the list on failure */ } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="profile-reminders">
      <div className="profile-reminders-head">
        <h4 className="section-title">Occasion Reminders</h4>
        <button type="button" className="ghost" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showAddForm && (
        <div className="profile-reminder-form">
          <input
            type="text"
            placeholder="Who's this for?"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
          <select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
            {EXPLORE_OCCASION_TABS.map((occ) => <option key={occ} value={occ}>{occ}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="primary" onClick={handleAdd} disabled={saving || !recipientName.trim() || !date}>
            {saving ? 'Saving…' : 'Save Reminder'}
          </button>
        </div>
      )}

      {loading ? null : reminders.length === 0 ? (
        <p className="profile-reminders-empty">No reminders yet.</p>
      ) : (
        <div className="profile-reminders-list">
          {reminders.map((r) => (
            <div key={r.id} className="profile-reminder-item">
              <div>
                <strong>{r.recipientName}'s {r.occasion}</strong>
                <span>{new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{r.recurring ? ' · yearly' : ''}</span>
              </div>
              <button
                type="button"
                className="profile-reminder-delete"
                aria-label="Delete reminder"
                onClick={() => handleDelete(r.id)}
                disabled={deletingId === r.id}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



function Profile() {
  const {
    openCardDetails,
    favorites,
    likedTemplates,
    toggleLike,
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
    refreshBalance,
  } = useOutletContext()
  const navigate = useNavigate()
  const location = useLocation()
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
  const [editForm, setEditForm] = useState({ username: '', bio: '' })
  const [editMsg, setEditMsg] = useState({ text: '', ok: false })
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templateEditForm, setTemplateEditForm] = useState({ name: '', category: '', previewImage: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [uploadingTemplateImage, setUploadingTemplateImage] = useState(false)
  const [templateEditMsg, setTemplateEditMsg] = useState({ text: '', ok: false })
  const [analytics, setAnalytics] = useState(null)
  const [enterpriseStats, setEnterpriseStats] = useState(null)
  const [currencies, setCurrencies] = useState([])
  const [userCurrency, setUserCurrency] = useState('')
  const [isSavingCurrency, setIsSavingCurrency] = useState(false)
  const [showAllStats, setShowAllStats] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [shareTarget, setShareTarget] = useState(null) // { url, title } | null
  const [myTemplates, setMyTemplates] = useState(null) // null = not loaded yet

  // Premium state
  const [premiumLoading, setPremiumLoading] = useState(false)
  const [premiumMsg, setPremiumMsg] = useState({ text: '', ok: false })
  const [giftUsername, setGiftUsername] = useState('')
  const [giftLoading, setGiftLoading] = useState(false)
  const [giftMsg, setGiftMsg] = useState({ text: '', ok: false })
  const [profileBgs, setProfileBgs] = useState([]) // admin-uploaded backgrounds
  const [showProfileBgOptions, setShowProfileBgOptions] = useState(false)
  const [equippingBg, setEquippingBg] = useState(null)
  const [bgMsg, setBgMsg] = useState({ text: '', ok: false })
  const profileBgUrl = currentUser?.profileBackground?.url || currentUser?.equippedBackground?.url || currentUser?.profileBackgroundUrl || currentUser?.backgroundUrl || ''
  const profileBgBlur = currentUser?.profileBackground?.blur || currentUser?.equippedBackground?.blur || false
  const equippedBgId = currentUser?.profileBackground?.id || currentUser?.profileBackground?._id || currentUser?.equippedBackground?.id || currentUser?.equippedBackground?._id || ''

  const handleLogoutClick = async () => {
    const confirmed = await appConfirm('Log Out', 'Are you sure you want to log out?', {
      confirmLabel: 'Log Out',
      cancelLabel: 'Cancel',
      variant: 'warning',
    })
    if (confirmed) {
      onLogout()
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const paystackReference = params.get('reference') || params.get('trxref')
    const isPremiumReturn = params.get('premium') === 'callback' || params.get('type') === 'premium'
    if (!paystackReference && !isPremiumReturn) return

    let cancelled = false
    const refreshPremiumState = async () => {
      setPremiumLoading(true)
      setPremiumMsg({ text: 'Confirming premium payment...', ok: true })
      try {
        // The webhook may complete a moment after Paystack redirects back.
        await new Promise(resolve => setTimeout(resolve, 1200))
        await refreshBalance?.()
        if (!cancelled) {
          setPremiumMsg({ text: 'Payment received. Refreshing your premium status...', ok: true })
          navigate('/profile', { replace: true })
        }
      } catch {
        if (!cancelled) {
          setPremiumMsg({ text: 'Payment returned successfully, but we could not refresh your profile yet. Please reload in a moment.', ok: false })
        }
      } finally {
        if (!cancelled) setPremiumLoading(false)
      }
    }
    refreshPremiumState()
    return () => { cancelled = true }
  }, [location.search, navigate, refreshBalance])

  // Favorites resolve against whatever the user has favorited from the live
  // marketplace — no demo-data fallback.
  const favoriteCards = (marketplaceTemplates || []).filter((card) => favorites.includes(card.id))
  const rawRole = String(currentUser?.role || 'Visitor').trim().toLowerCase()
  const roleName = rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
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
        if (!currentUser?.id) return false
        return t.ownerId && String(t.ownerId) === String(currentUser.id)
      })

  // Artists design/publish templates rather than send/receive cards or
  // gifts, so their stats row is template-performance-centric instead.
  const artistTemplateCount = publishedTemplates.length
  const artistTotalLikes = publishedTemplates.reduce((sum, t) => sum + (Number(t.likeCount) || 0), 0)
  const artistTotalViews = publishedTemplates.reduce((sum, t) => sum + (Number(t.viewCount) || 0), 0)
  const artistTotalUses = publishedTemplates.reduce((sum, t) => sum + (Number(t.usageCount) || 0), 0)

  // Enterprise accounts run ads, not personal cards — surface ad performance instead.
  const enterpriseAds = enterpriseStats?.ads || enterpriseStats?.data?.ads || []
  const enterpriseTotals = enterpriseAds.reduce((acc, ad) => ({
    views: acc.views + (Number(ad.currentViews ?? ad.views) || 0),
    clicks: acc.clicks + (Number(ad.clicks ?? ad.clickCount) || 0),
    completions: acc.completions + (Number(ad.completions ?? ad.completed) || 0),
  }), { views: 0, clicks: 0, completions: 0 })

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
        const [a, c, uc, myT] = await Promise.all([
          getUserAnalytics().catch(() => null),
          getCurrencies().catch(() => null),
          getUserCurrency().catch(() => null),
          getMyTemplates(currentUser.id || currentUser._id).catch(() => null),
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
          const raw = pickList(myT, 'templates', 'items', 'docs', 'results')
          if (Array.isArray(raw)) setMyTemplates(raw.map((t, i) => mapTemplateToCard(t, i)))
        }
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [currentUser])

  // Enterprise accounts see ad performance instead of card/gift stats.
  useEffect(() => {
    setEnterpriseStats(null)
    if (!currentUser?.id || String(currentUser?.role || '').toLowerCase() !== 'enterprise') return
    let cancelled = false
    getEnterpriseAdStats()
      .then(res => {
        if (cancelled) return
        const payload = res?.data || res
        setEnterpriseStats(payload)
      })
      .catch(() => { if (!cancelled) setEnterpriseStats(null) })
    return () => { cancelled = true }
  }, [currentUser?.id])

  // Load profile backgrounds for premium users
  useEffect(() => {
    if (!currentUser?.isPremiumActive) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await getProfileBackgrounds()
        const bgs = pickList(res, 'backgrounds', 'profileBackgrounds', 'items', 'media')
        if (!cancelled && Array.isArray(bgs)) setProfileBgs(bgs.map(normalizeProfileBackground).filter(bg => bg.id && bg.url))
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [currentUser?.isPremiumActive])

  const handleEquipBackground = async (bgId) => {
    setEquippingBg(bgId)
    setBgMsg({ text: '', ok: false })
    try {
      const res = await equipProfileBackground(bgId)
      setBgMsg({ text: res?.message || 'Background equipped!', ok: true })
      await refreshBalance?.()
    } catch (err) {
      setBgMsg({ text: err?.message || 'Could not equip background.', ok: false })
    }
    setEquippingBg(null)
  }

  const handleSaveProfile = async () => {
    const nextUsername = editForm.username.trim().replace(/^@/, '')
    const usernameChanged = nextUsername.toLowerCase() !== String(currentUser?.username || '').toLowerCase()
    // Only a *changed* username is checked -- an account created before the
    // username rule existed can still edit its bio.
    const usernameError = usernameChanged ? validateUsername(nextUsername) : (nextUsername ? '' : 'Username is required.')
    if (usernameError) {
      setEditMsg({ text: usernameError, ok: false })
      return
    }
    setIsSavingProfile(true)
    try {
      // The backend's update-profile schema is { username, email, bio,
      // profilePictureUrl } with unknown keys rejected -- there is no
      // separate display name, and the `name` this used to send 400'd every
      // save. Unchanged fields aren't re-sent.
      const payload = { bio: editForm.bio.trim() }
      if (usernameChanged) payload.username = nextUsername
      const result = await updateProfile(payload)
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


  const openTemplateEdit = (card) => {
    setEditingTemplate(card)
    setTemplateEditForm({
      name: card.title || '',
      category: card.category || 'birthday',
      previewImage: card.previewImage || '',
    })
    setTemplateEditMsg({ text: '', ok: false })
  }

  const handleTemplateImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingTemplateImage(true)
    setTemplateEditMsg({ text: '', ok: false })
    try {
      const cloudUrl = await uploadToCloudinary(file, 'image')
      setTemplateEditForm((prev) => ({ ...prev, previewImage: cloudUrl }))
    } catch (err) {
      setTemplateEditMsg({ text: err?.message || 'Image upload failed.', ok: false })
    } finally {
      setUploadingTemplateImage(false)
    }
  }

  const handleSaveTemplateEdit = async () => {
    if (!editingTemplate || !templateEditForm.name.trim()) {
      setTemplateEditMsg({ text: 'Template name is required.', ok: false })
      return
    }
    const templateId = editingTemplate.templateId || editingTemplate.id
    setSavingTemplate(true)
    setTemplateEditMsg({ text: '', ok: false })
    try {
      await updateTemplate({
        templateId,
        name: templateEditForm.name.trim(),
        category: templateEditForm.category,
        previewImage: templateEditForm.previewImage,
      })
      setMyTemplates((prev) => (prev !== null ? prev.map((t) => (
        (t.templateId || t.id) === templateId
          ? { ...t, title: templateEditForm.name.trim(), category: templateEditForm.category, previewImage: templateEditForm.previewImage }
          : t
      )) : null))
      setTemplateEditMsg({ text: 'Template updated!', ok: true })
      setTimeout(() => { setEditingTemplate(null); setTemplateEditMsg({ text: '', ok: false }) }, 900)
    } catch (err) {
      setTemplateEditMsg({ text: err?.message || 'Could not update template.', ok: false })
    } finally {
      setSavingTemplate(false)
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

  const handlePremiumCheckout = async () => {
    if (!currentUser) { openAuthModal(); return }
    setPremiumLoading(true)
    setPremiumMsg({ text: '', ok: false })
    try {
      // 6.9: createPremiumCheckout's Joi schema is allowUnknown:false on an
      // empty body -- these callback fields (the backend builds its own
      // callback URL from its own env config and never read them) 400'd
      // every premium checkout attempt before it ever reached Paystack.
      const res = await createPremiumCheckout()
      const checkout = normalizeCheckoutSession(res)
      if (checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl
      } else {
        setPremiumMsg({ text: checkout.message || 'Premium checkout started, but no checkout URL was returned.', ok: false })
      }
    } catch (err) {
      setPremiumMsg({ text: err?.message || 'Could not start premium checkout.', ok: false })
    }
    setPremiumLoading(false)
  }

  const handleGiftPremium = async () => {
    if (!currentUser) { openAuthModal(); return }
    if (!giftUsername.trim()) { setGiftMsg({ text: 'Enter a username.', ok: false }); return }
    setGiftLoading(true)
    setGiftMsg({ text: '', ok: false })
    try {
      const res = await giftPremium(giftUsername.trim())
      setGiftMsg({ text: res?.message || 'Premium gifted successfully!', ok: true })
      setGiftUsername('')
    } catch (err) {
      setGiftMsg({ text: err?.message || 'Could not gift premium.', ok: false })
    }
    setGiftLoading(false)
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        {/* Profile Card */}
        <div className={`profile profile-enhanced${profileBgUrl ? ' profile-enhanced--with-bg' : ''}`}>
          {profileBgUrl && (
            <>
              <img
                className="profile-enhanced-bg"
                src={profileBgUrl}
                alt=""
                style={profileBgBlur ? { filter: 'blur(6px)', transform: 'scale(1.06)' } : undefined}
              />
              <div className="profile-enhanced-bg-fade" />
            </>
          )}
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
          {currentUser?.isPremiumActive && (
            <div className="profile-role-badge profile-premium-badge">
              <span className="role-icon"><FaCrown size={16} /></span>
              <span className="role-name">Premium</span>
            </div>
          )}
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

          {/* Stats Row — primary stats always visible, secondary behind toggle.
              Tile set differs by role: artists design templates (not gifts/cards),
              enterprise accounts run ads (not personal cards), admins/moderators
              mostly work from their dedicated dashboards. */}
          <div className="profile-stats">
            {isArtist ? (
              <>
                <div className="profile-stat">
                  <strong>{artistTemplateCount}</strong>
                  <span>Templates Published</span>
                </div>
                <div className="profile-stat">
                  <strong>{artistTotalLikes}</strong>
                  <span>Total Likes</span>
                </div>
                <div className="profile-stat">
                  <strong>{artistTotalViews}</strong>
                  <span>Total Views</span>
                </div>
                <div className="profile-stat">
                  <strong>{artistTotalUses}</strong>
                  <span>Total Uses</span>
                </div>
              </>
            ) : isEnterprise ? (
              <>
                <div className="profile-stat">
                  <strong>{enterpriseAds.length}</strong>
                  <span>Active Ads</span>
                </div>
                <div className="profile-stat">
                  <strong>{enterpriseTotals.views}</strong>
                  <span>Ad Views</span>
                </div>
                <div className="profile-stat">
                  <strong>{enterpriseTotals.clicks}</strong>
                  <span>Ad Clicks</span>
                </div>
                <div className="profile-stat">
                  <strong>{enterpriseTotals.completions}</strong>
                  <span>Completions</span>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}

            {showAllStats && (
              <>
                {isArtist ? (
                  <div className="profile-stat">
                    <strong>{analytics?.totalEarned ?? analytics?.ccEarned ?? 0}</strong>
                    <span>CC Earned</span>
                  </div>
                ) : isEnterprise ? (
                  <div className="profile-stat">
                    <strong>{balance}</strong>
                    <span>CC Balance</span>
                  </div>
                ) : (
                  <>
                    <div className="profile-stat">
                      <strong>{analytics?.totalEarned ?? analytics?.ccEarned ?? 0}</strong>
                      <span>CC Earned</span>
                    </div>
                    <div className="profile-stat">
                      <strong>{favoriteCards.length}</strong>
                      <span>Saved</span>
                    </div>
                  </>
                )}
                {!isEnterprise && currentUser?.referralsCount > 0 && (
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
              <span><MdBolt size={18} /></span> Open Admin Dashboard
            </Link>
          )}
          {isModerator && (
            <Link to="/moderator" className="profile-admin-link">
              <span><BiShield size={18} /></span> Open Moderator Dashboard
            </Link>
          )}
          {isEnterprise && (
            <Link to="/enterprise" className="profile-admin-link">
              <span><MdDomain size={18} /></span> Open Enterprise Dashboard
            </Link>
          )}
          {isArtist && (
            <Link to="/artist" className="profile-admin-link">
              <span><MdPalette size={18} /></span> Open Artist Dashboard
            </Link>
          )}

          {/* Artist Apply */}
          {!isArtist && !isAdmin && !isModerator && !isEnterprise && currentUser && (
            <button
              className="profile-artist-apply-btn"
              type="button"
              onClick={() => setShowArtistForm(true)}
            >
              <MdPalette size={18} style={{ marginRight: 6 }} /> Apply as Artist
            </button>
          )}
        </div>

        {/* Moderator and Enterprise are invite-only, admin-assigned roles —
            no self-serve form exists for either. Without this note a
            curious user has no way to learn that, and the absence read as
            a dead end rather than a deliberate gate. */}
        {!isArtist && !isAdmin && !isModerator && !isEnterprise && currentUser && (
          <p className="profile-role-note">
            Looking to run brand campaigns or help moderate the community? Moderator and Enterprise
            accounts are set up by our team — reach out at{' '}
            <a href="mailto:support@cardora.studio">support@cardora.studio</a> and we'll get you set up.
          </p>
        )}

        {!currentUser ? (
          <p className="empty-state">Sign in to personalize your profile.</p>
        ) : null}

        {/* ═══ Premium Membership ═══ */}
        {currentUser && (
          <div className="profile-premium-section">
            <div className="profile-premium-card">
              <div className="profile-premium-header">
                <span className="profile-premium-star"><FaCrown size={24} /></span>
                <div>
                  <h4 className="profile-premium-title">Cardora Premium</h4>
                  <p className="profile-premium-sub">₦500 / 30 days — exclusive profile backgrounds, streak tracking, no ads, and more.</p>
                </div>
              </div>

              <div className="profile-premium-perks-row">
                <span className="profile-premium-perk-chip">Backgrounds</span>
                <span className="profile-premium-perk-chip">Streaks</span>
                <span className="profile-premium-perk-chip">No Ads</span>
                <span className="profile-premium-perk-chip">Gift Premium</span>
              </div>

              {premiumMsg.text && (
                <p className={`store-earn-msg ${premiumMsg.ok ? 'success' : 'error'}`}>{premiumMsg.text}</p>
              )}

              {currentUser?.isPremiumActive ? (
                <div className="profile-premium-active-panel">
                  <span className="profile-premium-active-pill">Premium active</span>
                  <p>
                    {currentUser?.premiumUntil
                      ? `Renews or expires on ${new Date(currentUser.premiumUntil).toLocaleDateString()}.`
                      : 'Your premium perks are enabled.'}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  className="primary profile-premium-btn"
                  onClick={handlePremiumCheckout}
                  disabled={premiumLoading}
                >
                  {premiumLoading ? 'Processing...' : 'Subscribe Now'}
                </button>
              )}
            </div>

            {/* Gift Premium */}
            {currentUser?.isPremiumActive && (
            <div className="profile-premium-gift">
              <p className="profile-premium-gift-label"><MdPalette size={16} style={{ marginRight: 6, display: 'inline-block' }} /> Gift 7 days of Premium to a friend</p>
              <div className="profile-premium-gift-row">
                <input
                  type="text"
                  value={giftUsername}
                  onChange={e => setGiftUsername(e.target.value)}
                  placeholder="Friend's username"
                  onKeyDown={e => { if (e.key === 'Enter') handleGiftPremium() }}
                />
                <button
                  type="button"
                  className="primary"
                  onClick={handleGiftPremium}
                  disabled={giftLoading}
                >
                  {giftLoading ? '...' : 'Send'}
                </button>
              </div>
              {giftMsg.text && (
                <p className={`store-earn-msg ${giftMsg.ok ? 'success' : 'error'}`}>{giftMsg.text}</p>
              )}
            </div>
            )}

            {/* Profile Backgrounds — premium only */}
            {currentUser?.isPremiumActive && (
              <div className="profile-premium-backgrounds">
                <div className="profile-premium-bg-head">
                  <div>
                    <h4>Profile Backgrounds</h4>
                    <p className="profile-premium-bg-hint">
                      Choose a background for your profile.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost profile-premium-bg-toggle"
                    onClick={() => setShowProfileBgOptions(prev => !prev)}
                  >
                    {showProfileBgOptions ? 'Hide options' : 'Choose background'}
                  </button>
                </div>
                {bgMsg.text && (
                  <p className={`store-earn-msg ${bgMsg.ok ? 'success' : 'error'}`}>{bgMsg.text}</p>
                )}
                {showProfileBgOptions && profileBgs.length > 0 ? (
                  <div className="profile-bg-grid">
                    {profileBgs.map(bg => {
                      const bgId = bg.id || bg._id
                      const isActive = bgId && String(bgId) === String(equippedBgId)
                      return (
                        <button
                          key={bgId || bg.url}
                          type="button"
                          className={`profile-bg-card${isActive ? ' active' : ''}`}
                          onClick={() => handleEquipBackground(bgId)}
                          disabled={equippingBg === bgId}
                          title={bg.name || 'Background'}
                        >
                          <img src={bg.url} alt={bg.name || ''} className="profile-bg-img" />
                          <span className="profile-bg-name">
                            {equippingBg === bgId ? 'Equipping...' : isActive ? 'Selected' : (bg.name || 'Unnamed')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : showProfileBgOptions ? (
                  <p className="profile-premium-bg-empty">No premium backgrounds have been added yet.</p>
                ) : null}
              </div>
            )}
          </div>
        )}

        <RemindersSection currentUser={currentUser} />

        <PushNotificationToggle currentUser={currentUser} />

        {currentUser && savedDrafts.length > 0 ? (
          <div>
            <h4 className="section-title">Drafts</h4>
            <div className="card-grid compact">
              {savedDrafts.map((draft, index) => (
                <div key={draft.id} className="profile-card-wrap">
                  <CardItem
                    {...draft}
                    hoverLabel="Open Draft"
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

        {/* Published Templates — owner-scoped: deletion happens here only */}
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
                      isLiked={likedTemplates.includes(card.id)}
                      onToggleLike={toggleLike}
                      onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                    />
                    <div className="profile-template-analytics">
                      <span className={`profile-template-status profile-template-status-${(card.status || 'approved')}`}>
                        {card.tag || 'Live'}
                      </span>
                      <span className="profile-template-stat">
                        <strong>{card.viewCount ?? 0}</strong> views
                      </span>
                      <span className="profile-template-stat">
                        <strong>{card.likeCount ?? 0}</strong> likes
                      </span>
                      <span className="profile-template-stat">
                        <strong>{card.usageCount ?? card.userCount ?? 0}</strong> users
                      </span>
                    </div>
                    <div className="profile-card-actions profile-template-actions">
                      <button
                        type="button"
                        className="profile-card-action-btn design"
                        onClick={(e) => {
                          e.stopPropagation()
                          const type = card.type || 'personal'
                          const tier = card.tier || 'classic'
                          navigate(`/studio?type=${type}&tier=${tier}`, {
                            state: { cardData: card, editTemplateId: card.templateId || card.id },
                          })
                        }}
                        title="Edit design"
                        aria-label="Edit design"
                      >
                        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="14" height="14" rx="2" />
                          <path d="M3 13l3.5-3.5a1.5 1.5 0 0 1 2 0L11 12l2-2a1.5 1.5 0 0 1 2 0L17 12" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="profile-card-action-btn edit"
                        onClick={(e) => { e.stopPropagation(); openTemplateEdit(card) }}
                        title="Edit info"
                        aria-label="Edit info"
                      >
                        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.85 2.85a1.5 1.5 0 0 1 2.12 2.12L6.5 15.44l-3.2.71.7-3.2z" />
                        </svg>
                      </button>
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
                      hoverLabel="Open Card"
                      variant={typeVariant}
                      showTypeBadge={true}
                      isLiked={likedTemplates.includes(card.id)}
                      onToggleLike={toggleLike}
                      isTemplate={false}
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
                            cardId: card.id,
                            cardType: card.type,
                            tier: card.tier,
                          })}
                          title="Share card"
                        >
                          🔗
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
                  isLiked={likedTemplates.includes(card.id)}
                  onToggleLike={toggleLike}
                  onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* CC Income History */}
        {currentUser?.ccIncomeHistory?.length > 0 && (
          <div>
            <h4 className="section-title">CC Income History</h4>
            <div className="profile-income-list">
              {currentUser.ccIncomeHistory.slice().reverse().slice(0, 10).map((entry, i) => {
                const amount = entry.amount || entry.cc || 0
                return (
                  <div key={`income-${i}`} className="profile-income-row">
                    <span className="profile-income-type">{(entry.type || entry.source || 'unknown').replace(/_/g, ' ')}</span>
                    <span className={`profile-income-amount${amount < 0 ? ' negative' : ''}`}>{amount > 0 ? '+' : ''}{amount} CC</span>
                    <span className="profile-income-date">{entry.date || entry.createdAt ? new Date(entry.date || entry.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Settings / Danger Zone */}
        {currentUser && (
          <div className="profile-danger-zone">
            <h4 className="section-title">Account</h4>

            {/* 7.11: moved down from above "My Cards" into Settings. */}
            <div className="profile-currency">
              <span className="profile-settings-label">Display Currency</span>
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

            {/* Phase 9 launch checklist: ToS/Privacy/contact were only ever
                linked from the signup/login page -- once a user is logged
                in (i.e. every returning visitor) there was no way to reach
                them from inside the app at all. This app has no traditional
                page footer (the bottom nav takes that space), so Account
                settings is the one persistent, always-reachable place for
                them. */}
            <div className="profile-legal-links">
              <Link to="/legal/terms">Terms and Conditions</Link>
              <Link to="/legal/privacy">Privacy Policy</Link>
              <a href="mailto:support@cardora.studio">Contact support</a>
            </div>

            <button className="ghost" type="button" onClick={handleLogoutClick}>
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

      {/* Logout Confirmation Modal */}
      {ConfirmModal}

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
        cardId={shareTarget?.cardId || ''}
        cardType={shareTarget?.cardType || ''}
        tier={shareTarget?.tier || ''}
      />

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => setShowEditProfile(false)} />
          <div className="detail-card artist-apply-modal">
            <p className="eyebrow">Profile</p>
            <h3>Edit your profile</h3>
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

      {/* Edit Template Modal */}
      {editingTemplate && (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => !savingTemplate && setEditingTemplate(null)} />
          <div className="detail-card artist-apply-modal">
            <p className="eyebrow">Template</p>
            <h3>Edit template</h3>
            <label className="detail-field">
              Name
              <input
                type="text"
                value={templateEditForm.name}
                onChange={(e) => setTemplateEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Template name"
              />
            </label>
            <label className="detail-field">
              Category
              <Dropdown
                value={templateEditForm.category}
                onChange={(val) => setTemplateEditForm((prev) => ({ ...prev, category: val }))}
                options={[
                  { value: 'birthday', label: 'Birthday' },
                  { value: 'anniversary', label: 'Anniversary' },
                  { value: 'wedding', label: 'Wedding' },
                  { value: 'proposal', label: 'Proposal' },
                  { value: 'graduation', label: 'Graduation' },
                  { value: 'holiday', label: 'Holiday' },
                  { value: 'thank-you', label: 'Thank You' },
                  { value: 'apology', label: 'Apology' },
                  { value: 'celebration', label: 'Celebration' },
                  { value: 'just-because', label: 'Just Because' },
                  { value: 'get-well', label: 'Get Well' },
                  { value: 'sympathy', label: 'Sympathy' },
                  { value: 'other', label: 'Other' },
                ]}
              />
            </label>
            <label className="detail-field">
              Preview image
              {templateEditForm.previewImage && (
                <img src={templateEditForm.previewImage} alt="" className="template-edit-preview-thumb" />
              )}
              <input type="file" accept="image/*" onChange={handleTemplateImageChange} disabled={uploadingTemplateImage} />
              {uploadingTemplateImage && <span className="template-edit-uploading">Uploading…</span>}
            </label>
            {templateEditMsg.text && <p className={`store-earn-msg artist-apply-msg ${templateEditMsg.ok ? 'success' : 'error'}`}>{templateEditMsg.text}</p>}
            <div className="detail-actions artist-apply-actions">
              <button className="primary" type="button" onClick={handleSaveTemplateEdit} disabled={savingTemplate || uploadingTemplateImage}>
                {savingTemplate ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="ghost" type="button" onClick={() => setEditingTemplate(null)} disabled={savingTemplate}>Cancel</button>
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













