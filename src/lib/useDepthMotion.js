import { useEffect, useRef } from 'react'
import { getDepthProfile } from './deviceCapability.js'

// Drives 3D tilt by writing CSS custom properties straight onto the element,
// never through React state. The previous envelope parallax called setTilt()
// inside its rAF, re-rendering the whole component on every pointer frame;
// custom properties keep the work on the compositor instead.
//
// Inputs are layered so something always moves: pointer for mice, drag for
// touch, gyro when the browser volunteers it, and a slow idle drift as the
// floor. Without that floor a phone with no gyro permission sits perfectly
// still, which is what made the envelope read as a flat image.

const IDLE_PERIOD_MS = 9000

export function useDepthMotion({ maxTilt = 10, idle = true, disabled = false } = {}) {
  const ref = useRef(null)
  // Read every frame by the rAF loop but never a render input, so it lives in
  // a ref rather than state.
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const profile = getDepthProfile()
    if (disabled || profile.tilt === 0) {
      el.style.setProperty('--tilt-x', '0deg')
      el.style.setProperty('--tilt-y', '0deg')
      return undefined
    }

    const amplitude = maxTilt * profile.tilt
    const idleFactor = idle && profile.idle ? 0.35 : 0
    let raf = null
    let dragging = false
    let dragOrigin = null
    let gyroSeen = false
    let lastInput = 0

    const setTarget = (x, y) => {
      lastInput = performance.now()
      targetRef.current = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
      }
    }

    const onPointerMove = (e) => {
      if (dragging || e.pointerType !== 'mouse') return
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      setTarget(
        (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2),
        (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2),
      )
    }

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse') return
      dragging = true
      dragOrigin = { x: e.clientX, y: e.clientY }
    }

    const onPointerDrag = (e) => {
      if (!dragging || !dragOrigin) return
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      // Full-width drag reaches full tilt; scaled by 2 so a short flick still
      // registers, since a card rarely gets dragged across its whole width.
      setTarget(
        ((e.clientX - dragOrigin.x) / rect.width) * 2,
        ((e.clientY - dragOrigin.y) / rect.height) * 2,
      )
    }

    const endDrag = () => {
      dragging = false
      dragOrigin = null
      setTarget(0, 0)
    }

    // Never call DeviceOrientationEvent.requestPermission() — an unprompted
    // iOS permission dialog on opening a card is worse than no gyro. This only
    // reacts when the browser volunteers the event on its own.
    const onOrientation = (e) => {
      if (dragging || e.gamma == null || e.beta == null) return
      gyroSeen = true
      setTarget(e.gamma / 45, (e.beta - 45) / 45)
    }

    const start = performance.now()
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      let { x, y } = targetRef.current
      // The idle drift is a floor, not an overlay: it fades out while real
      // input is driving the tilt and fades back in a second after it stops,
      // so a pointer never fights a sine wave.
      if (idleFactor && !dragging && !gyroSeen) {
        const sinceInput = now - lastInput
        const blend = lastInput === 0 ? 1 : Math.min(1, Math.max(0, (sinceInput - 700) / 900))
        if (blend > 0) {
          const t = ((now - start) % IDLE_PERIOD_MS) / IDLE_PERIOD_MS * Math.PI * 2
          x += Math.sin(t) * idleFactor * blend
          y += Math.cos(t * 0.7) * idleFactor * 0.7 * blend
        }
      }
      // Critically damped ease so gyro jitter and pointer jumps both smooth out.
      const cur = currentRef.current
      cur.x += (x - cur.x) * 0.08
      cur.y += (y - cur.y) * 0.08
      el.style.setProperty('--tilt-x', `${(cur.x * amplitude).toFixed(2)}deg`)
      el.style.setProperty('--tilt-y', `${(-cur.y * amplitude).toFixed(2)}deg`)
      el.style.setProperty('--depth-parallax', Math.min(1, Math.hypot(cur.x, cur.y)).toFixed(3))
    }

    const stop = () => {
      if (raf != null) cancelAnimationFrame(raf)
      raf = null
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else if (raf == null) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointermove', onPointerDrag, { passive: true })
    window.addEventListener('pointerup', endDrag, { passive: true })
    window.addEventListener('pointercancel', endDrag, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    if (profile.gyro) window.addEventListener('deviceorientation', onOrientation, { passive: true })

    return () => {
      stop()
      window.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerDrag)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('deviceorientation', onOrientation)
    }
  }, [maxTilt, idle, disabled])

  return ref
}

export default useDepthMotion
