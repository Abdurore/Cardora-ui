import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import CardDetailModal from '../components/CardDetailModal.jsx'
import CardTypeModal from '../components/CardTypeModal.jsx'
import AuthModal from '../components/AuthModal.jsx'
import WelcomeBackBanner from '../components/WelcomeBackBanner.jsx'
import '../App.css'
import {
  clearStoredToken,
  createCouponCheckout,
  createPaystackCheckout,
  createTemplate,
  deleteTemplate,
  adminDeleteTemplate,
  getCouponPackages,
  getCurrentUser,
  getStoredToken,
  getTemplates,
  getUserCoupons,
  likeTemplate,
  unlikeTemplate,
  trackTemplateUse,
  trackTemplateView,
  login,
  logout,
  requestOtp,
  setStoredToken,
  signup,
  updateProfile,
  verifyEmail,
  createCardClassic,
  createCardPremium,
  createCardElite,
  createCardAnonymous,
  createCardPollClassic,
  createCardPollElite,
  createCardChainClassic,
  createCardChainElite,
  createCardTriviaClassic,
  createCardTriviaElite,
  createCardAnonClassic,
  createCardAnonElite,
  deleteCard as apiDeleteCard,
  getUserCards,
  claimDailyFreeCoupon,
  redeemCode,
  artistApply,
  forgotPassword,
  resetPassword,
  deleteAccount,
  updateCurrency,
  createFlutterwaveGiftCheckout,
} from '../lib/api.js'
import {
  getPrimaryUser,
  getResponseMessage,
  mapTemplateToCard,
  normalizeAuthResponse,
  normalizeCheckoutSession,
  normalizeCouponPackagesResponse,
  normalizeTemplatesResponse,
  normalizeUserSession,
  cardObjectToBackendPayload,
  mapBackendCard,
} from '../lib/backendMappers.js'
import { normalizeGiftInventory } from '../lib/gifts.js'

const USER_META_PREFIX = 'cardora:userMeta:'

function readUserMeta(userId) {
  if (!userId) return { favorites: [], inventory: [], avatarColor: '' }
  try {
    const parsed = JSON.parse(localStorage.getItem(`${USER_META_PREFIX}${userId}`) || '{}')
    return {
      favorites: Array.isArray(parsed?.favorites) ? parsed.favorites : [],
      inventory: Array.isArray(parsed?.inventory) ? parsed.inventory : [],
      avatarColor: parsed?.avatarColor || '',
    }
  } catch {
    return { favorites: [], inventory: [], avatarColor: '' }
  }
}

