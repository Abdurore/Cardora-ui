import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPublicProfile } from '../lib/api.js'

const bg = '#07111a'
const accent = '#7ef7ff'

// There is no backend concept of "a user's anonymous inbox card" — an
// anonymous card is just a card like any other, identified by its own slug
// (/card/:slug), not by the creator's username. This route used to render a
// message form that always failed at send time because it had no slug to
// post to. Rather than keep that dead end, this page now says so plainly
// and points the visitor at the one thing that actually works: asking the
// person for their card link directly.
function AnonSend() {
  const { username } = useParams()
  const [recipient, setRecipient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recipientNotFound, setRecipientNotFound] = useState(false)

  useEffect(() => {
    if (!username) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await getPublicProfile(username)
        if (cancelled) return
        // Actual response shape is { profile, profileBackgrounds } —
        // res.user/res.data were never right, so a valid username always
        // fell through to "not found" here.
        const u = res?.profile || res?.data?.profile || res?.data?.user || res?.user || res?.data || res
        if (!u || !u.username) {
          setRecipientNotFound(true)
          setLoading(false)
          return
        }
        setRecipient({
          name: u.username || u.name || username,
          avatarUrl: u.profilePictureUrl || u.avatarUrl || '',
          avatarLetter: (u.username || u.name || username).charAt(0).toUpperCase(),
        })
      } catch {
        if (!cancelled) setRecipientNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [username])

  if (!loading && recipientNotFound) {
    return (
      <div className="anon-page" style={{ '--anon-bg': bg, '--anon-accent': accent }}>
        <div className="anon-page-bg" />
        <div className="anon-sent-card" style={{ borderColor: '#7ef7ff22' }}>
          <div className="anon-sent-glyph" style={{ color: accent }}>?</div>
          <h2 style={{ color: '#e9fbff' }}>User not found</h2>
          <p style={{ color: 'rgba(201,247,255,0.7)' }}>
            The inbox link you followed doesn't belong to an active Cardora account.
          </p>
          <Link className="anon-footer-link" to="/">Go to Cardora</Link>
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
            <p className="anon-recipient-label">Looking for</p>
            <h2 className="anon-recipient-name" style={{ color: '#e9fbff' }}>
              @{recipient?.name || username}
            </h2>
          </div>
        </div>

        <div className="anon-card-frame" style={{ background: bg, borderColor: `${accent}1a` }}>
          <div className="anon-card-frame-copy">
            <h3 className="anon-card-frame-heading" style={{ color: '#e9fbff' }}>
              No inbox link connected yet
            </h3>
            <p className="anon-card-frame-body" style={{ color: 'rgba(201,247,255,0.7)' }}>
              @{recipient?.name || username} hasn't linked an anonymous card to their profile.
              Anonymous messages go through a card's own link, not a username — ask them to
              send you their Cardora card link directly, or create your own anonymous card to
              share.
            </p>
          </div>
          <Link to="/create" className="anon-send-btn" style={{ background: accent, color: bg, textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
            Create an anonymous card
          </Link>
        </div>

        <p className="anon-footer-note">
          Already have a card link? <Link to="/" style={{ color: accent }}>Open it directly</Link>
        </p>
      </div>
    </div>
  )
}

export default AnonSend
