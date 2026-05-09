import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'

// Heart silhouette path — used for ALL gift packages so the reveal feels
// consistent across the catalog. Differentiation comes from colour, intensity,
// and duration rather than shape.
const HEART_PATH =
  'M100 170s-66-45-88-78C-6 60 10 22 44 16c23-4 44 7 56 28 12-21 33-32 56-28 34 6 50 44 32 76-22 33-88 78-88 78z'

const HEART_SHAPE = 'heart'

// Gradient pairs differentiate each package visually. Order roughly follows
// price tiers — lower tiers use softer pinks, higher tiers move into rich
// jewel tones.
const EFFECTS = {
  heart: {
    gradient: ['#ff6b9d', '#ff4f98'],
    price: 2,
    phases: ['form'],
    duration: 1500,
    intensity: 1,
  },
  diamond: {
    gradient: ['#5de0ff', '#7b82ff'],
    price: 3,
    phases: ['explode', 'form'],
    duration: 1800,
    intensity: 1.2,
  },
  rose: {
    gradient: ['#7b0016', '#ff4f98'],
    price: 5,
    phases: ['explode', 'form'],
    duration: 2200,
    intensity: 1.45,
  },
  star: {
    gradient: ['#ffd56a', '#ff7ad1'],
    price: 7,
    phases: ['explode', 'form'],
    duration: 2500,
    intensity: 1.7,
  },
  orb: {
    gradient: ['#7ef7ff', '#62ffa2'],
    price: 10,
    phases: ['orbit', 'form'],
    duration: 3000,
    intensity: 2,
  },
  ring: {
    gradient: ['#ffe07a', '#ff9bd2'],
    price: 30,
    phases: ['orbit', 'form'],
    duration: 3400,
    intensity: 2.4,
  },
  candle: {
    gradient: ['#ffce7a', '#ff7ad1'],
    price: 50,
    phases: ['explode', 'orbit', 'form'],
    duration: 3800,
    intensity: 2.8,
  },
  christmas_tree: {
    gradient: ['#3cffb1', '#7ef7ff'],
    price: 60,
    phases: ['explode', 'orbit', 'form'],
    duration: 4100,
    intensity: 3.1,
  },
  crescent_moon: {
    gradient: ['#ffe59a', '#ffd1f0'],
    price: 80,
    phases: ['orbit', 'form', 'glow'],
    duration: 4400,
    intensity: 3.35,
  },
  meteorite: {
    gradient: ['#ff9bd2', '#7ef7ff'],
    price: 99,
    phases: ['explode', 'orbit', 'form', 'glow'],
    duration: 4700,
    intensity: 3.7,
  },
  necklace: {
    gradient: ['#ffd56a', '#7ef7ff'],
    price: 150,
    phases: ['explode', 'orbit', 'form', 'glow'],
    duration: 5200,
    intensity: 4,
  },
}

// All effects render the heart silhouette. Inject the shared shape/path so
// downstream code (icons, mappers) reads them as before without changes.
Object.values(EFFECTS).forEach((effect) => {
  effect.path = HEART_PATH
  effect.shape = HEART_SHAPE
})

export const giftConfigs = Object.values(EFFECTS).reduce((acc, effect) => {
  acc[effect.price] = {
    shape: effect.shape,
    phases: effect.phases,
    duration: effect.duration,
    intensity: effect.intensity,
  }
  return acc
}, {})

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t)

export const getGiftEffect = (key) => EFFECTS[key] || EFFECTS.heart

function phaseProgress(elapsed, config) {
  const phases = config.phases
  const phaseDuration = config.duration / phases.length
  const phaseIndex = Math.min(phases.length - 1, Math.floor(elapsed / phaseDuration))
  const raw = Math.min(1, Math.max(0, (elapsed - phaseIndex * phaseDuration) / phaseDuration))
  return {
    phase: phases[phaseIndex],
    phaseIndex,
    phaseDuration,
    localProgress: easeInOutCubic(raw),
    totalProgress: Math.min(1, elapsed / config.duration),
  }
}

// Heart parametric curve — i ∈ [0, 2π) returns a point on the canonical heart.
function heartPoint(t, centerX, centerY, scale) {
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
  return { x: centerX + x * scale, y: centerY + y * scale }
}

