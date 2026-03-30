import { useRef, useEffect } from 'react'

/* ── Parametric shape equations ── */
const SHAPE_EQUATIONS = {
  heart: (t) => ({
    x: 16 * Math.pow(Math.sin(t), 3),
    y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
  }),
  diamond: (t) => {
    const a = t % (Math.PI * 2)
    const cx = Math.cos(a)
    const cy = Math.sin(a)
    const f = 15 / (Math.abs(cx) + Math.abs(cy) || 1)
    return { x: cx * f, y: cy * f }
  },
  rose: (t) => {
    const r = 15 * Math.cos(3 * t)
    return { x: r * Math.cos(t), y: r * Math.sin(t) }
  },
  star: (t) => {
    const spikes = 5
    const a = t - Math.PI / 2
    const n = ((t % (Math.PI * 2)) / (Math.PI * 2)) * spikes * 2
    const r = Math.floor(n) % 2 === 0 ? 17 : 7
    return { x: Math.cos(a) * r, y: Math.sin(a) * r }
  },
  orb: (t) => {
    const r = 14 + 2.5 * Math.sin(t * 3)
    return { x: r * Math.cos(t), y: r * Math.sin(t) }
  },
  ring: (t) => {
    const r = 14
    return { x: r * Math.cos(t), y: r * Math.sin(t) }
  },
  candle: (t) => {
    const norm = (t % (Math.PI * 2)) / (Math.PI * 2)
    if (norm < 0.3) {
      const p = norm / 0.3
      return { x: (p - 0.5) * 12, y: -14 - Math.sin(p * Math.PI) * 7 }
    }
    const p = (norm - 0.3) / 0.7
    const w = 5 + Math.sin(p * Math.PI) * 2.5
    return { x: (p < 0.5 ? 1 : -1) * w, y: -10 + p * 22 }
  },
  christmas_tree: (t) => {
    const norm = (t % (Math.PI * 2)) / (Math.PI * 2)
    const levels = 3
    const level = Math.floor(norm * levels)
    const p = (norm * levels) % 1
    const bw = 4 + level * 5
    const ys = -14 + level * 9
    return { x: (p < 0.5 ? p * 2 - 0.5 : 1.5 - p * 2) * bw, y: ys + p * 4 }
  },
  crescent_moon: (t) => {
    const r = 15
    const ox = r * Math.cos(t)
    const oy = r * Math.sin(t)
    const offset = 6
    const dist = Math.sqrt((ox - offset) * (ox - offset) + oy * oy)
    const f = dist < 11 ? 1.08 : 1
    return { x: ox * f, y: oy * f }
  },
  meteorite: (t) => {
    const norm = (t % (Math.PI * 2)) / (Math.PI * 2)
    const angle = norm * Math.PI * 2 - Math.PI * 0.75
    const r = 14 + Math.sin(norm * Math.PI * 5) * 2.5
    const trail = norm < 0.3 ? (0.3 - norm) * 28 : 0
    return { x: Math.cos(angle) * r - trail * 0.7, y: Math.sin(angle) * r - trail * 0.5 }
  },
  necklace: (t) => {
    const norm = (t % (Math.PI * 2)) / (Math.PI * 2)
    if (norm < 0.7) {
      const p = norm / 0.7
      const a = Math.PI * 0.15 + p * Math.PI * 0.7
      return { x: 17 * Math.cos(a), y: -Math.abs(15 * Math.sin(a)) }
    }
    const p = (norm - 0.7) / 0.3
    return { x: (p - 0.5) * 10, y: 2 + Math.abs(p - 0.5) * 7 }
  },
  infinity: (t) => {
    const s = 18
    const d = 1 + Math.pow(Math.sin(t), 2)
    return { x: (s * Math.cos(t)) / d, y: (s * Math.sin(t) * Math.cos(t)) / d }
  },
  flower: (t) => {
    const r = 14 * Math.cos(5 * t)
    return { x: r * Math.cos(t), y: r * Math.sin(t) }
  },
}

