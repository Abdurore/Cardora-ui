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
import logo from '../assets/icons/logo.png'
import { defaultCardObject, resolveTemplateCardObject, musicPresets, fontOptions } from '../data/cardDefaults.js'
import CardPreviewModal from '../components/CardPreviewModal.jsx'
import Dropdown from '../components/Dropdown.jsx'
import ColorPicker from '../components/ColorPicker.jsx'
import { dataUrlToBlob, uploadToCloudinary } from '../lib/cloudinary.js'
import { createCardClassic, createCardPremium, createCardElite, createCardAnonymous, getMediaVideos, getMediaMusic } from '../lib/api.js'
import html2canvas from 'html2canvas'
import TemplatePreviewSnapshot from '../components/TemplatePreviewSnapshot.jsx'
import { OPEN_EFFECTS, AMBIENT_EFFECTS } from '../lib/studioEffects.js'

const STUDIO_DRAFT_PREFIX = 'cardora:studioDrafts:'

const steps = ['closed', 'card', 'questions', 'preview']

const ALL_TOOLS = [
  { id: 'closedState', icon: HiOutlineEnvelope, label: 'Envelope', hint: 'Sealed reveal & first impression' },
  { id: 'content', icon: HiOutlineDocumentText, label: 'Content', hint: 'Heading, body, extended' },
  { id: 'media', icon: HiOutlinePhoto, label: 'Media', hint: 'Images & captions' },
  { id: 'background', icon: HiOutlinePaintBrush, label: 'Background', hint: 'Colors, gradients, music' },
  { id: 'theme', icon: IoColorPaletteOutline, label: 'Theme', hint: 'Fonts & palette' },
  { id: 'cardStyle', icon: HiOutlineSparkles, label: 'Card Style', hint: 'Border, scrollbar, text FX' },
  { id: 'animation', icon: HiOutlineSparkles, label: 'Animation', hint: 'Confetti & effects' },
  { id: 'gifts', icon: HiOutlineGift, label: 'Gifts', hint: 'End-of-card gift reveal' },
  { id: 'questions', icon: HiOutlineChatBubbleLeft, label: 'Questions', hint: 'Receiver interaction' },
  { id: 'interaction', icon: HiOutlineLockClosed, label: 'Interaction', hint: 'Lock & reveal' },
  { id: 'poll', icon: HiOutlineChartBarSquare, label: 'Poll', hint: 'Question with selectable choices' },
  { id: 'trivia', icon: HiOutlineLightBulb, label: 'Trivia', hint: 'Scored quiz with correct answers' },
  { id: 'chain', icon: HiOutlineArrowPathRoundedSquare, label: 'Chain', hint: 'Invite recipient to reply with a card' },
  { id: 'anon', icon: HiOutlineEyeSlash, label: 'Anonymous', hint: 'Tag as anonymous inbox template' },
]

// Tools available per type + tier — aligned to home page tier promises:
// Classic  = simple animated reveal, no music/media ("Simple animation, No music")
// Premium  = music + better visuals ("Music + better visuals, Richer motion")
// Elite    = full experience + gifts ("Full animations + effects, gifts") — Moment Card only
const TOOLS_BY_TYPE_TIER = {
  'moment:classic': ['closedState', 'content', 'background', 'theme'],
  'moment:premium': ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation'],
  'moment:elite':   ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'questions', 'interaction', 'gifts'],
  'poll:classic':   ['closedState', 'content', 'background', 'theme', 'poll'],
  'poll:premium':   ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'poll'],
  'trivia:classic': ['closedState', 'content', 'background', 'theme', 'trivia'],
  'trivia:premium': ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'trivia'],
  'chain:classic':  ['closedState', 'content', 'background', 'theme', 'chain'],
  'chain:premium':  ['closedState', 'content', 'media', 'background', 'theme', 'cardStyle', 'animation', 'chain'],
  'anon:classic':   ['closedState', 'content', 'background', 'theme', 'anon'],
  'anon:premium':   ['closedState', 'content', 'media', 'background', 'theme', 'animation', 'anon'],
}

const STUDIO_TYPE_META = {
  moment:    { emoji: '💌', label: 'Moment Card', badge: 'badge-moment' },
  poll:      { emoji: '📊', label: 'Poll Card',   badge: 'badge-poll' },
  trivia:    { emoji: '💡', label: 'Trivia Card', badge: 'badge-trivia' },
  chain:     { emoji: '🔗', label: 'Chain Card',  badge: 'badge-chain' },
  anon:      { emoji: '👁', label: 'Anonymous',   badge: 'badge-anon' },
}

