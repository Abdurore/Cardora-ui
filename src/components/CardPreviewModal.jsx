import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import PremiumGiftReveal from './PremiumGiftReveal.jsx'
import Envelope from './Envelope.jsx'
import AmbientParticles from './AmbientParticles.jsx'
import { fireOpenEffect } from '../lib/studioEffects.js'
import { shouldShowEnvelope } from '../lib/tierLimits.js'
import { prefersReducedMotion, getMotionIntensity } from '../lib/deviceCapability.js'
import { useDepthMotion } from '../lib/useDepthMotion.js'
import { claimGiftFromCard } from '../lib/api.js'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from './CardIcons.jsx'
import ReportModal from './ReportModal.jsx'
import { buildSendOneBackPath } from '../lib/replyPath.js'

// Code-split: three.js is a large dependency and must never load for a card
// that doesn't use the galaxy.
const GalaxyExperience = lazy(() => import('./GalaxyExperience.jsx'))

const ENTRY_DEFAULTS = {
  personal:  { label: 'Personal Card',   Icon: PersonalCardIcon, hint: 'Someone sent you a card',            color: '#e2b96e' },
  poll:      { label: 'Poll Card',        Icon: PollCardIcon,     hint: "You've been asked to vote",          color: '#7eb3ff' },
  trivia:    { label: 'Trivia Card',      Icon: TriviaCardIcon,   hint: "You've been challenged",             color: '#ffe066' },
  chain:     { label: 'Chain Card',       Icon: ChainCardIcon,    hint: 'A chain was started for you',        color: '#62ffa2' },
  anonymous: { label: 'Anonymous Card',   Icon: AnonCardIcon,     hint: 'Open to send an anonymous message',  color: '#c084fc' },
}

// Typewriter hook — elapsed-time-driven via requestAnimationFrame rather than a
// setInterval tick per character. A per-character interval fires faster than the
// browser's own paint cycle for anything but very short text, forcing more React
// re-renders than frames actually available and guaranteeing dropped frames — worst
// exactly when it's competing with an open-effect burst and ambient particles on the
// same card-open transition. Driving off elapsed time instead means it can never
// outrun the frame rate, and it self-corrects after a dropped frame instead of drifting.
function useTypewriter(text, speed, active) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!active || !text) { setDisplayed(active ? text : ''); return undefined }
    setDisplayed('')
    const duration = speed * 1000
    const startTime = performance.now()
    let frame
    let lastCount = 0
    const tick = (now) => {
      const elapsed = now - startTime
      const count = Math.min(text.length, Math.floor((elapsed / duration) * text.length))
      if (count !== lastCount) {
        lastCount = count
        setDisplayed(text.slice(0, count))
      }
      if (count < text.length) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, speed, active])
  return displayed
}

function CardPreviewModal({
  cardObject,
  onClose,
  tier = 'simple',
  allowedTools = null,
  tierLimits = null,
  recipientEmail = '',
  studioType = 'personal',
  pollData = null,
  triviaData = null,
  anonTemplate = null,
  pageMode = false,
  cardTitle = '',
  onPollSubmit = null,
  onTriviaComplete = null,
  onChainReply = null,
  onQuestionResponse = null,
  onAnonSubmit = null,
  chainState = null,
  chainDelivered = false,
  interaction = null,
  reactions = null,
  onReact = null,
  cardId = '',
  senderName = '',
  currentUser = null,
  openAuthModal = null,
  refreshBalance = null,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  // A card's own colors are the sender's/artist's actual design choice and
  // must render as configured, always — never silently swapped based on the
  // *viewer's own* site theme. This modal previews real cards (including a
  // recipient claiming a real gift), so a card intentionally using white
  // text on a dark background must never get "corrected" into unreadable
  // dark-on-dark just because the viewer's own browser happens to be in
  // light mode.
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
  // `allowedTools` gates tool visibility; `tierLimits` caps the content a
  // visible tool is allowed to contribute (e.g. music allowed, images > 1).
  // Both null = public viewer, render everything the card has.
  const toolAllowed = (id) => !allowedTools || allowedTools.includes(id)
  const limit = (key, fallback = true) => (tierLimits ? !!tierLimits[key] : fallback)
  const maxImages = tierLimits ? (tierLimits.maxImages ?? Infinity) : Infinity
  const envelopeEnabled = shouldShowEnvelope(studioType)
  const isPersonalType = studioType === 'personal'
  // Poll and anonymous used to skip straight from asset-loading to content
  // with no arrival moment — trivia/chain already had one. Giving every
  // interactive type the same beat keeps the recipient experience
  // consistent regardless of what kind of card they were sent.
  const needsTitleBuffer = pageMode && (studioType === 'trivia' || studioType === 'chain' || studioType === 'poll' || studioType === 'anonymous')
  const [stage, setStage] = useState(
    pageMode
      ? 'assetLoading'
      : (envelopeEnabled ? 'closed' : 'open')
  )
  const [questionIdx, setQuestionIdx] = useState(0)
  // Seeded from server truth (renderModel.interaction) so a recipient who
  // already answered sees their answer instead of being re-prompted, even if
  // their local draft/session state reset.
  const [questionAnswer, setQuestionAnswer] = useState(
    () => (interaction?.kind === 'yes_no' ? (interaction.viewerAnswer || null) : null)
  )
  const [questionSubmitting, setQuestionSubmitting] = useState(false)
  const [questionSubmitError, setQuestionSubmitError] = useState('')
  const [fadeBody, setFadeBody] = useState(!envelopeEnabled || (pageMode && !isPersonalType))
  const [bodyVisible, setBodyVisible] = useState(!envelopeEnabled || (pageMode && !isPersonalType))
  // Delays the typewriter's start until just after the open-effect burst's
  // heaviest initial frame, instead of both firing in the same tick — that
  // concurrent start was a real source of the "lags on open" complaint.
  const [typewriterReady, setTypewriterReady] = useState(!envelopeEnabled || (pageMode && !isPersonalType))
  const [revealStep, setRevealStep] = useState(0)
  const audioRef = useRef(null)
  const containerRef = useRef(null)
  const openCardInnerRef = useRef(null)
  const openCardBodyRef = useRef(null)
  const openCardMediaRef = useRef(null)
  // Gentler than the envelope's — the card is read, not admired, and a strong
  // tilt fights legibility. Only the 'open' stage gets it: the interaction
  // stages (poll, trivia, question, anon reply, chain) are separate stages with
  // their own wrappers, so precise tap targets are never tilting underneath.
  const openCardDepthRef = useDepthMotion({ maxTilt: 5, disabled: stage !== 'open' })
  const bodyAutoScrollPausedRef = useRef(false)
  const bodyAutoScrollResumeTimerRef = useRef(null)
  const bodyAutoScrollLastTopRef = useRef(0)
  const previewTimersRef = useRef([])
  const receiverStorageKey = useMemo(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname : cardId
    return `cardora:receiver:${studioType}:${cardId || path}`
  }, [cardId, studioType])

  // Device-frame preview. Fullscreen by default; lets the sender see how the
  // card scales on phone / tablet / desktop without leaving the modal.
  const [previewDevice, setPreviewDevice] = useState('fullscreen')
  // Only an explicit accessibility signal fully disables ambient/video
  // effects and open-effect bursts — reduced-motion is often about
  // vestibular/motion sensitivity, not just performance, so it stays a hard
  // gate rather than a scaled-down one.
  const lowPowerViewer = useMemo(() => prefersReducedMotion(), [])
  // Separately, a real device-capability signal (shared with PremiumGiftReveal
  // and studioEffects' open-effect firing) scales particle DENSITY down for
  // weak-but-not-reduced-motion devices — most recipients open a shared card
  // on a phone, and a narrow viewport alone used to be the only thing this
  // checked, missing plenty of weak devices with a normal-sized screen.
  const motionIntensity = useMemo(() => getMotionIntensity(), [])
  const ambientIntensity = motionIntensity

  const [claimingGift, setClaimingGift] = useState(false)
  const [giftClaimMessage, setGiftClaimMessage] = useState('')
  const [localClaimed, setLocalClaimed] = useState(false)

  const performClaim = useCallback(async () => {
    if (!cardId) {
      setGiftClaimMessage('Cannot claim gift: no card ID.')
      return
    }
    setClaimingGift(true)
    setGiftClaimMessage('')
    try {
      const res = await claimGiftFromCard(cardId)
      setGiftClaimMessage(res?.message || 'Gift claimed successfully! The payout has been added to your Gift Wallet.')
      setLocalClaimed(true)
      if (refreshBalance) {
        await refreshBalance()
      }
    } catch (err) {
      setGiftClaimMessage(err.message || 'Failed to claim gift.')
    } finally {
      setClaimingGift(false)
    }
  }, [cardId, refreshBalance])

  // Card surface style. The colored layer is rendered as a `::before` pseudo
  // so adjusting opacity reveals the page background without dimming the card
  // text or images.
  const cardSurfaceStyle = (extra = {}) => ({
    backgroundColor: 'transparent',
    '--card-bg': c?.card?.backgroundColor || '#111111',
    '--card-bg-opacity': String(1 - (Number(c?.card?.backgroundOpacity) || 0)),
    ...extra,
  })

  // Lock & reveal gate — honours `interaction.lock` so the studio preview
  // matches what the recipient will actually experience.
  const lockSpec = cardObject?.interaction?.lock || { type: 'none', value: '', hint: '' }
  // In pageMode the recipient already cleared a password gate upstream in
  // CardView (which fetches the card from the backend and only succeeds once
  // the correct password was supplied) — the backend's sanitizer strips
  // `lock.value` from that response regardless, so re-checking password here
  // would either double-prompt or (since the stripped value is empty) let a
  // blank submission through. Password locks are only ever re-evaluated here
  // outside pageMode, where this modal is previewing the sender's own draft.
  const [unlocked, setUnlocked] = useState(
    lockSpec.type === 'none' ||
    (pageMode && lockSpec.type === 'password') ||
    (lockSpec.type !== 'password' && lockSpec.type !== 'time' && lockSpec.type !== 'tap' && lockSpec.type !== 'scratch')
  )
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  // Scratch lock state
  const scratchCanvasRef = useRef(null)
  const scratchingRef = useRef(false)
  const [scratchPct, setScratchPct] = useState(0)
  // Tick once per second while the time-lock is active so the countdown updates.
  useEffect(() => {
    if (lockSpec.type !== 'time' || unlocked) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [lockSpec.type, unlocked])
  // Auto-unlock when the configured time arrives.
  const unlockAt = lockSpec.type === 'time' && lockSpec.value ? new Date(lockSpec.value).getTime() : null
  useEffect(() => {
    if (lockSpec.type === 'time' && unlockAt && now >= unlockAt) setUnlocked(true)
  }, [lockSpec.type, unlockAt, now])

  // Scratch canvas: fill with overlay color when gate mounts. The bitmap is
  // sized to match its actual rendered box (rather than a fixed 360×640) so
  // the "SCRATCH TO REVEAL" fill doesn't stretch/distort in the tablet and
  // desktop device-preview frames, which use very different aspect ratios.
  useEffect(() => {
    if (lockSpec.type !== 'scratch' || unlocked) return
    const canvas = scratchCanvasRef.current
    if (!canvas) return

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'
      const bg = c?.card?.backgroundColor || '#0b0f14'
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Decorative overlay text
      ctx.font = 'bold 15px system-ui'
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.textAlign = 'center'
      const rows = ['SCRATCH', 'TO', 'REVEAL']
      rows.forEach((t, i) => ctx.fillText(t, canvas.width / 2, canvas.height / 2 - 18 + i * 22))
      setScratchPct(0)
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [lockSpec.type, unlocked, c?.card?.backgroundColor])

  const handleScratch = useCallback((e) => {
    if (!scratchingRef.current || unlocked) return
    const canvas = scratchCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = (clientX - rect.left) * (canvas.width / rect.width)
    const y = (clientY - rect.top) * (canvas.height / rect.height)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, 32, 0, Math.PI * 2)
    ctx.fill()
    // Sample every 8th pixel for performance
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let cleared = 0
    for (let i = 3; i < data.length; i += 32) {
      if (data[i] < 128) cleared++
    }
    const total = (canvas.width * canvas.height) / 8
    const pct = Math.round((cleared / total) * 100)
    setScratchPct(pct)
    if (pct >= 55) setUnlocked(true)
  }, [unlocked])

  const handlePasswordSubmit = (e) => {
    e?.preventDefault?.()
    // Only reached in the sender's own (non-pageMode) preview now — a real
    // recipient's password gate lives entirely in CardView. An empty
    // configured value here is a data problem, not a valid unlock.
    if (lockSpec.value && pwInput.trim() === String(lockSpec.value).trim()) {
      setUnlocked(true)
      setPwError('')
    } else {
      setPwError('That doesn\'t match. Try again.')
    }
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Unlocking…'
    const total = Math.floor(ms / 1000)
    const days = Math.floor(total / 86400)
    const hours = Math.floor((total % 86400) / 3600)
    const mins = Math.floor((total % 3600) / 60)
    const secs = total % 60
    if (days > 0) return `${days}d ${hours}h ${mins}m`
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  // Poll preview state — seeded from the backend's render-model `interaction`
  // (real server truth, keyed by the recipient's account or guest id) when
  // present, rather than only the per-browser localStorage flag, so a
  // recipient's actual prior vote is honoured even if localStorage was
  // cleared, and so opening the link in the *same* guest session twice
  // doesn't re-prompt.
  const [previewPollVotes, setPreviewPollVotes] = useState(() => {
    if (interaction?.kind === 'poll' && interaction.viewerVote && Array.isArray(pollData?.options)) {
      const idx = pollData.options.findIndex(opt => (typeof opt === 'object' ? opt.id : opt) === interaction.viewerVote)
      if (idx >= 0) return [idx]
    }
    return []
  })
  const [previewPollSubmitted, setPreviewPollSubmitted] = useState(
    () => interaction?.kind === 'poll' && !!interaction.viewerVote
  )
  // Live results snapshot — the copy on the vote screen promises "see live
  // results after voting"; this is what actually makes that true, instead of
  // the post-vote screen only ever showing the voter's own pick.
  const [pollTallies, setPollTallies] = useState(
    () => (interaction?.kind === 'poll' && Array.isArray(interaction.options) ? interaction.options : null)
  )
  const [previewPollSubmitting, setPreviewPollSubmitting] = useState(false)
  const [previewPollError, setPreviewPollError] = useState('')

  // Trivia preview state
  const [previewTriviaIdx, setPreviewTriviaIdx] = useState(0)
  const [previewTriviaAnswers, setPreviewTriviaAnswers] = useState([])
  const [triviaLocked, setTriviaLocked] = useState(false)
  const [previewTriviaSubmitting, setPreviewTriviaSubmitting] = useState(false)
  const [previewTriviaError, setPreviewTriviaError] = useState('')
  const [triviaScoreDisplay, setTriviaScoreDisplay] = useState(0)
  const triviaCelebrationFiredRef = useRef(false)

  // Anonymous reply state (pageMode only)
  const [anonMessage, setAnonMessage] = useState('')
  const [anonSubmitting, setAnonSubmitting] = useState(false)
  const [anonSubmitted, setAnonSubmitted] = useState(false)
  const [reactionCounts, setReactionCounts] = useState(reactions?.counts || {})
  const [viewerReaction, setViewerReaction] = useState(reactions?.viewerReaction || null)
  const [reactionPending, setReactionPending] = useState(false)
  const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🎉', '👏']
  const handleReact = async (emoji) => {
    if (!onReact || reactionPending) return
    setReactionPending(true)
    const wasSame = viewerReaction === emoji
    // Optimistic update — mirrors the toggle-off/swap logic the backend does.
    setReactionCounts(prev => {
      const next = { ...prev }
      if (viewerReaction) next[viewerReaction] = Math.max(0, (next[viewerReaction] || 1) - 1)
      if (!wasSame) next[emoji] = (next[emoji] || 0) + 1
      return next
    })
    setViewerReaction(wasSame ? null : emoji)
    try {
      const result = await onReact(emoji)
      if (result?.counts) setReactionCounts(result.counts)
      if ('viewerReaction' in (result || {})) setViewerReaction(result.viewerReaction)
    } catch {
      // Revert on failure
      setReactionCounts(reactions?.counts || {})
      setViewerReaction(reactions?.viewerReaction || null)
    }
    setReactionPending(false)
  }
  const [anonUploadError, setAnonUploadError] = useState('')

  // Chain reply state (pageMode only)
  const [chainName, setChainName] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [showIdentitySheet, setShowIdentitySheet] = useState(false)
  const [chainMessage, setChainMessage] = useState('')
  const [chainSubmitting, setChainSubmitting] = useState(false)
  const [chainSubmitted, setChainSubmitted] = useState(false)
  const [chainSubmitError, setChainSubmitError] = useState('')
  const [localChainReplies, setLocalChainReplies] = useState([])
  // 6.4: "Report on every entry" -- which chain reply (by id/index) is
  // currently being reported, or null when the modal is closed.
  const [reportingEntry, setReportingEntry] = useState(null)
  const [previewTriviaSubmitted, setPreviewTriviaSubmitted] = useState(false)

  const giftAllowed = pageMode ? true : limit('allowGifts')
  const giftAlreadyClaimed = c.giftEffect?.status === 'claimed'
  // Once a gift has been claimed, later visitors (or the recipient revisiting)
  // shouldn't be walked through the reveal/claim flow again — there's nothing left to claim.
  const hasGift = toolAllowed('gifts') && giftAllowed && c.giftEffect?.enabled && c.giftEffect?.effectKey && c.giftEffect.effectKey !== 'none' && !giftAlreadyClaimed
  const hasFadeIn = toolAllowed('cardStyle') && limit('allowFadeIn') && Number(c.card.textBodyAnimation.fadeInDuration) > 0
  const hasTypewriter = toolAllowed('cardStyle') && limit('allowTypewriter') && Number(c.card.textBodyAnimation.selfTypeSpeed) > 0
  const typeSpeed = hasTypewriter ? parseFloat(c.card.textBodyAnimation.selfTypeSpeed) || 2 : 2
  const fadeSpeed = hasFadeIn ? parseFloat(c.card.textBodyAnimation.fadeInDuration) || 2 : 0
  const mediaAllowed = toolAllowed('media') && maxImages > 0
  const primaryImage = mediaAllowed ? (c.media.images[0] || null) : null
  // Was `!primaryImage && !c.media.images.length` — redundant when
  // mediaAllowed is true (primaryImage is already truthy whenever images
  // exist), and actively wrong when mediaAllowed is false: a card with
  // images that aren't allowed to render (e.g. downgraded tier) has
  // `images.length > 0` but no image actually shows, yet this still
  // reported it as "not text-only".
  const isTextOnlyCard = !primaryImage

  const typedBody = useTypewriter(c.content.body, typeSpeed, stage === 'open' && hasTypewriter && typewriterReady)
  const typedExtended = useTypewriter(c.content.extendedBody, typeSpeed, stage === 'open' && hasTypewriter && typewriterReady && typedBody === c.content.body)

  // Music — gated by tier (Classic has no music)
  const musicAllowed = limit('allowMusic') && !!c.background.music.url
  const musicStartSec = Number(c.background.music.startSec) || 0
  const musicEndSec = Number(c.background.music.endSec) || 0
  const musicTrimmed = musicEndSec > 0 && musicEndSec > musicStartSec

  useEffect(() => {
    if (!pageMode) return undefined
    let cancelled = false
    const imageUrls = [
      '/cardora-logo.png?v=4',
      ...(mediaAllowed ? c.media.images.map(img => img.url).filter(Boolean) : []),
    ]
    const imageLoads = imageUrls.map(src => new Promise(resolve => {
      const img = new Image()
      img.onload = resolve
      img.onerror = resolve
      img.src = src
    }))
    const fontsReady = document.fonts?.ready?.catch(() => {}) || Promise.resolve()
    const minimum = new Promise(resolve => window.setTimeout(resolve, 720))
    Promise.all([fontsReady, minimum, ...imageLoads]).then(() => {
      if (cancelled) return
      if (needsTitleBuffer) setStage('typeEntry')
      else if (isPersonalType) setStage('entry')
      else setStage('open')
    })
    return () => { cancelled = true }
  }, [pageMode, needsTitleBuffer, isPersonalType, mediaAllowed, c.media.images, c.background.music.url])

  useEffect(() => {
    if (!pageMode) return
    try {
      const pollSaved = JSON.parse(localStorage.getItem(`${receiverStorageKey}:poll`) || 'null')
      if (pollSaved?.submitted) {
        setPreviewPollVotes(Array.isArray(pollSaved.votes) ? pollSaved.votes : [])
        setPreviewPollSubmitted(true)
      }
      const triviaSaved = JSON.parse(localStorage.getItem(`${receiverStorageKey}:trivia`) || 'null')
      if (triviaSaved?.submitted) {
        setPreviewTriviaAnswers(Array.isArray(triviaSaved.answers) ? triviaSaved.answers : [])
        setPreviewTriviaSubmitted(true)
        setTriviaLocked(true)
      }
      const nameSaved = localStorage.getItem(`${receiverStorageKey}:name`)
      if (nameSaved) {
        setParticipantName(nameSaved)
        setChainName(nameSaved)
      } else if (currentUser?.username) {
        setParticipantName(currentUser.username)
        setChainName(currentUser.username)
      }
    } catch {
      /* localStorage may be unavailable in private contexts */
    }
  }, [pageMode, receiverStorageKey, currentUser])

  useEffect(() => {
    if (!audioRef.current || !musicAllowed) return undefined

    audioRef.current.volume = c.background.music.volume

    if (stage === 'galaxy' || stage === 'open' || stage === 'end' || stage === 'giftIntro' || stage === 'giftReceive' || stage === 'pollVote' || stage === 'triviaQ' || stage === 'triviaResults' || stage === 'anonPreview' || stage === 'anonReply' || stage === 'chainReplies' || stage === 'question') {
      // Honour trim window: jump to start point if we're outside the segment.
      if (musicTrimmed) {
        const t = audioRef.current.currentTime
        if (t < musicStartSec || t >= musicEndSec) {
          audioRef.current.currentTime = musicStartSec
        }
      }
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
      audioRef.current.currentTime = musicTrimmed ? musicStartSec : 0
    }

    return () => {
      if (audioRef.current) audioRef.current.pause()
    }
  }, [c.background.music.url, c.background.music.volume, stage, musicAllowed, musicTrimmed, musicStartSec, musicEndSec])

  // Card music should not keep playing into a tab the viewer has switched away
  // from. Resume only if the stage still wants sound — `stage` is read through
  // a ref-free closure here because the effect re-runs whenever it changes.
  useEffect(() => {
    if (!musicAllowed) return undefined
    const onVisibility = () => {
      const el = audioRef.current
      if (!el) return
      if (document.hidden) el.pause()
      else if (!el.ended && el.currentTime > 0) el.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [musicAllowed])

  // While trimmed playback is active, loop within [startSec, endSec] manually.
  // Native <audio loop> covers the file end; we also need to loop at the
  // user-defined endSec.
  useEffect(() => {
    if (!audioRef.current || !musicAllowed || !musicTrimmed) return undefined
    const el = audioRef.current
    const onTime = () => {
      if (el.currentTime >= musicEndSec) {
        el.currentTime = musicStartSec
      }
    }
    el.addEventListener('timeupdate', onTime)
    return () => el.removeEventListener('timeupdate', onTime)
  }, [musicAllowed, musicTrimmed, musicStartSec, musicEndSec])

  // Open effect dispatcher — gated by tier cap
  const triggerOpenEffect = useCallback(() => {
    if (lowPowerViewer) return
    if (!toolAllowed('animation') || !limit('allowOpenEffects')) return
    if (!c.animation.openEffect || c.animation.openEffect === 'none') return
    fireOpenEffect(c.animation.openEffect, c.animation.confettiColors, motionIntensity)
  }, [c.animation.openEffect, c.animation.confettiColors, allowedTools, tierLimits, lowPowerViewer, motionIntensity])

  // Trivia score reveal — count the number up instead of just printing the
  // final tally, and fire a one-time celebration burst at a strong score.
  // This is an app-level "well done" moment, independent of whatever open
  // effect the sender configured for the card itself.
  useEffect(() => {
    if (stage !== 'triviaResults' || !triviaData) return
    const correct = triviaData.questions.filter((q, i) => Number(previewTriviaAnswers[i]) === Number(q.correctIndex)).length
    const total = triviaData.questions.length
    if (lowPowerViewer) {
      setTriviaScoreDisplay(correct)
      return
    }
    setTriviaScoreDisplay(0)
    const duration = 900
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setTriviaScoreDisplay(Math.round(correct * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    if (!triviaCelebrationFiredRef.current && total > 0 && correct / total >= 0.7) {
      triviaCelebrationFiredRef.current = true
      window.setTimeout(() => fireOpenEffect('confetti', c.animation.confettiColors), duration)
    }
    return () => cancelAnimationFrame(raf)
  }, [stage, triviaData, previewTriviaAnswers, lowPowerViewer, c.animation.confettiColors])

  // Seed localChainReplies from chainState prop when it becomes available
  useEffect(() => {
    if (chainState?.responses?.length) {
      setLocalChainReplies(chainState.responses)
    }
  }, [chainState])

  const schedulePreviewTimer = useCallback((fn, delay) => {
    const id = window.setTimeout(() => {
      previewTimersRef.current = previewTimersRef.current.filter((timer) => timer !== id)
      fn()
    }, delay)
    previewTimersRef.current.push(id)
    return id
  }, [])

  useEffect(() => {
    return () => {
      previewTimersRef.current.forEach(window.clearTimeout)
      previewTimersRef.current = []
    }
  }, [])

  const handleEntryOpen = () => {
    if (envelopeEnabled) {
      setStage('closed')
    } else {
      setFadeBody(true)
      setBodyVisible(true)
      setStage('open')
    }
  }

  const handleBufferedStart = () => {
    if ((studioType === 'trivia' || studioType === 'chain') && !participantName.trim()) {
      setShowIdentitySheet(true)
      return
    }
    setFadeBody(true)
    setBodyVisible(true)
    setStage('open')
  }

  const saveParticipantName = () => {
    const cleanName = participantName.trim()
    if (!cleanName) return
    try {
      localStorage.setItem(`${receiverStorageKey}:name`, cleanName)
    } catch {
      /* ignore localStorage failures */
    }
    setChainName(cleanName)
    setShowIdentitySheet(false)
    setFadeBody(true)
    setBodyVisible(true)
    setStage('open')
  }

  // The galaxy sits between the envelope and the card rather than replacing
  // either, so every downstream stage (questions, gifts, reactions, end) is
  // reached exactly as before once the recipient continues.
  const galaxyEnabled = c.experience?.type === 'galaxy'
    && (c.experience?.memories?.length || 0) > 0
    && mediaAllowed

  const handleOpen = () => {
    if (galaxyEnabled) {
      setStage('galaxy')
      return
    }
    openCardNow()
  }

  const openCardNow = () => {
    previewTimersRef.current.forEach(window.clearTimeout)
    previewTimersRef.current = []
    setRevealStep(0)
    setTypewriterReady(false)
    triggerOpenEffect()
    setStage('open')
    if (hasFadeIn) {
      schedulePreviewTimer(() => setFadeBody(true), 260)
      schedulePreviewTimer(() => setBodyVisible(true), 420)
    } else {
      setFadeBody(true)
      setBodyVisible(true)
    }
    schedulePreviewTimer(() => setTypewriterReady(true), 240)
  }

  const handleContinue = () => {
    // Route to type-specific stage after open card
    if (studioType === 'poll' && pollData) {
      setStage('pollVote')
      return
    }
    if (studioType === 'trivia' && triviaData) {
      if (previewTriviaSubmitted) {
        setStage('triviaResults')
        return
      }
      setPreviewTriviaIdx(0)
      setPreviewTriviaAnswers([])
      setPreviewTriviaSubmitted(false)
      setTriviaLocked(false)
      setStage('triviaQ')
      return
    }
    if (studioType === 'anonymous') {
      setStage(pageMode ? 'anonReply' : 'anonPreview')
      return
    }
    if (studioType === 'chain' && pageMode) {
      setStage('chainReplies')
      return
    }
    if (isPersonalType && c.questions.items.length > 0) {
      setStage('question')
      return
    }
    setStage('end')
  }

  // The first question item is the actual yes/no question; any remaining
  // items are the sender's "suspense" follow-up lines, shown one at a time
  // after an answer is submitted, before landing on the closing screen.
  const handleAnswerQuestion = async (answer) => {
    if (questionSubmitting) return
    setQuestionAnswer(answer)
    setQuestionSubmitting(true)
    setQuestionSubmitError('')
    try {
      if (onQuestionResponse) await onQuestionResponse(answer)
      // Most senders don't add suspense lines — only advance into that
      // stage if there's actually one to show, otherwise land on the
      // closing screen directly (matches handleNextQ's own end-of-list
      // behavior). Unconditionally jumping to index 1 crashed here whenever
      // `items.length === 1` (items[1] undefined).
      if (c.questions.items.length > 1) {
        setQuestionIdx(1)
      } else {
        setStage('end')
      }
    } catch (err) {
      setQuestionAnswer(null)
      setQuestionSubmitError(err?.message || 'Could not submit your answer. Please try again.')
    } finally {
      setQuestionSubmitting(false)
    }
  }

  const handleNextQ = () => {
    if (questionIdx < c.questions.items.length - 1) {
      setQuestionIdx(i => i + 1)
    } else {
      setStage('end')
    }
  }

  const handleReset = () => {
    previewTimersRef.current.forEach(window.clearTimeout)
    previewTimersRef.current = []
    if (pageMode && studioType === 'poll' && previewPollSubmitted) {
      setStage('pollVote')
      return
    }
    if (pageMode && studioType === 'trivia' && previewTriviaSubmitted) {
      setStage('triviaResults')
      return
    }
    setStage(envelopeEnabled ? 'closed' : 'open')
    setQuestionIdx(0)
    setQuestionAnswer(null)
    setQuestionSubmitError('')
    setFadeBody(!envelopeEnabled)
    setBodyVisible(!envelopeEnabled)
    setTypewriterReady(!envelopeEnabled)
    setRevealStep(0)
    setPreviewPollVotes([])
    setPreviewPollSubmitted(false)
    setPreviewPollSubmitting(false)
    setPreviewPollError('')
    setPreviewTriviaIdx(0)
    setPreviewTriviaAnswers([])
    setPreviewTriviaSubmitted(false)
    setTriviaLocked(false)
    setPreviewTriviaSubmitting(false)
    setPreviewTriviaError('')
    setAnonMessage('')
    setAnonSubmitting(false)
    setAnonSubmitted(false)
    setAnonUploadError('')
    setChainMessage('')
    setChainSubmitting(false)
    setChainSubmitted(false)
    setChainSubmitError('')
    setTriviaScoreDisplay(0)
    triviaCelebrationFiredRef.current = false
  }

  const handleEndDone = () => {
    if (hasGift) {
      setStage('giftIntro')
    }
  }

  // 6.5: "pre-addressed to the original sender" -- there's no recipient-
  // identity/inbox system anywhere in this product (cards are shared by
  // link only), so "addressed" means the new card's own creation flow
  // knows who it's replying to (via the same ?fromCard=-style convention
  // 6.2 already established) rather than any real delivery mechanism.
  // "No account" resolves through the existing signup flow (which already
  // grants starter CC, covering "zero balance" too) rather than new guest
  // card-creation infrastructure -- openAuthModal's returnTo lands the
  // signed-up user right back on this same reply path.
  const handleSendOneBack = () => {
    // senderName is passed straight through as a query param rather than
    // having QuickCreate re-fetch the original card to learn it -- a
    // second GET /cards/:slug here would double-count this card's view
    // (getCardBySlug increments `views` on every non-owner fetch) purely
    // to look up a name the replier's own screen already has in memory.
    const replyPath = buildSendOneBackPath(cardId, senderName)
    if (!currentUser) {
      if (openAuthModal) {
        openAuthModal(null, replyPath, {
          title: 'Sign in to send one back',
          message: 'Create a free account and you\'ll land right back here, ready to send your own card.',
        })
      } else {
        navigate('/login')
      }
      return
    }
    navigate(replyPath)
  }

  useEffect(() => {
    if (!pageMode || stage !== 'end' || !hasGift) return undefined
    const id = window.setTimeout(() => setStage('giftIntro'), 900)
    return () => window.clearTimeout(id)
  }, [hasGift, pageMode, stage])

  // Close on Esc
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Build background style
  const bgStyle = {}
  if (c.background.type === 'color') {
    bgStyle.background = c.background.colors[0] || c.card?.backgroundColor || '#0b0f14'
  } else if (c.background.type === 'gradient' || c.background.type === 'animated') {
    bgStyle.background = `linear-gradient(135deg, ${c.background.colors.join(', ')})`
    if (c.background.type === 'animated') bgStyle.backgroundSize = '400% 400%'
  } else if (c.background.type === 'image' && c.background.imageUrl) {
    bgStyle.background = `url(${c.background.imageUrl}) center/cover no-repeat`
  }

  // Card border style
  const borderStyle = {}
  if (c.card.cardBorder.type === 'solid') {
    borderStyle.border = `${c.card.cardBorder.width}px solid ${c.card.cardBorder.colors[0] || '#333'}`
  } else if (c.card.cardBorder.type === 'gradient' || c.card.cardBorder.type === 'animated') {
    borderStyle.border = `${c.card.cardBorder.width}px solid transparent`
    borderStyle.backgroundClip = 'padding-box'
  }

  // Background effect — gated by the `animation` tool AND tier ambient cap.
  // Always routes through AmbientParticles now, matching Studio's own
  // design-canvas preview exactly (there used to be a separate legacy
  // CSS/emoji renderer for 'floating' here, which drifted visually from
  // what the sender saw while editing).
  const renderBgEffect = () => {
    if (lowPowerViewer) return null
    if (!toolAllowed('animation') || !limit('allowAmbientEffects')) return null
    const eff = c.animation.backgroundEffect
    if (!eff || eff.type === 'none') return null
    return <AmbientParticles type={eff.type} intensity={ambientIntensity} />
  }

  const renderGradientBorder = (children, className = '') => {
    if (!toolAllowed('cardStyle')) return children
    const borderType = c.card.cardBorder.type
    if (borderType === 'gradient' && !limit('allowGradientBorder')) return children
    if (borderType === 'animated' && !limit('allowAnimatedBorder')) return children
    if (borderType === 'gradient' || borderType === 'animated') {
      const gradColors = c.card.cardBorder.colors.length > 1
        ? c.card.cardBorder.colors.join(', ')
        : `${c.card.cardBorder.colors[0] || '#333'}, ${c.card.cardBorder.colors[0] || '#333'}`
      return (
        <div
          className={`cp-gradient-border ${c.card.cardBorder.type === 'animated' ? 'animated' : ''} ${className}`}
          style={{
            '--border-gradient': `linear-gradient(135deg, ${gradColors})`,
            '--border-width': `${c.card.cardBorder.width}px`,
            '--border-anim-dur': `${c.card.cardBorder.animationDuration}s`,
          }}
        >
          {children}
        </div>
      )
    }
    return children
  }

  const previewImageStyle = primaryImage
    ? {
        objectFit: primaryImage.fit || 'cover',
        objectPosition: `${primaryImage.positionX ?? 50}% ${primaryImage.positionY ?? 50}%`,
      }
    : {}

  useEffect(() => {
    if (stage !== 'open') return undefined

    const sequence = [
      setTimeout(() => setRevealStep(1), 320),
      setTimeout(() => setRevealStep(2), 1080),
      setTimeout(() => setRevealStep(3), 1840),
      setTimeout(() => setRevealStep(4), 2660),
    ]

    return () => {
      sequence.forEach(clearTimeout)
    }
  }, [stage, primaryImage])

  useEffect(() => {
    if (stage !== 'open' || revealStep < 4) return undefined
    const el = openCardBodyRef.current
    if (!el) return undefined

    el.scrollTop = 0
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll < 24) return undefined

    bodyAutoScrollPausedRef.current = false
    bodyAutoScrollLastTopRef.current = 0
    let frame = 0
    let startTime = 0
    let lastTime = 0
    let direction = 1
    const pixelsPerSecond = 15
    const pauseAutoScroll = (delay = 1600) => {
      bodyAutoScrollPausedRef.current = true
      window.clearTimeout(bodyAutoScrollResumeTimerRef.current)
      bodyAutoScrollResumeTimerRef.current = window.setTimeout(() => {
        bodyAutoScrollLastTopRef.current = el.scrollTop
        bodyAutoScrollPausedRef.current = false
      }, delay)
    }
    const handlePointerDown = () => pauseAutoScroll(2200)
    const handleWheel = () => pauseAutoScroll(1800)
    const handleTouchMove = () => pauseAutoScroll(1800)
    const handleScroll = () => {
      if (!bodyAutoScrollPausedRef.current) return
      bodyAutoScrollLastTopRef.current = el.scrollTop
    }
    const delay = window.setTimeout(() => {
      const animate = (time) => {
        if (!startTime) startTime = time
        if (!lastTime) lastTime = time
        const delta = Math.min(80, time - lastTime) / 1000
        lastTime = time
        if (!bodyAutoScrollPausedRef.current) {
          let nextTop = bodyAutoScrollLastTopRef.current + direction * pixelsPerSecond * delta
          if (nextTop >= maxScroll) {
            nextTop = maxScroll
            direction = -1
          } else if (nextTop <= 0) {
            nextTop = 0
            direction = 1
          }
          bodyAutoScrollLastTopRef.current = nextTop
          el.scrollTop = nextTop
        }
        frame = window.requestAnimationFrame(animate)
      }
      frame = window.requestAnimationFrame(animate)
    }, 1100)
    el.addEventListener('pointerdown', handlePointerDown, { passive: true })
    el.addEventListener('wheel', handleWheel, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.clearTimeout(delay)
      window.clearTimeout(bodyAutoScrollResumeTimerRef.current)
      el.removeEventListener('pointerdown', handlePointerDown)
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('scroll', handleScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [
    stage,
    revealStep,
    c.content.heading,
    c.content.body,
    c.content.extendedBody,
    c.media.images.length,
  ])

  // Legibility guard: flatten the card's tilt while it's being scrolled or
  // while a field has focus. Toggles a class rather than React state — the
  // whole point of the depth motion is that it never re-renders.
  useEffect(() => {
    if (stage !== 'open') return undefined
    const wrap = openCardDepthRef.current
    const scroller = openCardInnerRef.current
    if (!wrap || !scroller) return undefined

    let settle = null
    const pause = () => {
      wrap.classList.add('is-depth-paused')
      window.clearTimeout(settle)
      settle = window.setTimeout(() => wrap.classList.remove('is-depth-paused'), 900)
    }
    const hold = () => { window.clearTimeout(settle); wrap.classList.add('is-depth-paused') }
    const release = () => { settle = window.setTimeout(() => wrap.classList.remove('is-depth-paused'), 400) }

    scroller.addEventListener('scroll', pause, { passive: true })
    wrap.addEventListener('focusin', hold)
    wrap.addEventListener('focusout', release)
    return () => {
      window.clearTimeout(settle)
      scroller.removeEventListener('scroll', pause)
      wrap.removeEventListener('focusin', hold)
      wrap.removeEventListener('focusout', release)
    }
  }, [stage, openCardDepthRef])

  useEffect(() => {
    if (stage !== 'open' || revealStep < 4 || c.media.images.length < 2) return undefined
    const el = openCardMediaRef.current
    if (!el) return undefined

    el.scrollLeft = 0
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll < 24) return undefined

    let frame = 0
    let startTime = 0
    const delay = window.setTimeout(() => {
      const duration = Math.min(22000, Math.max(12000, maxScroll * 36))
      const animate = (time) => {
        if (!startTime) startTime = time
        const cycle = ((time - startTime) % duration) / duration
        const progress = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2
        const eased = 0.5 - Math.cos(progress * Math.PI) / 2
        el.scrollLeft = maxScroll * eased
        frame = window.requestAnimationFrame(animate)
      }
      frame = window.requestAnimationFrame(animate)
    }, 900)

    return () => {
      window.clearTimeout(delay)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [stage, revealStep, c.media.images.length])

  // Continue label for the open card
  const continueLabel = studioType === 'poll' ? 'Vote Now'
    : studioType === 'trivia' ? 'Start Quiz'
    : studioType === 'chain' ? 'Read Chain'
    : studioType === 'anonymous' ? (pageMode ? 'Send Message' : 'Preview Inbox')
    : (isPersonalType && c.questions.items.length > 0) ? 'Answer'
    : 'Done'

  const inner = (
    <section className={`cp-overlay cp-device-${pageMode ? 'fullscreen' : previewDevice}`} ref={containerRef}>
      {!pageMode && (
        <div className="cp-device-toolbar" role="tablist" aria-label="Preview device">
          {[
            { id: 'fullscreen', label: 'Full' },
            { id: 'phone', label: 'Phone' },
            { id: 'tablet', label: 'Tablet' },
            { id: 'desktop', label: 'Desktop' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={previewDevice === id}
              className={`cp-device-tab ${previewDevice === id ? 'active' : ''}`}
              onClick={() => setPreviewDevice(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className={`cp-backdrop${c.background.type === 'animated' && !lowPowerViewer ? ' animated' : ''}`} style={bgStyle}>
        {c.background.type === 'video' && c.background.videoUrl && !lowPowerViewer && limit('allowVideoBackground') ? (
          <video className="cp-backdrop-video" src={c.background.videoUrl} autoPlay muted loop playsInline />
        ) : null}
      </div>

      {stage !== 'closed' && stage !== 'entry' && stage !== 'assetLoading' && (
        <div className="cp-ambient-overlay" aria-hidden="true">
          {renderBgEffect()}
        </div>
      )}

      {musicAllowed && (
        <audio ref={audioRef} src={c.background.music.url} loop preload="auto" />
      )}

      <div className={`cp-close-btn ${pageMode ? 'cp-back-btn' : ''} ${stage === 'entry' || stage === 'assetLoading' ? 'cp-close-btn-hidden' : ''}`} onClick={onClose}>
        {pageMode ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>

      {/* Reset button — studio only */}
      {!pageMode && stage !== 'closed' && (
        <button className="cp-reset-btn" onClick={handleReset}>
          Reset
        </button>
      )}

      {stage === 'assetLoading' && (
        <div className="cp-asset-loader" style={{ '--loader-accent': 'rgba(255, 255, 255, 0.7)' }}>
          <div className="cp-asset-loader-mark">
            <img src="/cardora-logo.png?v=4" alt="" />
          </div>
          <p>Preparing your surprise</p>
        </div>
      )}

      {/* LOCK GATE — runs before the envelope. Honours interaction.lock so the
          preview matches what the recipient will see. */}
      {!unlocked && lockSpec.type === 'password' && (
        <div className="cp-lock-gate">
          <div className="cp-lock-card">
            <div className="cp-lock-icon">🔒</div>
            <h3>This card is locked</h3>
            <p className="cp-lock-sub">
              {lockSpec.hint?.trim()
                ? lockSpec.hint
                : 'Enter the password the sender shared with you.'}
            </p>
            <form className="cp-lock-form" onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                autoFocus
                value={pwInput}
                onChange={(e) => { setPwInput(e.target.value); setPwError('') }}
                placeholder="Password"
                aria-label="Password"
              />
              <button type="submit" className="primary">Unlock</button>
            </form>
            {pwError && <p className="cp-lock-error">{pwError}</p>}
          </div>
        </div>
      )}

      {!unlocked && lockSpec.type === 'time' && unlockAt && (
        <div className="cp-lock-gate">
          <div className="cp-lock-card">
            <div className="cp-lock-icon">⏳</div>
            <h3>Sealed until later</h3>
            <p className="cp-lock-sub">
              {lockSpec.hint?.trim()
                ? lockSpec.hint
                : `This card unlocks on ${new Date(unlockAt).toLocaleString()}.`}
            </p>
            <p className="cp-lock-countdown">{formatCountdown(unlockAt - now)}</p>
          </div>
        </div>
      )}

      {/* TAP LOCK — tap anywhere to reveal */}
      {!unlocked && lockSpec.type === 'tap' && stage !== 'entry' && (
        <div
          className="cp-tap-gate"
          style={{
            '--tap-accent': c.theme.accentColor || '#7ef7ff',
            '--tap-bg': c.card.backgroundColor || '#0b0f14',
          }}
          onClick={() => setUnlocked(true)}
        >
          <div className="cp-tap-rings" aria-hidden="true">
            <div className="cp-tap-ring r1" />
            <div className="cp-tap-ring r2" />
            <div className="cp-tap-ring r3" />
          </div>
          <div className="cp-tap-center">
            <div className="cp-tap-icon">👆</div>
            <p className="cp-tap-label">Tap to reveal</p>
            {lockSpec.value && <p className="cp-tap-hint">{lockSpec.value}</p>}
          </div>
        </div>
      )}

      {/* SCRATCH LOCK — scratch to reveal */}
      {!unlocked && lockSpec.type === 'scratch' && stage !== 'entry' && (
        <div
          className="cp-scratch-gate"
          style={{ '--scratch-accent': c.theme.accentColor || '#7ef7ff' }}
        >
          <canvas
            ref={scratchCanvasRef}
            className="cp-scratch-canvas"
            width={360}
            height={640}
            onPointerDown={() => { scratchingRef.current = true }}
            onPointerUp={() => { scratchingRef.current = false }}
            onPointerLeave={() => { scratchingRef.current = false }}
            onPointerMove={handleScratch}
            onTouchStart={e => { e.preventDefault(); scratchingRef.current = true }}
            onTouchEnd={() => { scratchingRef.current = false }}
            onTouchMove={e => { e.preventDefault(); handleScratch(e) }}
          />
          <div className="cp-scratch-bar">
            <div className="cp-scratch-fill" style={{ width: `${Math.min(scratchPct, 100)}%` }} />
            <span className="cp-scratch-hint">{scratchPct < 55 ? 'Scratch to reveal the card' : 'Revealing…'}</span>
          </div>
        </div>
      )}

      {/* CINEMATIC ENTRY SCREEN — shown first in pageMode for PERSONAL cards only */}
      {stage === 'entry' && isPersonalType && (() => {
        const entryMeta = ENTRY_DEFAULTS[studioType] || ENTRY_DEFAULTS.personal
        const EntryIcon = entryMeta.Icon
        const bg = c.card.backgroundColor || '#0b0f14'
        const accent = c.theme.accentColor || entryMeta.color
        // Always use the type-specific color as the dominant orb hue so each card type has visual identity
        const g1 = entryMeta.color
        const g2 = c.theme?.palette?.gradient?.[1] || bg
        return (
          <div
            className="cp-entry-screen"
            style={{ '--entry-bg': bg, '--entry-g1': g1, '--entry-g2': g2, '--entry-accent': accent }}
          >
            {/* Center content */}
            <div className="cp-entry-content">
              <div className="cp-entry-brand">
                <img src="/cardora-logo.png?v=4" alt="" className="cp-entry-brand-logo" />
                <span className="cp-entry-brand-name">Cardora</span>
              </div>

              <div className="cp-entry-type-chip" style={{ color: accent, borderColor: `${accent}40` }}>
                <EntryIcon size={14} color={accent} />
                <span>{entryMeta.label}</span>
              </div>

              {/* 5.3: sender attribution on the gate itself, not just the
                  fallback hint text below -- "Someone" when unknown, never
                  blank. */}
              <p className="cp-entry-sender">{senderName || 'Someone'} sent you a card</p>

              <h1
                className="cp-entry-title"
                style={{
                  color: c.card.headingColor || '#ffffff',
                  fontFamily: `'${c.theme.fontFamily}', serif`,
                }}
              >
                {cardTitle || entryMeta.hint}
              </h1>

              <button
                className="cp-entry-open-btn"
                style={{ '--btn-color': accent }}
                onClick={handleEntryOpen}
              >
                <span className="cp-entry-open-ring" />
                <span className="cp-entry-open-ring cp-entry-open-ring-2" />
                <span className="cp-entry-open-label">
                  {studioType === 'anonymous' ? 'Open' : 'Open Card'}
                </span>
              </button>

              <p className="cp-entry-tap-hint">tap to reveal</p>
            </div>
          </div>
        )
      })()}

      {stage === 'typeEntry' && needsTitleBuffer && (() => {
        const entryMeta = ENTRY_DEFAULTS[studioType] || ENTRY_DEFAULTS.trivia
        const EntryIcon = entryMeta.Icon
        const title = studioType === 'chain' ? 'Join the Chain'
          : studioType === 'poll' ? 'Ready to Vote?'
          : studioType === 'anonymous' ? 'Send Anonymously'
          : 'Ready to Play?'
        const prompt = studioType === 'chain' ? 'Sign your addition' : 'Who is playing?'
        return (
          <div
            className="cp-entry-screen cp-type-entry-screen"
            style={{
              '--entry-bg': c.card.backgroundColor || '#0b0f14',
              '--entry-g1': entryMeta.color,
              '--entry-g2': c.background.colors?.[1] || '#111827',
              '--entry-accent': c.theme.accentColor || entryMeta.color,
            }}
          >
            <div className="cp-entry-content">
              <div className="cp-entry-brand">
                <img src="/cardora-logo.png?v=4" alt="" className="cp-entry-brand-logo" />
                <span className="cp-entry-brand-name">Cardora</span>
              </div>
              <div className="cp-entry-type-chip">
                <EntryIcon size={14} color="currentColor" />
                <span>{entryMeta.label}</span>
              </div>
              <h1 className="cp-entry-title" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                {title}
              </h1>
              <p className="cp-type-entry-copy" style={{ color: c.card.textColor }}>
                {cardTitle || c.content.heading || entryMeta.hint}
              </p>
              <button className="cp-entry-open-btn" style={{ '--btn-color': c.theme.accentColor }} onClick={handleBufferedStart}>
                <span className="cp-entry-open-ring" />
                <span className="cp-entry-open-label">Start</span>
              </button>
            </div>
            {showIdentitySheet && (
              <div className="cp-identity-sheet" role="dialog" aria-modal="true" aria-label={prompt}>
                <div className="cp-identity-handle" />
                <p className="cp-identity-label">{prompt}</p>
                <input
                  type="text"
                  value={participantName}
                  maxLength={50}
                  autoFocus
                  placeholder="Name or nickname"
                  onChange={e => setParticipantName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveParticipantName() }}
                />
                <button type="button" disabled={!participantName.trim()} onClick={saveParticipantName}>
                  Continue
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* ENVELOPE (closed state) — only Personal + Chain cards get the reveal metaphor */}
      {unlocked && stage === 'closed' && envelopeEnabled && (
        <>
          {lockSpec.hint?.trim() && (
            <p className="cp-reveal-hint" aria-hidden="true">
              {lockSpec.hint}
            </p>
          )}
          <Envelope
            cardObject={c}
            tier={tier}
            recipientEmail={recipientEmail}
            onOpenComplete={handleOpen}
          />
        </>
      )}

      {/* GALAXY — full-screen scene between the envelope and the card. */}
      {unlocked && stage === 'galaxy' && (
        <Suspense fallback={<div className="gx-intro" aria-busy="true" />}>
          <GalaxyExperience
            experience={c.experience}
            images={c.media.images}
            onContinue={openCardNow}
          />
        </Suspense>
      )}

      {/* OPEN CARD — also gated by lock for non-envelope card types. */}
      {unlocked && stage === 'open' && (
        <div ref={openCardDepthRef} className="cp-card-wrap cp-card-wrap-full cp-card-wrap-depth">
          {renderGradientBorder(
            <article
              className={`cp-card cp-card-full ${isTextOnlyCard ? 'cp-card-text-only' : 'cp-card-with-media'}`}
              style={cardSurfaceStyle({ ...borderStyle, '--scrollbar-color': c.card.scrollbarColor })}
            >
              <div ref={openCardInnerRef} className="cp-card-inner cp-card-inner-full" style={{ '--scrollbar-color': c.card.scrollbarColor }}>
                {/* Render card body elements in the user-defined order */}
                {(c.layout?.elementOrder || ['media', 'heading', 'body']).map(key => {
                  if (key === 'heading') return (
                    <h2
                      key="heading"
                      className={`cp-heading cp-reveal-element ${revealStep >= 1 ? 'visible' : ''}`}
                      style={{
                        color: c.card.headingColor,
                        fontFamily: `'${c.theme.fontFamily}', serif`,
                        fontSize: `${c.theme.headingSize ?? 28}px`,
                      }}
                    >
                      {c.content.heading}
                    </h2>
                  )
                  if (key === 'media') return mediaAllowed && c.media.images.length > 0 ? (
                    <div
                      ref={openCardMediaRef}
                      key="media"
                      className={`cp-media-section cp-media-section-full cp-media-grid--${Math.min(c.media.images.length, 3)} ${c.media.images.length > 1 ? 'cp-media-auto-pan' : ''} cp-reveal-element ${revealStep >= 2 ? 'visible' : ''} ${revealStep >= 4 ? 'settled' : ''}`}
                      style={{ transitionDuration: hasFadeIn ? `${fadeSpeed}s` : '0.3s' }}
                    >
                      {c.media.images.map((img, i) => (
                        <div key={i} className="cp-media-item cp-media-item-full">
                          <img
                            src={img.url}
                            alt={img.caption || ''}
                            style={{
                              objectFit: img.fit || 'cover',
                              objectPosition: `${img.positionX ?? 50}% ${img.positionY ?? 50}%`,
                              height: img.height ? `${img.height}px` : undefined,
                            }}
                          />
                          {img.caption && <p className="cp-caption cp-caption-full">{img.caption}</p>}
                        </div>
                      ))}
                    </div>
                  ) : null
                  if (key === 'body') return (
                    <div
                      ref={openCardBodyRef}
                      key="body"
                      className={`cp-body cp-body-scroll cp-reveal-element ${fadeBody && revealStep >= 3 ? 'visible' : ''}`}
                      style={{
                        color: c.card.textColor,
                        fontFamily: `'${c.theme.fontFamily}', sans-serif`,
                        fontSize: `${c.theme.bodySize ?? 16}px`,
                        transitionDuration: hasFadeIn ? `${fadeSpeed}s` : '0.3s',
                      }}
                    >
                      <p>{hasTypewriter ? typedBody : c.content.body}</p>
                      {c.content.extendedBody && (
                        <p className="cp-extended">
                          {hasTypewriter ? typedExtended : c.content.extendedBody}
                        </p>
                      )}
                      {senderName && (
                        <p className="cp-signoff" style={{ color: c.card.textColor }}>
                          &mdash; Sent by {senderName}
                        </p>
                      )}
                    </div>
                  )
                  return null
                })}

                {isPersonalType && (
                  <div className="cp-personal-signature" style={{ '--sig-accent': c.theme.accentColor, color: c.card.textColor }}>
                    <span className="cp-personal-signature-cardora">Cardora</span>
                  </div>
                )}

                {/* Type info strip — gives poll/trivia/chain/anonymous cards something
                    concrete to show even when the sender didn't write a heading/body
                    (most senders of these types skip straight to the interactive part). */}
                {!isPersonalType && (
                  <div className={`cp-type-info-strip cp-reveal-element ${revealStep >= 3 ? 'visible' : ''}`} style={{ '--strip-accent': c.theme.accentColor, color: c.card.textColor }}>
                    {studioType === 'trivia' && (
                      <>
                        <span className="cp-type-info-icon">🧠</span>
                        <p>{(triviaData?.questions?.length) || 0} question{(triviaData?.questions?.length) === 1 ? '' : 's'} · test what you know</p>
                      </>
                    )}
                    {studioType === 'poll' && (
                      <>
                        <span className="cp-type-info-icon">📊</span>
                        <p>{(pollData?.options?.length) || 0} options · see live results after voting</p>
                      </>
                    )}
                    {studioType === 'chain' && (
                      <>
                        <span className="cp-type-info-icon">🔗</span>
                        <p>Reply with your own card and keep the chain going</p>
                      </>
                    )}
                    {studioType === 'anonymous' && (
                      <>
                        <span className="cp-type-info-icon">🤫</span>
                        <p>100% anonymous — nobody will know it was you</p>
                      </>
                    )}
                    {senderName && <span className="cp-type-info-sender">from {senderName}</span>}
                  </div>
                )}

                {/* Continue */}
                <div className={`cp-card-action-row cp-reveal-element ${revealStep >= 4 ? 'visible' : ''}`}>
                  <button
                    className="cp-continue-btn"
                    style={{
                      '--action-accent': c.theme.accentColor,
                      color: c.theme.accentColor,
                    }}
                    onClick={handleContinue}
                  >
                    <span>{continueLabel}</span>
                    <span aria-hidden="true" className="cp-continue-mark">+</span>
                  </button>
                </div>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* POLL VOTE STAGE */}
      {stage === 'pollVote' && pollData && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-card-inner cp-card-inner-full">
                <div className="cp-poll-stage">
                  <p className="cp-poll-eyebrow" style={{ color: c.theme.accentColor }}>Poll Experience</p>
                  <h2
                    className="cp-poll-question-text"
                    style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}
                  >
                    {pollData.question || 'Your poll question'}
                  </h2>
                  <div className="cp-poll-options">
                    {(pollData.options || []).map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`cp-poll-option cp-cascade-in ${previewPollVotes.includes(i) ? 'selected' : ''} ${previewPollSubmitted ? 'submitted' : ''}`}
                        style={{ color: c.card.textColor, '--i': i }}
                        onClick={() => {
                          if (previewPollSubmitted) return
                          if (pollData.allowMultiple) {
                            setPreviewPollVotes(prev => prev.includes(i) ? prev.filter(v => v !== i) : [...prev, i])
                          } else {
                            setPreviewPollVotes([i])
                          }
                        }}
                      >
                        <span className="cp-poll-radio" />
                        <span>{(typeof opt === 'object' ? opt.text : opt) || `Option ${i + 1}`}</span>
                      </button>
                    ))}
                  </div>
                  {!previewPollSubmitted ? (
                    <>
                      <button
                        type="button"
                        className="cp-poll-submit"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                        disabled={previewPollVotes.length === 0 || previewPollSubmitting}
                        onClick={async () => {
                          if (previewPollSubmitting) return
                          setPreviewPollSubmitting(true)
                          setPreviewPollError('')
                          try {
                            const opts = pollData?.options || []
                            const optId = previewPollVotes.map(i => {
                              const o = opts[i]
                              return typeof o === 'object' ? o.id : `opt_${i}`
                            })[0]
                            if (onPollSubmit) {
                              await onPollSubmit(optId)
                            }
                            setPreviewPollSubmitted(true)
                            // Was already-voted (interaction snapshot), so don't
                            // double-count; otherwise bump the just-cast vote
                            // optimistically until the next real fetch.
                            if (!(interaction?.kind === 'poll' && interaction.viewerVote)) {
                              setPollTallies(prev => {
                                const base = prev || opts.map(o => ({
                                  id: typeof o === 'object' ? o.id : `opt_${opts.indexOf(o)}`,
                                  text: typeof o === 'object' ? o.text : o,
                                  votes: 0,
                                }))
                                return base.map(o => o.id === optId ? { ...o, votes: (o.votes || 0) + 1 } : o)
                              })
                            }
                            try {
                              localStorage.setItem(`${receiverStorageKey}:poll`, JSON.stringify({ submitted: true, votes: previewPollVotes }))
                            } catch {
                              /* ignore localStorage failures */
                            }
                          } catch (err) {
                            setPreviewPollError(err?.message || 'Could not submit your vote. Please try again.')
                          } finally {
                            setPreviewPollSubmitting(false)
                          }
                        }}
                      >
                        {previewPollSubmitting ? 'Submitting...' : 'Submit Vote'}
                      </button>
                      {previewPollError && (
                        <p className="cp-submit-error" style={{ color: c.card.textColor }}>{previewPollError}</p>
                      )}
                    </>
                  ) : (
                    <div className="cp-poll-voted-confirm">
                      <div className="cp-poll-voted-icon" style={{ color: c.theme.accentColor }}>✓</div>
                      <p className="cp-poll-voted-msg" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                        Vote Sealed
                      </p>
                      <div className="cp-poll-voted-choices">
                        {(pollData.options || []).map((opt, i) => (
                          previewPollVotes.includes(i) ? (
                            <div key={i} className="cp-poll-voted-choice" style={{ background: `${c.theme.accentColor}20`, borderColor: `${c.theme.accentColor}60`, color: c.card.textColor }}>
                              <span className="cp-poll-voted-check" style={{ color: c.theme.accentColor }}>✓</span>
                              <span>{(typeof opt === 'object' ? opt.text : opt) || `Option ${i + 1}`}</span>
                            </div>
                          ) : null
                        ))}
                      </div>
                      {pollTallies && (
                        <div className="cp-poll-results">
                          {(() => {
                            const total = pollTallies.reduce((sum, o) => sum + (o.votes || 0), 0) || 1
                            return pollTallies.map((o) => {
                              const pct = Math.round(((o.votes || 0) / total) * 100)
                              return (
                                <div key={o.id} className="cp-poll-result-row" style={{ color: c.card.textColor }}>
                                  <div className="cp-poll-result-label">
                                    <span>{o.text}</span>
                                    <span>{pct}% · {o.votes || 0} vote{(o.votes || 0) === 1 ? '' : 's'}</span>
                                  </div>
                                  <div className="cp-poll-result-bar" style={{ background: `${c.card.textColor}1a` }}>
                                    <div className="cp-poll-result-fill" style={{ width: `${pct}%`, background: c.theme.accentColor }} />
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      )}
                      <button
                        type="button"
                        className="cp-continue-btn visible"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                        onClick={() => setStage('end')}
                      >
                        Continue
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* PERSONAL CARD QUESTION STAGE — the sender's yes/no prompt, followed by
          any "suspense" follow-up lines before the closing screen. */}
      {stage === 'question' && c.questions.items.length > 0 && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article className="cp-card cp-card-full" style={cardSurfaceStyle(borderStyle)}>
              <div className="cp-card-inner cp-card-inner-full">
                <div className="cp-question-stage">
                  {questionIdx === 0 ? (
                    <>
                      <p className="cp-question-eyebrow" style={{ color: c.theme.accentColor }}>{senderName ? `${senderName} asks` : 'A question for you'}</p>
                      <h2
                        className="cp-question-text"
                        style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}
                      >
                        {c.questions.items[0].text}
                      </h2>
                      {questionAnswer === null ? (
                        <div className="cp-question-actions">
                          <button
                            type="button"
                            className="cp-question-yes"
                            style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                            disabled={questionSubmitting}
                            onClick={() => handleAnswerQuestion('yes')}
                          >
                            {questionSubmitting ? 'Submitting…' : 'Yes'}
                          </button>
                          <button
                            type="button"
                            className="cp-question-no"
                            style={{ color: c.card.textColor }}
                            disabled={questionSubmitting}
                            onClick={() => handleAnswerQuestion('no')}
                          >
                            <span>No</span>
                          </button>
                        </div>
                      ) : (
                        <div className="cp-question-answered">
                          <div className="cp-question-answered-icon" style={{ color: c.theme.accentColor }}>✓</div>
                          <p className="cp-question-answered-msg" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                            You answered "{questionAnswer === 'yes' ? 'Yes' : 'No'}"
                          </p>
                        </div>
                      )}
                      {questionSubmitError && (
                        <p className="cp-submit-error" style={{ color: c.card.textColor }}>{questionSubmitError}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="cp-question-eyebrow" style={{ color: c.theme.accentColor }}>{senderName || 'Cardora'}</p>
                      <h2
                        className="cp-question-text"
                        style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}
                      >
                        {c.questions.items[questionIdx].text}
                      </h2>
                      <button
                        type="button"
                        className="cp-continue-btn visible"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                        onClick={handleNextQ}
                      >
                        {questionIdx < c.questions.items.length - 1 ? 'Continue' : 'Done'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* TRIVIA QUESTION STAGE */}
      {stage === 'triviaQ' && triviaData && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-card-inner cp-card-inner-full">
                <div className="cp-trivia-stage">
                  <div className="cp-trivia-progress">
                    {triviaData.questions.map((_, i) => (
                      <div
                        key={i}
                        className={`cp-trivia-progress-dot ${i < previewTriviaIdx ? 'done' : ''} ${i === previewTriviaIdx ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                  <p className="cp-trivia-counter" style={{ color: c.theme.accentColor }}>
                    Question {previewTriviaIdx + 1} of {triviaData.questions.length}
                  </p>
                  <h3
                    className="cp-trivia-question-text"
                    style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}
                  >
                    {triviaData.questions[previewTriviaIdx]?.text || triviaData.questions[previewTriviaIdx]?.question || 'Question'}
                  </h3>
                  <div className="cp-trivia-options">
                    {(triviaData.questions[previewTriviaIdx]?.options || []).map((opt, oi) => (
                      <button
                        key={oi}
                        type="button"
                        disabled={triviaLocked}
                        className={`cp-trivia-option cp-cascade-in ${previewTriviaAnswers[previewTriviaIdx] === oi ? 'selected' : ''}`}
                        style={{ color: c.card.textColor, '--i': oi }}
                        onClick={() => {
                          if (triviaLocked) return
                          const next = [...previewTriviaAnswers]
                          next[previewTriviaIdx] = oi
                          setPreviewTriviaAnswers(next)
                        }}
                      >
                        <span className="cp-trivia-option-letter">{String.fromCharCode(65 + oi)}</span>
                        <span>{opt || `Option ${oi + 1}`}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cp-trivia-next"
                    style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                    disabled={previewTriviaAnswers[previewTriviaIdx] == null || previewTriviaSubmitting}
                    onClick={async () => {
                      setPreviewTriviaError('')
                      if (previewTriviaIdx < triviaData.questions.length - 1) {
                        setPreviewTriviaIdx(i => i + 1)
                        setTriviaLocked(false)
                      } else {
                        setPreviewTriviaSubmitting(true)
                        try {
                          if (onTriviaComplete) await onTriviaComplete(previewTriviaAnswers, participantName.trim())
                          setPreviewTriviaSubmitted(true)
                          try {
                            localStorage.setItem(`${receiverStorageKey}:trivia`, JSON.stringify({
                              submitted: true,
                              answers: previewTriviaAnswers,
                              name: participantName.trim(),
                            }))
                          } catch {
                            /* ignore localStorage failures */
                          }
                          setStage('triviaResults')
                        } catch (err) {
                          setPreviewTriviaError(err?.message || 'Could not submit your trivia answers. Please try again.')
                        } finally {
                          setPreviewTriviaSubmitting(false)
                        }
                      }
                    }}
                  >
                    {previewTriviaSubmitting
                      ? 'Submitting...'
                      : previewTriviaIdx < triviaData.questions.length - 1 ? 'Next Question' : 'See Results'}
                  </button>
                  {previewTriviaError && (
                    <p className="cp-submit-error" style={{ color: c.card.textColor }}>{previewTriviaError}</p>
                  )}
                </div>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* TRIVIA RESULTS */}
      {stage === 'triviaResults' && triviaData && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-card-inner cp-card-inner-full">
                {(() => {
                  const correct = triviaData.questions.filter((q, i) => Number(previewTriviaAnswers[i]) === Number(q.correctIndex)).length
                  const total = triviaData.questions.length
                  const pct = total > 0 ? correct / total : 0
                  const circumference = 2 * Math.PI * 44
                  const dashOffset = circumference * (1 - pct)
                  const perfMsg = pct === 1 ? 'Perfect score!' : pct >= 0.75 ? 'Great job!' : pct >= 0.5 ? 'Not bad!' : 'Keep practicing!'
                  const perfEmoji = pct === 1 ? '🏆' : pct >= 0.75 ? '🎉' : pct >= 0.5 ? '👏' : '💪'
                  return (
                    <>
                    <div className="cp-trivia-results cp-cascade-in">
                      <svg className="cp-trivia-score-ring" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                      <circle
                        cx="50" cy="50" r="44" fill="none"
                        stroke={c.theme.accentColor}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'center', transform: 'rotate(-90deg)' }}
                      />
                      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill={c.card.headingColor} fontSize="20" fontWeight="800" fontFamily="inherit">
                        {triviaScoreDisplay}/{total}
                      </text>
                    </svg>
                    <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, margin: 0 }}>
                      {perfMsg} {perfEmoji}
                    </h3>
                    <p className="cp-trivia-score-label" style={{ color: c.card.textColor }}>
                      {correct} out of {total} correct
                    </p>
                    <div className="cp-trivia-review-list">
                      {triviaData.questions.map((q, qi) => {
                        const userAnswer = previewTriviaAnswers[qi]
                        return (
                          <div key={qi} className="cp-trivia-review-item">
                            <h4 className="cp-trivia-review-question" style={{ color: c.card.headingColor }}>
                              {qi + 1}. {q.text || q.question || 'Question'}
                            </h4>
                            <div className="cp-trivia-review-options">
                              {(q.options || []).map((opt, oi) => {
                                const isUserSelected = Number(userAnswer) === oi
                                const isCorrectOpt = Number(q.correctIndex) === oi
                                let optionClass = "cp-trivia-review-option"
                                if (isCorrectOpt) optionClass += " correct"
                                else if (isUserSelected && !isCorrectOpt) optionClass += " wrong"
                                return (
                                  <div key={oi} className={optionClass}>
                                    <div className="cp-trivia-review-opt-left">
                                      <span className="cp-trivia-review-letter">{String.fromCharCode(65 + oi)}</span>
                                      <span className="cp-trivia-review-text">{opt}</span>
                                    </div>
                                    <div className="cp-trivia-review-badges">
                                      {isCorrectOpt && !isUserSelected && <span className="cp-trivia-review-badge correct">Correct Answer</span>}
                                      {isUserSelected && !isCorrectOpt && <span className="cp-trivia-review-badge wrong">Your Choice</span>}
                                      {isUserSelected && isCorrectOpt && <span className="cp-trivia-review-badge correct-choice">Your Choice & Correct</span>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="cp-end-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    {giftAllowed && (
                      <button
                        type="button"
                        className="cp-continue-btn visible"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                        onClick={() => navigate('/')}
                      >
                        Create yours
                      </button>
                    )}
                    <button
                      type="button"
                      className="cp-end-btn ghost"
                      style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                      onClick={() => navigate('/')}
                    >
                      Done
                    </button>
                  </div>
                </>
                )
                })()}
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* ANONYMOUS PREVIEW */}
      {stage === 'anonPreview' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-card-inner cp-card-inner-full">
                <div className="cp-anon-stage">
                  <p className="cp-anon-template-label" style={{ color: c.theme.accentColor }}>
                    Anonymous Inbox Template
                  </p>
                  <h2 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, margin: 0, fontSize: '1.3rem' }}>
                    {c.content.heading}
                  </h2>
                  <p style={{ color: c.card.textColor, margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {c.content.body}
                  </p>
                  <div className="cp-anon-sample-msg">
                    <p style={{ color: c.card.textColor }}>
                      "This is a preview of how anonymous messages will appear, wrapped in your template design."
                    </p>
                  </div>
                  <div className="cp-anon-mock-input">
                    <p>Senders will type their message here</p>
                  </div>
                  <button
                    type="button"
                    className="cp-continue-btn visible"
                    style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                    onClick={() => setStage('end')}
                  >
                    Done
                  </button>
                </div>
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* ANONYMOUS REPLY — shown in pageMode when recipient opens an anonymous card */}
      {stage === 'anonReply' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full cp-anon-reply-card"
              style={cardSurfaceStyle(borderStyle)}
            >
              {anonSubmitted ? (
                <div className="cp-anon-reply-sent">
                  <div className="cp-end-icon" style={{ color: c.theme.accentColor }}>✓</div>
                  <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                    Sent anonymously
                  </h3>
                  <p style={{ color: c.card.textColor, opacity: 0.7, fontSize: '0.9rem' }}>
                    Your message was delivered. The creator won't know it was you.
                  </p>
                  <div className="cp-end-actions">
                    {hasGift ? (
                      <button
                        className="cp-end-btn"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                        onClick={() => setStage('end')}
                      >
                        Continue
                      </button>
                    ) : (
                      <>
                        <button
                          className="cp-end-btn"
                          style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                          onClick={handleReset}
                        >
                          Replay card
                        </button>
                        <button
                          type="button"
                          className="cp-end-btn ghost"
                          style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }}
                          onClick={() => navigate('/')}
                        >
                          Create yours
                        </button>
                        <button
                          type="button"
                          className="cp-end-btn ghost"
                          style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)',  }}
                          onClick={() => navigate('/')}
                        >
                          Done
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="cp-anon-reply-form">
                  <p className="cp-anon-reply-label" style={{ color: c.theme.accentColor }}>
                    Anonymous Message
                  </p>
                  <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, marginBottom: 8 }}>
                    Send a message anonymously
                  </h3>
                  <p style={{ color: c.card.textColor, opacity: 0.7, fontSize: '0.85rem', marginBottom: 20 }}>
                    The creator will receive your message but won't know who sent it.
                  </p>
                  <textarea
                    className="cp-anon-textarea"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: `1.5px solid ${c.theme.accentColor}40`,
                      color: c.card.textColor,
                      fontFamily: `'${c.theme.fontFamily}', sans-serif`,
                    }}
                    placeholder="Write your message here… (max 500 characters)"
                    maxLength={500}
                    value={anonMessage}
                    onChange={e => setAnonMessage(e.target.value)}
                  />
                  <div className="cp-anon-char-count" style={{ color: c.card.textColor, opacity: 0.45 }}>
                    {anonMessage.length} / 500
                  </div>

                  {anonUploadError && <p className="cp-submit-error" style={{ color: c.card.textColor }}>{anonUploadError}</p>}

                  <button
                    className="cp-continue-btn visible"
                    style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor, opacity: anonSubmitting ? 0.6 : 1 }}
                    disabled={!anonMessage.trim() || anonSubmitting}
                    onClick={async () => {
                      if (!anonMessage.trim()) return
                      setAnonSubmitting(true)
                      setAnonUploadError('')
                      try {
                        // 4.2: anonymous is text-only -- no voice/media extras.
                        if (onAnonSubmit) await onAnonSubmit(anonMessage.trim())
                        setAnonSubmitted(true)
                      } catch (err) {
                        setAnonUploadError(err?.message || 'Could not send your message. Try again.')
                      }
                      setAnonSubmitting(false)
                    }}
                  >
                    {anonSubmitting ? 'Sending…' : 'Send Anonymously'}
                  </button>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: c.card.textColor, opacity: 0.4, fontSize: '0.8rem', marginTop: 8, cursor: 'pointer' }}
                    onClick={() => setStage('end')}
                  >
                    Skip
                  </button>
                </div>
              )}
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* CHAIN REPLIES — live public feed + reply form, pageMode only */}
      {stage === 'chainReplies' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          {renderGradientBorder(
            <article
              className="cp-card cp-card-full cp-chain-replies-card"
              style={cardSurfaceStyle(borderStyle)}
            >
              <div className="cp-chain-replies-inner">
                {/* Header */}
                <div className="cp-chain-header">
                  <p className="cp-chain-eyebrow" style={{ color: c.theme.accentColor }}>Chain Card</p>
                  {c.content.heading && (
                    <h3 className="cp-chain-challenge" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                      {c.content.heading}
                    </h3>
                  )}
                </div>

                {/* Existing replies feed */}
                <div className="cp-chain-feed">
                  {localChainReplies.length === 0 ? (
                    <p className="cp-chain-empty" style={{ color: c.card.textColor }}>
                      No replies yet — be the first!
                    </p>
                  ) : (
                    localChainReplies.map((r, i) => (
                      <div key={r.id || r.userId || i} className="cp-chain-reply">
                        <div className="cp-chain-reply-avatar" style={{ background: `${c.theme.accentColor}30`, color: c.theme.accentColor }}>
                          {(r.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="cp-chain-reply-body">
                          <span className="cp-chain-reply-name" style={{ color: c.theme.accentColor }}>{r.name || 'Someone'}</span>
                          <p className="cp-chain-reply-text" style={{ color: c.card.textColor }}>{r.response || r.message}</p>
                        </div>
                        {r.id && (
                          <button
                            type="button"
                            className="cp-chain-reply-report"
                            title="Report this entry"
                            aria-label="Report this entry"
                            onClick={() => setReportingEntry(r)}
                          >
                            &#9873;
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Reply form */}
                {chainDelivered ? (
                  // 6.4: the backend already 400s a write to a delivered
                  // chain -- this just shows the closed state up front
                  // instead of letting a viewer fill out a form that will
                  // fail on submit.
                  <div className="cp-chain-reply-sent">
                    <p className="cp-chain-sent-msg" style={{ color: c.theme.accentColor }}>This chain has been delivered — no more replies can be added.</p>
                    <button
                      className="cp-continue-btn visible"
                      style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                      onClick={() => setStage('end')}
                    >
                      Continue
                    </button>
                  </div>
                ) : !chainSubmitted ? (
                  <div className="cp-chain-reply-form">
                    <input
                      type="text"
                      className="cp-chain-name-input"
                      style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif` }}
                      placeholder="Your name or handle…"
                      maxLength={50}
                      value={chainName}
                      onChange={e => setChainName(e.target.value)}
                    />
                    <textarea
                      className="cp-anon-textarea"
                      style={{ color: c.card.textColor, fontFamily: `'${c.theme.fontFamily}', sans-serif` }}
                      placeholder="Add your reply to the chain…"
                      maxLength={500}
                      value={chainMessage}
                      onChange={e => setChainMessage(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="cp-continue-btn visible"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor, flex: 1, opacity: chainSubmitting ? 0.6 : 1 }}
                        disabled={!chainMessage.trim() || chainSubmitting}
                        onClick={async () => {
                          if (!chainMessage.trim()) return
                          setChainSubmitting(true)
                          setChainSubmitError('')
                          const displayName = chainName.trim() || 'Anonymous'
                          try {
                            if (onChainReply) await onChainReply(chainMessage.trim(), displayName)
                            setLocalChainReplies(prev => [...prev, { response: chainMessage.trim(), name: displayName, timestamp: new Date().toISOString() }])
                            setChainSubmitted(true)
                          } catch (err) {
                            setChainSubmitError(err?.message || 'Could not add your reply. Please try again.')
                          } finally {
                            setChainSubmitting(false)
                          }
                        }}
                      >
                        {chainSubmitting ? 'Sending…' : 'Reply to Chain'}
                      </button>
                      <button
                        type="button"
                        style={{ background: 'none', border: `1.5px solid ${c.theme.accentColor}40`, color: c.theme.accentColor, borderRadius: 999, padding: '0 16px', cursor: 'pointer', fontSize: '0.82rem' }}
                        onClick={() => setStage('end')}
                      >
                        Skip
                      </button>
                    </div>
                    {chainSubmitError && (
                      <p className="cp-submit-error" style={{ color: c.card.textColor }}>{chainSubmitError}</p>
                    )}
                  </div>
                ) : (
                  // 6.4: "the loudest element is Add yours and send it on →
                  // wa.me share. This is the growth loop; do not bury it
                  // under a confirmation." The share link is the page the
                  // contributor is standing on right now — reusing it (not
                  // a separately-constructed URL) means it can never drift.
                  <div className="cp-chain-reply-sent">
                    <p className="cp-chain-sent-msg" style={{ color: c.theme.accentColor }}>✓ Reply added to the chain!</p>
                    <a
                      className="cp-chain-passalong-btn"
                      style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                      href={`https://wa.me/?text=${encodeURIComponent(`I just added mine to this chain — add yours! ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Add yours and send it on →
                    </a>
                    <button
                      type="button"
                      className="cp-chain-passalong-skip"
                      style={{ color: c.theme.accentColor }}
                      onClick={() => setStage('end')}
                    >
                      Continue without sharing
                    </button>
                  </div>
                )}
              </div>
            </article>,
            'cp-gradient-border-full'
          )}
        </div>
      )}

      {/* END */}
      {stage === 'end' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          <article
            className="cp-card cp-card-full cp-end-card"
            style={cardSurfaceStyle(borderStyle)}
          >
            {pageMode ? (
              <div className="cp-end-outro">
                {/* Animated sparkle burst */}
                <div className="cp-end-sparkle-ring" style={{ '--end-accent': c.theme.accentColor }}>
                  {[0,1,2,3,4,5,6,7].map(i => (
                    <div key={i} className="cp-end-sparkle" style={{ '--i': i, background: c.theme.accentColor }} />
                  ))}
                  <div className="cp-end-outro-check" style={{ color: c.theme.accentColor }}>✓</div>
                </div>

                <h3 className="cp-end-outro-heading" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                  That's the whole card
                </h3>
                <p className="cp-end-outro-sub" style={{ color: c.card.textColor }}>
                  Hope it made your day
                </p>

                {onReact && (
                  <div className="cp-reaction-bar" role="group" aria-label="React to this card">
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={`cp-reaction-btn${viewerReaction === emoji ? ' active' : ''}`}
                        style={{ '--reaction-accent': c.theme.accentColor }}
                        disabled={reactionPending}
                        onClick={() => handleReact(emoji)}
                      >
                        <span>{emoji}</span>
                        {reactionCounts[emoji] > 0 && <span className="cp-reaction-count">{reactionCounts[emoji]}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Cardora branding */}
                <div className="cp-end-brand">
                  <img src="/cardora-logo.png?v=4" alt="" className="cp-end-brand-logo" />
                  <span style={{ color: c.card.textColor, opacity: 0.5, fontSize: '0.78rem' }}>Made with Cardora</span>
                </div>

                <div className="cp-end-actions">
                  {hasGift && (
                    <button className="cp-end-btn" style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }} onClick={handleEndDone}>
                      Continue
                    </button>
                  )}
                  <button className="cp-end-btn" style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }} onClick={handleReset}>
                    Replay
                  </button>
                  {studioType === 'personal' ? (
                    // 6.5: "Every Personal Card ends with Send one back ->
                    // new Personal Card pre-addressed to the original
                    // sender... replaces the current unclear Done+ button."
                    // A quiet "Done" stays underneath for anyone who just
                    // wants to leave, but it's no longer equal-weight with
                    // the reply CTA.
                    <>
                      <button
                        type="button"
                        className="cp-end-btn"
                        style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                        onClick={handleSendOneBack}
                      >
                        Send one back
                      </button>
                      <button
                        type="button"
                        className="cp-end-btn ghost"
                        style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                        onClick={() => navigate('/')}
                      >
                        Done
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="cp-end-btn ghost"
                        style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }}
                        onClick={() => navigate('/')}
                      >
                        Create yours
                      </button>
                      <button
                        type="button"
                        className="cp-end-btn ghost"
                        style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)',  }}
                        onClick={() => navigate('/')}
                      >
                        Done
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
                  Card Complete
                </h3>
                <p style={{ color: c.card.textColor }}>
                  This is how the recipient will experience your card.
                </p>
                <div className="cp-end-actions">
                  {hasGift && (
                    <button className="cp-end-btn" style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }} onClick={handleEndDone}>
                      Continue
                    </button>
                  )}
                  <button className="cp-end-btn" style={{ backgroundColor: hasGift ? 'transparent' : c.theme.accentColor, color: hasGift ? c.theme.accentColor : c.card.backgroundColor, border: hasGift ? `1.5px solid ${c.theme.accentColor}` : 'none' }} onClick={handleReset}>
                    Replay
                  </button>
                  <button className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }} onClick={onClose}>
                    Back to Editor
                  </button>
                </div>
              </>
            )}
          </article>
        </div>
      )}

      {/* GIFT INTRO */}
      {stage === 'giftIntro' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          <article className="cp-card cp-card-full cp-gift-intro" style={cardSurfaceStyle(borderStyle)}>
            <div className="cp-gift-sparkle">🎁</div>
            <h3 className="cp-gift-intro-heading" style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
              Wait... there's more
            </h3>
            <p className="cp-gift-intro-sub" style={{ color: c.card.textColor }}>
              Someone left something special for you.
            </p>
            <p className="cp-gift-intro-hint" style={{ color: c.theme.accentColor }}>
              A gift is waiting to be revealed.
            </p>
            <button
              className="cp-gift-reveal-btn"
              style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
              onClick={() => setStage('giftReveal')}
            >
              Reveal Gift
            </button>
          </article>
        </div>
      )}

      {/* GIFT REVEAL */}
      {stage === 'giftReveal' && (
        <PremiumGiftReveal
          effect={c.giftEffect.effectKey}
          onComplete={() => setStage('giftReceive')}
        />
      )}

      {/* GIFT RECEIVE */}
      {stage === 'giftReceive' && (
        <div className="cp-card-wrap cp-card-wrap-full">
          <article className="cp-card cp-card-full cp-gift-receive" style={cardSurfaceStyle(borderStyle)}>
            <div className="cp-gift-received-icon">🎉</div>
            <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif` }}>
              You received a gift!
            </h3>
            <p className="cp-gift-title" style={{ color: c.theme.accentColor }}>
              {c.giftEffect.giftTitle}
            </p>
            {c.giftEffect.giftAmount && (
              <p className="cp-gift-value" style={{ color: c.card.textColor }}>
                Value: {c.giftEffect.giftAmount}
              </p>
            )}
            <div className="cp-end-actions">
              {(() => {
                const isClaimed = c.giftEffect?.status === 'claimed' || localClaimed
                return (
                  <button
                    className="cp-end-btn"
                    style={{
                      backgroundColor: isClaimed ? 'rgba(255,255,255,0.1)' : c.theme.accentColor,
                      color: isClaimed ? 'rgba(255,255,255,0.4)' : c.card.backgroundColor,
                      opacity: claimingGift ? 0.7 : 1,
                      cursor: isClaimed ? 'not-allowed' : 'pointer',
                    }}
                    disabled={claimingGift || isClaimed}
                    onClick={() => {
                      if (!currentUser) {
                        setGiftClaimMessage('Please sign in to claim this gift — you\'ll come right back here.')
                        if (openAuthModal) {
                          openAuthModal(performClaim, location.pathname + location.search, {
                            title: 'Sign in to claim your gift',
                            message: `${c.giftEffect?.giftTitle || 'This gift'} is waiting for you. Sign in or create a free account and you'll land right back here to finish claiming it.`,
                          })
                        } else {
                          navigate('/login')
                        }
                        return
                      }
                      performClaim()
                    }}
                  >
                    {claimingGift ? 'Claiming...' : isClaimed ? 'Claimed' : 'Claim Gift'}
                  </button>
                )
              })()}
              {giftClaimMessage && (
                <p style={{ color: c.theme.accentColor, fontSize: '0.85rem', marginTop: '4px', textAlign: 'center' }}>
                  {giftClaimMessage}
                </p>
              )}
              {pageMode ? (
                // Below the primary Claim action: two clearly distinct,
                // de-emphasized secondary actions instead of the previous
                // three-button stack where "Create yours" and "Done" both
                // navigated home (identical, redundant) and "Replay" read as
                // if it might re-run the claim rather than just the opening
                // animation.
                <div className="cp-gift-secondary-actions">
                  <button
                    type="button"
                    className="cp-end-btn ghost small"
                    style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }}
                    onClick={handleReset}
                  >
                    Replay animation
                  </button>
                  <button
                    type="button"
                    className="cp-end-btn small"
                    style={{ backgroundColor: c.theme.accentColor, color: c.card.backgroundColor }}
                    onClick={() => navigate('/')}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button className="cp-end-btn ghost" style={{ color: c.theme.accentColor, borderColor: c.theme.accentColor }} onClick={onClose}>
                  Back to Editor
                </button>
              )}
            </div>
          </article>
        </div>
      )}
    </section>
  )

  // 6.4: rendered as a sibling regardless of pageMode/portal branching below
  // -- ReportModal already portals itself to document.body, so it doesn't
  // matter which branch `inner` takes.
  const reportModal = reportingEntry && (
    <ReportModal
      type="card"
      targetId={cardId}
      targetName={reportingEntry.name || 'this entry'}
      entryId={reportingEntry.id}
      onClose={() => setReportingEntry(null)}
    />
  )

  return pageMode
    ? (<>{inner}{reportModal}</>)
    : (<>{createPortal(inner, document.body)}{reportModal}</>)
}

export default CardPreviewModal

