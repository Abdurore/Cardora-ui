import { useEffect, useId, useMemo, useState } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import { loadTextShape } from '@tsparticles/shape-text'
import { loadEmittersPlugin } from '@tsparticles/plugin-emitters'
import { getAmbientPreset } from '../lib/studioEffects.js'

let enginePromise = null

function AmbientParticles({ type, zIndex = 1, intensity = 1 }) {
  const [ready, setReady] = useState(false)
  // Studio's own design canvas and the "Play it through" preview modal can
  // both be mounted at once (the modal overlays the canvas rather than
  // replacing it), and tsParticles keys a container by its DOM id — a fixed
  // `ambient-${type}` id let the second instance silently fail to attach
  // (or steal the first instance's canvas) instead of rendering its own.
  const instanceId = useId()

  useEffect(() => {
    if (!enginePromise) {
      // `loadSlim` alone doesn't cover the 'char' shape (floating/petals/
      // lanterns) or the emitters plugin (fountain) — both are loaded
      // explicitly here so every ambient preset in studioEffects.js has
      // what it needs, instead of silently rendering zero particles.
      enginePromise = initParticlesEngine(async (engine) => {
        await loadSlim(engine)
        await loadTextShape(engine)
        await loadEmittersPlugin(engine)
      })
    }
    enginePromise.then(() => setReady(true))
  }, [])

  const options = useMemo(() => getAmbientPreset(type, intensity), [type, intensity])

  if (!ready || !options) return null

  return (
    <Particles
      id={`ambient-${type}-${instanceId}`}
      options={options}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex }}
    />
  )
}

export default AmbientParticles
