import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { getEnvelopeTierProfile, getPacingMultiplier } from '../lib/envelopeTiers.js'
import { useDepthMotion } from '../lib/useDepthMotion.js'
import { SEAL_ICONS, deriveRecipientName } from '../lib/sealIcons.jsx'

const TIER_ALIASES = { simple: 'classic', special: 'premium', signature: 'elite' }
function normaliseTier(tier) {
  const key = String(tier || 'classic').toLowerCase()
  return TIER_ALIASES[key] || key
}

// Tilt only the parallax wrapper (one element's transform -- no subtree
// restyle) and slide the pre-blurred shadow layer against it, so the
// envelope reads as lit from a fixed point without re-blurring an 80px
// shadow every frame. Plain px offsets: the old calc(deg / 1deg * px)
// needed typed arithmetic, so browsers without it drew no shadow at all.
function applyEnvelopeTilt(scene, x, y) {
  const wrap = scene.querySelector('.envelope-parallax-wrap')
  if (wrap) wrap.style.transform = x || y ? `rotateY(${x}deg) rotateX(${y}deg)` : ''
  const shadow = scene.querySelector('.envelope-body-shadow')
  if (shadow) shadow.style.transform = `translate3d(${(x * -1.4).toFixed(1)}px, ${(y * 1.4).toFixed(1)}px, 0)`
}

