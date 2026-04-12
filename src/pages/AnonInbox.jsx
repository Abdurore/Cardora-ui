import { useEffect, useState, useCallback } from 'react'
import { useOutletContext, useNavigate, Link } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import { getAnonMessages, deleteAnonMessage } from '../lib/api.js'

function formatRelativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function AnonMessageCard({ msg, onDelete }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete(msg.id || msg._id)
    setDeleting(false)
  }

  return (
    <article className="anon-msg-card">
      <div
        className="anon-msg-card-bg"
        style={{ background: msg.templateAccent || 'linear-gradient(135deg, #0d1b22, #163543)' }}
      />
      <div className="anon-msg-card-body">
        <div className="anon-msg-header">
          <span className={`anon-msg-tier-badge ${msg.tier === 'premium' ? 'premium' : ''}`}>
            {msg.tier === 'premium' ? 'Premium' : 'Classic'}
          </span>
          <span className="anon-msg-time">{formatRelativeTime(msg.createdAt)}</span>
        </div>
        <p className="anon-msg-text">{msg.message || msg.content || ''}</p>
      </div>
      <button
        type="button"
        className="anon-msg-delete-btn"
        onClick={handleDelete}
        disabled={deleting}
        title="Delete message"
        aria-label="Delete message"
      >
        {deleting ? '…' : '✕'}
      </button>
    </article>
  )
}

function AnonInbox() {
  const { currentUser, openAuthModal, balance } = useOutletContext()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareLink = currentUser
    ? `${window.location.origin}/ask/@${currentUser.username}`
    : ''

  const copyLink = () => {
    if (!shareLink) return
    navigator.clipboard?.writeText(shareLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const loadMessages = useCallback(async (pageNum = 1) => {
    setLoading(true)
    try {
      const res = await getAnonMessages()
      const raw = res?.messages || res?.data?.messages || res?.data || []
      if (pageNum === 1) {
        setMessages(Array.isArray(raw) ? raw : [])
      } else {
        setMessages((prev) => [...prev, ...(Array.isArray(raw) ? raw : [])])
      }
      setHasMore(Boolean(res?.hasMore || res?.data?.hasMore))
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUser) return
    loadMessages(1)
  }, [currentUser, loadMessages])

  const handleDelete = async (id) => {
    await deleteAnonMessage(id)
    setMessages((prev) => prev.filter((m) => (m.id || m._id) !== id))
  }

  // Not logged in — prompt auth
  if (!currentUser) {
    return (
      <div className="page-body">
        <ScreenHeader user={null} balance={0} onAuthOpen={openAuthModal} />
        <div className="screen-body">
          <div className="anon-inbox-auth-wall">
            <span className="anon-inbox-auth-icon">👁</span>
            <h2>Anonymous Inbox</h2>
            <p>Sign in to set up your anonymous inbox and receive messages from anyone.</p>
            <button className="primary" type="button" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
        <ScreenNav />
      </div>
    )
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">

        {/* Header */}
        <div className="anon-inbox-header">
          <div>
            <p className="eyebrow">Anonymous Inbox</p>
            <h2 className="anon-inbox-title">Messages sent to you</h2>
          </div>
          <p className="anon-inbox-sub">
            Share your link and anyone can send you an anonymous message.
          </p>
        </div>

        {/* Share link */}
        <div className="anon-inbox-share-card">
          <p className="anon-inbox-share-label">Your anonymous link</p>
          <div className="anon-inbox-share-row">
            <code className="anon-inbox-share-url">{shareLink}</code>
            <button
              type="button"
              className={`anon-inbox-copy-btn ${copied ? 'copied' : ''}`}
              onClick={copyLink}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <p className="anon-inbox-share-hint">
            Send this link to friends, post it on social media, or share it anywhere.
          </p>
        </div>

        {/* Messages */}
        {loading ? (
          <div className="anon-inbox-loading">
            <div className="chat-loading-spinner" />
            <p>Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="anon-inbox-empty">
            <span className="anon-inbox-empty-icon">✉</span>
            <h3>No messages yet</h3>
            <p>Share your link above to start receiving anonymous messages.</p>
            <button type="button" className="primary" onClick={copyLink}>
              Copy your link
            </button>
          </div>
        ) : (
          <>
            <div className="anon-msg-feed">
              {messages.map((msg) => (
                <AnonMessageCard
                  key={msg.id || msg._id || Math.random()}
                  msg={msg}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            {hasMore && (
              <div className="explore-load-more">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    const nextPage = page + 1
                    setPage(nextPage)
                    loadMessages(nextPage)
                  }}
                >
                  Load more messages
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <ScreenNav />
    </div>
  )
}

export default AnonInbox
