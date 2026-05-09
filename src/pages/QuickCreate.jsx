import { useState, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { PALETTES, applyPalette, getPalettesForTier } from '../lib/palettes.js'
import { defaultCardObject } from '../data/cardDefaults.js'

const QUICK_FONTS = [
  { label: 'Poppins',          value: 'Poppins',          sample: 'Modern & Clean' },
  { label: 'Playfair Display', value: 'Playfair Display', sample: 'Elegant Serif' },
  { label: 'Montserrat',       value: 'Montserrat',       sample: 'Bold Geometric' },
  { label: 'Dancing Script',   value: 'Dancing Script',   sample: 'Handwritten' },
  { label: 'Lora',             value: 'Lora',             sample: 'Literary Charm' },
  { label: 'Raleway',          value: 'Raleway',          sample: 'Sleek & Thin' },
  { label: 'Cinzel',           value: 'Cinzel',           sample: 'Classic Roman' },
  { label: 'Nunito',           value: 'Nunito',           sample: 'Friendly Round' },
]

const TIER_LABELS = { classic: 'Free', premium: 'Premium', elite: 'Elite' }
const TIER_COLORS = { classic: null, premium: '#f4c28a', elite: '#c9a3ff' }

function QuickCreate() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const cardType = params.get('type') || 'personal'
  const cardTier = params.get('tier') || 'classic'

  const { handleCreateCard, currentUser, openAuthModal } = useOutletContext()

  const allowedTiers = cardTier === 'elite'
    ? ['classic', 'premium', 'elite']
    : cardTier === 'premium'
      ? ['classic', 'premium']
      : ['classic']
  const availablePalettes = getPalettesForTier(allowedTiers)

  const [selectedPalette, setSelectedPalette] = useState(availablePalettes[0] || PALETTES[0])
  const [selectedFont, setSelectedFont] = useState('Poppins')
  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState('')
  const [imageUrl, setImageUrl] = useState(null)
  const [imageBlobUrl, setImageBlobUrl] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)

  if (!currentUser) {
    return (
      <div className="qc-gate">
        <div className="qc-gate-inner">
          <span className="qc-gate-icon">✦</span>
          <h2>Sign in to create a card</h2>
          <p>Your creations are saved to your profile and ready to share.</p>
          <button className="qc-gate-btn" type="button" onClick={openAuthModal}>Sign In</button>
        </div>
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

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    handleImageFile(e.dataTransfer.files?.[0])
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
      content: { ...baseCard.content, heading: heading.trim(), body: body.trim() },
      media: {
        ...(baseCard.media || {}),
        images: imageUrl
          ? [{ url: imageUrl, fit: 'cover', positionX: 50, positionY: 50, height: 180 }]
          : [],
      },
    }

    const result = await handleCreateCard(cardObject, { type: cardType, tier: cardTier })
    setIsSending(false)

    if (!result.ok) { setError(result.message || 'Something went wrong.'); return }

    const rawData = result.data
    const slug = rawData?.card?.slug || rawData?.slug || rawData?.data?.card?.slug || rawData?.data?.slug || null
    setSuccess({ slug })
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
          <button type="button" className="qc-back" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Home
          </button>
        </div>
        <div className="qc-success">
          <div className="qc-success-burst">
            <div className="qc-success-ring" />
            <span className="qc-success-icon">🎉</span>
          </div>
          <h2>Your card is ready!</h2>
          <p>Share the link below with your recipient.</p>
          {cardLink ? (
            <div className="qc-success-link">
              <span>{cardLink}</span>
              <button type="button" className="qc-success-copy" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          ) : (
            <p className="qc-success-fallback">Find your card in your Profile.</p>
          )}
          <div className="qc-success-actions">
            <button type="button" className="qc-success-profile-btn" onClick={() => navigate('/profile')}>Go to Profile</button>
            <button type="button" className="qc-success-new-btn" onClick={() => navigate('/create')}>Create Another</button>
          </div>
        </div>
      </div>
    )
  }

  const tierColor = TIER_COLORS[cardTier] || 'rgba(126,239,255,0.8)'

  return (
    <div className="qc-shell">
      {/* Topbar */}
      <div className="qc-topbar">
        <button type="button" className="qc-back" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <div className="qc-topbar-center">
          <span className="qc-topbar-title">Quick Create</span>
          <div className="qc-topbar-badges">
            <span className="qc-badge-type">{cardType.charAt(0).toUpperCase() + cardType.slice(1)}</span>
            <span className="qc-badge-tier" style={{ color: tierColor, borderColor: `${tierColor}55` }}>
              {cardTier.charAt(0).toUpperCase() + cardTier.slice(1)}
            </span>
          </div>
        </div>
        <Link to={`/studio?type=${cardType}&tier=${cardTier}`} className="qc-studio-link-btn">
          <span className="qc-studio-text">Full Studio</span>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </div>

      <div className="qc-body">
        <div className="qc-split">

          {/* ── Form pane ── */}
          <div className="qc-form-pane">

            {/* Step 1: Theme */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">1</span>
                <div>
                  <h3 className="qc-step-title">Choose a Theme</h3>
                  <p className="qc-step-sub">{availablePalettes.length} themes available for {cardTier}</p>
                </div>
              </div>
              <div className="qc-palette-grid">
                {availablePalettes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`qc-palette-swatch${selectedPalette.id === p.id ? ' active' : ''}`}
                    onClick={() => setSelectedPalette(p)}
                    title={p.label}
                  >
                    <div
                      className="qc-swatch-bg"
                      style={{ background: `linear-gradient(145deg, ${p.surface} 30%, ${p.primary}55 100%)` }}
                    />
                    <div className="qc-swatch-dots">
                      <span style={{ background: p.primary }} />
                      <span style={{ background: p.accent }} />
                      <span style={{ background: p.ink, opacity: 0.7 }} />
                    </div>
                    {p.tier !== 'classic' && (
                      <span className="qc-swatch-tier" style={{ color: TIER_COLORS[p.tier] }}>
                        {TIER_LABELS[p.tier]}
                      </span>
                    )}
                    <span className="qc-swatch-name">{p.label}</span>
                    {selectedPalette.id === p.id && <span className="qc-swatch-check">✓</span>}
                  </button>
                ))}
              </div>
            </section>

            {/* Step 2: Font */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">2</span>
                <div>
                  <h3 className="qc-step-title">Font Style</h3>
                  <p className="qc-step-sub">How your words will look</p>
                </div>
              </div>
              <div className="qc-font-strip">
                {QUICK_FONTS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={`qc-font-chip${selectedFont === f.value ? ' active' : ''}`}
                    onClick={() => setSelectedFont(f.value)}
                  >
                    <span className="qc-font-chip-sample" style={{ fontFamily: `'${f.value}', serif` }}>Aa</span>
                    <span className="qc-font-chip-label">{f.label}</span>
                    <span className="qc-font-chip-sub">{f.sample}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Step 3: Content */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">3</span>
                <div>
                  <h3 className="qc-step-title">Your Message</h3>
                  <p className="qc-step-sub">What do you want to say?</p>
                </div>
              </div>
              <div className="qc-fields">
                <div className="qc-field">
                  <div className="qc-field-header">
                    <label>Heading</label>
                    <span className="qc-char-count">{heading.length}/200</span>
                  </div>
                  <input
                    type="text"
                    placeholder="A short, memorable heading…"
                    value={heading}
                    onChange={e => setHeading(e.target.value)}
                    maxLength={200}
                    style={{ fontFamily: `'${selectedFont}', serif` }}
                  />
                </div>
                <div className="qc-field">
                  <div className="qc-field-header">
                    <label>Message</label>
                    <span className="qc-char-count">{body.length}/4000</span>
                  </div>
                  <textarea
                    rows={5}
                    placeholder="Write what you want to say…"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    maxLength={4000}
                  />
                </div>
              </div>
            </section>

            {/* Step 4: Photo */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">4</span>
                <div>
                  <h3 className="qc-step-title">Photo <span className="qc-optional">optional</span></h3>
                  <p className="qc-step-sub">Add a personal touch</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleImageFile(e.target.files?.[0])}
              />
              {imageBlobUrl ? (
                <div className="qc-img-preview">
                  <img src={imageBlobUrl} alt="preview" className="qc-img-preview-img" />
                  <div className="qc-img-preview-actions">
                    <button type="button" className="qc-img-change" onClick={() => fileInputRef.current?.click()}>Change</button>
                    <button type="button" className="qc-img-remove" onClick={() => { setImageBlobUrl(null); setImageUrl(null) }}>Remove</button>
                  </div>
                </div>
              ) : (
                <div
                  className={`qc-dropzone${isDragOver ? ' drag-over' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="qc-dropzone-icon">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <path d="M14 4v14m-6-6 6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 22h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="qc-dropzone-text">Drop a photo here or <span>browse</span></p>
                  <p className="qc-dropzone-hint">PNG, JPG, WEBP</p>
                </div>
              )}
            </section>

            {/* Step 5: Recipient */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">5</span>
                <div>
                  <h3 className="qc-step-title">Recipient Email <span className="qc-optional">optional</span></h3>
                  <p className="qc-step-sub">Notify them when the card is ready</p>
                </div>
              </div>
              <div className="qc-field">
                <input
                  type="email"
                  placeholder="friend@example.com"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                />
              </div>
            </section>

            {/* Submit */}
            <div className="qc-submit-area">
              {error && <p className="qc-error">{error}</p>}
              <button
                type="button"
                className="qc-submit-btn"
                disabled={isSending}
                onClick={handleSend}
              >
                {isSending ? (
                  <span className="qc-submit-loading">
                    <span className="qc-spinner" />
                    Creating…
                  </span>
                ) : 'Create Card →'}
              </button>
              <p className="qc-studio-hint">
                Want layers, music & full control?{' '}
                <Link to={`/studio?type=${cardType}&tier=${cardTier}`}>Open Full Studio →</Link>
              </p>
            </div>
          </div>

          {/* ── Preview pane ── */}
          <div className="qc-preview-pane">
            <div className="qc-preview-wrap">
              <p className="qc-preview-label">Live Preview</p>
              <div
                className="qc-card-mini"
                style={{
                  backgroundColor: selectedPalette.surface,
                  borderColor: `${selectedPalette.primary}30`,
                  boxShadow: `0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px ${selectedPalette.primary}18`,
                }}
              >
                <div className="qc-mini-header">
                  <span className="qc-mini-seal" style={{ background: selectedPalette.primary }} />
                  <span className="qc-mini-brand" style={{ color: selectedPalette.ink }}>Cardora</span>
                </div>
                {imageBlobUrl && (
                  <div className="qc-mini-img-wrap">
                    <img src={imageBlobUrl} alt="" className="qc-mini-img" />
                  </div>
                )}
                <h3
                  className="qc-mini-heading"
                  style={{ fontFamily: `'${selectedFont}', serif`, color: selectedPalette.primary }}
                >
                  {heading || 'Your heading here'}
                </h3>
                <p
                  className="qc-mini-body"
                  style={{ fontFamily: `'${selectedFont}', sans-serif`, color: selectedPalette.ink }}
                >
                  {body || 'Your message will appear here…'}
                </p>
                <div className="qc-mini-footer" style={{ borderTopColor: `${selectedPalette.primary}22` }}>
                  <span
                    className="qc-mini-btn"
                    style={{ background: selectedPalette.primary, color: selectedPalette.surface }}
                  >
                    Open Card
                  </span>
                </div>
              </div>
              <p className="qc-preview-note">
                Simplified preview — the delivered card includes the full envelope reveal and effects.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickCreate
