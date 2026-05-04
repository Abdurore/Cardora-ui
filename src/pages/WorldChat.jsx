import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext, useNavigate, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import ScreenNav from '../components/ScreenNav.jsx'
import { getWorldChat, getPublicProfile, API_BASE } from '../lib/api.js'
import { mapChatMessage } from '../lib/backendMappers.js'

function formatAge(isoStr) {
  if (!isoStr) return ''
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return new Date(isoStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function WorldChat() {
  const { currentUser, balance, openAuthModal } = useOutletContext()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [joinLeave, setJoinLeave] = useState([])
  const [onlineCount, setOnlineCount] = useState(0)
  const [, setTick] = useState(0)
  const [profileCard, setProfileCard] = useState(null) // { userId, username, avatarUrl, role }
  const [profileDetails, setProfileDetails] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const cooldownRef = useRef(null)

  const MSG_CAP = 150

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load message history
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await getWorldChat('page=1&limit=50')
        const raw = res?.data?.messages || res?.messages || []
        if (!cancelled) {
          setMessages(raw.map(mapChatMessage))
          setLoading(false)
          setTimeout(scrollToBottom, 100)
        }
      } catch (err) {
        console.error('Chat history load failed', err)
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [currentUser, scrollToBottom])

  // WebSocket connection
  useEffect(() => {
    if (!currentUser) return

    const socket = io(API_BASE, {
      auth: {
        userId: currentUser.id,
        username: currentUser.username,
      },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('new_message', (data) => {
      const msg = mapChatMessage(data)
      setMessages(prev => {
        const next = [...prev, msg]
        return next.length > MSG_CAP ? next.slice(-MSG_CAP) : next
      })
      setTimeout(scrollToBottom, 50)
    })

    socket.on('user_joined', (data) => {
      setJoinLeave(prev => [...prev.slice(-4), { type: 'join', username: data.username, time: Date.now() }])
      setOnlineCount((n) => n + 1)
    })

    socket.on('user_left', (data) => {
      setJoinLeave(prev => [...prev.slice(-4), { type: 'leave', username: data.username, time: Date.now() }])
      setOnlineCount((n) => Math.max(0, n - 1))
    })

    socket.on('online_count', (data) => {
      if (typeof data?.count === 'number') setOnlineCount(data.count)
    })

    socket.on('error', (data) => {
      setError(data.message || 'Something went wrong')
      const match = data.message?.match(/wait (\d+) seconds/)
      if (match) {
        const secs = parseInt(match[1])
        setCooldown(secs)
        clearInterval(cooldownRef.current)
        cooldownRef.current = setInterval(() => {
          setCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownRef.current)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      clearInterval(cooldownRef.current)
    }
  }, [currentUser, scrollToBottom])

  // Online / offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Live timestamp ticker — re-renders every 30s so "just now" → "2m ago" etc.
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  // Auto-clear join/leave toasts
  useEffect(() => {
    if (joinLeave.length === 0) return
    const timer = setTimeout(() => {
      setJoinLeave(prev => prev.filter(item => Date.now() - item.time < 3000))
    }, 3500)
    return () => clearTimeout(timer)
  }, [joinLeave])

  // Fetch extended profile details when a profile card is opened
  useEffect(() => {
    if (!profileCard) { setProfileDetails(null); return }
    let cancelled = false
    setProfileDetails(null)
    setProfileLoading(true)
    ;(async () => {
      try {
        const res = await getPublicProfile(profileCard.username)
        if (cancelled) return
        const u = res?.data?.user || res?.user || res?.data || res
        setProfileDetails(u || null)
      } catch {
        if (!cancelled) setProfileDetails(null)
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [profileCard])

  const SEND_COOLDOWN = 15 // seconds between messages

  const sendMessage = () => {
    if (!input.trim() || cooldown > 0 || !isOnline || !connected) return
    socketRef.current?.emit('send_message', { content: input.trim() })
    setInput('')
    setError('')
    // Client-side cooldown so button is visually locked immediately
    setCooldown(SEND_COOLDOWN)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // User can always type while signed in + online; cooldown only gates the actual send.
  const canType = Boolean(currentUser && isOnline && connected)
  const canSend = Boolean(canType && !cooldown)

  function normalizeRole(raw) {
    if (!raw) return null
    const r = String(raw).toLowerCase()
    if (r === 'admin') return 'Admin'
    if (r === 'artist') return 'Artist'
    if (r === 'moderator') return 'Moderator'
    if (r === 'enterprise') return 'Enterprise'
    return null
  }

  function roleBadgeClass(role) {
    if (role === 'Admin') return 'role-admin'
    if (role === 'Artist') return 'role-artist'
    if (role === 'Moderator') return 'role-moderator'
    if (role === 'Enterprise') return 'role-enterprise'
    return ''
  }

  function roleIcon(role) {
    if (role === 'Admin') return '⚡'
    if (role === 'Artist') return '🎨'
    if (role === 'Moderator') return '🛡'
    if (role === 'Enterprise') return '🏢'
    return ''
  }

  function formatJoined(isoStr) {
    if (!isoStr) return null
    return new Date(isoStr).toLocaleDateString([], { month: 'long', year: 'numeric' })
  }

  return (
    <div className="page-body chat-page">
      <div className="screen-body chat-body">
        <div className="chat-header-bar">
          <Link to="/" className="chat-header-brand">
            <img src="/cardora-logo.png?v=4" alt="Cardora" className="chat-header-logo" />
            <span className="chat-header-wordmark">Cardora</span>
          </Link>

          <div className="chat-header-center">
            <p className="eyebrow">Community</p>
            <h2 className="chat-title">World Chat</h2>
            <div className="chat-header-meta">
              {onlineCount > 0 && (
                <span className="chat-online-count">{onlineCount} online</span>
              )}
              <span className={`chat-status ${connected ? 'online' : 'offline'}`}>
                <span className={`chat-status-dot ${!connected ? 'pulse' : ''}`} />
                {connected ? 'Live' : 'Reconnecting…'}
              </span>
            </div>
          </div>

          {currentUser ? (
            <Link to="/profile" className="chat-header-profile">
              {currentUser.avatarUrl
                ? <img src={currentUser.avatarUrl} alt="" className="chat-header-avatar" />
                : <span className="chat-header-avatar-initial">{(currentUser.name || 'U')[0]}</span>}
              <span className="chat-header-balance">◈ {balance}</span>
            </Link>
          ) : (
            <button type="button" className="primary chat-header-signin" onClick={openAuthModal}>Sign in</button>
          )}
        </div>

        {/* Offline banner */}
        {!isOnline && (
          <div className="chat-offline-banner">
            You're offline — messages are read-only until you reconnect.
          </div>
        )}

        {/* Join/Leave toasts */}
        {joinLeave.length > 0 && (
          <div className="chat-toasts">
            {joinLeave.map((item, i) => (
              <div key={`${item.username}-${item.time}-${i}`} className={`chat-toast ${item.type}`}>
                {item.type === 'join' ? '→' : '←'} {item.username} {item.type === 'join' ? 'joined' : 'left'}
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages">
          {loading ? (
            <div className="chat-loading">
              <div className="chat-loading-spinner" />
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <span>✨</span>
              <p>No messages yet. Be the first to say something!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.userId === currentUser.id
              const openProfile = () => setProfileCard({
                userId: msg.userId,
                username: msg.username,
                avatarUrl: msg.profilePictureUrl,
                role: msg.role,
              })
              return (
                <div key={msg.id} className={`chat-msg ${isMe ? 'me' : ''}`}>
                  {!isMe && (
                    <div className="chat-msg-head">
                      <button
                        type="button"
                        className="chat-msg-avatar chat-msg-avatar-btn"
                        onClick={openProfile}
                        title={`View ${msg.username}'s profile`}
                      >
                        {msg.profilePictureUrl ? (
                          <img src={msg.profilePictureUrl} alt="" />
                        ) : (
                          <span>{msg.username?.charAt(0)?.toUpperCase() || '?'}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="chat-msg-name chat-msg-name-btn"
                        onClick={openProfile}
                      >
                        {msg.username}
                      </button>
                      <span className="chat-msg-time">{formatAge(msg.createdAt)}</span>
                    </div>
                  )}
                  <div className="chat-msg-body">
                    <div className="chat-msg-bubble">
                      {msg.content}
                    </div>
                    {isMe && <span className="chat-msg-time">{formatAge(msg.createdAt)}</span>}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && <p className="chat-error">{error}</p>}

        {/* Input */}
        {!currentUser ? (
          <div className="chat-signin-bar">
            <p>Sign in to join the conversation.</p>
            <button className="primary" type="button" onClick={() => navigate('/login')}>Sign In</button>
          </div>
        ) : (
          <div className="chat-input-bar">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !isOnline ? 'You\'re offline…'
                : !connected ? 'Reconnecting…'
                : cooldown > 0 ? `Ready in ${cooldown}s — type now`
                : 'Type a message…'
              }
              disabled={!canType}
              maxLength={500}
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={!canSend || !input.trim()}
              aria-label="Send message"
            >
              {cooldown > 0 ? (
                <span className="chat-send-cooldown">{cooldown}</span>
              ) : (
                <svg viewBox="0 0 24 24" className="chat-send-icon" aria-hidden="true">
                  <path
                    d="M3.4 20.4l17.45-8.3a1.2 1.2 0 0 0 0-2.2L3.4 1.6a1.2 1.2 0 0 0-1.67 1.4L4.5 11 1.73 19a1.2 1.2 0 0 0 1.67 1.4z"
                    fill="currentColor"
                  />
                  <path d="M4.8 11h7.4" stroke="rgba(4,16,21,0.35)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
      <ScreenNav />

      {profileCard && createPortal(
        <div className="chat-profile-overlay" role="dialog" aria-modal="true">
          <div className="chat-profile-backdrop" onClick={() => setProfileCard(null)} />
          <div className="chat-profile-card">
            <button type="button" className="chat-profile-close" onClick={() => setProfileCard(null)} aria-label="Close">×</button>

            {profileLoading ? (
              <div className="chat-profile-skeleton">
                <div className="chat-profile-skeleton-avatar" />
                <div className="chat-profile-skeleton-lines">
                  <div className="chat-profile-skeleton-line wide" />
                  <div className="chat-profile-skeleton-line narrow" />
                </div>
              </div>
            ) : (() => {
              // Backend response shapes drift between endpoints. Try every
              // plausible field name so the modal never looks empty when the
              // data IS there under a slightly different key.
              const p = profileDetails || {}
              const num = (v) => (typeof v === 'number' ? v : null)
              const displayAvatarUrl = p.profilePictureUrl || p.avatarUrl || p.avatar || p.picture || profileCard.avatarUrl
              const displayName = p.username || profileCard.username
              const role = normalizeRole(p.role || p.userRole || profileCard.role)
              const bio = p.bio || p.about || p.description || null
              const joined = formatJoined(p.createdAt || p.joinedAt || p.created_at || p.signupDate || p.dateJoined)
              const referrals = num(p.referralsCount ?? p.referrals ?? p.referredCount)
              const cardsSent = num(p.cardsSent ?? p.cardsCount ?? p.totalCards ?? p.cards)
              const followers = num(p.followersCount ?? p.followers)
              const following = num(p.followingCount ?? p.following)
              const isVerified = !!(p.isVerified || p.verified)
              const status = p.status || p.customStatus || null
              const fullName = p.fullName || p.displayName || p.name || null
              const location = p.location || p.country || p.city || null
              const userIdShort = String(p.id || p._id || profileCard.userId || '').slice(-8)
              const hasAnyDetail = !!(bio || joined || cardsSent !== null || followers !== null || following !== null || referrals !== null || location || fullName)

              return (
                <>
                  <div className="chat-profile-header">
                    <div className="chat-profile-avatar-wrap">
                      {displayAvatarUrl
                        ? <img src={displayAvatarUrl} alt="" className="chat-profile-avatar" />
                        : <span className="chat-profile-avatar-initial">{(displayName || 'U')[0].toUpperCase()}</span>}
                      {isVerified && <span className="chat-profile-verified" title="Verified">✓</span>}
                    </div>
                    <div className="chat-profile-info">
                      {fullName && <p className="chat-profile-fullname">{fullName}</p>}
                      <p className="chat-profile-name">@{displayName}</p>
                      <div className="chat-profile-badges">
                        {role && (
                          <span className={`profile-role-badge ${roleBadgeClass(role)}`}>
                            {roleIcon(role)} {role}
                          </span>
                        )}
                        {status && <span className="chat-profile-status-pill">{status}</span>}
                      </div>
                    </div>
                  </div>

                  {bio && <p className="chat-profile-bio">{bio}</p>}

                  {(cardsSent !== null || followers !== null || following !== null || referrals !== null) && (
                    <div className="chat-profile-stats">
                      {cardsSent !== null && (
                        <div className="chat-profile-stat">
                          <strong>{cardsSent}</strong>
                          <span>{cardsSent === 1 ? 'Card' : 'Cards'}</span>
                        </div>
                      )}
                      {followers !== null && (
                        <div className="chat-profile-stat">
                          <strong>{followers}</strong>
                          <span>{followers === 1 ? 'Follower' : 'Followers'}</span>
                        </div>
                      )}
                      {following !== null && (
                        <div className="chat-profile-stat">
                          <strong>{following}</strong>
                          <span>Following</span>
                        </div>
                      )}
                      {referrals !== null && (
                        <div className="chat-profile-stat">
                          <strong>{referrals}</strong>
                          <span>{referrals === 1 ? 'Referral' : 'Referrals'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="chat-profile-meta">
                    {joined && (
                      <span className="chat-profile-meta-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Joined {joined}
                      </span>
                    )}
                    {location && (
                      <span className="chat-profile-meta-item">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {location}
                      </span>
                    )}
                    {userIdShort && (
                      <span className="chat-profile-meta-item chat-profile-id">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.6c1.4-2.5 3-3.6 5-3.6s3.6 1.1 5 3.6"/></svg>
                        ID …{userIdShort}
                      </span>
                    )}
                  </div>

                  {!hasAnyDetail && (
                    <p className="chat-profile-empty">
                      This member hasn't added any extra details yet.
                    </p>
                  )}
                </>
              )
            })()}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default WorldChat
