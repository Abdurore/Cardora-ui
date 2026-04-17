import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { sendAnonymousMessage, getPublicUser, getTemplates } from '../lib/api.js'
import { mapTemplateToCard } from '../lib/backendMappers.js'

const ANON_PLACEHOLDER_TEMPLATES = [
  { id: 'anon-classic-1', title: 'Midnight Blue', subtitle: 'A quiet, moody note with soft contrast.', tier: 'classic', anonTier: 'classic', previewImage: '', accent: '#1e3a5f' },
  { id: 'anon-classic-2', title: 'Rose Gold', subtitle: 'Warm and personal with a gentle glow.', tier: 'classic', anonTier: 'classic', previewImage: '', accent: '#7d3551' },
  { id: 'anon-classic-3', title: 'Forest', subtitle: 'Grounded and calm with a softer edge.', tier: 'classic', anonTier: 'classic', previewImage: '', accent: '#1f4d2e' },
  { id: 'anon-premium-1', title: 'Aurora', subtitle: 'A richer atmosphere for premium notes.', tier: 'premium', anonTier: 'premium', previewImage: '', accent: '#2e1f7a' },
  { id: 'anon-premium-2', title: 'Crimson Night', subtitle: 'Dramatic, bold, and emotionally weighted.', tier: 'premium', anonTier: 'premium', previewImage: '', accent: '#5c0d0d' },
]

function getTemplateLayout(template) {
  return template?.backendTemplate?.layoutConfig || template?.backendTemplate?.layoutdata || template?.layoutConfig || {}
}

function getTemplateAccent(template) {
  const layout = getTemplateLayout(template)
  return template?.accent || layout?.theme?.accentColor || '#1a2a3a'
}

function getTemplateHeading(template) {
  const layout = getTemplateLayout(template)
  return template?.title || layout?.content?.heading || 'Anonymous note'
}

function getTemplateBody(template) {
  const layout = getTemplateLayout(template)
  return template?.subtitle || layout?.content?.body || 'Send something honest, kind, or surprising.'
}

function TemplateSwatch({ template, selected, onSelect }) {
  const accent = getTemplateAccent(template)
  const heading = getTemplateHeading(template)
  const body = getTemplateBody(template)

  return (
    <button
      type="button"
      className={`anon-template-swatch ${selected ? 'selected' : ''} ${template.anonTier === 'premium' ? 'premium-swatch' : ''}`}
      onClick={() => onSelect(template)}
      style={{ '--swatch-accent': accent }}
      title={template.title}
    >
      {template.previewImage ? (
        <img src={template.previewImage} alt={template.title} />
      ) : (
        <div className="anon-swatch-mini">
          <span className="anon-swatch-mini-accent" style={{ background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.24))` }} />
          <strong>{heading}</strong>
          <p>{body}</p>
        </div>
      )}
      <div className="anon-swatch-copy">
        <span className="anon-swatch-label">{template.title}</span>
        {template.anonTier === 'premium' && <span className="anon-swatch-premium-badge">Premium</span>}
      </div>
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
      .catch(() => {})
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

  const selectedAccent = getTemplateAccent(selectedTemplate)
  const selectedHeading = getTemplateHeading(selectedTemplate)
  const selectedBody = getTemplateBody(selectedTemplate)
  const livePreview = useMemo(() => message.trim() || 'Your anonymous message preview will appear here as you type.', [message])

  if (sent) {
    return (
      <div className="anon-page anon-sent-page">
        <div className="anon-sent-card">
          <span className="anon-sent-icon">?</span>
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
        <div className="anon-header">
          <Link to="/" className="anon-back-link">? Cardora</Link>
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

        <div className="anon-section">
          <p className="anon-section-label">Your anonymous message</p>
          <div className="anon-card-frame" style={{ '--anon-card-accent': selectedAccent }}>
            <div className="anon-card-frame-bg" style={{ background: `linear-gradient(145deg, ${selectedAccent}, rgba(8, 12, 18, 0.12))` }} />
            <div className="anon-card-frame-inner">
              <div className="anon-card-frame-top">
                <p className="anon-card-frame-kicker">Live card preview</p>
                <span className={`anon-msg-tier-badge ${selectedTier === 'premium' ? 'premium' : ''}`}>
                  {selectedTier === 'premium' ? 'Premium' : 'Classic'}
                </span>
              </div>
              <h3 className="anon-card-frame-heading">{selectedHeading}</h3>
              <p className="anon-card-frame-body">{selectedBody}</p>
              <div className="anon-card-live-preview">
                <p>{livePreview}</p>
              </div>
              <textarea
                className="anon-card-textarea"
                rows={5}
                maxLength={MAX_CHARS}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write something honest, kind, or surprising…"
              />
              <p className={`anon-card-char ${message.length >= MAX_CHARS - 20 ? 'warn' : ''}`}>
                {message.length}/{MAX_CHARS}
              </p>
            </div>
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

