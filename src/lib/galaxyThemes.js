// Kept out of studioEffects.js deliberately: that module pulls in
// canvas-confetti, and importing it from the lazily-loaded galaxy chunk made
// Rollup hoist confetti into the main entry bundle for every visitor.
//
// Same { value, label, tier } shape as the AMBIENT_EFFECTS / OPEN_EFFECTS
// registries so the Studio renders it with the same chip picker. `dust` tints
// the spiral arms, `core` the glow at the centre, and `haze` the nebula wash
// behind everything.
export const GALAXY_THEMES = [
  { value: 'rose',    label: 'Rose',    tier: 'elite', dust: ['#ffb3c6', '#ff7aa2', '#ffe0e9'], core: '#ffd9e3', haze: '#4a2630' },
  { value: 'aurora',  label: 'Aurora',  tier: 'elite', dust: ['#7cffcb', '#7ec8ff', '#c792ff'], core: '#d9fff2', haze: '#153a3a' },
  { value: 'ember',   label: 'Ember',   tier: 'elite', dust: ['#ffb347', '#ff7a45', '#ffd67d'], core: '#ffe8c2', haze: '#3d2415' },
  { value: 'violet',  label: 'Violet',  tier: 'elite', dust: ['#c4a0ff', '#8f7aff', '#e8dcff'], core: '#eee3ff', haze: '#2b2145' },
  { value: 'cardora', label: 'Cardora', tier: 'elite', dust: ['#7ef7ff', '#62ffa2', '#c9f7ff'], core: '#e9fbff', haze: '#0d3038' },
]

export function getGalaxyTheme(value) {
  return GALAXY_THEMES.find(t => t.value === value) || GALAXY_THEMES[0]
}
