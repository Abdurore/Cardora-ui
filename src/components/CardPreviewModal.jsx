import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import PremiumGiftReveal from './PremiumGiftReveal.jsx'
import Envelope from './Envelope.jsx'
import AmbientParticles from './AmbientParticles.jsx'
import { fireOpenEffect } from '../lib/studioEffects.js'
import { shouldShowEnvelope } from '../lib/tierLimits.js'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from './CardIcons.jsx'

const LEGACY_EMOJI_AMBIENTS = new Set(['floating', 'reverse'])

const ENTRY_DEFAULTS = {
  personal:  { label: 'Personal Card',   Icon: PersonalCardIcon, hint: 'Someone sent you a card',            color: '#e2b96e' },
  poll:      { label: 'Poll Card',        Icon: PollCardIcon,     hint: "You've been asked to vote",          color: '#7eb3ff' },
  trivia:    { label: 'Trivia Card',      Icon: TriviaCardIcon,   hint: "You've been challenged",             color: '#ffe066' },
  chain:     { label: 'Chain Card',       Icon: ChainCardIcon,    hint: 'A chain was started for you',        color: '#62ffa2' },
  anonymous: { label: 'Anonymous Card',   Icon: AnonCardIcon,     hint: 'Open to send an anonymous message',  color: '#c084fc' },
}

// Typewriter hook
function useTypewriter(text, speed, active) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!active || !text) { setDisplayed(active ? text : ''); return }
    setDisplayed('')
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(iv)
    }, speed * 1000 / text.length)
    return () => clearInterval(iv)
  }, [text, speed, active])
  return displayed
}

