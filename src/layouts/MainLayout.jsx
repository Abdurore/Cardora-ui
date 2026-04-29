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
  deleteCard as apiDeleteCard,
  getUserCards,
  claimDailyFreeCoupon,
  redeemCode,
  artistApply,
  forgotPassword,
  resetPassword,
  deleteAccount,
  updateCurrency,
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
      }

      const userData = userPayload.status === 'fulfilled' ? userPayload.value : null
      if (!userData) {
        resetSession()
        return null
      }

      const couponsData = couponPayload.status === 'fulfilled' ? couponPayload.value : null
      const rawUser = getPrimaryUser(userData)
      const meta = readUserMeta(rawUser?._id || rawUser?.id || rawUser?.userId || rawUser?.email)
      const session = normalizeUserSession(userData, couponsData, meta)
      const normalized = session.normalized
      setCurrentUser(normalized)
      setBalance(normalized.balance)
      setFavorites(meta.favorites || [])
      setInventory(meta.inventory || [])
      setAvatarUrl(normalized.avatarUrl || '')
      setAvatarColor(meta.avatarColor || normalized.avatarColor)
      if (normalized.currency) setUserCurrency(normalized.currency)
      return normalized
    } catch (error) {
      console.error('Session hydration failed', error)
      resetSession()
      return null
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
            inventory,
            avatarColor,
          }),
        )
      } catch (fallbackError) {
        console.warn('Failed to persist fallback user meta.', fallbackError)
      }
    }
  }, [avatarColor, avatarUrl, favorites, hydratedUser?.id, inventory])

  const toggleFavorite = async (cardId) => {
    if (!hydratedUser) {
      navigate('/login')
      return
    }

    setFavorites((prev) => {
      const nextFavorites = prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
      return nextFavorites
    })

    // Only call the backend for marketplace templates that have a real backend ID
    const backendTemplate = marketplaceTemplates.find((item) => item.id === cardId)?.backendTemplate
    if (!backendTemplate) return
    const templateId = backendTemplate.templateId || backendTemplate._id
    if (!templateId) return
    try {
      await likeTemplate(templateId)
    } catch (error) {
      console.error('Like sync failed', error)
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

  const publishTemplate = async ({ name, type, tier, previewImage, layoutConfig }) => {
    try {
      const resolvedPreviewImage = previewImage || layoutConfig?.previewImage || layoutConfig?.previewUrl || ''
      const normalizedLayoutConfig = structuredClone({
        ...layoutConfig,
        type: type || layoutConfig?.type || 'personal',
        tier: tier || layoutConfig?.tier || 'classic',
        previewImage: resolvedPreviewImage,
        previewUrl: resolvedPreviewImage,
      })
      const response = await createTemplate({
        name,
        type: type || 'personal',
        tier: tier || 'classic',
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
          status: created.status || 'pending',
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
      return { ok: true, message: getResponseMessage(response, 'Template submitted successfully.') }
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
      if (currentUser?.role === 'Admin') {
        await adminDeleteTemplate(templateId)
      } else {
        await deleteTemplate({ templateId })
      }
      setMarketplaceTemplates((prev) => prev.filter((t) => (t.templateId || t.id) !== templateId))
      await loadPublicData()
      return { ok: true }
    } catch (error) {
      console.error('Template delete failed', error)
      return { ok: false, message: error.message || 'Could not delete template.' }
    }
  }

  const handleCreateCard = async (cardObject, { type, couponType, useCoupons, poll, chain, trivia, tier, anonTemplate } = {}) => {
    try {
      // Backend card engine uses 'personal' for the standard card type. 'moment'
      // is still the internal studio id — normalise at the API boundary.
      const resolvedType = (type === 'moment' || type === 'standard' || !type) ? 'personal' : type
      // Backend schema { type, tier, config, enhancements, state } — the FE
      // splits the cardObject into all three sibling keys. If a field gets
      // rejected under one bucket the validator error tells us which other
      // bucket to move it to (and the helper updates in one place).
      const backendPayload = cardObjectToBackendPayload(cardObject)
      // tier is encoded in the endpoint path (/create-card/elite etc.) and
      // rejected as a top-level field by the validator. Spread only the
      // buckets the helper actually populated (state/etc. omitted while
      // backend shape is unknown).
      const payload = {
        type: resolvedType,
        ...backendPayload,
      }
      if (couponType) payload.couponType = couponType
      if (useCoupons) payload.useCoupons = useCoupons
      if (poll) payload.poll = poll
      if (chain) payload.chain = chain
      if (trivia) payload.trivia = trivia

      // Route to the correct tier-specific endpoint
      let response
      const resolvedTier = (tier || 'classic').toLowerCase()
      if (resolvedType === 'anonymous' || anonTemplate) {
        payload.anonTemplate = anonTemplate
        response = await createCardAnonymous(payload)
      } else if (resolvedTier === 'elite') {
        response = await createCardElite(payload)
      } else if (resolvedTier === 'premium') {
        response = await createCardPremium(payload)
      } else {
        response = await createCardClassic(payload)
      }

      return { ok: true, data: response, message: getResponseMessage(response, 'Card created!') }
    } catch (error) {
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
          openCardDetails: setSelectedCard,
          favorites,
          toggleFavorite,
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
            navigate('/studio', { state: { cardData: data || null } })
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


