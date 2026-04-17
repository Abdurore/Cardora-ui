import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import PremiumGiftReveal from './PremiumGiftReveal.jsx'
import Envelope from './Envelope.jsx'
import AmbientParticles from './AmbientParticles.jsx'
import { fireOpenEffect } from '../lib/studioEffects.js'

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
  recipientEmail = '',
  studioType = 'moment',
  pollData = null,
  triviaData = null,
  anonTemplate = null,
}) {
  const [stage, setStage] = useState('closed') // closed, opening, open, questions, end, giftIntro, giftReveal, giftReceive, pollVote, triviaQ, triviaResults, anonPreview
  const [questionIdx, setQuestionIdx] = useState(0)
  const [fadeBody, setFadeBody] = useState(false)
  const [bodyVisible, setBodyVisible] = useState(false)
  const [revealStep, setRevealStep] = useState(0)
  const audioRef = useRef(null)
  const containerRef = useRef(null)

  // Poll preview state
  const [previewPollVotes, setPreviewPollVotes] = useState([])
  const [previewPollSubmitted, setPreviewPollSubmitted] = useState(false)

  // Trivia preview state
  const [previewTriviaIdx, setPreviewTriviaIdx] = useState(0)
  const [previewTriviaAnswers, setPreviewTriviaAnswers] = useState([])
  const [previewTriviaSubmitted, setPreviewTriviaSubmitted] = useState(false)

  const c = cardObject
  const hasQuestions = c.questions.items.length > 0
  const hasGift = c.giftEffect?.enabled && c.giftEffect?.effectKey && c.giftEffect.effectKey !== 'none'
  const hasFadeIn = c.card.textBodyAnimation.fadeInDuration !== 'none'
  const hasTypewriter = c.card.textBodyAnimation.selfTypeSpeed !== 'none'
  const typeSpeed = hasTypewriter ? parseFloat(c.card.textBodyAnimation.selfTypeSpeed) || 2 : 2
  const fadeSpeed = hasFadeIn ? parseFloat(c.card.textBodyAnimation.fadeInDuration) || 2 : 0
  const primaryImage = c.media.images[0] || null

  const typedBody = useTypewriter(c.content.body, typeSpeed, stage === 'open' && hasTypewriter)
  const typedExtended = useTypewriter(c.content.extendedBody, typeSpeed, stage === 'open' && hasTypewriter && typedBody === c.content.body)

  // Music
  useEffect(() => {
    if (!audioRef.current || !c.background.music.url) return undefined

    audioRef.current.volume = c.background.music.volume

    if (stage === 'open' || stage === 'questions' || stage === 'end' || stage === 'giftIntro' || stage === 'giftReceive' || stage === 'pollVote' || stage === 'triviaQ' || stage === 'triviaResults' || stage === 'anonPreview') {
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, [c.background.music.url, c.background.music.volume, stage])

  // Open effect dispatcher
  const triggerOpenEffect = useCallback(() => {
    if (!c.animation.openEffect || c.animation.openEffect === 'none') return
    fireOpenEffect(c.animation.openEffect, c.animation.confettiColors)
  }, [c.animation.openEffect, c.animation.confettiColors])

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
    setStage('closed')
    setQuestionIdx(0)
    setFadeBody(false)
    setBodyVisible(false)
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
  } else if (c.background.type === 'gradient') {
    bgStyle.background = `linear-gradient(135deg, ${c.background.colors.join(', ')})`
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

  // Background effect
  const renderBgEffect = () => {
    const eff = c.animation.backgroundEffect
    if (!eff || eff.type === 'none') return null
    if (LEGACY_EMOJI_AMBIENTS.has(eff.type)) {
      const emojis = eff.emojis.length > 0 ? eff.emojis : ['âœ¨']
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
    if (c.card.cardBorder.type === 'gradient' || c.card.cardBorder.type === 'animated') {
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
    <section className="cp-overlay" ref={containerRef}>
      <div className="cp-backdrop" style={bgStyle}>
        {c.background.type === 'video' && c.background.videoUrl ? (
          <video className="cp-backdrop-video" src={c.background.videoUrl} autoPlay muted loop playsInline />
        ) : null}
        {stage !== 'closed' && renderBgEffect()}
      </div>

      {c.background.music.url && (
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

      {/* ENVELOPE (closed state) */}
      {stage === 'closed' && (
        <Envelope
          cardObject={c}
          tier={tier}
          recipientEmail={recipientEmail}
          onOpenComplete={handleOpen}
        />
      )}

      {/* OPEN CARD */}
      {stage === 'open' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={{
                backgroundColor: c.card.backgroundColor,
                ...borderStyle,
                '--scrollbar-color': c.card.scrollbarColor,
              }}
            >
              <div className="cp-card-inner cp-card-inner-full" style={{ '--scrollbar-color': c.card.scrollbarColor }}>
                {/* Heading */}
                <h2
                  className={`cp-heading cp-reveal-element ${revealStep >= 1 ? 'visible' : ''}`}
                  style={{
                    color: c.card.headingColor,
                    fontFamily: `'${c.theme.fontFamily}', serif`,
                  }}
                >
                  {c.content.heading}
                </h2>

                {/* Media */}
                {primaryImage && (
                  <div
                    className={`cp-media-section cp-media-section-full cp-reveal-element ${revealStep >= 2 ? 'visible' : ''} ${revealStep >= 4 ? 'settled' : ''}`}
                    style={{
                      transitionDuration: hasFadeIn ? `${fadeSpeed}s` : '0.3s',
                    }}
                  >
                    <div className="cp-media-item cp-media-item-full">
                      <img src={primaryImage.url} alt={primaryImage.caption || ''} style={previewImageStyle} />
                    </div>
                    {primaryImage.caption && <p className="cp-caption cp-caption-full">{primaryImage.caption}</p>}
                  </div>
                )}

                {/* Body */}
                <div
                  className={`cp-body cp-reveal-element ${fadeBody && revealStep >= 3 ? 'visible' : ''}`}
                  style={{
                    color: c.card.textColor,
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
              style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}
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
              style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}
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
              style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}
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
              style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}
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
              style={{
                backgroundColor: c.card.backgroundColor,
                ...borderStyle,
              }}
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
            style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}
          >
            <div className="cp-end-icon" style={{ color: c.theme.accentColor }}>âœ“</div>
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
          <article className="cp-card cp-card-full cp-gift-intro" style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}>
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
          <article className="cp-card cp-card-full cp-gift-receive" style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}>
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

