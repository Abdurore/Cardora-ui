import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { getGalaxyTheme } from './galaxyThemes.js'

// Imperative three.js scene for the galaxy experience, kept out of the React
// component so the component stays a thin mount/unmount shell. Everything
// allocated here is tracked and released in dispose(): WebGL contexts are
// capped at roughly 16 per page, so leaking one per Studio preview open/close
// would hard-fail the page after a handful of previews.

const ARM_COUNT = 3
const GALAXY_RADIUS = 26
const PLANET_ORBIT = 15

function buildGalaxyPoints(theme, starCount) {
  const positions = new Float32Array(starCount * 3)
  const colors = new Float32Array(starCount * 3)
  const scratch = new THREE.Color()
  const palette = theme.dust.map(c => new THREE.Color(c))

  for (let i = 0; i < starCount; i++) {
    // Logarithmic spiral: radius drives the arm's angular offset, and the
    // cubed random pulls density toward the core the way a real disk falls off.
    const radius = Math.pow(Math.random(), 0.55) * GALAXY_RADIUS
    const arm = (i % ARM_COUNT) / ARM_COUNT * Math.PI * 2
    const spin = radius * 0.32
    // Scatter shrinks toward the core so the centre stays tight and bright.
    const spread = (radius / GALAXY_RADIUS) * 2.4 + 0.35
    const angle = arm + spin + (Math.random() - 0.5) * 0.6

    positions[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * spread
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.35
    positions[i * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * spread

    scratch.copy(palette[i % palette.length])
    // Fade the outer disk so the arms dissolve instead of ending on a hard rim.
    scratch.multiplyScalar(1 - (radius / GALAXY_RADIUS) * 0.45)
    colors[i * 3] = scratch.r
    colors[i * 3 + 1] = scratch.g
    colors[i * 3 + 2] = scratch.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

// A soft radial dot, so points render as glowing motes rather than hard
// squares. Generated rather than shipped as an asset — it's ~30 lines of
// canvas and avoids a network request inside an already heavy scene.
function createDotTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createGalaxyScene({ canvas, theme: themeKey, memories, profile, onPick }) {
  const theme = getGalaxyTheme(themeKey)
  const disposables = []
  const track = (obj) => { disposables.push(obj); return obj }

  // Weaker tiers also ask the OS for the low-power GPU (a no-op where there
  // is only one) -- the dedicated one is wasted on a scene this light and is
  // what drains a laptop battery.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: profile.mode === 'full',
    alpha: true,
    powerPreference: profile.mode === 'full' ? 'high-performance' : 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.dpr))
  let frameIntervalMs = profile.fpsCap ? 1000 / profile.fpsCap - 1 : 0
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(new THREE.Color(theme.haze).getHex(), 0.018)

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
  camera.position.set(0, 14, 34)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.enablePan = false
  controls.minDistance = 12
  controls.maxDistance = 55
  // Stop short of the poles: looking straight down the disk's axis flattens
  // the spiral into a featureless ring.
  controls.minPolarAngle = 0.25
  controls.maxPolarAngle = Math.PI / 2.05
  controls.autoRotate = profile.autoRotate
  controls.autoRotateSpeed = 0.35

  // ── Spiral disk ──
  const dotTexture = track(createDotTexture())
  const galaxyGeometry = track(buildGalaxyPoints(theme, profile.starCount))
  const galaxyMaterial = track(new THREE.PointsMaterial({
    size: 0.42,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    map: dotTexture,
  }))
  const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial)
  scene.add(galaxy)

  // ── Entrance: the tapped intro dot "explodes" into the spiral ──
  // Every star's real position is already computed above (a full,
  // resting galaxy) -- that array becomes the animation's target. The
  // live buffer starts collapsed to the origin (a single bright point,
  // continuous with .gx-intro-star's dot) and lerps out to the target
  // over INTRO_DURATION. Cost is one lerp per star per frame for ~1.4s
  // only -- cheaper than the continuous per-frame planet-orbit math
  // below, which runs for the entire lifetime of the scene regardless.
  const INTRO_DURATION = 1.4
  const introEase = (t) => 1 - Math.pow(1 - t, 3) // ease-out: fast start, settles in
  const starTargets = galaxyGeometry.attributes.position.array.slice()
  const starLive = galaxyGeometry.attributes.position.array
  starLive.fill(0)
  galaxyGeometry.attributes.position.needsUpdate = true
  let introT = 0 // 0..1, advanced in frame()
  const cameraRest = camera.position.clone()
  const cameraStart = cameraRest.clone().multiplyScalar(0.26)
  camera.position.copy(cameraStart)
  controls.enabled = false

  // ── Core ──
  const coreGeometry = track(new THREE.SphereGeometry(1.5, 32, 32))
  const coreMaterial = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.core) }))
  const core = new THREE.Mesh(coreGeometry, coreMaterial)
  core.userData.pick = { kind: 'core' }
  scene.add(core)

  const glowGeometry = track(new THREE.SphereGeometry(3.4, 32, 32))
  const glowMaterial = track(new THREE.MeshBasicMaterial({
    color: new THREE.Color(theme.core),
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }))
  const glow = new THREE.Mesh(glowGeometry, glowMaterial)
  scene.add(glow)

  scene.add(new THREE.AmbientLight(0xffffff, 1.5))
  const keyLight = new THREE.PointLight(new THREE.Color(theme.core), 120, 60)
  scene.add(keyLight)

  // ── Memory planets ──
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  const planetGeometry = track(new THREE.SphereGeometry(1, 32, 32))
  const planets = memories.map((memory, i) => {
    const angle = (i / Math.max(memories.length, 1)) * Math.PI * 2
    const radius = PLANET_ORBIT + (i % 2 ? 3.5 : -2)
    // Starts as flat theme color and swaps to the photo once it decodes, so a
    // slow or failed image never leaves a hole in the scene.
    const material = track(new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.dust[i % theme.dust.length]),
      roughness: 0.85,
      metalness: 0.05,
    }))
    const mesh = new THREE.Mesh(planetGeometry, material)
    mesh.scale.setScalar(1.5 + (i % 3) * 0.25)
    mesh.position.set(Math.cos(angle) * radius, (i % 3 - 1) * 1.8, Math.sin(angle) * radius)
    mesh.userData.pick = { kind: 'memory', index: i }
    mesh.userData.orbit = { angle, radius, speed: 0.02 + (i % 4) * 0.004, y: mesh.position.y }
    scene.add(mesh)

    if (memory.url) {
      loader.load(
        memory.url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          material.map = texture
          material.color.set('#ffffff')
          material.needsUpdate = true
          track(texture)
        },
        undefined,
        () => {},
      )
    }
    return mesh
  })

  // ── Picking ──
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let downAt = null

  const onPointerDown = (e) => { downAt = { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e) => {
    if (!downAt) return
    // OrbitControls owns drags; only treat a near-stationary press as a tap,
    // otherwise every rotation of the scene would also open a memory.
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
    downAt = null
    if (moved > 8) return
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects([core, ...planets], false)[0]
    if (hit?.object?.userData?.pick) onPick(hit.object.userData.pick)
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointerup', onPointerUp)

  // ── Loop ──
  let raf = null
  let running = false
  let elapsed = 0
  const clock = new THREE.Clock()

  const resize = () => {
    const { clientWidth, clientHeight } = canvas
    if (!clientWidth || !clientHeight) return
    renderer.setSize(clientWidth, clientHeight, false)
    camera.aspect = clientWidth / clientHeight
    camera.updateProjectionMatrix()
  }

  let lastRenderAt = 0
  const frame = (now) => {
    raf = requestAnimationFrame(frame)
    // Frame cap for weaker tiers. Motion is driven by clock deltas, so
    // skipping a render changes smoothness, never speed -- and the skipped
    // frames cost nothing (no animation update, no draw call).
    if (frameIntervalMs && now - lastRenderAt < frameIntervalMs) return
    lastRenderAt = now
    const delta = Math.min(clock.getDelta(), 0.1)
    elapsed += delta
    galaxy.rotation.y += delta * 0.035

    const pulse = 1 + Math.sin(elapsed * 1.6) * 0.05
    const introDone = introT >= 1
    let introScale = 1
    if (!introDone) {
      introT = Math.min(introT + delta / INTRO_DURATION, 1)
      const eased = introEase(introT)
      introScale = eased
      for (let i = 0; i < starLive.length; i++) starLive[i] = starTargets[i] * eased
      galaxyGeometry.attributes.position.needsUpdate = true
      camera.position.lerpVectors(cameraStart, cameraRest, eased)
      if (introT >= 1) {
        camera.position.copy(cameraRest)
        controls.enabled = true
      }
    }
    // core starts a visible fraction of its size (it IS the tapped dot),
    // not zero -- scaling straight from 0 would make it briefly vanish.
    core.scale.setScalar(Math.max(0.15, introScale) * pulse)
    // The glow sphere used to sit outside this loop entirely, at a fixed
    // radius of 3.4 units regardless of the intro -- with the camera
    // starting close in (see cameraStart above), that fixed-size haze filled
    // most of the frame from frame one and made the whole entrance read as
    // "stuck" even while the stars/planets underneath it were animating.
    glow.scale.setScalar(Math.max(0.1, introScale))

    for (const mesh of planets) {
      const orbit = mesh.userData.orbit
      orbit.angle += delta * orbit.speed
      mesh.position.x = Math.cos(orbit.angle) * orbit.radius * introScale
      mesh.position.z = Math.sin(orbit.angle) * orbit.radius * introScale
      mesh.position.y = (orbit.y + Math.sin(elapsed * 0.5 + orbit.angle) * 0.4) * introScale
      mesh.rotation.y += delta * 0.15
    }
    // Skip during the intro -- OrbitControls.update() re-derives its
    // internal spherical state from camera.position on every call, and
    // calling it while we're scripting that position directly (with no
    // user input queued, since controls are disabled) is an unnecessary
    // round-trip at best and a fight with the lerp above at worst.
    if (introDone) controls.update()
    renderer.render(scene, camera)
  }

  const start = () => {
    if (running) return
    running = true
    clock.getDelta()
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    running = false
    if (raf != null) cancelAnimationFrame(raf)
    raf = null
  }

  resize()
  start()

  return {
    resize,
    // Re-tune a running scene when the performance tier changes (a runtime
    // downgrade): resolution and frame cap apply immediately.
    applyProfile(next) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, next.dpr))
      frameIntervalMs = next.fpsCap ? 1000 / next.fpsCap - 1 : 0
      controls.autoRotate = next.autoRotate
      resize()
    },
    start,
    stop,
    // Screen-space positions for the DOM labels, so labels stay themable with
    // the app's own CSS instead of needing a second three.js renderer
    // (CSS2DRenderer) fighting the modal's portal for DOM ownership.
    projectLabels() {
      const rect = canvas.getBoundingClientRect()
      const out = []
      for (let i = 0; i < planets.length; i++) {
        const v = planets[i].position.clone().project(camera)
        out.push({
          index: i,
          x: (v.x * 0.5 + 0.5) * rect.width,
          y: (-v.y * 0.5 + 0.5) * rect.height,
          // z > 1 means the point is behind the camera's far plane, i.e. the
          // planet has swung around behind the viewer.
          visible: v.z < 1,
        })
      }
      return out
    },
    focusMemory(index) {
      const mesh = planets[index]
      if (mesh) controls.target.copy(mesh.position)
    },
    resetFocus() {
      controls.target.set(0, 0, 0)
    },
    dispose() {
      stop()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      for (const item of disposables) item.dispose?.()
      scene.clear()
      renderer.dispose()
    },
  }
}
