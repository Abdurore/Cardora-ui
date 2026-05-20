import { useEffect, useRef } from 'react'
import { getGiftEffect } from './PremiumGiftReveal.jsx'

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t)

function heartPoint(t, cx, cy, scale) {
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
  return { x: cx + x * scale, y: cy + y * scale }
}

function isLowPower() {
  if (typeof window === 'undefined') return false
  return (
    window.innerWidth < 768 ||
    (navigator.hardwareConcurrency || 4) <= 4 ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

const CYCLE_MS = 3400

// Looping preview that mirrors the full-screen PremiumGiftReveal canvas.
// Particles burst outward then converge to form a glowing heart silhouette.
// Rotation and bob keep the settled heart alive between cycles.
function GiftHeartPreview({ effectKey = 'tiny' }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const stateRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return undefined

    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const lowPower = isLowPower()
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2)
    const config = getGiftEffect(effectKey)
    const particleCount = lowPower ? 60 : 110

    function buildParticles(cx, cy, scale) {
      return Array.from({ length: particleCount }, (_, i) => {
        const angle = (i / particleCount) * Math.PI * 2
        const hp = heartPoint(angle, cx, cy, scale)
        return {
          x: cx + (Math.random() - 0.5) * cx,
          y: cy + (Math.random() - 0.5) * cy,
          vx: 0,
          vy: 0,
          tx: hp.x,
          ty: hp.y,
          baseAngle: Math.atan2(hp.y - cy, hp.x - cx),
          heartAngle: angle,
          explodeForce: (1.6 + Math.random() * 1.6) * Math.min(config.intensity || 1, 2.8),
          size: 1.2 + Math.random() * 1.8,
          opacity: 0.5 + Math.random() * 0.45,
          glow: 5 + Math.random() * 5,
        }
      })
    }

    function init(w, h) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const cx = w / 2
      const cy = h / 2
      const scale = Math.min(w, h) / 48
      return { w, h, cx, cy, scale, particles: buildParticles(cx, cy, scale) }
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width < 10 || height < 10) return
      const rw = Math.round(width)
      const rh = Math.round(height)
      if (stateRef.current?.w === rw && stateRef.current?.h === rh) return
      stateRef.current = init(rw, rh)
    })
    ro.observe(wrap)

    const rect = wrap.getBoundingClientRect()
    const initW = rect.width > 10 ? Math.round(rect.width) : wrap.offsetWidth || 300
    const initH = rect.height > 10 ? Math.round(rect.height) : wrap.offsetHeight || 160
    stateRef.current = init(initW, initH)

    let lastCycleIdx = -1
    let lastFrame = 0
    const minFrameMs = lowPower ? 20 : 0
    const startTime = performance.now()

    const isRainbow = config.gradient.length > 2
    const getColors = (idx) => {
      if (!isRainbow) return { a: config.gradient[0], b: config.gradient[1] }
      const ci = idx % (config.gradient.length - 1)
      return { a: config.gradient[ci], b: config.gradient[ci + 1] }
    }

    const tick = (time) => {
      if (time - lastFrame < minFrameMs) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      lastFrame = time

      const st = stateRef.current
      if (!st) { rafRef.current = requestAnimationFrame(tick); return }

      const { w, h, cx, cy, scale, particles } = st
      const elapsed = time - startTime
      const tCycle = (elapsed % CYCLE_MS) / CYCLE_MS
      const cycleIdx = Math.floor(elapsed / CYCLE_MS)

      // Burst particles outward at the start of each new cycle
      if (cycleIdx > lastCycleIdx) {
        lastCycleIdx = cycleIdx
        particles.forEach((p) => {
          const outAngle = p.baseAngle + (Math.random() - 0.5) * 0.9
          const force = p.explodeForce * (1.8 + Math.random() * 1.2)
          p.vx = Math.cos(outAngle) * force
          p.vy = Math.sin(outAngle) * force
        })
      }

      // Phase split: 0-28% explode · 28-72% form · 72-100% glow
      let phase, localProgress
      if (tCycle < 0.28) {
        phase = 'explode'
        localProgress = easeOutQuad(tCycle / 0.28)
      } else if (tCycle < 0.72) {
        phase = 'form'
        localProgress = easeInOutCubic((tCycle - 0.28) / 0.44)
      } else {
        phase = 'glow'
        localProgress = easeInOutCubic((tCycle - 0.72) / 0.28)
      }

      // Gentle rotation (±7°) and vertical bob keep the settled heart alive
      const rotation = Math.sin(elapsed * 0.00042) * 0.12
      const bob = Math.sin(elapsed * 0.00088) * (h * 0.024)
      const cosR = Math.cos(rotation)
      const sinR = Math.sin(rotation)

      ctx.fillStyle = `rgba(4, 6, 10, ${phase === 'glow' ? 0.07 : lowPower ? 0.2 : 0.12})`
      ctx.fillRect(0, 0, w, h)

      particles.forEach((p, i) => {
        // Recompute heart target with current rotation and bob applied
        const hp = heartPoint(p.heartAngle, 0, 0, scale)
        p.tx = cx + hp.x * cosR - hp.y * sinR
        p.ty = cy + bob + (hp.x * sinR + hp.y * cosR)

        if (phase === 'explode') {
          const nudge = p.baseAngle + Math.sin(elapsed * 0.002 + i * 0.55) * 0.18
          const str = 0.14 * (1 - localProgress)
          p.vx += Math.cos(nudge) * str
          p.vy += Math.sin(nudge) * str
        } else if (phase === 'form') {
          const force = 0.022 + localProgress * 0.018
          p.vx += (p.tx - p.x) * force
          p.vy += (p.ty - p.y) * force
        } else {
          // Glow: keep settled at the (rotating, bobbing) target
          p.vx += (p.tx - p.x) * 0.055
          p.vy += (p.ty - p.y) * 0.055
        }

        const friction = phase === 'explode' ? 0.93 : phase === 'form' ? 0.87 : 0.76
        p.vx *= friction
        p.vy *= friction
        p.x += p.vx
        p.y += p.vy

        const glowPulse =
          phase === 'glow' ? 1 + Math.sin(localProgress * Math.PI * 2.5 + i * 0.22) * 0.45 : 1

        const alpha =
          phase === 'glow'
            ? 0.45 + Math.sin(localProgress * Math.PI * 3 + i * 0.15) * 0.3
            : 0.25 + localProgress * 0.55

        ctx.save()
        ctx.globalAlpha = Math.max(0.04, alpha * p.opacity)
        const { a: gradA, b: gradB } = getColors(i)
        if (!lowPower) {
          ctx.shadowBlur = p.glow * glowPulse
          ctx.shadowColor = gradA
        }
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5.5)
        gr.addColorStop(0, gradA)
        gr.addColorStop(1, gradB)
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * glowPulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    ctx.fillStyle = 'rgb(4, 6, 10)'
    ctx.fillRect(0, 0, initW, initH)
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [effectKey])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}

export default GiftHeartPreview
