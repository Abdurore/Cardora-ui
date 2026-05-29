// Default card object matching the backend schema exactly
export const defaultCardObject = {
  // Palette anchor — the currently applied color palette. Non-artist users
  // pick a palette and it cascades across theme, card, closedState, envelope,
  // and questions.button colors. null means no palette has been applied yet
  // (either a blank draft or an artist-authored template using per-field colors).
  palette: null,

  background: {
    type: 'color',
    colors: ['#0a0a0a'],
    animationDuration: 2,
    imageUrl: '',
    videoUrl: '',
    music: {
      url: '',
      isUploaded: false,
      volume: 0.8,
      // Trim points in seconds. 0/0 means play the full track. When endSec > 0
      // the player loops the [startSec, endSec] window only — set by the admin
      // when curating tracks for the studio library.
      startSec: 0,
      endSec: 0,
    },
  },

  theme: {
    fontFamily: 'Cinzel',
    headingSize: 28,
    bodySize: 16,
    accentColor: '#76efff',
    textColor: '#ffffff',
    headingColor: '#ffffff',
  },

  card: {
    backgroundColor: '#111111',
    // 0 = fully opaque, 1 = fully transparent. Renders through a separate
    // background layer so content (text, images) stays at 100% opacity.
    backgroundOpacity: 0,
    textColor: '#ffffff',
    headingColor: '#ffffff',
    cardBorder: {
      type: 'solid',
      colors: ['#333333'],
      width: 2,
      animationDuration: 2,
    },
    scrollbarColor: '#888888',
    textBodyAnimation: {
      fadeInDuration: '2',
      selfTypeSpeed: 'none',
    },
  },

  closedState: {
    backgroundColor: '#111111',
    borderColor: '#333333',
    textColor: '#cccccc',
    headingColor: '#ffffff',
    headingFont: 'Cinzel',
    headingText: 'You have a surprise',
    bodyText: 'Someone special sent you something beautiful.',
    button: {
      text: 'Open',
      backgroundColor: '#76efff',
      textColor: '#000000',
      borderColor: '#76efff',
      shape: 'pill',
    },
    envelope: {
      paperTexture: 'smooth',
      bodyColor: '#1a1f2c',
      flapColor: '#242a38',
      sealColor: '#b03030',
      sealIcon: 'monogram',
      showMonogram: true,
      recipientCaption: '',
      pacing: 'normal',
    },
  },

  animation: {
    openEffect: 'confetti',
    confettiColors: ['#76efff', '#62ffa2', '#ff9bd2'],
    backgroundEffect: {
      type: 'fireflies',
      emojis: ['✨', '💫'],
    },
  },

  media: {
    images: [],
  },

  interaction: {
    lock: {
      type: 'none',
      value: '',
    },
    reveal: {
      type: 'tap',
      hint: '',
    },
  },

  content: {
    heading: 'Your special message',
    body: 'Write something beautiful here...',
    extendedBody: '',
  },

  questions: {
    items: [],
    button: {
      textColor: '#ffffff',
      borderColor: '#76efff',
      backgroundColor: '#111111',
    },
    denyBehavior: 'none',
  },

  giftEffect: {
    enabled: false,
    effectKey: 'none',
    giftTitle: '',
    giftAmount: '',
  },

  layout: {
    elementOrder: ['media', 'heading', 'body'],
  },
}

// Free ambient music URLs (royalty-free). Each preset declares a minimum tier —
// Classic never sees music; Premium gets the first two lighter moods; Elite gets
// the full library + any admin-curated tracks.
export const musicPresets = [
  {
    label: 'Soft Piano',
    url: 'https://cdn.pixabay.com/audio/2024/11/29/audio_a0727dc75c.mp3',
    tier: 'premium',
  },
  {
    label: 'Gentle Ambience',
    url: 'https://cdn.pixabay.com/audio/2022/02/23/audio_ea70ad31a4.mp3',
    tier: 'premium',
  },
  {
    label: 'Romantic Strings',
    url: 'https://cdn.pixabay.com/audio/2024/02/14/audio_8ceb40cf47.mp3',
    tier: 'elite',
  },
  {
    label: 'Celebration',
    url: 'https://cdn.pixabay.com/audio/2021/11/10/audio_f4c1282990.mp3',
    tier: 'elite',
  },
]

const MUSIC_TIER_RANK = { classic: 0, premium: 1, elite: 2 }

