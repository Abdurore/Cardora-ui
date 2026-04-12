import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { sendAnonymousMessage, getPublicUser, getTemplates } from '../lib/api.js'
import { mapTemplateToCard } from '../lib/backendMappers.js'

const ANON_PLACEHOLDER_TEMPLATES = [
  { id: 'anon-classic-1', title: 'Midnight Blue', tier: 'classic', anonTier: 'classic', previewImage: '', accent: '#1e3a5f' },
  { id: 'anon-classic-2', title: 'Rose Gold',     tier: 'classic', anonTier: 'classic', previewImage: '', accent: '#7d3551' },
  { id: 'anon-classic-3', title: 'Forest',         tier: 'classic', anonTier: 'classic', previewImage: '', accent: '#1f4d2e' },
  { id: 'anon-premium-1', title: 'Aurora',          tier: 'premium', anonTier: 'premium', previewImage: '', accent: '#2e1f7a' },
  { id: 'anon-premium-2', title: 'Crimson Night',   tier: 'premium', anonTier: 'premium', previewImage: '', accent: '#5c0d0d' },
]

function TemplateSwatch({ template, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`anon-template-swatch ${selected ? 'selected' : ''} ${template.anonTier === 'premium' ? 'premium-swatch' : ''}`}
      onClick={() => onSelect(template)}
      style={{ '--swatch-accent': template.accent || '#1a2a3a' }}
      title={template.title}
    >
      {template.previewImage ? (
        <img src={template.previewImage} alt={template.title} />
      ) : (
        <span className="anon-swatch-preview" />
      )}
      <span className="anon-swatch-label">{template.title}</span>
      {template.anonTier === 'premium' && <span className="anon-swatch-premium-badge">Premium</span>}
    </button>
  )
}

function AnonSend() {
  const { username } = useParams()
  const [recipient, setRecipient] = useState(null)
  const [templates, setTemplates] = useState(ANON_PLACEHOLDER_TEMPLATES)
  const [selectedTemplate, setSelectedTemplate] = useState(ANON_PLACEHOLDER_TEMPLATES[0])
  const [selectedTier, setSelectedTier] = useState('classic')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const MAX_CHARS = 500

  // Load recipient info
  useEffect(() => {
    if (!username) return
    let cancelled = false
    getPublicUser(username)
      .then((data) => {
        if (cancelled || !data) return
        const user = data?.user || data?.data?.user || data
        setRecipient({
          name: user.username || user.name || username,
          avatarUrl: user.profilePictureUrl || user.avatarUrl || '',
          avatarLetter: (user.username || user.name || username).charAt(0).toUpperCase(),
        })
      })
      .catch(() => {
        if (!cancelled) setRecipient({ name: username, avatarUrl: '', avatarLetter: username.charAt(0).toUpperCase() })
      })
    return () => { cancelled = true }
  }, [username])

  // Load anonymous templates from backend (filtered by category: anonymous)
  useEffect(() => {
    let cancelled = false
    getTemplates('page=1&limit=30&category=anonymous')
      .then((res) => {
        if (cancelled) return
        const raw = res?.templates || res?.data?.templates || res?.data || []
        if (Array.isArray(raw) && raw.length > 0) {
          const mapped = raw.map((t, i) => mapTemplateToCard(t, i))
          setTemplates(mapped)
          setSelectedTemplate(mapped[0])
        }
      })
      .catch(() => {}) // keep placeholders on error
    return () => { cancelled = true }
  }, [])

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Please write a message before sending.')
      return
    }
    setError('')
    setIsSending(true)
    try {
      await sendAnonymousMessage({
        recipientUsername: username,
        message: message.trim(),
        templateId: selectedTemplate?.id || selectedTemplate?.templateId || null,
        tier: selectedTier,
      })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  if (sent) {
    return (
      <div className="anon-page anon-sent-page">
        <div className="anon-sent-card">
          <span className="anon-sent-icon">✉</span>
          <h2>Message sent!</h2>
          <p>Your anonymous message has been delivered to <strong>@{username}</strong>.</p>
          <p className="anon-sent-sub">They'll see it in their anonymous inbox. You remain completely anonymous.</p>
          <button
            type="button"
            className="primary anon-send-again-btn"
            onClick={() => { setMessage(''); setSent(false) }}
          >
            Send another message
          </button>
          <Link className="ghost" to="/">Back to Cardora</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="anon-page">
      <div className="anon-container">
        {/* Header */}
        <div className="anon-header">
          <Link to="/" className="anon-back-link">← Cardora</Link>
          <div className="anon-recipient">
            <div className="anon-recipient-avatar">
              {recipient?.avatarUrl ? (
                <img src={recipient.avatarUrl} alt="" />
              ) : (
                <span>{recipient?.avatarLetter || username?.charAt(0)?.toUpperCase() || '?'}</span>
              )}
            </div>
            <div>
              <p className="anon-recipient-label">Send an anonymous message to</p>
              <h2 className="anon-recipient-name">@{recipient?.name || username}</h2>
            </div>
          </div>
          <p className="anon-privacy-note">
            Your identity is completely hidden. They will never know who sent this.
          </p>
        </div>

        {/* Template picker */}
        <div className="anon-section">
          <p className="anon-section-label">Choose a card style</p>
          <div className="anon-template-row">
            {templates.map((t) => (
              <TemplateSwatch
                key={t.id}
                template={t}
                selected={selectedTemplate?.id === t.id}
                onSelect={setSelectedTemplate}
              />
            ))}
          </div>
        </div>

        {/* Tier selector */}
        <div className="anon-section">
          <p className="anon-section-label">Card tier</p>
          <div className="anon-tier-row">
            <button
              type="button"
              className={`anon-tier-btn ${selectedTier === 'classic' ? 'active' : ''}`}
              onClick={() => setSelectedTier('classic')}
            >
              <span className="anon-tier-name">Classic</span>
              <span className="anon-tier-sub">Free</span>
            </button>
            <button
              type="button"
              className={`anon-tier-btn anon-tier-premium ${selectedTier === 'premium' ? 'active' : ''}`}
              onClick={() => setSelectedTier('premium')}
            >
              <span className="anon-tier-name">Premium</span>
              <span className="anon-tier-sub">Rich effects & music</span>
            </button>
          </div>
        </div>

        {/* Message input */}
        <div className="anon-section">
          <p className="anon-section-label">Your anonymous message</p>
          <div className="anon-message-wrap">
            <textarea
              className="anon-textarea"
              rows={5}
              maxLength={MAX_CHARS}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write something honest, kind, or surprising…"
            />
            <span className={`anon-char-count ${message.length >= MAX_CHARS - 20 ? 'warn' : ''}`}>
              {message.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        {error && <p className="anon-error">{error}</p>}

        <button
          type="button"
          className="primary anon-send-btn"
          onClick={handleSend}
          disabled={isSending || !message.trim()}
        >
          {isSending ? 'Sending…' : 'Send Anonymously'}
        </button>

        <p className="anon-footer-note">
          Powered by <Link to="/">Cardora</Link> — want your own inbox?{' '}
          <Link to="/signup">Sign up free</Link>
        </p>
      </div>
    </div>
  )
}

export default AnonSend
