import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import CardDetailModal from '../components/CardDetailModal.jsx'
import AuthModal from '../components/AuthModal.jsx'
import '../App.css'

function MainLayout() {
  const [selectedCard, setSelectedCard] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [balance, setBalance] = useState(50)
  const [cart, setCart] = useState([])
  const [users, setUsers] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) || null,
    [currentUserId, users],
  )

  useEffect(() => {
    const storedUsers = localStorage.getItem('cardora:users')
    const storedSession = localStorage.getItem('cardora:currentUserId')
    const SEED_VERSION = '2'
    const storedVersion = localStorage.getItem('cardora:seedVersion')

    const seedUsers = [
      {
        id: 'u1',
        name: 'The Creator',
        username: 'creator',
        email: 'creator@cardora.com',
        password: 'cardora',
        role: 'Artist',
        balance: 50,
        favorites: [],
        inventory: [],
        avatarColor: 'linear-gradient(135deg, #62ffa2, #7ef7ff)',
      },
      {
        id: 'u2',
        name: 'Sunset Muse',
        username: 'sunsetmuse',
        email: 'muse@cardora.com',
        password: 'cardora',
        role: 'Creator',
        balance: 50,
        favorites: [],
        inventory: [],
        avatarColor: 'linear-gradient(135deg, #ff9bd2, #7ef7ff)',
      },
      {
        id: 'u3',
        name: 'Admin',
        username: 'admin',
        email: 'admin@cardora.com',
        password: 'cardora',
        role: 'Admin',
        balance: 500,
        favorites: [],
        inventory: [],
        avatarColor: 'linear-gradient(135deg, #ffd700, #ff6b35)',
      },
    ]

    if (!storedUsers || storedVersion !== SEED_VERSION) {
      // Re-seed: merge any existing user data (avatar, inventory) with updated seed
      let merged = seedUsers
      if (storedUsers) {
        try {
          const old = JSON.parse(storedUsers)
          if (Array.isArray(old)) {
            merged = seedUsers.map(seed => {
              const existing = old.find(u => u.id === seed.id)
              return existing ? { ...seed, favorites: existing.favorites || [], inventory: existing.inventory || [], avatarUrl: existing.avatarUrl, balance: existing.balance } : seed
            })
          }
        } catch { /* use fresh seeds */ }
      }
      setUsers(merged)
      localStorage.setItem('cardora:users', JSON.stringify(merged))
      localStorage.setItem('cardora:seedVersion', SEED_VERSION)
    } else {
      try {
        const parsed = JSON.parse(storedUsers)
        if (Array.isArray(parsed) && parsed.length) setUsers(parsed)
      } catch (error) {
        console.error('Failed to load users', error)
      }
    }
    if (storedSession) setCurrentUserId(storedSession)
  }, [])

  useEffect(() => {
    if (users.length) localStorage.setItem('cardora:users', JSON.stringify(users))
  }, [users])

  useEffect(() => {
    if (currentUser) {
      setFavorites(currentUser.favorites || [])
      setBalance(currentUser.balance || 0)
    } else {
      setFavorites([])
      setBalance(0)
    }
    setCart([])
  }, [currentUser])

  const updateUser = (userId, updater) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === userId ? updater(user) : user)),
    )
  }

  const toggleFavorite = (cardId) => {
    if (!currentUser) {
      setShowAuth(true)
      return
    }
    updateUser(currentUser.id, (user) => {
      const nextFavorites = user.favorites.includes(cardId)
        ? user.favorites.filter((id) => id !== cardId)
        : [...user.favorites, cardId]
      return { ...user, favorites: nextFavorites }
    })
  }

  const addToCart = (pack) => {
    if (!currentUser) {
      setShowAuth(true)
      return
    }
    setCart((prev) => [...prev, pack])
    updateUser(currentUser.id, (user) => ({ ...user, balance: user.balance + pack.cc }))
  }

  const deductCC = (amount) => {
    if (!currentUser) {
      setShowAuth(true)
      return false
    }
    if (currentUser.balance < amount) return false
    updateUser(currentUser.id, (user) => ({ ...user, balance: user.balance - amount }))
    return true
  }

  const addGift = (gift) => {
    if (!currentUser) {
      setShowAuth(true)
      return { ok: false, reason: 'auth' }
    }
    if (currentUser.balance < gift.cc) return { ok: false, reason: 'balance' }
    updateUser(currentUser.id, (user) => ({
      ...user,
      balance: user.balance - gift.cc,
      inventory: [...(user.inventory || []), { ...gift, id: `gift-${Date.now()}` }],
    }))
    return { ok: true }
  }

  const handleLogin = (email, password) => {
    const match = users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase() && user.password === password,
    )
    if (!match) return false
    setCurrentUserId(match.id)
    localStorage.setItem('cardora:currentUserId', match.id)
    return true
  }

  const handleSignup = ({ name, username, email, password }) => {
    const exists =
      users.some((user) => user.email.toLowerCase() === email.toLowerCase()) ||
      users.some((user) => user.username?.toLowerCase() === username.toLowerCase())
    if (exists) return false
    const newUser = {
      id: `u${Date.now()}`,
      name,
      username,
      email,
      password,
      role: 'Creator',
      balance: 50,
      favorites: [],
      inventory: [],
      avatarColor: 'linear-gradient(135deg, #7ef7ff, #62ffa2)',
    }
    setUsers((prev) => [...prev, newUser])
    setCurrentUserId(newUser.id)
    localStorage.setItem('cardora:currentUserId', newUser.id)
    return true
  }

  const handleLogout = () => {
    setCurrentUserId(null)
    localStorage.removeItem('cardora:currentUserId')
  }

  const updateAvatar = (nextAvatar) => {
    if (!currentUser) return
    updateUser(currentUser.id, (user) => ({
      ...user,
      avatarUrl: nextAvatar,
      avatarColor: '',
    }))
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
          currentUser,
          openAuthModal: () => setShowAuth(true),
          updateAvatar,
          deductCC,
          addGift,
          inventory: currentUser?.inventory || [],
          openEditor: (data) => {
            navigate('/studio', { state: { cardData: data || null } })
          },
        }}
      />

      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        balance={balance}
        currentUser={currentUser}
        onRequireAuth={() => setShowAuth(true)}
        onDeductCC={deductCC}
        inventory={currentUser?.inventory || []}
      />
      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onLogin={handleLogin}
        onSignup={handleSignup}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </div>
  )
}

export default MainLayout