/* ── Particle class ── */
class Particle {
  constructor(cx, cy, targetX, targetY, hue, traceLen) {
    this.x = cx + (Math.random() - 0.5) * 60
    this.y = cy + (Math.random() - 0.5) * 60
    this.vx = (Math.random() - 0.5) * 1.2
    this.vy = (Math.random() - 0.5) * 1.2
    this.tx = targetX
    this.ty = targetY
    this.hue = hue
    this.size = 1 + Math.random() * 1.2
    this.trace = new Array(traceLen).fill(null).map(() => ({ x: this.x, y: this.y }))
    this.traceIdx = 0
  }

  seek(targetX, targetY, attraction) {
    this.tx = targetX
    this.ty = targetY
    const dx = this.tx - this.x
    const dy = this.ty - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const force = attraction * Math.min(dist, 120)
    this.vx += (dx / dist) * force
    this.vy += (dy / dist) * force
  }

  update(friction) {
    this.vx *= friction
    this.vy *= friction
    this.x += this.vx
    this.y += this.vy
    this.trace[this.traceIdx] = { x: this.x, y: this.y }
    this.traceIdx = (this.traceIdx + 1) % this.trace.length
  }
}

/* ── Component ── */
function AnimatedShape({
  shapeType = 'heart',
  color = '#ff2a75',
  hue = 340,
  width = 52,
  height = 52,
  particleCount: particleCountProp,
  traceLength: traceLengthProp,
  className = '',
  style = {},
}) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cx = width / 2
    const cy = height / 2
    const baseScale = Math.min(width, height) / 44

    const getShape = SHAPE_EQUATIONS[shapeType] || SHAPE_EQUATIONS.heart

    // Build target points along the parametric curve
    const targetPoints = []
    const steps = 128
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2
      const p = getShape(t)
      targetPoints.push(p)
    }

    // Create particles — each assigned to a target point on the curve
    const count = particleCountProp || Math.max(60, Math.round(width * 1.8))
    const traceLen = traceLengthProp || Math.max(4, Math.round(width / 10))

    const particles = []
    for (let i = 0; i < count; i++) {
      const tIdx = Math.floor((i / count) * targetPoints.length)
      const tp = targetPoints[tIdx]
      const h = hue + Math.random() * 30 - 15
      particles.push(new Particle(cx, cy, cx + tp.x * baseScale, cy + tp.y * baseScale, h, traceLen))
    }

    let time = 0

    const render = () => {
      // Trail fading
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
      ctx.fillRect(0, 0, width, height)

      time += 0.025

      // Pulsing scale
      const pulse = baseScale + Math.sin(time * 1.5) * (baseScale * 0.08)

      // Update target positions with pulse
      for (let i = 0; i < particles.length; i++) {
        const tIdx = Math.floor((i / particles.length) * targetPoints.length)
        const tp = targetPoints[tIdx]
        const tx = cx + tp.x * pulse
        const ty = cy + tp.y * pulse
        particles[i].seek(tx, ty, 0.018)
        particles[i].update(0.92)
      }

      // Draw particles and their traces
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Draw trace
        for (let j = 0; j < p.trace.length; j++) {
          const tr = p.trace[(p.traceIdx + j) % p.trace.length]
          const alpha = (j / p.trace.length) * 0.35
          ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, ${alpha})`
          ctx.beginPath()
          ctx.arc(tr.x, tr.y, p.size * 0.6, 0, Math.PI * 2)
          ctx.fill()
        }

        // Draw particle head
        ctx.fillStyle = `hsla(${p.hue}, 100%, 72%, 0.85)`
        ctx.shadowBlur = 6
        ctx.shadowColor = `hsla(${p.hue}, 100%, 60%, 0.6)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      rafRef.current = requestAnimationFrame(render)
    }

    // Start black
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    rafRef.current = requestAnimationFrame(render)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [shapeType, color, hue, width, height, particleCountProp, traceLengthProp])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', borderRadius: 'inherit', ...style }}
    />
  )
}

export default AnimatedShape