function CardPreviewModal({
  cardObject,
  onClose,
  tier = 'simple',
  allowedTools = null,
  tierLimits = null,
  recipientEmail = '',
  studioType = 'personal',
  pollData = null,
  triviaData = null,
  anonTemplate = null,
  pageMode = false,
  cardTitle = '',
  onPollSubmit = null,
  onTriviaComplete = null,
  onChainReply = null,
  onQuestionResponse = null,
  onAnonSubmit = null,
  chainState = null,
}) {
  // `allowedTools` gates tool visibility; `tierLimits` caps the content a
  // visible tool is allowed to contribute (e.g. music allowed, images > 1).
  // Both null = public viewer, render everything the card has.
  const toolAllowed = (id) => !allowedTools || allowedTools.includes(id)
  const limit = (key, fallback = true) => (tierLimits ? !!tierLimits[key] : fallback)
  const maxImages = tierLimits ? (tierLimits.maxImages ?? Infinity) : Infinity
  const envelopeEnabled = shouldShowEnvelope(studioType)
  const [stage, setStage] = useState(pageMode ? 'entry' : (envelopeEnabled ? 'closed' : 'open'))
  const [questionIdx, setQuestionIdx] = useState(0)
  const [fadeBody, setFadeBody] = useState(!envelopeEnabled)
  const [bodyVisible, setBodyVisible] = useState(!envelopeEnabled)
  const [revealStep, setRevealStep] = useState(0)
  const audioRef = useRef(null)
  const containerRef = useRef(null)
  const openCardInnerRef = useRef(null)
  const previewTimersRef = useRef([])

  // Device-frame preview. Fullscreen by default; lets the sender see how the
  // card scales on phone / tablet / desktop without leaving the modal.
  const [previewDevice, setPreviewDevice] = useState('fullscreen')

  // Card surface style. The colored layer is rendered as a `::before` pseudo
  // so adjusting opacity reveals the page background without dimming the card
  // text or images.
  const cardSurfaceStyle = (extra = {}) => ({
    backgroundColor: 'transparent',
    '--card-bg': cardObject?.card?.backgroundColor || '#111111',
    '--card-bg-opacity': String(1 - (Number(cardObject?.card?.backgroundOpacity) || 0)),
    ...extra,
  })

  // Lock & reveal gate — honours `interaction.lock` so the studio preview
  // matches what the recipient will actually experience.
  const lockSpec = cardObject?.interaction?.lock || { type: 'none', value: '' }
  const revealSpec = cardObject?.interaction?.reveal || { type: 'tap', hint: '' }
  const [unlocked, setUnlocked] = useState(
    lockSpec.type === 'none' || (lockSpec.type !== 'password' && lockSpec.type !== 'time' && lockSpec.type !== 'tap' && lockSpec.type !== 'scratch')
  )
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  // Scratch lock state
  const scratchCanvasRef = useRef(null)
  const scratchingRef = useRef(false)
  const [scratchPct, setScratchPct] = useState(0)
  // Tick once per second while the time-lock is active so the countdown updates.
  useEffect(() => {
    if (lockSpec.type !== 'time' || unlocked) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [lockSpec.type, unlocked])
  // Auto-unlock when the configured time arrives.
  const unlockAt = lockSpec.type === 'time' && lockSpec.value ? new Date(lockSpec.value).getTime() : null
  useEffect(() => {
    if (lockSpec.type === 'time' && unlockAt && now >= unlockAt) setUnlocked(true)
  }, [lockSpec.type, unlockAt, now])

  // Scratch canvas: fill with overlay color when gate mounts
  useEffect(() => {
    if (lockSpec.type !== 'scratch' || unlocked) return
    const canvas = scratchCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'
    const bg = cardObject?.card?.backgroundColor || '#0b0f14'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Decorative overlay text
    ctx.font = 'bold 15px system-ui'
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.textAlign = 'center'
    const rows = ['SCRATCH', 'TO', 'REVEAL']
    rows.forEach((t, i) => ctx.fillText(t, canvas.width / 2, canvas.height / 2 - 18 + i * 22))
    setScratchPct(0)
  }, [lockSpec.type, unlocked, cardObject?.card?.backgroundColor])

  const handleScratch = useCallback((e) => {
    if (!scratchingRef.current || unlocked) return
    const canvas = scratchCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = (clientX - rect.left) * (canvas.width / rect.width)
    const y = (clientY - rect.top) * (canvas.height / rect.height)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 32, 0, Math.PI * 2)
    ctx.fill()
    // Sample every 8th pixel for performance
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let cleared = 0
    for (let i = 3; i < data.length; i += 32) {
      if (data[i] < 128) cleared++
    }
    const total = (canvas.width * canvas.height) / 8
    const pct = Math.round((cleared / total) * 100)
    setScratchPct(pct)
    if (pct >= 55) setUnlocked(true)
  }, [unlocked])

  const handlePasswordSubmit = (e) => {
    e?.preventDefault?.()
    if (!lockSpec.value) {
      setUnlocked(true)
      return
    }
    if (pwInput.trim() === String(lockSpec.value).trim()) {
      setUnlocked(true)
      setPwError('')
    } else {
      setPwError('That doesn\'t match. Try again.')
    }
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Unlocking…'
    const total = Math.floor(ms / 1000)
    const days = Math.floor(total / 86400)
    const hours = Math.floor((total % 86400) / 3600)
    const mins = Math.floor((total % 3600) / 60)
    const secs = total % 60
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  // Poll preview state
  const [previewPollVotes, setPreviewPollVotes] = useState([])
  const [previewPollSubmitted, setPreviewPollSubmitted] = useState(false)

  // Trivia preview state
  const [previewTriviaIdx, setPreviewTriviaIdx] = useState(0)
  const [previewTriviaAnswers, setPreviewTriviaAnswers] = useState([])

  // Anonymous reply state (pageMode only)
  const [anonMessage, setAnonMessage] = useState('')
  const [anonSubmitting, setAnonSubmitting] = useState(false)
  const [anonSubmitted, setAnonSubmitted] = useState(false)

  // Chain reply state (pageMode only)
  const [chainName, setChainName] = useState('')
  const [chainMessage, setChainMessage] = useState('')
  const [chainSubmitting, setChainSubmitting] = useState(false)
  const [chainSubmitted, setChainSubmitted] = useState(false)
  const [localChainReplies, setLocalChainReplies] = useState([])
  const [previewTriviaSubmitted, setPreviewTriviaSubmitted] = useState(false)

  const c = cardObject
  const hasGift = toolAllowed('gifts') && limit('allowGifts') && c.giftEffect?.enabled && c.giftEffect?.effectKey && c.giftEffect.effectKey !== 'none'
  const hasFadeIn = toolAllowed('cardStyle') && limit('allowFadeIn') && Number(c.card.textBodyAnimation.fadeInDuration) > 0
  const hasTypewriter = toolAllowed('cardStyle') && limit('allowTypewriter') && Number(c.card.textBodyAnimation.selfTypeSpeed) > 0
  const typeSpeed = hasTypewriter ? parseFloat(c.card.textBodyAnimation.selfTypeSpeed) || 2 : 2
  const fadeSpeed = hasFadeIn ? parseFloat(c.card.textBodyAnimation.fadeInDuration) || 2 : 0
  const mediaAllowed = toolAllowed('media') && maxImages > 0
  const primaryImage = mediaAllowed ? (c.media.images[0] || null) : null

  const typedBody = useTypewriter(c.content.body, typeSpeed, stage === 'open' && hasTypewriter)
  const typedExtended = useTypewriter(c.content.extendedBody, typeSpeed, stage === 'open' && hasTypewriter && typedBody === c.content.body)

  // Music — gated by tier (Classic has no music)
  const musicAllowed = limit('allowMusic') && !!c.background.music.url
  const musicStartSec = Number(c.background.music.startSec) || 0
  const musicEndSec = Number(c.background.music.endSec) || 0
  const musicTrimmed = musicEndSec > 0 && musicEndSec > musicStartSec

  useEffect(() => {
    if (!audioRef.current || !musicAllowed) return undefined

    audioRef.current.volume = c.background.music.volume

    if (stage === 'open' || stage === 'end' || stage === 'giftIntro' || stage === 'giftReceive' || stage === 'pollVote' || stage === 'triviaQ' || stage === 'triviaResults' || stage === 'anonPreview' || stage === 'anonReply' || stage === 'chainReplies') {
      // Honour trim window: jump to start point if we're outside the segment.
      if (musicTrimmed) {
        const t = audioRef.current.currentTime
        if (t < musicStartSec || t >= musicEndSec) {
          audioRef.current.currentTime = musicStartSec
        }
      }
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
      audioRef.current.currentTime = musicTrimmed ? musicStartSec : 0
    }

    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, [c.background.music.url, c.background.music.volume, stage, musicAllowed, musicTrimmed, musicStartSec, musicEndSec])

  // While trimmed playback is active, loop within [startSec, endSec] manually.
  // Native <audio loop> covers the file end; we also need to loop at the
  // user-defined endSec.
  useEffect(() => {
    if (!audioRef.current || !musicAllowed || !musicTrimmed) return undefined
    const el = audioRef.current
    const onTime = () => {
      if (el.currentTime >= musicEndSec) {
        el.currentTime = musicStartSec
      }
    }
    el.addEventListener('timeupdate', onTime)
    return () => el.removeEventListener('timeupdate', onTime)
  }, [musicAllowed, musicTrimmed, musicStartSec, musicEndSec])

  // Open effect dispatcher — gated by tier cap
  const triggerOpenEffect = useCallback(() => {
    if (!toolAllowed('animation') || !limit('allowOpenEffects')) return
    if (!c.animation.openEffect || c.animation.openEffect === 'none') return
    fireOpenEffect(c.animation.openEffect, c.animation.confettiColors)
  }, [c.animation.openEffect, c.animation.confettiColors, allowedTools, tierLimits])

  // Seed localChainReplies from chainState prop when it becomes available
  useEffect(() => {
    if (chainState?.responses?.length) {
      setLocalChainReplies(chainState.responses)
    }
  }, [chainState])

  const schedulePreviewTimer = useCallback((fn, delay) => {
    const id = window.setTimeout(() => {
      previewTimersRef.current = previewTimersRef.current.filter((timer) => timer !== id)
      fn()
    }, delay)
    previewTimersRef.current.push(id)
    return id
  }, [])

  useEffect(() => {
    return () => {
      previewTimersRef.current.forEach(window.clearTimeout)
      previewTimersRef.current = []
    }
  }, [])

  const handleEntryOpen = () => {
    if (envelopeEnabled) {
      setStage('closed')
    } else {
      setFadeBody(true)
      setBodyVisible(true)
      setStage('open')
    }
  }

  const handleOpen = () => {
    previewTimersRef.current.forEach(window.clearTimeout)
    previewTimersRef.current = []
    setRevealStep(0)
    triggerOpenEffect()
    setStage('open')
    if (hasFadeIn) {
      schedulePreviewTimer(() => setFadeBody(true), 260)
      schedulePreviewTimer(() => setBodyVisible(true), 420)
    } else {
      setFadeBody(true)
      setBodyVisible(true)
    }
  }

  const handleContinue = () => {
    // Route to type-specific stage after open card
    if (studioType === 'poll' && pollData) {
      setStage('pollVote')
      return
    }
    if (studioType === 'trivia' && triviaData) {
      setPreviewTriviaIdx(0)
      setPreviewTriviaAnswers([])
      setPreviewTriviaSubmitted(false)
      setStage('triviaQ')
      return
    }
    if (studioType === 'anonymous') {
      setStage(pageMode ? 'anonReply' : 'anonPreview')
      return
    }
    if (studioType === 'chain' && pageMode) {
      setStage('chainReplies')
      return
    }
    setStage('end')
  }

  const handleNextQ = () => {
    if (questionIdx < c.questions.items.length - 1) {
      setQuestionIdx(i => i + 1)
    } else {
      setStage('end')
    }
  }

  const handleReset = () => {
    previewTimersRef.current.forEach(window.clearTimeout)
    previewTimersRef.current = []
    setStage(envelopeEnabled ? 'closed' : 'open')
    setQuestionIdx(0)
    setFadeBody(!envelopeEnabled)
    setBodyVisible(!envelopeEnabled)
    setRevealStep(0)
    setPreviewPollVotes([])
    setPreviewPollSubmitted(false)
    setPreviewTriviaIdx(0)
    setPreviewTriviaAnswers([])
    setPreviewTriviaSubmitted(false)
    setAnonMessage('')
    setAnonSubmitting(false)
    setAnonSubmitted(false)
    setChainMessage('')
    setChainSubmitting(false)
    setChainSubmitted(false)
  }

  const handleEndDone = () => {
    if (hasGift) {
      setStage('giftIntro')
    }
  }

  // Close on Esc
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Build background style
  const bgStyle = {}
  if (c.background.type === 'color') {
    bgStyle.background = c.background.colors[0] || '#000000'
  } else if (c.background.type === 'gradient' || c.background.type === 'animated') {
    bgStyle.background = `linear-gradient(135deg, ${c.background.colors.join(', ')})`
    if (c.background.type === 'animated') bgStyle.backgroundSize = '400% 400%'
  } else if (c.background.type === 'image' && c.background.imageUrl) {
    bgStyle.background = `url(${c.background.imageUrl}) center/cover no-repeat`
  }

  // Card border style
  const borderStyle = {}
  if (c.card.cardBorder.type === 'solid') {
    borderStyle.border = `${c.card.cardBorder.width}px solid ${c.card.cardBorder.colors[0] || '#333'}`
  } else if (c.card.cardBorder.type === 'gradient' || c.card.cardBorder.type === 'animated') {
    borderStyle.border = `${c.card.cardBorder.width}px solid transparent`
    borderStyle.backgroundClip = 'padding-box'
  }

  // Memoize particle positions
  const particlePositions = useMemo(() =>
    Array.from({ length: 18 }).map(() => ({
      left: `${5 + Math.random() * 90}%`,
      top: `${5 + Math.random() * 90}%`,
      delay: `${-Math.random() * 8}s`,
      size: `${14 + Math.random() * 14}px`,
    })),
  [])

  // Background effect — gated by the `animation` tool AND tier ambient cap
  const renderBgEffect = () => {
    if (!toolAllowed('animation') || !limit('allowAmbientEffects')) return null
    const eff = c.animation.backgroundEffect
    if (!eff || eff.type === 'none') return null
    if (LEGACY_EMOJI_AMBIENTS.has(eff.type)) {
      const emojis = eff.emojis.length > 0 ? eff.emojis : ['✨']
      return (
        <div className={`cp-bg-effect cp-bg-${eff.type}`}>
          {particlePositions.map((pos, i) => (
            <span
              key={i}
              className={`cp-bg-particle cp-p-${(i % 6) + 1}`}
              style={{
                left: pos.left,
                top: pos.top,
                animationDelay: pos.delay,
                fontSize: pos.size,
              }}
            >
              {emojis[i % emojis.length]}
            </span>
          ))}
        </div>
      )
    }
    return <AmbientParticles type={eff.type} colors={c.animation.confettiColors} />
  }

  const renderGradientBorder = (children, className = '') => {
    if (!toolAllowed('cardStyle')) return children
    const borderType = c.card.cardBorder.type
    if (borderType === 'gradient' && !limit('allowGradientBorder')) return children
    if (borderType === 'animated' && !limit('allowAnimatedBorder')) return children
    if (borderType === 'gradient' || borderType === 'animated') {
      const gradColors = c.card.cardBorder.colors.length > 1
        ? c.card.cardBorder.colors.join(', ')
        : `${c.card.cardBorder.colors[0] || '#333'}, ${c.card.cardBorder.colors[0] || '#333'}`
      return (
        <div
          className={`cp-gradient-border ${c.card.cardBorder.type === 'animated' ? 'animated' : ''} ${className}`}
          style={{
            '--border-gradient': `linear-gradient(135deg, ${gradColors})`,
            '--border-width': `${c.card.cardBorder.width}px`,
            '--border-anim-dur': `${c.card.cardBorder.animationDuration}s`,
          }}
        >
          {children}
        </div>
      )
    }
    return children
  }

  const previewImageStyle = primaryImage
    ? {
        objectFit: primaryImage.fit || 'cover',
        objectPosition: `${primaryImage.positionX ?? 50}% ${primaryImage.positionY ?? 50}%`,
      }
    : {}

  useEffect(() => {
    if (stage !== 'open') return undefined

    const sequence = [
      setTimeout(() => setRevealStep(1), 320),
      setTimeout(() => setRevealStep(2), 1080),
      setTimeout(() => setRevealStep(3), 1840),
      setTimeout(() => setRevealStep(4), 2660),
    ]

    return () => {
      sequence.forEach(clearTimeout)
    }
  }, [stage, primaryImage])

  useEffect(() => {
    if (stage !== 'open' || revealStep < 4) return undefined
    const el = openCardInnerRef.current
    if (!el) return undefined

    el.scrollTop = 0
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll < 24) return undefined

    let frame = 0
    let startTime = 0
    const delay = window.setTimeout(() => {
      const duration = Math.min(11000, Math.max(4200, maxScroll * 34))
      const animate = (time) => {
        if (!startTime) startTime = time
        const progress = Math.min(1, (time - startTime) / duration)
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2
        el.scrollTop = maxScroll * eased
        if (progress < 1) frame = window.requestAnimationFrame(animate)
      }
      frame = window.requestAnimationFrame(animate)
    }, 900)

    return () => {
      window.clearTimeout(delay)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [
    stage,
    revealStep,
    c.content.heading,
    c.content.body,
    c.content.extendedBody,
    c.media.images.length,
  ])

  // Continue label for the open card
  const continueLabel = studioType === 'poll' ? 'Vote Now'
    : studioType === 'trivia' ? 'Start Quiz'
    : studioType === 'anonymous' ? 'Preview Inbox'
    : 'Done'

  const inner = (
    <section className={`cp-overlay cp-device-${pageMode ? 'fullscreen' : previewDevice}`} ref={containerRef}>
      {!pageMode && (
        <div className="cp-device-toolbar" role="tablist" aria-label="Preview device">
          {[
            { id: 'fullscreen', label: 'Full' },
            { id: 'phone', label: 'Phone' },
            { id: 'tablet', label: 'Tablet' },
            { id: 'desktop', label: 'Desktop' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={previewDevice === id}
              className={`cp-device-tab ${previewDevice === id ? 'active' : ''}`}
              onClick={() => setPreviewDevice(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className={`cp-backdrop${c.background.type === 'animated' ? ' animated' : ''}`} style={bgStyle}>
        {c.background.type === 'video' && c.background.videoUrl && limit('allowVideoBackground') ? (
          <video className="cp-backdrop-video" src={c.background.videoUrl} autoPlay muted loop playsInline />
        ) : null}
      </div>

      {stage !== 'closed' && stage !== 'entry' && (
        <div className="cp-ambient-overlay" aria-hidden="true">
          {renderBgEffect()}
        </div>
      )}

      {musicAllowed && (
        <audio ref={audioRef} src={c.background.music.url} loop preload="auto" />
      )}

      <div className={`cp-close-btn ${pageMode ? 'cp-back-btn' : ''} ${stage === 'entry' ? 'cp-close-btn-hidden' : ''}`} onClick={onClose}>
        {pageMode ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>

      {/* Reset button — studio only */}
      {!pageMode && stage !== 'closed' && (
        <button className="cp-reset-btn" onClick={handleReset}>
          Reset
        </button>
      )}

      {/* LOCK GATE — runs before the envelope. Honours interaction.lock so the
          preview matches what the recipient will see. */}
      {!unlocked && lockSpec.type === 'password' && (
        <div className="cp-lock-gate">
          <div className="cp-lock-card">
            <div className="cp-lock-icon">🔒</div>
            <h3>This card is locked</h3>
            <p className="cp-lock-sub">
              {revealSpec.hint?.trim()
                ? revealSpec.hint
                : 'Enter the password the sender shared with you.'}
            </p>
            <form className="cp-lock-form" onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                autoFocus
                value={pwInput}
                onChange={(e) => { setPwInput(e.target.value); setPwError('') }}
                placeholder="Password"
                aria-label="Password"
              />
              <button type="submit" className="primary">Unlock</button>
            </form>
            {pwError && <p className="cp-lock-error">{pwError}</p>}
          </div>
        </div>
      )}

      {!unlocked && lockSpec.type === 'time' && unlockAt && (
        <div className="cp-lock-gate">
          <div className="cp-lock-card">
            <div className="cp-lock-icon">⏳</div>
            <h3>Sealed until later</h3>
            <p className="cp-lock-sub">
              {revealSpec.hint?.trim()
                ? revealSpec.hint
                : `This card unlocks on ${new Date(unlockAt).toLocaleString()}.`}
            </p>
            <p className="cp-lock-countdown">{formatCountdown(unlockAt - now)}</p>
          </div>
        </div>
      )}

      {/* TAP LOCK — tap anywhere to reveal */}
      {!unlocked && lockSpec.type === 'tap' && stage !== 'entry' && (
        <div
          className="cp-tap-gate"
          style={{
            '--tap-accent': c.theme.accentColor || '#7ef7ff',
            '--tap-bg': c.card.backgroundColor || '#0b0f14',
          }}
          onClick={() => setUnlocked(true)}
        >
          <div className="cp-tap-rings" aria-hidden="true">
            <div className="cp-tap-ring r1" />
            <div className="cp-tap-ring r2" />
            <div className="cp-tap-ring r3" />
          </div>
          <div className="cp-tap-center">
            <div className="cp-tap-icon">👆</div>
            <p className="cp-tap-label">Tap to reveal</p>
            {lockSpec.value && <p className="cp-tap-hint">{lockSpec.value}</p>}
          </div>
        </div>
      )}

      {/* SCRATCH LOCK — scratch to reveal */}
      {!unlocked && lockSpec.type === 'scratch' && stage !== 'entry' && (
        <div
          className="cp-scratch-gate"
          style={{ '--scratch-accent': c.theme.accentColor || '#7ef7ff' }}
        >
          <canvas
            ref={scratchCanvasRef}
            className="cp-scratch-canvas"
            width={360}
            height={640}
            onPointerDown={() => { scratchingRef.current = true }}
            onPointerUp={() => { scratchingRef.current = false }}
            onPointerLeave={() => { scratchingRef.current = false }}
            onPointerMove={handleScratch}
            onTouchStart={e => { e.preventDefault(); scratchingRef.current = true }}
            onTouchEnd={() => { scratchingRef.current = false }}
            onTouchMove={e => { e.preventDefault(); handleScratch(e) }}
          />
          <div className="cp-scratch-bar">
            <div className="cp-scratch-fill" style={{ width: `${Math.min(scratchPct, 100)}%` }} />
            <span className="cp-scratch-hint">{scratchPct < 55 ? 'Scratch to reveal the card' : 'Revealing…'}</span>
          </div>
        </div>
      )}

      {/* CINEMATIC ENTRY SCREEN — shown first in pageMode before the card opens */}
      {stage === 'entry' && (() => {
        const entryMeta = ENTRY_DEFAULTS[studioType] || ENTRY_DEFAULTS.personal
        const EntryIcon = entryMeta.Icon
        const bg = c.card.backgroundColor || '#0b0f14'
        const accent = c.theme.accentColor || entryMeta.color
        // Always use the type-specific color as the dominant orb hue so each card type has visual identity
        const g1 = entryMeta.color
        const g2 = c.theme?.palette?.gradient?.[1] || bg
        return (
          <div
            className="cp-entry-screen"
            style={{ '--entry-bg': bg, '--entry-g1': g1, '--entry-g2': g2, '--entry-accent': accent }}
          >
            {/* Atmospheric orbs */}
            <div className="cp-entry-orb cp-entry-orb-1" />
            <div className="cp-entry-orb cp-entry-orb-2" />
            <div className="cp-entry-orb cp-entry-orb-3" />

            {/* Particle layer */}
            <div className="cp-entry-particles" aria-hidden="true">
              {renderBgEffect()}
            </div>

            {/* Center content */}
            <div className="cp-entry-content">
              <div className="cp-entry-brand">
                <img src="/cardora-logo.png?v=4" alt="" className="cp-entry-brand-logo" />
                <span className="cp-entry-brand-name">Cardora</span>
              </div>

              <div className="cp-entry-type-chip" style={{ color: accent, borderColor: `${accent}40` }}>
                <EntryIcon size={14} color={accent} />
                <span>{entryMeta.label}</span>
              </div>

              <h1
                className="cp-entry-title"
                style={{
                  color: c.card.headingColor || '#ffffff',
                  fontFamily: `'${c.theme.fontFamily}', serif`,
                }}
              >
                {cardTitle || entryMeta.hint}
              </h1>

              <button
                className="cp-entry-open-btn"
                style={{ '--btn-color': accent }}
                onClick={handleEntryOpen}
              >
                <span className="cp-entry-open-ring" />
                <span className="cp-entry-open-ring cp-entry-open-ring-2" />
                <span className="cp-entry-open-label">
                  {studioType === 'anonymous' ? 'Open' : 'Open Card'}
                </span>
              </button>

              <p className="cp-entry-tap-hint">tap to reveal</p>
            </div>
          </div>
        )
      })()}

      {/* ENVELOPE (closed state) — only Personal + Chain cards get the reveal metaphor */}
      {unlocked && stage === 'closed' && envelopeEnabled && (
        <>
          {revealSpec.hint?.trim() && (
            <p className="cp-reveal-hint" aria-hidden="true">
              {revealSpec.hint}
            </p>
          )}
          <Envelope
            cardObject={c}
            tier={tier}
            recipientEmail={recipientEmail}
            onOpenComplete={handleOpen}
          />
        </>
      )}

      {/* OPEN CARD — also gated by lock for non-envelope card types. */}
      {unlocked && stage === 'open' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle({ ...borderStyle, '--scrollbar-color': c.card.scrollbarColor })}
            >
              <div ref={openCardInnerRef} className="cp-card-inner cp-card-inner-full" style={{ '--scrollbar-color': c.card.scrollbarColor }}>
                {/* Render card body elements in the user-defined order */}
                {(c.layout?.elementOrder || ['media', 'heading', 'body']).map(key => {
                  if (key === 'heading') return (
                    <h2
                      key="heading"
                      className={`cp-heading cp-reveal-element ${revealStep >= 1 ? 'visible' : ''}`}
                      style={{
                        color: c.card.headingColor,
                        fontFamily: `'${c.theme.fontFamily}', serif`,
                        fontSize: `${c.theme.headingSize ?? 28}px`,
                      }}
                    >
                      {c.content.heading}
                    </h2>
                  )
                  if (key === 'media') return mediaAllowed && c.media.images.length > 0 ? (
                    <div
                      key="media"
                      className={`cp-media-section cp-media-section-full cp-media-grid--${Math.min(c.media.images.length, 3)} cp-reveal-element ${revealStep >= 2 ? 'visible' : ''} ${revealStep >= 4 ? 'settled' : ''}`}
                      style={{ transitionDuration: hasFadeIn ? `${fadeSpeed}s` : '0.3s' }}
                    >
                      {c.media.images.map((img, i) => (
                        <div key={i} className="cp-media-item cp-media-item-full">
                          <img
                            src={img.url}
                            alt={img.caption || ''}
                            style={{
                              objectFit: img.fit || 'cover',
                              objectPosition: `${img.positionX ?? 50}% ${img.positionY ?? 50}%`,
                              height: img.height ? `${img.height}px` : undefined,
                            }}
                          />
                          {img.caption && <p className="cp-caption cp-caption-full">{img.caption}</p>}
                        </div>
                      ))}
                    </div>
                  ) : null
                  if (key === 'body') return (
                    <div
                      key="body"
                      className={`cp-body cp-reveal-element ${fadeBody && revealStep >= 3 ? 'visible' : ''}`}
                      style={{
                        color: c.card.textColor,
                        fontFamily: `'${c.theme.fontFamily}', sans-serif`,
                        fontSize: `${c.theme.bodySize ?? 16}px`,
                        transitionDuration: hasFadeIn ? `${fadeSpeed}s` : '0.3s',
                      }}
                    >
                      <p>{hasTypewriter ? typedBody : c.content.body}</p>
                      {c.content.extendedBody && (
                        <p className="cp-extended">
                          {hasTypewriter ? typedExtended : c.content.extendedBody}
                        </p>
                      )}
                    </div>
                  )
                  return null
                })}

                {/* Continue */}
                <button
                  className={`cp-continue-btn cp-reveal-element ${revealStep >= 4 ? 'visible' : ''}`}
                  style={{
                    backgroundColor: c.theme.accentColor,
                    color: c.card.backgroundColor,
                  }}
                  onClick={handleContinue}
                >
                  {continueLabel}
                </button>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* POLL VOTE STAGE */}
      {stage === 'pollVote' && pollData && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-card-inner cp-card-inner-full">
                <div className="cp-poll-stage">
                  <p className="cp-poll-eyebrow" style={{ color: c.theme.accentColor }}>Poll Experience</p>
                  <h2
                    className="cp-poll-question-text"
                    style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}
                  >
                    {pollData.question || 'Your poll question'}
                  </h2>
                  <div className="cp-poll-options">
                    {(pollData.options || []).map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`cp-poll-option ${previewPollVotes.includes(i) ? 'selected' : ''}`}
                        style={{ color: c.card.textColor }}
                        onClick={() => {
                          if (previewPollSubmitted) return
                          if (pollData.allowMultiple) {
                            setPreviewPollVotes(prev => prev.includes(i) ? prev.filter(v => v !== i) : [...prev, i])
                          } else {
                            setPreviewPollVotes([i])
                          }
                        }}
                      >
                        <span className="cp-poll-radio" />
                        <span>{(typeof opt === 'object' ? opt.text : opt) || `Option ${i + 1}`}</span>
                      </button>
                    ))}
                  </div>
                  {!previewPollSubmitted ? (
                    <button
                      type="button"
                      className="cp-poll-submit"
                      style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                      disabled={previewPollVotes.length === 0}
                      onClick={() => {
                        setPreviewPollSubmitted(true)
                        if (onPollSubmit) {
                          const opts = pollData?.options || []
                          const optId = previewPollVotes.map(i => {
                            const o = opts[i]
                            return typeof o === 'object' ? o.id : `opt_${i}`
                          })[0]
                          onPollSubmit(optId)
                        }
                      }}
                    >
                      Submit Vote
                    </button>
                  ) : (
                    <div className="cp-poll-voted-confirm">
                      <div className="cp-poll-voted-icon" style={{ color: c.theme.accentColor }}>✓</div>
                      <p className="cp-poll-voted-msg" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                        Vote submitted!
                      </p>
                      <div className="cp-poll-voted-choices">
                        {(pollData.options || []).map((opt, i) => (
                          previewPollVotes.includes(i) ? (
                            <div key={i} className="cp-poll-voted-choice" style={{ background: `${c.theme.accentColor}20`, borderColor: `${c.theme.accentColor}60`, color: c.card.textColor }}>
                              <span className="cp-poll-voted-check" style={{ color: c.theme.accentColor }}>✓</span>
                              <span>{(typeof opt === 'object' ? opt.text : opt) || `Option ${i + 1}`}</span>
                            </div>
                          ) : null
                        ))}
                      </div>
                      <button
                        type="button"
                        className="cp-continue-btn visible"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                        onClick={() => setStage('end')}
                      >
                        Continue
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* TRIVIA QUESTION STAGE */}
      {stage === 'triviaQ' && triviaData && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-card-inner cp-card-inner-full">
                <div className="cp-trivia-stage">
                  <div className="cp-trivia-progress">
                    {triviaData.questions.map((_, i) => (
                      <div
                        key={i}
                        className={`cp-trivia-progress-dot ${i < previewTriviaIdx ? 'done' : ''} ${i === previewTriviaIdx ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                  <p className="cp-trivia-counter" style={{ color: c.theme.accentColor }}>
                    Question {previewTriviaIdx + 1} of {triviaData.questions.length}
                  </p>
                  <h3
                    className="cp-trivia-question-text"
                    style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}
                  >
                    {triviaData.questions[previewTriviaIdx]?.text || 'Question'}
                  </h3>
                  <div className="cp-trivia-options">
                    {(triviaData.questions[previewTriviaIdx]?.options || []).map((opt, oi) => (
                      <button
                        key={oi}
                        type="button"
                        className={`cp-trivia-option ${previewTriviaAnswers[previewTriviaIdx] === oi ? 'selected' : ''}`}
                        style={{ color: c.card.textColor }}
                        onClick={() => {
                          const next = [...previewTriviaAnswers]
                          next[previewTriviaIdx] = oi
                          setPreviewTriviaAnswers(next)
                        }}
                      >
                        <span className="cp-trivia-option-letter">{String.fromCharCode(65 + oi)}</span>
                        <span>{opt || `Option ${oi + 1}`}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cp-trivia-next"
                    style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                    onClick={() => {
                      if (previewTriviaIdx < triviaData.questions.length - 1) {
                        setPreviewTriviaIdx(i => i + 1)
                      } else {
                        setStage('triviaResults')
                        if (onTriviaComplete) onTriviaComplete(previewTriviaAnswers)
                      }
                    }}
                  >
                    {previewTriviaIdx < triviaData.questions.length - 1 ? 'Next Question' : 'See Results'}
                  </button>
                </div>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* TRIVIA RESULTS */}
      {stage === 'triviaResults' && triviaData && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-card-inner cp-card-inner-full">
                {(() => {
                  const correct = triviaData.questions.filter((q, i) => previewTriviaAnswers[i] === q.correctIndex).length
                  const total = triviaData.questions.length
                  const pct = total > 0 ? correct / total : 0
                  const circumference = 2 * Math.PI * 44
                  const dashOffset = circumference * (1 - pct)
                  const perfMsg = pct === 1 ? 'Perfect score!' : pct >= 0.75 ? 'Great job!' : pct >= 0.5 ? 'Not bad!' : 'Keep practicing!'
                  const perfEmoji = pct === 1 ? '🏆' : pct >= 0.75 ? '🎉' : pct >= 0.5 ? '👏' : '💪'
                  return (
                  <div className="cp-trivia-results">
                    <svg className="cp-trivia-score-ring" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                      <circle
                        cx="50" cy="50" r="44" fill="none"
                        stroke={c.theme.accentColor}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'center', transform: 'rotate(-90deg)' }}
                      />
                      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill={c.card.headingColor} fontSize="20" fontWeight="800" fontFamily="inherit">
                        {correct}/{total}
                      </text>
                    </svg>
                    <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, margin: 0 }}>
                      {perfMsg} {perfEmoji}
                    </h3>
                    <p className="cp-trivia-score-label" style={{ color: c.card.textColor }}>
                      {correct} out of {total} correct
                    </p>
                    <button
                      type="button"
                      className="cp-continue-btn visible"
                      style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                      onClick={() => setStage('end')}
                    >
                      Continue
                    </button>
                  </div>
                  )
                })()}
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* ANONYMOUS PREVIEW */}
      {stage === 'anonPreview' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-card-inner cp-card-inner-full">
                <div className="cp-anon-stage">
                  <p className="cp-anon-template-label" style={{ color: c.theme.accentColor }}>
                    Anonymous Inbox Template
                  </p>
                  <h2 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, margin: 0, fontSize: '1.3rem' }}>
                    {c.content.heading}
                  </h2>
                  <p style={{ color: c.card.textColor, margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {c.content.body}
                  </p>
                  <div className="cp-anon-sample-msg">
                    <p style={{ color: c.card.textColor }}>
                      "This is a preview of how anonymous messages will appear, wrapped in your template design."
                    </p>
                  </div>
                  <div className="cp-anon-mock-input">
                    <p>Senders will type their message here</p>
                  </div>
                  <button
                    type="button"
                    className="cp-continue-btn visible"
                    style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                    onClick={() => setStage('end')}
                  >
                    Done
                  </button>
                </div>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* ANONYMOUS REPLY — shown in pageMode when recipient opens an anonymous card */}
      {stage === 'anonReply' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full cp-anon-reply-card"
              style={cardSurfaceStyle(borderStyle)}
            >
              {anonSubmitted ? (
                <div className="cp-anon-reply-sent">
                  <div className="cp-end-icon" style={{ color: c.theme.accentColor }}>✓</div>
                  <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                    Sent anonymously
                  </h3>
                  <p style={{ color: c.card.textColor, opacity: 0.7, fontSize: '0.9rem' }}>
                    Your message was delivered. The creator won't know it was you.
                  </p>
                  <div className="cp-end-actions">
                    <button
                      className="cp-end-btn"
                      style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                      onClick={handleReset}
                    >
                      Replay card
                    </button>
                    <a
                      className="cp-end-btn ghost"
                      style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      href="/studio"
                    >
                      Create yours →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="cp-anon-reply-form">
                  <p className="cp-anon-reply-label" style={{ color: c.theme.accentColor }}>
                    Anonymous Message
                  </p>
                  <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, marginBottom: 8 }}>
                    Send a message anonymously
                  </h3>
                  <p style={{ color: c.card.textColor, opacity: 0.7, fontSize: '0.85rem', marginBottom: 20 }}>
                    The creator will receive your message but won't know who sent it.
                  </p>
                  <textarea
                    className="cp-anon-textarea"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${c.theme.accentColor}40`,
                      color: c.card.textColor,
                      fontFamily: `'${c.theme.fontFamily}', sans-serif`,
                    }}
                    placeholder="Write your message here… (max 500 characters)"
                    maxLength={500}
                    value={anonMessage}
                    onChange={e => setAnonMessage(e.target.value)}
                  />
                  <div className="cp-anon-char-count" style={{ color: c.card.textColor, opacity: 0.45 }}>
                    {anonMessage.length} / 500
                  </div>
                  <button
                    className="cp-continue-btn visible"
                    style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor, opacity: anonSubmitting ? 0.6 : 1 }}
                    disabled={!anonMessage.trim() || anonSubmitting}
                    onClick={async () => {
                      if (!anonMessage.trim()) return
                      setAnonSubmitting(true)
                      try {
                        if (onAnonSubmit) await onAnonSubmit(anonMessage.trim())
                      } catch (e) { /* swallow */ }
                      setAnonSubmitting(false)
                      setAnonSubmitted(true)
                    }}
                  >
                    {anonSubmitting ? 'Sending…' : 'Send Anonymously'}
                  </button>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: c.card.textColor, opacity: 0.4, fontSize: '0.8rem', marginTop: 8, cursor: 'pointer' }}
                    onClick={() => setStage('end')}
                  >
                    Skip
                  </button>
                </div>
              )}
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* CHAIN REPLIES — live public feed + reply form, pageMode only */}
      {stage === 'chainReplies' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full cp-chain-replies-card"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-chain-replies-inner">
                {/* Header */}
                <div className="cp-chain-header">
                  <p className="cp-chain-eyebrow" style={{ color: c.theme.accentColor }}>Chain Card</p>
                  {c.content.heading && (
                    <h3 className="cp-chain-challenge" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                      {c.content.heading}
                    </h3>
                  )}
                </div>

                {/* Existing replies feed */}
                <div className="cp-chain-feed">
                  {localChainReplies.length === 0 ? (
                    <p className="cp-chain-empty" style={{ color: c.card.textColor }}>
                      No replies yet — be the first!
                    </p>
                  ) : (
                    localChainReplies.slice().reverse().map((r, i) => (
                      <div key={r.userId || r.id || i} className="cp-chain-reply">
                        <div className="cp-chain-reply-avatar" style={{ background: `${c.theme.accentColor}30`, color: c.theme.accentColor }}>
                          {(r.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="cp-chain-reply-body">
                          <span className="cp-chain-reply-name" style={{ color: c.theme.accentColor }}>{r.name || 'Someone'}</span>
                          <p className="cp-chain-reply-text" style={{ color: c.card.textColor }}>{r.response || r.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply form */}
                {!chainSubmitted ? (
                  <div className="cp-chain-reply-form">
                    <input
                      type="text"
                      className="cp-chain-name-input"
                      style={{ background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${c.theme.accentColor}40`, color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif` }}
                      placeholder="Your name or handle…"
                      maxLength={50}
                      value={chainName}
                      onChange={e => setChainName(e.target.value)}
                    />
                    <textarea
                      className="cp-anon-textarea"
                      style={{ background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${c.theme.accentColor}40`, color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif` }}
                      placeholder="Add your reply to the chain…"
                      maxLength={500}
                      value={chainMessage}
                      onChange={e => setChainMessage(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="cp-continue-btn visible"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor, flex: 1, opacity: chainSubmitting ? 0.6 : 1 }}
                        disabled={!chainMessage.trim() || chainSubmitting}
                        onClick={async () => {
                          if (!chainMessage.trim()) return
                          setChainSubmitting(true)
                          const displayName = chainName.trim() || 'Anonymous'
                          try {
                            if (onChainReply) await onChainReply(chainMessage.trim(), displayName)
                            setLocalChainReplies(prev => [...prev, { response: chainMessage.trim(), name: displayName, timestamp: new Date().toISOString() }])
                          } catch (e) { /* swallow */ }
                          setChainSubmitting(false)
                          setChainSubmitted(true)
                        }}
                      >
                        {chainSubmitting ? 'Sending…' : 'Reply to Chain'}
                      </button>
                      <button
                        type="button"
                        style={{ background: 'none', border: `1.5px solid ${c.theme.accentColor}40`, color: c.theme.accentColor, borderRadius: 999, padding: '0 16px', cursor: 'pointer', fontSize: '0.82rem' }}
                        onClick={() => setStage('end')}
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cp-chain-reply-sent">
                    <p className="cp-chain-sent-msg" style={{ color: c.theme.accentColor }}>✓ Reply added to the chain!</p>
                    <button
                      className="cp-continue-btn visible"
                      style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                      onClick={() => setStage('end')}
                    >
                      Continue
                    </button>
                  </div>
                )}
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* END */}
      {stage === 'end' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          <article
            className="cp-card cp-card-full cp-end-card"
            style={cardSurfaceStyle(borderStyle)}
          >
            {pageMode ? (
              <div className="cp-end-outro">
                {/* Animated sparkle burst */}
                <div className="cp-end-sparkle-ring" style={{ '--end-accent': c.theme.accentColor }}>
                  {[0,1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="cp-end-sparkle" style={{ '--i': i, background: c.theme.accentColor }} />
                  ))}
                  <div className="cp-end-outro-check" style={{ color: c.theme.accentColor }}>✓</div>
                </div>

                <h3 className="cp-end-outro-heading" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                  That's the whole card
                </h3>
                <p className="cp-end-outro-sub" style={{ color: c.card.textColor }}>
                  Hope it made your day
                </p>

                {/* Cardora branding */}
                <div className="cp-end-brand">
                  <img src="/cardora-logo.png?v=4" alt="" className="cp-end-brand-logo" />
                  <span style={{ color: c.card.textColor, opacity: 0.5, fontSize: '0.78rem' }}>Made with Cardora</span>
                </div>

                <div className="cp-end-actions">
                  {hasGift && (
                    <button className="cp-end-btn" style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }} onClick={handleEndDone}>
                      Continue
                    </button>
                  )}
                  <button className="cp-end-btn" style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }} onClick={handleReset}>
                    Replay
                  </button>
                  <a className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: `${c.theme.accentColor}60`, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} href="/studio">
                    Create yours →
                  </a>
                </div>
              </div>
            ) : (
              <>
                <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                  Card Complete
                </h3>
                <p style={{ color: c.card.textColor }}>
                  This is how the recipient will experience your card.
                </p>
                <div className="cp-end-actions">
                  {hasGift && (
                    <button className="cp-end-btn" style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }} onClick={handleEndDone}>
                      Continue
                    </button>
                  )}
                  <button className="cp-end-btn" style={{ backgroundColor: hasGift ? 'transparent' : c.theme.accentColor, color: hasGift ? c.theme.accentColor : c.card.backgroundColor, border: hasGift ? `1.5px solid ${c.theme.accentColor}` : 'none' }} onClick={handleReset}>
                    Replay
                  </button>
                  <button className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }} onClick={onClose}>
                    Back to Editor
                  </button>
                </div>
              </>
            )}
          </article>
        </div>
      )}

      {/* GIFT INTRO */}
      {stage === 'giftIntro' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          <article className="cp-card cp-card-full cp-gift-intro" style={cardSurfaceStyle(borderStyle)}>
            <div className="cp-gift-sparkle">ðŸŽ</div>
            <h3 className="cp-gift-intro-heading" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
              Wait... there's more
            </h3>
            <p className="cp-gift-intro-sub" style={{ color: c.card.textColor }}>
              Someone left something special for you.
            </p>
            <p className="cp-gift-intro-hint" style={{ color: c.theme.accentColor }}>
              A gift is waiting to be revealed.
            </p>
            <button
              className="cp-gift-reveal-btn"
              style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
              onClick={() => setStage('giftReveal')}
            >
              Reveal Gift
            </button>
          </article>
        </div>
      )}

      {/* GIFT REVEAL */}
      {stage === 'giftReveal' && (
        <PremiumGiftReveal
          effect={c.giftEffect.effectKey}
          onComplete={() => setStage('giftReceive')}
        />
      )}

      {/* GIFT RECEIVE */}
      {stage === 'giftReceive' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          <article className="cp-card cp-card-full cp-gift-receive" style={cardSurfaceStyle(borderStyle)}>
            <div className="cp-gift-received-icon">ðŸŽ‰</div>
            <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
              You received a gift!
            </h3>
            <p className="cp-gift-title" style={{ color: c.theme.accentColor }}>
              {c.giftEffect.giftTitle}
            </p>
            {c.giftEffect.giftAmount && (
              <p className="cp-gift-value" style={{ color: c.card.textColor }}>
                Value: {c.giftEffect.giftAmount}
              </p>
            )}
            <div className="cp-end-actions">
              <button
                className="cp-end-btn"
                style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                onClick={() => { /* future: claim via backend */ }}
              >
                Claim Gift
              </button>
              <button className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }} onClick={handleReset}>
                Replay
              </button>
              {pageMode ? (
                <a className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} href="/studio">
                  Create yours →
                </a>
              ) : (
                <button className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }} onClick={onClose}>
                  Back to Editor
                </button>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  )

  return pageMode ? inner : createPortal(inner, document.body)
}

export default CardPreviewModal

