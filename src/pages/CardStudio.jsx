import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import {
  HiOutlineEnvelope, HiOutlinePaintBrush, HiOutlinePhoto,
  HiOutlineSparkles, HiOutlineChatBubbleLeft, HiOutlineLockClosed,
  HiOutlineDocumentText, HiOutlineMusicalNote, HiOutlineEye,
  HiOutlineChartBarSquare, HiOutlineLightBulb,
  HiOutlineArrowPathRoundedSquare, HiOutlineEyeSlash, HiOutlineGlobeAlt,
  HiOutlineClock
} from 'react-icons/hi2'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from '../components/CardIcons.jsx'
import { IoColorPaletteOutline } from 'react-icons/io5'
import { MdBolt, MdPalette } from 'react-icons/md'
import { defaultCardObject, resolveTemplateCardObject, musicPresets, getFontsForTier } from '../data/cardDefaults.js'
import CardPreviewModal from '../components/CardPreviewModal.jsx'
import Dropdown from '../components/Dropdown.jsx'
import ColorPicker from '../components/ColorPicker.jsx'
import { uploadToCloudinary } from '../lib/cloudinary.js'
import { getCardPrices, getMediaVideos, getMediaMusic, trackEvent } from '../lib/api.js'
import { OPEN_EFFECTS, AMBIENT_EFFECTS } from '../lib/studioEffects.js'
import { GALAXY_THEMES } from '../lib/galaxyThemes.js'
import { getMotionIntensity } from '../lib/deviceCapability.js'
import { SEAL_ICON_OPTIONS } from '../lib/sealIcons.jsx'
import StudioEnvelope from '../components/StudioEnvelope.jsx'
import AmbientParticles from '../components/AmbientParticles.jsx'
import { getTierLimits } from '../lib/tierLimits.js'
import { PALETTES, getPalettesForTier, applyPalette } from '../lib/palettes.js'
import { effectKeyToGiftName } from '../lib/gifts.js'
import InlineColorPicker from '../components/InlineColorPicker.jsx'
import { computeCardTier, trimCardToTier, getTierCost, getCardTotalCost, computeFeatureSurcharges, normalizeCardPrices, normalizeFeatureSurcharges, TIER_COST_BY_TYPE, fontTier } from '../lib/tierRequirements.js'
import TierMeter from '../components/TierMeter.jsx'
import TierPip from '../components/TierPip.jsx'
import SendReceipt from '../components/SendReceipt.jsx'
import InstallPrompt from '../components/InstallPrompt.jsx'

const STUDIO_DRAFT_PREFIX = 'cardora:studioDrafts:'
const STUDIO_AUTOSAVE_PREFIX = 'cardora:studioAutoSave:'
const BRAND_LOGO = '/cardora-logo.png?v=4'

// Steps vary by type — non-personal cards don't have envelope
const STEPS_BY_TYPE = {
  personal:  ['envelope', 'letterPeek', 'card'],
  poll:      ['card'],
  trivia:    ['card'],
  chain:     ['card'],
  anonymous: ['card'],
}

const STEP_LABELS_BY_TYPE = {
  personal:  { envelope: 'Envelope', letterPeek: 'Letter Peek', card: 'Card' },
  poll:      { card: 'Poll' },
  trivia:    { card: 'Trivia' },
  chain:     { card: 'Chain' },
  anonymous: { card: 'Card' },
}

const ALL_TOOLS = [
  { id: 'closedState', icon: HiOutlineEnvelope, label: 'Envelope', hint: 'Sealed reveal & first impression', group: 'Content' },
  { id: 'content', icon: HiOutlineDocumentText, label: 'Content', hint: 'Heading, body, extended', group: 'Content' },
  { id: 'media', icon: HiOutlinePhoto, label: 'Media', hint: 'Images & captions', group: 'Content' },
  { id: 'theme', icon: IoColorPaletteOutline, label: 'Theme', hint: 'Palette, fonts, sizing', group: 'Style' },
  { id: 'background', icon: HiOutlinePaintBrush, label: 'Background', hint: 'Colors, gradients, music', group: 'Style' },
  { id: 'cardStyle', icon: HiOutlineSparkles, label: 'Card Style', hint: 'Border, scrollbar, text FX', group: 'Style' },
  { id: 'animation', icon: HiOutlineSparkles, label: 'Animation', hint: 'Confetti & effects', group: 'Effects' },
  { id: 'experience', icon: HiOutlineGlobeAlt, label: 'Experience', hint: 'Galaxy of memories', group: 'Effects' },
  { id: 'interaction', icon: HiOutlineLockClosed, label: 'Interaction', hint: 'Lock & reveal', group: 'Interactive' },
  { id: 'schedule', icon: HiOutlineClock, label: 'Schedule', hint: 'Send later — free, no surcharge', group: 'Interactive' },
  { id: 'chain', icon: HiOutlineArrowPathRoundedSquare, label: 'Chain', hint: 'Invite recipient to reply with a card', group: 'Interactive' },
  { id: 'anon', icon: HiOutlineEyeSlash, label: 'Anonymous', hint: 'Tag as anonymous inbox template', group: 'Interactive' },
  { id: 'poll', icon: HiOutlineChartBarSquare, label: 'Poll', hint: 'Question with selectable choices', group: 'Interactive' },
  { id: 'trivia', icon: HiOutlineLightBulb, label: 'Trivia', hint: 'Scored quiz with correct answers', group: 'Interactive' },
]

const TOOL_GROUP_ORDER = ['Content', 'Style', 'Effects', 'Interactive']

// 6.3: datetime-local inputs take/return a timezone-less "YYYY-MM-DDTHH:mm"
// string in the *browser's own* local time — reading it with `new Date(...)`
// and writing it back with `.toISOString()` is what converts device-local
// wall-clock time to/from the UTC instant the backend actually stores.
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

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

