import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'
import PremiumGiftReveal from './PremiumGiftReveal.jsx'

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

function CardPreviewModal({ cardObject, onClose }) {
  const [stage, setStage] = useState('closed') // closed, opening, open, questions, end, giftIntro, giftReveal, giftReceive
  const [questionIdx, setQuestionIdx] = useState(0)
  const [fadeBody, setFadeBody] = useState(false)
  const [bodyVisible, setBodyVisible] = useState(false)
  const audioRef = useRef(null)
  const containerRef = useRef(null)

  const c = cardObject
  const hasQuestions = c.questions.items.length > 0
  const hasGift = c.giftEffect?.enabled && c.giftEffect?.effectKey && c.giftEffect.effectKey !== 'none'
  const hasFadeIn = c.card.textBodyAnimation.fadeInDuration !== 'none'
  const hasTypewriter = c.card.textBodyAnimation.selfTypeSpeed !== 'none'
  const typeSpeed = hasTypewriter ? parseFloat(c.card.textBodyAnimation.selfTypeSpeed) || 2 : 2
  const fadeSpeed = hasFadeIn ? parseFloat(c.card.textBodyAnimation.fadeInDuration) || 2 : 0

  const typedBody = useTypewriter(c.content.body, typeSpeed, stage === 'open' && hasTypewriter)
  const typedExtended = useTypewriter(c.content.extendedBody, typeSpeed, stage === 'open' && hasTypewriter && typedBody === c.content.body)

  // Music
  useEffect(() => {
    if (c.background.music.url && audioRef.current) {
      audioRef.current.volume = c.background.music.volume
      audioRef.current.play().catch(() => {})
    }
    return () => { if (audioRef.current) audioRef.current.pause() }
  }, [c.background.music.url, c.background.music.volume])

  // Confetti
  const fireConfetti = useCallback(() => {
    if (c.animation.openEffect !== 'confetti') return
    const colors = c.animation.confettiColors.length > 0
      ? c.animation.confettiColors
      : ['#76efff', '#62ffa2', '#ff9bd2']
    const end = Date.now() + 1800
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        zIndex: 100001,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        zIndex: 100001,
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }, [c.animation.openEffect, c.animation.confettiColors])

  const handleOpen = () => {
    setStage('opening')
    fireConfetti()
    setTimeout(() => {
      setStage('open')
      setBodyVisible(false)
      if (hasFadeIn) {
        setTimeout(() => setFadeBody(true), 200)
        setTimeout(() => setBodyVisible(true), 300)
      } else {
        setFadeBody(true)
        setBodyVisible(true)
      }
    }, 600)
  }

  const handleContinue = () => {
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

  // Closed-state button shape
  const shapeMap = { rounded: '14px', pill: '999px', square: '6px', sharp: '0px' }
  const btnRadius = shapeMap[c.closedState.button.shape] || '999px'

  // Memoize particle positions
  const particlePositions = useMemo(() =>
    Array.from({ length: 18 }).map(() => ({
      left: `${5 + Math.random() * 90}%`,
      top: `${5 + Math.random() * 90}%`,
      delay: `${-Math.random() * 8}s`,
      size: `${14 + Math.random() * 14}px`,
    })),
  [])

  // Background effect emojis
  const renderBgEffect = () => {
    const eff = c.animation.backgroundEffect
    if (eff.type === 'none') return null
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

  return createPortal(
    <section className="cp-overlay" ref={containerRef}>
      <div className="cp-backdrop" style={bgStyle}>
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

      {/* CLOSED STATE */}
      {stage === 'closed' && (
        <div
          className="cp-closed-card"
          style={{
            backgroundColor: c.closedState.backgroundColor,
            border: `2px solid ${c.closedState.borderColor}`,
          }}
        >
          <h2
            style={{
              color: c.closedState.headingColor,
              fontFamily: `'${c.closedState.headingFont}', serif`,
            }}
          >
            {c.closedState.headingText}
          </h2>
          <p style={{ color: c.closedState.textColor }}>
            {c.closedState.bodyText}
          </p>
          <button
            className="cp-open-btn"
            style={{
              backgroundColor: c.closedState.button.backgroundColor,
              color: c.closedState.button.textColor,
              border: `1.5px solid ${c.closedState.button.borderColor}`,
              borderRadius: btnRadius,
            }}
            onClick={handleOpen}
          >
            {c.closedState.button.text}
          </button>
        </div>
      )}

      {/* OPENING ANIMATION */}
      {stage === 'opening' && (
        <div className="cp-opening">
          <div className="cp-opening-ring" style={{ borderColor: c.theme.accentColor }} />
          <div className="cp-opening-ring r2" style={{ borderColor: c.theme.accentColor }} />
        </div>
      )}

      {/* OPEN CARD */}
      {stage === 'open' && (
        <div className="cp-card-wrap">
          {renderGradientBorder(
            <article
              className="cp-card"
              style={{
                backgroundColor: c.card.backgroundColor,
                ...borderStyle,
                '--scrollbar-color': c.card.scrollbarColor,
              }}
            >
              <div className="cp-card-inner" style={{ '--scrollbar-color': c.card.scrollbarColor }}>
                {/* Media */}
                {c.media.images.length > 0 && (
                  <div className="cp-media-section">
                    {c.media.images.map((img, i) => (
                      <div key={i} className="cp-media-item">
                        <img src={img.url} alt={img.caption || ''} />
                        {img.caption && <p className="cp-caption">{img.caption}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Heading */}
                <h2
                  className="cp-heading"
                  style={{
                    color: c.card.headingColor,
                    fontFamily: `'${c.theme.fontFamily}', serif`,
                  }}
                >
                  {c.content.heading}
                </h2>

                {/* Body */}
                <div
                  className={`cp-body ${fadeBody ? 'visible' : ''}`}
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
                  className="cp-continue-btn"
                  style={{
                    backgroundColor: c.theme.accentColor,
                    color: c.card.backgroundColor,
                  }}
                  onClick={handleContinue}
                >
                  {hasQuestions ? 'Continue' : 'Done'}
                </button>
              </div>
            </article>
          )}
        </div>
      )}

      {/* QUESTIONS */}
      {stage === 'questions' && c.questions.items[questionIdx] && (
        <div className="cp-card-wrap">
          <article
            className="cp-card cp-question-card"
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
          </article>
        </div>
      )}

      {/* END */}
      {stage === 'end' && (
        <div className="cp-card-wrap">
          <article
            className="cp-card cp-end-card"
            style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}
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

      {/* GIFT INTRO — suspenseful text */}
      {stage === 'giftIntro' && (
        <div className="cp-card-wrap">
          <article className="cp-card cp-gift-intro" style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}>
            <div className="cp-gift-sparkle">🎁</div>
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

      {/* GIFT REVEAL — PremiumGiftReveal animation */}
      {stage === 'giftReveal' && (
        <PremiumGiftReveal
          effect={c.giftEffect.effectKey}
          onComplete={() => setStage('giftReceive')}
        />
      )}

      {/* GIFT RECEIVE — claim option (dummy) */}
      {stage === 'giftReceive' && (
        <div className="cp-card-wrap">
          <article className="cp-card cp-gift-receive" style={{ backgroundColor: c.card.backgroundColor, ...borderStyle }}>
            <div className="cp-gift-received-icon">🎉</div>
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
                onClick={() => { /* Dummy — future: claim via backend */ }}
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
