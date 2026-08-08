import confetti from 'canvas-confetti'

const DEFAULT_COLORS = ['#76efff', '#62ffa2', '#ff9bd2', '#ffd166', '#f4fdff']

// Each effect carries its minimum tier. Classic = none. Premium unlocks the
// lighter set. Elite unlocks everything. Some newer keys are mapped back to
// backend-safe values during card creation, but the Studio can preview them.
export const OPEN_EFFECTS = [
  { value: 'none', label: 'None', tier: 'none' },
  { value: 'confetti', label: 'Confetti', tier: 'premium' },
  { value: 'glitterBurst', label: 'Glitter Burst', tier: 'premium' },
  { value: 'heartsBurst', label: 'Hearts Burst', tier: 'premium' },
  { value: 'rosePetals', label: 'Rose Petals', tier: 'premium' },
  { value: 'starShower', label: 'Star Shower', tier: 'premium' },
  { value: 'cometTrail', label: 'Comet Trail', tier: 'elite' },
  { value: 'fireworks', label: 'Fireworks', tier: 'elite' },
  { value: 'balloons', label: 'Balloons', tier: 'elite' },
  { value: 'emojiRain', label: 'Emoji Rain', tier: 'elite' },
  { value: 'goldenBloom', label: 'Golden Bloom', tier: 'elite' },
  { value: 'sparkleRain', label: 'Sparkle Rain', tier: 'elite' },
]

export const AMBIENT_EFFECTS = [
  { value: 'none', label: 'None', tier: 'none' },
  { value: 'starfield', label: 'Starfield', tier: 'premium' },
  { value: 'shimmer', label: 'Shimmer', tier: 'premium' },
  { value: 'bubbles', label: 'Bubbles', tier: 'premium' },
  { value: 'aurora', label: 'Aurora', tier: 'elite' },
  { value: 'snow', label: 'Snow', tier: 'elite' },
  { value: 'fountain', label: 'Fountain', tier: 'elite' },
  { value: 'fireflies', label: 'Fireflies', tier: 'elite' },
  { value: 'lanterns', label: 'Lanterns', tier: 'elite' },
  { value: 'petals', label: 'Petals', tier: 'elite' },
  { value: 'floating', label: 'Floating', tier: 'elite' },
  { value: 'embers', label: 'Embers', tier: 'elite' },
  { value: 'rain', label: 'Rain', tier: 'elite' },
  { value: 'meteors', label: 'Meteors', tier: 'elite' },
]

function resolveColors(colors) {
  return Array.isArray(colors) && colors.length ? colors : DEFAULT_COLORS
}

export function fireOpenEffect(type, colors) {
  const palette = resolveColors(colors)
  switch (type) {
    case 'confetti':
      return fireConfetti(palette)
    case 'glitterBurst':
      return fireGlitterBurst(palette)
    case 'goldenBloom':
      return fireGlitterBurst(['#fff7c2', '#ffd166', '#f4b942', '#ffffff'])
    case 'fireworks':
      return fireFireworks(palette)
    case 'heartsBurst':
    case 'hearts':
      return fireShapeBurst('♥', palette, { spread: 96, startVelocity: 43, gravity: 0.68 })
    case 'rosePetals':
      return fireShapeBurst('❦', ['#ff9bd2', '#ff6b9d', '#ffd1e8'], { spread: 120, startVelocity: 32, gravity: 0.45 })
    case 'starShower':
    case 'stars':
      return fireStarShower(palette)
    case 'cometTrail':
      return fireCometTrail(palette)
    case 'balloons':
      return fireShapeBurst('●', palette, { spread: 62, startVelocity: 56, gravity: 0.26 })
    case 'emojiRain':
      return fireEmojiRain(['✦', '✧', '★', '•'])
    case 'sparkleRain':
      return fireSparkleRain(palette)
    default:
      return null
  }
}

