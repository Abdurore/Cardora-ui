import { useEffect, useRef } from 'react'

// Heart silhouette path — kept for GiftCard static icons (not used in the animation canvas)
const HEART_PATH =
  'M100 170s-66-45-88-78C-6 60 10 22 44 16c23-4 44 7 56 28 12-21 33-32 56-28 34 6 50 44 32 76-22 33-88 78-88 78z'

const HEART_SHAPE = 'heart'

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

// Inject static SVG path for GiftCard icons only — not used by the canvas animation
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
  const config = getGiftEffect(effect)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const lowPower = isLowPowerDevice()
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

    const baseCount = lowPower
      ? Math.min(95, Math.round(60 + config.intensity * 9))
      : Math.min(190, Math.round(118 + config.intensity * 16))
    const particleCount = baseCount

    // Radial burst — particles explode outward from center along their baseAngle
    const particles = Array.from({ length: particleCount }, (_, index) => {
      const angle = (index / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
      return {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        baseAngle: angle,
        maxRadius: (0.16 + Math.random() * 0.38) * Math.min(window.innerWidth, window.innerHeight),
        explodeForce: (2.8 + Math.random() * 1.6) * config.intensity,
        size: 1 + Math.random() * (1.8 + config.intensity * 0.28),
        glow: 8 + Math.random() * (6 + config.intensity * 3),
        opacity: 0.24 + Math.random() * 0.55,
      }
    })

    const initParticles = () => {
      const { x: cx, y: cy } = center()
      particles.forEach((p) => {
        p.x = cx + (Math.random() - 0.5) * 24
        p.y = cy + (Math.random() - 0.5) * 24
        p.vx = 0
        p.vy = 0
      })
    }

    initParticles()
    startRef.current = performance.now()

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

      ctx.fillStyle = `rgba(2, 2, 5, ${phase === 'glow' ? 0.09 : lowPower ? 0.22 : 0.15})`
      ctx.fillRect(0, 0, width(), height())

      const gradStart = config.gradient[1]
      const gradEnd = config.gradient[0]

      particles.forEach((p, index) => {
        if (phase === 'explode') {
          const boost = easeOutQuad(localProgress)
          const angle = p.baseAngle + Math.sin(totalProgress * Math.PI * 2 + index) * 0.18
          p.vx += Math.cos(angle) * p.explodeForce * 0.045 * boost
          p.vy += Math.sin(angle) * p.explodeForce * 0.045 * boost
        }

        if (phase === 'orbit') {
          const orbitAngle = p.baseAngle + time * 0.0018 * (0.8 + config.intensity * 0.1)
          const orbitR = p.maxRadius * (0.3 + localProgress * 0.35)
          const ox = cx + Math.cos(orbitAngle) * orbitR
          const oy = cy + Math.sin(orbitAngle) * orbitR
          p.vx += (ox - p.x) * 0.014
          p.vy += (oy - p.y) * 0.014
        }

        if (phase === 'form' || config.phases.includes('form')) {
          // Pull toward a radial position at ~55% of maxRadius
          const tx = cx + Math.cos(p.baseAngle) * p.maxRadius * 0.55
          const ty = cy + Math.sin(p.baseAngle) * p.maxRadius * 0.55
          const force = phase === 'form' ? 0.028 : 0.008
          p.vx += (tx - p.x) * force
          p.vy += (ty - p.y) * force
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
          background: rgba(4, 8, 10, 0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          overflow: hidden;
          z-index: 10000;
        }
        .gift-canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
      `}</style>
      <canvas ref={canvasRef} className="gift-canvas" />
    </div>
  )
}

export default PremiumGiftReveal