// Tools available per type — under the computed-tier model there is no
// upfront tier choice, so every sender gets the full toolkit for their card
// type; the tier/cost is derived afterwards from what they actually used
// (see src/lib/tierRequirements.js). Union of what each type's old "elite"
// row exposed, plus `cardStyle` for anonymous (it was missing there for no
// documented reason — every other type's full row includes it).
const TOOLS_BY_TYPE = {
  // `experience` is personal-only for now: every other type has its own
  // interaction stage after the card, and a full-screen scene competing with
  // those needs its own design pass.
  personal:  ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'experience', 'interaction', 'schedule'],
  poll:      ['content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'interaction', 'schedule', 'poll'],
  trivia:    ['content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'interaction', 'schedule', 'trivia'],
  chain:     ['content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'interaction', 'schedule', 'chain'],
  anonymous: ['content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'interaction', 'schedule', 'anon'],
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
  personal:  'var(--type-personal-grad)',
  poll:      'var(--type-poll-grad)',
  trivia:    'var(--type-trivia-grad)',
  chain:     'var(--type-chain-grad)',
  anonymous: 'var(--type-anonymous-grad)',
}

const TIER_LABELS = { classic: 'Classic', premium: 'Premium', elite: 'Elite' }

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


// `silenced` is set whenever this preview has no business making noise — the
// "Play it through" modal is open (it plays the card's own music, so the two
// would overlap), or the tool panel showing this player is closed.
function StudioAudioPlayer({ src, volume = 0.8, silenced = false }) {
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

  // Detaching an <audio> element does not reliably stop playback in Chrome, so
  // leaving the Studio (or switching tools) could leave a track playing over
  // the rest of the app with no visible control to stop it. Pause explicitly.
  useEffect(() => () => {
    const el = audioRef.current
    if (el) { el.pause(); el.currentTime = 0 }
  }, [])

  useEffect(() => {
    if (!silenced) return
    const el = audioRef.current
    if (el) el.pause()
    setIsPlaying(false)
  }, [silenced])

  // Backgrounding the tab should stop the preview too — it's a deliberate
  // "listen to this track" control, not the card's ambience.
  useEffect(() => {
    const onHidden = () => {
      if (!document.hidden) return
      const el = audioRef.current
      if (el) el.pause()
      setIsPlaying(false)
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [])

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
  const { currentUser, publishTemplate, updateMarketplaceTemplate, createCardOnBackend, refreshBalance, balance, openAuthModal, consumeGift, canInstall, promptInstall } = useOutletContext() || {}
  const [cardPrices, setCardPrices] = useState(TIER_COST_BY_TYPE)
  const [featureSurcharges, setFeatureSurcharges] = useState(() => normalizeFeatureSurcharges(null))
  // Scales the Studio's own live-preview ambient particles the same way
  // CardPreviewModal scales the recipient's — otherwise a weak device got a
  // full-intensity particle canvas while editing even though the send-side
  // preview and the real card both back off for it.
  const studioMotionIntensity = useMemo(() => getMotionIntensity(), [])
  // Read card type and tier from location state (set by CreateCardPicker)
  const cardData = useMemo(() => location.state?.cardData || null, [location.state])
  // Set when arriving here via Profile's "Edit Design" action — re-saves an
  // existing published template's design instead of publishing a new one.
  const editTemplateId = useMemo(() => location.state?.editTemplateId || null, [location.state])
  const existingDraftObject = useMemo(() => location.state?.draftCardObject || null, [location.state])
  const draftIdRef = useRef(location.state?.draftId || cardData?.draftId || `draft-${Date.now()}`)
  const draftStorageKey = currentUser?.id
    ? `${STUDIO_DRAFT_PREFIX}${currentUser.id}`
    : `${STUDIO_DRAFT_PREFIX}guest`
  const autoSaveKey = currentUser?.id
    ? `${STUDIO_AUTOSAVE_PREFIX}${currentUser.id}`
    : `${STUDIO_AUTOSAVE_PREFIX}guest`

  // -- Card type from URL. Tier is no longer chosen upfront or read from the
  // URL — under the computed-tier model ("design free, pay at send") it's
  // derived live from what's actually on the card; see the tierRequirement
  // block below, once cardObject/pollData/triviaData/chainData exist.
  const restoreStudioType = searchParams.get('type') || 'personal'

  // Read the most recent autosave for this user/context. Used on mount to
  // restore unsaved work — survives reloads, browser closes, accidental
  // navigation away. Scoped by studioType so we don't restore a poll draft
  // into a personal-card session, etc.
  const readAutoSave = () => {
    try {
      const raw = localStorage.getItem(autoSaveKey)
      if (!raw) return null
      const saved = JSON.parse(raw)
      if (!saved || typeof saved !== 'object') return null
      // Only restore when the user is opening the same type — otherwise a
      // poll draft would clobber a fresh personal-card session.
      if (saved.studioType !== restoreStudioType) return null
      return saved
    } catch {
      return null
    }
  }
  const autoSavedRef = useRef(null)
  if (autoSavedRef.current === null && !location.state?.draftCardObject && !location.state?.cardData && !location.state?.isNew) {
    // Lazy-init once. Skip when an explicit draft is being opened from the
    // drafts list — that path takes priority.
    autoSavedRef.current = readAutoSave() || false
  }
  const initialAutoSaved = autoSavedRef.current && autoSavedRef.current.cardObject
    ? autoSavedRef.current
    : null

  // -- Card type from URL --
  const studioType = searchParams.get('type') || 'personal'
  const typeMeta = STUDIO_TYPE_META[studioType] || STUDIO_TYPE_META.personal

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const payload = await getCardPrices()
        if (mounted) {
          setCardPrices(normalizeCardPrices(payload))
          setFeatureSurcharges(normalizeFeatureSurcharges(payload))
        }
      } catch (error) {
        console.warn('Card pricing load failed; using bundled fallback prices.', error)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Every tool for the card's type is available from the start — there is no
  // tier to unlock them with anymore.
  const isArtist = String(currentUser?.role || '').toLowerCase() === 'artist'
  const allowedToolIds = useMemo(
    () => TOOLS_BY_TYPE[studioType] || TOOLS_BY_TYPE.personal,
    [studioType],
  )
  // Studio editing caps (max poll options, max images, etc.) are always the
  // top-tier caps — the studio itself is unrestricted; only the computed
  // tier/cost that results from what gets used is a consequence, applied at
  // send time. `previewTierLimits` below (declared once the computed tier
  // exists) is the one that should simulate what the recipient actually sees.
  const tierLimits = useMemo(
    () => getTierLimits('elite', { isArtist }),
    [isArtist],
  )
  const canUseBackgroundMusic = tierLimits.allowMusic
  const availablePalettes = PALETTES
  const allowedPaletteIds = useMemo(
    () => new Set(getPalettesForTier('elite').map(p => p.id)),
    [],
  )

  const activeTools = useMemo(
    () => ALL_TOOLS.filter(t => allowedToolIds.includes(t.id)),
    [allowedToolIds],
  )

  // Full font library, always — see tierLimits comment above.
  const availableFonts = useMemo(() => getFontsForTier(studioType, 'elite'), [studioType])
  const fontDropdownOptions = useMemo(
    () => availableFonts.map((f) => {
      const ft = fontTier(f)
      return {
        value: f,
        label: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: `'${f}', serif`, fontSize: '1rem' }}>{f}</span>
            {ft !== 'classic' && <TierPip tier={ft} compact />}
          </span>
        ),
      }
    }),
    [availableFonts],
  )
  const defaultToolId = activeTools[0]?.id || 'content'

  const [cardObject, setCardObject] = useState(() => {
    // Restored drafts are merged over the current defaults rather than used
    // verbatim: a draft saved before a field existed has no key for it, and
    // reading `c.newField.x` on it throws. (This is why CardView needed a
    // one-off backfillEnvelope patch — the same class of bug, one field at a
    // time.) deepMerge lets the saved values win while any field added since
    // the draft was written comes in from defaultCardObject.
    if (existingDraftObject) return deepMerge(structuredClone(defaultCardObject), existingDraftObject)
    if (initialAutoSaved?.cardObject) return deepMerge(structuredClone(defaultCardObject), initialAutoSaved.cardObject)

    let base = resolveTemplateCardObject(cardData)
    const isLightMode = document.documentElement.getAttribute('data-theme') === 'light'
    if (isLightMode && !cardData && !existingDraftObject && !initialAutoSaved) {
       base.card.backgroundColor = '#ffffff'
       base.card.textColor = '#111111'
       base.card.headingColor = '#000000'
       base.closedState.backgroundColor = '#f0f4f8'
       base.closedState.textColor = '#333333'
       base.closedState.headingColor = '#111111'
       base.card.cardBorder.colors = ['#e5e7eb']
       base.closedState.borderColor = '#e5e7eb'
       base.background.colors = ['#f8fafc']
       // Set the closed button text color to black and background to white
       base.closedState.button.backgroundColor = '#ffffff'
       base.closedState.button.textColor = '#000000'
       base.closedState.button.borderColor = '#e5e7eb'
    }
    return base
  })
  const [activeTool, setActiveTool] = useState(defaultToolId)
  // 6.1: "Collapse Studio panels — CONTENT expanded, STYLE / EFFECTS /
  // INTERACTIVE collapsed by default." All four groups used to render
  // fully expanded, always, with no way to collapse any of them.
  const [collapsedGroups, setCollapsedGroups] = useState(
    () => new Set(TOOL_GROUP_ORDER.filter((g) => g !== 'Content')),
  )
  const toggleToolGroup = (group) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }
  // Auto-expand whichever group holds the active tool -- otherwise loading
  // an existing draft whose last-edited tool lives in a collapsed group
  // (e.g. Background) would highlight a tool the sender can't see.
  useEffect(() => {
    const tool = activeTools.find((t) => t.id === activeTool)
    if (tool && collapsedGroups.has(tool.group)) {
      setCollapsedGroups((prev) => {
        const next = new Set(prev)
        next.delete(tool.group)
        return next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool])
  const [activeStep, setActiveStep] = useState(defaultToolId === 'closedState' ? 'envelope' : 'card')
  const [showPreview, setShowPreview] = useState(false)
  const [savedState, setSavedState] = useState(initialAutoSaved ? 'Restored from last session' : 'Unsaved draft')
  const [showPublish, setShowPublish] = useState(false)
  const [publishForm, setPublishForm] = useState({
    name: cardData?.title || existingDraftObject?.content?.heading || resolveTemplateCardObject(cardData).content.heading,
    category: cardData?.category || 'birthday',
    // 3.7: 0 = free (unchanged default); 2-15 CC = a paid marketplace
    // template a buyer must unlock. Enforced again server-side.
    price: 0,
  })
  const [publishError, setPublishError] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(null) // { name, previewImage } | null
  // In edit mode, seed with the template's existing preview image so re-saving
  // doesn't force a fresh screenshot upload when only the design changed.
  const [publishScreenshot, setPublishScreenshot] = useState(
    editTemplateId && cardData?.previewImage
      ? { previewUrl: cardData.previewImage, cloudUrl: cardData.previewImage }
      : null
  ) // { previewUrl, cloudUrl } | null
  const [screenshotUploading, setScreenshotUploading] = useState(false)
  const screenshotInputRef = useRef(null)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState(null) // { ok, slug?, message }
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendCopied, setSendCopied] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const fileInputRef = useRef(null)
  const pendingUploadsRef = useRef(new Map()) // blobUrl → { file, type }

  // Interactive preview editing
  const [activeEditEl, setActiveEditEl] = useState(null) // { type:'heading'|'body'|'extendedBody'|'image', index:number }
  const dragStateRef = useRef(null)
  const editPopoverRef = useRef(null)
  const imgStripRef = useRef(null)
  const [mobileBottomSheet, setMobileBottomSheet] = useState(null) // null|'content'|'layers'|'more'

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
  const [pollData, setPollData] = useState(() => {
    if (initialAutoSaved?.pollData) return initialAutoSaved.pollData
    if (cardData?.poll) {
      return {
        question: cardData.poll.question || '',
        options: Array.isArray(cardData.poll.options) 
          ? cardData.poll.options.map(o => typeof o === 'string' ? o : o.text || '')
          : ['', ''],
        allowMultiple: !!cardData.poll.allowMultiple
      }
    }
    if (cardData?.layoutConfig?.content?.question) {
      return {
        question: cardData.layoutConfig.content.question || '',
        options: Array.isArray(cardData.layoutConfig.content.options)
          ? cardData.layoutConfig.content.options.map(o => typeof o === 'string' ? o : o.text || '')
          : ['', ''],
        allowMultiple: false
      }
    }
    return { question: '', options: ['', ''], allowMultiple: false }
  })
  const [triviaData, setTriviaData] = useState(() => {
    if (initialAutoSaved?.triviaData) return initialAutoSaved.triviaData
    if (cardData?.trivia) {
      return {
        questions: Array.isArray(cardData.trivia.questions) ? cardData.trivia.questions.map(q => ({
          text: q.question || q.text || '',
          options: Array.isArray(q.options) ? q.options.map(o => typeof o === 'string' ? o : o.text || '') : ['', '', '', ''],
          correctIndex: q.correctIndex || 0
        })) : [{ text: '', options: ['', '', '', ''], correctIndex: 0 }]
      }
    }
    if (cardData?.layoutConfig?.content?.questions) {
      return {
        questions: Array.isArray(cardData.layoutConfig.content.questions) ? cardData.layoutConfig.content.questions.map(q => ({
          text: q.question || q.text || '',
          options: Array.isArray(q.options) ? q.options.map(o => typeof o === 'string' ? o : o.text || '') : ['', '', '', ''],
          correctIndex: q.correctIndex || 0
        })) : [{ text: '', options: ['', '', '', ''], correctIndex: 0 }]
      }
    }
    return {
      questions: [{ text: '', options: ['', '', '', ''], correctIndex: 0 }],
    }
  })
  const DEFAULT_CHAIN_TERMINAL = { enabled: false, recipientName: '', recipientEmail: '', unlockType: 'count', unlockAt: '', unlockCount: 5 }
  const [chainData, setChainData] = useState(() => {
    if (initialAutoSaved?.chainData) return { terminal: DEFAULT_CHAIN_TERMINAL, ...initialAutoSaved.chainData }
    if (cardData?.chain) {
      return { enabled: true, prompt: cardData.chain.prompt || cardData.chain.challenge || '', terminal: cardData.chain.terminal ? { ...DEFAULT_CHAIN_TERMINAL, enabled: true, ...cardData.chain.terminal } : DEFAULT_CHAIN_TERMINAL }
    }
    if (cardData?.layoutConfig?.content?.challenge) {
      return { enabled: true, prompt: cardData.layoutConfig.content.challenge || '', terminal: DEFAULT_CHAIN_TERMINAL }
    }
    return { enabled: false, prompt: '', terminal: DEFAULT_CHAIN_TERMINAL }
  })
  const [anonTemplate, setAnonTemplate] = useState(() => {
    const saved = initialAutoSaved?.anonTemplate
    if (saved) {
      return { ...saved, tier: saved.tier === 'premium' ? 'elite' : (saved.tier || 'classic') }
    }
    if (cardData?.anonTier) {
      return { enabled: true, tier: cardData.anonTier === 'premium' ? 'elite' : cardData.anonTier || 'classic' }
    }
    // `tier` here is cosmetic only now — handleSend always overrides it with
    // the computed tier at send time (see the anonTemplate extras below).
    return { enabled: false, tier: 'classic' }
  })
  // Which trivia question the canvas preview is currently showing/editing —
  // previously hardcoded to questions[0], so question 2+ was invisible in the
  // live preview and only reachable via "Full Preview."
  const [triviaPreviewIdx, setTriviaPreviewIdx] = useState(0)
  // Toggles the poll canvas preview between the editable "before vote"
  // question and a simulated "after vote" results screen (sample vote
  // shares) — previously the canvas could only ever show the static
  // pre-vote mock, never what the results screen actually looks like.
  const [pollPreviewShowResults, setPollPreviewShowResults] = useState(false)

  // The card's tier and CC cost, computed live from what's actually on it —
  // "design free, pay at send": there's no upfront tier choice anymore, so
  // this is the single source of truth every other tier-aware value below
  // (tierCost, the tier meter, the send receipt, CardPreviewModal's
  // recipient simulation) derives from.
  const tierRequirement = useMemo(
    () => computeCardTier(cardObject, { type: studioType, pollData, triviaData, chainData, isArtist }),
    [cardObject, studioType, pollData, triviaData, chainData, isArtist],
  )
  const studioTier = tierRequirement.tier
  const tierLabel = TIER_LABELS[studioTier] || 'Classic'
  // 3.2: base type/tier cost + additive feature surcharges (music, Galaxy,
  // lock, question block, extra photos, premium-tier font) -- mirrors what
  // the backend actually charges at creation (cardController.js's
  // getCardTotalCost), fetched live via featureSurcharges rather than
  // hardcoded so the two can't drift.
  const tierCost = getCardTotalCost(cardObject, studioTier, studioType, cardPrices, { type: studioType }, featureSurcharges)
  const featureSurchargeBreakdown = useMemo(
    () => computeFeatureSurcharges(cardObject, { type: studioType }, featureSurcharges).breakdown,
    [cardObject, studioType, featureSurcharges],
  )
  // What CardPreviewModal should simulate for the recipient — unlike the
  // studio's own always-elite editing caps (`tierLimits` above), this must
  // reflect the tier the card will actually send at.
  const previewTierLimits = useMemo(
    () => getTierLimits(studioTier, { isArtist }),
    [studioTier, isArtist],
  )
  // A chain card's "challenge" text lives in `chainData.prompt`, a separate
  // piece of state from `cardObject.content.heading` — but the backend has
  // no dedicated challenge field on the reconstructed card object, so once a
  // chain card round-trips through the backend, `backendCardToCardObject`
  // folds `config.content.challenge` into `content.heading` as a fallback
  // (backendMappers.js). CardPreviewModal only ever reads `content.heading`
  // for the chain stage, so without this substitution "Full Preview" shows
  // the sender's unrelated card title instead of the actual challenge they
  // configured — the prompt looked fine in the Studio's own canvas mock but
  // silently vanished the moment you opened Full Preview.
  const previewCardObject = useMemo(() => {
    if (studioType !== 'chain' || !chainData.prompt) return cardObject
    return { ...cardObject, content: { ...cardObject.content, heading: chainData.prompt } }
  }, [cardObject, studioType, chainData.prompt])
  // What "Trim extras & send free" would actually remove — computed ahead of
  // time so the send receipt can show it before the sender commits to it.
  const trimPreview = useMemo(
    () => (tierCost > 0 ? trimCardToTier(cardObject, 'classic', { type: studioType, pollData, triviaData, chainData }) : null),
    [tierCost, cardObject, studioType, pollData, triviaData, chainData],
  )

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

  useEffect(() => {
    if (activeTool === 'closedState') {
      const panel = document.querySelector('.cs-settings')
      if (panel) {
        if (activeStep === 'letterPeek') {
          const letterPeekSection = document.getElementById('letterPeekSettings')
          if (letterPeekSection) letterPeekSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else if (activeStep === 'envelope') {
          const envelopeSection = document.getElementById('envelopeSettings')
          if (envelopeSection) envelopeSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }
  }, [activeTool, activeStep])

  // Clear inline edit state when preview closes to prevent blank page bug
  useEffect(() => {
    if (!showPreview) {
      setActiveEditEl(null)
    }
  }, [showPreview])

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

  // NOTE: a card's own colors (background/text/heading) are the artist's or
  // template's actual design choices and must render as configured, always —
  // never silently swapped based on the *viewer's own* site theme. (Brand-new
  // blank drafts get sensible light-mode-friendly defaults once, at initial
  // state creation above — that's the only place theme should influence color.)
  const c = {
    ...cardObject,
    background: {
      ...cardObject?.background,
      colors: cardObject?.background?.colors || ['#0a0a0a'],
    },
    card: {
      ...cardObject?.card,
      backgroundColor: cardObject?.card?.backgroundColor || '#111111',
      textColor: cardObject?.card?.textColor || '#ffffff',
      headingColor: cardObject?.card?.headingColor || '#ffffff',
    },
    closedState: {
      ...cardObject?.closedState,
      backgroundColor: cardObject?.closedState?.backgroundColor || '#111111',
      textColor: cardObject?.closedState?.textColor || '#cccccc',
      headingColor: cardObject?.closedState?.headingColor || '#ffffff',
    }
  }
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
      const sharedPayload = {
        name: publishForm.name.trim(),
        type: publishedType,
        tier: studioTier,
        category: publishForm.category || 'birthday',
        price: Number(publishForm.price) || 0,
        previewImage,
        poll: studioType === 'poll' ? pollData : undefined,
        trivia: studioType === 'trivia' ? triviaData : undefined,
        chain: chainData.enabled ? chainData : undefined,
        layoutConfig: structuredClone({
          ...flushedForPublish,
          type: publishedType,
          tier: studioTier,
          category: publishForm.category || 'birthday',
          previewImage,
          previewUrl: previewImage,
          poll: studioType === 'poll' ? pollData : undefined,
          trivia: studioType === 'trivia' ? triviaData : undefined,
          chain: chainData.enabled ? chainData : undefined,
        }),
      }

      const result = editTemplateId
        ? await updateMarketplaceTemplate?.({ templateId: editTemplateId, ...sharedPayload })
        : await publishTemplate?.(sharedPayload)

      if (!result?.ok) {
        setPublishError(result?.message || (editTemplateId ? 'Could not save changes.' : 'Could not submit the template.'))
        return
      }

      try { localStorage.removeItem(autoSaveKey) } catch { /* ignore */ }

      if (editTemplateId) {
        // Nothing left to do in Studio after re-saving an existing template's
        // design — head back to where the edit was started from.
        navigate('/profile')
        return
      }

      setShowPublish(false)
      setSavedState('Template published to marketplace')
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

  const editableText = (node, { trim = false } = {}) => {
    const text = node?.textContent ?? ''
    return trim ? text.trim() : text
  }

  const finishInlineEdit = () => {
    const active = document.activeElement
    if (active?.isContentEditable) {
      active.blur()
      window.setTimeout(() => setActiveEditEl(null), 0)
      return
    }
    setActiveEditEl(null)
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
    if (step === 'envelope' || step === 'letterPeek') setActiveTool('closedState')
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

  // `overrides` lets "Trim extras & send free" pass freshly-trimmed content
  // straight through instead of relying on setState (async, wouldn't have
  // flushed yet) — see handleTrimAndSend below.
  const handleSend = async (overrides = {}) => {
    if (!currentUser) return
    // Guard against a double-click/double-submit firing this twice before the
    // first request resolves — without this, a second click can create a
    // second card, or (if it lands after the first succeeded) re-attempt the
    // gift attach on the same now-gifted card and surface a confusing
    // "This card already has a gift" error.
    if (isSending) return
    const sourcePoll = overrides.pollData || pollData
    const sourceTrivia = overrides.triviaData || triviaData
    const sourceChain = overrides.chainData || chainData
    const sourceTier = overrides.tier || studioTier
    const sourceCost = overrides.tier
      ? getCardTotalCost(overrides.cardObject || cardObject, overrides.tier, studioType, cardPrices, { type: studioType }, featureSurcharges)
      : tierCost
    if (sourceCost > 0 && (balance ?? 0) < sourceCost) {
      setSendResult({ ok: false, message: `You need ${sourceCost} CC to send this card. Your balance: ${balance ?? 0} CC.` })
      return
    }
    setIsSending(true)

    let flushedCardObject
    try {
      flushedCardObject = await flushPendingUploads(overrides.cardObject || cardObject)
      setCardObject(flushedCardObject)
    } catch (err) {
      setSendResult({ ok: false, message: `Media upload failed: ${err.message}. Your draft is safe — try again.` })
      setIsSending(false)
      return
    }

    let selectedGift = flushedCardObject.giftEffect || {}
    if (selectedGift.enabled && selectedGift.isPendingLocal) {
      const refreshedUser = await refreshBalance?.()
      const resolvedGift = refreshedUser?.giftsInventory?.find(g => {
        const gName = g.giftName || g.name || effectKeyToGiftName(g.effectKey) || ''
        const sName = selectedGift.giftName || selectedGift.name || effectKeyToGiftName(selectedGift.effectKey) || ''
        const statusOk = !g.status || ['available', 'active', 'verified', 'owned', 'complete', 'completed'].includes(String(g.status).toLowerCase())
        return gName === sName && !g.isPendingLocal && statusOk
      })
      
      if (resolvedGift) {
        selectedGift = { 
          ...selectedGift, 
          giftId: resolvedGift._id || resolvedGift.id || resolvedGift.inventoryId, 
          isPendingLocal: false 
        }
        flushedCardObject.giftEffect = selectedGift
        setCardObject(flushedCardObject)
      } else {
        setSendResult({
          ok: false,
          message: 'Your gift purchase is still pending verification. Please wait a few moments for the payment to confirm, then try sending again.'
        })
        setIsSending(false)
        return
      }
    }

    const extras = {
      title: flushedCardObject.content?.heading || 'Untitled Card',
      templateId: cardData?.id || 'custom',
      type: studioType,
      tier: sourceTier,
      poll: studioType === 'poll' ? sourcePoll : undefined,
      trivia: studioType === 'trivia' ? sourceTrivia : undefined,
      chain: sourceChain.enabled ? sourceChain : undefined,
      anonTemplate: studioType === 'anonymous' ? { enabled: true, tier: sourceTier } : undefined,
      creationPath: 'studio',
    }

    const result = await createCardOnBackend?.(flushedCardObject, extras)
    setIsSending(false)
    if (result?.ok) {
      // Phase 2.2: the backend's create-card response contract puts `slug`
      // at the top level (createCardInternal, shared by every /create-card*
      // variant) -- that's the one path every caller of this function goes
      // through, so it's the only one trusted here. The fallback below
      // exists only to keep working through a contract violation, and logs
      // loudly if it ever fires so drift doesn't hide silently.
      const d = result.data || {}
      let slug = d.slug || ''
      if (!slug) {
        slug = d.card?.slug || d.renderModel?.slug || ''
        if (slug) {
          console.warn('[CardStudio] Card creation response had no top-level `slug` -- fell back to card.slug/renderModel.slug. Report this response shape:', JSON.stringify(d))
        } else {
          console.warn('Card created but no slug returned. Response shape:', JSON.stringify(d))
        }
      }

      // The gift (if any was selected) is already attached at this point —
      // backendMappers.js's payload builder includes `giftInventoryId` on the
      // create-card request itself, and the backend consumes it atomically
      // with card creation (rolling the card back if the gift turned out to
      // be unavailable, which would have made `result.ok` false above). A
      // second, separate /cards/attach-gift call used to run here too, and
      // it always failed with "This card already has a gift" — the gift had
      // already been attached during creation — surfacing a scary warning on
      // an otherwise fully successful send.
      const selectedGift = flushedCardObject.giftEffect || {}

      setSendResult({ ok: true, slug, message: result.message })
      // 6.1: "instrument both paths -- entry, step completion, send." The
      // reached_review step only proves the sender opened the receipt, not
      // that they actually sent -- they can still cancel from there.
      trackEvent('create_flow_step', { step: 'sent', path: 'studio', type: studioType, tier: sourceTier })
      refreshBalance?.()
      if (selectedGift.enabled && selectedGift.giftId) {
        consumeGift?.(selectedGift.id || selectedGift.inventoryId || selectedGift.giftId || selectedGift._id)
      }
      // Card sent successfully — clear the autosave so the next studio visit
      // starts fresh instead of restoring the just-sent card.
      try { localStorage.removeItem(autoSaveKey) } catch { /* ignore */ }
    } else {
      setSendResult({ ok: false, message: (result?.message ? `${result.message} ` : 'Card creation failed. ') + 'Your draft is safe — try again.' })
    }
  }

  const handleSendClick = () => {
    if (!currentUser) {
      openAuthModal?.()
      return
    }
    setSendResult(null)
    // Always show the receipt first — even free sends — so the sender sees
    // the tier/cost breakdown at least once instead of it happening silently.
    // handleSend() itself only runs once they confirm in the modal.
    setShowSendModal(true)
    trackEvent('create_flow_step', { step: 'reached_review', path: 'studio', type: studioType })
  }

  const handleConfirmSend = async () => {
    await handleSend()
  }

  // "Trim extras & send free" — strips every reason keeping the card above
  // Classic, applies the result to studio state (so the editor reflects what
  // actually got sent), and sends that exact trimmed content immediately
  // rather than waiting a render for state to catch up.
  const handleTrimAndSend = async () => {
    const trimmed = trimCardToTier(cardObject, 'classic', { type: studioType, pollData, triviaData, chainData })
    setCardObject(trimmed.cardObject)
    if (studioType === 'poll') setPollData(trimmed.pollData)
    if (studioType === 'trivia') setTriviaData(trimmed.triviaData)
    if (studioType === 'chain') setChainData(trimmed.chainData)
    await handleSend({
      cardObject: trimmed.cardObject,
      pollData: trimmed.pollData,
      triviaData: trimmed.triviaData,
      chainData: trimmed.chainData,
      tier: 'classic',
    })
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
        poll: studioType === 'poll' ? pollData : undefined,
        trivia: studioType === 'trivia' ? triviaData : undefined,
        chain: chainData.enabled ? chainData : undefined,
        anonTemplate: studioType === 'anonymous' ? anonTemplate : undefined,
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
      .filter(f => f && (f.type?.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i)))
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
          <p className="cs-field-hint">
            Colors cascade from your palette by default — hand-tuning them, or changing the seal,
            paper, or pacing below, is a signature touch <TierPip tier="elite" compact />.
          </p>
          <div className="cs-sub-section" id="envelopeSettings">
            <p className="cs-sub-label">Envelope</p>
            <ColorInput label="Body Color" value={env.bodyColor || '#1a1f2c'} onChange={e => update('closedState.envelope.bodyColor', e.target.value)} />
            <ColorInput label="Flap Color" value={env.flapColor || '#242a38'} onChange={e => update('closedState.envelope.flapColor', e.target.value)} />
            <ColorInput label="Seal Color" value={env.sealColor || '#b03030'} onChange={e => update('closedState.envelope.sealColor', e.target.value)} />
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
                  { value: 'moon', label: 'Moon' },
                  { value: 'flower', label: 'Flower' },
                  { value: 'wax', label: 'Plain wax' },
                ]}
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
          <div className="cs-sub-section" id="letterPeekSettings">
            <p className="cs-sub-label">Inner Letter Peek</p>
            <ColorInput label="Background" value={c.closedState.backgroundColor} onChange={e => update('closedState.backgroundColor', e.target.value)} />
            <ColorInput label="Border" value={c.closedState.borderColor} onChange={e => update('closedState.borderColor', e.target.value)} />
            <ColorInput label="Text Color" value={c.closedState.textColor} onChange={e => update('closedState.textColor', e.target.value)} />
            <ColorInput label="Heading Color" value={c.closedState.headingColor} onChange={e => update('closedState.headingColor', e.target.value)} />
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
            <ColorInput label="Button BG" value={c.closedState.button.backgroundColor} onChange={e => update('closedState.button.backgroundColor', e.target.value)} />
            <ColorInput label="Button Text" value={c.closedState.button.textColor} onChange={e => update('closedState.button.textColor', e.target.value)} />
            <ColorInput label="Button Border" value={c.closedState.button.borderColor} onChange={e => update('closedState.button.borderColor', e.target.value)} />
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
          <h3>Add images to your card <TierPip tier="elite" /></h3>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          {/* Picking a file only queues a local blob URL in pendingUploadsRef —
              the Cloudinary upload is deferred to send time — so there is no
              in-flight state to reflect here. */}
          <button
            type="button"
            className="cs-button"
            onClick={() => fileInputRef.current?.click()}
          >
            + Upload Image
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
                    { value: 'fill', label: 'Fill' },
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
            {['color', 'gradient', 'video', 'animated'].map(type => {
              // Every background type is usable from the start now — picking
              // one just changes what the card computes to at send time
              // (video and animated are always an elite touch; gradient is
              // premium for personal cards, elite for every other type).
              const pipTier = type === 'color' ? null
                : (type === 'video' || type === 'animated') ? 'elite'
                : (studioType === 'personal' ? 'premium' : 'elite')
              return (
                <button
                  key={type}
                  type="button"
                  className={`cs-chip ${c.background.type === type ? 'active' : ''}`}
                  onClick={() => update('background.type', type)}
                >
                  {type}
                  {pipTier && <TierPip tier={pipTier} compact />}
                </button>
              )
            })}
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

          {canUseBackgroundMusic && (
            <div className="cs-sub-section">
              <p className="cs-sub-label"><HiOutlineMusicalNote style={{ verticalAlign: 'middle' }} /> Background Music</p>
              {/* One consistent list style regardless of source — this used
                  to switch between two entirely different UIs (a rich
                  checkmark/trim-badge list for admin tracks vs. a plain
                  chip grid for the hardcoded fallback presets) with no
                  indication to the sender of which one they were looking
                  at. Normalizing both into the same shape first removes
                  that inconsistency. */}
              {(() => {
                const tracks = adminMusic.length > 0
                  ? adminMusic.map(track => ({
                      key: track._id || track.id || track.url,
                      url: track.url || track.audioUrl || track.src || '',
                      label: track.title || track.name || track.label || 'Track',
                      startSec: Number(track.startSec) || 0,
                      endSec: Number(track.endSec) || 0,
                      trimmed: Number(track.endSec) > 0 && (Number(track.endSec) - Number(track.startSec)) < (Number(track.duration) || Infinity),
                    }))
                  : musicPresets.map(preset => ({ key: preset.label, url: preset.url, label: preset.label, startSec: 0, endSec: 0, trimmed: false }))
                return (
                  <>
                    <p className="cs-music-source-label">
                      {adminMusic.length > 0 ? 'Featured tracks' : 'Preset tracks'}
                    </p>
                    <div className="cs-music-picker-list">
                      {tracks.map(track => {
                        const selected = !!track.url && c.background.music.url === track.url
                        return (
                          <button
                            key={track.key}
                            type="button"
                            className={`cs-music-picker-item ${selected ? 'active' : ''}`}
                            onClick={() => {
                              update('background.music.url', track.url)
                              update('background.music.isUploaded', false)
                              update('background.music.startSec', track.startSec)
                              update('background.music.endSec', track.endSec)
                            }}
                          >
                            <span className="cs-music-picker-icon">♫</span>
                            <span className="cs-music-picker-label">{track.label}</span>
                            {track.trimmed && <span className="cs-music-picker-trim">trimmed</span>}
                            {selected && <span className="cs-music-picker-check">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
              {c.background.music.url ? (
                <>
                  <StudioAudioPlayer src={c.background.music.url} volume={c.background.music.volume} silenced={showPreview} />
                  <button type="button" className="cs-inline-remove" style={{ marginTop: 4 }} onClick={() => update('background.music.url', '')}>Remove track</button>
                </>
              ) : null}
              <label className="cs-field">
                <span>Volume</span>
                <input type="range" min="0" max="1" step="0.05" value={c.background.music.volume} onChange={e => update('background.music.volume', Number(e.target.value))} />
                <span className="cs-range-val">{Math.round(c.background.music.volume * 100)}%</span>
              </label>
            </div>
          )}
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
                  className={`cs-palette-chip${activePaletteId === p.id ? ' active' : ''}`}
                  onClick={() => applyPaletteWithHistory(p)}
                  title={p.label}
                >
                  <span className="cs-swatch-bg" aria-hidden="true" style={{ background: `linear-gradient(145deg, ${p.surface} 30%, ${p.primary}55 100%)` }} />
                  {p.tier !== 'classic' && (
                    <span className="cs-swatch-tier-pip"><TierPip tier={p.tier} compact /></span>
                  )}
                  <span className="cs-palette-swatches" aria-hidden="true">
                    <span style={{ background: p.primary }} />
                    <span style={{ background: p.accent }} />
                    <span style={{ background: p.ink, opacity: 0.75 }} />
                  </span>
                  <span className="cs-palette-label">{p.label}</span>
                </button>
              ))}
            </div>
            <p className="cs-field-hint">{availablePalettes.length} palettes — some raise the card's tier, shown with a pip.</p>
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
            <p className="cs-field-hint">{availableFonts.length} fonts — some raise the card's tier, shown with a pip.</p>
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

          {/* Advanced per-field colors — hand-picking here (deviating from the
              applied palette) is what actually makes this an elite touch,
              not the mere presence of the panel. */}
          <details className="cs-sub-section cs-advanced-colors">
              <summary className="cs-sub-label">Advanced colors <TierPip tier="elite" compact /></summary>
              <p className="cs-field-hint">These override the palette. Use sparingly.</p>
              <ColorInput label="Accent Color" value={c.theme.accentColor} onChange={e => update('theme.accentColor', e.target.value)} />
              <ColorInput label="Text Color" value={c.theme.textColor} onChange={e => update('theme.textColor', e.target.value)} />
              <ColorInput label="Heading Color" value={c.theme.headingColor} onChange={e => update('theme.headingColor', e.target.value)} />
          </details>
        </>
      )
    }

    // CARD STYLE
    if (activeTool === 'cardStyle') {
      return (
        <>
          <p className="cs-panel-eyebrow">Card Style</p>
          <h3>Surface, border & text animation</h3>
          <ColorInput label="Card Background" value={c.card.backgroundColor} onChange={e => update('card.backgroundColor', e.target.value)} />
          <ColorInput label="Card Text Color" value={c.card.textColor} onChange={e => update('card.textColor', e.target.value)} />
          <ColorInput label="Card Heading Color" value={c.card.headingColor} onChange={e => update('card.headingColor', e.target.value)} />
          <ColorInput label="Scrollbar Color" value={c.card.scrollbarColor} onChange={e => update('card.scrollbarColor', e.target.value)} />

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
                const pipTier = type === 'animated' ? 'elite' : (type === 'gradient' ? (studioType === 'personal' ? 'premium' : 'elite') : null)
                return (
                  <button
                    key={type}
                    type="button"
                    className={`cs-chip ${c.card.cardBorder.type === type ? 'active' : ''}`}
                    onClick={() => update('card.cardBorder.type', type)}
                  >
                    {type}
                    {pipTier && <TierPip tier={pipTier} compact />}
                  </button>
                )
              })}
            </div>

            {c.card.cardBorder.type !== 'solid' && (
              <div className="cs-sub-section">
                <p className="cs-sub-label">Quick palettes</p>
                <div className="cs-border-presets">
                  {BORDER_PRESETS.map((preset) => {
                    const active = JSON.stringify(c.card.cardBorder.colors) === JSON.stringify(preset.colors)
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`cs-border-preset ${active ? 'active' : ''}`}
                        onClick={() => {
                          update('card.cardBorder.colors', [...preset.colors])
                          update('card.cardBorder.type', preset.mode === 'animated' ? 'animated' : 'gradient')
                        }}
                        title={preset.label}
                      >
                        <span className="cs-border-preset-swatch" style={{ background: `linear-gradient(120deg, ${preset.colors.join(', ')})` }} />
                        <span className="cs-swatch-tier-pip"><TierPip tier={preset.tier} compact /></span>
                        <span className="cs-border-preset-label">{preset.label}</span>
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
              {OPEN_EFFECTS.map(eff => (
                <button
                  key={eff.value}
                  type="button"
                  className={`cs-chip ${c.animation.openEffect === eff.value ? 'active' : ''}`}
                  onClick={() => update('animation.openEffect', eff.value)}
                >
                  {eff.label}
                  {/* Any opening effect is an elite touch — the backend
                      rejects openEffect below elite regardless of an
                      individual effect's own studioEffects.js tag. */}
                  {eff.value !== 'none' && <TierPip tier="elite" compact />}
                </button>
              ))}
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
              {AMBIENT_EFFECTS.map(eff => (
                <button
                  key={eff.value}
                  type="button"
                  className={`cs-chip ${c.animation.backgroundEffect.type === eff.value ? 'active' : ''}`}
                  onClick={() => update('animation.backgroundEffect.type', eff.value)}
                >
                  {eff.label}
                  {eff.tier !== 'none' && <TierPip tier={eff.tier} compact />}
                </button>
              ))}
            </div>
          </div>
        </>
      )
    }

    // EXPERIENCE (galaxy)
    if (activeTool === 'experience') {
      const exp = c.experience || {}
      const images = c.media?.images || []
      const memories = exp.memories || []
      const memoryFor = (index) => memories.find(m => m.mediaIndex === index)
      const setMemory = (index, patch) => {
        const existing = memoryFor(index)
        const next = existing
          ? memories.map(m => (m.mediaIndex === index ? { ...m, ...patch } : m))
          : [...memories, { mediaIndex: index, title: '', note: '', ...patch }]
        update('experience.memories', next.sort((a, b) => a.mediaIndex - b.mediaIndex))
      }
      const toggleMemory = (index) => {
        if (memoryFor(index)) update('experience.memories', memories.filter(m => m.mediaIndex !== index))
        else setMemory(index, {})
      }

      return (
        <>
          <p className="cs-panel-eyebrow">Experience</p>
          <h3>Galaxy of memories</h3>
          <p className="cs-panel-hint">
            Your photos become planets orbiting a galaxy. The recipient explores it
            after the envelope opens, then reads the card.
          </p>

          <div className="cs-sub-section">
            {/* Not .cs-toggle-field: that sets flex-direction on .cs-field,
                which is display:grid, so the rule never takes effect and the
                control stacks vertically. */}
            <label className="cs-gx-toggle">
              <input
                type="checkbox"
                checked={exp.type === 'galaxy'}
                onChange={e => update('experience.type', e.target.checked ? 'galaxy' : 'none')}
              />
              <span className="cs-gx-toggle-label">Open this card as a galaxy</span>
              <TierPip tier="elite" compact />
            </label>
          </div>

          {exp.type === 'galaxy' && (
            <>
              {images.length === 0 ? (
                <p className="cs-info-note">
                  Add photos in the Media panel first — each one becomes a memory
                  orbiting the galaxy.
                </p>
              ) : (
                <>
                  <div className="cs-sub-section">
                    <p className="cs-sub-label">Color Theme</p>
                    <div className="cs-gx-theme-row">
                      {GALAXY_THEMES.map(t => (
                        <button
                          key={t.value}
                          type="button"
                          className={`cs-gx-theme ${(exp.theme || 'rose') === t.value ? 'active' : ''}`}
                          onClick={() => update('experience.theme', t.value)}
                          title={t.label}
                        >
                          <span
                            className="cs-gx-theme-orb"
                            style={{
                              background: `radial-gradient(circle at 32% 28%, ${t.core}, ${t.dust[1]} 60%, ${t.haze})`,
                            }}
                          />
                          <span className="cs-gx-theme-name">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cs-sub-section">
                    <label className="cs-field">
                      <span>Galaxy Name</span>
                      <input
                        value={exp.coreLabel || ''}
                        maxLength={60}
                        placeholder="Cosmos of Memories"
                        onChange={e => update('experience.coreLabel', e.target.value)}
                      />
                    </label>
                    <p className="cs-field-hint">Shown at the centre of the galaxy.</p>
                  </div>

                  <div className="cs-sub-section">
                    <p className="cs-sub-label">Memories</p>
                    <p className="cs-field-hint">
                      Pick which photos become planets, and what each one says.
                    </p>
                    {images.map((img, i) => {
                      const memory = memoryFor(i)
                      return (
                        <div key={i} className={`cs-gx-memory${memory ? ' is-on' : ''}`}>
                          <label className="cs-gx-memory-head">
                            <input
                              type="checkbox"
                              checked={!!memory}
                              onChange={() => toggleMemory(i)}
                            />
                            {img.url
                              ? <img src={img.url} alt="" className="cs-gx-memory-thumb" />
                              : <span className="cs-gx-memory-thumb is-empty" />}
                            <span className="cs-gx-memory-title">
                              {memory?.title?.trim() || `Photo ${i + 1}`}
                            </span>
                          </label>
                          {memory && (
                            <div className="cs-gx-memory-body">
                              <label className="cs-field">
                                <span>Title</span>
                                <input
                                  value={memory.title || ''}
                                  maxLength={60}
                                  placeholder="How it started"
                                  onChange={e => setMemory(i, { title: e.target.value })}
                                />
                              </label>
                              <label className="cs-field">
                                <span>Note</span>
                                <textarea
                                  rows={2}
                                  value={memory.note || ''}
                                  maxLength={400}
                                  placeholder="What this moment means…"
                                  onChange={e => setMemory(i, { note: e.target.value })}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="cs-sub-section">
                    <p className="cs-sub-label">Core Notes</p>
                    <p className="cs-field-hint">
                      Short lines that float out when the recipient taps the centre.
                    </p>
                    {(exp.coreNotes || []).map((note, i) => (
                      <div key={i} className="cs-gx-note-row">
                        <label className="cs-field">
                          <input
                            value={note}
                            maxLength={140}
                            placeholder="You are the softest place I know."
                            onChange={e => {
                              const next = [...exp.coreNotes]
                              next[i] = e.target.value
                              update('experience.coreNotes', next)
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="cs-inline-remove"
                          aria-label={`Remove note ${i + 1}`}
                          onClick={() => update('experience.coreNotes', exp.coreNotes.filter((_, j) => j !== i))}
                        >×</button>
                      </div>
                    ))}
                    {(exp.coreNotes || []).length < 8 && (
                      <button
                        type="button"
                        className="cs-button small"
                        onClick={() => update('experience.coreNotes', [...(exp.coreNotes || []), ''])}
                      >+ Add Note</button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
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
              <>
                <label className="cs-field">
                  <span>{c.interaction.lock.type === 'time' ? 'Unlock Date/Time' : 'Password'}</span>
                  <input
                    type={c.interaction.lock.type === 'time' ? 'datetime-local' : 'text'}
                    value={c.interaction.lock.value}
                    onChange={e => update('interaction.lock.value', e.target.value)}
                  />
                </label>
                <label className="cs-field">
                  <span>Hint</span>
                  <input
                    value={c.interaction.lock.hint || ''}
                    onChange={e => update('interaction.lock.hint', e.target.value)}
                    placeholder={c.interaction.lock.type === 'time' ? 'e.g. "Unlocks on our anniversary"' : 'e.g. "Ask me for the password"'}
                  />
                </label>
              </>
            )}
            {c.interaction.lock.type === 'tap' && (
              <p className="cs-hint">Recipient taps anywhere on the card to reveal it — creates a sense of anticipation.</p>
            )}
            {c.interaction.lock.type === 'scratch' && (
              <p className="cs-hint">Recipient scratches through an overlay to reveal the card — like a scratch card.</p>
            )}
          </div>

          {studioType === 'personal' && (() => {
            const items = c.questions?.items || []
            const hasQuestion = items.length > 0 && (items[0]?.text || '').trim().length > 0
            const suspenseItems = items.slice(1)
            const setQuestionText = (text) => {
              setCardObject(prev => {
                const prevItems = prev.questions?.items || []
                const next = prevItems.length > 0
                  ? [{ ...prevItems[0], text }, ...prevItems.slice(1)]
                  : [{ text, id: 'q1', type: 'text', options: [] }]
                return { ...prev, questions: { ...prev.questions, items: next } }
              })
            }
            const clearQuestion = () => {
              setCardObject(prev => ({ ...prev, questions: { ...prev.questions, items: [] } }))
            }
            const addSuspenseLine = () => {
              setCardObject(prev => {
                const prevItems = prev.questions?.items || []
                if (prevItems.length === 0) return prev
                const nextId = `q${prevItems.length + 1}`
                return { ...prev, questions: { ...prev.questions, items: [...prevItems, { text: '', id: nextId, type: 'text', options: [] }] } }
              })
            }
            const setSuspenseText = (idx, text) => {
              setCardObject(prev => {
                const prevItems = prev.questions?.items || []
                const next = prevItems.map((it, i) => (i === idx + 1 ? { ...it, text } : it))
                return { ...prev, questions: { ...prev.questions, items: next } }
              })
            }
            const removeSuspenseLine = (idx) => {
              setCardObject(prev => {
                const prevItems = prev.questions?.items || []
                const next = prevItems.filter((_, i) => i !== idx + 1)
                return { ...prev, questions: { ...prev.questions, items: next } }
              })
            }
            return (
              <div className="cs-sub-section">
                <p className="cs-sub-label">Question Block <TierPip tier="elite" compact /></p>
                <p className="cs-hint">Ask a yes/no question before the card fully opens — recipients answer, then the rest of the card reveals.</p>
                <label className="cs-field">
                  <span>Question</span>
                  <input
                    value={items[0]?.text || ''}
                    onChange={e => setQuestionText(e.target.value)}
                    placeholder="Will you be my Valentine?"
                  />
                </label>
                {hasQuestion && (
                  <>
                    <div className="cs-sub-section">
                      <p className="cs-sub-label">Suspense lines <small>(shown while they decide)</small></p>
                      {suspenseItems.map((it, i) => (
                        <div key={it.id || i} className="cs-poll-option-row">
                          <label className="cs-field" style={{ flex: 1 }}>
                            <span>Line {i + 1}</span>
                            <input
                              value={it.text || ''}
                              onChange={e => setSuspenseText(i, e.target.value)}
                              placeholder="Are you sure?"
                            />
                          </label>
                          <button type="button" className="cs-remove-btn" onClick={() => removeSuspenseLine(i)}>&times;</button>
                        </div>
                      ))}
                      {suspenseItems.length < 4 && (
                        <button type="button" className="cs-button" onClick={addSuspenseLine}>+ Add suspense line</button>
                      )}
                    </div>
                    <button type="button" className="cs-remove-btn" onClick={clearQuestion}>Remove question block</button>
                  </>
                )}
              </div>
            )
          })()}
        </>
      )
    }

    // 6.3: scheduled send. Free — the frontend never sends a surcharge for
    // it and computeFeatureSurcharges has no rule for it either, so nothing
    // needs to change in tierRequirements.js to keep this free.
    if (activeTool === 'schedule') {
      const scheduledSendAt = c.delivery?.scheduledSendAt || ''
      const minDate = new Date(Date.now() + 15 * 60 * 1000)
      const maxDate = new Date()
      maxDate.setMonth(maxDate.getMonth() + 12)
      return (
        <>
          <p className="cs-panel-eyebrow">Schedule</p>
          <h3>Send this card later</h3>
          <div className="cs-sub-section">
            <p className="cs-hint">Pick a future date and time — the card stays locked to everyone but you until then. Free, no surcharge.</p>
            <label className="cs-field">
              <span>Unlock date &amp; time</span>
              <input
                type="datetime-local"
                value={scheduledSendAt ? toDatetimeLocalValue(new Date(scheduledSendAt)) : ''}
                min={toDatetimeLocalValue(minDate)}
                max={toDatetimeLocalValue(maxDate)}
                onChange={e => {
                  const val = e.target.value
                  update('delivery.scheduledSendAt', val ? new Date(val).toISOString() : '')
                }}
              />
            </label>
            {scheduledSendAt && (
              <button type="button" className="cs-remove-btn" onClick={() => update('delivery.scheduledSendAt', '')}>
                Send immediately instead
              </button>
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
            <p className="cs-sub-label">Options <small>(min 2, max {tierLimits.maxPollOptions ?? 5})</small></p>
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
            {pollData.options.length < (tierLimits.maxPollOptions ?? 5) && (
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
          {triviaData.questions.length < (tierLimits.maxTriviaQuestions ?? 10) && (
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

          {/* 6.4: terminal recipient + unlock condition -- Chain Card type
              only. "Without a terminal recipient it runs open-ended as
              today." Free -- no rule in tierRequirements.js charges for it. */}
          {isChainType && (
            <div className="cs-sub-section">
              <label className="cs-field cs-toggle-field">
                <span>Set a terminal recipient</span>
                <input
                  type="checkbox"
                  checked={chainData.terminal?.enabled || false}
                  onChange={(e) => setChainData((prev) => ({ ...prev, terminal: { ...prev.terminal, enabled: e.target.checked } }))}
                />
              </label>
              {chainData.terminal?.enabled && (
                <>
                  <p className="cs-hint">Contributions close once the unlock condition is met, and the finished chain is delivered to this person.</p>
                  <label className="cs-field">
                    <span>Recipient name</span>
                    <input
                      value={chainData.terminal.recipientName}
                      onChange={(e) => setChainData((prev) => ({ ...prev, terminal: { ...prev.terminal, recipientName: e.target.value } }))}
                      placeholder="Ada"
                    />
                  </label>
                  <label className="cs-field">
                    <span>Recipient email <small>(optional — for a delivery notification)</small></span>
                    <input
                      type="email"
                      value={chainData.terminal.recipientEmail}
                      onChange={(e) => setChainData((prev) => ({ ...prev, terminal: { ...prev.terminal, recipientEmail: e.target.value } }))}
                      placeholder="ada@example.com"
                    />
                  </label>
                  <p className="cs-sub-label">Unlock when</p>
                  <div className="cs-choice-row">
                    {[{ id: 'count', label: 'N contributors' }, { id: 'date', label: 'A specific date' }].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        className={`cs-chip ${chainData.terminal.unlockType === id ? 'active' : ''}`}
                        onClick={() => setChainData((prev) => ({ ...prev, terminal: { ...prev.terminal, unlockType: id } }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {chainData.terminal.unlockType === 'count' ? (
                    <label className="cs-field">
                      <span>Number of contributors</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={chainData.terminal.unlockCount}
                        onChange={(e) => setChainData((prev) => ({ ...prev, terminal: { ...prev.terminal, unlockCount: e.target.value } }))}
                      />
                    </label>
                  ) : (
                    <label className="cs-field">
                      <span>Unlock date &amp; time</span>
                      <input
                        type="datetime-local"
                        min={toDatetimeLocalValue(new Date(Date.now() + 60 * 1000))}
                        value={chainData.terminal.unlockAt ? toDatetimeLocalValue(new Date(chainData.terminal.unlockAt)) : ''}
                        onChange={(e) => setChainData((prev) => ({ ...prev, terminal: { ...prev.terminal, unlockAt: e.target.value ? new Date(e.target.value).toISOString() : '' } }))}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          )}
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
            <p className="cs-info-note">
              This card will appear as a template option when users visit an anonymous inbox link
              (<code>/ask/@username</code>). Senders pick it to wrap their message — its cost is set
              by the effects you use, same as any other card (see the tier meter above).
            </p>
          )}

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
    if (bt === 'gradient' || bt === 'animated') {
      return {
        '--bdr-c1': c.card.cardBorder.colors?.[0] || '#7ef7ff',
        '--bdr-c2': c.card.cardBorder.colors?.[1] || '#62ffa2',
        '--bdr-w': `${c.card.cardBorder.width ?? 2}px`,
        '--bdr-anim-dur': `${c.card.cardBorder.animationDuration || 2}s`,
      }
    }
    return {}
  }, [c.card.cardBorder])
  // 'animated' used to fall through cardBorderCss with no styling at all
  // (no border, no animation) — it only ever picked up the 'gradient' class
  // here, so choosing "Animated" in the panel visually looked identical to
  // no border whatsoever.
  const cardBorderClass = c.card.cardBorder.type === 'gradient' ? ' cs-border-glow'
    : c.card.cardBorder.type === 'animated' ? ' cs-border-glow cs-border-spin'
    : ''

  // Surface Transparency slider — previously a complete no-op in the Studio
  // canvas: every preview site set `backgroundColor: c.card.backgroundColor`
  // directly, never reading `c.card.backgroundOpacity` at all, so moving the
  // slider changed nothing visible while editing (it did, separately, fail
  // to persist too — see the styleExtras.backgroundOpacity fix in
  // backendMappers.js).
  const cardSurfaceCss = useMemo(() => {
    const hex = (c.card.backgroundColor || '#111111').replace('#', '')
    const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex.padEnd(6, '0').slice(0, 6)
    const r = parseInt(full.slice(0, 2), 16) || 0
    const g = parseInt(full.slice(2, 4), 16) || 0
    const b = parseInt(full.slice(4, 6), 16) || 0
    const alpha = 1 - (Number(c.card.backgroundOpacity) || 0)
    return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})`, ...cardBorderCss }
  }, [c.card.backgroundColor, c.card.backgroundOpacity, cardBorderCss])

  const previewBgAnimated = c.background.type === 'gradient' || c.background.type === 'animated'

  const colorPresets = useMemo(() => [
    c.card.backgroundColor, c.card.headingColor, c.card.textColor,
    c.theme.accentColor, c.closedState.backgroundColor, c.closedState.headingColor,
    '#ffffff', '#000000', '#7ef7ff', '#62ffa2', '#ff6b6b', '#ffaa22',
  ].filter(v => v && /^#[0-9a-f]{3,8}$/i.test(String(v)))
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 12), [c])

  // Mirrors CardPreviewModal's `renderBgEffect` (the recipient's actual
  // ambient-effect render) so the "Live Preview" canvas isn't flat/static
  // while the sender is choosing an ambient effect. AmbientParticles itself
  // no-ops when getAmbientPreset has nothing for a given type, so every
  // real AMBIENT_EFFECTS value renders here rather than a hand-picked
  // subset drifting out of sync with studioEffects.js.
  const renderStudioAmbientEffect = () => {
    const eff = c.animation?.backgroundEffect
    if (!eff || eff.type === 'none') return null
    return <AmbientParticles type={eff.type} zIndex={1} intensity={studioMotionIntensity} />
  }

  const renderStudioContentPreview = (compact = false) => {
    const triviaIdx = Math.min(triviaPreviewIdx, Math.max(triviaData.questions.length - 1, 0))
    const previewQuestion = triviaData.questions[triviaIdx] || { text: '', options: ['', '', '', ''], correctIndex: 0 }
    if (studioType === 'poll') {
      const headingSize = c.theme.headingSize ?? 28
      return (
        <div
          className={`cs-preview-poll ${compact ? 'compact' : ''}`}
          style={{ ...cardSurfaceCss }}
          onClick={() => setActiveEditEl(null)}
        >
          <div className="cs-preview-poll-head">
            <p className="cs-preview-poll-eyebrow">&#x1F4CA; Live Poll Experience</p>
            {!compact && (
              <button
                type="button"
                className="cs-preview-pill cs-preview-pill-toggle"
                onClick={e => { e.stopPropagation(); setPollPreviewShowResults(v => !v) }}
              >
                {pollPreviewShowResults ? 'Show question' : 'Preview results'}
              </button>
            )}
          </div>
          <h3
            contentEditable={!compact}
            suppressContentEditableWarning
            data-placeholder="Card heading"
            className={`cs-editable${!compact && activeEditEl?.type === 'heading' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, fontSize: `${headingSize}px`, outline: 'none' }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'heading', index: 0 }) } }}
            onBlur={e => { if (!compact) update('content.heading', editableText(e.currentTarget)) }}
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
            onBlur={e => { if (!compact) setPollData(prev => ({ ...prev, question: editableText(e.currentTarget) })) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {pollData.question || 'Ask a question your recipients can answer instantly.'}
          </p>
          {!compact && pollPreviewShowResults ? (
            <div className="cs-preview-poll-results" onClick={e => e.stopPropagation()}>
              {(() => {
                const opts = pollData.options.length > 0 ? pollData.options : ['', '']
                // Deterministic sample shares (not real votes) — just enough
                // spread to show what a leading/trailing option looks like.
                const raw = opts.map((_, i) => 8 + ((i * 37 + 13) % 60))
                const total = raw.reduce((a, b) => a + b, 0) || 1
                const pcts = raw.map(v => Math.round((v / total) * 100))
                const maxPct = Math.max(...pcts)
                return opts.map((opt, i) => (
                  <div key={i} className={`cs-preview-poll-result-row${pcts[i] === maxPct ? ' leading' : ''}`}>
                    <div className="cs-preview-poll-result-label" style={{ color: c.card.textColor }}>
                      <span>{opt || `Option ${i + 1}`}</span>
                      <span className="cs-preview-poll-result-pct">{pcts[i]}%</span>
                    </div>
                    <div className="cs-preview-poll-result-bar">
                      <div className="cs-preview-poll-result-fill" style={{ width: `${pcts[i]}%`, background: c.theme.accentColor }} />
                    </div>
                  </div>
                ))
              })()}
              <p className="cs-preview-poll-results-note">Sample results — real votes replace these once sent</p>
            </div>
          ) : (
            <div className="cs-preview-poll-options" onClick={e => e.stopPropagation()}>
              {(pollData.options.length > 0 ? pollData.options : ['', '']).map((opt, i) => (
                <div key={i} className="cs-preview-poll-option" style={{ color: c.card.textColor }}>
                  <span className="cs-preview-poll-dot" />
                  {compact ? (
                    <span>{opt || `Option ${i + 1}`}</span>
                  ) : (
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder={`Option ${i + 1}`}
                      className="cs-editable cs-poll-opt-editable"
                      style={{ outline: 'none', display: 'inline-block', minWidth: 60, cursor: 'text' }}
                      onClick={e => { e.stopPropagation(); setActiveEditEl({ type: 'pollOption', index: i }) }}
                      onBlur={e => {
                        const text = editableText(e.currentTarget, { trim: true })
                        setPollData(prev => {
                          const opts = [...prev.options]
                          while (opts.length <= i) opts.push('')
                          opts[i] = text
                          return { ...prev, options: opts }
                        })
                        setActiveEditEl(null)
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                    >
                      {opt}
                    </span>
                  )}
                </div>
              ))}
              {!compact && pollData.options.length < 6 && (
                <button
                  type="button"
                  className="cs-preview-poll-add-opt"
                  onClick={e => { e.stopPropagation(); setPollData(prev => ({ ...prev, options: [...prev.options, ''] })) }}
                >+ Add option</button>
              )}
            </div>
          )}
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
            <span className="cs-preview-watermark-cta">Cardora</span>
            <span className="cs-preview-watermark-sep">·</span>
            <span className="cs-preview-watermark-cta">Create yours →</span>
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
          style={{ ...cardSurfaceCss }}
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
            onBlur={e => { if (!compact) update('content.heading', editableText(e.currentTarget)) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {c.content.heading}
          </h3>
          <div className="cs-preview-trivia-counter" style={{ color: c.theme.accentColor }} onClick={e => e.stopPropagation()}>
            {triviaData.questions.length > 1 && (
              <button
                type="button"
                className="cs-preview-trivia-nav"
                disabled={triviaIdx === 0}
                onClick={() => setTriviaPreviewIdx(i => Math.max(0, i - 1))}
              >‹</button>
            )}
            <span style={{ cursor: 'pointer' }} onClick={() => { setActiveTool('trivia'); setActiveStep('card') }} title="Click to edit trivia">
              Question {triviaIdx + 1} of {Math.max(triviaData.questions.length, 1)}
            </span>
            {triviaData.questions.length > 1 && (
              <button
                type="button"
                className="cs-preview-trivia-nav"
                disabled={triviaIdx >= triviaData.questions.length - 1}
                onClick={() => setTriviaPreviewIdx(i => Math.min(triviaData.questions.length - 1, i + 1))}
              >›</button>
            )}
          </div>
          <div className="cs-preview-trivia-q" style={{ color: c.card.textColor }}>
            <p
              contentEditable={!compact}
              suppressContentEditableWarning
              data-placeholder="Place your quiz question here."
              className={`cs-editable${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
              style={{ outline: 'none' }}
              onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
              onBlur={e => { if (!compact) setTriviaData(prev => { const qs = [...(prev.questions || [])]; qs[triviaIdx] = { ...(qs[triviaIdx] || { options: ['', '', '', ''], correctIndex: 0 }), text: editableText(e.currentTarget) }; return { ...prev, questions: qs } }) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
            >
              {previewQuestion.text || 'Place your quiz question here.'}
            </p>
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
                    const text = editableText(e.currentTarget, { trim: true })
                    setTriviaData(prev => {
                      const qs = [...prev.questions]
                      const opts = [...(qs[triviaIdx]?.options || [])]
                      while (opts.length <= oi) opts.push('')
                      opts[oi] = text
                      qs[triviaIdx] = { ...qs[triviaIdx], options: opts }
                      return { ...prev, questions: qs }
                    })
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                >
                  {opt || ''}
                </span>
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
            <span className="cs-preview-watermark-cta">Cardora</span>
            <span className="cs-preview-watermark-sep">·</span>
            <span className="cs-preview-watermark-cta">Create yours →</span>
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
          style={{ ...cardSurfaceCss }}
          onClick={() => setActiveEditEl(null)}
        >
          <h3
            contentEditable={!compact}
            suppressContentEditableWarning
            data-placeholder="Card heading"
            className={`cs-editable${!compact && activeEditEl?.type === 'heading' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, fontSize: `${headingSize}px`, outline: 'none' }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'heading', index: 0 }) } }}
            onBlur={e => { if (!compact) update('content.heading', editableText(e.currentTarget)) }}
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
            onBlur={e => { if (!compact) update('content.body', editableText(e.currentTarget)) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {c.content.body}
          </p>
          <div className="cs-chain-reply-strip" style={{ marginTop: 'auto' }} onClick={e => e.stopPropagation()}>
            <span>🔗</span>
            {compact ? (
              <span>{chainData.prompt || "Now it's your turn…"}</span>
            ) : (
              <span
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Now it's your turn…"
                className="cs-editable"
                style={{ outline: 'none', flex: 1, cursor: 'text' }}
                onClick={e => { e.stopPropagation(); setActiveEditEl({ type: 'chainPrompt', index: 0 }) }}
                onInput={e => {
                  const nextPrompt = editableText(e.currentTarget, { trim: true })
                  setChainData(prev => prev.prompt === nextPrompt ? prev : { ...prev, prompt: nextPrompt })
                }}
                onBlur={e => {
                  setChainData(prev => ({ ...prev, prompt: editableText(e.currentTarget, { trim: true }) }))
                  setActiveEditEl(null)
                }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              >
                {chainData.prompt}
              </span>
            )}
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
            <span className="cs-preview-watermark-cta">Cardora</span>
            <span className="cs-preview-watermark-sep">·</span>
            <span className="cs-preview-watermark-cta">Create yours →</span>
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
                onBlur={e => { if (!compact) update('content.heading', editableText(e.currentTarget)) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              >
                {c.content.heading || ''}
              </h4>
              <p
                contentEditable={!compact}
                suppressContentEditableWarning
                data-placeholder="A note for senders (optional)…"
                className={`cs-editable${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
                style={{ color: c.card.textColor, outline: 'none' }}
                onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
                onBlur={e => { if (!compact) update('content.body', editableText(e.currentTarget)) }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
              >
                {c.content.body || ''}
              </p>
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
            <span className="cs-preview-watermark-cta">Cardora</span>
            <span className="cs-preview-watermark-sep">·</span>
            <span className="cs-preview-watermark-cta">Create yours →</span>
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
                      <Dropdown
                        className="cs-m2-dropdown"
                        usePortal
                        value={img.fit || 'cover'}
                        onChange={v => updateImageSetting(i, 'fit', v)}
                        options={[
                          { value: 'cover', label: 'Cover' },
                          { value: 'contain', label: 'Contain' },
                          { value: 'fill', label: 'Fill' },
                        ]}
                      />
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
        onBlur={e => { if (!compact) update('content.heading', editableText(e.currentTarget)) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      >
        {c.content.heading}
      </h3>
    )

    const bodyLong = (c.content.body || '').length > 150 || (c.content.extendedBody || '').length > 50
    // Mirrors CardPreviewModal's hasFadeIn/hasTypewriter gating — previously
    // the reveal animation was a flat CSS-class rule (`csTypeReveal 1.6s`)
    // applied to every card regardless of these settings, so neither
    // dropdown ever visibly changed anything in the Studio preview,
    // including picking "None" on both.
    const fadeSpeed = Number(c.card.textBodyAnimation?.fadeInDuration) || 0
    const typeSpeed = Number(c.card.textBodyAnimation?.selfTypeSpeed) || 0
    const bodyAnimStyle = typeSpeed > 0
      ? { animationDuration: `${typeSpeed * 1.4}s` }
      : fadeSpeed > 0
        ? { animation: `csFadeIn ${fadeSpeed}s ease both` }
        : { animation: 'none' }
    const bodyBlock = (
      <div key="body" className={`cs-preview-body-wrap${bodyLong ? ' cs-body-has-scroll' : ''}`}>
        {/* Body + extended body scroll as ONE unit — animating them as two
            separately-transformed siblings (each translateY computed off its
            own height) made a short body text jump down on top of the
            extended paragraph below it whenever only the extended text was
            long enough to trigger auto-scroll. */}
        <div className="cs-preview-body-scroll-inner">
          <p
            contentEditable={!compact}
            suppressContentEditableWarning
            data-placeholder="Click to add your message"
            data-edit-hint="Click to edit"
            className={`cs-editable cs-preview-body-text${!compact && activeEditEl?.type === 'body' ? ' cs-edit-active' : ''}`}
            style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif`, fontSize: `${bodySize}px`, outline: 'none', ...bodyAnimStyle }}
            onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'body', index: 0 }) } }}
            onBlur={e => { if (!compact) update('content.body', editableText(e.currentTarget)) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
          >
            {c.content.body}
          </p>
          {(c.content.extendedBody || (!compact && activeEditEl?.type === 'extendedBody')) && (
            <p
              contentEditable={!compact}
              suppressContentEditableWarning
              className={`cs-extended cs-editable${!compact && activeEditEl?.type === 'extendedBody' ? ' cs-edit-active' : ''}`}
              style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif`, fontSize: `${bodySize}px`, outline: 'none', ...bodyAnimStyle }}
              onClick={e => { if (!compact) { e.stopPropagation(); setActiveEditEl({ type: 'extendedBody', index: 0 }) } }}
              onBlur={e => { if (!compact) update('content.extendedBody', editableText(e.currentTarget)) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } }}
            >
              {c.content.extendedBody}
            </p>
          )}
        </div>
      </div>
    )

    const elementMap = { media: mediaBlock, heading: headingBlock, body: bodyBlock }

    return (
      <div
        className={`cs-preview-card${cardBorderClass} ${compact ? 'compact' : ''}${previewDragOver && !compact ? ' cs-drop-active' : ''}`}
        style={{ ...cardSurfaceCss }}
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
          <span className="cs-preview-watermark-cta">Cardora</span>
          <span className="cs-preview-watermark-sep">·</span>
          <span className="cs-preview-watermark-cta">Create yours →</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`page-body cs-shell${isArtist ? ' cs-shell-artist' : ''}`} style={{ '--type-accent': TYPE_ACCENT[studioType] || TYPE_ACCENT.personal }}>
      {/* TOPBAR */}
      <div className="cs-topbar">
        {/* Left: back + branding */}
        <div className="cs-top-left">
          <button type="button" className="cs-back-btn" onClick={() => navigate(-1)} title="Back">
            <span className="cs-back-arrow">←</span>
          </button>
          <div className="cs-wordmark">
            <img src={BRAND_LOGO} alt="Cardora" className="cs-top-logo" />
            <span>{isArtist ? 'Artist Studio' : 'Studio'}</span>
            {isArtist && <span className="cs-artist-badge">✦ Artist</span>}
          </div>
          <span className="cs-top-divider" />
          <div className="cs-top-meta">
            <span className={`cs-type-badge ${typeMeta.badge}`}>
              <typeMeta.Icon size={13} className="cs-type-badge-icon" />
              {typeMeta.label}
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
              <div className={`cs-top-tier-group${short ? ' short' : ''}`}>
                <span className="cs-cc-balance-chip" title="Your CC balance">◈ {bal} CC</span>
                <TierMeter tier={studioTier} cost={tierCost} reasons={tierRequirement.reasons} />
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
          {isArtist ? (
            <button type="button" className="cs-nav-btn publish" onClick={() => setShowPublish(true)}>
              {editTemplateId ? 'Save Changes' : 'Publish'}
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
            const isCollapsed = collapsedGroups.has(group)
            return (
              <div key={group} className={`cs-toolgroup ${isCollapsed ? 'collapsed' : ''}`}>
                <button
                  type="button"
                  className="cs-toolgroup-label cs-toolgroup-toggle"
                  onClick={() => toggleToolGroup(group)}
                  aria-expanded={!isCollapsed}
                >
                  {group}
                  <span className="cs-toolgroup-chevron">{isCollapsed ? '▸' : '▾'}</span>
                </button>
                {!isCollapsed && tools.map(tool => {
                  const Icon = tool.icon
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={`cs-tool ${activeTool === tool.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTool(tool.id)
                        if (tool.id === 'closedState') setActiveStep('envelope')
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
                ▶ Play it through
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
                {renderStudioAmbientEffect()}
                {/* Envelope State Preview — editable */}
                {activeStep === 'envelope' && (
                  <StudioEnvelope
                    envelope={c.closedState.envelope}
                    borderColor={c.closedState.borderColor}
                    recipientCaption={c.closedState.envelope?.recipientCaption}
                    recipientEmail={currentUser?.email}
                    width={240}
                    activeEditEl={activeEditEl}
                    onSelect={setActiveEditEl}
                    onDismiss={() => setActiveEditEl(null)}
                    showToolbar
                    colorPresets={colorPresets}
                    onUpdate={update}
                    containerStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                )}

                {/* Letter Peek State Preview — editable */}
                {activeStep === 'letterPeek' && (
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
                      onBlur={e => { update('closedState.headingText', editableText(e.currentTarget)); setActiveEditEl(null) }}
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
                      onBlur={e => { update('closedState.bodyText', editableText(e.currentTarget)); setActiveEditEl(null) }}
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
            {!isArtist && (
              <>
                <TierMeter tier={studioTier} cost={tierCost} reasons={tierRequirement.reasons} compact />
                <span className="cs-m2-meta-sep" />
              </>
            )}
            <span className="cs-m2-meta-type">{TYPE_LABEL[studioType] || 'Personal Card'}</span>
            <span className="cs-m2-meta-sep" />
            <span className="cs-m2-meta-tools">{activeTools.length} tools</span>
            <span className="cs-m2-cc-pill">◈ {balance ?? 0} CC</span>
          </div>
          {/* Row 3: live · undo/redo */}
          <div className="cs-m2-controls-row">
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
          {renderStudioAmbientEffect()}
          {activeStep === 'envelope' ? (
            <StudioEnvelope
              envelope={c.closedState.envelope}
              borderColor={c.closedState.borderColor}
              recipientCaption={c.closedState.envelope?.recipientCaption}
              recipientEmail={currentUser?.email}
              width={260}
              activeEditEl={activeEditEl}
              onSelect={setActiveEditEl}
              onDismiss={() => setActiveEditEl(null)}
              showToolbar={false}
              onUpdate={update}
              containerStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            />
          ) : activeStep === 'letterPeek' ? (
            <div className="cs-preview-closed compact" style={{ backgroundColor: c.closedState.backgroundColor, border: `2px solid ${c.closedState.borderColor}` }} onClick={() => setActiveEditEl(null)}>
              <h3
                contentEditable
                suppressContentEditableWarning
                className={`cs-editable${activeEditEl?.type === 'closedHeading' ? ' cs-edit-active' : ''}`}
                style={{ color: c.closedState.headingColor, fontFamily: `'${c.closedState.headingFont}', serif`, outline: 'none' }}
                onClick={e => { e.stopPropagation(); setActiveEditEl({ type: 'closedHeading', index: 0 }) }}
                onBlur={e => { update('closedState.headingText', editableText(e.currentTarget)); setActiveEditEl(null) }}
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
                onBlur={e => { update('closedState.bodyText', editableText(e.currentTarget)); setActiveEditEl(null) }}
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
                 activeEditEl.type === 'closedBody' ? 'ENVELOPE TEXT' :
                 activeEditEl.type === 'envelopeBody' ? 'ENVELOPE BODY' :
                 activeEditEl.type === 'envelopeFlap' ? 'ENVELOPE FLAP' :
                 activeEditEl.type === 'envelopeSeal' ? 'ENVELOPE SEAL' : 'ELEMENT'}
              </span>
              {(activeEditEl.type === 'heading' || activeEditEl.type === 'closedHeading') && (
                <span className="cs-m2-edit-preview">
                  "{(activeEditEl.type === 'heading' ? c.content.heading : c.closedState.headingText || '').slice(0, 24)}
                  {(activeEditEl.type === 'heading' ? c.content.heading : c.closedState.headingText || '').length > 24 ? '…' : ''}"
                </span>
              )}
              <button type="button" className="cs-m2-edit-done-btn" onClick={finishInlineEdit}>Done</button>
            </div>
            {/* Row 2: controls for the selected element */}
            <div className="cs-m2-edit-controls">
              {/* Envelope Body controls */}
              {activeEditEl.type === 'envelopeBody' && (() => {
                const env = c.closedState.envelope || {}
                return (
                  <>
                    {colorPresets.map((col, i) => (
                      <button key={i} type="button" className={`cs-m2-color-dot${env.bodyColor === col ? ' active' : ''}`} style={{ background: col }} onClick={() => update('closedState.envelope.bodyColor', col)} />
                    ))}
                    <div className="cs-m2-color-input-wrap" title="Custom color">
                      <input type="color" value={env.bodyColor || '#1a1f2c'} onChange={e => update('closedState.envelope.bodyColor', e.target.value)} />
                    </div>
                    <span className="cs-m2-ctrl-sep" />
                    <span className="cs-m2-slider-label">Texture</span>
                    <Dropdown
                      className="cs-m2-dropdown"
                      usePortal
                      value={env.paperTexture || 'smooth'}
                      onChange={v => update('closedState.envelope.paperTexture', v)}
                      options={[
                        { label: 'Smooth', value: 'smooth' },
                        { label: 'Linen', value: 'linen' },
                        { label: 'Parchment', value: 'parchment' }
                      ]}
                    />
                  </>
                )
              })()}
              {/* Envelope Flap controls */}
              {activeEditEl.type === 'envelopeFlap' && (() => {
                const env = c.closedState.envelope || {}
                return (
                  <>
                    {colorPresets.map((col, i) => (
                      <button key={i} type="button" className={`cs-m2-color-dot${env.flapColor === col ? ' active' : ''}`} style={{ background: col }} onClick={() => update('closedState.envelope.flapColor', col)} />
                    ))}
                    <div className="cs-m2-color-input-wrap" title="Custom color">
                      <input type="color" value={env.flapColor || '#242a38'} onChange={e => update('closedState.envelope.flapColor', e.target.value)} />
                    </div>
                  </>
                )
              })()}
              {/* Envelope Seal controls */}
              {activeEditEl.type === 'envelopeSeal' && (() => {
                const env = c.closedState.envelope || {}
                return (
                  <>
                    {colorPresets.map((col, i) => (
                      <button key={i} type="button" className={`cs-m2-color-dot${env.sealColor === col ? ' active' : ''}`} style={{ background: col }} onClick={() => update('closedState.envelope.sealColor', col)} />
                    ))}
                    <div className="cs-m2-color-input-wrap" title="Custom color">
                      <input type="color" value={env.sealColor || '#b03030'} onChange={e => update('closedState.envelope.sealColor', e.target.value)} />
                    </div>
                    <span className="cs-m2-ctrl-sep" />
                    <span className="cs-m2-slider-label">Icon</span>
                    <Dropdown
                      className="cs-m2-dropdown"
                      usePortal
                      value={env.sealIcon || 'monogram'}
                      onChange={v => update('closedState.envelope.sealIcon', v)}
                      options={SEAL_ICON_OPTIONS}
                    />
                  </>
                )
              })()}
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
                    <Dropdown
                      className="cs-m2-dropdown"
                      usePortal
                      value={img.fit || 'cover'}
                      onChange={v => updateImageSetting(activeEditEl.index, 'fit', v)}
                      options={[
                        { value: 'cover', label: 'Cover' },
                        { value: 'contain', label: 'Contain' },
                        { value: 'fill', label: 'Fill' },
                      ]}
                    />
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
            {/* ── Step tabs — only meaningful for personal cards' 3-step
                 envelope/letterPeek/card flow; every other type has a
                 single 'card' step, so this row would just be a dead
                 "01 Card" tab with nothing to switch between. ── */}
            {studioSteps.filter(s => s !== 'preview').length > 1 && (
              <div className="cs-m2-step-tabs">
                {studioSteps.filter(s => s !== 'preview').map((step, i) => {
                  let StepIcon = HiOutlineDocumentText
                  if (step === 'envelope') StepIcon = HiOutlineEnvelope
                  if (step === 'letterPeek') StepIcon = HiOutlineEye
                  return (
                    <button key={step} type="button" className={`cs-m2-step-tab${activeStep === step ? ' active' : ''}`} onClick={() => goToStep(step)}>
                      <span className="cs-m2-step-num">0{i + 1}</span>
                      <span className="cs-m2-step-icon"><StepIcon size={14} /></span>
                      <span className="cs-m2-step-label">{stepLabels[step] || step}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Bottom toolbar ── */}
            <div className="cs-m2-toolbar">
              {[
                { id: 'content', label: 'Content', icon: 'T' },
                // Opens every tool panel (Theme/Background/Card Style/Poll/
                // Gifts/etc.), grouped by category — not a design-tool
                // "layers" stack (no z-order/visibility). "Tools" plus a
                // menu-list glyph reads correctly for what this actually is.
                { id: 'layers',  label: 'Tools',    icon: '☰' },
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
                style={!isArtist ? { '--send-gradient': TYPE_SEND_GRADIENT[studioType] || TYPE_SEND_GRADIENT.personal } : undefined}
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
                    <h3 className="cs-m2-sheet-title">Tools</h3>
                    <button type="button" className="cs-m2-sheet-close" onClick={() => setMobileBottomSheet(null)}>×</button>
                  </div>
                  <div className="cs-m2-sheet-body">
                    <div className="cs-m2-layers-list">
                      {TOOL_GROUP_ORDER.map(group => {
                        const groupTools = activeTools.filter(t => t.group === group)
                        if (!groupTools.length) return null
                        const isCollapsed = collapsedGroups.has(group)
                        return (
                          <section key={group} className={`cs-m2-layer-group ${isCollapsed ? 'collapsed' : ''}`}>
                            <button
                              type="button"
                              className="cs-m2-layer-group-title cs-toolgroup-toggle"
                              onClick={() => toggleToolGroup(group)}
                              aria-expanded={!isCollapsed}
                            >
                              {group}
                              <span className="cs-toolgroup-chevron">{isCollapsed ? '▸' : '▾'}</span>
                            </button>
                            {!isCollapsed && groupTools.map(tool => {
                              const Icon = tool.icon
                              return (
                                <button
                                  key={tool.id}
                                  type="button"
                                  className={`cs-m2-layer-row${activeTool === tool.id ? ' active' : ''}`}
                                  onClick={() => {
                                    setActiveTool(tool.id)
                                    if (tool.id === 'closedState') setActiveStep('envelope')
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

      </div>

      {/* Preview Modal */}
      {showPreview && (
        <CardPreviewModal
          cardObject={previewCardObject}
          studioType={studioType}
          tier={studioTier}
          allowedTools={allowedToolIds}
          tierLimits={previewTierLimits}
          pollData={pollData}
          triviaData={triviaData}
          anonTemplate={anonTemplate}
          onClose={() => {
            setShowPreview(false)
            setActiveEditEl(null)
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
              {editTemplateId
                ? "You're editing a live template — saving updates it in place for everyone who sees it in the marketplace."
                : 'Your template will go live in the Cardora marketplace as soon as you publish it.'}
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
                <Dropdown
                  value={publishForm.category || 'birthday'}
                  onChange={(val) =>
                    setPublishForm((prev) => ({ ...prev, category: val }))
                  }
                  options={[
                    { value: 'birthday', label: 'Birthday' },
                    { value: 'anniversary', label: 'Anniversary' },
                    { value: 'wedding', label: 'Wedding' },
                    { value: 'proposal', label: 'Proposal' },
                    { value: 'graduation', label: 'Graduation' },
                    { value: 'holiday', label: 'Holiday' },
                    { value: 'thank-you', label: 'Thank You' },
                    { value: 'apology', label: 'Apology' },
                    { value: 'celebration', label: 'Celebration' },
                    { value: 'congratulations', label: 'Congratulations' },
                    { value: 'just-because', label: 'Just Because' },
                    { value: 'get-well', label: 'Get Well' },
                    { value: 'sympathy', label: 'Sympathy' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </label>
              <label className="cs-field cs-publish-field">
                <span className="cs-publish-field-label">Price (optional)</span>
                <Dropdown
                  value={String(publishForm.price || 0)}
                  onChange={(val) =>
                    setPublishForm((prev) => ({ ...prev, price: Number(val) || 0 }))
                  }
                  options={[
                    { value: '0', label: 'Free' },
                    ...Array.from({ length: 14 }, (_, i) => i + 2).map((cc) => ({
                      value: String(cc),
                      label: `${cc} CC`,
                    })),
                  ]}
                />
                {Number(publishForm.price) > 0 && (
                  <p className="cs-publish-price-hint">
                    You'll earn {currentUser?.isFoundingArtist ? '60%' : '50%'} in CC each time someone unlocks
                    this template. CC commissions can be spent in Cardora but cannot be cashed out or withdrawn.
                  </p>
                )}
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
                {isPublishing
                  ? (editTemplateId ? 'Saving...' : 'Publishing...')
                  : (editTemplateId ? 'Save Changes ->' : 'Publish to Marketplace ->')}
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
            <h3 className="cs-publish-success-title">Template published!</h3>
            <p className="cs-publish-success-desc">
              <strong>"{publishSuccess.name}"</strong> is now live in the Cardora marketplace.
            </p>
            {publishSuccess.previewImage && (
              <img
                src={publishSuccess.previewImage}
                alt="Submitted template preview"
                className="cs-publish-success-preview"
              />
            )}
            <ul className="cs-publish-success-list">
              <li>Track views, likes, and users under <strong>Profile / Published Templates</strong></li>
              <li>People can discover and use it immediately</li>
              <li>Live templates earn CC every time someone uses them</li>
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
                <h3>{sendResult?.ok ? 'Your card is ready to share!' : isSending ? 'Creating your card…' : (!sendResult ? 'Ready to send' : 'Share Your Card')}</h3>
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

            {/* ── Send receipt: what's on this card, what it costs, why ── */}
            {!isSending && !sendResult && (
              <SendReceipt
                reasons={tierRequirement.reasons}
                tier={studioTier}
                cost={tierCost}
                tierFloor={getTierCost(studioTier, studioType, cardPrices)}
                surcharges={featureSurchargeBreakdown}
                balance={balance ?? 0}
                sending={isSending}
                onSend={handleConfirmSend}
                onTrim={handleTrimAndSend}
                trimPreview={trimPreview}
                onCancel={() => { setShowSendModal(false); setSendResult(null) }}
              />
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
              <>
                <p className="cs-send-modal-note" style={{ color: '#ffb4b4' }}>
                  {sendResult.message || 'Something went wrong. Your draft is safe — try again.'}
                </p>
                <div className="cs-send-confirm-actions" style={{ marginTop: 4 }}>
                  <button type="button" className="cs-send-confirm-cancel" onClick={() => { setShowSendModal(false); setSendResult(null) }}>Close</button>
                  <button type="button" className="cs-send-confirm-btn" onClick={handleConfirmSend}>Try Again</button>
                </div>
              </>
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

            {!isSending && sendResult?.ok && (
              <InstallPrompt canInstall={canInstall} promptInstall={promptInstall} />
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











