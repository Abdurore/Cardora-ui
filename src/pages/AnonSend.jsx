import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { sendCardAnonymousMessage, getPublicUser, getUserAnonCard } from '../lib/api.js'

const MAX_CHARS = 500

function AnonSend() {
  const { username } = useParams()
  const [recipient, setRecipient] = useState(null)
  const [cardStyle, setCardStyle] = useState(null)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [recipientNotFound, setRecipientNotFound] = useState(false)
  const [cardStyleMissing, setCardStyleMissing] = useState(false)

  useEffect(() => {
    if (!username) return
    let cancelled = false
    Promise.allSettled([getPublicUser(username), getUserAnonCard(username)]).then(
      ([userRes, cardRes]) => {
        if (cancelled) return
        const u =
          userRes.status === 'fulfilled' && userRes.value
            ? userRes.value?.user || userRes.value?.data?.user || userRes.value
            : null
        if (!u) {
          setRecipientNotFound(true)
          setLoading(false)
          return
        }
        setRecipient({
          name: u?.username || u?.name || username,
          avatarUrl: u?.profilePictureUrl || u?.avatarUrl || '',
          avatarLetter: (u?.username || u?.name || username).charAt(0).toUpperCase(),
        })

        if (cardRes.status === 'fulfilled' && cardRes.value) {
          const card = cardRes.value?.card || cardRes.value?.data?.card || cardRes.value
          const l = card?.layoutConfig || card?.layoutdata || {}
          setCardStyle({
            heading: l?.content?.heading || '',
            body: l?.content?.body || '',
            backgroundColor: l?.card?.backgroundColor || '#07111a',
            headingColor: l?.card?.headingColor || '#e9fbff',
            textColor: l?.card?.textColor || 'rgba(201,247,255,0.72)',
            accentColor: l?.theme?.accentColor || '#7ef7ff',
            fontFamily: l?.theme?.fontFamily || 'Playfair Display',
            // Store slug for the /cards/:slug/anonymous-message endpoint
            cardSlug: card?.slug || card?.shareSlug || card?._id || card?.id || null,
          })
        } else {
          setCardStyleMissing(true)
        }
        setLoading(false)
      },
    )
    return () => { cancelled = true }
  }, [username])

  const bg = cardStyle?.backgroundColor || '#07111a'
  const accent = cardStyle?.accentColor || '#7ef7ff'
  const heading = cardStyle?.heading || `Send @${recipient?.name || username} a message`
  const body = cardStyle?.body || ''

  const handleSend = async () => {
    if (!message.trim()) { setError('Write something before sending.'); return }
    const slug = cardStyle?.cardSlug
    if (!slug) { setError('This inbox isn\'t ready to receive messages yet.'); return }
    setError('')
    setIsSending(true)
    try {
      await sendCardAnonymousMessage(slug, { content: message.trim() })
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  if (!loading && recipientNotFound) {
    return (
      <div className="anon-page" style={{ '--anon-bg': '#07111a', '--anon-accent': '#7ef7ff' }}>
        <div className="anon-page-bg" />
        <div className="anon-sent-card" style={{ borderColor: '#7ef7ff22' }}>
          <div className="anon-sent-glyph" style={{ color: '#7ef7ff' }}>?</div>
          <h2 style={{ color: '#e9fbff' }}>User not found</h2>
          <p style={{ color: 'rgba(201,247,255,0.7)' }}>
            The inbox link you followed doesn't belong to an active Cardora account.
          </p>
          <Link className="anon-footer-link" to="/">Go to Cardora</Link>
        </div>
      </div>
    )
  }

  if (sent) {
    return (
      <div className="anon-page" style={{ '--anon-bg': bg, '--anon-accent': accent }}>
        <div className="anon-page-bg" style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${accent}18, transparent 70%), ${bg}` }} />
        <div className="anon-sent-card" style={{ borderColor: `${accent}22` }}>
          <div className="anon-sent-glyph" style={{ color: accent }}>✦</div>
          <h2 style={{ color: cardStyle?.headingColor || '#e9fbff' }}>Sent.</h2>
          <p style={{ color: cardStyle?.textColor || 'rgba(201,247,255,0.7)' }}>
            Your message is on its way to <strong style={{ color: cardStyle?.headingColor || '#e9fbff' }}>@{recipient?.name || username}</strong>. You remain completely anonymous.
          </p>
          <button
            type="button"
            className="anon-send-btn"
            style={{ background: accent, color: bg }}
            onClick={() => { setMessage(''); setSent(false) }}
          >
            Send another
          </button>
          <Link className="anon-footer-link" to="/">Back to Cardora</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="anon-page" style={{ '--anon-bg': bg, '--anon-accent': accent }}>
      <div className="anon-page-bg" style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${accent}18, transparent 70%), ${bg}` }} />

      <header className="anon-top-bar">
        <Link to="/" className="anon-brand">Cardora</Link>
      </header>

      <div className="anon-container">
        <div className="anon-recipient">
          <div className="anon-recipient-avatar" style={{ borderColor: `${accent}44` }}>
            {recipient?.avatarUrl
              ? <img src={recipient.avatarUrl} alt="" />
              : <span style={{ color: accent }}>{loading ? '…' : (recipient?.avatarLetter || '?')}</span>}
          </div>
          <div>
            <p className="anon-recipient-label">Anonymous message for</p>
            <h2 className="anon-recipient-name" style={{ color: cardStyle?.headingColor || '#e9fbff' }}>
              @{recipient?.name || username}
            </h2>
          </div>
        </div>

        <div className="anon-card-frame" style={{ background: bg, borderColor: `${accent}1a` }}>
          {cardStyleMissing && (
            <p className="anon-style-note" style={{ color: `${accent}80` }}>
              @{recipient?.name || username} hasn't set up a custom inbox card yet — using default styling.
            </p>
          )}
          {(heading || body) && (
            <div className="anon-card-frame-copy">
              {heading && (
                <h3
                  className="anon-card-frame-heading"
                  style={{ color: cardStyle?.headingColor || '#e9fbff', fontFamily: `'${cardStyle?.fontFamily || 'Playfair Display'}', serif` }}
                >
                  {heading}
                </h3>
              )}
              {body && (
                <p className="anon-card-frame-body" style={{ color: cardStyle?.textColor || 'rgba(201,247,255,0.7)' }}>
                  {body}
                </p>
              )}
            </div>
          )}

          <textarea
            className="anon-card-textarea"
            rows={6}
            maxLength={MAX_CHARS}
            value={message}
            onChange={e => { setMessage(e.target.value); if (error) setError('') }}
            placeholder="Write something honest, kind, or surprising…"
            style={{ borderColor: `${accent}28`, caretColor: accent }}
          />

          <div className="anon-card-meta-row">
            <span className={`anon-card-char ${message.length >= MAX_CHARS - 30 ? 'warn' : ''}`}>
              {message.length}/{MAX_CHARS}
            </span>
            <span className="anon-privacy-badge" style={{ color: accent }}>
              &#x1F441;&#xFE0F; Anonymous
            </span>
          </div>

          {error && <p className="anon-error">{error}</p>}

          <button
            type="button"
            className="anon-send-btn"
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            style={{ background: accent, color: bg }}
          >
            {isSending ? 'Sending…' : 'Send Anonymously'}
          </button>
        </div>

        <p className="anon-footer-note">
          Your identity stays hidden forever.{' '}
          <Link to="/signup" style={{ color: accent }}>Get your own inbox</Link>
        </p>
      </div>
    </div>
  )
}

export default AnonSend
