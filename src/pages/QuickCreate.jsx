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

const STEP3_CONFIG = {
  personal:  { title: 'Your Message',     sub: 'What do you want to say?' },
  poll:      { title: 'Your Poll',         sub: 'Ask your audience a question' },
  chain:     { title: 'Challenge',         sub: 'What do you challenge them to do?' },
  trivia:    { title: 'Your Quiz',         sub: 'Create a question for your recipients' },
  anonymous: { title: 'Your Message',     sub: 'Recipients can reply anonymously' },
}

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

  const allowedPaletteIds = new Set(getPalettesForTier(allowedTiers).map(p => p.id))

  const [selectedPalette, setSelectedPalette] = useState(
    getPalettesForTier(allowedTiers)[0] || PALETTES[0]
  )
  const [selectedFont, setSelectedFont] = useState('Poppins')

  // Personal
  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')

  // Poll
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

  // Chain
  const [chainChallenge, setChainChallenge] = useState('')

  // Trivia (single question for Quick Create)
  const [triviaQuestion, setTriviaQuestion] = useState('')
  const [triviaOptions, setTriviaOptions] = useState(['', '', '', ''])
  const [triviaCorrect, setTriviaCorrect] = useState(0)

  // Anonymous
  const [anonMessage, setAnonMessage] = useState('')

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

  const addPollOption = () => {
    if (pollOptions.length < 6) setPollOptions([...pollOptions, ''])
  }
  const removePollOption = (i) => {
    if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, idx) => idx !== i))
  }
  const updatePollOption = (i, val) => {
    const next = [...pollOptions]; next[i] = val; setPollOptions(next)
  }
  const updateTriviaOption = (i, val) => {
    const next = [...triviaOptions]; next[i] = val; setTriviaOptions(next)
  }

  const handleSend = async () => {
    setError(null)
    // Validate per type
    if (cardType === 'personal') {
      if (!heading.trim()) { setError('Please add a heading.'); return }
      if (!body.trim()) { setError('Please add a message.'); return }
    } else if (cardType === 'poll') {
      if (!pollQuestion.trim()) { setError('Please add a poll question.'); return }
      if (pollOptions.filter(o => o.trim()).length < 2) { setError('Please add at least 2 options.'); return }
    } else if (cardType === 'chain') {
      if (!chainChallenge.trim()) { setError('Please add a challenge prompt.'); return }
    } else if (cardType === 'trivia') {
      if (!triviaQuestion.trim()) { setError('Please add a trivia question.'); return }
      if (triviaOptions.filter(o => o.trim()).length < 2) { setError('Add at least 2 answer options.'); return }
    } else if (cardType === 'anonymous') {
      if (!anonMessage.trim()) { setError('Please add a message.'); return }
    }

    setIsSending(true)
    try {
      const baseCard = applyPalette({ ...defaultCardObject }, selectedPalette)
      const cardObject = {
        ...baseCard,
        theme: { ...baseCard.theme, fontFamily: selectedFont },
        content: cardType === 'personal'
          ? { ...baseCard.content, heading: heading.trim(), body: body.trim() }
          : cardType === 'anonymous'
            ? { ...baseCard.content, heading: '', body: anonMessage.trim() }
            : baseCard.content,
        media: {
          ...(baseCard.media || {}),
          images: imageUrl
            ? [{ url: imageUrl, fit: 'cover', positionX: 50, positionY: 50, height: 180 }]
            : [],
        },
      }

      const pollData = cardType === 'poll'
        ? { question: pollQuestion.trim(), options: pollOptions.filter(o => o.trim()) }
        : undefined
      const chainData = cardType === 'chain'
        ? { prompt: chainChallenge.trim() }
        : undefined
      const triviaData = cardType === 'trivia'
        ? {
            questions: [{
              text: triviaQuestion.trim(),
              options: triviaOptions.filter(o => o.trim()),
              correctIndex: triviaCorrect,
            }],
          }
        : undefined

      const result = await handleCreateCard(cardObject, {
        type: cardType,
        tier: cardTier,
        poll: pollData,
        chain: chainData,
        trivia: triviaData,
      })

      if (!result.ok) { setError(result.message || 'Something went wrong.'); return }

      const rawData = result.data
      const slug = rawData?.card?.slug || rawData?.slug || rawData?.data?.card?.slug || rawData?.data?.slug || null
      setSuccess({ slug })
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSending(false)
    }
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
  const s3 = STEP3_CONFIG[cardType] || STEP3_CONFIG.personal

  const previewHeading = cardType === 'poll' ? pollQuestion
    : cardType === 'chain' ? chainChallenge
    : cardType === 'trivia' ? triviaQuestion
    : cardType === 'anonymous' ? anonMessage
    : heading
  const previewBody = cardType === 'personal' ? body
    : cardType === 'poll' ? pollOptions.filter(o => o.trim()).join(' · ')
    : ''

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
                  <p className="qc-step-sub">
                    {getPalettesForTier(allowedTiers).length} unlocked
                    {PALETTES.length - getPalettesForTier(allowedTiers).length > 0
                      ? ` · ${PALETTES.length - getPalettesForTier(allowedTiers).length} locked`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="qc-palette-grid">
                {PALETTES.map((p) => {
                  const locked = !allowedPaletteIds.has(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`qc-palette-swatch${selectedPalette.id === p.id && !locked ? ' active' : ''}${locked ? ' locked' : ''}`}
                      onClick={() => locked ? navigate('/store') : setSelectedPalette(p)}
                      title={locked ? `Unlock with ${TIER_LABELS[p.tier]} tier` : p.label}
                    >
                      <div
                        className="qc-swatch-bg"
                        style={{ background: `linear-gradient(145deg, ${p.surface} 30%, ${p.primary}55 100%)` }}
                      />
                      {locked && <div className="qc-swatch-lock">🔒</div>}
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
                      {selectedPalette.id === p.id && !locked && <span className="qc-swatch-check">✓</span>}
                    </button>
                  )
                })}
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

            {/* Step 3: Content — varies by card type */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">3</span>
                <div>
                  <h3 className="qc-step-title">{s3.title}</h3>
                  <p className="qc-step-sub">{s3.sub}</p>
                </div>
              </div>

              {cardType === 'personal' && (
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
              )}

              {cardType === 'poll' && (
                <div className="qc-fields">
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Question</label>
                      <span className="qc-char-count">{pollQuestion.length}/500</span>
                    </div>
                    <input
                      type="text"
                      placeholder="What do you want to ask?"
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                  <div className="qc-poll-options">
                    <label className="qc-poll-options-label">Options</label>
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="qc-poll-option-row">
                        <span className="qc-poll-option-letter">{String.fromCharCode(65 + i)}</span>
                        <input
                          type="text"
                          placeholder={`Option ${i + 1}…`}
                          value={opt}
                          onChange={e => updatePollOption(i, e.target.value)}
                          maxLength={300}
                        />
                        {pollOptions.length > 2 && (
                          <button type="button" className="qc-poll-remove" onClick={() => removePollOption(i)}>✕</button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 6 && (
                      <button type="button" className="qc-poll-add" onClick={addPollOption}>+ Add option</button>
                    )}
                  </div>
                </div>
              )}

              {cardType === 'chain' && (
                <div className="qc-fields">
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Challenge Prompt</label>
                      <span className="qc-char-count">{chainChallenge.length}/600</span>
                    </div>
                    <textarea
                      rows={4}
                      placeholder="Write a challenge for your recipient to respond to…"
                      value={chainChallenge}
                      onChange={e => setChainChallenge(e.target.value)}
                      maxLength={600}
                    />
                  </div>
                  <p className="qc-type-hint">Recipients will be invited to create and send a card back to you.</p>
                </div>
              )}

              {cardType === 'trivia' && (
                <div className="qc-fields">
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Question</label>
                      <span className="qc-char-count">{triviaQuestion.length}/500</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Ask a trivia question…"
                      value={triviaQuestion}
                      onChange={e => setTriviaQuestion(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                  <div className="qc-trivia-options">
                    <label className="qc-poll-options-label">
                      Answers <span className="qc-optional">tap ○ to mark correct</span>
                    </label>
                    {triviaOptions.map((opt, i) => (
                      <div key={i} className={`qc-trivia-option-row${triviaCorrect === i ? ' correct' : ''}`}>
                        <button
                          type="button"
                          className="qc-trivia-correct-btn"
                          onClick={() => setTriviaCorrect(i)}
                          title="Mark as correct answer"
                        >
                          {triviaCorrect === i ? '✓' : '○'}
                        </button>
                        <input
                          type="text"
                          placeholder={`Answer ${i + 1}…`}
                          value={opt}
                          onChange={e => updateTriviaOption(i, e.target.value)}
                          maxLength={300}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="qc-type-hint">Recipients see their score and correct answers at the end.</p>
                </div>
              )}

              {cardType === 'anonymous' && (
                <div className="qc-fields">
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Your Message</label>
                      <span className="qc-char-count">{anonMessage.length}/2000</span>
                    </div>
                    <textarea
                      rows={6}
                      placeholder="Recipients can reply to this card anonymously…"
                      value={anonMessage}
                      onChange={e => setAnonMessage(e.target.value)}
                      maxLength={2000}
                    />
                  </div>
                  <p className="qc-type-hint">Replies are completely anonymous — no names, no tracking.</p>
                </div>
              )}
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

          {/* ── Preview pane (desktop only) ── */}
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
                  {previewHeading || 'Your heading here'}
                </h3>
                <p
                  className="qc-mini-body"
                  style={{ fontFamily: `'${selectedFont}', sans-serif`, color: selectedPalette.ink }}
                >
                  {previewBody || 'Your message will appear here…'}
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
