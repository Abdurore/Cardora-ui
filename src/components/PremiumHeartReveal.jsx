import { useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'

function PremiumHeartReveal({ onComplete }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const rotation = useMemo(() => (Math.random() * 10 - 5).toFixed(2), [])

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
    const particleCount = 34
    const particles = Array.from({ length: particleCount }, (_, index) => {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.6 + Math.random() * 1.6
      const size = 2 + Math.random() * 4
      const hue = 340 + Math.random() * 20
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
        glow: 0.5 + Math.random() * 0.8,
        isSpark: index % 12 === 0,
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
    <div className="premium-reveal">
      <style>{`
        .premium-reveal {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: radial-gradient(circle at center, rgba(255, 80, 120, 0.18), transparent 60%),
            #050505;
          overflow: hidden;
          z-index: 9999;
        }

        .premium-reveal::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.65));
          pointer-events: none;
        }

        .premium-canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .heart-stage {
          position: relative;
          width: min(240px, 68vw);
          aspect-ratio: 1;
          display: grid;
          place-items: center;
          will-change: transform, opacity;
        }

        .heart-shadow {
          position: absolute;
          width: 65%;
          height: 25%;
          background: radial-gradient(circle, rgba(0, 0, 0, 0.6), transparent 70%);
          bottom: 6%;
          filter: blur(10px);
          transform: translateY(40px);
          opacity: 0.7;
        }

        .heart-glow {
          position: absolute;
          inset: 0;
          filter: blur(20px);
          opacity: 0.55;
          transform: scale(1.2);
        }

        .heart-main {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.45));
        }

        .heart-sweep {
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
      <canvas ref={canvasRef} className="premium-canvas" />
      <motion.div
        className="heart-stage"
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: 1,
          scale: [0, 1.15, 1],
          rotate: [rotation, 0],
        }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="heart-shadow" />
        <motion.svg
          className="heart-glow"
          viewBox="0 0 200 180"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="glowGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7b0016" />
              <stop offset="100%" stopColor="#ff4f98" />
            </linearGradient>
          </defs>
          <path
            d="M100 170s-66-45-88-78C-6 60 10 22 44 16c23-4 44 7 56 28 12-21 33-32 56-28 34 6 50 44 32 76-22 33-88 78-88 78z"
            fill="url(#glowGradient)"
          />
        </motion.svg>
        <motion.svg
          className="heart-main"
          viewBox="0 0 200 180"
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
            <linearGradient id="heartGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7b0016" />
              <stop offset="100%" stopColor="#ff4f98" />
            </linearGradient>
            <radialGradient id="heartHighlight" cx="30%" cy="20%" r="60%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <path
            d="M100 170s-66-45-88-78C-6 60 10 22 44 16c23-4 44 7 56 28 12-21 33-32 56-28 34 6 50 44 32 76-22 33-88 78-88 78z"
            fill="url(#heartGradient)"
          />
          <path
            d="M100 170s-66-45-88-78C-6 60 10 22 44 16c23-4 44 7 56 28 12-21 33-32 56-28 34 6 50 44 32 76-22 33-88 78-88 78z"
            fill="url(#heartHighlight)"
          />
        </motion.svg>
        <motion.div
          className="heart-sweep"
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

export default PremiumHeartReveal