function Envelope({
  cardObject,
  tier = 'classic',
  recipientEmail = '',
  onOpenComplete,
  onReplay,
  closing = false,
  onClosingComplete,
}) {
  const envelope = cardObject?.closedState?.envelope || {}
  const closed = cardObject?.closedState || {}
  const profile = useMemo(() => getEnvelopeTierProfile(normaliseTier(tier)), [tier])
  const pacing = getPacingMultiplier(envelope.pacing)

  const [stage, setStage] = useState('arriving')
  const sceneRef = useDepthMotion({ maxTilt: 12, disabled: !profile.parallax, apply: applyEnvelopeTilt })
  const chimeRef = useRef(null)
  const rustleRef = useRef(null)
  const crackRef = useRef(null)
  const mountedRef = useRef(true)
  const timersRef = useRef([])

  // Track mount so delayed setState calls from timers never fire after unmount
  // (the consumer unmounts on onOpenComplete).
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [])

  const safeSetStage = useCallback((next) => {
    if (mountedRef.current) setStage(next)
  }, [])

  const scheduleTimer = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id)
      if (mountedRef.current) fn()
    }, delay)
    timersRef.current.push(id)
    return id
  }, [])

  const recipientName = deriveRecipientName(envelope.recipientCaption, recipientEmail)
  const monogramLetter = recipientName ? recipientName.charAt(0).toUpperCase() : ''

  useEffect(() => {
    const id = scheduleTimer(() => safeSetStage('sealed'), 900 * pacing)
    return () => clearTimeout(id)
  }, [pacing, safeSetStage, scheduleTimer])

  useEffect(() => {
    if (stage !== 'sealed') return
    if (!profile.ambientAudio) return
    chimeRef.current?.play?.().catch(() => {})
  }, [stage, profile.ambientAudio])

  useEffect(() => {
    if (!closing || !profile.closingFold) return
    safeSetStage('closing')
    scheduleTimer(() => safeSetStage('resealed'), 1200 * pacing)
    scheduleTimer(() => onClosingComplete?.(), 1800 * pacing)
  }, [closing, profile.closingFold, pacing, onClosingComplete, safeSetStage, scheduleTimer])

  const handleUnseal = useCallback(() => {
    // Allow early tap during 'arriving' — reads as eager rather than unresponsive.
    if (stage !== 'sealed' && stage !== 'arriving') return
    safeSetStage('unsealing')
    if (profile.ambientAudio) {
      crackRef.current?.play?.().catch(() => {})
      scheduleTimer(() => rustleRef.current?.play?.().catch(() => {}), 150)
    }
    scheduleTimer(() => safeSetStage('opening'), 800 * pacing)
    scheduleTimer(() => {
      // Don't setStage here — the consumer typically unmounts on onOpenComplete.
      // Stage is irrelevant after the letter is out.
      onOpenComplete?.()
    }, 3200 * pacing)
  }, [stage, profile.ambientAudio, pacing, onOpenComplete, safeSetStage, scheduleTimer])

  const sceneClass = [
    'envelope-scene',
    `stage-${stage}`,
    `depth-${profile.depth || 'full'}`,
    profile.letterbox ? 'has-letterbox' : '',
    profile.reducedMotion ? 'reduced-motion' : '',
    closing ? 'is-closing' : '',
  ].filter(Boolean).join(' ')

  const sealIconKey = envelope.sealIcon || 'monogram'
  const showMonogram = envelope.showMonogram !== false && sealIconKey === 'monogram' && profile.monogram
  const sealContent = showMonogram
    ? <span className="envelope-seal-monogram">{monogramLetter || '♥'}</span>
    : SEAL_ICONS[sealIconKey] || SEAL_ICONS.wax

  const paperTextureClass = `paper-${envelope.paperTexture || 'smooth'}`

  return (
    <div className={sceneClass} ref={sceneRef}>
      {profile.letterbox && <div className="envelope-letterbox top" />}
      {profile.letterbox && <div className="envelope-letterbox bottom" />}
      <div className="envelope-vignette" />

      {profile.particles > 0 && (
        <div className="envelope-dust" aria-hidden="true">
          {Array.from({ length: profile.particles }).map((_, i) => (
            <span key={i} className={`envelope-dust-particle p${i + 1}`} />
          ))}
        </div>
      )}
      <div className="envelope-parallax-wrap">
        <div className="envelope-body-shadow" aria-hidden="true" />
        <div
          className={`envelope-body ${paperTextureClass} ${stage === 'sealed' || stage === 'arriving' ? 'is-tappable' : ''}`}
          style={{
            '--envelope-body': envelope.bodyColor || '#1a1f2c',
            '--envelope-flap': envelope.flapColor || '#242a38',
            '--envelope-border': closed.borderColor || 'rgba(126, 247, 255, 0.25)',
          }}
          // Whole-envelope hit target: tap anywhere to open, not only the seal.
          // The button below stays as the accessible/keyboard control; both
          // call handleUnseal which is idempotent (gated by stage).
          role="button"
          tabIndex={stage === 'sealed' || stage === 'arriving' ? 0 : -1}
          aria-label="Open envelope"
          onClick={handleUnseal}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleUnseal()
            }
          }}
        >
          <div className="envelope-inside-glow" />
          <div className="envelope-letter-peek" style={{ background: closed.backgroundColor || '#0e1218' }}>
            <p className="envelope-letter-heading" style={{ color: closed.headingColor, fontFamily: closed.headingFont }}>
              {closed.headingText}
            </p>
            <p className="envelope-letter-sub" style={{ color: closed.textColor }}>
              {closed.bodyText}
            </p>
          </div>
          <div className="envelope-flap" />
          {/* The seal's "tap me" pulse: a disc behind the seal that grows and
              fades, so only the ring outside the seal shows. Transform and
              opacity only -- it used to animate the seal's box-shadow, a
              repaint every frame while the envelope waits to be tapped. */}
          {(stage === 'sealed' || stage === 'arriving') && <span className="envelope-seal-pulse" aria-hidden="true" />}
          <span
            className={`envelope-seal ${stage === 'sealed' || stage === 'arriving' ? 'pulsing' : ''}`}
            style={{ '--seal-color': envelope.sealColor || '#b03030' }}
            aria-hidden="true"
          >
            {sealContent}
          </span>
        </div>
      </div>

      {stage === 'resealed' && profile.closingFold && onReplay && (
        <div className="envelope-keepsake">
          <button type="button" className="primary" onClick={onReplay}>
            Replay
          </button>
        </div>
      )}

      {profile.ambientAudio && (
        <>
          <audio ref={chimeRef} src="/audio/envelope/chime.mp3" preload="none" />
          <audio ref={rustleRef} src="/audio/envelope/rustle.mp3" preload="none" />
          <audio ref={crackRef} src="/audio/envelope/crack.mp3" preload="none" />
        </>
      )}
    </div>
  )
}

export default Envelope
