import { useEffect, useMemo, useState } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import { getAmbientPreset } from '../lib/studioEffects.js'

let enginePromise = null

function AmbientParticles({ type, colors, zIndex = 1 }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enginePromise) {
      enginePromise = initParticlesEngine(async (engine) => {
        await loadSlim(engine)
      })
    }
    enginePromise.then(() => setReady(true))
  }, [])

  const options = useMemo(() => getAmbientPreset(type, colors), [type, colors])

  if (!ready || !options) return null

  return (
    <Particles
      id={`ambient-${type}`}
      options={options}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex }}
    />
  )
}

export default AmbientParticles
