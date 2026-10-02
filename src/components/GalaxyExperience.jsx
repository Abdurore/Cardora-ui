import { useCallback, useEffect, useRef, useState } from 'react'
import { createGalaxyScene } from '../lib/galaxyScene.js'
import { getGalaxyProfile } from '../lib/deviceCapability.js'
import { getGalaxyTheme } from '../lib/galaxyThemes.js'
import { getPerfTier, subscribePerfTier, watchFramePacing } from '../lib/perfTier.js'
import { optimizedImageUrl } from '../lib/imageUrl.js'

// Full-screen galaxy of memories, shown between the envelope opening and the
// card itself. Lazy-loaded by CardPreviewModal so three.js never ships with a
// card that doesn't use it.

function GalaxyFallback({ memories, coreLabel, coreNotes, onContinue }) {
  return (
    <div className="gx-fallback">
      <p className="gx-fallback-title">{coreLabel || 'A universe of little moments'}</p>
      <ul className="gx-fallback-list">
        {memories.map((memory, i) => (
          <li key={i} className="gx-fallback-item">
            {memory.url && <img src={memory.url} alt="" loading="lazy" />}
            <div>
              {memory.title && <h3>{memory.title}</h3>}
              {memory.note && <p>{memory.note}</p>}
            </div>
          </li>
        ))}
      </ul>
      {coreNotes.length > 0 && (
        <ul className="gx-fallback-notes">
          {coreNotes.map((note, i) => <li key={i}>{note}</li>)}
        </ul>
      )}
      <button type="button" className="primary gx-continue" onClick={onContinue}>Read the card</button>
    </div>
  )
}

