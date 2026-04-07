import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import CardDetailModal from '../components/CardDetailModal.jsx'
import AuthModal from '../components/AuthModal.jsx'
import '../App.css'
import {
  clearStoredToken,
  createCouponCheckout,
  createPaystackCheckout,
  createTemplate,
  extractToken,
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
  createCard,
  deleteCard as apiDeleteCard,
  getUserCards,
  claimDailyFreeCoupon,
  redeemCode,
  artistApply,
  forgotPassword,
  resetPassword,
  deleteAccount,
} from '../lib/api.js'
import {
  extractCheckoutUrl,
  mapCouponPackage,
  mapTemplateToCard,
  normalizeUser,
  cardObjectToLayoutData,
  mapBackendCard,
} from '../lib/backendMappers.js'

const USER_META_PREFIX = 'cardora:userMeta:'

function readUserMeta(userId) {
  if (!userId) return { favorites: [], inventory: [], avatarUrl: '', avatarColor: '' }
  try {
    return JSON.parse(localStorage.getItem(`${USER_META_PREFIX}${userId}`) || '{}')
  } catch {
    return { favorites: [], inventory: [], avatarUrl: '', avatarColor: '' }
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
  const [couponPackages, setCouponPackages] = useState([])
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
      const rawUser = userData?.user || userData?.data?.user || userData?.data || userData
      const meta = readUserMeta(rawUser?._id || rawUser?.id || rawUser?.userId || rawUser?.email)
      const normalized = normalizeUser(userData, meta, couponsData)
      setCurrentUser(normalized)
      setBalance(normalized.balance)
      setFavorites(meta.favorites || [])
      setInventory(meta.inventory || [])
      setAvatarUrl(meta.avatarUrl || '')
      setAvatarColor(meta.avatarColor || normalized.avatarColor)
      return normalized
    } catch (error) {
      console.error('Session hydration failed', error)
      resetSession()
      return null
    }
  }

  const loadPublicData = async () => {
    try {
      const [packagePayload, templatePayload] = await Promise.allSettled([
        getCouponPackages('activeOnly=true&page=1&limit=20'),
        getTemplates('page=1&limit=24'),
      ])

      if (packagePayload.status === 'fulfilled') {
        const packs = packagePayload.value?.packages || packagePayload.value?.data?.packages || []
        setCouponPackages(packs.map(mapCouponPackage))
      }

      if (templatePayload.status === 'fulfilled') {
        const templates =
          templatePayload.value?.templates || templatePayload.value?.data?.templates || []
        setMarketplaceTemplates(templates.map(mapTemplateToCard))
      }
    } catch (error) {
      console.error('Public data load failed', error)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      await Promise.allSettled([loadPublicData(), hydrateSession()])
      if (mounted) setAuthReady(true)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    if (!hydratedUser?.id) return
    const storageKey = `${USER_META_PREFIX}${hydratedUser.id}`
    const payload = {
      favorites,
      inventory,
      avatarUrl,
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
            avatarUrl: '',
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
      const checkoutUrl = extractCheckoutUrl(response)
      if (checkoutUrl) {
        window.location.href = checkoutUrl
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
      const token = extractToken(response)
      if (!token) {
        return { ok: false, message: response?.message || 'Login succeeded but no session token was returned.' }
      }
      setStoredToken(token)
      await hydrateSession()
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
      const token = extractToken(response)
      if (token) {
        setStoredToken(token)
        await hydrateSession()
        return { ok: true, verified: true }
      }
      return {
        ok: true,
        verified: false,
        message: response?.message || 'Signup successful. Check your email for the verification code.',
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
      const token = extractToken(response)
      if (token) {
        setStoredToken(token)
        await hydrateSession()
        return { ok: true, session: true, message: response?.message || 'Email verified successfully.' }
      }
      return {
        ok: true,
        session: false,
        message: response?.message || 'Email verified. Please log in to continue.',
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
      return { ok: true, message: response?.message || 'A new code has been sent.' }
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

  const updateAvatar = (nextAvatar) => {
    setAvatarUrl(nextAvatar)
    setAvatarColor('')
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

  const publishTemplate = async ({ name, category, previewImage, layoutConfig }) => {
    try {
      const response = await createTemplate({ name, category, previewImage, layoutConfig })
      await loadPublicData()
      return { ok: true, message: response?.message || 'Template submitted successfully.' }
    } catch (error) {
      console.error('Template publish failed', error)
      return { ok: false, message: error.message || 'Could not publish template.' }
    }
  }

  const handleCreateCard = async (cardObject, { title, templateId, type, couponType, useCoupons, poll, chain, trivia } = {}) => {
    try {
      const layoutdata = cardObjectToLayoutData(cardObject)
      const payload = {
        title: title || cardObject.content?.heading || 'Untitled Card',
        layoutdata,
        templateId: templateId || 'custom',
        type: type || 'standard',
      }
      if (couponType) payload.couponType = couponType
      if (useCoupons) payload.useCoupons = useCoupons
      if (poll) payload.poll = poll
      if (chain) payload.chain = chain
      if (trivia) payload.trivia = trivia
      const response = await createCard(payload)
      return { ok: true, data: response, message: response?.message || 'Card created!' }
    } catch (error) {
      return { ok: false, message: error.message || 'Card creation failed.' }
    }
  }

  const handleGetUserCards = async (query) => {
    try {
      const response = await getUserCards(query)
      const cards = response?.cards || response?.data?.cards || []
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
      return { ok: true, message: response?.message || 'Daily coupon claimed!' }
    } catch (error) {
      return { ok: false, message: error.message || 'Could not claim daily coupon.' }
    }
  }

  const handleRedeemCode = async (code) => {
    try {
      const response = await redeemCode({ code })
      await hydrateSession()
      return { ok: true, message: response?.message || 'Code redeemed!' }
    } catch (error) {
      return { ok: false, message: error.message || 'Invalid or expired code.' }
    }
  }

  const handleArtistApply = async (payload) => {
    try {
      const response = await artistApply(payload)
      return { ok: true, message: response?.message || 'Application submitted!' }
    } catch (error) {
      return { ok: false, message: error.message || 'Artist application failed.' }
    }
  }

  const handleForgotPassword = async (email) => {
    try {
      const response = await forgotPassword({ email })
      return { ok: true, message: response?.message || 'Reset code sent to your email.' }
    } catch (error) {
      return { ok: false, message: error.message || 'Could not send reset code.' }
    }
  }

  const handleResetPassword = async (email, otp, newPassword) => {
    try {
      const response = await resetPassword({ email, otp, newPassword })
      return { ok: true, message: response?.message || 'Password reset successfully.' }
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
          updateAvatar,
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
      />
      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onLogin={handleLogin}
        onSignup={handleSignup}
        currentUser={hydratedUser}
        onLogout={handleLogout}
      />
    </div>
  )
}

export default MainLayout