const TYPE_ACCENT = {
  moment: '#f0c060',
  poll:   '#60a5fa',
  trivia: '#a78bfa',
  chain:  '#f97316',
  anon:   '#7ef7ff',
}

const TIER_LABELS = { classic: 'Classic', premium: 'Premium', elite: 'Elite' }

const TIER_COST = { classic: 0, premium: 5, elite: 10 }

const TYPE_LABEL = {
  moment: 'Moment Card',
  poll: 'Poll Card',
  trivia: 'Trivia Card',
  chain: 'Chain Card',
  anon: 'Anonymous',
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

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
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

function generateTemplatePreviewDataUrl(cardObject) {
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 1200
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create preview canvas.')

  const palette = Array.isArray(cardObject.background?.colors) && cardObject.background.colors.length
    ? cardObject.background.colors.slice(0, 3)
    : ['#0d1b22', '#163543', '#091116']

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, palette[0] || '#0d1b22')
  gradient.addColorStop(0.55, palette[1] || palette[0] || '#163543')
  gradient.addColorStop(1, palette[2] || palette[1] || palette[0] || '#091116')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const glow = ctx.createRadialGradient(canvas.width * 0.76, canvas.height * 0.18, 16, canvas.width * 0.76, canvas.height * 0.18, 320)
  glow.addColorStop(0, 'rgba(255,255,255,0.22)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const cardX = 78
  const cardY = 124
  const cardW = canvas.width - 156
  const cardH = canvas.height - 248
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44)
  ctx.fillStyle = 'rgba(7, 14, 18, 0.72)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.stroke()

  const accent = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH)
  accent.addColorStop(0, 'rgba(126, 247, 255, 0.22)')
  accent.addColorStop(1, 'rgba(255, 255, 255, 0.04)')
  ctx.fillStyle = accent
  drawRoundedRect(ctx, cardX + 18, cardY + 18, cardW - 36, cardH - 36, 34)
  ctx.fill()

  ctx.fillStyle = 'rgba(239, 252, 255, 0.88)'
  ctx.font = '700 64px Georgia, serif'
  ctx.textAlign = 'center'
  const heading = cardObject.closedState?.headingText || cardObject.content?.heading || 'A beautiful moment is waiting.'
  wrapCanvasText(ctx, heading, canvas.width / 2, 300, 520, 74)

  ctx.fillStyle = 'rgba(220, 242, 247, 0.74)'
  ctx.font = '400 32px Arial'
  const body = cardObject.closedState?.bodyText || cardObject.content?.body || 'Tap to open a personalized Cardora experience.'
  wrapCanvasText(ctx, body, canvas.width / 2, 520, 560, 44)

  const buttonText = cardObject.closedState?.button?.text || 'Open'
  const buttonShape = cardObject.closedState?.button?.shape || 'pill'
  const buttonWidth = 320
  const buttonHeight = 88
  const buttonX = (canvas.width - buttonWidth) / 2
  const buttonY = 880
  const buttonRadius = buttonShape === 'square' ? 18 : buttonShape === 'sharp' ? 8 : 999
  drawRoundedRect(ctx, buttonX, buttonY, buttonWidth, buttonHeight, buttonRadius)
  ctx.fillStyle = 'rgba(126, 247, 255, 0.18)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(126, 247, 255, 0.35)'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#f4fdff'
  ctx.font = '700 30px Arial'
  ctx.fillText(buttonText, canvas.width / 2, buttonY + 54)

  ctx.fillStyle = 'rgba(220, 242, 247, 0.38)'
  ctx.font = '600 20px Arial'
  ctx.fillText('Cardora Template Preview', canvas.width / 2, canvas.height - 90)

  return canvas.toDataURL('image/jpeg', 0.88)
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
  const { currentUser, publishTemplate, createCardOnBackend } = useOutletContext() || {}
  // Read card type and tier from location state (set by CreateCardPicker)
  const cardData = useMemo(() => location.state?.cardData || null, [location.state])
  const existingDraftObject = useMemo(() => location.state?.draftCardObject || null, [location.state])
  const draftIdRef = useRef(location.state?.draftId || cardData?.draftId || `draft-${Date.now()}`)
  const draftStorageKey = currentUser?.id
    ? `${STUDIO_DRAFT_PREFIX}${currentUser.id}`
    : `${STUDIO_DRAFT_PREFIX}guest`

  // -- Card type + tier from URL --
  const studioType = searchParams.get('type') || 'moment'
  const studioTier = searchParams.get('tier') || 'classic'
  const typeMeta = STUDIO_TYPE_META[studioType] || STUDIO_TYPE_META.moment
  const tierLabel = TIER_LABELS[studioTier] || 'Classic'

  // Filter tools by type + tier — aligned to home page tier promises
  const activeTools = useMemo(() => {
    const key = `${studioType}:${studioTier}`
    const allowed = TOOLS_BY_TYPE_TIER[key] || TOOLS_BY_TYPE_TIER[`${studioType}:classic`] || TOOLS_BY_TYPE_TIER['moment:classic']
    return ALL_TOOLS.filter(t => allowed.includes(t.id))
  }, [studioType, studioTier])
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
    category: cardData?.category || 'proposal',
    name: cardData?.title || existingDraftObject?.content?.heading || resolveTemplateCardObject(cardData).content.heading,
  })
  const [publishError, setPublishError] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [emojiInput, setEmojiInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState(null) // { ok, slug?, message }
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendCopied, setSendCopied] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const fileInputRef = useRef(null)
  const bgImageInputRef = useRef(null)
  const bgVideoInputRef = useRef(null)
  const musicInputRef = useRef(null)
  const previewSnapshotRef = useRef(null)
  const pendingUploadsRef = useRef(new Map()) // blobUrl → { file, type }
  const [isUploading, setIsUploading] = useState(false)

  // Poll / Trivia / Chain / Anonymous template state
  const [pollData, setPollData] = useState({ question: '', options: ['', ''], allowMultiple: false })
  const [triviaData, setTriviaData] = useState({
    questions: [{ text: '', options: ['', '', '', ''], correctIndex: 0 }],
  })
  const [chainData, setChainData] = useState({ enabled: false, prompt: '' })
  const [anonTemplate, setAnonTemplate] = useState({ enabled: false, tier: studioTier || 'classic' })

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
    else if (studioType === 'anon' || studioType === 'anonymous') { setAnonTemplate(prev => ({ ...prev, enabled: true, tier: studioTier })); setActiveTool(defaultToolId) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const isArtist = currentUser?.role === 'Artist'

  const c = cardObject

  const handlePublish = async () => {
    if (!publishForm.name.trim()) {
      setPublishError('Template name is required.')
      return
    }

    setPublishError('')
    setIsPublishing(true)

    try {
      const flushedForPublish = await flushPendingUploads(cardObject)
      setCardObject(flushedForPublish)

      let previewDataUrl
      if (previewSnapshotRef.current) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve()))
        const canvas = await html2canvas(previewSnapshotRef.current, {
          backgroundColor: null,
          scale: 1,
          useCORS: true,
          logging: false,
        })
        previewDataUrl = canvas.toDataURL('image/jpeg', 0.88)
      } else {
        previewDataUrl = generateTemplatePreviewDataUrl(flushedForPublish)
      }
      const previewBlob = dataUrlToBlob(previewDataUrl)
      const uploadedPreviewImage = await uploadToCloudinary(previewBlob, 'image')
      const previewImage = uploadedPreviewImage || flushedForPublish.media.images?.[0]?.url || flushedForPublish.background.imageUrl || ''

      if (!previewImage) {
        throw new Error('Could not generate a preview image for this template.')
      }

      const result = await publishTemplate?.({
        name: publishForm.name.trim(),
        category: publishForm.category,
        previewImage,
        layoutConfig: structuredClone({
          ...flushedForPublish,
          previewImage,
          previewUrl: previewImage,
        }),
      })

      if (!result?.ok) {
        setPublishError(result?.message || 'Could not submit the template.')
        return
      }

      setShowPublish(false)
      setSavedState('Template submitted to backend')
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
    setIsSending(true)

    // Resolve backend card type from studioType
    const typeMap = { moment: 'standard', poll: 'poll', trivia: 'trivia', chain: 'chain', anon: 'anonymous', anonymous: 'anonymous' }
    const derivedType = typeMap[studioType] || 'standard'

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
      type: derivedType,
      tier: studioTier,
      poll: studioType === 'poll' ? pollData : undefined,
      trivia: studioType === 'trivia' ? triviaData : undefined,
      chain: chainData.enabled ? chainData : undefined,
      anonTemplate: (studioType === 'anon' || studioType === 'anonymous') ? { enabled: true, tier: studioTier } : undefined,
    }

    const result = await createCardOnBackend?.(flushedCardObject, extras)
    setIsSending(false)
    if (result?.ok) {
      const slug = result.data?.card?.slug || result.data?.slug || result.data?.data?.slug || ''
      setSendResult({ ok: true, slug, message: result.message })
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
        occasion: publishForm.category,
        category: publishForm.category,
        tier: cardData?.tier || 'simple',
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

  const handleBackgroundImageUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const blobUrl = URL.createObjectURL(file)
    pendingUploadsRef.current.set(blobUrl, { file, type: 'image' })
    update('background.type', 'image')
    update('background.imageUrl', blobUrl)
    event.target.value = ''
  }

  const handleBackgroundVideoUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const blobUrl = URL.createObjectURL(file)
    pendingUploadsRef.current.set(blobUrl, { file, type: 'video' })
    update('background.type', 'video')
    update('background.videoUrl', blobUrl)
    event.target.value = ''
  }

  const handleMusicUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const blobUrl = URL.createObjectURL(file)
    pendingUploadsRef.current.set(blobUrl, { file, type: 'video' })
    update('background.music.url', blobUrl)
    update('background.music.isUploaded', true)
    event.target.value = ''
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
          <div className="cs-sub-section">
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
            <ColorInput label="Background" value={c.closedState.backgroundColor} onChange={e => update('closedState.backgroundColor', e.target.value)} />
            <ColorInput label="Border" value={c.closedState.borderColor} onChange={e => update('closedState.borderColor', e.target.value)} />
          <ColorInput label="Text Color" value={c.closedState.textColor} onChange={e => update('closedState.textColor', e.target.value)} />
          <ColorInput label="Heading Color" value={c.closedState.headingColor} onChange={e => update('closedState.headingColor', e.target.value)} />
          <label className="cs-field">
            <span>Heading Font</span>
            <Dropdown
              value={c.closedState.headingFont}
              onChange={(v) => update('closedState.headingFont', v)}
              options={fontOptions.map(f => ({ value: f, label: f }))}
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
            {['color', 'gradient', 'image', 'video', 'animated'].map(type => (
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

          {c.background.type === 'image' && (
            <div className="cs-sub-section">
              <p className="cs-sub-label">Background Image Upload</p>
              <input
                ref={bgImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleBackgroundImageUpload}
              />
              <button 
                type="button" 
                className={`cs-button ${isUploading ? 'loading' : ''}`} 
                onClick={() => !isUploading && bgImageInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload Image From Device'}
              </button>
              {c.background.imageUrl ? (
                <div className="cs-background-thumb">
                  <img src={c.background.imageUrl} alt="" />
                </div>
              ) : null}
            </div>
          )}

          {c.background.type === 'video' && (
            <div className="cs-sub-section">
              <p className="cs-sub-label">Background Video</p>
              {adminVideos.length > 0 ? (
                <div className="cs-media-picker-grid">
                  {adminVideos.map((v) => {
                    const url = v.url || v.videoUrl || v.src || ''
                    const label = v.title || v.name || v.label || 'Video'
                    const selected = c.background.videoUrl === url
                    return (
                      <button
                        key={v._id || v.id || url}
                        type="button"
                        className={`cs-media-picker-item ${selected ? 'active' : ''}`}
                        onClick={() => update('background.videoUrl', url)}
                        title={label}
                      >
                        <video src={url} muted loop playsInline className="cs-media-picker-thumb" />
                        <span className="cs-media-picker-label">{label}</span>
                        {selected && <span className="cs-media-picker-check">✓</span>}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="cs-empty">No admin videos available yet.</p>
              )}
              {c.background.videoUrl ? (
                <div className="cs-background-thumb video">
                  <video src={c.background.videoUrl} muted autoPlay loop playsInline />
                  <button type="button" className="cs-inline-remove" onClick={() => update('background.videoUrl', '')}>Remove</button>
                </div>
              ) : null}
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
                  return (
                    <button
                      key={track._id || track.id || url}
                      type="button"
                      className={`cs-music-picker-item ${selected ? 'active' : ''}`}
                      onClick={() => {
                        update('background.music.url', url)
                        update('background.music.isUploaded', false)
                      }}
                    >
                      <span className="cs-music-picker-note">♫</span>
                      <span className="cs-music-picker-label">{label}</span>
                      {selected && <span className="cs-music-picker-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="cs-preset-list">
                {musicPresets.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`cs-chip small ${c.background.music.url === preset.url ? 'active' : ''}`}
                    onClick={() => {
                      update('background.music.url', preset.url)
                      update('background.music.isUploaded', false)
                    }}
                  >
                    ♫ {preset.label}
                  </button>
                ))}
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
      return (
        <>
          <p className="cs-panel-eyebrow">Theme</p>
          <h3>Global look & feel</h3>
          <label className="cs-field">
            <span>Font Family</span>
            <Dropdown
              value={c.theme.fontFamily}
              onChange={(v) => update('theme.fontFamily', v)}
              options={fontOptions.map(f => ({ value: f, label: f }))}
            />
          </label>
          <ColorInput label="Accent Color" value={c.theme.accentColor} onChange={e => update('theme.accentColor', e.target.value)} />
          <ColorInput label="Text Color" value={c.theme.textColor} onChange={e => update('theme.textColor', e.target.value)} />
          <ColorInput label="Heading Color" value={c.theme.headingColor} onChange={e => update('theme.headingColor', e.target.value)} />
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

          <div className="cs-sub-section">
            <p className="cs-sub-label">Card Border</p>
            <div className="cs-choice-row">
              {['solid', 'gradient', 'animated'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`cs-chip ${c.card.cardBorder.type === type ? 'active' : ''}`}
                  onClick={() => update('card.cardBorder.type', type)}
                >
                  {type}
                </button>
              ))}
            </div>
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
                </button>
              ))}
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
      return (
        <>
          <p className="cs-panel-eyebrow">Questions</p>
          <h3>Receiver interaction flow</h3>
          {c.questions.items.map((q, i) => (
            <div key={i} className="cs-question-card">
              <label className="cs-field">
                <span>Question {i + 1}</span>
                <input value={q.text} onChange={e => updateQuestion(i, e.target.value)} />
              </label>
              <button type="button" className="cs-remove-btn" onClick={() => removeQuestion(i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="cs-button" onClick={addQuestion}>+ Add Question</button>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Button Style</p>
            <ColorInput label="Text Color" value={c.questions.button.textColor} onChange={e => update('questions.button.textColor', e.target.value)} />
            <ColorInput label="Border Color" value={c.questions.button.borderColor} onChange={e => update('questions.button.borderColor', e.target.value)} />
            <ColorInput label="Background" value={c.questions.button.backgroundColor} onChange={e => update('questions.button.backgroundColor', e.target.value)} />
          </div>

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
            <p className="cs-preview-poll-eyebrow">Live Poll Experience</p>
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
            <p className="cs-preview-trivia-eyebrow">Trivia Challenge</p>
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

    if (studioType === 'anonymous') {
      return (
        <div className={`cs-preview-anon ${compact ? 'compact' : ''}`}>
          <div className="cs-preview-anon-template" style={{
            backgroundColor: c.card.backgroundColor,
            ...cardBorderCss,
          }}>
            <div className="cs-preview-anon-head">
              <p className="cs-preview-anon-eyebrow">Anonymous Inbox</p>
              <span className="cs-preview-pill">{anonTemplate.tier === 'premium' ? 'Premium' : 'Classic'} template</span>
            </div>
            <h3 style={{
              color: c.card.headingColor,
              fontFamily: `'${c.theme.fontFamily}', serif`,
            }}>
              {c.content.heading}
            </h3>
            <p style={{ color: c.card.textColor }}>
              {c.content.body || 'Your inbox template message will greet every anonymous sender.'}
            </p>
            <div className="cs-preview-anon-message" style={{ borderColor: `${c.theme.accentColor}33` }}>
              <p className="cs-preview-anon-message-label">Sample incoming note</p>
              <p>"You make people feel seen. Keep going."</p>
            </div>
          </div>
          <div className="cs-preview-anon-input-mock">
            <p className="cs-preview-anon-input-label">What senders see</p>
            <div className="cs-preview-anon-textarea-mock">
              Write something honest, kind, or surprising…
            </div>
            <div
              className="cs-preview-anon-send-mock"
              style={{
                backgroundColor: c.theme.accentColor,
                color: c.card.backgroundColor,
              }}
            >
              Send Anonymously
            </div>
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
        }}>
          {c.content.heading}
        </h3>
        <p style={{ color: c.card.textColor }}>{c.content.body}</p>
        {c.content.extendedBody && (
          <p className="cs-extended" style={{ color: c.card.textColor }}>
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
    <div className="page-body cs-shell" style={{ '--type-accent': TYPE_ACCENT[studioType] || TYPE_ACCENT.moment }}>
      {/* TOPBAR */}
      <div className="cs-topbar">
        <div className="cs-top-left">
          <button type="button" className="cs-nav-btn" onClick={() => navigate(-1)}>← Back</button>
          <span className="cs-type-badge">{TYPE_LABEL[studioType] || 'Moment Card'}</span>
          <div className="cs-status">{savedState}</div>
        </div>
        <div className="cs-progress">
          <div className="cs-wordmark">
            <img src={logo} alt="Cardora" className="cs-top-logo" />
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
            <span className="cs-cc-cost-badge">
              {TIER_COST[studioTier] === 0 ? 'Free' : `${TIER_COST[studioTier]} CC`}
            </span>
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
        {/* TOOL RAIL */}
        <aside className="cs-toolrail">
          {activeTools.map(tool => {
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
              {activeTools.map(tool => {
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

      {/* Hidden snapshot for template publish preview */}
      {isArtist && (
        <TemplatePreviewSnapshot
          ref={previewSnapshotRef}
          cardObject={cardObject}
          recipientName={currentUser?.name || ''}
        />
      )}

      {/* Preview Modal */}
      {showPreview && (
        <CardPreviewModal
          cardObject={cardObject}
          studioType={studioType}
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
                <Dropdown
                  value={publishForm.category}
                  onChange={(v) => setPublishForm((prev) => ({ ...prev, category: v }))}
                  options={[
                    { value: 'proposal', label: 'Proposal' },
                    { value: 'anniversary', label: 'Anniversary' },
                    { value: 'birthday', label: 'Birthday' },
                    { value: 'scratch', label: 'General / Other' },
                  ]}
                />
              </label>
            </div>
            <div className="cs-publish-preview-note">
              <span className="cs-publish-preview-note-icon">👁</span>
              <span>A preview image will be generated automatically from your current card design.</span>
            </div>
            {publishError ? <p className="form-error">{publishError}</p> : null}
            <div className="cs-publish-actions">
              <button
                type="button"
                className="cs-nav-btn publish cs-publish-submit-btn"
                onClick={handlePublish}
                disabled={isPublishing}
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
                <span className="cs-send-modal-eyebrow">{TYPE_LABEL[studioType] || 'Moment Card'} · {tierLabel}</span>
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

            {sendResult?.ok && TIER_COST[studioTier] > 0 && (
              <div className="cs-send-modal-cc-deducted">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span><strong>{TIER_COST[studioTier]} CC</strong> deducted from your balance</span>
              </div>
            )}
            {sendResult?.ok && TIER_COST[studioTier] === 0 && (
              <div className="cs-send-modal-cc-deducted free">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span>Sent free — Classic tier</span>
              </div>
            )}
            {!sendResult?.ok && (
              <p className="cs-send-modal-note">
                {sendResult?.message || `This card costs ${TIER_COST[studioTier] === 0 ? 'nothing (free)' : `${TIER_COST[studioTier]} CC`} to send.`}
              </p>
            )}

            <div className="cs-send-link-wrap">
              <p className="cs-send-link-label">Card link</p>
              <span className="detail-share-link-pill cs-send-link-pill">
                {`${window.location.origin}/card/${sendResult?.slug || 'preview'}`.replace(/^https?:\/\//, '')}
              </span>
              <button
                type="button"
                className={`detail-share-copy-btn ${sendCopied ? 'copied' : ''}`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/card/${sendResult?.slug || 'preview'}`)
                    setSendCopied(true)
                    setTimeout(() => setSendCopied(false), 1600)
                  } catch { /* ignore */ }
                }}
              >
                {sendCopied ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>

            <p className="detail-share-label">Share via</p>
            <div className="detail-share-platforms cs-send-modal-platforms">
              {SHARE_PLATFORMS.map((p) => {
                const shareUrl = `${window.location.origin}/card/${sendResult?.slug || 'preview'}`
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
            </div>

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
                <button
                  type="button"
                  className="cs-nav-btn accent"
                  onClick={() => {
                    // TODO: wire to backend
                    alert(`Email to ${sendEmail} — coming soon!`)
                  }}
                >
                  Send
                </button>
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









