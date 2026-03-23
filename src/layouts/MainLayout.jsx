import { Outlet } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import CardDetailModal from '../components/CardDetailModal.jsx'
import AuthModal from '../components/AuthModal.jsx'
import '../App.css'

function MainLayout() {
  const [selectedCard, setSelectedCard] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [balance, setBalance] = useState(34)
  const [cart, setCart] = useState([])
  const [users, setUsers] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [showAuth, setShowAuth] = useState(false)

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) || null,
    [currentUserId, users],
  )

  useEffect(() => {
    const storedUsers = localStorage.getItem('cardora:users')
    const storedSession = localStorage.getItem('cardora:currentUserId')
    if (storedUsers) {
      try {
        const parsed = JSON.parse(storedUsers)
        if (Array.isArray(parsed) && parsed.length) setUsers(parsed)
      } catch (error) {
        console.error('Failed to load users', error)
      }
    } else {
      const seedUsers = [
        {
          id: 'u1',
          name: 'The Creator',
          username: 'creator',
          email: 'creator@cardora.com',
          password: 'cardora',
          role: 'Artist',
          balance: 34,
          favorites: [],
          avatarColor: 'linear-gradient(135deg, #62ffa2, #7ef7ff)',
        },
        {
          id: 'u2',
          name: 'Sunset Muse',
          username: 'sunsetmuse',
          email: 'muse@cardora.com',
          password: 'cardora',
          role: 'Collector',
          balance: 58,
          favorites: [],
          avatarColor: 'linear-gradient(135deg, #ff9bd2, #7ef7ff)',
        },
      ]
      setUsers(seedUsers)
      localStorage.setItem('cardora:users', JSON.stringify(seedUsers))
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
      balance: 20,
      favorites: [],
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
    <div className="page">
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
        }}
      />

      <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
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