export function getMusicPresetsForTier(tier, { isArtist = false } = {}) {
  if (isArtist) return musicPresets
  const rank = MUSIC_TIER_RANK[tier] || 0
  return musicPresets.filter((p) => (MUSIC_TIER_RANK[p.tier] || 0) <= rank)
}

// Font options — tiered library
export const FONTS_BASIC = [
  'Cinzel',
  'Manrope',
  'Playfair Display',
  'Inter',
  'Outfit',
  'Poppins',
]

export const FONTS_PREMIUM = [
  ...FONTS_BASIC,
  'Lora',
  'Merriweather',
  'Montserrat',
  'Raleway',
  'Josefin Sans',
  'Quicksand',
  'Nunito',
  'Dancing Script',
  'Great Vibes',
]

export const FONTS_ELITE = [
  ...FONTS_PREMIUM,
  'Abril Fatface',
  'Bebas Neue',
  'DM Serif Display',
  'EB Garamond',
  'Cormorant Garamond',
  'Pacifico',
  'Lobster',
  'Sacramento',
  'Allura',
  'Parisienne',
  'Caveat',
  'Amatic SC',
  'Italianno',
  'Satisfy',
  'Tangerine',
]

/**
 * Returns the list of fonts available for a given card type + tier.
 * - Personal cards: classic & premium share the basic set; elite gets the full library.
 * - Other types: classic → basic, premium → premium, elite → full library.
 */
export function getFontsForTier(cardType, tier) {
  const t = (tier || 'classic').toLowerCase()
  const type = (cardType || 'personal').toLowerCase()
  if (t === 'elite') return FONTS_ELITE
  if (type === 'personal') return FONTS_BASIC
  if (t === 'premium') return FONTS_PREMIUM
  return FONTS_BASIC
}

// Back-compat: legacy code still importing `fontOptions` gets the full list
export const fontOptions = FONTS_ELITE

// Template pre-fills that map to card objects for each template category
export const templateCardObjects = {
  proposal: {
    background: {
      type: 'gradient',
      colors: ['#1a0a1e', '#0a0618', '#160a22'],
      animationDuration: 3,
      imageUrl: '',
      videoUrl: '',
      music: {
        url: 'https://cdn.pixabay.com/audio/2024/11/29/audio_a0727dc75c.mp3',
        isUploaded: false,
        volume: 0.6,
      },
    },
    theme: {
      fontFamily: 'Great Vibes',
      accentColor: '#ff79c6',
      textColor: '#f8e8ff',
      headingColor: '#ffffff',
    },
    card: {
      backgroundColor: '#1a0a22',
      textColor: '#f0d4ff',
      headingColor: '#ffffff',
      cardBorder: {
        type: 'animated',
        colors: ['#ff79c6', '#bd93f9', '#ff92d0'],
        width: 2,
        animationDuration: 3,
      },
      scrollbarColor: '#ff79c6',
      textBodyAnimation: {
        fadeInDuration: '2',
        selfTypeSpeed: 'none',
      },
    },
    closedState: {
      backgroundColor: '#1a0a22',
      borderColor: '#ff79c6',
      textColor: '#e8c4f8',
      headingColor: '#ffffff',
      headingFont: 'Great Vibes',
      headingText: 'Will you?',
      bodyText: 'A question that holds everything.',
      button: {
        text: 'Open My Heart',
        backgroundColor: '#ff79c6',
        textColor: '#1a0a22',
        borderColor: '#ff79c6',
        shape: 'pill',
      },
    },
    animation: {
      openEffect: 'confetti',
      confettiColors: ['#ff79c6', '#bd93f9', '#ff92d0', '#f8e8ff'],
      backgroundEffect: {
        type: 'floating',
        emojis: ['💍', '✨', '💖'],
      },
    },
    media: {
      images: [],
    },
    interaction: {
      lock: { type: 'none', value: '' },
      reveal: { type: 'tap', hint: '' },
    },
    content: {
      heading: 'Will You Be Mine?',
      body: 'Every moment with you feels like a promise. This is mine to you.',
      extendedBody: 'From the first time I saw you, I knew something extraordinary was beginning. Every day since has only confirmed what my heart already knew.',
    },
    questions: {
      items: [{ text: 'Will you say yes?' }],
      button: {
        textColor: '#ffffff',
        borderColor: '#ff79c6',
        backgroundColor: '#1a0a22',
      },
      denyBehavior: 'switch',
    },
  },

  anniversary: {
    background: {
      type: 'gradient',
      colors: ['#1a1408', '#0f0a02', '#1e1a0a'],
      animationDuration: 3,
      imageUrl: '',
      videoUrl: '',
      music: {
        url: 'https://cdn.pixabay.com/audio/2024/02/14/audio_8ceb40cf47.mp3',
        isUploaded: false,
        volume: 0.6,
      },
    },
    theme: {
      fontFamily: 'Playfair Display',
      accentColor: '#ffd700',
      textColor: '#fff3d4',
      headingColor: '#ffffff',
    },
    card: {
      backgroundColor: '#1a1408',
      textColor: '#ffe8b0',
      headingColor: '#ffffff',
      cardBorder: {
        type: 'gradient',
        colors: ['#ffd700', '#ffaa00', '#ffe066'],
        width: 2,
        animationDuration: 2,
      },
      scrollbarColor: '#ffd700',
      textBodyAnimation: {
        fadeInDuration: '2',
        selfTypeSpeed: 'none',
      },
    },
    closedState: {
      backgroundColor: '#1a1408',
      borderColor: '#ffd700',
      textColor: '#ffe8b0',
      headingColor: '#ffffff',
      headingFont: 'Playfair Display',
      headingText: 'Happy Anniversary',
      bodyText: 'A golden moment, wrapped and waiting.',
      button: {
        text: 'Unwrap',
        backgroundColor: '#ffd700',
        textColor: '#1a1408',
        borderColor: '#ffd700',
        shape: 'rounded',
      },
    },
    animation: {
      openEffect: 'confetti',
      confettiColors: ['#ffd700', '#ffaa00', '#ffe066', '#fff3d4'],
      backgroundEffect: {
        type: 'floating',
        emojis: ['💛', '✨', '🌟'],
      },
    },
    media: {
      images: [],
    },
    interaction: {
      lock: { type: 'none', value: '' },
      reveal: { type: 'tap', hint: '' },
    },
    content: {
      heading: 'To Every Year We Built Together',
      body: 'This is a warm glow for the love that only deepens with time.',
      extendedBody: 'From our first conversation to this very moment, every chapter has been more beautiful than the last.',
    },
    questions: {
      items: [{ text: 'What should we do to celebrate?' }],
      button: {
        textColor: '#ffffff',
        borderColor: '#ffd700',
        backgroundColor: '#1a1408',
      },
      denyBehavior: 'none',
    },
  },

  birthday: {
    background: {
      type: 'gradient',
      colors: ['#0a0a1e', '#080416', '#12082a'],
      animationDuration: 2,
      imageUrl: '',
      videoUrl: '',
      music: {
        url: 'https://cdn.pixabay.com/audio/2021/11/10/audio_f4c1282990.mp3',
        isUploaded: false,
        volume: 0.7,
      },
    },
    theme: {
      fontFamily: 'Outfit',
      accentColor: '#a78bfa',
      textColor: '#e8deff',
      headingColor: '#ffffff',
    },
    card: {
      backgroundColor: '#140e24',
      textColor: '#ddd0ff',
      headingColor: '#ffffff',
      cardBorder: {
        type: 'animated',
        colors: ['#a78bfa', '#60a5fa', '#f472b6'],
        width: 2,
        animationDuration: 2,
      },
      scrollbarColor: '#a78bfa',
      textBodyAnimation: {
        fadeInDuration: 'none',
        selfTypeSpeed: '2',
      },
    },
    closedState: {
      backgroundColor: '#140e24',
      borderColor: '#a78bfa',
      textColor: '#d4c4f5',
      headingColor: '#ffffff',
      headingFont: 'Outfit',
      headingText: '🎉 Happy Birthday!',
      bodyText: 'Something special is waiting inside for you.',
      button: {
        text: 'Open Gift',
        backgroundColor: '#a78bfa',
        textColor: '#140e24',
        borderColor: '#a78bfa',
        shape: 'pill',
      },
    },
    animation: {
      openEffect: 'confetti',
      confettiColors: ['#a78bfa', '#60a5fa', '#f472b6', '#fbbf24', '#34d399'],
      backgroundEffect: {
        type: 'floating',
        emojis: ['🎂', '🎈', '🎉', '🎁', '⭐'],
      },
    },
    media: {
      images: [],
    },
    interaction: {
      lock: { type: 'none', value: '' },
      reveal: { type: 'tap', hint: '' },
    },
    content: {
      heading: 'Happy Birthday!',
      body: 'Another year of being absolutely amazing. Here\'s to you!',
      extendedBody: 'May this birthday bring you everything you wish for and more. You deserve all the happiness in the world.',
    },
    questions: {
      items: [{ text: 'What do you wish for this year?' }],
      button: {
        textColor: '#ffffff',
        borderColor: '#a78bfa',
        backgroundColor: '#140e24',
      },
      denyBehavior: 'none',
    },
  },

  scratch: {
    background: {
      type: 'color',
      colors: ['#0a0a0a'],
      animationDuration: 2,
      imageUrl: '',
      videoUrl: '',
      music: {
        url: '',
        isUploaded: false,
        volume: 0.8,
      },
    },
    theme: {
      fontFamily: 'Manrope',
      accentColor: '#76efff',
      textColor: '#ffffff',
      headingColor: '#ffffff',
    },
    card: {
      backgroundColor: '#111111',
      textColor: '#ffffff',
      headingColor: '#ffffff',
      cardBorder: {
        type: 'solid',
        colors: ['#333333'],
        width: 2,
        animationDuration: 2,
      },
      scrollbarColor: '#888888',
      textBodyAnimation: {
        fadeInDuration: '2',
        selfTypeSpeed: 'none',
      },
    },
    closedState: {
      backgroundColor: '#111111',
      borderColor: '#333333',
      textColor: '#cccccc',
      headingColor: '#ffffff',
      headingFont: 'Manrope',
      headingText: 'You got a surprise',
      bodyText: 'Tap to see what\'s inside.',
      button: {
        text: 'Open',
        backgroundColor: '#76efff',
        textColor: '#000000',
        borderColor: '#76efff',
        shape: 'pill',
      },
    },
    animation: {
      openEffect: 'none',
      confettiColors: ['#76efff', '#62ffa2'],
      backgroundEffect: {
        type: 'none',
        emojis: ['✨'],
      },
    },
    media: {
      images: [],
    },
    interaction: {
      lock: { type: 'none', value: '' },
      reveal: { type: 'tap', hint: '' },
    },
    content: {
      heading: 'Your Heading Here',
      body: 'Start writing your message...',
      extendedBody: '',
    },
    questions: {
      items: [],
      button: {
        textColor: '#ffffff',
        borderColor: '#76efff',
        backgroundColor: '#111111',
      },
      denyBehavior: 'none',
    },
  },
}

// Resolves a template card object from catalog card data
export function backfillEnvelope(card) {
  if (!card?.closedState) return card
  if (!card.closedState.envelope) {
    card.closedState.envelope = structuredClone(defaultCardObject.closedState.envelope)
  } else {
    card.closedState.envelope = {
      ...structuredClone(defaultCardObject.closedState.envelope),
      ...card.closedState.envelope,
    }
  }
  return card
}

function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

export function resolveTemplateCardObject(cardData) {
  if (!cardData) return backfillEnvelope(structuredClone(defaultCardObject))

  // When an artist template carries its own layout, use it verbatim — the
  // artist already designed exactly what users should see. Never replace it
  // with a category preset.
  const layoutConfig =
    cardData.cardObject ||
    cardData.layoutConfig ||
    cardData.layoutdata ||
    cardData.backendTemplate?.layoutConfig ||
    cardData.backendTemplate?.layoutdata ||
    null

  let parsedLayout = null
  if (layoutConfig) {
    if (typeof layoutConfig === 'object') {
      parsedLayout = layoutConfig
    } else if (typeof layoutConfig === 'string') {
      try {
        parsedLayout = JSON.parse(layoutConfig)
      } catch (e) {
        console.warn('Failed to parse layoutConfig JSON string:', e)
      }
    }
  }

  if (parsedLayout && typeof parsedLayout === 'object' && Object.keys(parsedLayout).length > 0) {
    const base = deepMerge(structuredClone(defaultCardObject), parsedLayout)
    return backfillEnvelope(base)
  }

  // No layout to clone (e.g. user starting from scratch) — fall back to the
  // blank default. Category-based presets are intentionally no longer used as
  // a fallback layout for personal cards.
  const base = structuredClone(defaultCardObject)
  if (cardData.title) base.content.heading = cardData.title
  if (cardData.message) base.content.body = cardData.message
  if (cardData.subtitle) base.closedState.bodyText = cardData.subtitle
  return backfillEnvelope(base)
}