// Detect lower-power devices to throttle particle count and effects.
function isLowPowerDevice() {
  if (typeof window === 'undefined') return false
  const cores = navigator.hardwareConcurrency || 4
  const narrow = window.innerWidth < 768
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return narrow || cores <= 4 || reduceMotion
}

function PremiumGiftReveal({ effect = 'heart', onComplete }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const rotation = useMemo(() => (Math.random() * 10 - 5).toFixed(2), [])
  const config = getGiftEffect(effect)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const lowPower = isLowPowerDevice()
    // Cap DPR on small screens to avoid drawing 3x retina cost on phones.
    const maxDpr = lowPower ? 1.5 : 2
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)

    const resize = () => {
      const { innerWidth, innerHeight } = window
      canvas.width = innerWidth * dpr
      canvas.height = innerHeight * dpr
      canvas.style.width = `${innerWidth}px`
      canvas.style.height = `${innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const width = () => window.innerWidth
    const height = () => window.innerHeight
    const center = () => ({ x: width() / 2, y: height() / 2 })

    // Particle count scales with intensity but is capped lower on mobile so
    // weaker GPUs (mid-range Android, older iPhones) stay above 30fps.
    const baseCount = lowPower
      ? Math.min(95, Math.round(60 + config.intensity * 9))
      : Math.min(190, Math.round(118 + config.intensity * 16))
    const particleCount = baseCount

    const particles = Array.from({ length: particleCount }, (_, index) => {
      const angle = (index / particleCount) * Math.PI * 2
      return {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle,
        orbitRadius: 18 + Math.random() * (16 + config.intensity * 12),
        targetAngle: Math.random() * Math.PI * 2,
        size: 1 + Math.random() * (1.8 + config.intensity * 0.28),
        glow: 8 + Math.random() * (6 + config.intensity * 3),
        opacity: 0.24 + Math.random() * 0.55,
      }
    })

    const initParticles = () => {
      const { x: cx, y: cy } = center()
      const scale = Math.min(width(), height()) / 42
      particles.forEach((p, index) => {
        const target = heartPoint((index / particleCount) * Math.PI * 2, cx, cy, scale)
        p.x = cx
        p.y = cy
        p.tx = target.x
        p.ty = target.y
        p.vx = 0
        p.vy = 0
        p.baseAngle = Math.atan2(target.y - cy, target.x - cx)
        p.explodeForce = (2.8 + Math.random() * 1.6) * config.intensity
      })
    }

    initParticles()
    startRef.current = performance.now()

    // Throttle to ~50fps on low-power devices to free up the main thread for
    // the surrounding card stage (Framer Motion + DOM reflow on the heart SVG).
    const minFrameMs = lowPower ? 20 : 0
    let lastFrame = 0

    const tick = (time) => {
      if (time - lastFrame < minFrameMs) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      lastFrame = time

      const elapsed = time - startRef.current
      const { phase, localProgress, totalProgress } = phaseProgress(elapsed, config)
      const { x: cx, y: cy } = center()
      const scale = Math.min(width(), height()) / 42

      // Lighter trail-clear on mobile keeps the canvas from accumulating noise
      // when frames are dropped.
      ctx.fillStyle = `rgba(2, 2, 5, ${phase === 'glow' ? 0.09 : (lowPower ? 0.22 : 0.15)})`
      ctx.fillRect(0, 0, width(), height())

      // Build the radial gradient once per frame — creating it inside the
      // particle loop allocated 200+ gradient objects per frame.
      // We still need per-particle radial centers, so keep colour stops here
      // and reuse the gradient pair.
      const gradStart = config.gradient[1]
      const gradEnd = config.gradient[0]

      particles.forEach((p, index) => {
        const target = heartPoint((index / particleCount) * Math.PI * 2, cx, cy, scale)
        p.tx = target.x
        p.ty = target.y

        if (phase === 'explode') {
          const boost = easeOutQuad(localProgress)
          const angle = p.baseAngle + Math.sin(totalProgress * Math.PI * 2 + index) * 0.18
          p.vx += Math.cos(angle) * p.explodeForce * 0.045 * boost
          p.vy += Math.sin(angle) * p.explodeForce * 0.045 * boost
        }

        if (phase === 'orbit') {
          const orbitAngle = time * 0.0018 * (0.8 + config.intensity * 0.1) + p.baseAngle
          const orbitRadius = p.orbitRadius * (0.9 + localProgress * 0.4)
          const ox = cx + Math.cos(orbitAngle) * orbitRadius
          const oy = cy + Math.sin(orbitAngle) * orbitRadius
          p.vx += (ox - p.x) * 0.014
          p.vy += (oy - p.y) * 0.014
        }

        if (phase === 'form' || config.phases.includes('form')) {
          const force = phase === 'form' ? 0.028 : 0.008
          p.vx += (p.tx - p.x) * force
          p.vy += (p.ty - p.y) * force
        }

        p.vx *= phase === 'glow' ? 0.82 : 0.9
        p.vy *= phase === 'glow' ? 0.82 : 0.9
        p.x += p.vx
        p.y += p.vy

        const glowBoost = phase === 'glow' ? 1 + localProgress * 1.5 : 1
        const alpha = phase === 'glow'
          ? Math.max(0.18, (1 - totalProgress) * 1.2)
          : Math.max(0.22, 0.35 + localProgress * 0.4)

        ctx.save()
        ctx.globalAlpha = alpha * p.opacity
        // Heavy shadowBlur is expensive on mobile GPUs — disable on low-power.
        if (!lowPower) {
          ctx.shadowBlur = p.glow * glowBoost
          ctx.shadowColor = gradStart
        }
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6)
        gradient.addColorStop(0, gradStart)
        gradient.addColorStop(1, gradEnd)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * glowBoost, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      if (elapsed < config.duration + 260) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        onComplete?.()
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [config, onComplete])

  return (
    <div className="premium-gift-reveal">
      <style>{`
        .premium-gift-reveal {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(4, 8, 10, 0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          overflow: hidden;
          z-index: 10000;
        }

        .premium-gift-reveal::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(255, 107, 157, 0.12), transparent 60%);
          pointer-events: none;
        }

        .gift-canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .gift-stage {
          position: relative;
          width: min(220px, 64vw);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          will-change: transform, opacity;
        }

        .gift-shadow {
          position: absolute;
          width: 65%;
          height: 25%;
          background: radial-gradient(circle, rgba(0, 0, 0, 0.6), transparent 70%);
          bottom: 6%;
          filter: blur(10px);
          transform: translateY(40px);
          opacity: 0.7;
        }

        .gift-glow {
          position: absolute;
          inset: 0;
          filter: blur(20px);
          opacity: 0.55;
          transform: scale(1.2);
        }

        .gift-main {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.45));
        }

        .gift-sweep {
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%);
          mix-blend-mode: screen;
          filter: blur(4px);
          opacity: 0.7;
          transform: translateX(-120%) skewX(-20deg);
          pointer-events: none;
        }
      `}</style>
      <canvas ref={canvasRef} className="gift-canvas" />
      <motion.div
        className="gift-stage"
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: 1,
          scale: [0, 1.15, 1],
          rotate: [rotation, 0],
        }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="gift-shadow" />
        <motion.svg className="gift-glow" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient id={`giftGlow-${effect}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={config.gradient[0]} />
              <stop offset="100%" stopColor={config.gradient[1]} />
            </linearGradient>
          </defs>
          <path d={config.path} fill={`url(#giftGlow-${effect})`} />
        </motion.svg>
        <motion.svg
          className="gift-main"
          viewBox="0 0 200 200"
          aria-hidden="true"
          initial={{ y: 0 }}
          animate={{ y: [0, -6, 0], scale: [1, 1.04, 1] }}
          transition={{
            delay: 0.5,
            duration: 1.1 + config.intensity * 0.12,
            ease: [0.34, 1.56, 0.64, 1],
            repeat: Infinity,
            repeatType: 'mirror',
          }}
        >
          <defs>
            <linearGradient id={`giftGradient-${effect}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={config.gradient[0]} />
              <stop offset="100%" stopColor={config.gradient[1]} />
            </linearGradient>
            <radialGradient id={`giftHighlight-${effect}`} cx="30%" cy="20%" r="60%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <path d={config.path} fill={`url(#giftGradient-${effect})`} />
          <path d={config.path} fill={`url(#giftHighlight-${effect})`} />
        </motion.svg>
        <motion.div
          className="gift-sweep"
          animate={{ x: ['-120%', '120%'] }}
          transition={{ duration: 1.6, delay: 0.6, ease: 'easeInOut' }}
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: config.duration / 1000, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  )
}

export default PremiumGiftReveal
