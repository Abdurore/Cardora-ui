import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import PremiumGiftReveal from './PremiumGiftReveal.jsx'
import Envelope from './Envelope.jsx'
import AmbientParticles from './AmbientParticles.jsx'
import { fireOpenEffect } from '../lib/studioEffects.js'
import { shouldShowEnvelope } from '../lib/tierLimits.js'

const LEGACY_EMOJI_AMBIENTS = new Set(['floating', 'reverse'])

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
}) {
  // `allowedTools` gates tool visibility; `tierLimits` caps the content a
  // visible tool is allowed to contribute (e.g. music allowed, images > 1).
  // Both null = public viewer, render everything the card has.
  const toolAllowed = (id) => !allowedTools || allowedTools.includes(id)
  const limit = (key, fallback = true) => (tierLimits ? !!tierLimits[key] : fallback)
  const maxImages = tierLimits ? (tierLimits.maxImages ?? Infinity) : Infinity
  const envelopeEnabled = shouldShowEnvelope(studioType)
  const [stage, setStage] = useState(envelopeEnabled ? 'closed' : 'open')
  const [questionIdx, setQuestionIdx] = useState(0)
  const [fadeBody, setFadeBody] = useState(!envelopeEnabled)
  const [bodyVisible, setBodyVisible] = useState(!envelopeEnabled)
  const [revealStep, setRevealStep] = useState(0)
  const audioRef = useRef(null)
  const containerRef = useRef(null)

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
  const [unlocked, setUnlocked] = useState(lockSpec.type === 'none')
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [now, setNow] = useState(() => Date.now())
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
  const [previewTriviaSubmitted, setPreviewTriviaSubmitted] = useState(false)

  const c = cardObject
  const hasQuestions = toolAllowed('questions') && limit('allowQuestions') && c.questions.items.length > 0
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

    if (stage === 'open' || stage === 'questions' || stage === 'end' || stage === 'giftIntro' || stage === 'giftReceive' || stage === 'pollVote' || stage === 'triviaQ' || stage === 'triviaResults' || stage === 'anonPreview') {
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

  const handleOpen = () => {
    triggerOpenEffect()
    setStage('open')
    setBodyVisible(false)
    setRevealStep(0)
    if (hasFadeIn) {
      setTimeout(() => setFadeBody(true), 200)
      setTimeout(() => setBodyVisible(true), 300)
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
      setStage('anonPreview')
      return
    }
    if (hasQuestions) {
      setStage('questions')
      setQuestionIdx(0)
    } else {
      setStage('end')
    }
  }

  const handleNextQ = () => {
    if (questionIdx < c.questions.items.length - 1) {
      setQuestionIdx(i => i + 1)
    } else {
      setStage('end')
    }
  }

  const handleReset = () => {
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
      setTimeout(() => setRevealStep(1), 220),
      setTimeout(() => setRevealStep(2), 820),
      setTimeout(() => setRevealStep(3), 1420),
      setTimeout(() => setRevealStep(4), 2060),
    ]

    return () => {
      sequence.forEach(clearTimeout)
    }
  }, [stage, primaryImage])

  // Continue label for the open card
  const continueLabel = studioType === 'poll' ? 'Vote Now'
    : studioType === 'trivia' ? 'Start Quiz'
    : studioType === 'anonymous' ? 'Preview Inbox'
    : hasQuestions ? 'Continue' : 'Done'

  return createPortal(
    <section className={`cp-overlay cp-device-${previewDevice}`} ref={containerRef}>
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
      <div className={`cp-backdrop${c.background.type === 'animated' ? ' animated' : ''}`} style={bgStyle}>
        {c.background.type === 'video' && c.background.videoUrl && limit('allowVideoBackground') ? (
          <video className="cp-backdrop-video" src={c.background.videoUrl} autoPlay muted loop playsInline />
        ) : null}
      </div>

      {stage !== 'closed' && (
        <div className="cp-ambient-overlay" aria-hidden="true">
          {renderBgEffect()}
        </div>
      )}

      {musicAllowed && (
        <audio ref={audioRef} src={c.background.music.url} loop preload="auto" />
      )}

      <div className="cp-close-btn" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>

      {/* Reset button */}
      {stage !== 'closed' && (
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
              <div className="cp-card-inner cp-card-inner-full" style={{ '--scrollbar-color': c.card.scrollbarColor }}>
                {/* Heading */}
                <h2
                  className={`cp-heading cp-reveal-element ${revealStep >= 1 ? 'visible' : ''}`}
                  style={{
                    color: c.card.headingColor,
                    fontFamily: `'${c.theme.fontFamily}', serif`,
                    fontSize: `${c.theme.headingSize ?? 28}px`,
                  }}
                >
                  {c.content.heading}
                </h2>

                {/* Media — show all uploaded images */}
                {mediaAllowed && c.media.images.length > 0 && (
                  <div
                    className={`cp-media-section cp-media-section-full cp-media-grid--${Math.min(c.media.images.length, 3)} cp-reveal-element ${revealStep >= 2 ? 'visible' : ''} ${revealStep >= 4 ? 'settled' : ''}`}
                    style={{
                      transitionDuration: hasFadeIn ? `${fadeSpeed}s` : '0.3s',
                    }}
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
                )}

                {/* Body */}
                <div
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
                        <span>{opt || `Option ${i + 1}`}</span>
                      </button>
                    ))}
                  </div>
                  {!previewPollSubmitted ? (
                    <button
                      type="button"
                      className="cp-poll-submit"
                      style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                      disabled={previewPollVotes.length === 0}
                      onClick={() => setPreviewPollSubmitted(true)}
                    >
                      Submit Vote
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="cp-continue-btn visible"
                      style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                      onClick={() => setStage('end')}
                    >
                      Continue
                    </button>
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
                <div className="cp-trivia-results">
                  <div
                    className="cp-trivia-score-circle"
                    style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }}
                  >
                    {triviaData.questions.filter((q, i) => previewTriviaAnswers[i] === q.correctIndex).length}/{triviaData.questions.length}
                  </div>
                  <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, margin: 0 }}>
                    Quiz Complete!
                  </h3>
                  <p className="cp-trivia-score-label" style={{ color: c.card.textColor }}>
                    You got {triviaData.questions.filter((q, i) => previewTriviaAnswers[i] === q.correctIndex).length} out of {triviaData.questions.length} correct
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

      {/* QUESTIONS */}
      {stage === 'questions' && c.questions.items[questionIdx] && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full cp-question-card"
              style={cardSurfaceStyle(borderStyle)}
            >
              <p className="cp-q-label" style={{ color: c.theme.accentColor }}>
                Question {questionIdx + 1} of {c.questions.items.length}
              </p>
              <h3
                className="cp-q-text"
                style={{
                  color: c.card.headingColor,
                  fontFamily: `'${c.theme.fontFamily}', serif`,
                }}
              >
                {c.questions.items[questionIdx].text}
              </h3>
              <div className="cp-q-actions">
                <button
                  className="cp-q-btn yes"
                  style={{
                    backgroundColor: c.questions.button.backgroundColor,
                    color: c.questions.button.textColor,
                    border: `1.5px solid ${c.questions.button.borderColor}`,
                  }}
                  onClick={handleNextQ}
                >
                  Yes
                </button>
                <button
                  className={`cp-q-btn no ${c.questions.denyBehavior === 'switch' ? 'deny-switch' : ''}`}
                  style={{
                    backgroundColor: 'transparent',
                    color: c.questions.button.textColor,
                    border: `1.5px solid ${c.questions.button.borderColor}40`,
                  }}
                  onClick={c.questions.denyBehavior === 'switch' ? undefined : handleNextQ}
                  onMouseEnter={c.questions.denyBehavior === 'switch' ? (e) => {
                    const x = Math.floor(Math.random() * 120) - 60
                    const y = Math.floor(Math.random() * 80) - 40
                    e.currentTarget.style.transform = `translate(${x}px, ${y}px)`
                  } : undefined}
                >
                  No
                </button>
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
            <div className="cp-end-icon" style={{ color: c.theme.accentColor }}>✓</div>
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
                onClick={() => { /* Dummy â€” future: claim via backend */ }}
              >
                Claim Gift
              </button>
              <button className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }} onClick={handleReset}>
                Replay
              </button>
              <button className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }} onClick={onClose}>
                Back to Editor
              </button>
            </div>
          </article>
        </div>
      )}
    </section>,
    document.body
  )
}

export default CardPreviewModal

