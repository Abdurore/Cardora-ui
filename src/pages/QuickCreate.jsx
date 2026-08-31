import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useOutletContext } from 'react-router-dom'
import { PALETTES, applyPalette } from '../lib/palettes.js'
import { defaultCardObject } from '../data/cardDefaults.js'
import { attachGiftToCard, getCardPrices, getTemplateById, getMyCard, trackEvent, createReminder } from '../lib/api.js'
import { EXPLORE_OCCASION_TABS } from '../lib/occasionTaxonomy.js'
import { effectKeyToGiftName } from '../lib/gifts.js'
import { GiftIcon } from '../components/GiftCard.jsx'
import { uploadToCloudinary } from '../lib/cloudinary.js'
import { computeCardTier, getTierCost, getCardTotalCost, computeFeatureSurcharges, normalizeCardPrices, normalizeFeatureSurcharges, fontTier } from '../lib/tierRequirements.js'
import { getTierLimits } from '../lib/tierLimits.js'
import TierPip from '../components/TierPip.jsx'
import TierMeter from '../components/TierMeter.jsx'
import SendReceipt from '../components/SendReceipt.jsx'
import CardPreviewModal from '../components/CardPreviewModal.jsx'
import { generateAnonShareImage, shareOrDownloadAnonImage } from '../lib/anonShareImage.js'
import InstallPrompt from '../components/InstallPrompt.jsx'

// Labels/sample copy only now — pip tier is derived live via the shared
// `fontTier()` (tierRequirements.js), not a hardcoded tag here. That list
// used to disagree with the Studio's own font tiers (e.g. it tagged Cinzel,
// the platform's default classic font, as Elite).
const QUICK_FONTS = [
  { label: 'Poppins',          value: 'Poppins',          sample: 'Modern & Clean' },
  { label: 'Lora',             value: 'Lora',             sample: 'Literary Charm' },
  { label: 'Nunito',           value: 'Nunito',           sample: 'Friendly Round' },
  { label: 'Playfair Display', value: 'Playfair Display', sample: 'Elegant Serif' },
  { label: 'Montserrat',       value: 'Montserrat',       sample: 'Bold Geometric' },
  { label: 'Dancing Script',   value: 'Dancing Script',   sample: 'Handwritten' },
  { label: 'Raleway',          value: 'Raleway',          sample: 'Sleek & Thin' },
  { label: 'Cinzel',           value: 'Cinzel',           sample: 'Classic Roman' },
]


const TYPE_LABEL = {
  personal:  'Personal Card',
  poll:      'Poll Card',
  trivia:    'Trivia Card',
  chain:     'Chain Card',
  anonymous: 'Anonymous Card',
}

const STEP3_CONFIG = {
  personal:  { title: 'Your Message',     sub: 'What do you want to say?' },
  poll:      { title: 'Your Poll',         sub: 'Ask your audience a question' },
  chain:     { title: 'Challenge',         sub: 'What do you challenge them to do?' },
  trivia:    { title: 'Your Quiz',         sub: 'Create a question for your recipients' },
  anonymous: { title: 'Your Message',     sub: 'Recipients can reply anonymously' },
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

const MAX_IMAGES = 3
// Quick Create is the fast, low-friction path — the full ~24-theme library
// belongs to Studio. Showing all of them here (or expanding to all in place)
// turned a 30-second flow into theme-browsing. 6 fills two full grid rows;
// "See all in Studio" hands off the rest instead of growing this page.
const PALETTE_INITIAL_COUNT = 6

function QuickCreate() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const cardType = params.get('type') || 'personal'

  const { createCardOnBackend, currentUser, openAuthModal, balance, inventory = [], canInstall, promptInstall } = useOutletContext()

  // Live pricing, same source CardStudio uses — Quick mode used to rely on
  // the hardcoded fallback table only, so a backend price change would
  // silently desync between the two creation flows.
  const [cardPrices, setCardPrices] = useState(null)
  const [featureSurcharges, setFeatureSurcharges] = useState(() => normalizeFeatureSurcharges(null))
  useEffect(() => {
    let mounted = true
    getCardPrices().then((payload) => {
      if (!mounted) return
      setCardPrices(normalizeCardPrices(payload))
      setFeatureSurcharges(normalizeFeatureSurcharges(payload))
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  const [selectedPalette, setSelectedPalette] = useState(PALETTES[0])
  const [selectedFont, setSelectedFont] = useState('Poppins')

  // Personal
  const [heading, setHeading] = useState('')
  const [body, setBody] = useState('')

  // 6.1: "pick a template, replace text, send" -- step zero (CardTypeModal)
  // hands off the chosen template's id here rather than pre-building the
  // full cardObject itself, since only the already-unlocked, full
  // layoutConfig (fetched here, not the listing payload) has real content
  // to seed. Text only, deliberately -- QuickCreate's own palette/font
  // pickers stay the source of truth for how the card looks, so a
  // template's visual choices aren't silently forced on someone who just
  // wanted its wording.
  const templateId = params.get('template') || ''
  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    getTemplateById(templateId).then((res) => {
      if (cancelled) return
      const template = res?.template || res?.data || res || null
      const content = template?.layoutConfig?.content || template?.layoutdata?.content || null
      if (!content) return
      if (cardType === 'personal') {
        if (content.header) setHeading(content.header)
        if (content.body) setBody(content.body)
      }
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  // 6.2: "one-tap create action, prefilled with last year's card as a
  // starting point" -- the occasion-reminder notification's action links
  // here with ?fromCard=<slug>. getMyCard (not the public getCardBySlug)
  // since this is the sender re-reading their own past card, not a
  // recipient opening it -- avoids the view-count/first-open-claim side
  // effects that path has for non-owners.
  const fromCardSlug = params.get('fromCard') || ''
  useEffect(() => {
    if (!fromCardSlug) return
    let cancelled = false
    getMyCard(fromCardSlug).then((res) => {
      if (cancelled) return
      const card = res?.card || res?.data?.card || res?.data || res || null
      const content = card?.config?.content || null
      if (!content) return
      if (cardType === 'personal') {
        if (content.header) setHeading(content.header)
        if (content.body) setBody(content.body)
      }
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCardSlug])

  // 6.5: "Send one back" -- CardPreviewModal's personal-card end screen
  // links here with ?replyTo=<originalSlug>&replySender=<name>. The name
  // rides in the query param itself (not a fetch) specifically to avoid
  // re-triggering GET /cards/:slug's view-count increment just to look up
  // a name the replier's own previous screen already had in memory.
  const replyTo = params.get('replyTo') || ''
  const replySender = params.get('replySender') || ''
  useEffect(() => {
    if (!replyTo || cardType !== 'personal') return
    setHeading((prev) => prev || (replySender ? `Right back at you, ${replySender}!` : 'Right back at you!'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo])

  // Poll
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

  // Chain
  const [chainChallenge, setChainChallenge] = useState('')

  // Trivia
  const [triviaQuestion, setTriviaQuestion] = useState('')
  const [triviaOptions, setTriviaOptions] = useState(['', '', '', ''])
  const [triviaCorrect, setTriviaCorrect] = useState(0)

  // Anonymous
  const [anonMessage, setAnonMessage] = useState('')

  const [images, setImages] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)

  // Send modal state — mirrors CardStudio
  const [showSendModal, setShowSendModal] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState(null) // null | { ok, slug, message }
  const [sendCopied, setSendCopied] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  // 6.2: "Sender can attach an occasion and date to any recipient at send
  // time." recipientName is just a display label ("Ada") -- there's no
  // recipient-account/identity model in this product.
  const [reminderRecipientName, setReminderRecipientName] = useState('')
  const [reminderOccasion, setReminderOccasion] = useState('Birthday')
  const [reminderDate, setReminderDate] = useState('')
  const [savingReminder, setSavingReminder] = useState(false)
  const [reminderSaved, setReminderSaved] = useState(false)
  const [error, setError] = useState(null)
  const [selectedGiftId, setSelectedGiftId] = useState('none')
  // 6.6: "Auto-generate a 1080x1920 share image on inbox creation... Offer
  // as Share to status." Generated on demand (not persisted) so there's
  // nothing to regenerate later -- the next click always reflects whatever
  // the prompt currently is.
  const [sharingAnonImage, setSharingAnonImage] = useState(false)
  const [anonImageError, setAnonImageError] = useState('')

  const fileInputRef = useRef(null)

  const addImageFile = (file) => {
    if (!file) return
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i)
    if (!isImage) return
    if (images.length >= MAX_IMAGES) return
    const blobUrl = URL.createObjectURL(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImages(prev => prev.length < MAX_IMAGES ? [...prev, { blobUrl, dataUrl: e.target.result, file }] : prev)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    files.forEach(addImageFile)
  }

  const addPollOption = () => {
    if (pollOptions.length < 6) setPollOptions(p => [...p, ''])
  }
  const removePollOption = (i) => {
    if (pollOptions.length > 2) setPollOptions(p => p.filter((_, idx) => idx !== i))
  }
  const updatePollOption = (i, val) => {
    setPollOptions(p => { const n = [...p]; n[i] = val; return n })
  }
  const updateTriviaOption = (i, val) => {
    setTriviaOptions(p => { const n = [...p]; n[i] = val; return n })
  }

  // Build the cardObject from current QC state — used for both sending and "Open in Studio"
  const buildCardObject = () => {
    const baseCard = applyPalette({ ...defaultCardObject }, selectedPalette)
    return {
      ...baseCard,
      theme: { ...baseCard.theme, fontFamily: selectedFont },
      content: cardType === 'personal'
        ? { ...baseCard.content, heading: heading.trim(), body: body.trim() }
        : cardType === 'anonymous'
          ? { ...baseCard.content, heading: '', body: anonMessage.trim() }
          : baseCard.content,
      media: {
        ...(baseCard.media || {}),
        images: images.map(img => ({
          url: img.dataUrl,
          fit: 'cover',
          positionX: 50,
          positionY: 50,
          height: 180,
        })),
      },
      // Fed into computeCardTier below — gift selection lives in its own
      // `selectedGiftId` state here (attach happens post-create), so it has
      // to be mirrored onto the built object for the shared tier rules to see it.
      giftEffect: {
        ...(baseCard.giftEffect || {}),
        enabled: !!selectedGiftId && selectedGiftId !== 'none',
      },
    }
  }

  // The card's tier and CC cost, computed live from what's actually
  // selected — same model as the Studio (src/lib/tierRequirements.js).
  const builtCardObject = useMemo(
    buildCardObject,
    [selectedPalette, selectedFont, cardType, heading, body, anonMessage, images, selectedGiftId],
  )
  const pollDataForTier = useMemo(() => ({ options: pollOptions }), [pollOptions])
  const triviaDataForTier = useMemo(() => ({ questions: [{ options: triviaOptions }] }), [triviaOptions])
  const tierRequirement = useMemo(
    () => computeCardTier(builtCardObject, { type: cardType, pollData: pollDataForTier, triviaData: triviaDataForTier, chainData: null }),
    [builtCardObject, cardType, pollDataForTier, triviaDataForTier],
  )
  const cardTier = tierRequirement.tier
  // 3.2: base type/tier cost + additive feature surcharges -- mirrors
  // CardStudio.jsx's equivalent, both sharing the same tierRequirements.js
  // functions so Quick Create and the full Studio can never disagree on
  // what a card costs.
  const tierCost = getCardTotalCost(builtCardObject, cardTier, cardType, cardPrices, { type: cardType }, featureSurcharges)
  const featureSurchargeBreakdown = useMemo(
    () => computeFeatureSurcharges(builtCardObject, { type: cardType }, featureSurcharges).breakdown,
    [builtCardObject, cardType, featureSurcharges],
  )
  // 7.5: "make it run the actual reveal on tap" -- CardPreviewModal is the
  // same envelope/open/effects renderer the real recipient sees
  // (CardStudio's own "Full Preview" uses it too), not a second mockup to
  // keep in sync. previewTierLimits mirrors what CardStudio computes for
  // the same reason: this must reflect the tier the card will actually
  // send at, not an always-unlocked editing view.
  const [showPreview, setShowPreview] = useState(false)
  const previewTierLimits = useMemo(() => getTierLimits(cardTier), [cardTier])
  // A chain card's challenge text lives in chainChallenge, a separate piece
  // of state from builtCardObject.content.heading -- CardPreviewModal only
  // ever reads content.heading for the chain stage, so without this
  // substitution the reveal would show a blank/default heading instead of
  // the actual challenge just typed in. Mirrors CardStudio.jsx's identical
  // previewCardObject fix.
  const previewCardObject = useMemo(() => {
    if (cardType !== 'chain' || !chainChallenge.trim()) return builtCardObject
    return { ...builtCardObject, content: { ...builtCardObject.content, heading: chainChallenge.trim() } }
  }, [builtCardObject, cardType, chainChallenge])
  const previewPollData = useMemo(
    () => (cardType === 'poll' ? { question: pollQuestion.trim(), options: pollOptions.filter(o => o.trim()) } : null),
    [cardType, pollQuestion, pollOptions],
  )
  const previewTriviaData = useMemo(
    () => (cardType === 'trivia'
      ? { questions: [{ question: triviaQuestion.trim(), text: triviaQuestion.trim(), options: triviaOptions.filter(o => o.trim()), correctIndex: triviaCorrect }] }
      : null),
    [cardType, triviaQuestion, triviaOptions, triviaCorrect],
  )

  const validate = () => {
    if (cardType === 'personal') {
      if (!heading.trim()) return 'Please add a heading.'
      if (!body.trim()) return 'Please add a message.'
    } else if (cardType === 'poll') {
      if (!pollQuestion.trim()) return 'Please add a poll question.'
      if (pollOptions.filter(o => o.trim()).length < 2) return 'Please add at least 2 options.'
    } else if (cardType === 'chain') {
      if (!chainChallenge.trim()) return 'Please add a challenge prompt.'
    } else if (cardType === 'trivia') {
      if (!triviaQuestion.trim()) return 'Please add a trivia question.'
      if (triviaOptions.filter(o => o.trim()).length < 2) return 'Add at least 2 answer options.'
    } else if (cardType === 'anonymous') {
      if (!anonMessage.trim()) return 'Please add a message.'
    }
    return null
  }

  // Called when user clicks "Create Card →"
  const handleSendClick = () => {
    setError(null)
    const err = validate()
    if (err) { setError(err); return }
    // 6.8: no account is required to build a card -- only to send it. The
    // in-progress card is untouched here because AuthModal is an overlay
    // (MainLayout.jsx), not a route change, so this component never unmounts.
    if (!currentUser) {
      openAuthModal?.()
      return
    }
    setSendResult(null)
    // Always show the receipt first, even for free sends — same as the
    // Studio, so the tier/cost breakdown is never skipped silently.
    setShowSendModal(true)
    trackEvent('create_flow_step', { step: 'reached_review', path: 'quick', type: cardType })
  }

  // `overrides` lets a caller pass freshly-built content straight through
  // instead of waiting on setState to flush.
  const handleSend = async (overrides = {}) => {
    // Last-resort guard -- handleSendClick is the primary gate, but this is
    // also reachable directly from the "Try Again" button.
    if (!currentUser) { openAuthModal?.(); return }
    setIsSending(true)
    try {
      const cardObject = overrides.cardObject || buildCardObject()
      const sourcePollOptions = overrides.pollOptions || pollOptions
      const sourceTriviaOptions = overrides.triviaOptions || triviaOptions
      const sourceTier = overrides.tier || cardTier

      const cloudImages = []
      for (let i = 0; i < images.length; i++) {
        if (images[i].file) {
          try {
            const cloudUrl = await uploadToCloudinary(images[i].file, 'image')
            cloudImages.push(cloudUrl)
          } catch (err) {
            setSendResult({ ok: false, message: 'Failed to upload images. Your draft is safe — try again.' })
            setIsSending(false)
            return
          }
        } else {
          cloudImages.push(null)
        }
      }

      if (cardObject.media?.images) {
        cardObject.media.images.forEach((img, idx) => {
          if (cloudImages[idx]) {
            img.url = cloudImages[idx]
          }
        })
      }

      const pollData = cardType === 'poll'
        ? { question: pollQuestion.trim(), options: sourcePollOptions.filter(o => o.trim()) }
        : undefined
      const chainData = cardType === 'chain'
        ? { prompt: chainChallenge.trim() }
        : undefined
      const triviaData = cardType === 'trivia'
        ? {
            questions: [{
              question: triviaQuestion.trim(),
              text: triviaQuestion.trim(),
              options: sourceTriviaOptions.filter(o => o.trim()),
              correctIndex: triviaCorrect,
            }],
          }
        : undefined

      const result = await createCardOnBackend(cardObject, {
        type: cardType,
        tier: sourceTier,
        poll: pollData,
        chain: chainData,
        trivia: triviaData,
        anonTemplate: cardType === 'anonymous' ? {} : undefined,
        creationPath: 'quick',
        templateId: templateId || null,
      })

      if (!result.ok) {
        setSendResult({ ok: false, message: (result.message ? `${result.message} ` : 'Card creation failed. ') + 'Your draft is safe — try again.' })
        return
      }

      // Phase 2.2: the create-card response contract puts `slug` at the top
      // level -- see the matching fix/comment in CardStudio.jsx.
      const d = result.data
      let slug = d?.slug || null
      if (!slug) {
        slug = d?.card?.slug || d?.renderModel?.slug || null
        if (slug) {
          console.warn('[QuickCreate] Card creation response had no top-level `slug` -- fell back to card.slug/renderModel.slug. Report this response shape:', JSON.stringify(d))
        }
      }

      let finalMessage = result.message

      // Attach gift if selected
      if (selectedGiftId && selectedGiftId !== 'none') {
        const gift = inventory.find((g, i) => {
          const instanceId = g.id || `${g.inventoryId || g.giftId || g.effectKey || g.title}-${i}`
          return instanceId === selectedGiftId
        })
        if (gift) {
          try {
            const cardId = d?.card?.cardId || d?.cardId || d?.card?.id || d?.id || slug
            const backendGiftId = gift.inventoryId || gift.giftId || gift._id || gift.id || ''
            await attachGiftToCard({
              cardId: cardId,
              giftId: backendGiftId,
              giftInventoryId: backendGiftId,
              giftName: gift.giftName || gift.name || effectKeyToGiftName(gift.effectKey),
              effectKey: gift.effectKey,
              amount: gift.amount || ''
            })
          } catch (err) {
            finalMessage = `Card created, but we failed to attach the gift: ${err.message || 'Unknown error'}. Please try again or check your inventory.`
          }
        }
      }

      setSendResult({ ok: true, slug, message: finalMessage })
      // 6.1: "instrument both paths -- entry, step completion, send." The
      // reached_review step only proves the sender opened the receipt, not
      // that they actually sent -- they can still cancel from there.
      trackEvent('create_flow_step', { step: 'sent', path: 'quick', type: cardType, tier: sourceTier })
    } catch (err) {
      setSendResult({ ok: false, message: 'Something went wrong. Your draft is safe — try again.' })
    } finally {
      setIsSending(false)
    }
  }

  const closeSendModal = () => {
    if (isSending) return
    setShowSendModal(false)
    setSendResult(null)
  }

  const openInStudio = () => {
    const cardObject = buildCardObject()
    navigate(`/studio?type=${cardType}`, {
      state: { draftCardObject: cardObject },
    })
  }

  const handleSaveReminder = async () => {
    if (!reminderRecipientName.trim() || !reminderDate) return
    setSavingReminder(true)
    try {
      await createReminder({
        recipientName: reminderRecipientName.trim(),
        occasion: reminderOccasion,
        date: reminderDate,
        lastCardId: sendResult?.slug || null,
      })
      setReminderSaved(true)
    } catch {
      // Non-critical -- the card already sent successfully either way.
    } finally {
      setSavingReminder(false)
    }
  }

  const handleShareAnonImage = async () => {
    if (!currentUser?.username) return
    setSharingAnonImage(true)
    setAnonImageError('')
    try {
      // fontFamily is deliberately omitted -- "prompt text in the display
      // serif" names Cardora's own fixed brand serif (the default), not
      // whichever font the sender picked for their card body.
      const blob = await generateAnonShareImage({
        prompt: anonMessage.trim(),
        username: currentUser.username,
        colors: { background: selectedPalette.surface, accent: selectedPalette.primary },
      })
      await shareOrDownloadAnonImage(blob, `cardora-ask-${currentUser.username}.png`)
    } catch (err) {
      setAnonImageError(err.message || 'Could not generate the share image.')
    } finally {
      setSharingAnonImage(false)
    }
  }

  const cardLink = sendResult?.slug ? `${window.location.origin}/card/${sendResult.slug}` : null
  // 6.5: there's no real delivery/addressing mechanism for "send one back"
  // beyond this same generic share row every Quick Create success screen
  // already has -- just a reply-flavoured share message instead of the
  // generic one.
  const shareText = replyTo
    ? `Sending one back to you${replySender ? `, ${replySender}` : ''}!`
    : 'Check out this card I made on Cardora'
  const s3 = STEP3_CONFIG[cardType] || STEP3_CONFIG.personal
  const bal = balance ?? 0

  const previewHeading = cardType === 'poll' ? pollQuestion
    : cardType === 'chain' ? chainChallenge
    : cardType === 'trivia' ? triviaQuestion
    : cardType === 'anonymous' ? anonMessage
    : heading
  const previewBody = cardType === 'personal' ? body
    : cardType === 'poll' ? pollOptions.filter(o => o.trim()).join(' · ')
    : ''

  const visiblePalettes = PALETTES.slice(0, PALETTE_INITIAL_COUNT)

  const isLowBalance = tierCost > 0 && bal < tierCost

  return (
    <div className="qc-shell">
      {/* Topbar */}
      <div className="qc-topbar">
        <button type="button" className="qc-back" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>

        <div className="qc-topbar-center">
          <span className="qc-topbar-title">Quick Create</span>
          <div className="qc-topbar-badges">
            <span className="qc-badge-type">{TYPE_LABEL[cardType] || cardType}</span>
          </div>
        </div>

        <div className="qc-topbar-right">
          <span className="qc-cc-balance-chip" title="Your CC balance">◈ {bal} CC</span>
          <TierMeter tier={cardTier} cost={tierCost} reasons={tierRequirement.reasons} compact />
          <button type="button" className="qc-studio-link-btn" onClick={openInStudio}>
            <span className="qc-studio-text">Full Studio</span>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="qc-body">
        <div className="qc-split">

          {/* ── Form pane ── */}
          <div className="qc-form-pane">

            {/* Mobile-only live preview */}
            <div className="qc-mobile-preview">
              <p className="qc-preview-label">Live Preview</p>
              <CardMiniPreview
                palette={selectedPalette}
                font={selectedFont}
                heading={previewHeading}
                body={previewBody}
                image={images[0]?.blobUrl}
                onOpen={() => setShowPreview(true)}
              />
            </div>

            {/* Step 1: Theme */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">1</span>
                <div>
                  <h3 className="qc-step-title">Choose a Theme</h3>
                  <p className="qc-step-sub">A few quick picks — open Studio for the full {PALETTES.length}-theme library.</p>
                </div>
              </div>
              <div className="qc-palette-grid">
                {visiblePalettes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`qc-palette-swatch${selectedPalette.id === p.id ? ' active' : ''}`}
                    onClick={() => setSelectedPalette(p)}
                    title={p.label}
                  >
                    <div
                      className="qc-swatch-bg"
                      style={{ background: `linear-gradient(145deg, ${p.surface} 30%, ${p.primary}55 100%)` }}
                    />
                    <div className="qc-swatch-dots">
                      <span style={{ background: p.primary }} />
                      <span style={{ background: p.accent }} />
                      <span style={{ background: p.ink, opacity: 0.7 }} />
                    </div>
                    {p.tier !== 'classic' && (
                      <span className="qc-swatch-tier"><TierPip tier={p.tier} compact /></span>
                    )}
                    <span className="qc-swatch-name">{p.label}</span>
                    {selectedPalette.id === p.id && <span className="qc-swatch-check">✓</span>}
                  </button>
                ))}
                {/* Lives as its own grid cell — matching the swatches' size
                    and visual weight — instead of a plain text link floating
                    below the grid. Hands off to Studio (the full library)
                    rather than expanding this page into theme-browsing. */}
                <button type="button" className="qc-palette-swatch qc-palette-more" onClick={openInStudio}>
                  {/* 7.4: "+18" alone reads as an age rating, not a theme count. */}
                  <span className="qc-palette-more-num">{PALETTES.length - PALETTE_INITIAL_COUNT} more</span>
                  <span className="qc-swatch-name">See all in Studio</span>
                </button>
              </div>
            </section>

            {/* Step 2: Font */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">2</span>
                <div>
                  <h3 className="qc-step-title">Font Style</h3>
                  <p className="qc-step-sub">How your words will look</p>
                </div>
              </div>
              <div className="qc-font-strip">
                {QUICK_FONTS.map((f) => {
                  const ft = fontTier(f.value)
                  return (
                    <button
                      key={f.value}
                      type="button"
                      className={`qc-font-chip${selectedFont === f.value ? ' active' : ''}`}
                      onClick={() => setSelectedFont(f.value)}
                      title={f.label}
                    >
                      <span className="qc-font-chip-sample" style={{ fontFamily: `'${f.value}', serif` }}>Aa</span>
                      <span className="qc-font-chip-label">{f.label}</span>
                      <span className="qc-font-chip-sub">{f.sample}</span>
                      {ft !== 'classic' && (
                        <span className="qc-font-tier-badge"><TierPip tier={ft} compact /></span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Step 3: Content */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">3</span>
                <div>
                  <h3 className="qc-step-title">{s3.title}</h3>
                  <p className="qc-step-sub">{s3.sub}</p>
                </div>
              </div>

              {cardType === 'personal' && (
                <div className="qc-fields">
                  {replyTo && (
                    <p className="qc-reply-banner">↩ Replying to {replySender || 'their card'}</p>
                  )}
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Heading</label>
                      <span className="qc-char-count">{heading.length}/200</span>
                    </div>
                    <input
                      type="text"
                      placeholder="A short, memorable heading…"
                      value={heading}
                      onChange={e => setHeading(e.target.value)}
                      maxLength={200}
                      style={{ fontFamily: `'${selectedFont}', serif` }}
                    />
                  </div>
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Message</label>
                      <span className="qc-char-count">{body.length}/4000</span>
                    </div>
                    <textarea
                      rows={5}
                      placeholder="Write what you want to say…"
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      maxLength={4000}
                    />
                  </div>
                </div>
              )}

              {cardType === 'poll' && (
                <div className="qc-fields">
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Question</label>
                      <span className="qc-char-count">{pollQuestion.length}/500</span>
                    </div>
                    <input
                      type="text"
                      placeholder="What do you want to ask?"
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                  <div className="qc-poll-options">
                    <label className="qc-poll-options-label">Options</label>
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="qc-poll-option-row">
                        <span className="qc-poll-option-letter">{String.fromCharCode(65 + i)}</span>
                        <input
                          type="text"
                          placeholder={`Option ${i + 1}…`}
                          value={opt}
                          onChange={e => updatePollOption(i, e.target.value)}
                          maxLength={300}
                        />
                        {pollOptions.length > 2 && (
                          <button type="button" className="qc-poll-remove" onClick={() => removePollOption(i)}>✕</button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 6 && (
                      <button type="button" className="qc-poll-add" onClick={addPollOption}>+ Add option</button>
                    )}
                  </div>
                </div>
              )}

              {cardType === 'chain' && (
                <div className="qc-fields">
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Challenge Prompt</label>
                      <span className="qc-char-count">{chainChallenge.length}/600</span>
                    </div>
                    <textarea
                      rows={4}
                      placeholder="Write a challenge for your recipient to respond to…"
                      value={chainChallenge}
                      onChange={e => setChainChallenge(e.target.value)}
                      maxLength={600}
                    />
                  </div>
                  <p className="qc-type-hint">Recipients will be invited to create and send a card back to you.</p>
                </div>
              )}

              {cardType === 'trivia' && (
                <div className="qc-fields">
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Question</label>
                      <span className="qc-char-count">{triviaQuestion.length}/500</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Ask a trivia question…"
                      value={triviaQuestion}
                      onChange={e => setTriviaQuestion(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                  <div className="qc-trivia-options">
                    <label className="qc-poll-options-label">
                      Answers <span className="qc-optional">tap the radio to mark the correct answer</span>
                    </label>
                    {triviaOptions.map((opt, i) => (
                      <div key={i} className={`qc-trivia-option-row${triviaCorrect === i ? ' correct' : ''}`}>
                        <button
                          type="button"
                          className="qc-trivia-correct-btn"
                          onClick={() => setTriviaCorrect(i)}
                          title="Mark as correct answer"
                        >
                          {triviaCorrect === i ? '✓' : '○'}
                        </button>
                        <input
                          type="text"
                          placeholder={`Answer ${i + 1}…`}
                          value={opt}
                          onChange={e => updateTriviaOption(i, e.target.value)}
                          maxLength={300}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="qc-type-hint">Recipients see their score and correct answers at the end.</p>
                </div>
              )}

              {cardType === 'anonymous' && (
                <div className="qc-fields">
                  <div className="qc-field">
                    <div className="qc-field-header">
                      <label>Your Message</label>
                      <span className="qc-char-count">{anonMessage.length}/2000</span>
                    </div>
                    <textarea
                      rows={6}
                      placeholder="Recipients can reply to this card anonymously…"
                      value={anonMessage}
                      onChange={e => setAnonMessage(e.target.value)}
                      maxLength={2000}
                    />
                  </div>
                  <p className="qc-type-hint">Replies are completely anonymous — no names, no tracking.</p>
                </div>
              )}
            </section>

            {/* Step 4: Photos */}
            <section className="qc-step">
              <div className="qc-step-header">
                <span className="qc-step-num">4</span>
                <div>
                  <h3 className="qc-step-title">
                    Photos <span className="qc-optional">optional · up to {MAX_IMAGES}</span>
                  </h3>
                  <p className="qc-step-sub">Add a personal touch</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) addImageFile(e.target.files[0]); e.target.value = '' }}
              />
              {images.length > 0 ? (
                <div className="qc-img-grid">
                  {images.map((img, i) => (
                    <div key={i} className="qc-img-grid-item">
                      <img src={img.blobUrl} alt="" className="qc-img-grid-thumb" />
                      <button
                        type="button"
                        className="qc-img-grid-remove"
                        onClick={() => removeImage(i)}
                        title="Remove photo"
                      >✕</button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button
                      type="button"
                      className="qc-img-grid-add"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      <span>Add</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={`qc-dropzone${isDragOver ? ' drag-over' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="qc-dropzone-icon">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <path d="M14 4v14m-6-6 6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 22h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="qc-dropzone-text">Drop photos here or <span>browse</span></p>
                  <p className="qc-dropzone-hint">PNG, JPG, WEBP · up to {MAX_IMAGES} photos</p>
                </div>
              )}
            </section>

            {/* Step 5: Gift */}
            {cardType === 'personal' && cardTier === 'elite' && (
              <section className="qc-step">
                <div className="qc-step-header">
                  <span className="qc-step-num">5</span>
                  <div>
                    <h3 className="qc-step-title">
                      Gift <span className="qc-optional">optional</span>
                    </h3>
                    <p className="qc-step-sub">Attach an end-of-card surprise</p>
                  </div>
                </div>

                <div className="cs-gift-grid">
                  <button
                    type="button"
                    className={`cs-gift-option ${!selectedGiftId || selectedGiftId === 'none' ? 'active' : ''}`}
                    onClick={() => setSelectedGiftId('none')}
                  >
                    <span className="cs-gift-none-icon">?</span>
                    <span>No Gift</span>
                  </button>

                  {inventory.map((gift, idx) => {
                    const instanceId = gift.id || `${gift.inventoryId || gift.giftId || gift.effectKey || gift.title}-${idx}`
                    return (
                      <button
                        key={instanceId}
                        type="button"
                        className={`cs-gift-option ${selectedGiftId === instanceId ? 'active' : ''}`}
                        onClick={() => setSelectedGiftId(instanceId)}
                      >
                        <GiftIcon effectKey={gift.effectKey} size={36} />
                        <span>{gift.title}</span>
                        {gift.amount && <small>{gift.amount}</small>}
                      </button>
                    )
                  })}
                </div>
                
                {inventory.length === 0 && (
                  <p className="qc-type-hint" style={{ marginTop: '0.75rem' }}>
                    No gifts in your inventory. <Link to="/store">Visit the Store</Link> to purchase gifts.
                  </p>
                )}
              </section>
            )}

            {/* Submit */}
            <div className="qc-submit-area">
              {error && <p className="qc-error">{error}</p>}
              {isLowBalance && (
                <p className="qc-error">
                  You need {tierCost} CC to send this card. Your balance: {bal} CC.{' '}
                  <Link to="/store">Top up →</Link>
                </p>
              )}
              <button
                type="button"
                className={`qc-submit-btn type-${cardType}`}
                disabled={isSending || isLowBalance}
                onClick={handleSendClick}
              >
                {tierCost > 0 ? `Create Card (${tierCost} CC) →` : 'Create Card →'}
              </button>
              <p className="qc-studio-hint">
                Want layers, music & full control?{' '}
                <button type="button" className="qc-studio-hint-link" onClick={openInStudio}>
                  Open Full Studio →
                </button>
              </p>
            </div>
          </div>

          {/* ── Preview pane (desktop only) ── */}
          <div className="qc-preview-pane">
            <div className="qc-preview-wrap">
              <p className="qc-preview-label">Live Preview</p>
              <CardMiniPreview
                palette={selectedPalette}
                font={selectedFont}
                heading={previewHeading}
                body={previewBody}
                image={images[0]?.blobUrl}
                large
                onOpen={() => setShowPreview(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 7.5: the real envelope/open/effects reveal, not a second mockup --
          same component the actual recipient sees. */}
      {showPreview && (
        <CardPreviewModal
          cardObject={previewCardObject}
          studioType={cardType}
          tier={cardTier}
          tierLimits={previewTierLimits}
          pollData={previewPollData}
          triviaData={previewTriviaData}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ── Send Modal (portal) ── mirrors CardStudio cs-send-modal ── */}
      {showSendModal && createPortal(
        <div className="cs-send-modal-overlay" onClick={closeSendModal}>
          <div className="cs-send-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-send-modal-header">
              <div className="cs-send-modal-header-left">
                <span className="cs-send-modal-eyebrow">{TYPE_LABEL[cardType] || 'Card'} · {cardTier.charAt(0).toUpperCase() + cardTier.slice(1)}</span>
                <h3>
                  {sendResult?.ok ? 'Your card is ready to share!'
                    : isSending ? 'Creating your card…'
                    : 'Confirm & Create'}
                </h3>
              </div>
              <button
                type="button"
                className="cs-send-modal-close"
                aria-label="Close"
                disabled={isSending}
                onClick={closeSendModal}
              >×</button>
            </div>

            {/* Send receipt: what's on this card, what it costs, why */}
            {!isSending && !sendResult && (
              <SendReceipt
                reasons={tierRequirement.reasons}
                tier={cardTier}
                cost={tierCost}
                tierFloor={getTierCost(cardTier, cardType, cardPrices)}
                surcharges={featureSurchargeBreakdown}
                balance={bal}
                sending={isSending}
                onSend={handleSend}
                onCancel={closeSendModal}
              />
            )}

            {/* Loading */}
            {isSending && (
              <div className="cs-send-loading">
                <div className="chat-loading-spinner" />
                <p>Creating your card…</p>
              </div>
            )}

            {/* CC deducted / free notice */}
            {!isSending && sendResult?.ok && tierCost > 0 && (
              <div className="cs-send-modal-cc-deducted">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span><strong>{tierCost} CC</strong> deducted from your balance</span>
              </div>
            )}
            {!isSending && sendResult?.ok && tierCost === 0 && (
              <div className="cs-send-modal-cc-deducted free">
                <span className="cs-send-modal-cc-icon">✓</span>
                <span>Created free — Classic tier</span>
              </div>
            )}

            {/* Error */}
            {!isSending && sendResult && !sendResult.ok && (
              <p className="cs-send-modal-note" style={{ color: '#ffb4b4' }}>
                {sendResult.message || 'Something went wrong. Please try again.'}
              </p>
            )}

            {/* Success: slug + sharing */}
            {!isSending && sendResult?.ok && (
              <div className="cs-send-link-wrap">
                <p className="cs-send-link-label">Your unique card link</p>
                {cardLink ? (
                  <>
                    <span className="detail-share-link-pill cs-send-link-pill">
                      {cardLink.replace(/^https?:\/\//, '')}
                    </span>
                    <button
                      type="button"
                      className={`detail-share-copy-btn${sendCopied ? ' copied' : ''}`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(cardLink)
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
                    Card created — link not returned yet. Visit your{' '}
                    <Link to="/profile" onClick={closeSendModal}>Profile</Link> to find it.
                  </p>
                )}
              </div>
            )}

            {/* Social sharing */}
            {!isSending && sendResult?.ok && cardLink && (
              <>
                <p className="detail-share-label">Share via</p>
                <div className="detail-share-platforms cs-send-modal-platforms">
                  {SHARE_PLATFORMS.map((p) => (
                    <a
                      key={p.id}
                      href={p.getUrl(cardLink, shareText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="detail-share-platform-btn"
                      style={{ '--platform-color': p.color }}
                    >
                      {p.icon}
                      <span>{p.label}</span>
                    </a>
                  ))}
                  {navigator.share && (
                    <button
                      type="button"
                      className="detail-share-platform-btn"
                      style={{ '--platform-color': 'rgba(118,239,255,0.7)' }}
                      onClick={async () => {
                        try {
                          await navigator.share({ title: 'Cardora Card', text: shareText, url: cardLink })
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

            {/* 6.6: "Share to status" -- a themed 1080x1920 image for the
                durable /ask/:username inbox link, generated fresh on demand. */}
            {!isSending && sendResult?.ok && cardType === 'anonymous' && currentUser?.username && (
              <div className="qc-anon-share-block">
                <button
                  type="button"
                  className="qc-anon-share-btn"
                  disabled={sharingAnonImage}
                  onClick={handleShareAnonImage}
                >
                  {sharingAnonImage ? 'Preparing image…' : 'Share to status'}
                </button>
                {anonImageError && <p className="qc-error">{anonImageError}</p>}
              </div>
            )}

            {/* 6.2: optional occasion reminder, personal cards only */}
            {!isSending && sendResult?.ok && cardType === 'personal' && (
              <div className="qc-reminder-block">
                {reminderSaved ? (
                  <p className="qc-reminder-saved">✓ We'll remind you 5 days before.</p>
                ) : (
                  <>
                    <p className="cs-send-link-label">Set a reminder for next year (optional)</p>
                    <div className="qc-reminder-fields">
                      <input
                        type="text"
                        placeholder="Who's this for?"
                        value={reminderRecipientName}
                        onChange={(e) => setReminderRecipientName(e.target.value)}
                      />
                      <select value={reminderOccasion} onChange={(e) => setReminderOccasion(e.target.value)}>
                        {EXPLORE_OCCASION_TABS.map((occ) => <option key={occ} value={occ}>{occ}</option>)}
                      </select>
                      <input
                        type="date"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                      />
                      <button
                        type="button"
                        className="ghost"
                        onClick={handleSaveReminder}
                        disabled={savingReminder || !reminderRecipientName.trim() || !reminderDate}
                      >
                        {savingReminder ? 'Saving…' : 'Remind me'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Email row */}
            {!isSending && sendResult?.ok && (
              <div className="cs-send-modal-email-row">
                <p className="cs-send-link-label">Send via Email</p>
                <div className="cs-send-modal-email-input-wrap">
                  <input
                    type="email"
                    className="cs-send-modal-email-input"
                    placeholder="recipient@email.com"
                    value={sendEmail}
                    onChange={e => setSendEmail(e.target.value)}
                  />
                  <a
                    className="cs-nav-btn accent"
                    href={`mailto:${encodeURIComponent(sendEmail)}?subject=${encodeURIComponent("You've got a Cardora card!")}&body=${encodeURIComponent(`Check out this card I made for you on Cardora:\n\n${cardLink || ''}`)}`}
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

            {/* Bottom actions after success */}
            {!isSending && sendResult?.ok && (
              <div className="cs-send-confirm-actions" style={{ marginTop: 4 }}>
                <button type="button" className="cs-send-confirm-cancel" onClick={() => navigate('/profile')}>
                  Go to Profile
                </button>
                <button type="button" className="cs-send-confirm-btn" onClick={() => navigate('/create')}>
                  Create Another
                </button>
              </div>
            )}

            {/* Retry after error */}
            {!isSending && sendResult && !sendResult.ok && (
              <div className="cs-send-confirm-actions" style={{ marginTop: 4 }}>
                <button type="button" className="cs-send-confirm-cancel" onClick={closeSendModal}>Close</button>
                <button type="button" className="cs-send-confirm-btn" onClick={handleSend}>Try Again</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Extracted mini-card preview — used in both mobile and desktop panes
// 7.5: "Open Card" genuinely opens the real reveal (CardPreviewModal) now,
// not a static mockup label -- this thumbnail is a launcher for it, not
// the preview experience itself.
function CardMiniPreview({ palette, font, heading, body, image, large = false, onOpen }) {
  return (
    <button
      type="button"
      className={`qc-card-mini${large ? ' large' : ''}`}
      onClick={onOpen}
      style={{
        backgroundColor: palette.surface,
        borderColor: `${palette.primary}30`,
        boxShadow: `0 ${large ? 24 : 16}px ${large ? 64 : 48}px rgba(0,0,0,0.4), 0 0 0 1px ${palette.primary}18`,
      }}
    >
      <div className="qc-mini-header">
        <span className="qc-mini-seal" style={{ background: palette.primary }} />
        <span className="qc-mini-brand" style={{ color: palette.ink }}>Cardora</span>
      </div>
      {image && (
        <div className="qc-mini-img-wrap">
          <img src={image} alt="" className="qc-mini-img" />
        </div>
      )}
      <h3
        className="qc-mini-heading"
        style={{ fontFamily: `'${font}', serif`, color: palette.primary }}
      >
        {heading || 'Your heading here'}
      </h3>
      <p
        className="qc-mini-body"
        style={{ fontFamily: `'${font}', sans-serif`, color: palette.ink }}
      >
        {body || 'Your message will appear here…'}
      </p>
      <div className="qc-mini-footer" style={{ borderTopColor: `${palette.primary}22` }}>
        <span className="qc-mini-btn" style={{ background: palette.primary, color: palette.surface }}>
          Open Card
        </span>
      </div>
    </button>
  )
}

export default QuickCreate
