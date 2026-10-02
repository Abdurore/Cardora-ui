import confetti from 'canvas-confetti'

const DEFAULT_COLORS = ['#000000', '#ffffff', '#c0c0c0']

// Ambient background particles always render from this fixed per-effect
// palette map — deliberately NOT derived from confettiColors or the card's
// theme (they used to inherit whatever confetti colors the sender picked,
// coupling two settings that should be independent). Each effect gets its
// own thematic colors (icy blue for snow, warm amber for embers, etc.)
// instead of every effect sharing one black/white/silver look, which made
// snow, fireflies and embers visually indistinguishable from each other.
const AMBIENT_COLOR_DEFAULT = ['#ffffff', '#c0c0c0', '#8f9aa8']
const AMBIENT_COLORS_BY_TYPE = {
  sparkle: ['#fff8dc', '#ffd700', '#ffffff'],
  shimmer: ['#fff8dc', '#ffd700', '#ffffff'],
  stars: ['#ffffff', '#cfe8ff', '#8fb8ff'],
  starfield: ['#ffffff', '#cfe8ff', '#8fb8ff'],
  aurora: ['#7cffcb', '#7ec8ff', '#c792ff'],
  snow: ['#ffffff', '#eaf6ff', '#bfe0ff'],
  bubbles: ['#bfe9ff', '#8fd8ff', '#ffffff'],
  fountain: ['#9fe8ff', '#5ec8ff', '#ffffff'],
  floating: ['#ff9bc2', '#ff5c8a', '#ffffff'],
  hearts: ['#ff9bc2', '#ff5c8a', '#ffffff'],
  lanterns: ['#ffb347', '#ff8c42', '#ffd67d'],
  petals: ['#ffb7d1', '#ff8fb3', '#ffe3ef'],
  fireflies: ['#fff1a8', '#ffe066', '#ffd23f'],
  embers: ['#ff6b35', '#ff9f45', '#ffcf6b'],
  rain: ['#9fb8d9', '#c7d6ea', '#ffffff'],
  meteors: ['#ffffff', '#ffd27f', '#ff9d5c'],
}

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

// `intensity` (0-1, from src/lib/deviceCapability.js) scales both particle counts and
// how long each effect's continuous tail runs — a weak device gets a smaller, shorter
// version of the same effect instead of either the full thing or nothing. A duration
// floor (`durationScale`) keeps it from feeling truncated even at low intensity.
function scaleCount(count, intensity) {
  return Math.max(1, Math.round(count * intensity))
}
function scaleDuration(ms, intensity) {
  return Math.round(ms * Math.max(0.35, intensity))
}

export function fireOpenEffect(type, colors, intensity = 1) {
  const palette = resolveColors(colors)
  switch (type) {
    case 'confetti':
      return fireConfetti(palette, intensity)
    case 'glitterBurst':
      return fireGlitterBurst(palette, intensity)
    case 'goldenBloom':
      return fireGlitterBurst(['#fff7c2', '#ffd166', '#f4b942', '#ffffff'], intensity)
    case 'fireworks':
      return fireFireworks(palette, intensity)
    case 'heartsBurst':
    case 'hearts':
      return fireShapeBurst('♥', palette, { spread: 96, startVelocity: 43, gravity: 0.68 }, intensity)
    case 'rosePetals':
      return fireShapeBurst('❦', ['#ff9bd2', '#ff6b9d', '#ffd1e8'], { spread: 120, startVelocity: 32, gravity: 0.45 }, intensity)
    case 'starShower':
    case 'stars':
      return fireStarShower(palette, intensity)
    case 'cometTrail':
      return fireCometTrail(palette, intensity)
    case 'balloons':
      return fireShapeBurst('●', palette, { spread: 62, startVelocity: 56, gravity: 0.26 }, intensity)
    case 'emojiRain':
      return fireEmojiRain(['✦', '✧', '★', '•'], intensity)
    case 'sparkleRain':
      return fireSparkleRain(palette, intensity)
    default:
      return null
  }
}

