import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Particles from '@tsparticles/react'
import { loadEngine } from '../lib/particlesEngine.js'
import { getAmbientPreset } from '../lib/studioEffects.js'
import { usePerfTier } from '../lib/usePerfTier.js'
import { watchFramePacing } from '../lib/perfTier.js'

function AmbientParticles({ type, zIndex = 1, intensity = 1 }) {
  const [ready, setReady] = useState(false)
  // Studio's own design canvas and the "Play it through" preview modal can
  // both be mounted at once (the modal overlays the canvas rather than
  // replacing it), and tsParticles keys a container by its DOM id — a fixed
  // `ambient-${type}` id let the second instance silently fail to attach
  // (or steal the first instance's canvas) instead of rendering its own.
  const instanceId = useId()
  const wrapRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    loadEngine().then(() => setReady(true))
  }, [])

  const tier = usePerfTier()
  const options = useMemo(() => getAmbientPreset(type, intensity, tier), [type, intensity, tier])

  // Particles are the heaviest steady-state thing on a card. If this device
  // can't hold the frame rate, step the whole app's tier down (see
  // perfTier.js) -- `tier` changing re-renders this with a lighter preset.
  useEffect(() => {
    if (!ready) return undefined
    return watchFramePacing()
  }, [ready])

  const handleLoaded = useCallback((container) => {
    containerRef.current = container
  }, [])

  // tsParticles measures its parent once at init and then only reacts to
  // *window* resize events. That leaves the drawing buffer stale whenever the
  // container changes size without the window doing so — and on mobile the
  // two routinely disagree, because the visual viewport shrinks and grows as
  // the browser's URL bar hides and reveals itself, and because layout is
  // still settling on the frame the canvas mounts in. The result was a canvas
  // sized to a fraction of its container, so particles filled only the top of
  // the screen and the rest stayed empty.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || !ready) return undefined

    let frame = null
    const resync = () => {
      if (frame != null) return
      frame = requestAnimationFrame(() => {
        frame = null
        const container = containerRef.current
        // `canvas.windowResize()` is what tsParticles runs on a real window
        // resize: it re-reads the element's size, resizes the buffer, and
        // re-seeds particle positions into the new space.
        container?.canvas?.windowResize?.()
      })
    }

    const observer = new ResizeObserver(resync)
    observer.observe(el)
    // The visual viewport is what actually changes when mobile browser chrome
    // slides away; `window.resize` alone does not reliably fire for it.
    window.visualViewport?.addEventListener('resize', resync)
    window.addEventListener('orientationchange', resync)

    return () => {
      if (frame != null) cancelAnimationFrame(frame)
      observer.disconnect()
      window.visualViewport?.removeEventListener('resize', resync)
      window.removeEventListener('orientationchange', resync)
    }
  }, [ready])

  if (!ready || !options) return null

  return (
    // The sizing is enforced from CSS (.ambient-particles-wrap) rather than
    // through <Particles style={...}>: that prop does not reach the div
    // tsParticles renders around its canvas, so the div collapsed to a
    // content-sized height and the canvas — height:100% of *that* — ended up
    // a fraction of the screen, which is why ambient effects only covered the
    // top of a phone viewport.
    // Sizing stays inline rather than in the class: page-level rules elsewhere
    // match this element and win over .ambient-particles-wrap on specificity,
    // which left the wrapper `position: relative` and collapsed to zero size.
    // The class is still needed for the descendant rules, which have to be
    // !important because that inner div belongs to tsParticles.
    <div
      ref={wrapRef}
      className="ambient-particles-wrap"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex }}
    >
      <Particles
        key={tier}
        id={`ambient-${type}-${instanceId}`}
        options={options}
        particlesLoaded={handleLoaded}
      />
    </div>
  )
}

export default AmbientParticles
