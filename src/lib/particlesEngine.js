import { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import { loadTextShape } from '@tsparticles/shape-text'
import { loadEmittersPlugin } from '@tsparticles/plugin-emitters'

let enginePromise = null

// `loadSlim` alone doesn't cover the 'char' shape (floating/petals/lanterns)
// or the emitters plugin (fountain) -- both are loaded explicitly so every
// ambient preset in studioEffects.js has what it needs, instead of silently
// rendering zero particles.
export function loadEngine() {
  if (!enginePromise) {
    enginePromise = initParticlesEngine(async (engine) => {
      await loadSlim(engine)
      await loadTextShape(engine)
      await loadEmittersPlugin(engine)
    })
  }
  return enginePromise
}

// Warms the engine before the effect is shown. Loading it on first mount put
// its init on the card-open frame itself, right on top of the reveal and the
// open-effect burst; CardPreviewModal calls this while the envelope waits.
export function preloadParticlesEngine() {
  const run = () => { loadEngine() }
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 })
  else setTimeout(run, 300)
}
