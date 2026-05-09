import { useState, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { PALETTES, applyPalette, getPalettesForTier } from '../lib/palettes.js'
import { defaultCardObject } from '../data/cardDefaults.js'

const QUICK_FONTS = [
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Dancing Script', value: 'Dancing Script' },
  { label: 'Lora', value: 'Lora' },
  { label: 'Raleway', value: 'Raleway' },
]

function QuickCreate() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const cardType = params.get('type') || 'personal'
  const cardTier = params.get('tier') || 'classic'

  const { handleCreateCard, currentUser, balance, openAuthModal } = useOutletContext()

  const allowedTiers = cardTier === 'elite' ? ['classic', 'premium', 'elite'] : cardTier === 'premium' ? ['classic', 'premium'] : ['classic']
  const availablePalettes = getPalettesForTier(allowedTiers).slice(0, 8)

  const [selectedPalette, setSelectedPalette] = useState(availablePalettes[0] || PALETTES[0])
  const [selectedFont, setSelectedFont] = useState('Poppins')
  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState('')
  const [imageUrl, setImageUrl] = useState(null)
  const [imageBlobUrl, setImageBlobUrl] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)

  if (!currentUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <p style={{ color: 'rgba(226,234,240,0.6)', textAlign: 'center' }}>Sign in to create a card.</p>
        <button className="primary" type="button" onClick={openAuthModal}>Sign In</button>
      </div>
    )
  }

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const blob = URL.createObjectURL(file)
    setImageBlobUrl(blob)
    const reader = new FileReader()
    reader.onload = (e) => setImageUrl(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleSend = async () => {
    if (!heading.trim()) { setError('Please add a heading.'); return }
    if (!body.trim()) { setError('Please add a message.'); return }
    setError(null)
    setIsSending(true)

    const baseCard = applyPalette({ ...defaultCardObject }, selectedPalette)
    const cardObject = {
      ...baseCard,
      theme: { ...baseCard.theme, fontFamily: selectedFont },
      content: {
        ...baseCard.content,
        heading: heading.trim(),
        body: body.trim(),
      },
      media: {
        ...(baseCard.media || {}),
        images: imageUrl
          ? [{ url: imageUrl, fit: 'cover', positionX: 50, positionY: 50, height: 180 }]
          : [],
      },
    }

    const result = await handleCreateCard(cardObject, { type: cardType, tier: cardTier })
    setIsSending(false)

    if (!result.ok) {
      setError(result.message || 'Something went wrong.')
      return
    }

    const rawData = result.data
    const slug = rawData?.card?.slug || rawData?.slug || rawData?.data?.card?.slug || rawData?.data?.slug || null
    setSuccess({ slug, message: result.message })
  }

  const cardLink = success?.slug ? `${window.location.origin}/card/${success.slug}` : null

  const handleCopy = () => {
    if (!cardLink) return
    navigator.clipboard.writeText(cardLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (success) {
    return (
      <div className="qc-shell">
        <div className="qc-topbar">
          <button type="button" className="qc-back" onClick={() => navigate('/')}>← Home</button>
          <span className="qc-topbar-title">Card Created!</span>
        </div>
        <div className="qc-success">
          <div className="qc-success-icon">🎉</div>
          <h2>Your card is ready.</h2>
          <p>Share the link with your recipient.</p>
          {cardLink ? (
            <div className="qc-success-link">
              <span>{cardLink}</span>
              <button type="button" className="qc-success-copy" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <p style={{ color: 'rgba(126,239,255,0.7)' }}>Find your card in your Profile.</p>
          )}
          <button type="button" className="primary" onClick={() => navigate('/profile')}>Go to Profile</button>
        </div>
      </div>
    )
  }

  const previewStyle = {
    backgroundColor: selectedPalette.surface,
    color: selectedPalette.ink,
  }

  return (
    <div className="qc-shell">
      <div className="qc-topbar">
        <button type="button" className="qc-back" onClick={() => navigate(-1)}>← Back</button>
        <div>
          <div className="qc-topbar-title">Quick Start</div>
          <div className="qc-topbar-sub">
            {cardType.charAt(0).toUpperCase() + cardType.slice(1)} · {cardTier.charAt(0).toUpperCase() + cardTier.slice(1)}
          </div>
        </div>
        <Link
          to={`/studio?type=${cardType}&tier=${cardTier}`}
          style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'rgba(126,239,255,0.6)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Full Studio →
        </Link>
      </div>

      <div className="qc-split">
        {/* ── Left form pane ── */}
        <div className="qc-form-pane">
          {/* Palette */}
          <div>
            <p className="qc-section-label">Choose a Theme</p>
            <div className="qc-palette-grid">
              {availablePalettes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`qc-palette-swatch${selectedPalette.id === p.id ? ' active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${p.surface} 40%, ${p.primary})` }}
                  onClick={() => setSelectedPalette(p)}
                  title={p.label}
                >
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div>
            <p className="qc-section-label">Font Style</p>
            <div className="qc-font-grid">
              {QUICK_FONTS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`qc-font-btn${selectedFont === f.value ? ' active' : ''}`}
                  style={{ fontFamily: `'${f.value}', serif` }}
                  onClick={() => setSelectedFont(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Heading */}
          <div className="qc-field">
            <label>Heading</label>
            <input
              type="text"
              placeholder="A short, punchy heading…"
              value={heading}
              onChange={e => setHeading(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Body */}
          <div className="qc-field">
            <label>Your Message</label>
            <textarea
              rows={5}
              placeholder="Write what you want to say…"
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={4000}
            />
          </div>

          {/* Image */}
          <div>
            <p className="qc-section-label">Photo (Optional)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleImageFile(e.target.files?.[0])}
            />
            {imageBlobUrl ? (
              <div className="qc-img-upload">
                <img src={imageBlobUrl} alt="preview" className="qc-img-preview-thumb" />
                <span className="qc-img-upload-text">Image added</span>
                <button type="button" className="qc-img-remove" onClick={() => { setImageBlobUrl(null); setImageUrl(null) }}>✕</button>
              </div>
            ) : (
              <div className="qc-img-upload" onClick={() => fileInputRef.current?.click()}>
                <span className="qc-img-upload-icon">📷</span>
                <span className="qc-img-upload-text">Tap to add a photo</span>
              </div>
            )}
          </div>

          {/* Recipient */}
          <div className="qc-field">
            <label>Recipient Email (optional)</label>
            <input
              type="email"
              placeholder="friend@example.com"
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
            />
          </div>

          {/* Submit */}
          <div className="qc-submit-area">
            {error && <p style={{ color: '#ff8080', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
            <button
              type="button"
              className="qc-submit-btn"
              disabled={isSending}
              onClick={handleSend}
            >
              {isSending ? 'Creating…' : 'Create Card'}
            </button>
            <p className="qc-studio-link">
              Want more control? <Link to={`/studio?type=${cardType}&tier=${cardTier}`}>Open Full Studio →</Link>
            </p>
          </div>
        </div>

        {/* ── Right preview pane ── */}
        <div className="qc-preview-pane">
          <div className="qc-card-mini" style={previewStyle}>
            {imageBlobUrl && (
              <img src={imageBlobUrl} alt="" />
            )}
            <h3
              style={{
                fontFamily: `'${selectedFont}', serif`,
                color: selectedPalette.primary,
                margin: 0,
                fontSize: '1.3rem',
              }}
            >
              {heading || 'Your heading here'}
            </h3>
            <p
              style={{
                fontFamily: `'${selectedFont}', sans-serif`,
                color: selectedPalette.ink,
                margin: 0,
                fontSize: '0.88rem',
                opacity: 0.85,
              }}
            >
              {body || 'Your message will appear here…'}
            </p>
            <p className="qc-mini-watermark" style={{ color: selectedPalette.ink }}>Made with Cardora</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickCreate
