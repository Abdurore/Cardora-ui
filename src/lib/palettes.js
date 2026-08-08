// Curated color palettes. The palette tool replaces per-field color pickers for
// non-artist users — a single selection cascades into every relevant color on
// the card (envelope, theme, card body, questions button). Artists keep the
// per-field pickers for precision.
//
// Each palette defines four anchors:
//   primary — headings, seal, accent strokes
//   surface — card + envelope body
//   ink     — primary text
//   accent  — secondary highlight (buttons, gradient stops)
//
// Tiers control which palettes are selectable:
//   Classic = 3 free palettes
//   Premium = 8 palettes
//   Elite   = every palette + custom three-color picker (handled in UI)

export const PALETTES = [
  // ── Classic (free tier) ──────────────────────────────────
  {
    id: 'midnight-glow',
    label: 'Midnight Glow',
    tier: 'classic',
    primary: '#7ef7ff',
    surface: '#0b0f12',
    ink:     '#e8f1f4',
    accent:  '#62ffa2',
  },
  {
    id: 'warm-cocoa',
    label: 'Warm Cocoa',
    tier: 'classic',
    primary: '#f4c28a',
    surface: '#1a1410',
    ink:     '#f5eadb',
    accent:  '#d88c5e',
  },
  {
    id: 'paper-ink',
    label: 'Paper & Ink',
    tier: 'classic',
    primary: '#2a2a2a',
    surface: '#faf6ef',
    ink:     '#2a2a2a',
    accent:  '#b03030',
  },
  {
    id: 'navy-slate',
    label: 'Navy Slate',
    tier: 'classic',
    primary: '#93c5fd',
    surface: '#0f1929',
    ink:     '#dbeafe',
    accent:  '#7ee8a2',
  },
  {
    id: 'forest-grove',
    label: 'Forest Grove',
    tier: 'classic',
    primary: '#6ee7b7',
    surface: '#0d1a14',
    ink:     '#ecfdf5',
    accent:  '#fde68a',
  },
  {
    id: 'dusty-rose',
    label: 'Dusty Rose',
    tier: 'classic',
    primary: '#f9a8d4',
    surface: '#1a0e16',
    ink:     '#fdf2f8',
    accent:  '#c4b5fd',
  },

  // ── Premium (8 additional — 14 total with classic) ───────
  {
    id: 'champagne-rose',
    label: 'Champagne Rose',
    tier: 'premium',
    primary: '#e9b6c4',
    surface: '#1b0e14',
    ink:     '#fbe9ef',
    accent:  '#d4a373',
  },
  {
    id: 'ocean-dusk',
    label: 'Ocean Dusk',
    tier: 'premium',
    primary: '#74c0fc',
    surface: '#0a1922',
    ink:     '#e4f2f8',
    accent:  '#a5d8ff',
  },
  {
    id: 'emerald-forest',
    label: 'Emerald Forest',
    tier: 'premium',
    primary: '#9ef6cf',
    surface: '#0c1a13',
    ink:     '#e6f7ef',
    accent:  '#f4c28a',
  },
  {
    id: 'sakura-mist',
    label: 'Sakura Mist',
    tier: 'premium',
    primary: '#ff9bd2',
    surface: '#160d14',
    ink:     '#ffeaf3',
    accent:  '#c9a3ff',
  },
  {
    id: 'amber-vault',
    label: 'Amber Vault',
    tier: 'premium',
    primary: '#f0c060',
    surface: '#141010',
    ink:     '#f7efdd',
    accent:  '#ff9b5a',
  },
  {
    id: 'lavender-haze',
    label: 'Lavender Haze',
    tier: 'premium',
    primary: '#d8b4fe',
    surface: '#120f1e',
    ink:     '#f5f3ff',
    accent:  '#93c5fd',
  },
  {
    id: 'copper-smoke',
    label: 'Copper Smoke',
    tier: 'premium',
    primary: '#fb923c',
    surface: '#1a0f0a',
    ink:     '#fff7ed',
    accent:  '#fbbf24',
  },
  {
    id: 'arctic-storm',
    label: 'Arctic Storm',
    tier: 'premium',
    primary: '#38bdf8',
    surface: '#0c1624',
    ink:     '#f0f9ff',
    accent:  '#7dd3fc',
  },

  // ── Elite (10 additional — 24 total) ─────────────────────
  {
    id: 'royal-velvet',
    label: 'Royal Velvet',
    tier: 'elite',
    primary: '#c9a3ff',
    surface: '#120a1f',
    ink:     '#efe4ff',
    accent:  '#ffd700',
  },
  {
    id: 'aurora-frost',
    label: 'Aurora Frost',
    tier: 'elite',
    primary: '#9ef6cf',
    surface: '#0a1424',
    ink:     '#e9f7ff',
    accent:  '#ff9bd2',
  },
  {
    id: 'golden-hour',
    label: 'Golden Hour',
    tier: 'elite',
    primary: '#ffb86b',
    surface: '#1a0f08',
    ink:     '#ffe7cc',
    accent:  '#ff6b9b',
  },
  {
    id: 'nebula-ink',
    label: 'Nebula Ink',
    tier: 'elite',
    primary: '#a78bfa',
    surface: '#0a0a1a',
    ink:     '#e9e6ff',
    accent:  '#60a5fa',
  },
  {
    id: 'coral-tide',
    label: 'Coral Tide',
    tier: 'elite',
    primary: '#ff8a85',
    surface: '#1a0e10',
    ink:     '#ffe4e1',
    accent:  '#74c0fc',
  },
  {
    id: 'monochrome-noir',
    label: 'Monochrome Noir',
    tier: 'elite',
    primary: '#f2f2f2',
    surface: '#050505',
    ink:     '#f2f2f2',
    accent:  '#b03030',
  },
  {
    id: 'jade-parchment',
    label: 'Jade Parchment',
    tier: 'elite',
    primary: '#0f6b4b',
    surface: '#f5ecd9',
    ink:     '#2a2a2a',
    accent:  '#b03030',
  },
  {
    id: 'crimson-noir',
    label: 'Crimson Noir',
    tier: 'elite',
    primary: '#f87171',
    surface: '#0d0305',
    ink:     '#fff1f2',
    accent:  '#fca5a5',
  },
  {
    id: 'deep-space',
    label: 'Deep Space',
    tier: 'elite',
    primary: '#818cf8',
    surface: '#020617',
    ink:     '#eef2ff',
    accent:  '#38bdf8',
  },
  {
    id: 'copper-luxe',
    label: 'Copper Luxe',
    tier: 'elite',
    primary: '#e4a84b',
    surface: '#0f0a06',
    ink:     '#fef3c7',
    accent:  '#c084fc',
  },
]

export function getPaletteById(id) {
  return PALETTES.find((p) => p.id === id) || null
}

// Tier→allowed palette IDs. Higher tiers inherit lower tiers' palettes.
export function getPalettesForTier(tier) {
  const key = String(tier || 'classic').toLowerCase()
  const levels = { classic: ['classic'], premium: ['classic', 'premium'], elite: ['classic', 'premium', 'elite'] }
  const allowed = levels[key] || levels.classic
  return PALETTES.filter((p) => allowed.includes(p.tier))
}

// Cascade a palette into all color fields on a cardObject. Returns a new object
// — does not mutate. Preserves fields the palette doesn't cover (fonts, images,
// interaction, questions copy, etc).
export function applyPalette(cardObject, palette) {
  if (!cardObject || !palette) return cardObject
  const { primary, surface, ink, accent } = palette

  // Structured clone would be ideal but we only need to rewrite the color
  // leaves — shallow-merge each subtree we touch.
  const next = { ...cardObject }

  next.theme = {
    ...(cardObject.theme || {}),
    accentColor: accent,
    textColor: ink,
    headingColor: primary,
  }

  next.card = {
    ...(cardObject.card || {}),
    backgroundColor: surface,
    textColor: ink,
    headingColor: primary,
    scrollbarColor: primary,
  }

  const closed = cardObject.closedState || {}
  next.closedState = {
    ...closed,
    backgroundColor: surface,
    borderColor: primary,
    textColor: ink,
    headingColor: primary,
    button: {
      ...(closed.button || {}),
      textColor: surface,
      backgroundColor: primary,
      borderColor: primary,
    },
    envelope: {
      ...(closed.envelope || {}),
      bodyColor: surface,
      flapColor: mix(surface, primary, 0.12),
      sealColor: accent,
    },
  }

  next.questions = {
    ...(cardObject.questions || {}),
    button: {
      ...((cardObject.questions || {}).button || {}),
      textColor: surface,
      backgroundColor: primary,
      borderColor: primary,
    },
  }

  // Mark the palette on the card so the Studio knows which chip is "active"
  // and the backend can persist the selection.
  next.palette = { id: palette.id, primary, surface, ink, accent }

  return next
}

// The exact envelope colors applyPalette cascades for a given palette. Used by
// tierRequirements to tell "colors set by picking a palette" (free) apart from
// "colors the user hand-tuned afterwards" (an elite touch) — without this,
// every palette selection would read as custom envelope colors.
export function expectedEnvelopeColors(palette) {
  if (!palette) return null
  return {
    bodyColor: palette.surface,
    flapColor: mix(palette.surface, palette.primary, 0.12),
    sealColor: palette.accent,
  }
}

// Mix two hex colors by `weight` (0..1 → fully `a`..fully `b`). Used to derive
// the envelope flap color as a gentle step off the surface toward the primary.
export function mix(a, b, weight) {
  const pa = parseHex(a)
  const pb = parseHex(b)
  if (!pa || !pb) return a
  const r = Math.round(pa.r + (pb.r - pa.r) * weight)
  const g = Math.round(pa.g + (pb.g - pa.g) * weight)
  const bl = Math.round(pa.b + (pb.b - pa.b) * weight)
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function parseHex(hex) {
  if (typeof hex !== 'string') return null
  let h = hex.replace('#', '')
  if (/^[0-9a-f]{3}$/i.test(h)) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