function MainLayout() {
  const [selectedCard, setSelectedCard] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [likedTemplates, setLikedTemplates] = useState([])
  const [balance, setBalance] = useState(0)
  const [cart, setCart] = useState([])
  const [inventory, setInventory] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarColor, setAvatarColor] = useState('linear-gradient(135deg, #7ef7ff, #62ffa2)')
  const [showAuth, setShowAuth] = useState(false)
  const [showCardTypeModal, setShowCardTypeModal] = useState(false)
  const [cardTypePreselect, setCardTypePreselect] = useState(null)
  const [couponPackages, setCouponPackages] = useState([])
  const [userCurrency, setUserCurrency] = useState('NGN')
  const [marketplaceTemplates, setMarketplaceTemplates] = useState([])
  const [authReady, setAuthReady] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const hydratedUser = useMemo(
    () =>
      currentUser
        ? {
            ...currentUser,
            balance,
            favorites,
            inventory,
            avatarUrl,
            avatarColor,
          }
        : null,
    [avatarColor, avatarUrl, balance, currentUser, favorites, inventory],
  )

  const resetSession = () => {
    clearStoredToken()
    setCurrentUser(null)
    setBalance(0)
    setFavorites([])
    setLikedTemplates([])
    setInventory([])
    setAvatarUrl('')
    setAvatarColor('linear-gradient(135deg, #7ef7ff, #62ffa2)')
  }

  const hydrateSession = async () => {
    const token = getStoredToken()
    if (!token) {
      resetSession()
      return null
    }

    try {
      const [userPayload, couponPayload] = await Promise.allSettled([getCurrentUser(), getUserCoupons()])

      // Handle expired / invalid tokens
      if (userPayload.status === 'rejected') {
        const status = userPayload.reason?.status
        if (status === 401 || status === 403) {
          resetSession()
          return null
        }
        console.warn('Session refresh failed without an auth error; keeping the stored token.', userPayload.reason)
        return hydratedUser || currentUser || null
      }

      const userData = userPayload.status === 'fulfilled' ? userPayload.value : null
      if (!userData) {
        return hydratedUser || currentUser || null
      }

      const couponsData = couponPayload.status === 'fulfilled' ? couponPayload.value : null
      const rawUser = getPrimaryUser(userData)
      const meta = readUserMeta(rawUser?._id || rawUser?.id || rawUser?.userId || rawUser?.email)
      const session = normalizeUserSession(userData, couponsData, meta)
      const normalized = session.normalized

      // Blend pending purchased gift from session storage if not already credited in backend
      try {
        const pendingRaw = sessionStorage.getItem('cardora:pendingGiftCheckout')
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw)
          if (pending && pending.name && Date.now() - pending.savedAt < 300000) { // 5 minutes
            const beforeCount = Array.isArray(hydratedUser?.giftsInventory) ? hydratedUser.giftsInventory.length : 0
            const afterCount = Array.isArray(normalized.giftsInventory) ? normalized.giftsInventory.length : 0
            const hasExactPending = Array.isArray(normalized.giftsInventory) && normalized.giftsInventory.some(
              item => (
                (pending.reference && (item.reference === pending.reference || item.txRef === pending.reference || item.transactionRef === pending.reference)) ||
                item.inventoryId === `pending-${pending.savedAt}` ||
                item._id === `pending-${pending.savedAt}`
              )
            )
            const hasGained = hasExactPending || afterCount > beforeCount
            if (hasGained) {
              sessionStorage.removeItem('cardora:pendingGiftCheckout')
            } else {
              normalized.giftsInventory = [
                ...(Array.isArray(normalized.giftsInventory) ? normalized.giftsInventory : []),
                {
                  giftName: pending.name,
                  name: pending.name,
                  status: 'available',
                  inventoryId: `pending-${pending.savedAt}`,
                  _id: `pending-${pending.savedAt}`,
                  amount: 1,
                  priceNgn: pending.price,
                  isPendingLocal: true,
                }
              ]
            }
          }
        }
      } catch (e) { /* ignore */ }

      setCurrentUser(normalized)
      setBalance(normalized.balance)
      setFavorites(meta.favorites || [])
      setLikedTemplates(meta.likedTemplates || [])
      const mappedGifts = normalizeGiftInventory(normalized.giftsInventory)

      // Merge local storage inventory (if any custom drafts are kept) with backend gifts, avoiding duplicates
      const localGifts = meta.inventory || []
      const mergedGifts = [...mappedGifts]
      localGifts.forEach((lg) => {
        if (!mergedGifts.some((mg) => mg.id === lg.id)) {
          mergedGifts.push(lg)
        }
      })

      setInventory(mergedGifts)
      setAvatarUrl(normalized.avatarUrl || '')
      setAvatarColor(meta.avatarColor || normalized.avatarColor)
      if (normalized.currency) setUserCurrency(normalized.currency)
      return normalized
    } catch (error) {
      console.error('Session hydration failed', error)
      return hydratedUser || currentUser || null
    }
  }

  const loadPublicData = async (currency) => {
    try {
      const currencyParam = currency || userCurrency || 'NGN'
      const [packagePayload, templatePayload] = await Promise.allSettled([
        getCouponPackages(`activeOnly=true&page=1&limit=20&currency=${currencyParam}`),
        getTemplates('page=1&limit=24'),
      ])

      if (packagePayload.status === 'fulfilled') {
        const normalizedPackages = normalizeCouponPackagesResponse(packagePayload.value, currencyParam)
        setCouponPackages(normalizedPackages.packages)
      }

      if (templatePayload.status === 'fulfilled') {
        const normalizedTemplates = normalizeTemplatesResponse(templatePayload.value)
        setMarketplaceTemplates(normalizedTemplates.templates)
      }
    } catch (error) {
      console.error('Public data load failed', error)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [, userResult] = await Promise.allSettled([loadPublicData(), hydrateSession()])
      const user = userResult.status === 'fulfilled' ? userResult.value : null
      if (user?.currency && user.currency !== 'NGN' && mounted) {
        await loadPublicData(user.currency)
      }
      if (mounted) setAuthReady(true)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search, location.hash])

  // Track last-active timestamp so WelcomeBackBanner can detect long absences
  useEffect(() => {
    const saveActive = () => localStorage.setItem('cardora:lastActive', String(Date.now()))
    window.addEventListener('beforeunload', saveActive)
    return () => window.removeEventListener('beforeunload', saveActive)
  }, [])

  useEffect(() => {
    if (!hydratedUser?.id) return
    const storageKey = `${USER_META_PREFIX}${hydratedUser.id}`
    const payload = {
      favorites,
      likedTemplates,
      inventory,
      avatarColor,
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch (error) {
      console.warn('Failed to persist user meta, retrying without avatar image.', error)
      try {
      localStorage.setItem(
          storageKey,
          JSON.stringify({
            favorites,
            likedTemplates,
            inventory,
            avatarColor,
          }),
        )
      } catch (fallbackError) {
        console.warn('Failed to persist fallback user meta.', fallbackError)
      }
    }
  }, [avatarColor, avatarUrl, favorites, likedTemplates, hydratedUser?.id, inventory])

  // toggleLike = backend-synced likes (shown on card grid items)
  const toggleLike = async (cardId) => {
    if (!hydratedUser) {
      navigate('/login')
      return
    }

    const wasLiked = likedTemplates.includes(cardId)

    setLikedTemplates((prev) => (
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    ))
    setMarketplaceTemplates((prev) => prev.map((item) => {
      if (item.id !== cardId) return item
      const nextLikeCount = Math.max(0, Number(item.likeCount ?? item.likes ?? 0) + (wasLiked ? -1 : 1))
      return { ...item, likeCount: nextLikeCount, likes: String(nextLikeCount) }
    }))
    setSelectedCard((prev) => {
      if (!prev || prev.id !== cardId) return prev
      const nextLikeCount = Math.max(0, Number(prev.likeCount ?? prev.likes ?? 0) + (wasLiked ? -1 : 1))
      return { ...prev, likeCount: nextLikeCount, likes: String(nextLikeCount) }
    })

    // Only call the backend for marketplace templates that have a real backend ID
    const backendTemplate = marketplaceTemplates.find((item) => item.id === cardId)?.backendTemplate
    if (!backendTemplate) return
    const templateId = backendTemplate.templateId || backendTemplate._id
    if (!templateId) return
    try {
      if (wasLiked) {
        await unlikeTemplate(templateId)
      } else {
        await likeTemplate(templateId)
      }
    } catch (error) {
      console.error('Like sync failed', error)
    }
  }

  // toggleFavorite = local bookmarks only (shown as bookmark in modal)
  const toggleFavorite = (cardId) => {
    setFavorites((prev) => (
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    ))
  }

  const openCardDetails = async (card) => {
    if (!card) {
      setSelectedCard(null)
      return
    }
    setSelectedCard(card)
    const templateId = card.templateId || card.backendTemplate?.templateId || card.backendTemplate?._id || card.id
    const nextViewCount = Number(card.viewCount || 0) + 1
    setSelectedCard((prev) => prev && prev.id === card.id ? { ...prev, viewCount: nextViewCount } : prev)
    setMarketplaceTemplates((prev) => prev.map((item) => (
      item.id === card.id ? { ...item, viewCount: Number(item.viewCount || 0) + 1 } : item
    )))
    if (!templateId) return
    try {
      await trackTemplateView(templateId)
    } catch (error) {
      if (error?.status !== 404) console.warn('Template view tracking failed', error)
    }
  }

  const recordTemplateUse = async (card) => {
    if (!card) return
    const templateId = card.templateId || card.backendTemplate?.templateId || card.backendTemplate?._id || card.id
    setMarketplaceTemplates((prev) => prev.map((item) => {
      if (item.id !== card.id) return item
      const nextUsageCount = Number(item.usageCount ?? item.userCount ?? 0) + 1
      return { ...item, usageCount: nextUsageCount, userCount: nextUsageCount, meta: `${nextUsageCount} Users` }
    }))
    setSelectedCard((prev) => {
      if (!prev || prev.id !== card.id) return prev
      const nextUsageCount = Number(prev.usageCount ?? prev.userCount ?? 0) + 1
      return { ...prev, usageCount: nextUsageCount, userCount: nextUsageCount, meta: `${nextUsageCount} Users` }
    })
    if (!templateId) return
    try {
      await trackTemplateUse(templateId)
    } catch (error) {
      if (error?.status !== 404) console.warn('Template use tracking failed', error)
    }
  }

  const addToCart = async (pack) => {
    if (!hydratedUser) {
      navigate('/login')
      return { ok: false, reason: 'auth' }
    }
    setCart((prev) => [...prev, pack])
    try {
      let response = null
      try {
        response = await createPaystackCheckout({ packageId: pack.packageId || pack.id })
      } catch (paystackError) {
        // Only fall back to coupon checkout if the endpoint itself is unsupported (404)
        // — not on network errors or server failures, which could cause double-charges
        if (paystackError.status === 404) {
          response = await createCouponCheckout({ packageId: pack.packageId || pack.id })
        } else {
          throw paystackError
        }
      }
      const checkout = normalizeCheckoutSession(response)
      if (checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl
        return { ok: true, checkout: true }
      }
      await hydrateSession()
      return { ok: true, checkout: false }
    } catch (error) {
      console.error('Checkout start failed', error)
      return { ok: false, reason: error.message || 'checkout' }
    }
  }

  const purchaseGift = async (gift) => {
    if (!hydratedUser) {
      navigate('/login')
      return { ok: false, reason: 'auth' }
    }
    if (!gift) return { ok: false, reason: 'no-gift' }
    const legacyGiftNames = {
      tiny: 'spark',
      sweet: 'sweetHeart',
      purple: 'purpleLove',
      ocean: 'oceanHeart',
      emerald: 'emeraldHeart',
      passion: 'passionHeart',
      golden: 'goldenHeart',
      crystal: 'crystalHeart',
      diamond: 'diamondHeart',
      legendary: 'legendaryHeart',
    }
    const titleKey = String(gift.title || '')
      .trim()
      .replace(/[^a-zA-Z0-9 ]+/g, '')
      .replace(/\s+([a-zA-Z0-9])/g, (_, char) => char.toUpperCase())
      .replace(/^./, char => char.toLowerCase())
    const giftNameCandidates = [
      gift.giftName,
      gift.name,
      gift.effectKey,
      legacyGiftNames[gift.effectKey],
      titleKey,
      gift.title,
    ].filter(Boolean)
    const uniqueGiftNames = [...new Set(giftNameCandidates)]
    try {
      let response = null
      let lastGiftError = null
      for (const giftName of uniqueGiftNames) {
        try {
          const callbackUrl = `${window.location.origin}/store/gifts?gift=callback&giftName=${encodeURIComponent(giftName)}`
          response = await createFlutterwaveGiftCheckout({
            giftName,
            callbackUrl,
            callback_url: callbackUrl,
            redirectUrl: callbackUrl,
            redirect_url: callbackUrl,
            returnUrl: callbackUrl,
          })
          break
        } catch (error) {
          lastGiftError = error
          const canTryNext =
            [400, 404].includes(error?.status) &&
            /gift/i.test(error?.message || '')
          if (!canTryNext) throw error
        }
      }
      if (!response && lastGiftError) throw lastGiftError
      const checkout = normalizeCheckoutSession(response)
      if (checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl
        return { ok: true, checkout: true }
      }
      await hydrateSession()
      return { ok: true, checkout: false }
    } catch (error) {
      console.error('Gift checkout failed', error)
      return { ok: false, reason: error.message || 'checkout' }
    }
  }

  const deductCC = (amount) => {
    if (!hydratedUser) {
      navigate('/login')
      return false
    }
    if (balance < amount) return false
    setBalance((prev) => prev - amount)
    return true
  }

  const addGift = (gift) => {
    if (!hydratedUser) {
      navigate('/login')
      return { ok: false, reason: 'auth' }
    }
    if (balance < gift.cc) return { ok: false, reason: 'balance' }
    setBalance((prev) => prev - gift.cc)
    setInventory((prev) => [...prev, { ...gift, id: `gift-${Date.now()}` }])
    return { ok: true }
  }

  const handleLogin = async (email, password) => {
    try {
      const response = await login({ email, password })
      const auth = normalizeAuthResponse(response)
      if (!auth.token) {
        return {
          ok: false,
          message: auth.message || 'Login succeeded but no session token was returned.',
        }
      }
      setStoredToken(auth.token)
      await hydrateSession()
      // Seed lastActive on first-ever login so beforeunload tracking can start
      if (!localStorage.getItem('cardora:lastActive')) {
        localStorage.setItem('cardora:lastActive', String(Date.now()))
      }
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Invalid email or password.',
        status: error.status,
        debug: error.debug,
      }
    }
  }

  const handleSignup = async ({
    username,
    email,
    password,
    referralCode,
    currency = 'NGN',
    termsAccepted = true,
    privacyAccepted = true,
  }) => {
    try {
      const signupPayload = {
        username,
        email,
        password,
        profilePictureUrl: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username) + '&background=0D8ABC&color=fff',
        currency,
        termsAccepted,
        privacyAccepted,
      }
      if (referralCode) {
        signupPayload.referralCode = referralCode
      }
      const response = await signup(signupPayload)
      const auth = normalizeAuthResponse(response)
      if (auth.token) {
        setStoredToken(auth.token)
        await hydrateSession()
        return { ok: true, verified: true }
      }
      return {
        ok: true,
        verified: false,
        message: auth.message || 'Signup successful. Check your email for the verification code.',
      }
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Signup failed.',
        status: error.status,
        debug: error.debug,
      }
    }
  }

  const handleVerifyEmail = async (email, otp) => {
    try {
      const response = await verifyEmail({ email, otp })
      const auth = normalizeAuthResponse(response)
      if (auth.token) {
        setStoredToken(auth.token)
        await hydrateSession()
        return { ok: true, session: true, message: auth.message || 'Email verified successfully.' }
      }
      return {
        ok: true,
        session: false,
        message: auth.message || 'Email verified. Please log in to continue.',
      }
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Verification failed.',
        status: error.status,
        debug: error.debug,
      }
    }
  }

  const handleRequestOtp = async (email) => {
    try {
      const response = await requestOtp({ email })
      return { ok: true, message: getResponseMessage(response, 'A new code has been sent.') }
    } catch (error) {
      return {
        ok: false,
        message: error.message || 'Could not resend the code.',
        status: error.status,
        debug: error.debug,
      }
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout request failed', error)
    } finally {
      clearStoredToken()
      setCurrentUser(null)
      setBalance(0)
      setFavorites([])
      setLikedTemplates([])
      setInventory([])
      setAvatarUrl('')
      setAvatarColor('linear-gradient(135deg, #7ef7ff, #62ffa2)')
      setCart([])
    }
  }

  const handleProfileUpdate = async (payload) => {
    if (!hydratedUser) return { ok: false, message: 'Please log in.' }
    try {
      await updateProfile(payload)
      await hydrateSession()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || 'Profile update failed.' }
    }
  }

  const publishTemplate = async ({ name, type, tier, category, previewImage, layoutConfig }) => {
    try {
      const resolvedCategory = category || layoutConfig?.category || 'birthday'
      const resolvedPreviewImage = previewImage || layoutConfig?.previewImage || layoutConfig?.previewUrl || ''
      const normalizedLayoutConfig = structuredClone({
        ...layoutConfig,
        type: type || layoutConfig?.type || 'personal',
        tier: tier || layoutConfig?.tier || 'classic',
        category: resolvedCategory,
        previewImage: resolvedPreviewImage,
        previewUrl: resolvedPreviewImage,
      })
      const response = await createTemplate({
        name,
        type: type || 'personal',
        tier: tier || 'classic',
        category: resolvedCategory,
        previewImage: resolvedPreviewImage,
        layoutConfig: normalizedLayoutConfig,
      })

      // Optimistically add the newly-published template to local state so the
      // artist sees it immediately under "Pending review" in their Profile —
      // public /templates only returns approved entries, so a refetch alone
      // leaves the artist staring at no feedback after submission.
      const created = response?.template || response?.data?.template || response?.data || response
      if (created && (created._id || created.templateId || created.id)) {
        const ownerId = currentUser?.id || null
        const optimisticTemplate = {
          ...created,
          status: created.status || 'live',
          createdBy: created.createdBy || ownerId,
          name: created.name || name,
          type: created.type || type || 'personal',
          tier: created.tier || tier || 'classic',
          previewImage: created.previewImage || resolvedPreviewImage,
          layoutConfig: created.layoutConfig || normalizedLayoutConfig,
        }
        setMarketplaceTemplates((prev) => {
          const id = optimisticTemplate._id || optimisticTemplate.templateId || optimisticTemplate.id
          const next = prev.filter((t) => (t.templateId || t.id) !== id)
          return [mapTemplateToCard(optimisticTemplate), ...next]
        })
      }

      await loadPublicData()
      return { ok: true, message: getResponseMessage(response, 'Template published successfully.') }
    } catch (error) {
      console.error('Template publish failed', error)
      return { ok: false, message: error.message || 'Could not publish template.' }
    }
  }

  const deleteMarketplaceTemplate = async (templateId) => {
    if (!templateId) return { ok: false, message: 'Missing template id.' }
    try {
      // Admins and artists use different endpoints — the artist path checks
      // ownership, which rejects admin callers even though they should be able
      // to moderate the marketplace.
      const template = marketplaceTemplates.find((t) => (
        [t.templateId, t.id, t.backendTemplate?._id, t.backendTemplate?.templateId]
          .some((id) => id && String(id) === String(templateId))
      ))
      const backendId = template?.backendTemplate?._id || template?.backendTemplate?.templateId || template?.templateId || template?.id || templateId
      if (String(currentUser?.role || '').toLowerCase() === 'admin') {
        await adminDeleteTemplate(backendId)
      } else {
        await deleteTemplate({ templateId: backendId, id: backendId, _id: backendId })
      }
      setMarketplaceTemplates((prev) => prev.filter((t) => (
        ![t.templateId, t.id, t.backendTemplate?._id, t.backendTemplate?.templateId]
          .some((id) => id && String(id) === String(templateId))
      )))
      await loadPublicData()
      return { ok: true }
    } catch (error) {
      console.error('Template delete failed', error)
      return { ok: false, message: error.message || 'Could not delete template.' }
    }
  }

  const handleCreateCard = async (cardObject, { type, poll, chain, trivia, tier, anonTemplate } = {}) => {
    try {
      const resolvedType = (type === 'moment' || type === 'standard' || !type) ? 'personal' : (anonTemplate ? 'anonymous' : type)
      // Premium is personal-only — upgrade poll/chain/trivia/anon to elite instead
      const rawTier = (tier || 'classic').toLowerCase()
      const resolvedTier = (rawTier === 'premium' && resolvedType !== 'personal') ? 'elite' : rawTier

      const backendPayload = cardObjectToBackendPayload(cardObject, {
        type: resolvedType,
        tier: resolvedTier,
        poll,
        trivia,
        chain,
      })

      // Client-side validation matching backend Joi rules. Catching here surfaces
      // a clear, type-specific message rather than the backend's generic 400.
      const c = backendPayload.config?.content || {}
      let missing = null
      if (resolvedType === 'personal') {
        if (!String(c.header || '').trim()) missing = 'Card heading is required.'
        else if (!String(c.body || '').trim()) missing = 'Card body text is required.'
      } else if (resolvedType === 'poll') {
        if (!String(c.question || '').trim()) missing = 'Poll question is required.'
        else if (!Array.isArray(c.options) || c.options.length < 2) missing = 'Poll needs at least 2 non-empty options.'
      } else if (resolvedType === 'chain') {
        if (!String(c.challenge || '').trim()) missing = 'Chain prompt is required.'
      } else if (resolvedType === 'trivia') {
        if (!Array.isArray(c.questions) || c.questions.length < 1) missing = 'Trivia needs at least 1 question with text and 2+ options.'
      } else if (resolvedType === 'anonymous') {
        if (!String(c.message || '').trim()) missing = 'Anonymous template needs a message.'
      }
      if (missing) {
        return { ok: false, message: missing }
      }

      // Endpoint routing (per API handbook table):
      // /create-card/{classic|premium|elite}  → type REQUIRED in body, tier FORBIDDEN
      // /create-card/{poll|chain|trivia|anonymous}/{classic|elite} → type FORBIDDEN in body
      // So: personal cards need { type, config, enhancements, layoutdata }
      //     typed cards need    { config, enhancements, layoutdata }
      const isPersonal = resolvedType === 'personal'

      // For typed routes (poll/chain/trivia/anon), the backend may still have strict
      // Joi validation on enhancements (freeform change was applied to personal routes).
      // Strip empty/default values so the backend fills them with its own safe defaults.
      let finalPayload = backendPayload
      if (!isPersonal) {
        const enh = backendPayload.enhancements ? { ...backendPayload.enhancements } : {}

        // Strip lock if type is 'none' — let backend fill default
        if (enh.lock?.type === 'none') delete enh.lock

        // Strip music if no track
        if (enh.music && !enh.music.track) delete enh.music

        // Strip openEffect if type is 'none'
        if (enh.openEffect?.type === 'none') delete enh.openEffect

        // Strip ambientEffect if type is 'none'
        if (enh.ambientEffect?.type === 'none') delete enh.ambientEffect

        // Strip empty media array
        if (Array.isArray(enh.media) && enh.media.length === 0) delete enh.media

        // Strip videoSettings if background type is not video
        if (enh.background && enh.background.type !== 'video') {
          delete enh.background.videoSettings
        }

        finalPayload = { ...backendPayload, enhancements: enh }
      }

      // Backend validation rules (confirmed from actual 400 responses):
      // - /create-card/{tier} (personal): type REQUIRED, tier FORBIDDEN in body
      // - /create-card/{type}/{tier} (typed): type FORBIDDEN, tier FORBIDDEN in body
      const payload = isPersonal
        ? { type: 'personal', ...finalPayload }
        : finalPayload

      const endpoint = resolvedType === 'poll'
        ? `/create-card/poll/${resolvedTier === 'elite' ? 'elite' : 'classic'}`
        : resolvedType === 'chain'
          ? `/create-card/chain/${resolvedTier === 'elite' ? 'elite' : 'classic'}`
          : resolvedType === 'trivia'
            ? `/create-card/trivia/${resolvedTier === 'elite' ? 'elite' : 'classic'}`
            : resolvedType === 'anonymous'
              ? `/create-card/anonymous/${resolvedTier === 'elite' ? 'elite' : 'classic'}`
              : `/create-card/${resolvedTier}`

      console.group(`%c[CardCreate] POST ${endpoint}`, 'color:#7ef7ff;font-weight:bold')
      try {
        console.log('%cFull payload:', 'color:#62ffa2;font-weight:bold', structuredClone(payload))
        console.log('%cconfig.content:', 'color:#ffcc80;font-weight:bold', structuredClone(backendPayload.config?.content ?? {}))
        console.log('%cenhancements:', 'color:#a0b8ff;font-weight:bold', structuredClone(payload.enhancements ?? {}))
        console.log('%c⚠ EXACT JSON being sent:', 'color:#ffd700;font-weight:bold;font-size:13px', JSON.stringify(payload, null, 2))
      } catch (logErr) {
        console.log('(could not clone payload for debug logging)', logErr)
      }
      console.groupEnd()

      let response
      if (resolvedType === 'poll') {
        response = resolvedTier === 'elite'
          ? await createCardPollElite(payload)
          : await createCardPollClassic(payload)
      } else if (resolvedType === 'chain') {
        response = resolvedTier === 'elite'
          ? await createCardChainElite(payload)
          : await createCardChainClassic(payload)
      } else if (resolvedType === 'trivia') {
        response = resolvedTier === 'elite'
          ? await createCardTriviaElite(payload)
          : await createCardTriviaClassic(payload)
      } else if (resolvedType === 'anonymous') {
        response = resolvedTier === 'classic'
          ? await createCardAnonClassic(payload)
          : await createCardAnonElite(payload)
      } else {
        if (resolvedTier === 'elite') response = await createCardElite(payload)
        else if (resolvedTier === 'premium') response = await createCardPremium(payload)
        else response = await createCardClassic(payload)
      }

      console.log('%c[CardCreate] ✓ Success response:', 'color:#62ffa2;font-weight:bold', response)
      return { ok: true, data: response, message: getResponseMessage(response, 'Card created!') }
    } catch (error) {
      console.group('%c[CardCreate] ✗ Error', 'color:#ff6b6b;font-weight:bold')
      console.error('message:', error.message)
      console.error('status:', error.status)
      console.error('full payload:', error.payload)
      if (error.payload?.details) console.error('validation details:', error.payload.details)
      console.error('debug info:', error.debug)
      console.groupEnd()
      return { ok: false, message: error.message || 'Card creation failed.' }
    }
  }

  const handleGetUserCards = async (query) => {
    try {
      const response = await getUserCards(query)
      const cards = response?.cards || response?.data?.cards || response?.data?.items || []
      return { ok: true, cards: cards.map(mapBackendCard) }
    } catch (error) {
      return { ok: false, cards: [], message: error.message }
    }
  }

  const handleDeleteCard = async (cardId) => {
    try {
      await apiDeleteCard({ cardId })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || 'Could not delete card.' }
    }
  }

  const handleClaimDailyCoupon = async () => {
    try {
      const response = await claimDailyFreeCoupon()
      await hydrateSession()
      return { ok: true, message: getResponseMessage(response, 'Daily coupon claimed!') }
    } catch (error) {
      return { ok: false, message: error.message || 'Could not claim daily coupon.' }
    }
  }

  const handleRedeemCode = async (code) => {
    try {
      const response = await redeemCode({ code })
      await hydrateSession()
      return { ok: true, message: getResponseMessage(response, 'Code redeemed!') }
    } catch (error) {
      return { ok: false, message: error.message || 'Invalid or expired code.' }
    }
  }

  const handleArtistApply = async (payload) => {
    try {
      const response = await artistApply(payload)
      return { ok: true, message: getResponseMessage(response, 'Application submitted!') }
    } catch (error) {
      return { ok: false, message: error.message || 'Artist application failed.' }
    }
  }

  const handleForgotPassword = async (email) => {
    try {
      const response = await forgotPassword({ email })
      return { ok: true, message: getResponseMessage(response, 'Reset code sent to your email.') }
    } catch (error) {
      return { ok: false, message: error.message || 'Could not send reset code.' }
    }
  }

  const handleResetPassword = async (email, otp, newPassword) => {
    try {
      const response = await resetPassword({ email, otp, newPassword })
      return { ok: true, message: getResponseMessage(response, 'Password reset successfully.') }
    } catch (error) {
      return { ok: false, message: error.message || 'Password reset failed.' }
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount()
      resetSession()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error.message || 'Could not delete account.' }
    }
  }

  const refreshBalance = async () => {
    await hydrateSession()
  }

  const handleCurrencyChange = async (code) => {
    setUserCurrency(code)
    try {
      await updateCurrency({ currency: code })
    } catch { /* ignore */ }
    await loadPublicData(code)
  }

  return (
    <div className={`page ${location.pathname === '/studio' ? 'page-studio' : ''}`}>
      <Outlet
        context={{
          openCardDetails,
          favorites,
          toggleFavorite,
          likedTemplates,
          toggleLike,
          balance,
          cart,
          addToCart,
          currentUser: hydratedUser,
          authReady,
          couponPackages,
          marketplaceTemplates,
          refreshMarketplaceTemplates: loadPublicData,
          openAuthModal: () => {
            if (hydratedUser) {
              setShowAuth(true)
            } else {
              navigate('/login')
            }
          },
          updateProfile: handleProfileUpdate,
          deductCC,
          addGift,
          onLogin: handleLogin,
          onSignup: handleSignup,
          onVerifyEmail: handleVerifyEmail,
          onRequestOtp: handleRequestOtp,
          onLogout: handleLogout,
          inventory,
          publishTemplate,
          deleteMarketplaceTemplate,
          createCardOnBackend: handleCreateCard,
          purchaseGift,
          getUserCardsFromBackend: handleGetUserCards,
          deleteCardOnBackend: handleDeleteCard,
          claimDailyCoupon: handleClaimDailyCoupon,
          redeemCodeAction: handleRedeemCode,
          artistApplyAction: handleArtistApply,
          onForgotPassword: handleForgotPassword,
          onResetPassword: handleResetPassword,
          onDeleteAccount: handleDeleteAccount,
          refreshBalance,
          userCurrency,
          onCurrencyChange: handleCurrencyChange,
          openCardTypeModal: (preselect = null) => {
            if (!hydratedUser) {
              navigate('/login')
              return
            }
            setCardTypePreselect(preselect)
            setShowCardTypeModal(true)
          },
          openEditor: (data) => {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
            navigate('/studio', { state: { cardData: data || null, isNew: !data } })
          },
        }}
      />

      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        balance={balance}
        currentUser={hydratedUser}
        onRequireAuth={() => navigate('/login')}
        onDeductCC={deductCC}
        inventory={inventory}
        openCardTypeModal={(preselect) => {
          setCardTypePreselect(preselect || null)
          setShowCardTypeModal(true)
        }}
        isFavorited={selectedCard ? favorites.includes(selectedCard.id) : false}
        onToggleFavorite={toggleFavorite}
        isLiked={selectedCard ? likedTemplates.includes(selectedCard.id) : false}
        onToggleLike={toggleLike}
        onTemplateUse={recordTemplateUse}
      />
      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onLogin={handleLogin}
        onSignup={handleSignup}
        currentUser={hydratedUser}
        onLogout={handleLogout}
      />
      <CardTypeModal
        open={showCardTypeModal}
        onClose={() => { setShowCardTypeModal(false); setCardTypePreselect(null) }}
        preselectedType={cardTypePreselect}
        currentUser={hydratedUser}
      />
      <WelcomeBackBanner currentUser={hydratedUser} />
    </div>
  )
}

export default MainLayout


