import { useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  HiOutlineEnvelope, HiOutlinePaintBrush, HiOutlinePhoto,
  HiOutlineSparkles, HiOutlineChatBubbleLeft, HiOutlineLockClosed,
  HiOutlineDocumentText, HiOutlineMusicalNote, HiOutlineEye,
  HiOutlineGift, HiOutlineChartBarSquare, HiOutlineLightBulb,
  HiOutlineArrowPathRoundedSquare, HiOutlineEyeSlash
} from 'react-icons/hi2'
import { IoColorPaletteOutline } from 'react-icons/io5'
import { defaultCardObject, resolveTemplateCardObject, musicPresets, getFontsForTier } from '../data/cardDefaults.js'
import CardPreviewModal from '../components/CardPreviewModal.jsx'
import Dropdown from '../components/Dropdown.jsx'
import ColorPicker from '../components/ColorPicker.jsx'
import { uploadToCloudinary } from '../lib/cloudinary.js'
import { getMediaVideos, getMediaMusic } from '../lib/api.js'
import { OPEN_EFFECTS, AMBIENT_EFFECTS } from '../lib/studioEffects.js'
import { getMusicPresetsForTier } from '../data/cardDefaults.js'
import { getTierLimits } from '../lib/tierLimits.js'
import { getPalettesForTier, applyPalette, getPaletteById } from '../lib/palettes.js'

const STUDIO_DRAFT_PREFIX = 'cardora:studioDrafts:'
const BRAND_LOGO = '/cardora-logo.png?v=4'

const steps = ['closed', 'card', 'questions', 'preview']

const ALL_TOOLS = [
  { id: 'closedState', icon: HiOutlineEnvelope, label: 'Envelope', hint: 'Sealed reveal & first impression', group: 'Content' },
  { id: 'content', icon: HiOutlineDocumentText, label: 'Content', hint: 'Heading, body, extended', group: 'Content' },
  { id: 'media', icon: HiOutlinePhoto, label: 'Media', hint: 'Images & captions', group: 'Content' },
  { id: 'theme', icon: IoColorPaletteOutline, label: 'Theme', hint: 'Palette, fonts, sizing', group: 'Style' },
  { id: 'background', icon: HiOutlinePaintBrush, label: 'Background', hint: 'Colors, gradients, music', group: 'Style' },
  { id: 'cardStyle', icon: HiOutlineSparkles, label: 'Card Style', hint: 'Border, scrollbar, text FX', group: 'Style' },
  { id: 'animation', icon: HiOutlineSparkles, label: 'Animation', hint: 'Confetti & effects', group: 'Effects' },
  { id: 'gifts', icon: HiOutlineGift, label: 'Gifts', hint: 'End-of-card gift reveal', group: 'Interactive' },
  { id: 'questions', icon: HiOutlineChatBubbleLeft, label: 'Questions', hint: 'Receiver interaction', group: 'Interactive' },
  { id: 'interaction', icon: HiOutlineLockClosed, label: 'Interaction', hint: 'Lock & reveal', group: 'Interactive' },
  { id: 'poll', icon: HiOutlineChartBarSquare, label: 'Poll', hint: 'Question with selectable choices', group: 'Interactive' },
  { id: 'trivia', icon: HiOutlineLightBulb, label: 'Trivia', hint: 'Scored quiz with correct answers', group: 'Interactive' },
  { id: 'chain', icon: HiOutlineArrowPathRoundedSquare, label: 'Chain', hint: 'Invite recipient to reply with a card', group: 'Interactive' },
  { id: 'anon', icon: HiOutlineEyeSlash, label: 'Anonymous', hint: 'Tag as anonymous inbox template', group: 'Interactive' },
]

const TOOL_GROUP_ORDER = ['Content', 'Style', 'Effects', 'Interactive']

// Curated question prompts. Senders rarely come in with a question already
// written — these turn the questions panel from a blank array builder into a
// "pick & remix" surface.
const QUESTION_PRESETS = [
  { id: 'one-thing', emoji: '💌', text: 'What\'s one thing you\'ll always remember about us?' },
  { id: 'feel-now', emoji: '✨', text: 'How do you feel reading this right now?' },
  { id: 'reply-back', emoji: '🎈', text: 'If you could send one word back, what would it be?' },
  { id: 'gratitude', emoji: '🌷', text: 'What\'s something you\'ve been grateful for lately?' },
  { id: 'next-meet', emoji: '📍', text: 'When are we seeing each other next?' },
  { id: 'secret', emoji: '🔒', text: 'Tell me a secret only you and I would know.' },
]

// Named gradient/animated border presets. `tier` decides minimum tier. The
// `mode` field hints whether the preset is best paired with `gradient` or
// `animated` border type — clicking it writes both `colors` and `type`.
const BORDER_PRESETS = [
  { id: 'aurora',      label: 'Aurora',     tier: 'premium', mode: 'animated', colors: ['#7ef7ff', '#62ffa2', '#a78bfa'] },
  { id: 'sunset',      label: 'Sunset',     tier: 'premium', mode: 'gradient', colors: ['#ff9bd2', '#ffd166', '#ff7a59'] },
  { id: 'ocean',       label: 'Ocean',      tier: 'premium', mode: 'gradient', colors: ['#0ea5e9', '#76efff', '#a5f3fc'] },
  { id: 'monochrome',  label: 'Monochrome', tier: 'premium', mode: 'gradient', colors: ['#1f2937', '#9ca3af', '#f3f4f6'] },
  { id: 'neon',        label: 'Neon',       tier: 'elite',   mode: 'animated', colors: ['#ff00ea', '#00f5ff', '#39ff14', '#ff8a00'] },
  { id: 'gold-foil',   label: 'Gold Foil',  tier: 'elite',   mode: 'animated', colors: ['#fff7c2', '#ffd166', '#b8860b', '#ffd166'] },
  { id: 'rosegold',    label: 'Rose Gold',  tier: 'elite',   mode: 'gradient', colors: ['#ffc8a2', '#e8a3a3', '#c97b84', '#ffe4d6'] },
  { id: 'midnight',    label: 'Midnight',   tier: 'elite',   mode: 'animated', colors: ['#0b1d51', '#7b2cbf', '#3a86ff', '#caf0f8'] },
]

// Tools available per type + tier — aligned to home page tier promises:
// Classic  = simple animated reveal, no music/media ("Simple animation, No music")
// Premium  = music + better visuals ("Music + better visuals, Richer motion")
// Elite    = full experience + gifts ("Full animations + effects, gifts") — Personal Card only
const TOOLS_BY_TYPE_TIER = {
  'personal:classic': ['closedState', 'content', 'background', 'theme'],
  'personal:premium': ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation'],
  'personal:elite':   ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'questions', 'interaction', 'gifts'],
  'poll:classic':   ['closedState', 'content', 'background', 'theme', 'poll'],
  'poll:premium':   ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'poll'],
  'trivia:classic': ['closedState', 'content', 'background', 'theme', 'trivia'],
  'trivia:premium': ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'trivia'],
  'chain:classic':  ['closedState', 'content', 'background', 'theme', 'chain'],
  'chain:premium':  ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'chain'],
  'anonymous:classic':   ['closedState', 'content', 'background', 'theme', 'anon'],
  'anonymous:premium':   ['closedState', 'content', 'media', 'background', 'theme', 'animation', 'anon'],
}

const STUDIO_TYPE_META = {
  personal:  { emoji: '💌', label: 'Personal Card', badge: 'badge-moment' },
  poll:      { emoji: '📊', label: 'Poll Card',   badge: 'badge-poll' },
  trivia:    { emoji: '💡', label: 'Trivia Card', badge: 'badge-trivia' },
  chain:     { emoji: '🔗', label: 'Chain Card',  badge: 'badge-chain' },
  anonymous: { emoji: '👁', label: 'Anonymous',   badge: 'badge-anon' },
}

const TYPE_ACCENT = {
  personal:  '#f0c060',
  poll:      '#60a5fa',
  trivia:    '#a78bfa',
  chain:     '#f97316',
  anonymous: '#7ef7ff',
}

const TIER_LABELS = { classic: 'Classic', premium: 'Premium', elite: 'Elite' }

const TIER_COST_BY_TYPE = {
  personal:  { classic: 0, premium: 10, elite: 25 },
  poll:      { classic: 0, premium: 25, elite: 25 },
  trivia:    { classic: 0, premium: 25, elite: 25 },
  chain:     { classic: 0, premium: 25, elite: 25 },
  anonymous: { classic: 0, premium: 45, elite: 45 },
}

const TYPE_LABEL = {
  personal:  'Personal Card',
  poll:      'Poll Card',
  trivia:    'Trivia Card',
  chain:     'Chain Card',
  anonymous: 'Anonymous',
}

const SHARE_PLATFORMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    getUrl: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#2AABEE',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    getUrl: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    color: '#1DA1F2',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    getUrl: (url, title) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
]

// Deep merge helper
function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

function ColorInput({ value, onChange, label }) {
  return (
    <label className="cs-color-field">
      <span>{label}</span>
      <div className="cs-color-wrap">
        <ColorPicker value={value} onChange={onChange} />
        <input
          type="text"
          value={value}
          onChange={onChange}
          className="cs-color-text"
          maxLength={7}
        />
      </div>
    </label>
  )
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function wrapCanvasText(ctx, text, centerX, startY, maxWidth, lineHeight) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (!words.length) return
  let line = ''
  let currentY = startY

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      ctx.fillText(line, centerX, currentY)
      line = word
      currentY += lineHeight
    } else {
      line = nextLine
    }
  }

  if (line) ctx.fillText(line, centerX, currentY)
}


function StudioAudioPlayer({ src, volume = 0.8 }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
  }, [volume, src])

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
  }, [src])

  const togglePlayback = async () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }
    try {
      await audioRef.current.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  return (
    <div className="cs-audio-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onEnded={() => {
          setIsPlaying(false)
          setCurrentTime(0)
        }}
      />
      <button type="button" className="cs-audio-toggle" onClick={togglePlayback}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <div className="cs-audio-track">
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            const nextTime = Number(event.target.value)
            setCurrentTime(nextTime)
            if (audioRef.current) audioRef.current.currentTime = nextTime
          }}
        />
        <div className="cs-audio-meta">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}

function CardStudio() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { currentUser, publishTemplate, createCardOnBackend, refreshBalance, balance } = useOutletContext() || {}
  // Read card type and tier from location state (set by CreateCardPicker)
  const cardData = useMemo(() => location.state?.cardData || null, [location.state])
  const existingDraftObject = useMemo(() => location.state?.draftCardObject || null, [location.state])
  const draftIdRef = useRef(location.state?.draftId || cardData?.draftId || `draft-${Date.now()}`)
  const draftStorageKey = currentUser?.id
    ? `${STUDIO_DRAFT_PREFIX}${currentUser.id}`
    : `${STUDIO_DRAFT_PREFIX}guest`

  // -- Card type + tier from URL --
  const studioType = searchParams.get('type') || 'personal'
  const studioTier = searchParams.get('tier') || 'classic'
  const typeMeta = STUDIO_TYPE_META[studioType] || STUDIO_TYPE_META.personal
  const tierLabel = TIER_LABELS[studioTier] || 'Classic'
  const tierCost = (TIER_COST_BY_TYPE[studioType] || TIER_COST_BY_TYPE.personal)[studioTier] ?? 0

  // Filter tools by type + tier — aligned to home page tier promises
  const isArtist = currentUser?.role === 'Artist'
  const allowedToolIds = useMemo(() => {
    if (isArtist) {
      // Artists bypass tool visibility gating — they can use every tool the type supports.
      const anyTierForType = Object.keys(TOOLS_BY_TYPE_TIER)
        .filter((k) => k.startsWith(`${studioType}:`))
        .reduce((acc, k) => {
          TOOLS_BY_TYPE_TIER[k].forEach((id) => acc.add(id))
          return acc
        }, new Set())
      if (anyTierForType.size) return Array.from(anyTierForType)
    }
    const key = `${studioType}:${studioTier}`
    return TOOLS_BY_TYPE_TIER[key] || TOOLS_BY_TYPE_TIER[`${studioType}:classic`] || TOOLS_BY_TYPE_TIER['personal:classic']
  }, [studioType, studioTier, isArtist])
  const tierLimits = useMemo(
    () => getTierLimits(studioTier, { isArtist }),
    [studioTier, isArtist],
  )
  const availablePalettes = useMemo(
    () => (isArtist ? getPalettesForTier('elite') : getPalettesForTier(studioTier)),
    [studioTier, isArtist],
  )

  // Shared gate helper for tier-scoped presets (open effects, ambient, music).
  // `requiredTier` is one of 'premium' | 'elite'. Returns true when the current
  // studio tier meets or exceeds that requirement.
  const TIER_ORDER = { classic: 0, premium: 1, elite: 2 }
  const tierHasPresetAccess = (tier, requiredTier) => {
    return (TIER_ORDER[tier] || 0) >= (TIER_ORDER[requiredTier] || 0)
  }
  const activeTools = useMemo(
    () => ALL_TOOLS.filter(t => allowedToolIds.includes(t.id)),
    [allowedToolIds],
  )

  // Tier-gated font library. Labels render in the actual typeface so users can preview them.
  const availableFonts = useMemo(() => getFontsForTier(studioType, studioTier), [studioType, studioTier])
  const fontDropdownOptions = useMemo(
    () => availableFonts.map((f) => ({
      value: f,
      label: <span style={{ fontFamily: `'${f}', serif`, fontSize: '1rem' }}>{f}</span>,
    })),
    [availableFonts],
  )
  const defaultToolId = activeTools[0]?.id || 'content'

  const [cardObject, setCardObject] = useState(() =>
    existingDraftObject ? structuredClone(existingDraftObject) : resolveTemplateCardObject(cardData),
  )
  const [activeTool, setActiveTool] = useState(defaultToolId)
  const [activeStep, setActiveStep] = useState(defaultToolId === 'closedState' ? 'closed' : 'card')
  const [showPreview, setShowPreview] = useState(false)
  const [savedState, setSavedState] = useState('Unsaved draft')
  const [showPublish, setShowPublish] = useState(false)
  const [publishForm, setPublishForm] = useState({
    name: cardData?.title || existingDraftObject?.content?.heading || resolveTemplateCardObject(cardData).content.heading,
  })
  const [publishError, setPublishError] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(null) // { name, previewImage } | null
  const [publishScreenshot, setPublishScreenshot] = useState(null) // { previewUrl, cloudUrl } | null
  const [screenshotUploading, setScreenshotUploading] = useState(false)
  const screenshotInputRef = useRef(null)
  const [emojiInput, setEmojiInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState(null) // { ok, slug?, message }
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendCopied, setSendCopied] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const fileInputRef = useRef(null)
  const pendingUploadsRef = useRef(new Map()) // blobUrl → { file, type }
  const [isUploading, setIsUploading] = useState(false)

  // Poll / Trivia / Chain / Anonymous template state
  const [pollData, setPollData] = useState({ question: '', options: ['', ''], allowMultiple: false })
  const [triviaData, setTriviaData] = useState({
    questions: [{ text: '', options: ['', '', '', ''], correctIndex: 0 }],
  })
  const [chainData, setChainData] = useState({ enabled: false, prompt: '' })
  const [anonTemplate, setAnonTemplate] = useState({ enabled: false, tier: studioTier || 'classic' })
  const [anonPreviewTab, setAnonPreviewTab] = useState('sender') // 'sender' | 'recipient'

  // Admin-curated media
  const [adminVideos, setAdminVideos] = useState([])
  const [adminMusic, setAdminMusic] = useState([])

  useEffect(() => {
    Promise.allSettled([getMediaVideos(), getMediaMusic()]).then(([vRes, mRes]) => {
      if (vRes.status === 'fulfilled') setAdminVideos(vRes.value?.data?.videos || vRes.value?.videos || [])
      if (mRes.status === 'fulfilled') setAdminMusic(mRes.value?.data?.music || mRes.value?.music || [])
    })
  }, [])

  // Set active tool and auto-enable state for specific card types on mount
  useEffect(() => {
    if (studioType === 'poll') setActiveTool('poll')
    else if (studioType === 'trivia') setActiveTool('trivia')
    else if (studioType === 'chain') { setChainData(prev => ({ ...prev, enabled: true })); setActiveTool('chain') }
    else if (studioType === 'anonymous') { setAnonTemplate(prev => ({ ...prev, enabled: true, tier: studioTier })); setActiveTool(defaultToolId) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Snap font to a tier-allowed family when the current pick isn't available at this tier.
  useEffect(() => {
    const fallback = availableFonts[0] || 'Cinzel'
    setCardObject(prev => {
      const themeFont = prev.theme?.fontFamily
      const closedFont = prev.closedState?.headingFont
      const themeOk = availableFonts.includes(themeFont)
      const closedOk = availableFonts.includes(closedFont)
      if (themeOk && closedOk) return prev
      const next = structuredClone(prev)
      if (!themeOk) next.theme.fontFamily = fallback
      if (!closedOk) next.closedState.headingFont = fallback
      return next
    })
  }, [availableFonts])

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      pendingUploadsRef.current.forEach((_, blobUrl) => URL.revokeObjectURL(blobUrl))
      pendingUploadsRef.current.clear()
    }
  }, [])

  const flushPendingUploads = async (cardObj) => {
    if (pendingUploadsRef.current.size === 0) return cardObj
    let json = JSON.stringify(cardObj)
    for (const [blobUrl, { file, type }] of pendingUploadsRef.current.entries()) {
      if (!json.includes(blobUrl)) { URL.revokeObjectURL(blobUrl); pendingUploadsRef.current.delete(blobUrl); continue }
      const cloudUrl = await uploadToCloudinary(file, type)
      json = json.replaceAll(blobUrl, cloudUrl)
      URL.revokeObjectURL(blobUrl)
      pendingUploadsRef.current.delete(blobUrl)
    }
    return JSON.parse(json)
  }

  const c = cardObject

  const handleScreenshotFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPublishError('Please select an image file (PNG, JPG, or WebP).')
      return
    }
    setPublishError('')
    setScreenshotUploading(true)
    const localPreview = URL.createObjectURL(file)
    setPublishScreenshot({ previewUrl: localPreview, cloudUrl: null })
    try {
      const cloudUrl = await uploadToCloudinary(file, 'image')
      setPublishScreenshot({ previewUrl: localPreview, cloudUrl })
    } catch (err) {
      setPublishError(err.message || 'Screenshot upload failed.')
      setPublishScreenshot(null)
    } finally {
      setScreenshotUploading(false)
    }
  }

  const handlePublish = async () => {
    if (!publishForm.name.trim()) {
      setPublishError('Template name is required.')
      return
    }
    if (!publishScreenshot?.cloudUrl) {
      setPublishError('Please upload a screenshot of your card first.')
      return
    }

    setPublishError('')
    setIsPublishing(true)

    try {
      const flushedForPublish = await flushPendingUploads(cardObject)
      setCardObject(flushedForPublish)

      const previewImage = publishScreenshot.cloudUrl
      const publishedType = studioType === 'moment' ? 'personal' : studioType
      const result = await publishTemplate?.({
        name: publishForm.name.trim(),
        type: publishedType,
        tier: studioTier,
        previewImage,
        layoutConfig: structuredClone({
          ...flushedForPublish,
          type: publishedType,
          tier: studioTier,
          previewImage,
          previewUrl: previewImage,
        }),
      })

      if (!result?.ok) {
        setPublishError(result?.message || 'Could not submit the template.')
        return
      }

      setShowPublish(false)
      setSavedState('Template submitted for review')
      setPublishSuccess({ name: publishForm.name.trim(), previewImage })
      setPublishScreenshot(null)
    } catch (error) {
      setPublishError(error.message || 'Could not submit the template.')
    } finally {
      setIsPublishing(false)
    }
  }


  // Updater helpers
  const update = (path, value) => {
    setCardObject(prev => {
      const keys = path.split('.')
      const result = structuredClone(prev)
      let current = result
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] == null || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return result
    })
  }

  const goToStep = (step) => {
    setActiveStep(step)
    if (step === 'closed') setActiveTool('closedState')
    if (step === 'card') setActiveTool('content')
    if (step === 'questions') setActiveTool('questions')
    if (step === 'preview') {
      setShowPreview(true)
    }
  }

  const enterPreview = () => {
    setShowPreview(true)
    setActiveStep('preview')
  }

  const handleSend = async () => {
    if (!currentUser) return
    if (tierCost > 0 && (balance ?? 0) < tierCost) {
      setSendResult({ ok: false, message: `You need ${tierCost} CC to send this card. Your balance: ${balance ?? 0} CC.` })
      setShowSendModal(true)
      return
    }
    setIsSending(true)

    let flushedCardObject
    try {
      flushedCardObject = await flushPendingUploads(cardObject)
      setCardObject(flushedCardObject)
    } catch (err) {
      setSendResult({ ok: false, message: 'Media upload failed: ' + err.message })
      setIsSending(false)
      return
    }

    const extras = {
      title: flushedCardObject.content?.heading || 'Untitled Card',
      templateId: cardData?.id || 'custom',
      type: studioType,
      tier: studioTier,
      poll: studioType === 'poll' ? pollData : undefined,
      trivia: studioType === 'trivia' ? triviaData : undefined,
      chain: chainData.enabled ? chainData : undefined,
      anonTemplate: studioType === 'anonymous' ? { enabled: true, tier: studioTier } : undefined,
    }

    const result = await createCardOnBackend?.(flushedCardObject, extras)
    setIsSending(false)
    if (result?.ok) {
      // Backend returns a unique slug per created card — check every possible shape
      const d = result.data || {}
      const slug =
        d.card?.slug || d.card?.shareSlug || d.card?.cardId || d.card?._id ||
        d.slug || d.shareSlug || d.cardId || d._id ||
        d.data?.card?.slug || d.data?.slug || d.data?.cardId || d.data?._id ||
        ''
      if (!slug) {
        console.warn('Card created but no slug returned. Response shape:', d)
      }
      setSendResult({ ok: true, slug, message: result.message })
      refreshBalance?.()
    } else {
      setSendResult({ ok: false, message: result?.message || 'Card creation failed.' })
    }
  }

  const handleSendClick = async () => {
    if (!currentUser) {
      // Show a simple auth notice — open auth modal if available via context
      alert('Please sign in to send a card.')
      return
    }
    await handleSend()
    setShowSendModal(true)
  }

  const handleSave = () => {
    try {
      const draftEntry = {
        id: draftIdRef.current,
        draftId: draftIdRef.current,
        title: c.content?.heading || cardData?.title || 'Untitled Draft',
        subtitle: c.closedState?.bodyText || c.content?.body || 'Card draft',
        message: c.content?.body || '',
        tier: cardData?.tier || studioTier || 'classic',
        type: studioType,
        likes: '0',
        meta: 'Draft',
        updatedAt: new Date().toISOString(),
        cardObject: structuredClone(cardObject),
      }
      localStorage.setItem('cardora:studioCard', JSON.stringify(cardObject))
      const existingDrafts = JSON.parse(localStorage.getItem(draftStorageKey) || '[]')
      const nextDrafts = [draftEntry, ...existingDrafts.filter((draft) => draft.id !== draftEntry.id)]
      localStorage.setItem(draftStorageKey, JSON.stringify(nextDrafts))
      setSavedState('Draft saved just now')
    } catch {
      setSavedState('Save failed')
    }
  }


  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const blobUrl = URL.createObjectURL(file)
    pendingUploadsRef.current.set(blobUrl, { file, type: 'image' })
    update('media.images', [
      ...c.media.images,
      { url: blobUrl, caption: '', fit: 'cover', positionX: 50, positionY: 50 },
    ])
    e.target.value = ''
  }

  const removeImage = (idx) => {
    update('media.images', c.media.images.filter((_, i) => i !== idx))
  }

  const updateImageCaption = (idx, caption) => {
    const imgs = [...c.media.images]
    imgs[idx] = { ...imgs[idx], caption }
    update('media.images', imgs)
  }

  const updateImageSetting = (idx, key, value) => {
    const imgs = [...c.media.images]
    imgs[idx] = { ...imgs[idx], [key]: value }
    update('media.images', imgs)
  }

  const addQuestion = () => {
    const items = [...c.questions.items, { text: 'New question?' }]
    update('questions.items', items)
  }

  const removeQuestion = (idx) => {
    update('questions.items', c.questions.items.filter((_, i) => i !== idx))
  }

  const updateQuestion = (idx, text) => {
    const items = [...c.questions.items]
    items[idx] = { ...items[idx], text }
    update('questions.items', items)
  }

  const addConfettiColor = () => {
    const colors = [...c.animation.confettiColors, '#ffffff']
    update('animation.confettiColors', colors)
  }

  const removeConfettiColor = (idx) => {
    update('animation.confettiColors', c.animation.confettiColors.filter((_, i) => i !== idx))
  }

  const addBackgroundEmoji = () => {
    const nextEmoji = emojiInput.trim()
    if (!nextEmoji) return
    update('animation.backgroundEffect.emojis', [...c.animation.backgroundEffect.emojis, nextEmoji])
    setEmojiInput('')
  }

  const removeBackgroundEmoji = (idx) => {
    update(
      'animation.backgroundEffect.emojis',
      c.animation.backgroundEffect.emojis.filter((_, i) => i !== idx),
    )
  }

  const addBorderColor = () => {
    update('card.cardBorder.colors', [...c.card.cardBorder.colors, '#ffffff'])
  }

  const addBgColor = () => {
    update('background.colors', [...c.background.colors, '#111111'])
  }

  // Tool panels
  const renderPanel = () => {
    // CLOSED STATE
    if (activeTool === 'closedState') {
      const env = c.closedState.envelope || {}
      return (
        <>
          <p className="cs-panel-eyebrow">Envelope</p>
          <h3>Sealed reveal & first impression</h3>
          {!isArtist && !tierLimits.allowCustomPalette && c.palette?.id && (
            <p className="cs-panel-palette-badge">
              Colors cascading from "{getPaletteById(c.palette.id)?.label || 'palette'}" — change in Theme.
            </p>
          )}
          <div className="cs-sub-section">
            <p className="cs-sub-label">Envelope</p>
            {(tierLimits.allowCustomPalette || isArtist) && (
              <>
                <ColorInput label="Body Color" value={env.bodyColor || '#1a1f2c'} onChange={e => update('closedState.envelope.bodyColor', e.target.value)} />
                <ColorInput label="Flap Color" value={env.flapColor || '#242a38'} onChange={e => update('closedState.envelope.flapColor', e.target.value)} />
                <ColorInput label="Seal Color" value={env.sealColor || '#b03030'} onChange={e => update('closedState.envelope.sealColor', e.target.value)} />
              </>
            )}
            <label className="cs-field">
              <span>Paper Texture</span>
              <Dropdown
                value={env.paperTexture || 'smooth'}
                onChange={(v) => update('closedState.envelope.paperTexture', v)}
                options={[
                  { value: 'smooth', label: 'Smooth' },
                  { value: 'linen', label: 'Linen' },
                  { value: 'parchment', label: 'Parchment' },
                ]}
              />
            </label>
            <label className="cs-field">
              <span>Seal Icon</span>
              <Dropdown
                value={env.sealIcon || 'monogram'}
                onChange={(v) => update('closedState.envelope.sealIcon', v)}
                options={[
                  { value: 'monogram', label: 'Monogram (recipient initial)' },
                  { value: 'heart', label: 'Heart' },
                  { value: 'star', label: 'Star' },
                  { value: 'wax', label: 'Plain wax' },
                ]}
              />
            </label>
            <label className="cs-field">
              <span>Recipient Caption</span>
              <input
                value={env.recipientCaption || ''}
                placeholder="Auto from recipient email"
                onChange={e => update('closedState.envelope.recipientCaption', e.target.value)}
              />
            </label>
            <label className="cs-field">
              <span>Pacing</span>
              <Dropdown
                value={env.pacing || 'normal'}
                onChange={(v) => update('closedState.envelope.pacing', v)}
                options={[
                  { value: 'quick', label: 'Quick' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'cinematic', label: 'Cinematic' },
                ]}
              />
            </label>
          </div>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Inner Letter Peek</p>
            {(tierLimits.allowCustomPalette || isArtist) && (
              <>
                <ColorInput label="Background" value={c.closedState.backgroundColor} onChange={e => update('closedState.backgroundColor', e.target.value)} />
                <ColorInput label="Border" value={c.closedState.borderColor} onChange={e => update('closedState.borderColor', e.target.value)} />
                <ColorInput label="Text Color" value={c.closedState.textColor} onChange={e => update('closedState.textColor', e.target.value)} />
                <ColorInput label="Heading Color" value={c.closedState.headingColor} onChange={e => update('closedState.headingColor', e.target.value)} />
              </>
            )}
          <label className="cs-field">
            <span>Heading Font</span>
            <Dropdown
              value={c.closedState.headingFont}
              onChange={(v) => update('closedState.headingFont', v)}
              options={fontDropdownOptions}
            />
          </label>
          <label className="cs-field">
            <span>Heading Text</span>
            <input value={c.closedState.headingText} onChange={e => update('closedState.headingText', e.target.value)} />
          </label>
          <label className="cs-field">
            <span>Body Text</span>
            <textarea rows={3} value={c.closedState.bodyText} onChange={e => update('closedState.bodyText', e.target.value)} />
          </label>
          </div>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Open Button</p>
            <label className="cs-field">
              <span>Button Text</span>
              <input value={c.closedState.button.text} onChange={e => update('closedState.button.text', e.target.value)} />
            </label>
            {(tierLimits.allowCustomPalette || isArtist) && (
              <>
                <ColorInput label="Button BG" value={c.closedState.button.backgroundColor} onChange={e => update('closedState.button.backgroundColor', e.target.value)} />
                <ColorInput label="Button Text" value={c.closedState.button.textColor} onChange={e => update('closedState.button.textColor', e.target.value)} />
                <ColorInput label="Button Border" value={c.closedState.button.borderColor} onChange={e => update('closedState.button.borderColor', e.target.value)} />
              </>
            )}
            <div className="cs-choice-row">
              {['rounded', 'pill', 'square', 'sharp'].map(shape => (
                <button
                  key={shape}
                  type="button"
                  className={`cs-chip ${c.closedState.button.shape === shape ? 'active' : ''}`}
                  onClick={() => update('closedState.button.shape', shape)}
                >
                  {shape}
                </button>
              ))}
            </div>
          </div>
        </>
      )
    }

    // CONTENT
    if (activeTool === 'content') {
      return (
        <>
          <p className="cs-panel-eyebrow">Content</p>
          <h3>Shape your card's message</h3>
          <label className="cs-field">
            <span>Heading</span>
            <input value={c.content.heading} onChange={e => update('content.heading', e.target.value)} />
          </label>
          <label className="cs-field">
            <span>Body</span>
            <textarea rows={4} value={c.content.body} onChange={e => update('content.body', e.target.value)} />
          </label>
          <label className="cs-field">
            <span>Extended Body</span>
            <textarea rows={4} value={c.content.extendedBody} onChange={e => update('content.extendedBody', e.target.value)} placeholder="Additional text shown after the main body..." />
          </label>
        </>
      )
    }

    // MEDIA
    if (activeTool === 'media') {
      return (
        <>
          <p className="cs-panel-eyebrow">Media</p>
          <h3>Add images to your card</h3>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          <button 
            type="button" 
            className={`cs-button ${isUploading ? 'loading' : ''}`} 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : '+ Upload Image'}
          </button>
          {c.media.images.length === 0 && (
            <p className="cs-empty">No images added yet.</p>
          )}
          {c.media.images.map((img, i) => (
            <div key={i} className="cs-image-card">
              <img
                src={img.url}
                alt=""
                className="cs-image-thumb"
                style={{
                  objectFit: img.fit || 'cover',
                  objectPosition: `${img.positionX ?? 50}% ${img.positionY ?? 50}%`,
                }}
              />
              <label className="cs-field">
                <span>Caption</span>
                <input value={img.caption} onChange={e => updateImageCaption(i, e.target.value)} placeholder="Add a caption..." />
              </label>
              <label className="cs-field">
                <span>Image Fit</span>
                <Dropdown
                  value={img.fit || 'cover'}
                  onChange={(v) => updateImageSetting(i, 'fit', v)}
                  options={[
                    { value: 'cover', label: 'Cover' },
                    { value: 'contain', label: 'Contain' },
                  ]}
                />
              </label>
              <label className="cs-field">
                <span>Horizontal Focus</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={img.positionX ?? 50}
                  onChange={e => updateImageSetting(i, 'positionX', Number(e.target.value))}
                />
                <span className="cs-range-val">{img.positionX ?? 50}%</span>
              </label>
              <label className="cs-field">
                <span>Vertical Focus</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={img.positionY ?? 50}
                  onChange={e => updateImageSetting(i, 'positionY', Number(e.target.value))}
                />
                <span className="cs-range-val">{img.positionY ?? 50}%</span>
              </label>
              <button type="button" className="cs-remove-btn" onClick={() => removeImage(i)}>Remove</button>
            </div>
          ))}
        </>
      )
    }

    // BACKGROUND
    if (activeTool === 'background') {
      return (
        <>
          <p className="cs-panel-eyebrow">Background</p>
          <h3>Set the stage</h3>
          <div className="cs-choice-row">
            {['color', 'gradient', 'video', 'animated'].map(type => (
              <button
                key={type}
                type="button"
                className={`cs-chip ${c.background.type === type ? 'active' : ''}`}
                onClick={() => update('background.type', type)}
              >
                {type}
              </button>
            ))}
          </div>

          {(c.background.type === 'color' || c.background.type === 'gradient' || c.background.type === 'animated') && (
            <div className="cs-sub-section">
              <p className="cs-sub-label">Colors</p>
              {c.background.colors.map((color, i) => (
                <div key={i} className="cs-color-row">
                  <ColorInput label={`Color ${i + 1}`} value={color} onChange={e => {
                    const colors = [...c.background.colors]
                    colors[i] = e.target.value
                    update('background.colors', colors)
                  }} />
                  {c.background.colors.length > 1 && (
                    <button type="button" className="cs-inline-remove" onClick={() => {
                      update('background.colors', c.background.colors.filter((_, j) => j !== i))
                    }}>×</button>
                  )}
                </div>
              ))}
              {c.background.type !== 'color' && (
                <button type="button" className="cs-button small" onClick={addBgColor}>+ Add Color</button>
              )}
            </div>
          )}

          {(c.background.type === 'animated' || c.background.type === 'gradient') && (
            <label className="cs-field">
              <span>Animation Duration (s)</span>
              <input type="range" min="1" max="10" step="0.5" value={c.background.animationDuration} onChange={e => update('background.animationDuration', Number(e.target.value))} />
              <span className="cs-range-val">{c.background.animationDuration}s</span>
            </label>
          )}

          {c.background.type === 'video' && (
            <div className="cs-sub-section">
              <p className="cs-sub-label">Background Video</p>
              {adminVideos.length > 0 ? (
                <div className="cs-video-picker-grid">
                  {adminVideos.map((v) => {
                    const url = v.url || v.videoUrl || v.src || ''
                    const label = v.title || v.name || v.label || 'Video'
                    const selected = c.background.videoUrl === url
                    return (
                      <button
                        key={v._id || v.id || url}
                        type="button"
                        className={`cs-video-picker-item ${selected ? 'selected' : ''}`}
                        onClick={() => update('background.videoUrl', url)}
                        title={label}
                      >
                        <div className="cs-video-picker-thumb-wrap">
                          <video
                            src={url}
                            muted
                            loop
                            playsInline
                            className="cs-video-picker-thumb"
                            onMouseEnter={e => e.currentTarget.play()}
                            onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                          />
                          {selected && (
                            <div className="cs-video-picker-check-overlay">
                              <span>✓</span>
                            </div>
                          )}
                        </div>
                        <span className="cs-video-picker-label">{label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="cs-media-empty-state">
                  <span>🎬</span>
                  <p>No videos available yet. Ask your admin to upload some.</p>
                </div>
              )}
              {c.background.videoUrl && (
                <button type="button" className="cs-inline-remove" style={{ marginTop: 8 }} onClick={() => update('background.videoUrl', '')}>Remove video</button>
              )}
            </div>
          )}

          <div className="cs-sub-section">
            <p className="cs-sub-label"><HiOutlineMusicalNote style={{ verticalAlign: 'middle' }} /> Background Music</p>
            {adminMusic.length > 0 ? (
              <div className="cs-music-picker-list">
                {adminMusic.map((track) => {
                  const url = track.url || track.audioUrl || track.src || ''
                  const label = track.title || track.name || track.label || 'Track'
                  const selected = c.background.music.url === url
                  // Carry the admin-configured trim points onto the card so the
                  // recipient hears only the segment the admin curated.
                  const startSec = Number(track.startSec) || 0
                  const endSec = Number(track.endSec) || 0
                  return (
                    <button
                      key={track._id || track.id || url}
                      type="button"
                      className={`cs-music-picker-item ${selected ? 'active' : ''}`}
                      onClick={() => {
                        update('background.music.url', url)
                        update('background.music.isUploaded', false)
                        update('background.music.startSec', startSec)
                        update('background.music.endSec', endSec)
                      }}
                    >
                      <span className="cs-music-picker-icon">♫</span>
                      <span className="cs-music-picker-label">{label}</span>
                      {endSec > 0 && endSec - startSec < (Number(track.duration) || Infinity) && (
                        <span className="cs-music-picker-trim">trimmed</span>
                      )}
                      {selected && <span className="cs-music-picker-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="cs-preset-list">
                {musicPresets.map(preset => {
                  const locked = !isArtist && preset.tier && !tierHasPresetAccess(studioTier, preset.tier)
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={`cs-chip small ${c.background.music.url === preset.url ? 'active' : ''} ${locked ? 'locked' : ''}`}
                      onClick={() => {
                        if (locked) return
                        update('background.music.url', preset.url)
                        update('background.music.isUploaded', false)
                      }}
                      title={locked ? `Requires ${preset.tier === 'elite' ? 'Elite' : 'Premium'}` : undefined}
                      disabled={locked}
                    >
                      ♫ {preset.label}
                      {locked && <span className="cs-chip-badge">{preset.tier === 'elite' ? 'Elite' : 'Premium'}</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {c.background.music.url ? (
              <>
                <StudioAudioPlayer src={c.background.music.url} volume={c.background.music.volume} />
                <button type="button" className="cs-inline-remove" style={{ marginTop: 4 }} onClick={() => update('background.music.url', '')}>Remove track</button>
              </>
            ) : null}
            <label className="cs-field">
              <span>Volume</span>
              <input type="range" min="0" max="1" step="0.05" value={c.background.music.volume} onChange={e => update('background.music.volume', Number(e.target.value))} />
              <span className="cs-range-val">{Math.round(c.background.music.volume * 100)}%</span>
            </label>
          </div>
        </>
      )
    }

    // THEME
    if (activeTool === 'theme') {
      const activePaletteId = c.palette?.id || null
      return (
        <>
          <p className="cs-panel-eyebrow">Theme</p>
          <h3>Global look & feel</h3>

          {/* Palette picker — one selection cascades across the whole card */}
          <div className="cs-sub-section">
            <p className="cs-sub-label">Color Palette</p>
            <p className="cs-field-hint">
              Pick a palette — it applies across the envelope, card, buttons and borders in one go.
            </p>
            <div className="cs-palette-grid">
              {availablePalettes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`cs-palette-chip ${activePaletteId === p.id ? 'active' : ''}`}
                  onClick={() => setCardObject((prev) => applyPalette(prev, p))}
                  title={p.label}
                >
                  <span className="cs-palette-swatches" aria-hidden="true">
                    <span style={{ background: p.surface }} />
                    <span style={{ background: p.primary }} />
                    <span style={{ background: p.accent }} />
                    <span style={{ background: p.ink }} />
                  </span>
                  <span className="cs-palette-label">{p.label}</span>
                </button>
              ))}
            </div>
            <p className="cs-field-hint">
              {availablePalettes.length} palettes on {tierLabel}
              {studioTier !== 'elite' && !isArtist && ' — upgrade to Elite for the full set + custom picker'}
            </p>
          </div>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Typography</p>
            <label className="cs-field">
              <span>Font Family</span>
              <Dropdown
                value={c.theme.fontFamily}
                onChange={(v) => update('theme.fontFamily', v)}
                options={fontDropdownOptions}
              />
            </label>
            <p className="cs-field-hint">
              {availableFonts.length} fonts available on {tierLabel} · {typeMeta.label}
              {studioTier !== 'elite' && ' — upgrade to Elite for the full library'}
            </p>
            <label className="cs-field">
              <span>Heading Size</span>
              <input
                type="range"
                min="18"
                max="48"
                step="1"
                value={c.theme.headingSize ?? 28}
                onChange={e => update('theme.headingSize', Number(e.target.value))}
              />
              <span className="cs-range-val">{c.theme.headingSize ?? 28}px</span>
            </label>
            <label className="cs-field">
              <span>Body Size</span>
              <input
                type="range"
                min="12"
                max="26"
                step="1"
                value={c.theme.bodySize ?? 16}
                onChange={e => update('theme.bodySize', Number(e.target.value))}
              />
              <span className="cs-range-val">{c.theme.bodySize ?? 16}px</span>
            </label>
          </div>

          {/* Advanced per-field colors — only Elite + Artists can fine-tune past the palette */}
          {(tierLimits.allowCustomPalette || isArtist) && (
            <details className="cs-sub-section cs-advanced-colors">
              <summary className="cs-sub-label">Advanced colors (Elite)</summary>
              <p className="cs-field-hint">These override the palette. Use sparingly.</p>
              <ColorInput label="Accent Color" value={c.theme.accentColor} onChange={e => update('theme.accentColor', e.target.value)} />
              <ColorInput label="Text Color" value={c.theme.textColor} onChange={e => update('theme.textColor', e.target.value)} />
              <ColorInput label="Heading Color" value={c.theme.headingColor} onChange={e => update('theme.headingColor', e.target.value)} />
            </details>
          )}
        </>
      )
    }

    // CARD STYLE
    if (activeTool === 'cardStyle') {
      return (
        <>
          <p className="cs-panel-eyebrow">Card Style</p>
          <h3>Surface, border & text animation</h3>
          {!isArtist && !tierLimits.allowCustomPalette && c.palette?.id && (
            <p className="cs-panel-palette-badge">
              Surface colors cascading from "{getPaletteById(c.palette.id)?.label || 'palette'}" — change in Theme.
            </p>
          )}
          {(tierLimits.allowCustomPalette || isArtist) && (
            <>
              <ColorInput label="Card Background" value={c.card.backgroundColor} onChange={e => update('card.backgroundColor', e.target.value)} />
              <ColorInput label="Card Text Color" value={c.card.textColor} onChange={e => update('card.textColor', e.target.value)} />
              <ColorInput label="Card Heading Color" value={c.card.headingColor} onChange={e => update('card.headingColor', e.target.value)} />
              <ColorInput label="Scrollbar Color" value={c.card.scrollbarColor} onChange={e => update('card.scrollbarColor', e.target.value)} />
            </>
          )}

          <label className="cs-field">
            <span>Surface Transparency</span>
            <input
              type="range"
              min="0"
              max="0.6"
              step="0.05"
              value={c.card.backgroundOpacity ?? 0}
              onChange={e => update('card.backgroundOpacity', Number(e.target.value))}
            />
            <span className="cs-range-val">
              {Math.round((c.card.backgroundOpacity ?? 0) * 100)}%
            </span>
          </label>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Card Border</p>
            <div className="cs-choice-row">
              {['solid', 'gradient', 'animated'].map(type => {
                const lockedAnimated = type === 'animated' && !isArtist && !tierLimits.allowAnimatedBorder
                const lockedGradient = type === 'gradient' && !isArtist && !tierLimits.allowGradientBorder
                const locked = lockedAnimated || lockedGradient
                const reqTier = lockedAnimated ? 'Elite' : 'Premium'
                return (
                  <button
                    key={type}
                    type="button"
                    className={`cs-chip ${c.card.cardBorder.type === type ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && update('card.cardBorder.type', type)}
                    disabled={locked}
                    title={locked ? `Requires ${reqTier}` : undefined}
                  >
                    {type}
                    {locked && <span className="cs-chip-badge">{reqTier}</span>}
                  </button>
                )
              })}
            </div>

            {c.card.cardBorder.type !== 'solid' && (
              <div className="cs-sub-section">
                <p className="cs-sub-label">Quick palettes</p>
                <div className="cs-border-presets">
                  {BORDER_PRESETS.map((preset) => {
                    const locked = !isArtist && !tierHasPresetAccess(studioTier, preset.tier)
                    const active = JSON.stringify(c.card.cardBorder.colors) === JSON.stringify(preset.colors)
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`cs-border-preset ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
                        onClick={() => {
                          if (locked) return
                          update('card.cardBorder.colors', [...preset.colors])
                          // Honour the preset's intended mode unless the user is
                          // capped (animated requires Elite for non-artists).
                          const wantsAnimated = preset.mode === 'animated'
                          const canAnimated = isArtist || tierLimits.allowAnimatedBorder
                          update('card.cardBorder.type', wantsAnimated && canAnimated ? 'animated' : 'gradient')
                        }}
                        title={locked ? `Requires ${preset.tier === 'elite' ? 'Elite' : 'Premium'}` : preset.label}
                        disabled={locked}
                      >
                        <span className="cs-border-preset-swatch" style={{ background: `linear-gradient(120deg, ${preset.colors.join(', ')})` }} />
                        <span className="cs-border-preset-label">{preset.label}</span>
                        {locked && <span className="cs-chip-badge">{preset.tier === 'elite' ? 'Elite' : 'Premium'}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {c.card.cardBorder.colors.map((color, i) => (
              <div key={i} className="cs-color-row">
                <ColorInput label={`Border ${i + 1}`} value={color} onChange={e => {
                  const colors = [...c.card.cardBorder.colors]
                  colors[i] = e.target.value
                  update('card.cardBorder.colors', colors)
                }} />
                {c.card.cardBorder.colors.length > 1 && (
                  <button type="button" className="cs-inline-remove" onClick={() => {
                    update('card.cardBorder.colors', c.card.cardBorder.colors.filter((_, j) => j !== i))
                  }}>×</button>
                )}
              </div>
            ))}
            {c.card.cardBorder.type !== 'solid' && (
              <button type="button" className="cs-button small" onClick={addBorderColor}>+ Add Color</button>
            )}
            <label className="cs-field">
              <span>Border Width</span>
              <input type="range" min="0" max="6" value={c.card.cardBorder.width} onChange={e => update('card.cardBorder.width', Number(e.target.value))} />
              <span className="cs-range-val">{c.card.cardBorder.width}px</span>
            </label>
            {c.card.cardBorder.type !== 'solid' && (
              <label className="cs-field">
                <span>Anim Duration</span>
                <input type="range" min="1" max="8" step="0.5" value={c.card.cardBorder.animationDuration} onChange={e => update('card.cardBorder.animationDuration', Number(e.target.value))} />
                <span className="cs-range-val">{c.card.cardBorder.animationDuration}s</span>
              </label>
            )}
          </div>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Text Body Animation</p>
            <label className="cs-field">
              <span>Fade-In Duration</span>
              <Dropdown
                value={c.card.textBodyAnimation.fadeInDuration}
                onChange={(v) => update('card.textBodyAnimation.fadeInDuration', v)}
                options={[
                  { value: 'none', label: 'None' },
                  { value: '1', label: '1s' },
                  { value: '2', label: '2s' },
                  { value: '3', label: '3s' },
                  { value: '4', label: '4s' },
                ]}
              />
            </label>
            <label className="cs-field">
              <span>Typewriter Speed</span>
              <Dropdown
                value={c.card.textBodyAnimation.selfTypeSpeed}
                onChange={(v) => update('card.textBodyAnimation.selfTypeSpeed', v)}
                options={[
                  { value: 'none', label: 'None' },
                  { value: '1', label: 'Fast (1s)' },
                  { value: '2', label: 'Normal (2s)' },
                  { value: '3', label: 'Slow (3s)' },
                  { value: '5', label: 'Very Slow (5s)' },
                ]}
              />
            </label>
          </div>
        </>
      )
    }

    // ANIMATION
    if (activeTool === 'animation') {
      return (
        <>
          <p className="cs-panel-eyebrow">Animation</p>
          <h3>Open effect & background particles</h3>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Open Effect</p>
            <div className="cs-choice-row">
              {OPEN_EFFECTS.map(eff => {
                const locked = !isArtist && eff.tier !== 'none' && !tierHasPresetAccess(studioTier, eff.tier)
                return (
                  <button
                    key={eff.value}
                    type="button"
                    className={`cs-chip ${c.animation.openEffect === eff.value ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && update('animation.openEffect', eff.value)}
                    title={locked ? `Requires ${eff.tier === 'elite' ? 'Elite' : 'Premium'}` : undefined}
                    disabled={locked}
                  >
                    {eff.label}
                    {locked && <span className="cs-chip-badge">{eff.tier === 'elite' ? 'Elite' : 'Premium'}</span>}
                  </button>
                )
              })}
            </div>
            {c.animation.openEffect !== 'none' && (
              <>
                <p className="cs-sub-label">Confetti Colors</p>
                {c.animation.confettiColors.map((color, i) => (
                  <div key={i} className="cs-color-row">
                    <ColorInput label={`#${i + 1}`} value={color} onChange={e => {
                      const colors = [...c.animation.confettiColors]
                      colors[i] = e.target.value
                      update('animation.confettiColors', colors)
                    }} />
                    <button type="button" className="cs-inline-remove" onClick={() => removeConfettiColor(i)}>×</button>
                  </div>
                ))}
                <button type="button" className="cs-button small" onClick={addConfettiColor}>+ Add Color</button>
              </>
            )}
          </div>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Ambient Effect</p>
            <div className="cs-choice-row">
              {AMBIENT_EFFECTS.map(eff => {
                const locked = !isArtist && eff.tier !== 'none' && !tierHasPresetAccess(studioTier, eff.tier)
                return (
                  <button
                    key={eff.value}
                    type="button"
                    className={`cs-chip ${c.animation.backgroundEffect.type === eff.value ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => !locked && update('animation.backgroundEffect.type', eff.value)}
                    title={locked ? `Requires ${eff.tier === 'elite' ? 'Elite' : 'Premium'}` : undefined}
                    disabled={locked}
                  >
                    {eff.label}
                    {locked && <span className="cs-chip-badge">{eff.tier === 'elite' ? 'Elite' : 'Premium'}</span>}
                  </button>
                )
              })}
            </div>
            {c.animation.backgroundEffect.type === 'floating' && (
              <div className="cs-sub-section">
                <p className="cs-sub-label">Background Emojis</p>
                <div className="cs-emoji-builder">
                  <input
                    value={emojiInput}
                    onChange={(event) => setEmojiInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addBackgroundEmoji()
                      }
                    }}
                    placeholder="Type or paste an emoji"
                  />
                  <button type="button" className="cs-button small" onClick={addBackgroundEmoji}>
                    Add
                  </button>
                </div>
                {c.animation.backgroundEffect.emojis.length ? (
                  <div className="cs-emoji-list">
                    {c.animation.backgroundEffect.emojis.map((emoji, index) => (
                      <button
                        key={`${emoji}-${index}`}
                        type="button"
                        className="cs-emoji-chip"
                        onClick={() => removeBackgroundEmoji(index)}
                        title="Remove emoji"
                      >
                        <span>{emoji}</span>
                        <small>Remove</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="cs-field" style={{ fontSize: '0.78rem', opacity: 0.55 }}>
                    No emojis added yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )
    }

    // QUESTIONS
    if (activeTool === 'questions') {
      const usedTexts = new Set(c.questions.items.map(q => (q.text || '').trim()))
      return (
        <>
          <p className="cs-panel-eyebrow">Questions</p>
          <h3>Receiver interaction flow</h3>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Quick-add presets</p>
            <div className="cs-q-presets">
              {QUESTION_PRESETS.map((preset) => {
                const used = usedTexts.has(preset.text)
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`cs-q-preset ${used ? 'used' : ''}`}
                    onClick={() => {
                      if (used) return
                      const items = [...c.questions.items, { text: preset.text }]
                      update('questions.items', items)
                    }}
                    disabled={used}
                    title={used ? 'Already added' : 'Add this prompt'}
                  >
                    <span className="cs-q-preset-emoji">{preset.emoji}</span>
                    <span className="cs-q-preset-text">{preset.text}</span>
                    {used && <span className="cs-q-preset-check">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {c.questions.items.map((q, i) => (
            <div key={i} className="cs-question-card">
              <label className="cs-field">
                <span>Question {i + 1}</span>
                <input value={q.text} onChange={e => updateQuestion(i, e.target.value)} />
              </label>
              <button type="button" className="cs-remove-btn" onClick={() => removeQuestion(i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="cs-button" onClick={addQuestion}>+ Add custom question</button>

          {(tierLimits.allowCustomPalette || isArtist) && (
            <div className="cs-sub-section">
              <p className="cs-sub-label">Button Style</p>
              <ColorInput label="Text Color" value={c.questions.button.textColor} onChange={e => update('questions.button.textColor', e.target.value)} />
              <ColorInput label="Border Color" value={c.questions.button.borderColor} onChange={e => update('questions.button.borderColor', e.target.value)} />
              <ColorInput label="Background" value={c.questions.button.backgroundColor} onChange={e => update('questions.button.backgroundColor', e.target.value)} />
            </div>
          )}

          <label className="cs-field">
            <span>Deny Behavior</span>
            <Dropdown
              value={c.questions.denyBehavior}
              onChange={(v) => update('questions.denyBehavior', v)}
              options={[
                { value: 'none', label: 'Normal' },
                { value: 'switch', label: 'Dodge (button moves away)' },
              ]}
            />
          </label>
        </>
      )
    }

    // INTERACTION
    if (activeTool === 'interaction') {
      return (
        <>
          <p className="cs-panel-eyebrow">Interaction</p>
          <h3>Lock & reveal settings</h3>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Lock</p>
            <div className="cs-choice-row">
              {['none', 'time', 'password'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`cs-chip ${c.interaction.lock.type === type ? 'active' : ''}`}
                  onClick={() => update('interaction.lock.type', type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {c.interaction.lock.type !== 'none' && (
              <label className="cs-field">
                <span>{c.interaction.lock.type === 'time' ? 'Unlock Date/Time' : 'Password'}</span>
                <input
                  type={c.interaction.lock.type === 'time' ? 'datetime-local' : 'text'}
                  value={c.interaction.lock.value}
                  onChange={e => update('interaction.lock.value', e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Reveal Type</p>
            <div className="cs-choice-row">
              {['tap', 'password', 'zip'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`cs-chip ${c.interaction.reveal.type === type ? 'active' : ''}`}
                  onClick={() => update('interaction.reveal.type', type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {c.interaction.reveal.type !== 'tap' && (
              <label className="cs-field">
                <span>Hint</span>
                <input value={c.interaction.reveal.hint} onChange={e => update('interaction.reveal.hint', e.target.value)} placeholder="Hint for the receiver..." />
              </label>
            )}
          </div>
        </>
      )
    }

    // POLL
    if (activeTool === 'poll') {
      return (
        <>
          <p className="cs-panel-eyebrow">Poll</p>
          <h3>Ask your audience a question</h3>
          <label className="cs-field">
            <span>Poll Question</span>
            <input
              value={pollData.question}
              onChange={(e) => setPollData((prev) => ({ ...prev, question: e.target.value }))}
              placeholder="What do you want to ask?"
            />
          </label>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Options <small>(min 2, max 6)</small></p>
            {pollData.options.map((opt, i) => (
              <div key={i} className="cs-poll-option-row">
                <label className="cs-field" style={{ flex: 1 }}>
                  <span>Option {i + 1}</span>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollData.options]
                      next[i] = e.target.value
                      setPollData((prev) => ({ ...prev, options: next }))
                    }}
                    placeholder={`Option ${i + 1}`}
                  />
                </label>
                {pollData.options.length > 2 && (
                  <button
                    type="button"
                    className="cs-remove-btn"
                    onClick={() =>
                      setPollData((prev) => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }))
                    }
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            {pollData.options.length < 6 && (
              <button
                type="button"
                className="cs-button"
                onClick={() => setPollData((prev) => ({ ...prev, options: [...prev.options, ''] }))}
              >
                + Add Option
              </button>
            )}
          </div>
          <label className="cs-field cs-toggle-field">
            <span>Allow multiple selections</span>
            <input
              type="checkbox"
              checked={pollData.allowMultiple}
              onChange={(e) => setPollData((prev) => ({ ...prev, allowMultiple: e.target.checked }))}
            />
          </label>
          <p className="cs-info-note">Recipients see live results after voting.</p>
        </>
      )
    }

    // TRIVIA
    if (activeTool === 'trivia') {
      return (
        <>
          <p className="cs-panel-eyebrow">Trivia</p>
          <h3>Create a scored quiz</h3>
          {triviaData.questions.map((q, qi) => (
            <div key={qi} className="cs-sub-section cs-trivia-question">
              <div className="cs-trivia-q-header">
                <p className="cs-sub-label">Question {qi + 1}</p>
                {triviaData.questions.length > 1 && (
                  <button
                    type="button"
                    className="cs-remove-btn"
                    onClick={() =>
                      setTriviaData((prev) => ({
                        ...prev,
                        questions: prev.questions.filter((_, idx) => idx !== qi),
                      }))
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
              <label className="cs-field">
                <span>Question text</span>
                <input
                  value={q.text}
                  onChange={(e) => {
                    const next = triviaData.questions.map((item, idx) =>
                      idx === qi ? { ...item, text: e.target.value } : item,
                    )
                    setTriviaData((prev) => ({ ...prev, questions: next }))
                  }}
                  placeholder="Enter your question..."
                />
              </label>
              {q.options.map((opt, oi) => (
                <label key={oi} className="cs-field cs-trivia-option">
                  <span className="cs-trivia-option-label">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correctIndex === oi}
                      onChange={() => {
                        const next = triviaData.questions.map((item, idx) =>
                          idx === qi ? { ...item, correctIndex: oi } : item,
                        )
                        setTriviaData((prev) => ({ ...prev, questions: next }))
                      }}
                    />
                    Option {oi + 1} {q.correctIndex === oi && <span className="cs-correct-tag">Correct</span>}
                  </span>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const nextOpts = [...q.options]
                      nextOpts[oi] = e.target.value
                      const next = triviaData.questions.map((item, idx) =>
                        idx === qi ? { ...item, options: nextOpts } : item,
                      )
                      setTriviaData((prev) => ({ ...prev, questions: next }))
                    }}
                    placeholder={`Option ${oi + 1}`}
                  />
                </label>
              ))}
            </div>
          ))}
          {triviaData.questions.length < 10 && (
            <button
              type="button"
              className="cs-button"
              onClick={() =>
                setTriviaData((prev) => ({
                  ...prev,
                  questions: [
                    ...prev.questions,
                    { text: '', options: ['', '', '', ''], correctIndex: 0 },
                  ],
                }))
              }
            >
              + Add Question
            </button>
          )}
          <p className="cs-info-note">Recipients see their score and correct answers at the end.</p>
        </>
      )
    }

    // CHAIN
    if (activeTool === 'chain') {
      const isChainType = studioType === 'chain'
      return (
        <>
          <p className="cs-panel-eyebrow">Chain Reply</p>
          <h3>Invite your recipient to reply</h3>
          {!isChainType && (
            <label className="cs-field cs-toggle-field">
              <span>Enable chain reply</span>
              <input
                type="checkbox"
                checked={chainData.enabled}
                onChange={(e) => setChainData((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
            </label>
          )}
          {(isChainType || chainData.enabled) && (
            <>
              <label className="cs-field">
                <span>Prompt shown to recipient</span>
                <input
                  value={chainData.prompt}
                  onChange={(e) => setChainData((prev) => ({ ...prev, prompt: e.target.value }))}
                  placeholder="Now it's your turn…"
                />
              </label>
              <div className="cs-chain-preview-hint">
                <span className="cs-chain-icon">🔗</span>
                <p>After opening your card, the recipient will see a <strong>"Reply with your own card"</strong> button.</p>
              </div>
            </>
          )}
          <p className="cs-info-note">
            {isChainType
              ? 'Recipient will be invited to create and send a card back to you.'
              : chainData.enabled
                ? 'Recipient will be invited to create and send a card back to you.'
                : 'Toggle on to invite your recipient to reply with their own card.'}
          </p>
        </>
      )
    }

    // ANONYMOUS TEMPLATE
    if (activeTool === 'anon') {
      return (
        <>
          <p className="cs-panel-eyebrow">Anonymous Inbox</p>
          <h3>Tag as anonymous template</h3>
          <label className="cs-field cs-toggle-field">
            <span>Mark as Anonymous Inbox Template</span>
            <input
              type="checkbox"
              checked={anonTemplate.enabled}
              onChange={(e) => setAnonTemplate((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
          </label>
          {anonTemplate.enabled && (
            <>
              <p className="cs-info-note">
                This card will appear as a template option when users visit an anonymous inbox link
                (<code>/ask/@username</code>). Senders pick it to wrap their message.
              </p>
              <div className="cs-sub-section">
                <p className="cs-sub-label">Template Tier</p>
                <div className="cs-choice-row">
                  {['classic', 'premium'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`cs-chip ${anonTemplate.tier === t ? 'active' : ''}`}
                      onClick={() => setAnonTemplate((prev) => ({ ...prev, tier: t }))}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="cs-info-note" style={{ marginTop: 6 }}>
                  Classic = free for senders. Premium = costs CC for senders.
                </p>
              </div>
            </>
          )}
        </>
      )
    }

    // GIFTS
    if (activeTool === 'gifts') {
      return (
        <>
          <p className="cs-panel-eyebrow">Gifts</p>
          <h3>End-of-card gift reveal</h3>
          <p className="cs-field" style={{ fontSize: '0.78rem', opacity: 0.7, lineHeight: 1.55 }}>
            Gift attachments are coming soon. This section is temporarily disabled while the gift
            store is being stabilized.
          </p>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Status</p>
            <div className="cs-gift-selected">
              <div>
                <strong>Coming Soon</strong>
                <span className="cs-gift-amount">Gift selection will return in a later update.</span>
              </div>
            </div>
          </div>
        </>
      )
    }

    return null
  }

  // Build preview card background
  const previewBg = useMemo(() => {
    if (c.background.type === 'color') return c.background.colors[0] || '#0a0a0a'
    if (c.background.type === 'gradient' || c.background.type === 'animated') {
      return `linear-gradient(135deg, ${c.background.colors.join(', ')})`
    }
    return '#0a0a0a'
  }, [c.background])

  // Button shape map
  const shapeMap = { rounded: '14px', pill: '999px', square: '6px', sharp: '0px' }
  const btnShape = shapeMap[c.closedState.button.shape] || '999px'

  // Card border for preview
  const cardBorderCss = useMemo(() => {
    if (c.card.cardBorder.type === 'solid') {
      return { border: `${c.card.cardBorder.width}px solid ${c.card.cardBorder.colors[0] || '#333'}` }
    }
    return {}
  }, [c.card.cardBorder])

  const renderStudioContentPreview = (compact = false) => {
    const previewQuestion = triviaData.questions[0] || { text: '', options: ['', '', '', ''], correctIndex: 0 }
    const previewPollOptions = pollData.options.filter(Boolean)
    const primaryImage = c.media.images[0]

    if (studioType === 'poll') {
      return (
        <div className={`cs-preview-poll ${compact ? 'compact' : ''}`} style={{
          backgroundColor: c.card.backgroundColor,
          ...cardBorderCss,
        }}>
          <div className="cs-preview-poll-head">
            <p className="cs-preview-poll-eyebrow">&#x1F4CA; Live Poll Experience</p>
            <span className="cs-preview-pill">Recipients vote</span>
          </div>
          <h3 style={{
            color: c.card.headingColor,
            fontFamily: `'${c.theme.fontFamily}', serif`,
          }}>
            {c.content.heading}
          </h3>
          <p className="cs-preview-poll-question" style={{ color: c.card.textColor }}>
            {pollData.question || 'Ask a question your recipients can answer instantly.'}
          </p>
          <div className="cs-preview-poll-options">
            {(previewPollOptions.length > 0 ? previewPollOptions : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
              <div key={i} className="cs-preview-poll-option" style={{ color: c.card.textColor }}>
                <span className="cs-preview-poll-dot" />
                <span>{opt}</span>
              </div>
            ))}
          </div>
          <div className="cs-preview-poll-foot">
            <span>Tap to vote</span>
            <span>Results unlock after submit</span>
          </div>
          <div className="cs-preview-watermark">
            <span>Made with </span>
            <a href="/" className="cs-preview-watermark-cta">Cardora</a>
            <span className="cs-preview-watermark-sep">·</span>
            <a href="/" className="cs-preview-watermark-cta">Create yours →</a>
          </div>
        </div>
      )
    }

    if (studioType === 'trivia') {
      return (
        <div className={`cs-preview-trivia ${compact ? 'compact' : ''}`} style={{
          backgroundColor: c.card.backgroundColor,
          ...cardBorderCss,
        }}>
          <div className="cs-preview-trivia-head">
            <p className="cs-preview-trivia-eyebrow">&#x1F4A1; Trivia Challenge</p>
            <span className="cs-preview-pill">Score-based card</span>
          </div>
          <h3 style={{
            color: c.card.headingColor,
            fontFamily: `'${c.theme.fontFamily}', serif`,
          }}>
            {c.content.heading}
          </h3>
          <p className="cs-preview-trivia-counter" style={{ color: c.theme.accentColor }}>
            Question 1 of {Math.max(triviaData.questions.length, 1)}
          </p>
          <div className="cs-preview-trivia-q" style={{ color: c.card.textColor }}>
            <p>{previewQuestion.text || 'Place your first quiz question here.'}</p>
          </div>
          <div className="cs-preview-trivia-opts">
            {(previewQuestion.options?.length ? previewQuestion.options : ['', '', '', '']).map((opt, oi) => (
              <div
                key={oi}
                className={`cs-preview-trivia-opt ${previewQuestion.correctIndex === oi ? 'correct' : ''}`}
                style={{ color: c.card.textColor }}
              >
                <span className="cs-preview-trivia-opt-index">{String.fromCharCode(65 + oi)}</span>
                <span>{opt || `Option ${oi + 1}`}</span>
              </div>
            ))}
          </div>
          <p className="cs-preview-trivia-score">
            {triviaData.questions.length || 1} question{(triviaData.questions.length || 1) !== 1 ? 's' : ''} · interactive result screen
          </p>
          <div className="cs-preview-watermark">
            <span>Made with </span>
            <a href="/" className="cs-preview-watermark-cta">Cardora</a>
            <span className="cs-preview-watermark-sep">·</span>
            <a href="/" className="cs-preview-watermark-cta">Create yours →</a>
          </div>
        </div>
      )
    }

    if (studioType === 'chain') {
      return (
        <div className={`cs-mobile-chain-preview ${compact ? 'compact' : ''}`} style={{ backgroundColor: c.card.backgroundColor, ...cardBorderCss }}>
          <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
            {c.content.heading || 'Your message here'}
          </h3>
          <p style={{ color: c.card.textColor, fontSize: '0.85rem', opacity: 0.7 }}>{c.content.body}</p>
          <div className="cs-chain-reply-strip">
            <span>🔗</span>
            <span>{chainData.prompt || "Now it's your turn…"}</span>
          </div>
          <button type="button" className="cs-chain-reply-btn" disabled>Reply with a card</button>
          <div className="cs-preview-watermark">
            <span>Made with </span>
            <a href="/" className="cs-preview-watermark-cta">Cardora</a>
            <span className="cs-preview-watermark-sep">·</span>
            <a href="/" className="cs-preview-watermark-cta">Create yours →</a>
          </div>
        </div>
      )
    }

    if (studioType === 'anon' || studioType === 'anonymous') {
      const accent = c.theme.accentColor || '#7ef7ff'
      const cardBg = c.card.backgroundColor || '#07111a'
      return (
        <div className={`cs-preview-anon ${compact ? 'compact' : ''}`}>
          {/* View toggle */}
          <div className="cs-anon-preview-tabs">
            <button
              type="button"
              className={`cs-anon-preview-tab ${anonPreviewTab === 'sender' ? 'active' : ''}`}
              onClick={() => setAnonPreviewTab('sender')}
            >
              Sender view
            </button>
            <button
              type="button"
              className={`cs-anon-preview-tab ${anonPreviewTab === 'recipient' ? 'active' : ''}`}
              onClick={() => setAnonPreviewTab('recipient')}
            >
              Recipient view
            </button>
          </div>

          {/* SENDER VIEW — what opens at /ask/@username */}
          {anonPreviewTab === 'sender' && (
            <div className="cs-preview-anon-sender" style={{ background: cardBg, borderColor: `${accent}1a`, ...cardBorderCss }}>
              <div className="cs-preview-anon-sender-header">
                <div className="cs-preview-anon-avatar-mock" style={{ borderColor: `${accent}44` }}>
                  <span style={{ color: accent }}>U</span>
                </div>
                <div>
                  <p className="cs-preview-anon-label" style={{ color: `${accent}99` }}>Anonymous message for</p>
                  <p className="cs-preview-anon-username" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>@recipient</p>
                </div>
              </div>
              {(c.content.heading || c.content.body) && (
                <div className="cs-preview-anon-copy">
                  {c.content.heading && <h4 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>{c.content.heading}</h4>}
                  {c.content.body && <p style={{ color: c.card.textColor }}>{c.content.body}</p>}
                </div>
              )}
              <div className="cs-preview-anon-textarea-mock" style={{ borderColor: `${accent}28`, color: `${c.card.textColor}88` }}>
                Write something honest, kind, or surprising…
              </div>
              <div className="cs-preview-anon-meta-mock">
                <span style={{ color: `${c.card.textColor}66` }}>0/500</span>
                <span style={{ color: accent }}>&#x1F441;&#xFE0F; Anonymous</span>
              </div>
              <div className="cs-preview-anon-send-mock" style={{ background: accent, color: cardBg }}>
                Send Anonymously
              </div>
            </div>
          )}

          {/* RECIPIENT VIEW — the card in their profile with messages */}
          {anonPreviewTab === 'recipient' && (
            <div className="cs-preview-anon-recipient" style={{ background: cardBg, borderColor: `${accent}1a`, ...cardBorderCss }}>
              <div className="cs-preview-anon-head">
                <p className="cs-preview-anon-eyebrow">&#x1F441;&#xFE0F; Anonymous Inbox</p>
                <span className="cs-preview-pill">{anonTemplate.tier === 'premium' ? 'Premium' : 'Classic'}</span>
              </div>
              <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                {c.content.heading || 'Your inbox card'}
              </h3>
              {c.content.body && <p style={{ color: c.card.textColor, fontSize: '0.8rem', marginBottom: 10 }}>{c.content.body}</p>}
              <div className="cs-preview-anon-messages">
                {[
                  '"You make people feel seen. Keep going."',
                  '"That thing you did last week was genuinely kind."',
                  '"Still thinking about how you handled that situation."',
                ].map((msg, i) => (
                  <div key={i} className="cs-preview-anon-msg-bubble" style={{ borderColor: `${accent}22`, background: `${accent}08` }}>
                    <p style={{ color: c.card.textColor }}>{msg}</p>
                    <span className="cs-preview-anon-msg-time" style={{ color: `${accent}66` }}>Anonymous · just now</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="cs-preview-watermark">
            <span>Made with </span>
            <a href="/" className="cs-preview-watermark-cta">Cardora</a>
            <span className="cs-preview-watermark-sep">·</span>
            <a href="/" className="cs-preview-watermark-cta">Create yours →</a>
          </div>
        </div>
      )
    }

    const headingSize = c.theme.headingSize ?? 28
    const bodySize = c.theme.bodySize ?? 16
    return (
      <div className={`cs-preview-card ${compact ? 'compact' : ''}`} style={{
        backgroundColor: c.card.backgroundColor,
        ...cardBorderCss,
      }}>
        {primaryImage && (
          <div className="cs-preview-media">
            <img
              src={primaryImage.url}
              alt=""
              style={{
                objectFit: primaryImage.fit || 'cover',
                objectPosition: `${primaryImage.positionX ?? 50}% ${primaryImage.positionY ?? 50}%`,
              }}
            />
          </div>
        )}
        <h3 style={{
          color: c.card.headingColor,
          fontFamily: `'${c.theme.fontFamily}', serif`,
          fontSize: `${headingSize}px`,
        }}>
          {c.content.heading}
        </h3>
        <p style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif`, fontSize: `${bodySize}px` }}>{c.content.body}</p>
        {c.content.extendedBody && (
          <p className="cs-extended" style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif`, fontSize: `${bodySize}px` }}>
            {c.content.extendedBody}
          </p>
        )}
        {c.questions.items.length > 0 && (
          <div className="cs-preview-questions">
            <p className="cs-q-label">Questions ({c.questions.items.length})</p>
            {c.questions.items.map((q, i) => (
              <div key={i} className="cs-q-preview-item">
                <span>{q.text}</span>
              </div>
            ))}
          </div>
        )}
        <div className="cs-preview-watermark">
          <span>Made with </span>
          <a href="/" className="cs-preview-watermark-cta">Cardora</a>
          <span className="cs-preview-watermark-sep">·</span>
          <a href="/" className="cs-preview-watermark-cta">Create yours →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="page-body cs-shell" style={{ '--type-accent': TYPE_ACCENT[studioType] || TYPE_ACCENT.personal }}>
      {/* TOPBAR */}
      <div className="cs-topbar">
        <div className="cs-top-left">
          <button type="button" className="cs-nav-btn" onClick={() => navigate(-1)}>← Back</button>
          <span className="cs-type-badge">{typeMeta.label || 'Personal Card'}</span>
          <div className="cs-status">{savedState}</div>
        </div>
        <div className="cs-progress">
          <div className="cs-wordmark">
            <img src={BRAND_LOGO} alt="Cardora" className="cs-top-logo" />
            <span>Cardora Studio</span>
            <span className={`cs-type-badge ${typeMeta.badge}`}>
              <span className="cs-type-badge-emoji">{typeMeta.emoji}</span>
              {typeMeta.label} · {tierLabel}
            </span>
          </div>
          <div className="cs-steps">
            {steps.map((step, i) => {
              const ai = steps.indexOf(activeStep)
              const state = i === ai ? 'active' : i < ai ? 'done' : ''
              return (
                <button key={step} type="button" className={`cs-step ${state}`} onClick={() => goToStep(step)}>
                  <span>{step === 'closed' ? 'Closed State' : step}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="cs-top-actions">
          <button type="button" className="cs-nav-btn" onClick={handleSave}>Save</button>
          {isArtist && (
            <button type="button" className="cs-nav-btn publish" onClick={() => setShowPublish(true)}>
              Publish Template
            </button>
          )}
          {!isArtist && (
            (() => {
              const bal = balance ?? 0
              const short = tierCost > 0 && bal < tierCost
              return (
                <span
                  className={`cs-cc-cost-badge ${tierCost === 0 ? 'free' : ''} ${short ? 'short' : ''}`}
                  title={
                    tierCost === 0
                      ? 'Classic tier — free to send'
                      : short
                      ? `Need ${tierCost - bal} more CC`
                      : `Your balance: ${bal} CC`
                  }
                >
                  {tierCost === 0 ? (
                    'Free to send'
                  ) : (
                    <>
                      <strong>{tierCost} CC</strong>
                      <span className="cs-cc-cost-sub">
                        {short ? `${tierCost - bal} short` : `${bal} in balance`}
                      </span>
                    </>
                  )}
                </span>
              )
            })()
          )}
          <button type="button" className="cs-nav-btn accent" onClick={enterPreview}>
            <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 4 }} /> Preview
          </button>
          <button
            type="button"
            className="cs-nav-btn send"
            disabled={isSending}
            onClick={handleSendClick}
          >
            {isSending ? 'Sending...' : 'Send Now'}
          </button>
        </div>
      </div>

      {/* LAYOUT */}
      <div className="cs-layout">
        {/* TOOL RAIL — grouped */}
        <aside className="cs-toolrail">
          {TOOL_GROUP_ORDER.map((group) => {
            const tools = activeTools.filter(t => t.group === group)
            if (tools.length === 0) return null
            return (
              <div key={group} className="cs-toolgroup">
                <p className="cs-toolgroup-label">{group}</p>
                {tools.map(tool => {
                  const Icon = tool.icon
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={`cs-tool ${activeTool === tool.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTool(tool.id)
                        if (tool.id === 'closedState') setActiveStep('closed')
                        else if (tool.id === 'questions') setActiveStep('questions')
                        else setActiveStep('card')
                      }}
                      title={tool.label}
                    >
                      <span className="cs-tool-icon"><Icon size={20} /></span>
                      <span className="cs-tool-meta">
                        <span className="cs-tool-label">{tool.label}</span>
                        <small>{tool.hint}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </aside>

        {/* CANVAS */}
        <main className="cs-canvas-wrap">
          <div className="cs-canvas">
            <div className="cs-canvas-head">
              <div>
                <p className="eyebrow">Live Preview</p>
                <h2>Editable card preview</h2>
              </div>
              <button type="button" className="cs-preview-toggle" onClick={enterPreview}>
                <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 6 }} /> Full Preview
              </button>
            </div>

            {/* Phone frame */}
            <div className="cs-phone-frame">
              <div className="cs-phone-notch" />
              <div className="cs-phone-screen" style={{ background: previewBg }}>
                {c.background.type === 'image' && c.background.imageUrl ? (
                  <img className="cs-screen-background" src={c.background.imageUrl} alt="" />
                ) : null}
                {c.background.type === 'video' && c.background.videoUrl ? (
                  <video className="cs-screen-background video" src={c.background.videoUrl} autoPlay muted loop playsInline />
                ) : null}
                {/* Closed State Preview */}
                {activeStep === 'closed' && (
                  <div className="cs-preview-closed" style={{
                    backgroundColor: c.closedState.backgroundColor,
                    border: `2px solid ${c.closedState.borderColor}`,
                  }}>
                    <h3 style={{
                      color: c.closedState.headingColor,
                      fontFamily: `'${c.closedState.headingFont}', serif`,
                    }}>
                      {c.closedState.headingText}
                    </h3>
                    <p style={{ color: c.closedState.textColor }}>
                      {c.closedState.bodyText}
                    </p>
                    <button
                      type="button"
                      className="cs-preview-btn"
                      style={{
                        backgroundColor: c.closedState.button.backgroundColor,
                        color: c.closedState.button.textColor,
                        border: `1.5px solid ${c.closedState.button.borderColor}`,
                        borderRadius: btnShape,
                      }}
                    >
                      {c.closedState.button.text}
                    </button>
                  </div>
                )}

                {(activeStep === 'card' || activeStep === 'questions') && renderStudioContentPreview(false)}
              </div>
            </div>
          </div>
        </main>

        {/* SETTINGS PANEL */}
        <aside className="cs-settings">
          {renderPanel()}
        </aside>
      </div>

      {/* Mobile layout */}
      <div className="cs-mobile-shell">
        <div className="cs-mobile-header">
          <button type="button" className="cs-mobile-back" onClick={() => navigate(-1)}>‹</button>
          <div className="cs-mobile-title">{typeMeta.emoji} {typeMeta.label}</div>
          <button type="button" className="cs-mobile-save" onClick={handleSave}>Save</button>
        </div>

        <div className="cs-mobile-preview" style={{ background: previewBg }}>
          {c.background.type === 'image' && c.background.imageUrl ? (
            <img className="cs-mobile-background" src={c.background.imageUrl} alt="" />
          ) : null}
          {c.background.type === 'video' && c.background.videoUrl ? (
            <video className="cs-mobile-background video" src={c.background.videoUrl} autoPlay muted loop playsInline />
          ) : null}
          {activeStep === 'closed' ? (
            <div className="cs-preview-closed compact" style={{
              backgroundColor: c.closedState.backgroundColor,
              border: `2px solid ${c.closedState.borderColor}`,
            }}>
              <h3 style={{ color: c.closedState.headingColor, fontFamily: `'${c.closedState.headingFont}', serif` }}>
                {c.closedState.headingText}
              </h3>
              <p style={{ color: c.closedState.textColor }}>{c.closedState.bodyText}</p>
            </div>
          ) : (
            renderStudioContentPreview(true)
          )}
        </div>

        {/* Scroll zone: tabs are sticky inside here, panel scrolls freely */}
        <div className="cs-mobile-scroll-zone">
          <div className="cs-mobile-sticky-bar">
            <div className="cs-mobile-stepnav">
              {steps.map(step => (
                <button
                  key={step}
                  type="button"
                  className={`cs-mobile-step ${activeStep === step ? 'active' : ''}`}
                  onClick={() => goToStep(step)}
                >
                  {step === 'closed' ? 'Closed' : step}
                </button>
              ))}
            </div>

            <div className="cs-mobile-tools">
              {TOOL_GROUP_ORDER.flatMap((group) =>
                activeTools.filter(t => t.group === group)
              ).map(tool => {
                const Icon = tool.icon
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`cs-mobile-tool-chip ${activeTool === tool.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTool(tool.id)
                      if (tool.id === 'closedState') setActiveStep('closed')
                      else if (tool.id === 'questions') setActiveStep('questions')
                      else setActiveStep('card')
                    }}
                  >
                    <Icon size={16} />
                    <span>{tool.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Editing panel — scrolls inside scroll-zone */}
          <div className="cs-mobile-panel">
            {renderPanel()}
          </div>
        </div>

        {/* Footer: natural-flow bottom bar */}
        <div className="cs-mobile-footer">
          <button type="button" className="cs-mobile-ghost" onClick={enterPreview}>
            <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 4 }} /> Preview
          </button>
          {isArtist ? (
            <button type="button" className="cs-mobile-primary" onClick={() => setShowPublish(true)}>Publish</button>
          ) : (
            <button
              type="button"
              className={`cs-mobile-primary${isSending ? ' disabled' : ''}`}
              disabled={isSending}
              onClick={handleSendClick}
            >
              {isSending ? 'Sending…' : 'Send Now'}
            </button>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <CardPreviewModal
          cardObject={cardObject}
          studioType={studioType}
          tier={studioTier}
          allowedTools={allowedToolIds}
          tierLimits={tierLimits}
          pollData={pollData}
          triviaData={triviaData}
          anonTemplate={anonTemplate}
          onClose={() => {
            setShowPreview(false)
            if (activeStep === 'preview') setActiveStep('card')
          }}
        />
      )}

      {/* Publish Template Modal (Artists only) */}
      {showPublish && (
        <div className="cs-publish-overlay">
          <div
            className="cs-publish-backdrop"
            onClick={() => {
              setShowPublish(false)
              setPublishError('')
            }}
          />
          <div className="cs-publish-modal cs-publish-modal--polished">
            <div className="cs-publish-modal-header">
              <div className="cs-publish-modal-header-left">
                <span className="cs-publish-modal-eyebrow">Artist Studio</span>
                <h3>{publishForm.name || 'Untitled Template'}</h3>
              </div>
              <button
                type="button"
                className="cs-publish-close-btn"
                aria-label="Close"
                onClick={() => { setShowPublish(false); setPublishError('') }}
              >
                ×
              </button>
            </div>
            <p className="cs-publish-modal-desc">
              Your card will be submitted for review and added to the Cardora marketplace once approved by our team.
            </p>
            <div className="cs-publish-fields">
              <label className="cs-field cs-publish-field">
                <span className="cs-publish-field-label">Template Name</span>
                <input
                  value={publishForm.name}
                  onChange={(event) =>
                    setPublishForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Give your template a memorable name"
                />
              </label>
            </div>

            {/* Screenshot upload */}
            <div className="cs-publish-screenshot-section">
              <p className="cs-publish-field-label">
                Preview Screenshot <span className="cs-publish-required">required</span>
              </p>
              <p className="cs-publish-screenshot-hint-text">
                Open the card preview → take a screenshot → upload it here. This is what buyers see in the marketplace.
              </p>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleScreenshotFile(e.target.files?.[0])}
              />
              <div
                className={`cs-publish-screenshot-zone${publishScreenshot?.previewUrl ? ' has-image' : ''}${screenshotUploading ? ' uploading' : ''}`}
                onClick={() => !screenshotUploading && screenshotInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleScreenshotFile(e.dataTransfer.files?.[0]) }}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && screenshotInputRef.current?.click()}
              >
                {screenshotUploading ? (
                  <div className="cs-publish-screenshot-state">
                    <div className="chat-loading-spinner" style={{ width: 22, height: 22 }} />
                    <span>Uploading…</span>
                  </div>
                ) : publishScreenshot?.previewUrl ? (
                  <div className="cs-publish-screenshot-state cs-publish-screenshot-done">
                    <img src={publishScreenshot.previewUrl} alt="Preview" className="cs-publish-screenshot-thumb" />
                    <div className="cs-publish-screenshot-overlay">
                      {publishScreenshot.cloudUrl
                        ? <span>✓ Uploaded — click to replace</span>
                        : <span>Processing…</span>}
                    </div>
                  </div>
                ) : (
                  <div className="cs-publish-screenshot-state">
                    <span className="cs-publish-screenshot-icon">📸</span>
                    <span className="cs-publish-screenshot-label">Click or drag to upload</span>
                    <span className="cs-publish-screenshot-sub">PNG, JPG, or WebP — any size</span>
                  </div>
                )}
              </div>
            </div>

            {publishError ? <p className="form-error">{publishError}</p> : null}
            <div className="cs-publish-actions">
              <button
                type="button"
                className="cs-nav-btn publish cs-publish-submit-btn"
                onClick={handlePublish}
                disabled={isPublishing || screenshotUploading || !publishScreenshot?.cloudUrl}
              >
                {isPublishing ? 'Submitting…' : 'Submit for Review →'}
              </button>
              <button
                type="button"
                className="cs-nav-btn"
                onClick={() => {
                  setShowPublish(false)
                  setPublishError('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Success Modal — shown after artist successfully publishes */}
      {publishSuccess && (
        <div className="cs-publish-overlay">
          <div
            className="cs-publish-backdrop"
            onClick={() => setPublishSuccess(null)}
          />
          <div className="cs-publish-modal cs-publish-success">
            <div className="cs-publish-success-icon-wrap">
              <div className="cs-publish-success-icon">{"✓"}</div>
            </div>
            <h3 className="cs-publish-success-title">Template submitted!</h3>
            <p className="cs-publish-success-desc">
              <strong>"{publishSuccess.name}"</strong> has been sent to the Cardora team for review.
              You'll see it appear in the marketplace once it's approved.
            </p>
            {publishSuccess.previewImage && (
              <img
                src={publishSuccess.previewImage}
                alt="Submitted template preview"
                className="cs-publish-success-preview"
              />
            )}
            <ul className="cs-publish-success-list">
              <li>Track review status under <strong>Profile → Published Templates</strong></li>
              <li>You can delete or edit it there at any time</li>
              <li>Approved templates earn CC every time someone uses them</li>
            </ul>
            <div className="cs-publish-actions">
              <button
                type="button"
                className="cs-nav-btn publish cs-publish-submit-btn"
                onClick={() => {
                  setPublishSuccess(null)
                  navigate('/profile')
                }}
              >
                Go to My Profile →
              </button>
              <button
                type="button"
                className="cs-nav-btn"
                onClick={() => setPublishSuccess(null)}
              >
                Keep Designing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send / Share Modal */}
      {showSendModal && createPortal(
        <div className="cs-send-modal-overlay">
          <div
            className="cs-send-modal-backdrop"
            onClick={() => { setShowSendModal(false); setSendResult(null) }}
          />
          <div className="cs-send-modal">
            <div className="cs-send-modal-header">
              <div className="cs-send-modal-header-left">
                <span className="cs-send-modal-eyebrow">{TYPE_LABEL[studioType] || 'Personal Card'} · {tierLabel}</span>
                <h3>{sendResult?.ok ? 'Your card is ready to share!' : 'Share Your Card'}</h3>
              </div>
              <button
                type="button"
                className="cs-send-modal-close"
                aria-label="Close"
                onClick={() => { setShowSendModal(false); setSendResult(null) }}
              >
                ×
              </button>
            </div>

            {sendResult?.ok && tierCost > 0 && (
              <div className="cs-send-modal-cc-deducted">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span><strong>{tierCost} CC</strong> deducted from your balance</span>
              </div>
            )}
            {sendResult?.ok && tierCost === 0 && (
              <div className="cs-send-modal-cc-deducted free">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span>Sent free — Classic tier</span>
              </div>
            )}
            {!sendResult?.ok && (
              <p className="cs-send-modal-note">
                {sendResult?.message || `This card costs ${tierCost === 0 ? 'nothing (free)' : `${tierCost} CC`} to send.`}
              </p>
            )}

            {sendResult?.ok && (
              <div className="cs-send-link-wrap">
                <p className="cs-send-link-label">Your unique card link</p>
                {sendResult.slug ? (
                  <>
                    <span className="detail-share-link-pill cs-send-link-pill">
                      {`${window.location.origin}/card/${sendResult.slug}`.replace(/^https?:\/\//, '')}
                    </span>
                    <button
                      type="button"
                      className={`detail-share-copy-btn ${sendCopied ? 'copied' : ''}`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(`${window.location.origin}/card/${sendResult.slug}`)
                          setSendCopied(true)
                          setTimeout(() => setSendCopied(false), 1600)
                        } catch { /* ignore */ }
                      }}
                    >
                      {sendCopied ? '✓ Copied' : 'Copy Link'}
                    </button>
                  </>
                ) : (
                  <p className="cs-send-modal-note" style={{ color: '#ffb4b4' }}>
                    Card sent — link not returned yet. Visit your Profile to find it.
                  </p>
                )}
              </div>
            )}

            {sendResult?.ok && sendResult?.slug && (
              <>
                <p className="detail-share-label">Share via</p>
                <div className="detail-share-platforms cs-send-modal-platforms">
                  {SHARE_PLATFORMS.map((p) => {
                    const shareUrl = `${window.location.origin}/card/${sendResult.slug}`
                    const shareTitle = `Check out this card I made on Cardora`
                    return (
                      <a
                        key={p.id}
                        href={p.getUrl(shareUrl, shareTitle)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="detail-share-platform-btn"
                        style={{ '--platform-color': p.color }}
                      >
                        {p.icon}
                        <span>{p.label}</span>
                      </a>
                    )
                  })}
                  {navigator.share && (
                    <button
                      type="button"
                      className="detail-share-platform-btn"
                      style={{ '--platform-color': 'rgba(118,239,255,0.7)' }}
                      onClick={async () => {
                        try {
                          await navigator.share({
                            title: 'Cardora Card',
                            text: 'Check out this card I made on Cardora',
                            url: `${window.location.origin}/card/${sendResult.slug}`,
                          })
                        } catch { /* cancelled */ }
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      <span>More</span>
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="cs-send-modal-email-row">
              <p className="cs-send-link-label">Send via Email</p>
              <div className="cs-send-modal-email-input-wrap">
                <input
                  type="email"
                  className="cs-send-modal-email-input"
                  placeholder="recipient@email.com"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                />
                <a
                  className="cs-nav-btn accent"
                  href={`mailto:${encodeURIComponent(sendEmail)}?subject=${encodeURIComponent('You\'ve got a Cardora card!')}&body=${encodeURIComponent(`Check out this card I made for you on Cardora:\n\n${window.location.origin}/card/${sendResult?.slug || ''}`)}`}
                  style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                  Send
                </a>
              </div>
            </div>

            <p className="cs-send-modal-tier-note">
              {typeMeta.emoji} {TYPE_LABEL[studioType] || 'Card'} · {tierLabel} tier
            </p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default CardStudio









