import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { PALETTES, applyPalette, getPalettesForTier } from '../lib/palettes.js'
import { defaultCardObject } from '../data/cardDefaults.js'

const QUICK_FONTS = [
  { label: 'Poppins',          value: 'Poppins',          sample: 'Modern & Clean',   tier: 'classic' },
  { label: 'Lora',             value: 'Lora',             sample: 'Literary Charm',   tier: 'classic' },
  { label: 'Nunito',           value: 'Nunito',           sample: 'Friendly Round',   tier: 'classic' },
  { label: 'Playfair Display', value: 'Playfair Display', sample: 'Elegant Serif',    tier: 'premium' },
  { label: 'Montserrat',       value: 'Montserrat',       sample: 'Bold Geometric',   tier: 'premium' },
  { label: 'Dancing Script',   value: 'Dancing Script',   sample: 'Handwritten',      tier: 'elite' },
  { label: 'Raleway',          value: 'Raleway',          sample: 'Sleek & Thin',     tier: 'elite' },
  { label: 'Cinzel',           value: 'Cinzel',           sample: 'Classic Roman',    tier: 'elite' },
]

const TIER_RANK   = { classic: 0, premium: 1, elite: 2 }
const TIER_LABELS = { classic: 'Free', premium: 'Premium', elite: 'Elite' }
const TIER_COLORS = { classic: null, premium: '#f4c28a', elite: '#c9a3ff' }

const TIER_COST_BY_TYPE = {
  personal:  { classic: 0, premium: 25, elite: 35 },
  poll:      { classic: 0, premium: null, elite: 35 },
  trivia:    { classic: 0, premium: null, elite: 50 },
  chain:     { classic: 0, premium: null, elite: 40 },
  anonymous: { classic: 0, premium: null, elite: 45 },
}

// Premium is personal-only — fall back to elite for non-personal types
// so a stray `?tier=premium` doesn't read cost as 0 and confuse the user.
function resolveTier(type, tier) {
  if (type !== 'personal' && tier === 'premium') return 'elite'
  return tier
}

const TYPE_LABEL = {
  personal:  'Personal Card',
  poll:      'Poll Card',
  trivia:    'Trivia Card',
  chain:     'Chain Card',
  anonymous: 'Anonymous Card',
}

const STEP3_CONFIG = {
  personal:  { title: 'Your Message',     sub: 'What do you want to say?' },
  poll:      { title: 'Your Poll',         sub: 'Ask your audience a question' },
  chain:     { title: 'Challenge',         sub: 'What do you challenge them to do?' },
  trivia:    { title: 'Your Quiz',         sub: 'Create a question for your recipients' },
  anonymous: { title: 'Your Message',     sub: 'Recipients can reply anonymously' },
}

const SHARE_PLATFORMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    getUrl: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#2AABEE',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    getUrl: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    color: '#1DA1F2',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    getUrl: (url, title) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
]

const MAX_IMAGES = 3
const PALETTE_INITIAL_COUNT = 5

function QuickCreate() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const cardType = params.get('type') || 'personal'
  const cardTierRaw = (params.get('tier') || 'classic').toLowerCase()
  const cardTier = resolveTier(cardType, cardTierRaw)

  const { createCardOnBackend, currentUser, openAuthModal, balance } = useOutletContext()

  const tierRank = TIER_RANK[cardTier] ?? 0
  const tierCost = (TIER_COST_BY_TYPE[cardType] || TIER_COST_BY_TYPE.personal)[cardTier] ?? 0
  const allowedPaletteIds = new Set(getPalettesForTier(cardTier).map(p => p.id))
  const allowedFontValues = new Set(
    QUICK_FONTS.filter(f => (TIER_RANK[f.tier] ?? 0) <= tierRank).map(f => f.value)
  )

  const [selectedPalette, setSelectedPalette] = useState(
    getPalettesForTier(cardTier)[0] || PALETTES[0]
  )
  const [selectedFont, setSelectedFont] = useState('Poppins')
  const [showAllPalettes, setShowAllPalettes] = useState(false)

  // Personal
  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')

  // Poll
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

  // Chain
  const [chainChallenge, setChainChallenge] = useState('')

  // Trivia
  const [triviaQuestion, setTriviaQuestion] = useState('')
  const [triviaOptions, setTriviaOptions] = useState(['', '', '', ''])
  const [triviaCorrect, setTriviaCorrect] = useState(0)

  // Anonymous
  const [anonMessage, setAnonMessage] = useState('')

  const [images, setImages] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)

  // Send modal state — mirrors CardStudio
  const [showSendModal, setShowSendModal] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState(null) // null | { ok, slug, message }
  const [sendCopied, setSendCopied] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [error, setError] = useState(null)

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

  const addImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (images.length >= MAX_IMAGES) return
    const blobUrl = URL.createObjectURL(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImages(prev => prev.length < MAX_IMAGES ? [...prev, { blobUrl, dataUrl: e.target.result }] : prev)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    files.forEach(addImageFile)
  }

  const addPollOption = () => {
    if (pollOptions.length < 6) setPollOptions(p => [...p, ''])
  }
  const removePollOption = (i) => {
    if (pollOptions.length > 2) setPollOptions(p => p.filter((_, idx) => idx !== i))
  }
  const updatePollOption = (i, val) => {
    setPollOptions(p => { const n = [...p]; n[i] = val; return n })
  }
  const updateTriviaOption = (i, val) => {
    setTriviaOptions(p => { const n = [...p]; n[i] = val; return n })
  }

  // Build the cardObject from current QC state — used for both sending and "Open in Studio"
  const buildCardObject = () => {
    const baseCard = applyPalette({ ...defaultCardObject }, selectedPalette)
    return {
      ...baseCard,
      theme: { ...baseCard.theme, fontFamily: selectedFont },
      content: cardType === 'personal'
        ? { ...baseCard.content, heading: heading.trim(), body: body.trim() }
        : cardType === 'anonymous'
          ? { ...baseCard.content, heading: '', body: anonMessage.trim() }
          : baseCard.content,
      media: {
        ...(baseCard.media || {}),
        images: images.map(img => ({
          url: img.dataUrl,
          fit: 'cover',
          positionX: 50,
          positionY: 50,
          height: 180,
        })),
      },
    }
  }

  const validate = () => {
    if (cardType === 'personal') {
      if (!heading.trim()) return 'Please add a heading.'
      if (!body.trim()) return 'Please add a message.'
    } else if (cardType === 'poll') {
      if (!pollQuestion.trim()) return 'Please add a poll question.'
      if (pollOptions.filter(o => o.trim()).length < 2) return 'Please add at least 2 options.'
    } else if (cardType === 'chain') {
      if (!chainChallenge.trim()) return 'Please add a challenge prompt.'
    } else if (cardType === 'trivia') {
      if (!triviaQuestion.trim()) return 'Please add a trivia question.'
      if (triviaOptions.filter(o => o.trim()).length < 2) return 'Add at least 2 answer options.'
    } else if (cardType === 'anonymous') {
      if (!anonMessage.trim()) return 'Please add a message.'
    }
    return null
  }

  // Called when user clicks "Create Card →"
  const handleSendClick = () => {
    setError(null)
    const err = validate()
    if (err) { setError(err); return }
    setSendResult(null)
    setShowSendModal(true)
    // If free tier, fire immediately
    if (tierCost === 0) {
      handleSend()
    }
    // If paid tier, modal shows CC confirmation first; user clicks "Confirm & Send"
  }

  const handleSend = async () => {
    setIsSending(true)
    try {
      const cardObject = buildCardObject()
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

      const result = await createCardOnBackend(cardObject, {
        type: cardType,
        tier: cardTier,
        poll: pollData,
        chain: chainData,
        trivia: triviaData,
      })

      if (!result.ok) {
        setSendResult({ ok: false, message: result.message || 'Something went wrong.' })
        return
      }

      const d = result.data
      const slug =
        d?.card?.slug || d?.card?.shareSlug || d?.card?.cardId ||
        d?.slug || d?.shareSlug || d?.cardId ||
        d?.data?.card?.slug || d?.data?.slug || null

      setSendResult({ ok: true, slug, message: result.message })
    } catch (err) {
      setSendResult({ ok: false, message: 'Something went wrong. Please try again.' })
    } finally {
      setIsSending(false)
    }
  }

  const closeSendModal = () => {
    if (isSending) return
    setShowSendModal(false)
    setSendResult(null)
  }

  const openInStudio = () => {
    const cardObject = buildCardObject()
    navigate(`/studio?type=${cardType}&tier=${cardTier}`, {
      state: { draftCardObject: cardObject },
    })
  }

  const cardLink = sendResult?.slug ? `${window.location.origin}/card/${sendResult.slug}` : null
  const tierColor = TIER_COLORS[cardTier] || 'rgba(126,239,255,0.8)'
  const s3 = STEP3_CONFIG[cardType] || STEP3_CONFIG.personal
  const bal = balance ?? 0

  const previewHeading = cardType === 'poll' ? pollQuestion
    : cardType === 'chain' ? chainChallenge
    : cardType === 'trivia' ? triviaQuestion
    : cardType === 'anonymous' ? anonMessage
    : heading
  const previewBody = cardType === 'personal' ? body
    : cardType === 'poll' ? pollOptions.filter(o => o.trim()).join(' · ')
    : ''

  const visiblePalettes = showAllPalettes ? PALETTES : PALETTES.slice(0, PALETTE_INITIAL_COUNT)
  const hiddenCount = PALETTES.length - PALETTE_INITIAL_COUNT

  const isLowBalance = tierCost > 0 && bal < tierCost

  return (
    <div className="qc-shell">
      {/* Topbar */}
      <div className="qc-topbar">
        <button type="button" className="qc-back" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <div className="qc-topbar-center">
          <span className="qc-topbar-title">Quick Create</span>
          <div className="qc-topbar-badges">
            <span className="qc-badge-type">{TYPE_LABEL[cardType] || cardType}</span>
            <span className="qc-badge-tier" style={{ color: tierColor, borderColor: `${tierColor}55` }}>
              {cardTier.charAt(0).toUpperCase() + cardTier.slice(1)}
            </span>
          </div>
        </div>

        <div className="qc-topbar-right">
          {/* CC balance chip */}
          <div className={`qc-cc-pill${isLowBalance ? ' short' : ''}`} title={`Your balance: ${bal} CC`}>
            <span className="qc-cc-icon">◈</span>
            <span className="qc-cc-balance">{bal} CC</span>
            <span className="qc-cc-cost">· {tierCost === 0 ? 'Free to send' : `${tierCost} CC to send`}</span>
          </div>
          <button type="button" className="qc-studio-link-btn" onClick={openInStudio}>
            <span className="qc-studio-text">Full Studio</span>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="qc-body">
        <div className="qc-split">

          {/* ── Form pane ── */}
          <div className="qc-form-pane">

            {/* Mobile-only live preview */}
            <div className="qc-mobile-preview">
              <p className="qc-preview-label">Live Preview</p>
              <CardMiniPreview
                palette={selectedPalette}
                font={selectedFont}
                heading={previewHeading}
                body={previewBody}
                image={images[0]?.blobUrl}
              />
            </div>

            {/* Step 1: Theme */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">1</span>
                <div>
                  <h3 className="qc-step-title">Choose a Theme</h3>
                  <p className="qc-step-sub">
                    {getPalettesForTier(cardTier).length} unlocked
                    {PALETTES.length - getPalettesForTier(cardTier).length > 0
                      ? ` · ${PALETTES.length - getPalettesForTier(cardTier).length} locked`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="qc-palette-grid">
                {visiblePalettes.map((p) => {
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
              {!showAllPalettes && hiddenCount > 0 && (
                <button type="button" className="qc-show-more-btn" onClick={() => setShowAllPalettes(true)}>
                  Show {hiddenCount} more themes ↓
                </button>
              )}
              {showAllPalettes && (
                <button type="button" className="qc-show-more-btn" onClick={() => setShowAllPalettes(false)}>
                  Show less ↑
                </button>
              )}
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
                {QUICK_FONTS.map((f) => {
                  const locked = !allowedFontValues.has(f.value)
                  return (
                    <button
                      key={f.value}
                      type="button"
                      className={`qc-font-chip${selectedFont === f.value && !locked ? ' active' : ''}${locked ? ' locked' : ''}`}
                      onClick={() => locked ? navigate('/store') : setSelectedFont(f.value)}
                      title={locked ? `Unlock with ${TIER_LABELS[f.tier]} tier` : f.label}
                    >
                      {locked && <span className="qc-font-lock">🔒</span>}
                      <span className="qc-font-chip-sample" style={{ fontFamily: `'${f.value}', serif` }}>Aa</span>
                      <span className="qc-font-chip-label">{f.label}</span>
                      <span className="qc-font-chip-sub">{f.sample}</span>
                      {locked && (
                        <span className="qc-font-tier-badge" style={{ color: TIER_COLORS[f.tier] }}>
                          {TIER_LABELS[f.tier]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Step 3: Content */}
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
                      Answers <span className="qc-optional">tap the radio to mark the correct answer</span>
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

            {/* Step 4: Photos */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">4</span>
                <div>
                  <h3 className="qc-step-title">
                    Photos <span className="qc-optional">optional · up to {MAX_IMAGES}</span>
                  </h3>
                  <p className="qc-step-sub">Add a personal touch</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) addImageFile(e.target.files[0]); e.target.value = '' }}
              />
              {images.length > 0 ? (
                <div className="qc-img-grid">
                  {images.map((img, i) => (
                    <div key={i} className="qc-img-grid-item">
                      <img src={img.blobUrl} alt="" className="qc-img-grid-thumb" />
                      <button
                        type="button"
                        className="qc-img-grid-remove"
                        onClick={() => removeImage(i)}
                        title="Remove photo"
                      >✕</button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      className="qc-img-grid-add"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      <span>Add</span>
                    </button>
                  )}
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
                  <p className="qc-dropzone-text">Drop photos here or <span>browse</span></p>
                  <p className="qc-dropzone-hint">PNG, JPG, WEBP · up to {MAX_IMAGES} photos</p>
                </div>
              )}
            </section>

            {/* Submit */}
            <div className="qc-submit-area">
              {error && <p className="qc-error">{error}</p>}
              {isLowBalance && (
                <p className="qc-error">
                  You need {tierCost} CC to send this card. Your balance: {bal} CC.{' '}
                  <Link to="/store">Top up →</Link>
                </p>
              )}
              <button
                type="button"
                className="qc-submit-btn"
                disabled={isSending || isLowBalance}
                onClick={handleSendClick}
              >
                {tierCost > 0 ? `Create Card (${tierCost} CC) →` : 'Create Card →'}
              </button>
              <p className="qc-studio-hint">
                Want layers, music & full control?{' '}
                <button type="button" className="qc-studio-hint-link" onClick={openInStudio}>
                  Open Full Studio →
                </button>
              </p>
            </div>
          </div>

          {/* ── Preview pane (desktop only) ── */}
          <div className="qc-preview-pane">
            <div className="qc-preview-wrap">
              <p className="qc-preview-label">Live Preview</p>
              <CardMiniPreview
                palette={selectedPalette}
                font={selectedFont}
                heading={previewHeading}
                body={previewBody}
                image={images[0]?.blobUrl}
                large
              />
              <p className="qc-preview-note">
                Simplified preview — the delivered card includes the full envelope reveal and effects.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Send Modal (portal) ── mirrors CardStudio cs-send-modal ── */}
      {showSendModal && createPortal(
        <div className="cs-send-modal-overlay" onClick={closeSendModal}>
          <div className="cs-send-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-send-modal-header">
              <div className="cs-send-modal-header-left">
                <span className="cs-send-modal-eyebrow">{TYPE_LABEL[cardType] || 'Card'} · {cardTier.charAt(0).toUpperCase() + cardTier.slice(1)}</span>
                <h3>
                  {sendResult?.ok ? 'Your card is ready to share!'
                    : isSending ? 'Creating your card…'
                    : 'Confirm & Create'}
                </h3>
              </div>
              <button
                type="button"
                className="cs-send-modal-close"
                aria-label="Close"
                disabled={isSending}
                onClick={closeSendModal}
              >×</button>
            </div>

            {/* CC confirmation (paid tier, before send) */}
            {!isSending && !sendResult && tierCost > 0 && (
              <div className="cs-send-confirm">
                <div className="cs-send-confirm-icon">💎</div>
                <p className="cs-send-confirm-text">
                  Sending this <strong>{TIER_LABELS[cardTier]}</strong> card will cost
                </p>
                <div className="cs-send-confirm-cost">
                  <span className="cs-send-confirm-amount">{tierCost} CC</span>
                </div>
                <p className="cs-send-confirm-balance">
                  Your balance: <strong>{bal} CC</strong>
                  {bal < tierCost && (
                    <span className="cs-send-confirm-short"> — You need {tierCost - bal} more CC</span>
                  )}
                </p>
                <div className="cs-send-confirm-actions">
                  <button type="button" className="cs-send-confirm-cancel" onClick={closeSendModal}>Cancel</button>
                  <button
                    type="button"
                    className="cs-send-confirm-btn"
                    disabled={bal < tierCost}
                    onClick={handleSend}
                  >
                    Confirm & Create
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {isSending && (
              <div className="cs-send-loading">
                <div className="chat-loading-spinner" />
                <p>Creating your card…</p>
              </div>
            )}

            {/* CC deducted / free notice */}
            {!isSending && sendResult?.ok && tierCost > 0 && (
              <div className="cs-send-modal-cc-deducted">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span><strong>{tierCost} CC</strong> deducted from your balance</span>
              </div>
            )}
            {!isSending && sendResult?.ok && tierCost === 0 && (
              <div className="cs-send-modal-cc-deducted free">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span>Created free — Classic tier</span>
              </div>
            )}

            {/* Error */}
            {!isSending && sendResult && !sendResult.ok && (
              <p className="cs-send-modal-note" style={{ color: '#ffb4b4' }}>
                {sendResult.message || 'Something went wrong. Please try again.'}
              </p>
            )}

            {/* Success: slug + sharing */}
            {!isSending && sendResult?.ok && (
              <div className="cs-send-link-wrap">
                <p className="cs-send-link-label">Your unique card link</p>
                {cardLink ? (
                  <>
                    <span className="detail-share-link-pill cs-send-link-pill">
                      {cardLink.replace(/^https?:\/\//, '')}
                    </span>
                    <button
                      type="button"
                      className={`detail-share-copy-btn${sendCopied ? ' copied' : ''}`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(cardLink)
                          setSendCopied(true)
                          setTimeout(() => setSendCopied(false), 1600)
                        } catch { /* ignore */ }
                      }}
                    >
                      {sendCopied ? '✓ Copied' : 'Copy Link'}
                    </button>
                  </>
                ) : (
                  <p className="cs-send-modal-note" style={{ color: '#ffb4b4' }}>
                    Card created — link not returned yet. Visit your{' '}
                    <Link to="/profile" onClick={closeSendModal}>Profile</Link> to find it.
                  </p>
                )}
              </div>
            )}

            {/* Social sharing */}
            {!isSending && sendResult?.ok && cardLink && (
              <>
                <p className="detail-share-label">Share via</p>
                <div className="detail-share-platforms cs-send-modal-platforms">
                  {SHARE_PLATFORMS.map((p) => (
                    <a
                      key={p.id}
                      href={p.getUrl(cardLink, 'Check out this card I made on Cardora')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="detail-share-platform-btn"
                      style={{ '--platform-color': p.color }}
                    >
                      {p.icon}
                      <span>{p.label}</span>
                    </a>
                  ))}
                  {navigator.share && (
                    <button
                      type="button"
                      className="detail-share-platform-btn"
                      style={{ '--platform-color': 'rgba(118,239,255,0.7)' }}
                      onClick={async () => {
                        try {
                          await navigator.share({ title: 'Cardora Card', text: 'Check out this card I made on Cardora', url: cardLink })
                        } catch { /* cancelled */ }
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      <span>More</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Email row */}
            {!isSending && sendResult?.ok && (
              <div className="cs-send-modal-email-row">
                <p className="cs-send-link-label">Send via Email</p>
                <div className="cs-send-modal-email-input-wrap">
                  <input
                    type="email"
                    className="cs-send-modal-email-input"
                    placeholder="recipient@email.com"
                    value={sendEmail}
                    onChange={e => setSendEmail(e.target.value)}
                  />
                  <a
                    className="cs-nav-btn accent"
                    href={`mailto:${encodeURIComponent(sendEmail)}?subject=${encodeURIComponent("You've got a Cardora card!")}&body=${encodeURIComponent(`Check out this card I made for you on Cardora:\n\n${cardLink || ''}`)}`}
                    style={{ textDecoration: 'none', textAlign: 'center' }}
                  >
                    Send
                  </a>
                </div>
              </div>
            )}

            {/* Bottom actions after success */}
            {!isSending && sendResult?.ok && (
              <div className="cs-send-confirm-actions" style={{ marginTop: 4 }}>
                <button type="button" className="cs-send-confirm-cancel" onClick={() => navigate('/profile')}>
                  Go to Profile
                </button>
                <button type="button" className="cs-send-confirm-btn" onClick={() => navigate('/create')}>
                  Create Another
                </button>
              </div>
            )}

            {/* Retry after error */}
            {!isSending && sendResult && !sendResult.ok && (
              <div className="cs-send-confirm-actions" style={{ marginTop: 4 }}>
                <button type="button" className="cs-send-confirm-cancel" onClick={closeSendModal}>Close</button>
                <button type="button" className="cs-send-confirm-btn" onClick={handleSend}>Try Again</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Extracted mini-card preview — used in both mobile and desktop panes
function CardMiniPreview({ palette, font, heading, body, image, large = false }) {
  return (
    <div
      className={`qc-card-mini${large ? ' large' : ''}`}
      style={{
        backgroundColor: palette.surface,
        borderColor: `${palette.primary}30`,
        boxShadow: `0 ${large ? 24 : 16}px ${large ? 64 : 48}px rgba(0,0,0,0.4), 0 0 0 1px ${palette.primary}18`,
      }}
    >
      <div className="qc-mini-header">
        <span className="qc-mini-seal" style={{ background: palette.primary }} />
        <span className="qc-mini-brand" style={{ color: palette.ink }}>Cardora</span>
      </div>
      {image && (
        <div className="qc-mini-img-wrap">
          <img src={image} alt="" className="qc-mini-img" />
        </div>
      )}
      <h3
        className="qc-mini-heading"
        style={{ fontFamily: `'${font}', serif`, color: palette.primary }}
      >
        {heading || 'Your heading here'}
      </h3>
      <p
        className="qc-mini-body"
        style={{ fontFamily: `'${font}', sans-serif`, color: palette.ink }}
      >
        {body || 'Your message will appear here…'}
      </p>
      <div className="qc-mini-footer" style={{ borderTopColor: `${palette.primary}22` }}>
        <span className="qc-mini-btn" style={{ background: palette.primary, color: palette.surface }}>
          Open Card
        </span>
      </div>
    </div>
  )
}

export default QuickCreate
