import { useEffect, useRef } from 'react'

// Heart silhouette path — kept for GiftCard static icons only
const HEART_PATH =
  'M100 170s-66-45-88-78C-6 60 10 22 44 16c23-4 44 7 56 28 12-21 33-32 56-28 34 6 50 44 32 76-22 33-88 78-88 78z'

const HEART_SHAPE = 'heart'

const EFFECTS = {
  tiny: {
    gradient: ['#9ca3af', '#6b7280'],
    label: 'Tiny Heart',
    color: 'Gray',
    meaning: 'Small appreciation',
    price: 500,
    currency: '₦',
    phases: ['form'],
    duration: 1500,
    intensity: 1,
  },
  sweet: {
    gradient: ['#f9a8d4', '#ec4899'],
    label: 'Sweet Heart',
    color: 'Pink',
    meaning: 'Sweet gesture',
    price: 1000,
    currency: '₦',
    phases: ['explode', 'form'],
    duration: 1800,
    intensity: 1.2,
  },
  purple: {
    gradient: ['#c084fc', '#7c3aed'],
    label: 'Purple Love',
    color: 'Purple',
    meaning: 'Admiration',
    price: 2000,
    currency: '₦',
    phases: ['explode', 'form'],
    duration: 2200,
    intensity: 1.45,
  },
  ocean: {
    gradient: ['#60a5fa', '#2563eb'],
    label: 'Ocean Heart',
    color: 'Blue',
    meaning: 'Thoughtful gift',
    price: 3000,
    currency: '₦',
    phases: ['explode', 'form'],
    duration: 2500,
    intensity: 1.7,
  },
  emerald: {
    gradient: ['#34d399', '#059669'],
    label: 'Emerald Heart',
    color: 'Green',
    meaning: 'Special gift',
    price: 5000,
    currency: '₦',
    phases: ['orbit', 'form'],
    duration: 3000,
    intensity: 2,
  },
  passion: {
    gradient: ['#f87171', '#dc2626'],
    label: 'Passion Heart',
    color: 'Red',
    meaning: 'Romantic gift',
    price: 10000,
    currency: '₦',
    phases: ['orbit', 'form'],
    duration: 3400,
    intensity: 2.4,
  },
  golden: {
    gradient: ['#fbbf24', '#d97706'],
    label: 'Golden Heart',
    color: 'Gold',
    meaning: 'Premium gift',
    price: 20000,
    currency: '₦',
    phases: ['explode', 'orbit', 'form'],
    duration: 3800,
    intensity: 2.8,
  },
  crystal: {
    gradient: ['#22d3ee', '#06b6d4'],
    label: 'Crystal Heart',
    color: 'Cyan',
    meaning: 'Luxury gift',
    price: 50000,
    currency: '₦',
    phases: ['explode', 'orbit', 'form'],
    duration: 4100,
    intensity: 3.1,
  },
  diamond: {
    gradient: ['#e2e8f0', '#94a3b8'],
    label: 'Diamond Heart',
    color: 'Silver',
    meaning: 'Elite gift',
    price: 100000,
    currency: '₦',
    phases: ['orbit', 'form', 'glow'],
    duration: 4400,
    intensity: 3.35,
  },
  legendary: {
    gradient: ['#f472b6', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
    label: 'Legendary Heart',
    color: 'Rainbow',
    meaning: 'Legendary gift',
    price: 200000,
    currency: '₦',
    phases: ['explode', 'orbit', 'form', 'glow'],
    duration: 5200,
    intensity: 4,
  },
}

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

export const getGiftEffect = (key) => EFFECTS[key] || EFFECTS.tiny

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

// Heart parametric curve — particles target positions on this curve
function heartPoint(t, centerX, centerY, scale) {
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
  return { x: centerX + x * scale, y: centerY + y * scale }
}

function isLowPowerDevice() {
  if (typeof window === 'undefined') return false
  const cores = navigator.hardwareConcurrency || 4
  const narrow = window.innerWidth < 768
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return narrow || cores <= 4 || reduceMotion
}

function PremiumGiftReveal({ effect = 'spark', onComplete }) {
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

      ctx.fillStyle = `rgba(2, 2, 5, ${phase === 'glow' ? 0.09 : lowPower ? 0.22 : 0.15})`
      ctx.fillRect(0, 0, width(), height())

      // For rainbow (multi-stop) gradients, each particle picks its own color segment
      const isRainbow = config.gradient.length > 2
      const getParticleColors = (idx) => {
        if (!isRainbow) return { start: config.gradient[1], end: config.gradient[0] }
        const colorIdx = idx % (config.gradient.length - 1)
        return { start: config.gradient[colorIdx + 1], end: config.gradient[colorIdx] }
      }

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

        const { start: gradStart, end: gradEnd } = getParticleColors(index)

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