function fireConfetti(colors) {
  confetti({
    particleCount: 90,
    spread: 72,
    startVelocity: 38,
    origin: { x: 0.5, y: 0.58 },
    colors,
    ticks: 140,
    zIndex: 100001,
  })
  const end = Date.now() + 1900
  const frame = () => {
    confetti({ particleCount: 4, angle: 58, spread: 58, origin: { x: 0, y: 0.68 }, colors, scalar: 0.9, zIndex: 100001 })
    confetti({ particleCount: 4, angle: 122, spread: 58, origin: { x: 1, y: 0.68 }, colors, scalar: 0.9, zIndex: 100001 })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

function fireGlitterBurst(colors) {
  const end = Date.now() + 1800
  const frame = () => {
    confetti({
      particleCount: 12,
      spread: 120,
      startVelocity: 18,
      gravity: 0.45,
      ticks: 150,
      scalar: Math.random() * 0.6 + 0.55,
      origin: { x: Math.random() * 0.7 + 0.15, y: Math.random() * 0.22 + 0.28 },
      colors,
      shapes: ['circle'],
      zIndex: 100001,
    })
    if (Date.now() < end) setTimeout(frame, 110)
  }
  frame()
}

function fireFireworks(colors) {
  const duration = 2400
  const end = Date.now() + duration
  const shoot = () => {
    confetti({
      particleCount: 70,
      startVelocity: 34,
      spread: 360,
      ticks: 95,
      decay: 0.91,
      origin: { x: Math.random() * 0.7 + 0.15, y: Math.random() * 0.38 + 0.16 },
      colors,
      shapes: ['circle', 'square'],
      zIndex: 100001,
    })
    if (Date.now() < end) setTimeout(shoot, 280)
  }
  shoot()
}

function fireShapeBurst(emoji, colors, { spread = 70, startVelocity = 45, gravity = 0.8 } = {}) {
  if (typeof confetti.shapeFromText !== 'function') return fireConfetti(colors)
  const shape = confetti.shapeFromText({ text: emoji, scalar: 2 })
  confetti({
    particleCount: 44,
    spread,
    startVelocity,
    gravity,
    ticks: 150,
    scalar: 2,
    shapes: [shape],
    colors,
    origin: { x: 0.5, y: 0.62 },
    zIndex: 100001,
  })
  setTimeout(() => {
    confetti({
      particleCount: 34,
      spread: spread + 26,
      startVelocity: Math.max(18, startVelocity - 10),
      gravity,
      scalar: 1.7,
      shapes: [shape],
      colors,
      origin: { x: 0.5, y: 0.72 },
      zIndex: 100001,
    })
  }, 360)
}

function fireStarShower(colors) {
  if (typeof confetti.shapeFromText !== 'function') return fireConfetti(colors)
  const shape = confetti.shapeFromText({ text: '★', scalar: 1.8 })
  const end = Date.now() + 2200
  const frame = () => {
    confetti({
      particleCount: 6,
      spread: 180,
      startVelocity: 22,
      ticks: 210,
      gravity: 0.32,
      scalar: 1.7,
      shapes: [shape],
      colors,
      origin: { x: Math.random(), y: -0.1 },
      zIndex: 100001,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

function fireSparkleRain(colors) {
  if (typeof confetti.shapeFromText !== 'function') return fireGlitterBurst(colors)
  const shape = confetti.shapeFromText({ text: '✦', scalar: 1.3 })
  const end = Date.now() + 2000
  const frame = () => {
    confetti({
      particleCount: 5,
      spread: 0,
      startVelocity: 8,
      ticks: 200,
      gravity: 0.5,
      scalar: 1.1,
      shapes: [shape],
      colors,
      origin: { x: Math.random(), y: -0.05 },
      zIndex: 100001,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

function fireCometTrail(colors) {
  if (typeof confetti.shapeFromText !== 'function') return fireStarShower(colors)
  const shape = confetti.shapeFromText({ text: '✦', scalar: 1.7 })
  const end = Date.now() + 2200
  const frame = () => {
    const leftSide = Math.random() > 0.5
    confetti({
      particleCount: 7,
      angle: leftSide ? 40 : 140,
      spread: 28,
      startVelocity: 38,
      gravity: 0.18,
      decay: 0.92,
      ticks: 180,
      scalar: 1.45,
      shapes: [shape],
      colors,
      origin: { x: leftSide ? -0.05 : 1.05, y: Math.random() * 0.42 + 0.08 },
      zIndex: 100001,
    })
    if (Date.now() < end) setTimeout(frame, 170)
  }
  frame()
}

function fireEmojiRain(emojis) {
  if (typeof confetti.shapeFromText !== 'function') return fireGlitterBurst(DEFAULT_COLORS)
  const shapes = emojis.map((e) => confetti.shapeFromText({ text: e, scalar: 1.6 }))
  const end = Date.now() + 2500
  const frame = () => {
    confetti({
      particleCount: 4,
      spread: 140,
      startVelocity: 15,
      gravity: 0.4,
      ticks: 220,
      scalar: 1.6,
      shapes,
      origin: { x: Math.random(), y: -0.1 },
      zIndex: 100001,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

const BASE_FULLSCREEN = {
  fullScreen: { enable: false },
  detectRetina: true,
  fpsLimit: 60,
  background: { color: 'transparent' },
}

// `intensity` scales particle/emitter counts down (never fully to zero for a
// non-zero base) so small viewports get a lighter version of an effect
// instead of it being switched off outright — see CardPreviewModal's
// `ambientIntensity`.
function scalePreset(preset, intensity) {
  if (!preset || intensity >= 1) return preset
  const scaled = { ...preset }
  if (scaled.particles?.number?.value > 0) {
    scaled.particles = {
      ...scaled.particles,
      number: { ...scaled.particles.number, value: Math.max(1, Math.round(scaled.particles.number.value * intensity)) },
    }
  }
  if (scaled.emitters?.rate?.quantity > 0) {
    scaled.emitters = {
      ...scaled.emitters,
      rate: { ...scaled.emitters.rate, quantity: Math.max(1, Math.round(scaled.emitters.rate.quantity * intensity)) },
    }
  }
  return scaled
}

export function getAmbientPreset(type, colors = DEFAULT_COLORS, intensity = 1) {
  const palette = resolveColors(colors)
  return scalePreset(getAmbientPresetRaw(type, palette), intensity)
}

function getAmbientPresetRaw(type, palette) {
  switch (type) {
    case 'sparkle':
    case 'shimmer':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 95, density: { enable: true, area: 800 } },
          color: { value: palette },
          shape: { type: 'star' },
          opacity: { value: { min: 0.08, max: 0.95 }, animation: { enable: true, speed: 2.8, sync: false } },
          size: { value: { min: 0.8, max: 3.4 } },
          move: { enable: true, speed: 0.25, direction: 'none', random: true, outModes: 'out' },
        },
      }
    case 'stars':
    case 'starfield':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 115, density: { enable: true, area: 900 } },
          color: { value: palette },
          shape: { type: 'star' },
          opacity: { value: { min: 0.25, max: 0.9 }, animation: { enable: true, speed: 1.5, sync: false } },
          size: { value: { min: 1, max: 3.6 } },
          move: { enable: true, speed: 0.18, direction: 'none', random: true, outModes: 'out' },
        },
      }
    case 'aurora':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 70, density: { enable: true, area: 900 } },
          color: { value: palette },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.08, max: 0.36 }, animation: { enable: true, speed: 1.2, sync: false } },
          size: { value: { min: 18, max: 54 } },
          move: { enable: true, speed: 0.65, direction: 'right', random: true, straight: false, outModes: 'out' },
          links: { enable: true, distance: 150, color: palette[0] || '#76efff', opacity: 0.06, width: 1 },
        },
      }
    case 'snow':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 150, density: { enable: true, area: 800 } },
          color: { value: '#ffffff' },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.35, max: 0.86 } },
          size: { value: { min: 1, max: 4 } },
          move: { enable: true, speed: { min: 0.8, max: 2.1 }, direction: 'bottom', random: true, straight: false, outModes: 'out' },
          wobble: { enable: true, distance: 10, speed: 5 },
        },
      }
    case 'bubbles':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 48, density: { enable: true, area: 800 } },
          color: { value: palette },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.15, max: 0.48 }, animation: { enable: true, speed: 0.8, sync: false } },
          size: { value: { min: 7, max: 24 } },
          move: { enable: true, speed: { min: 0.8, max: 2.2 }, direction: 'top', random: true, straight: false, outModes: 'destroy' },
        },
      }
    case 'fountain':
      return {
        ...BASE_FULLSCREEN,
        emitters: {
          position: { x: 50, y: 100 },
          rate: { quantity: 4, delay: 0.1 },
        },
        particles: {
          number: { value: 0 },
          color: { value: palette },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.3, max: 0.9 } },
          size: { value: { min: 2, max: 5 } },
          move: {
            enable: true,
            gravity: { enable: true, acceleration: 18 },
            speed: { min: 16, max: 28 },
            direction: 'top',
            outModes: { default: 'destroy', bottom: 'none' },
          },
          life: { duration: { value: 4 }, count: 1 },
        },
      }
    case 'floating':
    case 'hearts':
    case 'petals':
    case 'lanterns':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: type === 'lanterns' ? 20 : 34, density: { enable: true, area: 900 } },
          color: { value: type === 'lanterns' ? ['#ffd166', '#fff3b0', '#ff9f1c'] : ['#ff6b9d', '#ff9bd2', '#ffc2e2'] },
          shape: {
            type: 'char',
            options: { char: { value: type === 'lanterns' ? ['◆'] : type === 'petals' ? ['❦'] : ['♥'], font: 'Verdana', weight: '400' } },
          },
          opacity: { value: { min: 0.4, max: 0.9 }, animation: { enable: true, speed: 0.9, sync: false } },
          size: { value: type === 'lanterns' ? { min: 12, max: 28 } : { min: 10, max: 22 } },
          move: { enable: true, speed: type === 'lanterns' ? 0.55 : 1.1, direction: 'top', random: true, straight: false, outModes: 'out' },
        },
      }
    case 'fireflies':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 70 },
          color: { value: ['#fff6b3', '#ffd166', '#f6ffa2'] },
          shape: { type: 'circle' },
          opacity: {
            value: { min: 0.08, max: 1 },
            animation: { enable: true, speed: 3.2, sync: false, startValue: 'random' },
          },
          size: { value: { min: 1, max: 3.4 } },
          move: {
            enable: true,
            speed: 0.7,
            direction: 'none',
            random: true,
            straight: false,
            outModes: 'bounce',
          },
        },
      }
    case 'embers':
      // Rising, cooling sparks — an emitter near the bottom pushes warm
      // particles up and fading, unlike fireflies' idle random drift.
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 55, density: { enable: true, area: 900 } },
          color: { value: ['#ff9f1c', '#ff6b35', '#ffd166', '#ffb703'] },
          shape: { type: 'circle' },
          opacity: {
            value: { min: 0.15, max: 0.9 },
            animation: { enable: true, speed: 1.4, sync: false, startValue: 'random' },
          },
          size: { value: { min: 1, max: 3.2 } },
          move: {
            enable: true,
            speed: { min: 0.6, max: 1.8 },
            direction: 'top',
            random: true,
            straight: false,
            outModes: 'destroy',
            drift: { min: -0.4, max: 0.4 },
          },
          wobble: { enable: true, distance: 6, speed: 8 },
        },
      }
    case 'rain':
      // Thin, fast, low-opacity streaks — visually distinct from snow's
      // round, slow, high-opacity dots.
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 140, density: { enable: true, area: 700 } },
          color: { value: palette },
          shape: { type: 'line' },
          opacity: { value: { min: 0.12, max: 0.4 } },
          size: { value: { min: 8, max: 18 } },
          rotate: { value: 12 },
          move: { enable: true, speed: { min: 9, max: 15 }, direction: 'bottom', straight: true, outModes: 'out' },
        },
      }
    case 'meteors':
      // Sparse, high-speed angled streaks with a fading trail — an
      // occasional event, not a constant field like starfield/rain.
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 8, density: { enable: true, area: 1400 } },
          color: { value: palette },
          shape: { type: 'star' },
          opacity: { value: { min: 0.3, max: 0.9 } },
          size: { value: { min: 1.5, max: 3.5 } },
          move: { enable: true, speed: { min: 14, max: 22 }, direction: 'bottom-left', straight: true, trail: { enable: true, length: 12, fill: { color: 'transparent' } }, outModes: 'destroy' },
        },
      }
    default:
      return null
  }
}
