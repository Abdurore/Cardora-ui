import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'

const EFFECTS = {
  heart: {
    gradient: ['#7b0016', '#ff4f98'],
    path:
      'M100 170s-66-45-88-78C-6 60 10 22 44 16c23-4 44 7 56 28 12-21 33-32 56-28 34 6 50 44 32 76-22 33-88 78-88 78z',
  },
  diamond: {
    gradient: ['#5de0ff', '#7b82ff'],
    path:
      'M100 10 L170 70 L100 170 L30 70 Z M100 10 L140 70 L100 170 L60 70 Z',
  },
  rose: {
    gradient: ['#7b0016', '#ff4f98'],
    path:
      'M100 20 C140 10 170 40 160 80 C150 120 110 150 100 170 C90 150 50 120 40 80 C30 40 60 10 100 20 Z',
  },
  star: {
    gradient: ['#ffd56a', '#ff7ad1'],
    path:
      'M100 15 L122 70 L180 70 L132 108 L150 165 L100 132 L50 165 L68 108 L20 70 L78 70 Z',
  },
  orb: {
    gradient: ['#7ef7ff', '#62ffa2'],
    path: 'M100 20 A80 80 0 1 0 100 180 A80 80 0 1 0 100 20 Z',
  },
  ring: {
    gradient: ['#ffe07a', '#ff9bd2'],
    path:
      'M100 30 A70 70 0 1 0 100 170 A70 70 0 1 0 100 30 Z M100 55 A45 45 0 1 1 100 145 A45 45 0 1 1 100 55 Z',
  },
  candle: {
    gradient: ['#ffce7a', '#ff7ad1'],
    path:
      'M80 60 Q100 20 120 60 Z M70 60 L130 60 L120 170 L80 170 Z',
  },
  christmas_tree: {
    gradient: ['#3cffb1', '#7ef7ff'],
    path:
      'M100 20 L145 80 L120 80 L160 130 L130 130 L170 180 L30 180 L70 130 L40 130 L80 80 L55 80 Z',
  },
  crescent_moon: {
    gradient: ['#ffe59a', '#ffd1f0'],
    path:
      'M120 20 A70 70 0 1 0 120 180 A50 50 0 1 1 120 20 Z',
  },
  meteorite: {
    gradient: ['#ff9bd2', '#7ef7ff'],
    path:
      'M140 40 L180 60 L120 120 L60 100 L80 40 Z',
  },
  necklace: {
    gradient: ['#ffd56a', '#7ef7ff'],
    path:
      'M40 70 A60 60 0 0 0 160 70 L150 100 A50 50 0 0 1 50 100 Z M90 100 L110 100 L100 130 Z',
  },
}

export const getGiftEffect = (key) => EFFECTS[key] || EFFECTS.diamond

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

    const center = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const particleCount = 30
    const particles = Array.from({ length: particleCount }, (_, index) => {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.6 + Math.random() * 1.6
      const size = 2 + Math.random() * 4
      const hue = 330 + Math.random() * 30
      return {
        id: index,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        size,
        opacity: 0,
        life: 0,
        decay: 0.008 + Math.random() * 0.01,
        color: `hsla(${hue}, 90%, 75%, 1)`,
        isSpark: index % 10 === 0,
      }
    })

    startRef.current = performance.now()

    const tick = (time) => {
      const elapsed = time - startRef.current
      const { x: cx, y: cy } = center()
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      particles.forEach((p) => {
        if (elapsed > 600) {
          if (p.life === 0) {
            p.x = cx
            p.y = cy
            p.opacity = 0
          }
          p.life += p.decay
          p.opacity = Math.min(1, p.opacity + 0.03)
          p.vx *= 0.985
          p.vy *= 0.985
          p.x += p.vx * 6
          p.y += (p.vy - 0.02) * 6
        }
      })

      particles.forEach((p) => {
        if (p.life <= 0) return
        const fadeOut = Math.max(0, 1 - p.life * 1.2)
        const alpha = p.opacity * fadeOut
        if (alpha <= 0) return
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.shadowColor = p.color
        ctx.shadowBlur = p.isSpark ? 16 : 10
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.isSpark ? p.size + 2 : p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      if (elapsed < 2200) {
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
  }, [onComplete])

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
          background: radial-gradient(circle at center, rgba(255, 80, 120, 0.16), transparent 60%);
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
            <linearGradient id="giftGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={config.gradient[0]} />
              <stop offset="100%" stopColor={config.gradient[1]} />
            </linearGradient>
          </defs>
          <path d={config.path} fill="url(#giftGlow)" />
        </motion.svg>
        <motion.svg
          className="gift-main"
          viewBox="0 0 200 200"
          aria-hidden="true"
          initial={{ y: 0 }}
          animate={{ y: [0, -6, 0], scale: [1, 1.04, 1] }}
          transition={{
            delay: 0.5,
            duration: 1.1,
            ease: [0.34, 1.56, 0.64, 1],
            repeat: Infinity,
            repeatType: 'mirror',
          }}
        >
          <defs>
            <linearGradient id="giftGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={config.gradient[0]} />
              <stop offset="100%" stopColor={config.gradient[1]} />
            </linearGradient>
            <radialGradient id="giftHighlight" cx="30%" cy="20%" r="60%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <path d={config.path} fill="url(#giftGradient)" />
          <path d={config.path} fill="url(#giftHighlight)" />
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
        transition={{ duration: 2.2, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  )
}

export default PremiumGiftReveal