function GalaxyExperience({ experience, images = [], onContinue }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const labelLayerRef = useRef(null)
  const labelNodesRef = useRef([])

  const theme = getGalaxyTheme(experience?.theme)
  const coreNotes = (experience?.coreNotes || []).filter(Boolean)
  const coreLabel = experience?.coreLabel || ''

  // Resolve each memory's photo once, here, so neither the scene nor the
  // labels have to keep reaching back into media.images by index.
  const memories = (experience?.memories || [])
    // Photos become GPU textures: a 4000x3000 original is ~48MB of texture
    // memory each. 1024px is plenty for a planet surface (640 on weak tiers).
    .map(m => ({ ...m, url: optimizedImageUrl(images[m.mediaIndex]?.url || '', { width: getPerfTier() === 'low' ? 640 : 1024, tier: getPerfTier() }) }))

  const [profile] = useState(getGalaxyProfile)
  const [entered, setEntered] = useState(false)
  const [active, setActive] = useState(null)
  const [notesOpen, setNotesOpen] = useState(false)

  const handlePick = useCallback((pick) => {
    if (pick.kind === 'core') {
      setNotesOpen(true)
      setActive(null)
    } else {
      setActive(pick.index)
      setNotesOpen(false)
    }
  }, [])

  useEffect(() => {
    if (profile.mode === 'fallback' || !entered) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const scene = createGalaxyScene({
      canvas,
      theme: experience?.theme,
      memories,
      profile,
      onPick: handlePick,
    })
    sceneRef.current = scene

    // Label pill sizes, measured once per layout. Reading offsetWidth/
    // offsetHeight inside the per-frame loop below, interleaved with the
    // style writes for each label, forced a synchronous layout per label
    // per frame.
    const labelSizes = new Map()
    const measureLabel = (node) => {
      let size = labelSizes.get(node)
      if (!size) {
        size = { halfW: node.offsetWidth / 2, halfH: node.offsetHeight / 2 }
        labelSizes.set(node, size)
      }
      return size
    }

    const observer = new ResizeObserver(() => { labelSizes.clear(); scene.resize() })
    observer.observe(canvas)

    // Step the scene's resolution/frame cap down if the tier drops while it
    // is running, and watch frame pacing so a struggling device does.
    const unsubscribeTier = subscribePerfTier(() => scene.applyProfile(getGalaxyProfile()))
    const stopWatching = watchFramePacing()

    // A card left open in a background tab must not keep a GPU busy.
    const onVisibility = () => (document.hidden ? scene.stop() : scene.start())
    document.addEventListener('visibilitychange', onVisibility)

    // Labels are positioned from a separate rAF that writes transforms
    // directly onto the DOM nodes — routing 8 label positions through React
    // state every frame would re-render the whole overlay 60 times a second.
    let labelRaf = requestAnimationFrame(function tick() {
      labelRaf = requestAnimationFrame(tick)
      const positions = scene.projectLabels()
      const bounds = canvas.getBoundingClientRect()
      for (const p of positions) {
        const node = labelNodesRef.current[p.index]
        if (!node) continue
        // Keep the pill fully on screen. A planet near the edge would
        // otherwise push its label half out of view — barely noticeable on a
        // desktop canvas, but on a phone the labels are a large fraction of
        // the width and were getting clipped into unreadable fragments.
        const { halfW, halfH } = measureLabel(node)
        const x = Math.min(Math.max(p.x, halfW + 6), bounds.width - halfW - 6)
        const y = Math.min(Math.max(p.y, halfH + 6), bounds.height - halfH - 6)
        node.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
        node.style.opacity = p.visible ? '1' : '0'
        node.style.pointerEvents = p.visible ? 'auto' : 'none'
      }
    })

    return () => {
      cancelAnimationFrame(labelRaf)
      unsubscribeTier()
      stopWatching()
      document.removeEventListener('visibilitychange', onVisibility)
      observer.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
    // memories/images are derived fresh each render but their identity doesn't
    // change what the scene needs after mount; rebuilding it on every render
    // would recreate the WebGL context continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, profile, experience?.theme, handlePick])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (active == null) scene.resetFocus()
    else scene.focusMemory(active)
  }, [active])

  const step = useCallback((delta) => {
    setActive((cur) => (cur == null ? null : (cur + delta + memories.length) % memories.length))
  }, [memories.length])

  // Arrow keys move between memories and Escape closes the panel — the scene
  // is otherwise pointer-only, which leaves it unusable by keyboard.
  useEffect(() => {
    if (active == null) return undefined
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
      else if (e.key === 'Escape') { e.preventDefault(); setActive(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, step])

  // Horizontal swipe on the panel moves between memories, which is how a
  // phone user will reach for it before finding the small arrows.
  const swipeRef = useRef(null)
  const onPanelPointerDown = (e) => { swipeRef.current = { x: e.clientX, y: e.clientY } }
  const onPanelPointerUp = (e) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return
    step(dx < 0 ? 1 : -1)
  }

  if (!memories.length) {
    // Nothing to show — hand straight over rather than presenting an empty sky.
    return null
  }

  if (profile.mode === 'fallback') {
    return (
      <GalaxyFallback
        memories={memories}
        coreLabel={coreLabel}
        coreNotes={coreNotes}
        onContinue={onContinue}
      />
    )
  }

  if (!entered) {
    return (
      <div className="gx-intro" style={{ '--gx-core': theme.core }}>
        <button
          type="button"
          className="gx-intro-star"
          onClick={() => setEntered(true)}
          aria-label="Begin the galaxy"
        />
        {coreLabel && <p className="gx-intro-label">{coreLabel}</p>}
        <p className="gx-intro-hint">Tap the star to begin.</p>
      </div>
    )
  }

  const activeMemory = active == null ? null : memories[active]

  return (
    <div className="gx-root" style={{ '--gx-core': theme.core, '--gx-haze': theme.haze }}>
      <canvas ref={canvasRef} className="gx-canvas" />

      <div
        ref={labelLayerRef}
        className={`gx-labels ${active != null ? 'is-dimmed' : ''}`}
        aria-hidden={active != null}
      >
        {memories.map((memory, i) => (
          <button
            key={i}
            type="button"
            ref={(node) => { labelNodesRef.current[i] = node }}
            className={`gx-label ${active === i ? 'is-active' : ''}`}
            onClick={() => handlePick({ kind: 'memory', index: i })}
          >
            {memory.title || `Memory ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Hidden while a memory is open: the camera pans to that planet, which
          routinely drags its label across the centred core label. */}
      {coreLabel && active == null && !notesOpen && <p className="gx-core-label">{coreLabel}</p>}

      {activeMemory && (
        <div
          className="gx-panel"
          role="dialog"
          aria-label={activeMemory.title || 'Memory'}
          onPointerDown={onPanelPointerDown}
          onPointerUp={onPanelPointerUp}
        >
          <button type="button" className="gx-panel-close" onClick={() => setActive(null)} aria-label="Close">×</button>
          {/* The planet's texture is small and curved; showing the photo flat
              here is the only place the recipient actually sees it properly. */}
          {activeMemory.url && (
            <img className="gx-panel-photo" src={activeMemory.url} alt="" draggable="false" />
          )}
          {activeMemory.title && <h3 className="gx-panel-title">{activeMemory.title}</h3>}
          {activeMemory.note && <p className="gx-panel-note">{activeMemory.note}</p>}
          <div className="gx-panel-nav">
            <button type="button" onClick={() => step(-1)} aria-label="Previous memory">‹</button>
            <span>{active + 1} / {memories.length}</span>
            <button type="button" onClick={() => step(1)} aria-label="Next memory">›</button>
          </div>
        </div>
      )}

      {notesOpen && coreNotes.length > 0 && (
        <div className="gx-notes" onClick={() => setNotesOpen(false)}>
          {coreNotes.map((note, i) => (
            <p key={i} className="gx-note" style={{ animationDelay: `${i * 0.28}s` }}>{note}</p>
          ))}
        </div>
      )}

      <p className="gx-hint">drag to explore · tap a memory or the core</p>
      <button type="button" className="gx-continue" onClick={onContinue}>Read the card →</button>
    </div>
  )
}

export default GalaxyExperience
