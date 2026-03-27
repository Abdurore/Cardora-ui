import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'

const EFFECTS = {
  heart: {
    gradient: ['#7b0016', '#ff4f98'],
    path:
      'M100 170s-66-45-88-78C-6 60 10 22 44 16c23-4 44 7 56 28 12-21 33-32 56-28 34 6 50 44 32 76-22 33-88 78-88 78z',
    price: 2,
    shape: 'heart',
    phases: ['form'],
    duration: 1500,
    intensity: 1,
  },
  diamond: {
    gradient: ['#5de0ff', '#7b82ff'],
    path: 'M100 10 L170 70 L100 170 L30 70 Z M100 10 L140 70 L100 170 L60 70 Z',
    price: 3,
    shape: 'diamond',
    phases: ['explode', 'form'],
    duration: 1800,
    intensity: 1.2,
  },
  rose: {
    gradient: ['#7b0016', '#ff4f98'],
    path:
      'M100 20 C140 10 170 40 160 80 C150 120 110 150 100 170 C90 150 50 120 40 80 C30 40 60 10 100 20 Z',
    price: 5,
    shape: 'heart',
    phases: ['explode', 'form'],
    duration: 2200,
    intensity: 1.45,
  },
  star: {
    gradient: ['#ffd56a', '#ff7ad1'],
    path: 'M100 15 L122 70 L180 70 L132 108 L150 165 L100 132 L50 165 L68 108 L20 70 L78 70 Z',
    price: 7,
    shape: 'star',
    phases: ['explode', 'form'],
    duration: 2500,
    intensity: 1.7,
  },
  orb: {
    gradient: ['#7ef7ff', '#62ffa2'],
    path: 'M100 20 A80 80 0 1 0 100 180 A80 80 0 1 0 100 20 Z',
    price: 10,
    shape: 'ring',
    phases: ['orbit', 'form'],
    duration: 3000,
    intensity: 2,
  },
  ring: {
    gradient: ['#ffe07a', '#ff9bd2'],
    path:
      'M100 30 A70 70 0 1 0 100 170 A70 70 0 1 0 100 30 Z M100 55 A45 45 0 1 1 100 145 A45 45 0 1 1 100 55 Z',
    price: 30,
    shape: 'ring',
    phases: ['orbit', 'form'],
    duration: 3400,
    intensity: 2.4,
  },
  candle: {
    gradient: ['#ffce7a', '#ff7ad1'],
    path: 'M80 60 Q100 20 120 60 Z M70 60 L130 60 L120 170 L80 170 Z',
    price: 50,
    shape: 'diamond',
    phases: ['explode', 'orbit', 'form'],
    duration: 3800,
    intensity: 2.8,
  },
  christmas_tree: {
    gradient: ['#3cffb1', '#7ef7ff'],
    path:
      'M100 20 L145 80 L120 80 L160 130 L130 130 L170 180 L30 180 L70 130 L40 130 L80 80 L55 80 Z',
    price: 60,
    shape: 'star',
    phases: ['explode', 'orbit', 'form'],
    duration: 4100,
    intensity: 3.1,
  },
  crescent_moon: {
    gradient: ['#ffe59a', '#ffd1f0'],
    path: 'M120 20 A70 70 0 1 0 120 180 A50 50 0 1 1 120 20 Z',
    price: 80,
    shape: 'ring',
    phases: ['orbit', 'form', 'glow'],
    duration: 4400,
    intensity: 3.35,
  },
  meteorite: {
    gradient: ['#ff9bd2', '#7ef7ff'],
    path: 'M140 40 L180 60 L120 120 L60 100 L80 40 Z',
    price: 99,
    shape: 'diamond',
    phases: ['explode', 'orbit', 'form', 'glow'],
    duration: 4700,
    intensity: 3.7,
  },
  necklace: {
    gradient: ['#ffd56a', '#7ef7ff'],
    path:
      'M40 70 A60 60 0 0 0 160 70 L150 100 A50 50 0 0 1 50 100 Z M90 100 L110 100 L100 130 Z',
    price: 150,
    shape: 'ring',
    phases: ['explode', 'orbit', 'form', 'glow'],
    duration: 5200,
    intensity: 4,
  },
}

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

export const getGiftEffect = (key) => EFFECTS[key] || EFFECTS.diamond

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

function getTargetPoint(shape, t, centerX, centerY, scale) {
  if (shape === 'star') {
    const spikes = 5
    const outer = scale * 17
    const inner = scale * 8
    const angle = t - Math.PI / 2
    const radius = Math.floor((t / Math.PI) * spikes) % 2 === 0 ? outer : inner
    return { x: centerX + Math.cos(angle * spikes) * radius, y: centerY + Math.sin(angle * spikes) * radius }
  }

  if (shape === 'ring') {
    const radius = scale * 15
    return { x: centerX + Math.cos(t) * radius, y: centerY + Math.sin(t) * radius }
  }

  if (shape === 'diamond') {
    const radius = scale * 15
    const angle = t % (Math.PI * 2)
    const x = Math.cos(angle)
    const y = Math.sin(angle)
    const factor = radius / (Math.abs(x) + Math.abs(y))
    return { x: centerX + x * factor, y: centerY + y * factor }
  }

  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
  return { x: centerX + x * scale, y: centerY + y * scale }
}

function PremiumGiftReveal({ effect = 'diamond', onComplete }) {
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

    const resize = () => {
      const { innerWidth, innerHeight, devicePixelRatio } = window
      canvas.width = innerWidth * devicePixelRatio
      canvas.height = innerHeight * devicePixelRatio
      canvas.style.width = `${innerWidth}px`
      canvas.style.height = `${innerHeight}px`
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const width = () => window.innerWidth
    const height = () => window.innerHeight
    const center = () => ({ x: width() / 2, y: height() / 2 })
    const particleCount = Math.min(190, Math.round(118 + config.intensity * 16))
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
        const target = getTargetPoint(config.shape, (index / particleCount) * Math.PI * 2, cx, cy, scale)
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

    const tick = (time) => {
      const elapsed = time - startRef.current
      const { phase, localProgress, totalProgress } = phaseProgress(elapsed, config)
      const { x: cx, y: cy } = center()
      const scale = Math.min(width(), height()) / 42

      ctx.fillStyle = `rgba(2, 2, 5, ${phase === 'glow' ? 0.09 : 0.15})`
      ctx.fillRect(0, 0, width(), height())

      particles.forEach((p, index) => {
        const target = getTargetPoint(config.shape, (index / particleCount) * Math.PI * 2, cx, cy, scale)
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
        ctx.shadowBlur = p.glow * glowBoost
        ctx.shadowColor = config.gradient[1]
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6)
        gradient.addColorStop(0, config.gradient[1])
        gradient.addColorStop(1, config.gradient[0])
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
          background: radial-gradient(circle at center, rgba(118, 239, 255, 0.12), transparent 60%);
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
