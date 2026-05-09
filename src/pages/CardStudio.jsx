import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  HiOutlineEnvelope, HiOutlinePaintBrush, HiOutlinePhoto,
  HiOutlineSparkles, HiOutlineChatBubbleLeft, HiOutlineLockClosed,
  HiOutlineDocumentText, HiOutlineMusicalNote, HiOutlineEye,
  HiOutlineGift, HiOutlineChartBarSquare, HiOutlineLightBulb,
  HiOutlineArrowPathRoundedSquare, HiOutlineEyeSlash
} from 'react-icons/hi2'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from '../components/CardIcons.jsx'
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
import { PALETTES, getPalettesForTier, applyPalette, getPaletteById } from '../lib/palettes.js'
import InlineColorPicker from '../components/InlineColorPicker.jsx'

const STUDIO_DRAFT_PREFIX = 'cardora:studioDrafts:'
const STUDIO_AUTOSAVE_PREFIX = 'cardora:studioAutoSave:'
const BRAND_LOGO = '/cardora-logo.png?v=4'

// Steps vary by type — non-personal cards don't have envelope
const STEPS_BY_TYPE = {
  personal:  ['closed', 'card', 'preview'],
  poll:      ['card', 'preview'],
  trivia:    ['card', 'preview'],
  chain:     ['card', 'preview'],
  anonymous: ['card', 'preview'],
}

const STEP_LABELS_BY_TYPE = {
  personal:  { closed: 'Envelope', card: 'Card', preview: 'Preview' },
  poll:      { card: 'Poll', preview: 'Preview' },
  trivia:    { card: 'Trivia', preview: 'Preview' },
  chain:     { card: 'Chain', preview: 'Preview' },
  anonymous: { card: 'Card', preview: 'Preview' },
}

const ALL_TOOLS = [
  { id: 'closedState', icon: HiOutlineEnvelope, label: 'Envelope', hint: 'Sealed reveal & first impression', group: 'Content' },
  { id: 'content', icon: HiOutlineDocumentText, label: 'Content', hint: 'Heading, body, extended', group: 'Content' },
  { id: 'media', icon: HiOutlinePhoto, label: 'Media', hint: 'Images & captions', group: 'Content' },
  { id: 'theme', icon: IoColorPaletteOutline, label: 'Theme', hint: 'Palette, fonts, sizing', group: 'Style' },
  { id: 'background', icon: HiOutlinePaintBrush, label: 'Background', hint: 'Colors, gradients, music', group: 'Style' },
  { id: 'cardStyle', icon: HiOutlineSparkles, label: 'Card Style', hint: 'Border, scrollbar, text FX', group: 'Style' },
  { id: 'animation', icon: HiOutlineSparkles, label: 'Animation', hint: 'Confetti & effects', group: 'Effects' },
  { id: 'gifts', icon: HiOutlineGift, label: 'Gifts', hint: 'End-of-card gift reveal', group: 'Interactive' },
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
  'personal:elite':   ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'interaction', 'gifts'],
  'poll:classic':   ['content', 'background', 'theme', 'poll'],
  'poll:premium':   ['content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'poll'],
  'trivia:classic': ['content', 'background', 'theme', 'trivia'],
  'trivia:premium': ['content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'trivia'],
  'chain:classic':  ['content', 'background', 'theme', 'chain'],
  'chain:premium':  ['content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'chain'],
  'anonymous:classic':   ['content', 'background', 'theme', 'anon'],
  'anonymous:premium':   ['content', 'media', 'background', 'theme', 'animation', 'anon'],
}

const STUDIO_TYPE_META = {
  personal:  { Icon: PersonalCardIcon, label: 'Personal Card', badge: 'badge-moment' },
  poll:      { Icon: PollCardIcon,     label: 'Poll Card',     badge: 'badge-poll' },
  trivia:    { Icon: TriviaCardIcon,   label: 'Trivia Card',   badge: 'badge-trivia' },
  chain:     { Icon: ChainCardIcon,    label: 'Chain Card',    badge: 'badge-chain' },
  anonymous: { Icon: AnonCardIcon,     label: 'Anonymous',     badge: 'badge-anon' },
}

const TYPE_ACCENT = {
  personal:  '#f0c060',
  poll:      '#60a5fa',
  trivia:    '#a78bfa',
  chain:     '#f97316',
  anonymous: '#7ef7ff',
}

const TYPE_SEND_GRADIENT = {
  personal:  'linear-gradient(135deg, #fbbf24, #f97316)',
  poll:      'linear-gradient(135deg, #60a5fa, #818cf8)',
  trivia:    'linear-gradient(135deg, #c084fc, #a78bfa)',
  chain:     'linear-gradient(135deg, #34d399, #10b981)',
  anonymous: 'linear-gradient(135deg, #7ef7ff, #62ffa2)',
}

const TIER_LABELS = { classic: 'Classic', premium: 'Premium', elite: 'Elite' }

const TIER_COST_BY_TYPE = {
  personal:  { classic: 0, premium: 25, elite: 35 },
  poll:      { classic: 0, premium: null, elite: 35 },
  trivia:    { classic: 0, premium: null, elite: 50 },
  chain:     { classic: 0, premium: null, elite: 40 },
  anonymous: { classic: 0, premium: null, elite: 45 },
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
  const { currentUser, publishTemplate, createCardOnBackend, refreshBalance, balance, openAuthModal } = useOutletContext() || {}
  // Read card type and tier from location state (set by CreateCardPicker)
  const cardData = useMemo(() => location.state?.cardData || null, [location.state])
  const existingDraftObject = useMemo(() => location.state?.draftCardObject || null, [location.state])
  const draftIdRef = useRef(location.state?.draftId || cardData?.draftId || `draft-${Date.now()}`)
  const draftStorageKey = currentUser?.id
    ? `${STUDIO_DRAFT_PREFIX}${currentUser.id}`
    : `${STUDIO_DRAFT_PREFIX}guest`
  const autoSaveKey = currentUser?.id
    ? `${STUDIO_AUTOSAVE_PREFIX}${currentUser.id}`
    : `${STUDIO_AUTOSAVE_PREFIX}guest`

  // Read the most recent autosave for this user/context. Used on mount to
  // restore unsaved work — survives reloads, browser closes, accidental
  // navigation away. Scoped by studioType+studioTier so we don't restore a
  // poll draft into a personal-card session, etc.
  const readAutoSave = () => {
    try {
      const raw = localStorage.getItem(autoSaveKey)
      if (!raw) return null
      const saved = JSON.parse(raw)
      if (!saved || typeof saved !== 'object') return null
      // Only restore when the user is opening the same type+tier — otherwise
      // a poll/elite draft would clobber a fresh personal/classic session.
      if (saved.studioType !== studioType || saved.studioTier !== studioTier) return null
      return saved
    } catch {
      return null
    }
  }
  const autoSavedRef = useRef(null)
  if (autoSavedRef.current === null && !location.state?.draftCardObject) {
    // Lazy-init once. Skip when an explicit draft is being opened from the
    // drafts list — that path takes priority.
    autoSavedRef.current = readAutoSave() || false
  }
  const initialAutoSaved = autoSavedRef.current && autoSavedRef.current.cardObject
    ? autoSavedRef.current
    : null

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
  // Show all palettes; mark above-tier ones as locked (visual upgrade prompt)
  const availablePalettes = PALETTES
  const allowedPaletteIds = useMemo(
    () => new Set((isArtist ? getPalettesForTier('elite') : getPalettesForTier(studioTier)).map(p => p.id)),
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

  const [cardObject, setCardObject] = useState(() => {
    if (existingDraftObject) return structuredClone(existingDraftObject)
    if (initialAutoSaved?.cardObject) return structuredClone(initialAutoSaved.cardObject)
    return resolveTemplateCardObject(cardData)
  })
  const [activeTool, setActiveTool] = useState(defaultToolId)
  const [activeStep, setActiveStep] = useState(defaultToolId === 'closedState' ? 'closed' : 'card')
  const [showPreview, setShowPreview] = useState(false)
  const [savedState, setSavedState] = useState(initialAutoSaved ? 'Restored from last session' : 'Unsaved draft')
  const [showPublish, setShowPublish] = useState(false)
  const [publishForm, setPublishForm] = useState({
    name: cardData?.title || existingDraftObject?.content?.heading || resolveTemplateCardObject(cardData).content.heading,
    category: 'birthday',
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

  // Interactive preview editing
  const [activeEditEl, setActiveEditEl] = useState(null) // { type:'heading'|'body'|'extendedBody'|'image', index:number }
  const dragStateRef = useRef(null)
  const editPopoverRef = useRef(null)
  const imgStripRef = useRef(null)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [mobileBottomSheet, setMobileBottomSheet] = useState(null) // null|'style'|'content'|'layers'|'more'
  const [mobileStyleTab, setMobileStyleTab] = useState('Palette')

  // Undo history. Each entry is a JSON-string snapshot of cardObject taken
  // BEFORE a mutation. Cap to 30 to keep memory bounded — anything older
  // gets dropped off the bottom. Strings (not deep clones) so snapshots are
  // both compact and trivially comparable.
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const [historyVersion, setHistoryVersion] = useState(0)
  const skipNextSnapshotRef = useRef(false)
  const refreshHistoryState = useCallback(() => setHistoryVersion((version) => version + 1), [])
  const pushUndoSnapshot = (snapshot) => {
    if (skipNextSnapshotRef.current) {
      skipNextSnapshotRef.current = false
      return
    }
    const last = undoStackRef.current[undoStackRef.current.length - 1]
    if (last === snapshot) return
    undoStackRef.current.push(snapshot)
    if (undoStackRef.current.length > 30) undoStackRef.current.shift()
    redoStackRef.current = []
    refreshHistoryState()
  }
  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop()
    if (!prev) return
    try {
      setCardObject((current) => {
        redoStackRef.current.push(JSON.stringify(current))
        if (redoStackRef.current.length > 30) redoStackRef.current.shift()
        return JSON.parse(prev)
      })
      setActiveEditEl(null)
      refreshHistoryState()
    } catch { /* ignore */ }
  }, [refreshHistoryState])
  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (!next) return
    try {
      setCardObject((current) => {
        undoStackRef.current.push(JSON.stringify(current))
        if (undoStackRef.current.length > 30) undoStackRef.current.shift()
        return JSON.parse(next)
      })
      setActiveEditEl(null)
      refreshHistoryState()
    } catch { /* ignore */ }
  }, [refreshHistoryState])

  // Poll / Trivia / Chain / Anonymous template state. Seed from the autosave
  // payload when one exists so a poll/trivia/chain in progress survives a
  // reload, just like the rest of cardObject does.
  const [pollData, setPollData] = useState(() =>
    initialAutoSaved?.pollData || { question: '', options: ['', ''], allowMultiple: false }
  )
  const [triviaData, setTriviaData] = useState(() =>
    initialAutoSaved?.triviaData || {
      questions: [{ text: '', options: ['', '', '', ''], correctIndex: 0 }],
    }
  )
  const [chainData, setChainData] = useState(() =>
    initialAutoSaved?.chainData || { enabled: false, prompt: '' }
  )
  const [anonTemplate, setAnonTemplate] = useState(() =>
    initialAutoSaved?.anonTemplate || { enabled: false, tier: studioTier || 'classic' }
  )
  const [anonPreviewTab, setAnonPreviewTab] = useState('sender') // 'sender' | 'recipient'

  // Auto-save: every change persists to localStorage after a short debounce so
  // an accidental reload, browser close, or navigation away doesn't lose the
  // user's work. The blob: URLs in c.media.images can't be revived after a
  // reload (they belong to the previous page session), so they're stripped
  // before saving — only http(s)/data URLs are kept.
  const autoSaveTimerRef = useRef(null)
  const skipFirstAutoSaveRef = useRef(true)
  // Always points at the latest "write a snapshot" function so the unload
  // handler (registered once) sees current state instead of the first render's.
  const writeAutoSaveRef = useRef(() => {})
  writeAutoSaveRef.current = () => {
    try {
      const sanitized = structuredClone(cardObject)
      if (Array.isArray(sanitized?.media?.images)) {
        sanitized.media.images = sanitized.media.images.filter(
          (img) => img?.url && /^(https?:|data:)/.test(img.url)
        )
      }
      if (sanitized?.background?.value && sanitized.background.value.startsWith('blob:')) {
        sanitized.background.value = ''
      }
      const payload = {
        draftId: draftIdRef.current,
        studioType,
        studioTier,
        cardObject: sanitized,
        pollData,
        triviaData,
        chainData,
        anonTemplate,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(autoSaveKey, JSON.stringify(payload))
      setSavedState('Auto-saved just now')
    } catch {
      // Quota errors etc. — fail silently, keep user typing.
    }
  }

  useEffect(() => {
    if (skipFirstAutoSaveRef.current) {
      skipFirstAutoSaveRef.current = false
      return
    }
    setSavedState('Saving…')
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => writeAutoSaveRef.current(), 600)
    return () => clearTimeout(autoSaveTimerRef.current)
  }, [cardObject, pollData, triviaData, chainData, anonTemplate])

  // Flush a pending autosave synchronously before unload so the very last
  // edit (within the debounce window) isn't lost when the user closes the
  // tab or hits reload.
  useEffect(() => {
    const flush = () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
      writeAutoSaveRef.current()
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      // Component unmount: flush so navigating away within the SPA also persists.
      flush()
    }
  }, [])

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
  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0
  const canRedo = redoStackRef.current.length > 0

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
        category: publishForm.category || 'birthday',
        previewImage,
        layoutConfig: structuredClone({
          ...flushedForPublish,
          type: publishedType,
          tier: studioTier,
          category: publishForm.category || 'birthday',
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
      try { localStorage.removeItem(autoSaveKey) } catch { /* ignore */ }
    } catch (error) {
      setPublishError(error.message || 'Could not submit the template.')
    } finally {
      setIsPublishing(false)
    }
  }


  // Updater helpers
  const update = (path, value) => {
    setCardObject(prev => {
      pushUndoSnapshot(JSON.stringify(prev))
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

  const applyPaletteWithHistory = (palette) => {
    setCardObject(prev => {
      pushUndoSnapshot(JSON.stringify(prev))
      return applyPalette(prev, palette)
    })
  }

  const applyPrimaryColor = (color) => {
    setCardObject(prev => {
      pushUndoSnapshot(JSON.stringify(prev))
      const next = structuredClone(prev)
      next.palette = {
        ...(next.palette || {}),
        id: null,
        primary: color,
      }
      next.theme = next.theme || {}
      next.card = next.card || {}
      next.closedState = next.closedState || {}
      next.theme.headingColor = color
      next.card.headingColor = color
      next.card.scrollbarColor = color
      next.closedState.headingColor = color
      next.closedState.borderColor = color
      next.closedState.button = next.closedState.button || {}
      next.closedState.button.backgroundColor = color
      next.closedState.button.borderColor = color
      next.questions = next.questions || {}
      next.questions.button = next.questions.button || {}
      next.questions.button.backgroundColor = color
      next.questions.button.borderColor = color
      return next
    })
  }

  // Cmd/Ctrl+Z undoes the last cardObject mutation. Skip when the user is
  // actually typing in a contentEditable element so the browser's native
  // undo stack handles in-flight character edits.
  useEffect(() => {
    const onKey = (e) => {
      const isUndo = (e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')
      const isRedo = ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) || ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y'))
      if (!isUndo && !isRedo) return
      const t = e.target
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      e.preventDefault()
      if (isRedo) handleRedo()
      else handleUndo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleRedo, handleUndo])

  // Auto-scroll image strip when multiple images are loaded
  useEffect(() => {
    const wrap = imgStripRef.current
    const imgCount = c.media?.images?.length || 0
    if (!wrap || imgCount <= 1) return
    let idx = 0
    const id = setInterval(() => {
      idx = (idx + 1) % imgCount
      const items = wrap.querySelectorAll('.cs-preview-media-item--strip')
      if (items[idx]) {
        items[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }, 3000)
    return () => clearInterval(id)
  }, [c.media?.images?.length])

  const studioSteps = STEPS_BY_TYPE[studioType] || STEPS_BY_TYPE.personal
  const stepLabels = STEP_LABELS_BY_TYPE[studioType] || STEP_LABELS_BY_TYPE.personal

  const goToStep = (step) => {
    setActiveStep(step)
    if (step === 'closed') setActiveTool('closedState')
    if (step === 'card') {
      // Switch to the type-specific editing tool
      if (studioType === 'poll') setActiveTool('poll')
      else if (studioType === 'trivia') setActiveTool('trivia')
      else if (studioType === 'chain') setActiveTool('chain')
      else if (studioType === 'anonymous') setActiveTool('anon')
      else setActiveTool('content')
    }
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
        d.card?.slug || d.card?.shareSlug || d.card?.cardId || d.card?._id || d.card?.id ||
        d.slug || d.shareSlug || d.cardId || d._id || d.id ||
        d.data?.card?.slug || d.data?.slug || d.data?.cardId || d.data?._id || d.data?.id ||
        d.renderModel?.slug || d.renderModel?.card?.slug ||
        ''
      if (!slug) {
        console.warn('Card created but no slug returned. Response shape:', JSON.stringify(d))
      }
      setSendResult({ ok: true, slug, message: result.message })
      refreshBalance?.()
      // Card sent successfully — clear the autosave so the next studio visit
      // starts fresh instead of restoring the just-sent card.
      try { localStorage.removeItem(autoSaveKey) } catch { /* ignore */ }
    } else {
      setSendResult({ ok: false, message: result?.message || 'Card creation failed.' })
    }
  }

  const handleSendClick = async () => {
    if (!currentUser) {
      openAuthModal?.()
      return
    }
    setSendResult(null)
    setShowSendModal(true)
    // If the card costs CC, show confirmation first — don't send yet.
    // Free cards (classic tier) skip confirmation and send immediately.
    if (tierCost > 0) {
      // Modal will show the confirm step; handleSend() is called when user clicks "Confirm & Send"
      return
    }
    await handleSend()
  }

  const handleConfirmSend = async () => {
    await handleSend()
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
    addImageFiles([file])
    e.target.value = ''
  }

  // Shared add-images entry point so drag-and-drop and the file picker share
  // exactly one code path. Respects the tier's image cap and ignores files
  // that aren't actually images.
  const addImageFiles = (files) => {
    const cap = tierLimits.maxImages ?? Infinity
    const remaining = Math.max(0, cap - c.media.images.length)
    if (remaining <= 0) return
    const accepted = Array.from(files)
      .filter(f => f && f.type?.startsWith('image/'))
      .slice(0, remaining)
    if (!accepted.length) return
    const newEntries = accepted.map(file => {
      const blobUrl = URL.createObjectURL(file)
      pendingUploadsRef.current.set(blobUrl, { file, type: 'image' })
      return { url: blobUrl, caption: '', fit: 'cover', positionX: 50, positionY: 50 }
    })
    update('media.images', [...c.media.images, ...newEntries])
  }

  // Drag-and-drop image upload onto the preview frame. Stops the default
  // browser navigation that would otherwise open the dropped file in a new
  // tab. previewDragOver toggles a CSS class so users see a clear drop zone.
  const [previewDragOver, setPreviewDragOver] = useState(false)
  const onPreviewDragOver = (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return
    e.preventDefault()
    setPreviewDragOver(true)
  }
  const onPreviewDragLeave = (e) => {
    // Only clear when leaving the card itself, not when crossing to a child.
    if (e.currentTarget.contains(e.relatedTarget)) return
    setPreviewDragOver(false)
  }
  const onPreviewDrop = (e) => {
    e.preventDefault()
    setPreviewDragOver(false)
    const files = e.dataTransfer?.files
    if (files && files.length) addImageFiles(files)
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

  // Interactive preview: image drag to reposition
  const startImageDrag = (e, imgIndex) => {
    e.preventDefault()
    e.stopPropagation()
    dragStateRef.current = {
      imgIndex,
      startX: e.clientX, startY: e.clientY,
      origX: c.media.images[imgIndex]?.positionX ?? 50,
      origY: c.media.images[imgIndex]?.positionY ?? 50,
      mode: 'drag',
    }
    const onMove = (ev) => {
      const { imgIndex: idx, startX, startY, origX, origY } = dragStateRef.current
      const dx = (ev.clientX - startX) / 2.5
      const dy = (ev.clientY - startY) / 2.5
      updateImageSetting(idx, 'positionX', Math.max(0, Math.min(100, origX - dx)))
      updateImageSetting(idx, 'positionY', Math.max(0, Math.min(100, origY - dy)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      dragStateRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  // Interactive preview: image resize (drag bottom edge)
  const startImageResize = (e, imgIndex) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const origHeight = c.media.images[imgIndex]?.height ?? 160
    const onMove = (ev) => {
      // Scale factor 0.7 reduces sensitivity — 1px drag ≈ 0.7px height change
      const delta = (ev.clientY - startY) * 0.7
      const newH = Math.round(Math.max(60, Math.min(360, origHeight + delta)))
      updateImageSetting(imgIndex, 'height', newH)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      dragStateRef.current = null
    }
    dragStateRef.current = { mode: 'resize', imgIndex }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
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
              {availablePalettes.map((p) => {
                const locked = !allowedPaletteIds.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`cs-palette-chip${activePaletteId === p.id && !locked ? ' active' : ''}${locked ? ' locked' : ''}`}
                    onClick={() => locked ? null : applyPaletteWithHistory(p)}
                    title={locked ? `Upgrade to ${p.tier} to unlock` : p.label}
                  >
                    <span className="cs-swatch-bg" aria-hidden="true" style={{ background: `linear-gradient(145deg, ${p.surface} 30%, ${p.primary}55 100%)` }} />
                    {locked && <span className="cs-swatch-lock" aria-hidden="true">🔒</span>}
                    <span className="cs-palette-swatches" aria-hidden="true">
                      <span style={{ background: p.primary }} />
                      <span style={{ background: p.accent }} />
                      <span style={{ background: p.ink, opacity: 0.75 }} />
                    </span>
                    <span className="cs-palette-label">{p.label}</span>
                  </button>
                )
              })}
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

    // INTERACTION
    if (activeTool === 'interaction') {
      return (
        <>
          <p className="cs-panel-eyebrow">Interaction</p>
          <h3>Lock & reveal settings</h3>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Lock</p>
            <div className="cs-choice-row">
              {[
                { id: 'none',     label: 'None' },
                { id: 'tap',      label: 'Tap' },
                { id: 'scratch',  label: 'Scratch' },
                { id: 'time',     label: 'Timer' },
                { id: 'password', label: 'Password' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`cs-chip ${c.interaction.lock.type === id ? 'active' : ''}`}
                  onClick={() => update('interaction.lock.type', id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {(c.interaction.lock.type === 'time' || c.interaction.lock.type === 'password') && (
              <label className="cs-field">
                <span>{c.interaction.lock.type === 'time' ? 'Unlock Date/Time' : 'Password'}</span>
                <input
                  type={c.interaction.lock.type === 'time' ? 'datetime-local' : 'text'}
                  value={c.interaction.lock.value}
                  onChange={e => update('interaction.lock.value', e.target.value)}
                />
              </label>
            )}
            {c.interaction.lock.type === 'tap' && (
              <p className="cs-hint">Recipient taps anywhere on the card to reveal it — creates a sense of anticipation.</p>
            )}
            {c.interaction.lock.type === 'scratch' && (
              <p className="cs-hint">Recipient scratches through an overlay to reveal the card — like a scratch card.</p>
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
    const bt = c.card.cardBorder.type
    if (bt === 'solid') return { border: `${c.card.cardBorder.width ?? 2}px solid ${c.card.cardBorder.colors?.[0] || '#333'}` }
    if (bt === 'gradient') return { '--bdr-c1': c.card.cardBorder.colors?.[0] || '#7ef7ff', '--bdr-c2': c.card.cardBorder.colors?.[1] || '#62ffa2' }
    return {}
  }, [c.card.cardBorder])
  const cardBorderClass = c.card.cardBorder.type === 'gradient' ? ' cs-border-glow' : ''

  const previewBgAnimated = c.background.type === 'gradient' || c.background.type === 'animated'

  const colorPresets = useMemo(() => [
    c.card.backgroundColor, c.card.headingColor, c.card.textColor,
    c.theme.accentColor, c.closedState.backgroundColor, c.closedState.headingColor,
    '#ffffff', '#000000', '#7ef7ff', '#62ffa2', '#ff6b6b', '#ffaa22',
  ].filter(v => v && /^#[0-9a-f]{3,8}$/i.test(String(v)))
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 12), [c])

  const renderStudioContentPreview = (compact = false) => {
    const previewQuestion = triviaData.questions[0] || { text: '', options: ['', '', '', ''], correctIndex: 0 }
    const previewPollOptions = pollData.options.filter(Boolean)
    if (studioType === 'poll') {
      const headingSize = c.theme.headingSize ?? 28
      return (
        <div
          className={`cs-preview-poll ${compact ? 'compact' : ''}`}
          style={{ backgroundColor: c.card.backgroundColor, ...cardBorderCss }}
          onClick={() => setActiveEditEl(null)}
        >
          <div className="cs-preview-poll-head">
            <p className="cs-preview-poll-eyebrow">&#x1F4CA; Live Poll Experience</p>
            <span className="cs-preview-pill">Recipients vote</span>
          </div>
          <h3
            contentEditable={!compact}
            suppressContentEditableWarning
            data-placeholder="Card heading"
            className={`cs-editable${!compact && activeEditEl?.type === 'heading' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, fontSize: `${headingSize}px`, outline: 'none' }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'heading', index: 0 }) } }}
            onBlur={e => { if (!compact) update('content.heading', e.currentTarget.textContent) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {c.content.heading}
          </h3>
          <p
            contentEditable={!compact}
            suppressContentEditableWarning
            data-placeholder="Ask a question…"
            className={`cs-editable cs-preview-poll-question${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.textColor, outline: 'none' }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
            onBlur={e => { if (!compact) setPollData(prev => ({ ...prev, question: e.currentTarget.textContent })) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {pollData.question || 'Ask a question your recipients can answer instantly.'}
          </p>
          <div className="cs-preview-poll-options" onClick={e => e.stopPropagation()} style={{ cursor: 'default' }}>
            {(previewPollOptions.length > 0 ? previewPollOptions : ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
              <div key={i} className="cs-preview-poll-option cs-clickable-preview" style={{ color: c.card.textColor }}>
                <span className="cs-preview-poll-dot" />
                <span>{opt}</span>
              </div>
            ))}
          </div>
          <div className="cs-preview-poll-foot">
            <span>Tap to vote</span>
            <span>Results unlock after submit</span>
          </div>
          {/* Floating toolbar for heading / question edits */}
          {!compact && activeEditEl && (activeEditEl.type === 'heading' || activeEditEl.type === 'body') && (
            <div className="cs-edit-toolbar" onClick={e => e.stopPropagation()}>
              {activeEditEl.type === 'heading' && (
                <>
                  <span className="cs-edit-toolbar-label">Heading</span>
                  <button type="button" onClick={() => update('theme.headingSize', Math.max(14, headingSize - 2))}>A−</button>
                  <button type="button" onClick={() => update('theme.headingSize', Math.min(56, headingSize + 2))}>A+</button>
                  <InlineColorPicker value={c.card.headingColor || '#ffffff'} onChange={e => update('card.headingColor', e.target.value)} presets={colorPresets} label="Color" />
                </>
              )}
              {activeEditEl.type === 'body' && (
                <>
                  <span className="cs-edit-toolbar-label">Question</span>
                  <InlineColorPicker value={c.card.textColor || '#e2eaf0'} onChange={e => update('card.textColor', e.target.value)} presets={colorPresets} label="Color" />
                </>
              )}
              <button type="button" className="cs-edit-toolbar-close" onClick={() => setActiveEditEl(null)}>×</button>
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

    if (studioType === 'trivia') {
      const headingSize = c.theme.headingSize ?? 28
      const hasRealOptions = previewQuestion.options?.some(o => o?.trim())
      return (
        <div
          className={`cs-preview-trivia ${compact ? 'compact' : ''}`}
          style={{ backgroundColor: c.card.backgroundColor, ...cardBorderCss }}
          onClick={() => setActiveEditEl(null)}
        >
          <div className="cs-preview-trivia-head">
            <p className="cs-preview-trivia-eyebrow">&#x1F4A1; Trivia Challenge</p>
            <span className="cs-preview-pill">Score-based card</span>
          </div>
          <h3
            contentEditable={!compact}
            suppressContentEditableWarning
            data-placeholder="Card heading"
            className={`cs-editable${!compact && activeEditEl?.type === 'heading' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, fontSize: `${headingSize}px`, outline: 'none' }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'heading', index: 0 }) } }}
            onBlur={e => { if (!compact) update('content.heading', e.currentTarget.textContent) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {c.content.heading}
          </h3>
          <p
            className="cs-preview-trivia-counter"
            style={{ color: c.theme.accentColor, cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); setActiveTool('trivia'); setActiveStep('card') }}
            title="Click to edit trivia"
          >
            Question 1 of {Math.max(triviaData.questions.length, 1)}
          </p>
          <div className="cs-preview-trivia-q" style={{ color: c.card.textColor }}>
            <p
              contentEditable={!compact}
              suppressContentEditableWarning
              data-placeholder="Place your first quiz question here."
              className={`cs-editable${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
              style={{ outline: 'none' }}
              onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
              onBlur={e => { if (!compact) setTriviaData(prev => { const qs = [...prev.questions]; qs[0] = { ...qs[0], text: e.currentTarget.textContent }; return { ...prev, questions: qs } }) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
            >{previewQuestion.text || 'Place your first quiz question here.'}</p>
          </div>
          <div className="cs-preview-trivia-opts" onClick={e => e.stopPropagation()}>
            {(previewQuestion.options?.length ? previewQuestion.options : ['', '', '', '']).map((opt, oi) => (
              <div
                key={oi}
                className={`cs-preview-trivia-opt ${hasRealOptions && previewQuestion.correctIndex === oi ? 'correct' : ''}`}
                style={{ color: c.card.textColor }}
                onClick={e => e.stopPropagation()}
              >
                <span className="cs-preview-trivia-opt-index">{String.fromCharCode(65 + oi)}</span>
                <span
                  contentEditable={!compact}
                  suppressContentEditableWarning
                  style={{ outline: 'none', flex: 1, display: 'block', cursor: !compact ? 'text' : 'default' }}
                  onBlur={e => {
                    if (compact) return
                    const text = e.currentTarget.textContent.trim()
                    setTriviaData(prev => {
                      const qs = [...prev.questions]
                      const opts = [...(qs[0]?.options || [])]
                      while (opts.length <= oi) opts.push('')
                      opts[oi] = text
                      qs[0] = { ...qs[0], options: opts }
                      return { ...prev, questions: qs }
                    })
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                >{opt || ''}</span>
              </div>
            ))}
          </div>
          <p className="cs-preview-trivia-score">
            {triviaData.questions.length || 1} question{(triviaData.questions.length || 1) !== 1 ? 's' : ''} · interactive result screen
          </p>
          {/* Floating toolbar for heading / question edits */}
          {!compact && activeEditEl && (activeEditEl.type === 'heading' || activeEditEl.type === 'body') && (
            <div className="cs-edit-toolbar" onClick={e => e.stopPropagation()}>
              {activeEditEl.type === 'heading' && (
                <>
                  <span className="cs-edit-toolbar-label">Heading</span>
                  <button type="button" onClick={() => update('theme.headingSize', Math.max(14, headingSize - 2))}>A−</button>
                  <button type="button" onClick={() => update('theme.headingSize', Math.min(56, headingSize + 2))}>A+</button>
                  <InlineColorPicker value={c.card.headingColor || '#ffffff'} onChange={e => update('card.headingColor', e.target.value)} presets={colorPresets} label="Color" />
                </>
              )}
              {activeEditEl.type === 'body' && (
                <>
                  <span className="cs-edit-toolbar-label">Question</span>
                  <InlineColorPicker value={c.card.textColor || '#e2eaf0'} onChange={e => update('card.textColor', e.target.value)} presets={colorPresets} label="Color" />
                </>
              )}
              <button type="button" className="cs-edit-toolbar-close" onClick={() => setActiveEditEl(null)}>×</button>
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

    if (studioType === 'chain') {
      const headingSize = c.theme.headingSize ?? 28
      const bodySize = c.theme.bodySize ?? 16
      return (
        <div
          className={`cs-preview-chain ${compact ? 'compact' : ''}`}
          style={{ backgroundColor: c.card.backgroundColor, ...cardBorderCss }}
          onClick={() => setActiveEditEl(null)}
        >
          <h3
            contentEditable={!compact}
            suppressContentEditableWarning
            data-placeholder="Card heading"
            className={`cs-editable${!compact && activeEditEl?.type === 'heading' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, fontSize: `${headingSize}px`, outline: 'none' }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'heading', index: 0 }) } }}
            onBlur={e => { if (!compact) update('content.heading', e.currentTarget.textContent) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {c.content.heading}
          </h3>
          <p
            contentEditable={!compact}
            suppressContentEditableWarning
            data-placeholder="Write your message…"
            className={`cs-editable cs-preview-body-text${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif`, fontSize: `${bodySize}px`, outline: 'none' }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
            onBlur={e => { if (!compact) update('content.body', e.currentTarget.textContent) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {c.content.body}
          </p>
          <div
            className="cs-chain-reply-strip cs-clickable-preview"
            onClick={e => { e.stopPropagation(); setActiveTool('chain'); setActiveStep('card') }}
            title="Click to edit chain prompt"
            style={{ cursor: 'pointer', marginTop: 'auto' }}
          >
            <span>🔗</span>
            <span>{chainData.prompt || "Now it's your turn…"}</span>
          </div>
          <button type="button" className="cs-chain-reply-btn" disabled>Reply with a card</button>
          {/* Floating toolbar */}
          {!compact && activeEditEl && (activeEditEl.type === 'heading' || activeEditEl.type === 'body') && (
            <div className="cs-edit-toolbar" onClick={e => e.stopPropagation()}>
              {activeEditEl.type === 'heading' && (
                <>
                  <span className="cs-edit-toolbar-label">Heading</span>
                  <button type="button" onClick={() => update('theme.headingSize', Math.max(14, headingSize - 2))}>A−</button>
                  <button type="button" onClick={() => update('theme.headingSize', Math.min(56, headingSize + 2))}>A+</button>
                  <InlineColorPicker value={c.card.headingColor || '#ffffff'} onChange={e => update('card.headingColor', e.target.value)} presets={colorPresets} label="Color" />
                </>
              )}
              {activeEditEl.type === 'body' && (
                <>
                  <span className="cs-edit-toolbar-label">Body</span>
                  <button type="button" onClick={() => update('theme.bodySize', Math.max(10, bodySize - 1))}>A−</button>
                  <button type="button" onClick={() => update('theme.bodySize', Math.min(28, bodySize + 1))}>A+</button>
                  <InlineColorPicker value={c.card.textColor || '#e2eaf0'} onChange={e => update('card.textColor', e.target.value)} presets={colorPresets} label="Color" />
                </>
              )}
              <button type="button" className="cs-edit-toolbar-close" onClick={() => setActiveEditEl(null)}>×</button>
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

    if (studioType === 'anon' || studioType === 'anonymous') {
      const accent = c.theme.accentColor || '#7ef7ff'
      const cardBg = c.card.backgroundColor || '#07111a'
      const headingSize = c.theme.headingSize ?? 28
      return (
        <div className={`cs-preview-anon ${compact ? 'compact' : ''}`} onClick={() => setActiveEditEl(null)}>
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
              <div className="cs-preview-anon-copy">
                <h4
                  contentEditable={!compact}
                  suppressContentEditableWarning
                  data-placeholder="Heading (optional)"
                  className={`cs-editable${!compact && activeEditEl?.type === 'heading' ? ' cs-edit-active' : ''}`}
                  style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, fontSize: `${headingSize}px`, outline: 'none' }}
                  onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'heading', index: 0 }) } }}
                  onBlur={e => { if (!compact) update('content.heading', e.currentTarget.textContent) }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                >{c.content.heading || ''}</h4>
                <p
                  contentEditable={!compact}
                  suppressContentEditableWarning
                  data-placeholder="A note for senders (optional)…"
                  className={`cs-editable${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
                  style={{ color: c.card.textColor, outline: 'none' }}
                  onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
                  onBlur={e => { if (!compact) update('content.body', e.currentTarget.textContent) }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
                >{c.content.body || ''}</p>
              </div>
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
              <h3
                contentEditable={!compact}
                suppressContentEditableWarning
                data-placeholder="Your inbox card"
                className={`cs-editable${!compact && activeEditEl?.type === 'heading' ? ' cs-edit-active' : ''}`}
                style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, outline: 'none' }}
                onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'heading', index: 0 }) } }}
                onBlur={e => { if (!compact) update('content.heading', e.currentTarget.textContent) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              >{c.content.heading || 'Your inbox card'}</h3>
              <p
                contentEditable={!compact}
                suppressContentEditableWarning
                data-placeholder="Add a description…"
                className={`cs-editable${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
                style={{ color: c.card.textColor, fontSize: '0.8rem', marginBottom: 10, outline: 'none' }}
                onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
                onBlur={e => { if (!compact) update('content.body', e.currentTarget.textContent) }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
              >{c.content.body || ''}</p>
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

          {/* Floating toolbar for anon heading / body */}
          {!compact && activeEditEl && (activeEditEl.type === 'heading' || activeEditEl.type === 'body') && (
            <div className="cs-edit-toolbar" onClick={e => e.stopPropagation()}>
              {activeEditEl.type === 'heading' && (
                <>
                  <span className="cs-edit-toolbar-label">Heading</span>
                  <button type="button" onClick={() => update('theme.headingSize', Math.max(14, headingSize - 2))}>A−</button>
                  <button type="button" onClick={() => update('theme.headingSize', Math.min(56, headingSize + 2))}>A+</button>
                  <InlineColorPicker value={c.card.headingColor || '#ffffff'} onChange={e => update('card.headingColor', e.target.value)} presets={colorPresets} label="Color" />
                </>
              )}
              {activeEditEl.type === 'body' && (
                <>
                  <span className="cs-edit-toolbar-label">Body</span>
                  <InlineColorPicker value={c.card.textColor || '#e2eaf0'} onChange={e => update('card.textColor', e.target.value)} presets={colorPresets} label="Color" />
                </>
              )}
              <button type="button" className="cs-edit-toolbar-close" onClick={() => setActiveEditEl(null)}>×</button>
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
    const imgs = c.media.images
    const imgCount = Math.min(imgs.length, 3)
    const elementOrder = c.layout?.elementOrder || ['media', 'heading', 'body']

    // Helper: move an element key up (-1) or down (+1) in the order
    const moveEl = (key, dir) => {
      const order = [...elementOrder]
      const idx = order.indexOf(key)
      if (idx < 0) return
      const next = idx + dir
      if (next < 0 || next >= order.length) return
      ;[order[idx], order[next]] = [order[next], order[idx]]
      update('layout.elementOrder', order)
    }

    // Map element type → order key
    const elKey = activeEditEl?.type === 'image' ? 'media'
      : activeEditEl?.type === 'heading' ? 'heading'
      : activeEditEl?.type ? 'body' : null

    // ─── Per-element JSX blocks ───────────────────────────────────────────
    const mediaBlock = !compact && imgs.length > 0 ? (
      <div key="media" ref={imgStripRef} className="cs-preview-media-strip-wrap" onClick={e => e.stopPropagation()}>
        <div className="cs-preview-media-strip">
          {imgs.map((img, i) => {
            const isActive = activeEditEl?.type === 'image' && activeEditEl.index === i
            return (
              <div
                key={i}
                className={`cs-preview-media-item cs-preview-media-item--strip${isActive ? ' cs-edit-active' : ''}`}
                style={{ minWidth: imgs.length === 1 ? '100%' : '82%', height: `${img.height ?? 180}px` }}
                onPointerDown={e => { e.stopPropagation(); startImageDrag(e, i) }}
                onClick={e => { e.stopPropagation(); setActiveEditEl({ type: 'image', index: i }) }}
              >
                <img
                  src={img.url}
                  alt={img.caption || ''}
                  style={{ objectFit: img.fit || 'cover', objectPosition: `${img.positionX ?? 50}% ${img.positionY ?? 50}%` }}
                  draggable={false}
                />
                {isActive && (
                  <>
                    <div className="cs-image-selected-bar" onClick={e => e.stopPropagation()}>
                      <select value={img.fit || 'cover'} onChange={e => updateImageSetting(i, 'fit', e.target.value)}>
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="fill">Fill</option>
                      </select>
                      <button type="button" onClick={() => { removeImage(i); setActiveEditEl(null) }}>Remove</button>
                    </div>
                    <div className="cs-resize-handle" onPointerDown={e => { e.stopPropagation(); startImageResize(e, i) }} />
                  </>
                )}
              </div>
            )
          })}
          {imgs.length < (tierLimits.maxImages ?? Infinity) && (
            <button type="button" className="cs-preview-add-image cs-preview-add-image--strip" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
              + Add
            </button>
          )}
        </div>
      </div>
    ) : null

    const headingBlock = (
      <h3
        key="heading"
        contentEditable={!compact}
        suppressContentEditableWarning
        data-placeholder="Click to add a heading"
        data-edit-hint="Click to edit"
        className={`cs-editable${!compact && activeEditEl?.type === 'heading' ? ' cs-edit-active' : ''}`}
        style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, fontSize: `${headingSize}px`, outline: 'none' }}
        onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'heading', index: 0 }) } }}
        onBlur={e => { if (!compact) update('content.heading', e.currentTarget.textContent) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      >
        {c.content.heading}
      </h3>
    )

    const bodyLong = (c.content.body || '').length > 150 || (c.content.extendedBody || '').length > 50
    const bodyBlock = (
      <div key="body" className={`cs-preview-body-wrap${bodyLong ? ' cs-body-has-scroll' : ''}`}>
        <p
          contentEditable={!compact}
          suppressContentEditableWarning
          data-placeholder="Click to add your message"
          data-edit-hint="Click to edit"
          className={`cs-editable cs-preview-body-text${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
          style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif`, fontSize: `${bodySize}px`, outline: 'none' }}
          onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
          onBlur={e => { if (!compact) update('content.body', e.currentTarget.textContent) }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
        >
          {c.content.body}
        </p>
        {(c.content.extendedBody || (!compact && activeEditEl?.type === 'extendedBody')) && (
          <p
            contentEditable={!compact}
            suppressContentEditableWarning
            className={`cs-extended cs-editable${!compact && activeEditEl?.type === 'extendedBody' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif`, fontSize: `${bodySize}px`, outline: 'none' }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'extendedBody', index: 0 }) } }}
            onBlur={e => { if (!compact) update('content.extendedBody', e.currentTarget.textContent) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {c.content.extendedBody}
          </p>
        )}
      </div>
    )

    const elementMap = { media: mediaBlock, heading: headingBlock, body: bodyBlock }

    return (
      <div
        className={`cs-preview-card${cardBorderClass} ${compact ? 'compact' : ''}${previewDragOver && !compact ? ' cs-drop-active' : ''}`}
        style={{ backgroundColor: c.card.backgroundColor, ...cardBorderCss }}
        onClick={() => setActiveEditEl(null)}
        onDragOver={!compact ? onPreviewDragOver : undefined}
        onDragLeave={!compact ? onPreviewDragLeave : undefined}
        onDrop={!compact ? onPreviewDrop : undefined}
      >
        {!compact && previewDragOver && (
          <div className="cs-preview-drop-overlay">
            <div className="cs-preview-drop-icon">⬇</div>
            <p>Drop to add image</p>
          </div>
        )}
        {/* Render elements in user-defined order */}
        {elementOrder.map(key => elementMap[key] ?? null)}

        {/* Desktop floating edit toolbar (hidden on mobile via CSS) */}
        {!compact && activeEditEl && activeEditEl.type !== 'image' && (
          <div className="cs-edit-toolbar" ref={editPopoverRef} onClick={e => e.stopPropagation()}>
            {activeEditEl.type === 'heading' && (
              <>
                <span className="cs-edit-toolbar-label">Heading</span>
                <button type="button" onClick={() => update('theme.headingSize', Math.max(14, headingSize - 2))}>A−</button>
                <button type="button" onClick={() => update('theme.headingSize', Math.min(56, headingSize + 2))}>A+</button>
                <InlineColorPicker value={c.card.headingColor || '#ffffff'} onChange={e => update('card.headingColor', e.target.value)} presets={colorPresets} label="Color" />
              </>
            )}
            {(activeEditEl.type === 'body' || activeEditEl.type === 'extendedBody') && (
              <>
                <span className="cs-edit-toolbar-label">Text</span>
                <button type="button" onClick={() => update('theme.bodySize', Math.max(10, bodySize - 1))}>A−</button>
                <button type="button" onClick={() => update('theme.bodySize', Math.min(28, bodySize + 1))}>A+</button>
                <InlineColorPicker value={c.card.textColor || '#e2eaf0'} onChange={e => update('card.textColor', e.target.value)} presets={colorPresets} label="Color" />
              </>
            )}
            <button type="button" className="cs-edit-toolbar-close" onClick={() => setActiveEditEl(null)}>×</button>
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
        {/* Left: back + branding */}
        <div className="cs-top-left">
          <button type="button" className="cs-back-btn" onClick={() => navigate(-1)} title="Back">
            <span className="cs-back-arrow">←</span>
          </button>
          <div className="cs-wordmark">
            <img src={BRAND_LOGO} alt="Cardora" className="cs-top-logo" />
            <span>Studio</span>
          </div>
          <span className="cs-top-divider" />
          <div className="cs-top-meta">
            <span className={`cs-type-badge ${typeMeta.badge}`}>
              <typeMeta.Icon size={13} className="cs-type-badge-icon" />
              {typeMeta.label} · {tierLabel}
            </span>
            <span className="cs-top-card-title" title={c.content?.heading || c.closedState?.headingText || ''}>
              {c.content?.heading || c.closedState?.headingText || 'Untitled card'}
            </span>
          </div>
        </div>

        {/* Right: balance + status + actions */}
        <div className="cs-top-actions">
          {!isArtist && (() => {
            const bal = balance ?? 0
            const short = tierCost > 0 && bal < tierCost
            return (
              <div className={`cs-cc-pill${short ? ' short' : ''}`} title={`Your balance: ${bal} CC`}>
                <span className="cs-cc-pill-icon">◈</span>
                <div className="cs-cc-pill-stack">
                  <span className="cs-cc-pill-balance">{bal} CC</span>
                  <span className="cs-cc-pill-cost">
                    {tierCost === 0 ? 'Free to send' : `${tierCost} CC to send`}
                  </span>
                </div>
              </div>
            )
          })()}
          <span className="cs-status">
            <span className={`cs-status-dot${savedState.includes('saved') || savedState.includes('Saved') ? ' saved' : ''}`} />
            {savedState}
          </span>
          <div className="cs-top-action-group">
            <button
              type="button"
              className="cs-icon-btn"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl/Cmd+Z)"
            >↶</button>
            <button
              type="button"
              className="cs-icon-btn"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl/Cmd+Shift+Z)"
            >↷</button>
            <button type="button" className="cs-icon-btn" onClick={handleSave} title="Save draft">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>
          </div>
          <button type="button" className="cs-nav-btn accent" onClick={enterPreview}>
            <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 4 }} /> Preview
          </button>
          {isArtist ? (
            <button type="button" className="cs-nav-btn publish" onClick={() => setShowPublish(true)}>
              Publish
            </button>
          ) : (
            <button
              type="button"
              className="cs-nav-btn send"
              disabled={isSending}
              onClick={handleSendClick}
              style={{ '--send-gradient': TYPE_SEND_GRADIENT[studioType] || TYPE_SEND_GRADIENT.personal }}
            >
              {isSending ? 'Creating…' : 'Create Card'}
            </button>
          )}
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
                        else setActiveStep('card')
                      }}
                      title={tool.hint}
                    >
                      <span className="cs-tool-icon"><Icon size={18} /></span>
                      <span className="cs-tool-label">{tool.label}</span>
                      {tool.hint && <span className="cs-tool-hint" title={tool.hint} aria-label={tool.hint}>?</span>}
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
              {studioSteps.filter(s => s !== 'preview').length > 1 ? (
                <div className="cs-step-timeline">
                  {studioSteps.filter(s => s !== 'preview').map((step, i, arr) => (
                    <span key={step} className="cs-step-timeline-item">
                      <button
                        type="button"
                        className={`cs-step-node${activeStep === step ? ' active' : ''}`}
                        onClick={() => goToStep(step)}
                      >
                        <span className="cs-step-num">{i + 1}</span>
                        <span className="cs-step-name">{stepLabels[step]}</span>
                      </button>
                      {i < arr.length - 1 && <span className="cs-step-arrow">→</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="cs-canvas-head-label">
                  <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 5, opacity: 0.5 }} />
                  Live Preview
                </p>
              )}
              <button type="button" className="cs-preview-toggle" onClick={enterPreview}>
                Full Preview
              </button>
            </div>

            {/* Phone frame */}
            <div className="cs-phone-frame">
              <div className="cs-phone-notch" />
              <div className={`cs-phone-screen${previewBgAnimated ? ' cs-bg-anim' : ''}`} style={{ background: previewBg, backgroundSize: previewBgAnimated ? '300% 300%' : undefined }}>
                {c.background.type === 'image' && c.background.imageUrl ? (
                  <img className="cs-screen-background" src={c.background.imageUrl} alt="" />
                ) : null}
                {c.background.type === 'video' && c.background.videoUrl ? (
                  <video className="cs-screen-background video" src={c.background.videoUrl} autoPlay muted loop playsInline />
                ) : null}
                {/* Closed State Preview — editable */}
                {activeStep === 'closed' && (
                  <div
                    className="cs-preview-closed"
                    style={{ backgroundColor: c.closedState.backgroundColor, border: `2px solid ${c.closedState.borderColor}` }}
                    onClick={() => setActiveEditEl(null)}
                  >
                    <h3
                      contentEditable
                      suppressContentEditableWarning
                      className={`cs-editable${activeEditEl?.type === 'closedHeading' ? ' cs-edit-active' : ''}`}
                      style={{ color: c.closedState.headingColor, fontFamily: `'${c.closedState.headingFont}', serif`, outline: 'none' }}
                      onClick={e => { e.stopPropagation(); setActiveEditEl({ type: 'closedHeading', index: 0 }) }}
                      onBlur={e => { update('closedState.headingText', e.currentTarget.textContent); setActiveEditEl(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                    >
                      {c.closedState.headingText}
                    </h3>
                    <p
                      contentEditable
                      suppressContentEditableWarning
                      className={`cs-editable${activeEditEl?.type === 'closedBody' ? ' cs-edit-active' : ''}`}
                      style={{ color: c.closedState.textColor, outline: 'none' }}
                      onClick={e => { e.stopPropagation(); setActiveEditEl({ type: 'closedBody', index: 0 }) }}
                      onBlur={e => { update('closedState.bodyText', e.currentTarget.textContent); setActiveEditEl(null) }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
                    >
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
                    {/* Floating toolbar for closed state text elements */}
                    {activeEditEl && (activeEditEl.type === 'closedHeading' || activeEditEl.type === 'closedBody') && (
                      <div className="cs-edit-toolbar cs-edit-toolbar-closed" onClick={e => e.stopPropagation()}>
                        {activeEditEl.type === 'closedHeading' && (
                          <>
                            <span className="cs-edit-toolbar-label">Heading</span>
                            <input type="color" title="Heading color" value={c.closedState.headingColor || '#ffffff'} onChange={e => update('closedState.headingColor', e.target.value)} />
                          </>
                        )}
                        {activeEditEl.type === 'closedBody' && (
                          <>
                            <span className="cs-edit-toolbar-label">Body</span>
                            <input type="color" title="Text color" value={c.closedState.textColor || '#e2eaf0'} onChange={e => update('closedState.textColor', e.target.value)} />
                          </>
                        )}
                        <button type="button" className="cs-edit-toolbar-close" onClick={() => setActiveEditEl(null)}>×</button>
                      </div>
                    )}
                  </div>
                )}

                {activeStep === 'card' && renderStudioContentPreview(false)}
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
        {/* ── 3-row header ── */}
        <div className="cs-m2-header">
          {/* Row 1: back · title/status · menu */}
          <div className="cs-m2-title-row">
            <button type="button" className="cs-m2-back" onClick={() => navigate(-1)}>←</button>
            <div className="cs-m2-title-block">
              <span className="cs-m2-card-name">{c.content.heading || typeMeta.label || 'Untitled Card'}</span>
              <span className="cs-m2-save-status">{savedState.toUpperCase()}</span>
            </div>
            <button
              type="button"
              className="cs-m2-menu-btn"
              onClick={() => setMobileBottomSheet(prev => prev === 'more' ? null : 'more')}
              title="More actions"
              aria-label="More actions"
            >
              ···
            </button>
          </div>
          {/* Row 2: tier badge · type · tool count · CC balance */}
          <div className="cs-m2-meta-row">
            <span className={`cs-m2-tier-badge cs-m2-tier-${studioTier}`}>
              {studioTier === 'elite' && <span className="cs-m2-star">★</span>}{tierLabel.toUpperCase()}
            </span>
            <span className="cs-m2-meta-sep" />
            <span className="cs-m2-meta-type">{TYPE_LABEL[studioType] || 'Personal Card'}</span>
            <span className="cs-m2-meta-sep" />
            <span className="cs-m2-meta-tools">{activeTools.length} tools</span>
            <span className="cs-m2-cc-pill">◈ {balance ?? 0} CC</span>
          </div>
          {/* Row 3: dimensions · live · undo/redo */}
          <div className="cs-m2-controls-row">
            <span className="cs-m2-dimensions">320 × 568</span>
            <span className="cs-m2-live-pill">
              <span className="cs-m2-live-dot" />LIVE
            </span>
            <div className="cs-m2-ctrl-group">
              <button type="button" className="cs-m2-ctrl-btn" onClick={handleUndo} disabled={!canUndo} title="Undo">↶</button>
              <button type="button" className="cs-m2-ctrl-btn" onClick={handleRedo} disabled={!canRedo} title="Redo">↷</button>
            </div>
          </div>
        </div>

        {/* Full-height interactive preview */}
        <div
          className={`cs-mobile-preview${previewBgAnimated ? ' cs-bg-anim' : ''}`}
          style={{ background: previewBg, backgroundSize: previewBgAnimated ? '300% 300%' : undefined }}
          onClick={() => setActiveEditEl(null)}
        >
          {c.background.type === 'image' && c.background.imageUrl ? (
            <img className="cs-mobile-background" src={c.background.imageUrl} alt="" />
          ) : null}
          {c.background.type === 'video' && c.background.videoUrl ? (
            <video className="cs-mobile-background video" src={c.background.videoUrl} autoPlay muted loop playsInline />
          ) : null}
          {activeStep === 'closed' ? (
            <div className="cs-preview-closed compact" style={{ backgroundColor: c.closedState.backgroundColor, border: `2px solid ${c.closedState.borderColor}` }} onClick={() => setActiveEditEl(null)}>
              <h3
                contentEditable
                suppressContentEditableWarning
                className={`cs-editable${activeEditEl?.type === 'closedHeading' ? ' cs-edit-active' : ''}`}
                style={{ color: c.closedState.headingColor, fontFamily: `'${c.closedState.headingFont}', serif`, outline: 'none' }}
                onClick={e => { e.stopPropagation(); setActiveEditEl({ type: 'closedHeading', index: 0 }) }}
                onBlur={e => { update('closedState.headingText', e.currentTarget.textContent); setActiveEditEl(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              >
                {c.closedState.headingText}
              </h3>
              <p
                contentEditable
                suppressContentEditableWarning
                className={`cs-editable${activeEditEl?.type === 'closedBody' ? ' cs-edit-active' : ''}`}
                style={{ color: c.closedState.textColor, outline: 'none' }}
                onClick={e => { e.stopPropagation(); setActiveEditEl({ type: 'closedBody', index: 0 }) }}
                onBlur={e => { update('closedState.bodyText', e.currentTarget.textContent); setActiveEditEl(null) }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
              >
                {c.closedState.bodyText}
              </p>
            </div>
          ) : (
            renderStudioContentPreview(false)
          )}
          {/* Tap hint */}
          {!activeEditEl && (
            <p className="cs-m2-tap-hint">
              <span className="cs-m2-hint-dot" />
              Tap any element to edit
            </p>
          )}
        </div>

        {/* ── Element edit bar or Step+Toolbar ── */}
        {activeEditEl ? (
          <div className="cs-m2-edit-zone">
            {/* Row 1: element type label + text preview + Done */}
            <div className="cs-m2-edit-header">
              <span className="cs-m2-edit-type-label">
                {activeEditEl.type === 'heading' ? 'HEADING' :
                 activeEditEl.type === 'body' ? 'BODY' :
                 activeEditEl.type === 'extendedBody' ? 'BODY' :
                 activeEditEl.type === 'image' ? 'IMAGE' :
                 activeEditEl.type === 'closedHeading' ? 'ENVELOPE TITLE' :
                 activeEditEl.type === 'closedBody' ? 'ENVELOPE TEXT' : 'ELEMENT'}
              </span>
              {(activeEditEl.type === 'heading' || activeEditEl.type === 'closedHeading') && (
                <span className="cs-m2-edit-preview">
                  "{(activeEditEl.type === 'heading' ? c.content.heading : c.closedState.headingText || '').slice(0, 24)}
                  {(activeEditEl.type === 'heading' ? c.content.heading : c.closedState.headingText || '').length > 24 ? '…' : ''}"
                </span>
              )}
              <button type="button" className="cs-m2-edit-done-btn" onClick={() => setActiveEditEl(null)}>Done</button>
            </div>
            {/* Row 2: controls for the selected element */}
            <div className="cs-m2-edit-controls">
              {/* Heading controls */}
              {activeEditEl.type === 'heading' && (
                <>
                  <button type="button" className="cs-m2-sz-btn" onClick={() => update('theme.headingSize', Math.max(14, (c.theme.headingSize ?? 28) - 2))}>A−</button>
                  <span className="cs-m2-sz-val">{c.theme.headingSize ?? 28}</span>
                  <button type="button" className="cs-m2-sz-btn" onClick={() => update('theme.headingSize', Math.min(56, (c.theme.headingSize ?? 28) + 2))}>A+</button>
                  <span className="cs-m2-ctrl-sep" />
                  {colorPresets.map((col, i) => (
                    <button key={i} type="button" className={`cs-m2-color-dot${c.card.headingColor === col ? ' active' : ''}`} style={{ background: col }} onClick={() => update('card.headingColor', col)} />
                  ))}
                </>
              )}
              {/* Body controls */}
              {(activeEditEl.type === 'body' || activeEditEl.type === 'extendedBody') && (
                <>
                  <button type="button" className="cs-m2-sz-btn" onClick={() => update('theme.bodySize', Math.max(10, (c.theme.bodySize ?? 16) - 1))}>A−</button>
                  <span className="cs-m2-sz-val">{c.theme.bodySize ?? 16}</span>
                  <button type="button" className="cs-m2-sz-btn" onClick={() => update('theme.bodySize', Math.min(28, (c.theme.bodySize ?? 16) + 1))}>A+</button>
                  <span className="cs-m2-ctrl-sep" />
                  {colorPresets.map((col, i) => (
                    <button key={i} type="button" className={`cs-m2-color-dot${c.card.textColor === col ? ' active' : ''}`} style={{ background: col }} onClick={() => update('card.textColor', col)} />
                  ))}
                </>
              )}
              {/* Envelope heading controls */}
              {activeEditEl.type === 'closedHeading' && (
                <>
                  <InlineColorPicker value={c.closedState.headingColor || '#fff'} onChange={e => update('closedState.headingColor', e.target.value)} presets={colorPresets} label="Title" />
                  <InlineColorPicker value={c.closedState.backgroundColor || '#07111a'} onChange={e => update('closedState.backgroundColor', e.target.value)} presets={colorPresets} label="BG" />
                  <InlineColorPicker value={c.closedState.borderColor || '#7ef7ff'} onChange={e => update('closedState.borderColor', e.target.value)} presets={colorPresets} label="Border" />
                </>
              )}
              {/* Envelope body controls */}
              {activeEditEl.type === 'closedBody' && (
                <>
                  <InlineColorPicker value={c.closedState.textColor || '#e2eaf0'} onChange={e => update('closedState.textColor', e.target.value)} presets={colorPresets} label="Text" />
                  <InlineColorPicker value={c.closedState.backgroundColor || '#07111a'} onChange={e => update('closedState.backgroundColor', e.target.value)} presets={colorPresets} label="BG" />
                </>
              )}
              {/* Image controls */}
              {activeEditEl.type === 'image' && (() => {
                const img = c.media.images[activeEditEl.index]
                if (!img) return null
                return (
                  <>
                    <select className="cs-m2-select" value={img.fit || 'cover'} onChange={e => updateImageSetting(activeEditEl.index, 'fit', e.target.value)}>
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="fill">Fill</option>
                    </select>
                    <span className="cs-m2-ctrl-sep" />
                    <span className="cs-m2-slider-label">X</span>
                    <input type="range" min="0" max="100" value={img.positionX ?? 50} className="cs-m2-slider" onChange={e => updateImageSetting(activeEditEl.index, 'positionX', Number(e.target.value))} />
                    <span className="cs-m2-ctrl-sep" />
                    <button type="button" className="cs-m2-remove-btn" onClick={() => { removeImage(activeEditEl.index); setActiveEditEl(null) }}>Remove</button>
                  </>
                )
              })()}
            </div>
          </div>
        ) : (
          <>
            {/* ── Step tabs ── */}
            <div className="cs-m2-step-tabs">
              {studioSteps.filter(s => s !== 'preview').map((step, i) => {
                const icon = step === 'closed' ? '✉' : '□'
                return (
                  <button key={step} type="button" className={`cs-m2-step-tab${activeStep === step ? ' active' : ''}`} onClick={() => goToStep(step)}>
                    <span className="cs-m2-step-num">0{i + 1}</span>
                    <span className="cs-m2-step-icon">{icon}</span>
                    <span className="cs-m2-step-label">{stepLabels[step] || step}</span>
                  </button>
                )
              })}
            </div>

            {/* ── Bottom toolbar ── */}
            <div className="cs-m2-toolbar">
              {[
                { id: 'content', label: 'Content', icon: 'T' },
                { id: 'layers',  label: 'Layers',  icon: '⊞' },
                { id: 'more',    label: 'More',    icon: '···' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`cs-m2-tool-tab${mobileBottomSheet === tab.id ? ' active' : ''}`}
                  onClick={() => setMobileBottomSheet(prev => prev === tab.id ? null : tab.id)}
                >
                  <span className="cs-m2-tool-icon">{tab.icon}</span>
                  <span className="cs-m2-tool-label">{tab.label}</span>
                </button>
              ))}
              <button
                type="button"
                className="cs-m2-send-btn"
                disabled={isSending}
                onClick={isArtist ? () => setShowPublish(true) : handleSendClick}
                style={!isArtist ? { '--type-accent': TYPE_ACCENT[studioType] || TYPE_ACCENT.personal } : undefined}
              >
                <span className="cs-m2-send-arrow">▷</span>
                <span>{isArtist ? 'Publish' : tierCost > 0 ? `Create (${tierCost}cc)` : 'Create Card'}</span>
              </button>
            </div>
          </>
        )}

        {/* ── Bottom sheets ── */}
        {mobileBottomSheet && !activeEditEl && (
          <div className="cs-m2-sheet-wrap">
            <div className="cs-m2-sheet-backdrop" onClick={() => setMobileBottomSheet(null)} />
            <div className="cs-m2-sheet">
              <div className="cs-m2-sheet-handle" />

              {/* Style & Palette sheet */}
              {mobileBottomSheet === 'style' && (
                <>
                  <div className="cs-m2-sheet-header">
                    <h3 className="cs-m2-sheet-title">Style <em>& palette</em></h3>
                    <button type="button" className="cs-m2-sheet-close" onClick={() => setMobileBottomSheet(null)}>×</button>
                  </div>
                  <div className="cs-m2-sheet-tab-row">
                    {['Palette', 'Typography', 'Border'].map(t => (
                      <button key={t} type="button" className={`cs-m2-sheet-tab${mobileStyleTab === t ? ' active' : ''}`} onClick={() => setMobileStyleTab(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="cs-m2-sheet-body">
                    {mobileStyleTab === 'Palette' && (
                      <>
                        <div className="cs-m2-section-hd">
                          <span>CURATED PALETTES</span>
                          <button type="button" className="cs-m2-reset-btn" onClick={() => update('palette.id', null)}>Reset</button>
                        </div>
                        <div className="cs-m2-palette-row">
                          {PALETTES.map(p => {
                            const locked = !allowedPaletteIds.has(p.id)
                            return (
                            <button key={p.id} type="button"
                              className={`cs-m2-palette-item${c.palette.id === p.id && !locked ? ' active' : ''}${locked ? ' locked' : ''}`}
                              onClick={() => locked ? null : applyPaletteWithHistory(p)}
                              title={locked ? `Upgrade to ${p.tier} to unlock` : p.label}>
                              <div className="cs-m2-palette-preview" style={{ background: `linear-gradient(145deg, ${p.surface} 30%, ${p.primary}55 100%)` }}>
                                {locked && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', background: 'rgba(0,0,0,0.35)', borderRadius: 'inherit' }}>🔒</span>}
                              </div>
                              <span className="cs-m2-palette-label">{p.label}</span>
                            </button>
                            )
                          })}
                        </div>

                        <div className="cs-m2-section-hd"><span>ACCENT METAL</span></div>
                        <div className="cs-m2-dot-row">
                          {['#c9a96e', '#b89cf0', '#62ffa2', '#ff9bd2', '#7ef7ff', '#ff6b6b', '#ffaa22'].map(col => (
                            <button key={col} type="button" className={`cs-m2-dot-lg${c.palette.primary === col ? ' active' : ''}`} style={{ background: col }} onClick={() => applyPrimaryColor(col)} />
                          ))}
                        </div>

                        <div className="cs-m2-section-hd"><span>CARD SURFACE</span></div>
                        <div className="cs-m2-surface-grid">
                          {['#0b0f12','#0f1117','#1a1410','#0c1a13','#0a1922','#3d2a1a',
                            '#faf6ef','#f5f0e8','#e8edf2','#d8e8f0','#e8e0f0','#0a0a0a'].map(col => (
                            <button key={col} type="button" className={`cs-m2-surface-dot${c.card.backgroundColor === col ? ' active' : ''}`} style={{ background: col }} onClick={() => update('card.backgroundColor', col)} />
                          ))}
                        </div>
                      </>
                    )}
                    {mobileStyleTab === 'Typography' && (
                      <>
                        <div className="cs-m2-section-hd"><span>FONT FAMILY</span></div>
                        <div className="cs-m2-font-row">
                          {availableFonts.map(f => (
                            <button key={f} type="button" className={`cs-m2-font-chip${c.theme.fontFamily === f ? ' active' : ''}`}
                              style={{ fontFamily: `'${f}', serif` }} onClick={() => update('theme.fontFamily', f)}>
                              {f.split(' ')[0]}
                            </button>
                          ))}
                        </div>
                        <div className="cs-m2-section-hd" style={{ marginTop: 16 }}><span>HEADING</span></div>
                        <div className="cs-m2-size-row">
                          <button type="button" className="cs-m2-sz-btn" onClick={() => update('theme.headingSize', Math.max(14, (c.theme.headingSize ?? 28) - 2))}>A−</button>
                          <span className="cs-m2-sz-val">{c.theme.headingSize ?? 28}</span>
                          <button type="button" className="cs-m2-sz-btn" onClick={() => update('theme.headingSize', Math.min(56, (c.theme.headingSize ?? 28) + 2))}>A+</button>
                        </div>
                        <div className="cs-m2-section-hd" style={{ marginTop: 12 }}><span>BODY TEXT</span></div>
                        <div className="cs-m2-size-row">
                          <button type="button" className="cs-m2-sz-btn" onClick={() => update('theme.bodySize', Math.max(10, (c.theme.bodySize ?? 16) - 1))}>A−</button>
                          <span className="cs-m2-sz-val">{c.theme.bodySize ?? 16}</span>
                          <button type="button" className="cs-m2-sz-btn" onClick={() => update('theme.bodySize', Math.min(28, (c.theme.bodySize ?? 16) + 1))}>A+</button>
                        </div>
                      </>
                    )}
                    {mobileStyleTab === 'Border' && (
                      <>
                        <div className="cs-m2-section-hd"><span>BORDER STYLE</span></div>
                        <div className="cs-m2-chip-row">
                          {['none', 'solid', 'gradient', 'animated'].map(type => (
                            <button key={type} type="button" className={`cs-m2-chip${c.card.cardBorder.type === type ? ' active' : ''}`} onClick={() => update('card.cardBorder.type', type)}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                          ))}
                        </div>
                        {c.card.cardBorder.type !== 'none' && (
                          <>
                            <div className="cs-m2-section-hd" style={{ marginTop: 14 }}><span>BORDER COLOR</span></div>
                            <div className="cs-m2-dot-row">
                              {colorPresets.map((col, i) => (
                                <button key={i} type="button" className={`cs-m2-dot-lg${c.card.cardBorder.colors?.[0] === col ? ' active' : ''}`} style={{ background: col }} onClick={() => update('card.cardBorder.colors', [col, c.card.cardBorder.colors?.[1] || col])} />
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Content sheet: shows the active sidebar panel */}
              {mobileBottomSheet === 'content' && (
                <>
                  <div className="cs-m2-sheet-header">
                    <h3 className="cs-m2-sheet-title">Content</h3>
                    <button type="button" className="cs-m2-sheet-close" onClick={() => setMobileBottomSheet(null)}>×</button>
                  </div>
                  <div className="cs-m2-sheet-body">
                    {renderPanel()}
                  </div>
                </>
              )}

              {/* Layers sheet */}
              {mobileBottomSheet === 'layers' && (
                <>
                  <div className="cs-m2-sheet-header">
                    <h3 className="cs-m2-sheet-title">Layers</h3>
                    <button type="button" className="cs-m2-sheet-close" onClick={() => setMobileBottomSheet(null)}>×</button>
                  </div>
                  <div className="cs-m2-sheet-body">
                    <div className="cs-m2-layers-list">
                      {TOOL_GROUP_ORDER.map(group => {
                        const groupTools = activeTools.filter(t => t.group === group)
                        if (!groupTools.length) return null
                        return (
                          <section key={group} className="cs-m2-layer-group">
                            <p className="cs-m2-layer-group-title">{group}</p>
                            {groupTools.map(tool => {
                              const Icon = tool.icon
                              return (
                                <button
                                  key={tool.id}
                                  type="button"
                                  className={`cs-m2-layer-row${activeTool === tool.id ? ' active' : ''}`}
                                  onClick={() => {
                                    setActiveTool(tool.id)
                                    if (tool.id === 'closedState') setActiveStep('closed')
                                    else setActiveStep('card')
                                    setMobileBottomSheet('content')
                                  }}
                                >
                                  <span className="cs-m2-layer-icon"><Icon size={16} /></span>
                                  <span className="cs-m2-layer-copy">
                                    <span className="cs-m2-layer-name">{tool.label}</span>
                                    <span className="cs-m2-layer-hint">{tool.hint}</span>
                                  </span>
                                  <span className="cs-m2-layer-arrow">›</span>
                                </button>
                              )
                            })}
                          </section>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* More sheet */}
              {mobileBottomSheet === 'more' && (
                <>
                  <div className="cs-m2-sheet-header">
                    <h3 className="cs-m2-sheet-title">More</h3>
                    <button type="button" className="cs-m2-sheet-close" onClick={() => setMobileBottomSheet(null)}>×</button>
                  </div>
                  <div className="cs-m2-sheet-body">
                    <div className="cs-m2-more-list">
                      <button type="button" className="cs-m2-more-row" onClick={enterPreview}>
                        <span className="cs-m2-more-icon">👁</span>
                        <div>
                          <div className="cs-m2-more-label">Preview Card</div>
                          <div className="cs-m2-more-desc">See the full recipient experience</div>
                        </div>
                      </button>
                      <button type="button" className="cs-m2-more-row" onClick={() => { handleSave(); setMobileBottomSheet(null) }}>
                        <span className="cs-m2-more-icon">💾</span>
                        <div>
                          <div className="cs-m2-more-label">Save Draft</div>
                          <div className="cs-m2-more-desc">{savedState}</div>
                        </div>
                      </button>
                      <button type="button" className="cs-m2-more-row" disabled={!canUndo} onClick={() => { handleUndo(); setMobileBottomSheet(null) }}>
                        <span className="cs-m2-more-icon">↶</span>
                        <div>
                          <div className="cs-m2-more-label">Undo last change</div>
                          <div className="cs-m2-more-desc">Step back through recent edits</div>
                        </div>
                      </button>
                      <button type="button" className="cs-m2-more-row" disabled={!canRedo} onClick={() => { handleRedo(); setMobileBottomSheet(null) }}>
                        <span className="cs-m2-more-icon">↷</span>
                        <div>
                          <div className="cs-m2-more-label">Redo change</div>
                          <div className="cs-m2-more-desc">Restore an edit you just undid</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ───────────── Legacy panel sheet (kept for back-compat) ──────────── */}
        {mobilePanelOpen && (
          <div className="cs-mobile-panel-sheet">
            <div className="cs-mobile-panel-backdrop" onClick={() => setMobilePanelOpen(false)} />
            <div className="cs-mobile-panel-content">
              <div className="cs-mobile-panel-handle" />
              <div className="cs-mobile-panel-header">
                <div className="cs-mobile-tools">
                  {TOOL_GROUP_ORDER.flatMap(group => activeTools.filter(t => t.group === group)).map(tool => {
                    const Icon = tool.icon
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        className={`cs-mobile-tool-chip ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveTool(tool.id)
                          if (tool.id === 'closedState') setActiveStep('closed')
                          else setActiveStep('card')
                        }}
                      >
                        <Icon size={15} />
                        <span>{tool.label}</span>
                      </button>
                    )
                  })}
                </div>
                <button type="button" className="cs-mobile-panel-done" onClick={() => setMobilePanelOpen(false)}>Done</button>
              </div>
              <div className="cs-mobile-panel-body">
                {renderPanel()}
              </div>
            </div>
          </div>
        )}
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
              <label className="cs-field cs-publish-field">
                <span className="cs-publish-field-label">Category</span>
                <select
                  value={publishForm.category || 'birthday'}
                  onChange={(event) =>
                    setPublishForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                >
                  <option value="birthday">Birthday</option>
                  <option value="anniversary">Anniversary</option>
                  <option value="wedding">Wedding</option>
                  <option value="proposal">Proposal</option>
                  <option value="graduation">Graduation</option>
                  <option value="holiday">Holiday</option>
                  <option value="thank-you">Thank You</option>
                  <option value="apology">Apology</option>
                  <option value="celebration">Celebration</option>
                  <option value="just-because">Just Because</option>
                  <option value="get-well">Get Well</option>
                  <option value="sympathy">Sympathy</option>
                  <option value="other">Other</option>
                </select>
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
                <h3>{sendResult?.ok ? 'Your card is ready to share!' : isSending ? 'Creating your card…' : 'Share Your Card'}</h3>
              </div>
              <button
                type="button"
                className="cs-send-modal-close"
                aria-label="Close"
                disabled={isSending}
                onClick={() => { if (!isSending) { setShowSendModal(false); setSendResult(null) } }}
              >
                ×
              </button>
            </div>

            {/* ── CC Confirmation Step (shown before sending when cost > 0) ── */}
            {!isSending && !sendResult && tierCost > 0 && (
              <div className="cs-send-confirm">
                <div className="cs-send-confirm-icon">💎</div>
                <p className="cs-send-confirm-text">
                  Sending this <strong>{tierLabel}</strong> card will cost
                </p>
                <div className="cs-send-confirm-cost">
                  <span className="cs-send-confirm-amount">{tierCost} CC</span>
                </div>
                <p className="cs-send-confirm-balance">
                  Your current balance: <strong>{balance ?? 0} CC</strong>
                  {(balance ?? 0) < tierCost && (
                    <span className="cs-send-confirm-short"> — You need {tierCost - (balance ?? 0)} more CC</span>
                  )}
                </p>
                <div className="cs-send-confirm-actions">
                  <button
                    type="button"
                    className="cs-send-confirm-cancel"
                    onClick={() => { setShowSendModal(false); setSendResult(null) }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="cs-send-confirm-btn"
                    disabled={(balance ?? 0) < tierCost}
                    onClick={handleConfirmSend}
                  >
                    Confirm & Send
                  </button>
                </div>
              </div>
            )}

            {isSending && (
              <div className="cs-send-loading">
                <div className="chat-loading-spinner" />
                <p>Uploading media and creating your card…</p>
              </div>
            )}

            {!isSending && sendResult?.ok && tierCost > 0 && (
              <div className="cs-send-modal-cc-deducted">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span><strong>{tierCost} CC</strong> deducted from your balance</span>
              </div>
            )}
            {!isSending && sendResult?.ok && tierCost === 0 && (
              <div className="cs-send-modal-cc-deducted free">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span>Sent free — Classic tier</span>
              </div>
            )}
            {!isSending && !sendResult?.ok && sendResult !== null && (
              <p className="cs-send-modal-note" style={{ color: '#ffb4b4' }}>
                {sendResult.message || 'Something went wrong. Please try again.'}
              </p>
            )}

            {!isSending && sendResult?.ok && (
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

            {!isSending && sendResult?.ok && sendResult?.slug && (
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

            {!isSending && (
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
            )}

            {!isSending && (
            <p className="cs-send-modal-tier-note">
              <typeMeta.Icon size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {TYPE_LABEL[studioType] || 'Card'} · {tierLabel} tier
            </p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default CardStudio









