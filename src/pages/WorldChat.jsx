import { useEffect, useRef, useState, useCallback } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import ScreenNav from '../components/ScreenNav.jsx'
import { getWorldChat, API_BASE } from '../lib/api.js'
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

  const SEND_COOLDOWN = 5 // seconds between messages

  const sendMessage = () => {
    if (!input.trim() || cooldown > 0 || !isOnline || !connected) return
    socketRef.current?.emit('send_message', { content: input.trim() })
    setInput('')
    setError('')
    // Start client-side cooldown
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

  const canSend = Boolean(currentUser && isOnline && connected && !cooldown)

  return (
    <div className="page-body chat-page">
      <div className="screen-body chat-body">
        <div className="chat-header-bar">
          <div>
            <p className="eyebrow">Community</p>
            <h2 className="chat-title">World Chat</h2>
          </div>
          <div className="chat-header-right">
            {onlineCount > 0 && (
              <span className="chat-online-count">{onlineCount} online</span>
            )}
            <span className={`chat-status ${connected ? 'online' : 'offline'}`}>
              <span className={`chat-status-dot ${!connected ? 'pulse' : ''}`} />
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
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
              return (
                <div key={msg.id} className={`chat-msg ${isMe ? 'me' : ''}`}>
                  {!isMe && (
                    <div className="chat-msg-avatar">
                      {msg.profilePictureUrl ? (
                        <img src={msg.profilePictureUrl} alt="" />
                      ) : (
                        <span>{msg.username?.charAt(0)?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                  )}
                  <div className="chat-msg-body">
                    {!isMe && <span className="chat-msg-name">{msg.username}</span>}
                    <div className="chat-msg-bubble">
                      {msg.content}
                    </div>
                    <span className="chat-msg-time">{formatAge(msg.createdAt)}</span>
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
                : cooldown > 0 ? `Wait ${cooldown}s…`
                : 'Type a message…'
              }
              disabled={!canSend}
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
    </div>
  )
}

export default WorldChat