function fireConfetti(colors, intensity = 1) {
  confetti({
    particleCount: scaleCount(90, intensity),
    spread: 72,
    startVelocity: 38,
    origin: { x: 0.5, y: 0.58 },
    colors,
    ticks: 140,
    zIndex: 100001,
  })
  const end = Date.now() + scaleDuration(1900, intensity)
  const perFrame = scaleCount(4, intensity)
  const frame = () => {
    confetti({ particleCount: perFrame, angle: 58, spread: 58, origin: { x: 0, y: 0.68 }, colors, scalar: 0.9, zIndex: 100001 })
    confetti({ particleCount: perFrame, angle: 122, spread: 58, origin: { x: 1, y: 0.68 }, colors, scalar: 0.9, zIndex: 100001 })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

function fireGlitterBurst(colors, intensity = 1) {
  const end = Date.now() + scaleDuration(1800, intensity)
  const frame = () => {
    confetti({
      particleCount: scaleCount(12, intensity),
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

function fireFireworks(colors, intensity = 1) {
  const end = Date.now() + scaleDuration(2400, intensity)
  const shoot = () => {
    confetti({
      particleCount: scaleCount(70, intensity),
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

function fireShapeBurst(emoji, colors, { spread = 70, startVelocity = 45, gravity = 0.8 } = {}, intensity = 1) {
  if (typeof confetti.shapeFromText !== 'function') return fireConfetti(colors, intensity)
  const shape = confetti.shapeFromText({ text: emoji, scalar: 2 })
  confetti({
    particleCount: scaleCount(44, intensity),
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
      particleCount: scaleCount(34, intensity),
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

function fireStarShower(colors, intensity = 1) {
  if (typeof confetti.shapeFromText !== 'function') return fireConfetti(colors, intensity)
  const shape = confetti.shapeFromText({ text: '★', scalar: 1.8 })
  const end = Date.now() + scaleDuration(2200, intensity)
  const frame = () => {
    confetti({
      particleCount: scaleCount(6, intensity),
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

function fireSparkleRain(colors, intensity = 1) {
  if (typeof confetti.shapeFromText !== 'function') return fireGlitterBurst(colors, intensity)
  const shape = confetti.shapeFromText({ text: '✦', scalar: 1.3 })
  const end = Date.now() + scaleDuration(2000, intensity)
  const frame = () => {
    confetti({
      particleCount: scaleCount(5, intensity),
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

function fireCometTrail(colors, intensity = 1) {
  if (typeof confetti.shapeFromText !== 'function') return fireStarShower(colors, intensity)
  const shape = confetti.shapeFromText({ text: '✦', scalar: 1.7 })
  const end = Date.now() + scaleDuration(2200, intensity)
  const frame = () => {
    const leftSide = Math.random() > 0.5
    confetti({
      particleCount: scaleCount(7, intensity),
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

function fireEmojiRain(emojis, intensity = 1) {
  if (typeof confetti.shapeFromText !== 'function') return fireGlitterBurst(DEFAULT_COLORS, intensity)
  const shapes = emojis.map((e) => confetti.shapeFromText({ text: e, scalar: 1.6 }))
  const end = Date.now() + scaleDuration(2500, intensity)
  const frame = () => {
    confetti({
      particleCount: scaleCount(4, intensity),
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

export function getAmbientPreset(type, intensity = 1, tier = 'high') {
  const palette = AMBIENT_COLORS_BY_TYPE[type] || AMBIENT_COLOR_DEFAULT
  return applyTierToPreset(scalePreset(getAmbientPresetRaw(type, palette), intensity), tier)
}

// Same designs, cheaper to draw. `high` is untouched. The levers, in order of
// how much they save on a weak phone:
//  - detectRetina: tsParticles sizes the canvas to the device pixel ratio, so
//    a 3x phone redraws a ~1170x2500px surface every frame for dots a few CSS
//    pixels wide. At 1x they're softer by a hair and cost ~1/9 the fill.
//  - fpsLimit: these effects move slowly (speeds well under 2px/frame), so
//    30-45fps reads the same; tsParticles is delta-time based, so speed is
//    unchanged, only the redraw rate.
//  - star -> circle for small stars: at <=3.6px a polygon path and a circle
//    are indistinguishable, but a circle is a single arc fill.
//  - particle links (aurora): a neighbour search per particle per frame.
function applyTierToPreset(preset, tier) {
  if (!preset || tier === 'high') return preset
  const out = { ...preset, detectRetina: false, fpsLimit: tier === 'low' ? 30 : 45 }
  if (out.particles) {
    const particles = { ...out.particles }
    if (particles.shape?.type === 'star' && (particles.size?.value?.max ?? 4) <= 4) {
      particles.shape = { type: 'circle' }
    }
    if (particles.links?.enable) particles.links = { ...particles.links, enable: false }
    out.particles = particles
  }
  return out
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
          color: { value: palette },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.35, max: 0.86 } },
          size: { value: { min: 1, max: 4 } },
          move: { enable: true, speed: { min: 0.6, max: 1.7 }, direction: 'bottom', random: true, straight: false, outModes: 'out' },
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
          move: { enable: true, speed: { min: 0.6, max: 1.8 }, direction: 'top', random: true, straight: false, outModes: 'destroy' },
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
            gravity: { enable: true, acceleration: 13 },
            speed: { min: 11, max: 19 },
            direction: 'top',
            outModes: { default: 'destroy', bottom: 'none' },
          },
          life: { duration: { value: 4.5 }, count: 1 },
        },
      }
    case 'floating':
    case 'hearts':
    case 'lanterns':
      // No `density`: tsParticles' density factor scales `number.value`
      // against a 1920x1080 reference area, which crushed this count to
      // 0 spawned particles on the small Studio preview canvas.
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: type === 'lanterns' ? 20 : 34 },
          color: { value: palette },
          shape: {
            type: 'char',
            options: { char: { value: type === 'lanterns' ? ['◆'] : ['♥'], font: 'Verdana', weight: '400' } },
          },
          opacity: { value: { min: 0.4, max: 0.9 }, animation: { enable: true, speed: 0.9, sync: false } },
          size: { value: type === 'lanterns' ? { min: 12, max: 28 } : { min: 10, max: 22 } },
          move: { enable: true, speed: type === 'lanterns' ? 0.55 : 1.1, direction: 'top', random: true, straight: false, outModes: 'out' },
        },
      }
    case 'petals':
      // Falls and tumbles like a real petal — distinct from floating/
      // hearts/lanterns, which all drift upward. Multiple glyphs + free
      // rotation give it visual variety instead of one static symbol.
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 40 },
          color: { value: palette },
          shape: {
            type: 'char',
            options: { char: { value: ['❀', '✿', '❁'], font: 'Verdana', weight: '400' } },
          },
          opacity: { value: { min: 0.5, max: 0.95 } },
          size: { value: { min: 9, max: 19 } },
          rotate: { value: { min: 0, max: 360 }, animation: { enable: true, speed: 14, sync: false } },
          move: {
            enable: true,
            speed: { min: 0.6, max: 1.6 },
            direction: 'bottom',
            random: true,
            straight: false,
            outModes: 'out',
            drift: { min: -0.6, max: 0.6 },
          },
          wobble: { enable: true, distance: 14, speed: 6 },
        },
      }
    case 'fireflies':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 70 },
          color: { value: palette },
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
          color: { value: palette },
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
      // round, slow, high-opacity dots. The 'line' shape only draws a
      // moveTo/lineTo path (zero area) — filling that paints nothing, it
      // must be stroked, so `stroke` is required or the streaks are
      // invisible even though particles are spawning correctly.
      // `rotate: 90` is required: the line shape draws horizontally
      // (moveTo/lineTo along the x-axis) regardless of travel direction,
      // so without a 90-degree rotation the streaks fall straight down
      // while lying sideways instead of pointing the way they're moving.
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 90 },
          color: { value: palette },
          shape: { type: 'line' },
          opacity: { value: { min: 0.12, max: 0.4 } },
          size: { value: { min: 8, max: 18 } },
          rotate: { value: 90 },
          stroke: { width: { min: 1, max: 2 }, color: { value: palette } },
          move: { enable: true, speed: { min: 7, max: 11 }, direction: 'bottom', straight: true, outModes: 'out' },
        },
      }
    case 'meteors':
      // Sparse, high-speed angled streaks — an occasional event, not a
      // constant field like starfield/rain. No `move.trail`: tsParticles'
      // trail technique fades the canvas by painting a low-opacity rect
      // instead of clearing it each frame, which accumulates to a solid
      // opaque backdrop over time — fatal for this canvas, which must
      // stay transparent so the card/page behind it stays visible.
      // `density` is deliberately omitted: tsParticles' density factor
      // scales `number.value` against a 1920x1080 reference area, which
      // crushed this already-low count to ~0 spawned particles on the
      // small Studio preview canvas — omitting it uses the literal count.
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 8 },
          color: { value: palette },
          shape: { type: 'star' },
          opacity: { value: { min: 0.3, max: 0.9 } },
          size: { value: { min: 1.5, max: 3.5 } },
          move: { enable: true, speed: { min: 10, max: 16 }, direction: 'bottom-left', straight: true, outModes: 'destroy' },
        },
      }
    default:
      return null
  }
}
