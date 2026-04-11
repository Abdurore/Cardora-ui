import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { getEnvelopeTierProfile, getPacingMultiplier } from '../lib/envelopeTiers.js'

const SEAL_ICONS = {
  heart: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s-7.5-4.8-7.5-11a4.5 4.5 0 0 1 8.25-2.5A4.5 4.5 0 0 1 21 10c0 6.2-9 11-9 11z" fill="currentColor" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l2.9 6.6 7.1.7-5.4 4.9 1.6 7L12 17.8 5.8 21.2l1.6-7L2 9.3l7.1-.7z" fill="currentColor" />
    </svg>
  ),
  wax: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="currentColor" />
    </svg>
  ),
}

function deriveRecipientName(explicit, email) {
  if (explicit) return explicit
  if (!email || typeof email !== 'string') return ''
  const local = email.split('@')[0] || ''
  if (!local) return ''
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function Envelope({
  cardObject,
  tier = 'simple',
  recipientEmail = '',
  onOpenComplete,
  onReplay,
  closing = false,
  onClosingComplete,
}) {
  const envelope = cardObject?.closedState?.envelope || {}
  const closed = cardObject?.closedState || {}
  const profile = useMemo(() => getEnvelopeTierProfile(tier), [tier])
  const pacing = getPacingMultiplier(envelope.pacing)

  const [stage, setStage] = useState('arriving')
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const rafRef = useRef(null)
  const pendingTilt = useRef({ x: 0, y: 0 })
  const sceneRef = useRef(null)
  const chimeRef = useRef(null)
  const rustleRef = useRef(null)
  const crackRef = useRef(null)

  const recipientName = deriveRecipientName(envelope.recipientCaption, recipientEmail)
  const monogramLetter = recipientName ? recipientName.charAt(0).toUpperCase() : ''

  useEffect(() => {
    const t = setTimeout(() => setStage('sealed'), 900 * pacing)
    return () => clearTimeout(t)
  }, [pacing])

  useEffect(() => {
    if (stage !== 'sealed') return
    if (!profile.ambientAudio) return
    chimeRef.current?.play?.().catch(() => {})
  }, [stage, profile.ambientAudio])

  useEffect(() => {
    if (!profile.parallax) return
    const handler = (e) => {
      if (!sceneRef.current) return
      const rect = sceneRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / rect.width
      const dy = (e.clientY - cy) / rect.height
      pendingTilt.current = { x: Math.max(-1, Math.min(1, dx)) * 10, y: Math.max(-1, Math.min(1, dy)) * -8 }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          setTilt(pendingTilt.current)
          rafRef.current = null
        })
      }
    }
    window.addEventListener('mousemove', handler)
    return () => {
      window.removeEventListener('mousemove', handler)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [profile.parallax])

  useEffect(() => {
    if (!closing || !profile.closingFold) return
    setStage('closing')
    const t1 = setTimeout(() => setStage('resealed'), 1200 * pacing)
    const t2 = setTimeout(() => onClosingComplete?.(), 1800 * pacing)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [closing, profile.closingFold, pacing, onClosingComplete])

  const handleUnseal = useCallback(() => {
    if (stage !== 'sealed') return
    setStage('unsealing')
    if (profile.ambientAudio) {
      crackRef.current?.play?.().catch(() => {})
      setTimeout(() => rustleRef.current?.play?.().catch(() => {}), 150)
    }
    setTimeout(() => setStage('opening'), 800 * pacing)
    setTimeout(() => {
      setStage('letterOut')
      onOpenComplete?.()
    }, 1500 * pacing)
  }, [stage, profile.ambientAudio, pacing, onOpenComplete])

  const sceneClass = [
    'envelope-scene',
    `stage-${stage}`,
    profile.letterbox ? 'has-letterbox' : '',
    profile.reducedMotion ? 'reduced-motion' : '',
    closing ? 'is-closing' : '',
  ].filter(Boolean).join(' ')

  const parallaxStyle = profile.parallax
    ? { transform: `rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }
    : undefined

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

      {profile.caption && recipientName && (
        <p className="envelope-caption">For {recipientName},</p>
      )}

      <div className="envelope-parallax-wrap" style={parallaxStyle}>
        <div
          className={`envelope-body ${paperTextureClass}`}
          style={{
            '--envelope-body': envelope.bodyColor || '#1a1f2c',
            '--envelope-flap': envelope.flapColor || '#242a38',
            '--envelope-border': closed.borderColor || 'rgba(126, 247, 255, 0.25)',
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
          <button
            type="button"
            className={`envelope-seal ${stage === 'sealed' ? 'pulsing' : ''}`}
            style={{ '--seal-color': envelope.sealColor || '#b03030' }}
            onClick={handleUnseal}
            aria-label="Open envelope"
            disabled={stage !== 'sealed'}
          >
            {sealContent}
          </button>
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
