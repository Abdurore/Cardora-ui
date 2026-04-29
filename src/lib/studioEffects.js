import confetti from 'canvas-confetti'

const DEFAULT_COLORS = ['#76efff', '#62ffa2', '#ff9bd2', '#ffd166', '#f4fdff']

// Each effect carries its minimum tier. Classic = none. Premium unlocks the
// lighter set. Elite unlocks everything. `tier: 'none'` means the option is
// available to all (e.g. the 'None' off-state).
export const OPEN_EFFECTS = [
  { value: 'none',      label: 'None',              tier: 'none' },
  { value: 'confetti',  label: '🎉 Confetti',        tier: 'premium' },
  { value: 'hearts',    label: '💖 Hearts Burst',    tier: 'premium' },
  { value: 'stars',     label: '⭐ Star Shower',     tier: 'premium' },
  { value: 'fireworks', label: '🎆 Fireworks',       tier: 'elite' },
  { value: 'balloons',  label: '🎈 Balloons',        tier: 'elite' },
  { value: 'emojiRain', label: '✨ Emoji Rain',      tier: 'elite' },
]

export const AMBIENT_EFFECTS = [
  { value: 'none',      label: 'None',              tier: 'none' },
  { value: 'sparkle',   label: 'Sparkle',           tier: 'premium' },
  { value: 'stars',     label: 'Starfield',         tier: 'premium' },
  { value: 'bubbles',   label: 'Bubbles',           tier: 'premium' },
  { value: 'snow',      label: 'Snow',              tier: 'elite' },
  { value: 'fountain',  label: 'Fountain',          tier: 'elite' },
  { value: 'hearts',    label: 'Floating Hearts',   tier: 'elite' },
  { value: 'fireflies', label: 'Fireflies',         tier: 'elite' },
  { value: 'floating',  label: 'Floating (emoji)',  tier: 'elite' },
]

const TIER_RANK = { classic: 0, premium: 1, elite: 2 }

function effectAllowed(effect, tier, { isArtist = false } = {}) {
  if (isArtist) return true
  if (!effect.tier || effect.tier === 'none') return true
  return (TIER_RANK[tier] || 0) >= (TIER_RANK[effect.tier] || 0)
}

export function getOpenEffectsForTier(tier, opts) {
  return OPEN_EFFECTS.filter((e) => effectAllowed(e, tier, opts))
}

export function getAmbientEffectsForTier(tier, opts) {
  return AMBIENT_EFFECTS.filter((e) => effectAllowed(e, tier, opts))
}

function resolveColors(colors) {
  return Array.isArray(colors) && colors.length ? colors : DEFAULT_COLORS
}

export function fireOpenEffect(type, colors) {
  const palette = resolveColors(colors)
  switch (type) {
    case 'confetti':
      return fireConfetti(palette)
    case 'fireworks':
      return fireFireworks(palette)
    case 'hearts':
      return fireShapeBurst('❤️', palette, { spread: 90, startVelocity: 45 })
    case 'stars':
      return fireStarShower(palette)
    case 'balloons':
      return fireShapeBurst('🎈', palette, { spread: 60, startVelocity: 55, gravity: 0.3 })
    case 'emojiRain':
      return fireEmojiRain(['✨', '💫', '⭐', '🌟'])
    default:
      return null
  }
}

function fireConfetti(colors) {
  const end = Date.now() + 1800
  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, zIndex: 100001 })
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, zIndex: 100001 })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

function fireFireworks(colors) {
  const duration = 2200
  const end = Date.now() + duration
  const shoot = () => {
    confetti({
      particleCount: 60,
      startVelocity: 30,
      spread: 360,
      ticks: 90,
      origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.2 },
      colors,
      shapes: ['circle', 'square'],
      zIndex: 100001,
    })
    if (Date.now() < end) setTimeout(shoot, 320)
  }
  shoot()
}

function fireShapeBurst(emoji, colors, { spread = 70, startVelocity = 45, gravity = 0.8 } = {}) {
  if (typeof confetti.shapeFromText !== 'function') return fireConfetti(colors)
  const shape = confetti.shapeFromText({ text: emoji, scalar: 2 })
  confetti({
    particleCount: 40,
    spread,
    startVelocity,
    gravity,
    ticks: 140,
    scalar: 2,
    shapes: [shape],
    origin: { x: 0.5, y: 0.6 },
    zIndex: 100001,
  })
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: spread + 20,
      startVelocity: startVelocity - 10,
      gravity,
      scalar: 2,
      shapes: [shape],
      origin: { x: 0.5, y: 0.7 },
      zIndex: 100001,
    })
  }, 350)
}

function fireStarShower(colors) {
  if (typeof confetti.shapeFromText !== 'function') return fireConfetti(colors)
  const shape = confetti.shapeFromText({ text: '⭐', scalar: 1.8 })
  const end = Date.now() + 2000
  const frame = () => {
    confetti({
      particleCount: 5,
      spread: 180,
      startVelocity: 20,
      ticks: 200,
      gravity: 0.35,
      scalar: 1.8,
      shapes: [shape],
      colors,
      origin: { x: Math.random(), y: -0.1 },
      zIndex: 100001,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

function fireEmojiRain(emojis) {
  if (typeof confetti.shapeFromText !== 'function') return null
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

export function getAmbientPreset(type, colors = DEFAULT_COLORS) {
  const palette = resolveColors(colors)
  switch (type) {
    case 'sparkle':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 80, density: { enable: true, area: 800 } },
          color: { value: palette },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.2, max: 0.9 }, animation: { enable: true, speed: 2, sync: false } },
          size: { value: { min: 1, max: 3 } },
          move: { enable: true, speed: 0.4, direction: 'none', random: true, outModes: 'out' },
        },
      }
    case 'stars':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 120, density: { enable: true, area: 900 } },
          color: { value: palette },
          shape: { type: 'star' },
          opacity: { value: 0.8, animation: { enable: true, speed: 1, sync: false } },
          size: { value: { min: 1, max: 3 } },
          move: { enable: true, speed: 0.2, direction: 'none', outModes: 'out' },
        },
      }
    case 'snow':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 150, density: { enable: true, area: 800 } },
          color: { value: '#ffffff' },
          shape: { type: 'circle' },
          opacity: { value: 0.8 },
          size: { value: { min: 1, max: 4 } },
          move: { enable: true, speed: 2, direction: 'bottom', straight: false, outModes: 'out' },
          wobble: { enable: true, distance: 10, speed: 5 },
        },
      }
    case 'bubbles':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 40, density: { enable: true, area: 800 } },
          color: { value: palette },
          shape: { type: 'circle' },
          opacity: { value: 0.4 },
          size: { value: { min: 6, max: 20 } },
          move: { enable: true, speed: 2, direction: 'top', outModes: 'destroy' },
        },
      }
    case 'fountain':
      return {
        ...BASE_FULLSCREEN,
        emitters: {
          position: { x: 50, y: 100 },
          rate: { quantity: 3, delay: 0.1 },
        },
        particles: {
          number: { value: 0 },
          color: { value: palette },
          shape: { type: 'circle' },
          opacity: { value: { min: 0.3, max: 0.9 } },
          size: { value: { min: 2, max: 5 } },
          move: {
            enable: true,
            gravity: { enable: true, acceleration: 20 },
            speed: { min: 15, max: 25 },
            direction: 'top',
            outModes: { default: 'destroy', bottom: 'none' },
          },
          life: { duration: { value: 4 }, count: 1 },
        },
      }
    case 'hearts':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 30, density: { enable: true, area: 900 } },
          color: { value: ['#ff6b9d', '#ff9bd2', '#ffc2e2'] },
          shape: { type: 'char', options: { char: { value: ['❤'], font: 'Verdana', weight: '400' } } },
          opacity: { value: 0.85 },
          size: { value: { min: 10, max: 22 } },
          move: { enable: true, speed: 1.2, direction: 'top', outModes: 'out' },
        },
      }
    case 'fireflies':
      return {
        ...BASE_FULLSCREEN,
        particles: {
          number: { value: 60 },
          color: { value: ['#fff6b3', '#ffd166', '#f6ffa2'] },
          shape: { type: 'circle' },
          opacity: {
            value: { min: 0.1, max: 1 },
            animation: { enable: true, speed: 3, sync: false, startValue: 'random' },
          },
          size: { value: { min: 1, max: 3 } },
          move: {
            enable: true,
            speed: 0.6,
            direction: 'none',
            random: true,
            straight: false,
            outModes: 'bounce',
          },
        },
      }
    default:
      return null
  }
}
