import { useEffect, useState } from 'react'
import { useNavigate, useParams, useOutletContext } from 'react-router-dom'
import { getCardBySlug, submitCardResponse, submitPollVote, submitTriviaAnswer, submitChainReply, sendCardAnonymousMessage, reactToCard, notifyMeForScheduledCard } from '../lib/api.js'
import { mapBackendCard } from '../lib/backendMappers.js'
import CardPreviewModal from '../components/CardPreviewModal.jsx'
import ReportModal from '../components/ReportModal.jsx'
import { backfillEnvelope, defaultCardObject } from '../data/cardDefaults.js'

// 6.3: renders the "Xd Yh" / "Zm" countdown on the scheduled-send gate.
function formatCountdown(ms) {
  if (ms <= 0) return 'Unlocking any moment now…'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts = []
  if (days) parts.push(`${days}d`)
  if (days || hours) parts.push(`${hours}h`)
  if (!days) parts.push(`${minutes}m`)
  return `Unlocks in ${parts.join(' ')}`
}

function CardView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, openAuthModal, refreshBalance } = useOutletContext() || {}
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [lockHint, setLockHint] = useState('')
  const [isRevoked, setIsRevoked] = useState(false)
  const [alreadyOpenedElsewhere, setAlreadyOpenedElsewhere] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledUnlockAt, setScheduledUnlockAt] = useState(null)
  const [countdownText, setCountdownText] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifySubmitting, setNotifySubmitting] = useState(false)
  const [notifySubmitted, setNotifySubmitted] = useState(false)
  const [notifyError, setNotifyError] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showReport, setShowReport] = useState(false)
  // The backend's render-model `interaction` block — real server-side vote
  // tallies / already-voted / already-answered state, keyed to this viewer's
  // account or guest id. Kept separate from `card` since it lives on
  // `res.renderModel`, not `res.card`.
  const [interaction, setInteraction] = useState(null)
  const [reactions, setReactions] = useState(null)
  // 5.1: api/card-meta.js now server-renders a real gate (sender name, card
  // title, Open Card button) for every request, not just bots, and embeds
  // this global for the client to pick up on mount so the very first paint
  // matches the server HTML with zero flash. Read-and-delete once -- a
  // client-side navigation to a *different* card slug later in the same
  // session must not reuse this page load's stale embed, which is also why
  // it's ignored outright if the embedded slug doesn't match this route.
  const [ssrGate] = useState(() => {
    if (typeof window === 'undefined') return null
    const data = window.__CARDORA_SSR_CARD__
    delete window.__CARDORA_SSR_CARD__
    if (!data || (data.slug && data.slug !== id)) return null
    return data
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await getCardBySlug(id)
        if (cancelled) return

        // Phase 2.2/2.3: GET /cards/:slug's response contract is always
        // {message, card, renderModel} (backend cardController.js
        // getCardBySlug) -- res.card is the one real path. The broader
        // envelope scan below is a fallback for a contract violation, not
        // the normal case, and warns loudly if it ever actually fires.
        const isCardLike = (c) =>
          c && typeof c === 'object' && !Array.isArray(c) &&
          (c.slug || c._id || c.cardId || c.id ||
           c.config || c.title ||
           c.layoutdata || c.layoutData ||
           c.visuals || c.content || c.type)

        let backendCard = isCardLike(res?.card) ? res.card : null
        if (!backendCard) {
          const fallbackCandidates = [
            res?.data?.card,
            res?.renderModel, res?.data?.renderModel,
            res?.payload?.card, res?.payload,
            res?.result?.card, res?.result,
            res?.data, res,
          ]
          backendCard = fallbackCandidates.find(isCardLike) || null
          if (backendCard) {
            console.warn('[CardView] GET /cards/:slug response had no `card` field at the top level -- fell back to a legacy envelope shape. Report this response shape:', JSON.stringify(res)?.slice(0, 400))
          }
        }
        if (backendCard) {
          const cardWithSidecars = {
            ...backendCard,
            giftAttachment: backendCard.giftAttachment || backendCard.gift_attachment || backendCard.gift || backendCard.attachedGift || backendCard.attached_gift || res?.giftAttachment || res?.gift_attachment || res?.data?.giftAttachment || res?.data?.gift_attachment || res?.payload?.giftAttachment || res?.payload?.gift_attachment || res?.gift || res?.data?.gift || res?.payload?.gift || res?.attachedGift || res?.attached_gift || res?.data?.attachedGift || res?.data?.attached_gift || res?.payload?.attachedGift || res?.payload?.attached_gift,
            gift: backendCard.gift || backendCard.gift_data || res?.gift || res?.gift_data || res?.data?.gift || res?.data?.gift_data || res?.payload?.gift || res?.payload?.gift_data,
            attachedGift: backendCard.attachedGift || backendCard.attached_gift || res?.attachedGift || res?.attached_gift || res?.data?.attachedGift || res?.data?.attached_gift || res?.payload?.attachedGift || res?.payload?.attached_gift,
          }
          const mapped = mapBackendCard(cardWithSidecars)
          // Preserve raw state for chain replies feed
          mapped._chainState = backendCard.state || res?.state || null
          setCard(mapped)
          setInteraction(res?.renderModel?.interaction || res?.data?.renderModel?.interaction || null)
          setReactions(res?.renderModel?.reactions || res?.data?.renderModel?.reactions || null)
          if (mapped.locked && mapped.lockType === 'password') setNeedsPassword(true)
          setLoading(false)
          return
        }

        console.warn('[CardView] Unrecognised response shape:', JSON.stringify(res)?.slice(0, 400))
        setFetchError('Card data format unrecognised')
      } catch (err) {
        // 6.3: scheduled send is also a 403, but a distinct one (no `locked`
        // field) -- must be checked before the generic password-lock branch
        // below, or every scheduled-and-not-yet-due card would incorrectly
        // render the password gate instead of the countdown/notify-me screen.
        if (err.payload?.scheduled) {
          setIsScheduled(true)
          setScheduledUnlockAt(err.payload?.unlockAt || null)
          setLoading(false)
          if (!cancelled) return
        }
        if (err.status === 403 || err.payload?.locked) {
          setNeedsPassword(true)
          setLockHint(err.payload?.lockHint || '')
          setLoading(false)
          if (!cancelled) return
        }
        if (err.payload?.revoked) {
          setIsRevoked(true)
          setLoading(false)
          if (!cancelled) return
        }
        if (err.payload?.alreadyOpened) {
          setAlreadyOpenedElsewhere(true)
          setLoading(false)
          if (!cancelled) return
        }
        console.warn('[CardView] Fetch failed:', err.status, err.message)
        setFetchError(err.status ? `${err.status} — ${err.message}` : err.message)
      }

      const stored = JSON.parse(localStorage.getItem('cardora:sentCards') || '[]')
      const match = stored.find((item) => item.id === id)
      if (match) {
        if (!cancelled) { setCard(match); setLoading(false) }
        return
      }
      if (!cancelled) { setCard(null); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id])

  // 6.3: ticks the scheduled-send countdown while the gate is showing.
  useEffect(() => {
    if (!isScheduled || !scheduledUnlockAt) return undefined
    const target = new Date(scheduledUnlockAt).getTime()
    const tick = () => setCountdownText(formatCountdown(target - Date.now()))
    tick()
    const interval = setInterval(tick, 30000)
    return () => clearInterval(interval)
  }, [isScheduled, scheduledUnlockAt])

  const handleNotifyMeSubmit = async () => {
    const trimmed = notifyEmail.trim()
    if (!trimmed) { setNotifyError('Enter an email address.'); return }
    setNotifySubmitting(true)
    setNotifyError('')
    try {
      await notifyMeForScheduledCard(id, trimmed)
      setNotifySubmitted(true)
    } catch (err) {
      setNotifyError(err.message || 'Could not save that email — try again.')
    } finally {
      setNotifySubmitting(false)
    }
  }

  useEffect(() => {
    // Kept as an in-app fallback for any link-preview generator that does
    // render JS (some do), but the meaningful fix for the standard
    // non-JS scrapers (Facebook/WhatsApp/Twitter/Discord/Slack) is
    // api/card-meta.js — see vercel.json's bot-only rewrite for /card/:slug.
    const typeCopy = {
      personal: { title: card?.title || 'You have a surprise', description: 'Someone sent you something made to be opened, not just viewed.' },
      poll: { title: card?.title || 'Cast your vote', description: 'Someone wants to know what you think — tap in to vote.' },
      trivia: { title: 'You have been challenged to a quiz', description: 'Think you know the answers? Open the card to find out.' },
      chain: { title: card?.title || 'A chain was started for you', description: 'Keep it going — read the challenge and add your reply.' },
      anonymous: { title: 'Send an anonymous message', description: '100% anonymous — nobody will know it was you.' },
    }
    const copy = typeCopy[card?.type] || typeCopy.personal
    const title = card ? `${copy.title} | Cardora` : 'You have a surprise... | Cardora'
    const description = card ? copy.description : 'You have a surprise waiting on Cardora.'
    const image = card?.layoutdata?.styleExtras?.ogImage || `${window.location.origin}/cardora-logo.png?v=4`
    const meta = [
      ['property', 'og:title', title],
      ['property', 'og:description', description],
      ['property', 'og:image', image],
      ['property', 'og:type', 'website'],
      ['property', 'og:url', window.location.href],
      ['name', 'twitter:card', 'summary_large_image'],
      ['name', 'twitter:title', title],
      ['name', 'twitter:description', description],
      ['name', 'twitter:image', image],
    ]
    document.title = title
    meta.forEach(([attr, key, content]) => {
      let tag = document.head.querySelector(`meta[${attr}="${key}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute(attr, key)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    })
    return () => {
      document.title = 'Cardora Studio'
    }
  }, [card])

  const handlePasswordSubmit = async () => {
    setPasswordError('')
    try {
      const res = await getCardBySlug(id, passwordInput)
      const backendCard = res?.card || res?.data?.card || res?.data || res
      if (backendCard) {
        setCard(mapBackendCard({
          ...backendCard,
          giftAttachment: backendCard.giftAttachment || backendCard.gift_attachment || backendCard.gift || backendCard.attachedGift || backendCard.attached_gift || res?.giftAttachment || res?.gift_attachment || res?.data?.giftAttachment || res?.data?.gift_attachment || res?.payload?.giftAttachment || res?.payload?.gift_attachment || res?.gift || res?.data?.gift || res?.payload?.gift || res?.attachedGift || res?.attached_gift || res?.data?.attachedGift || res?.data?.attached_gift || res?.payload?.attachedGift || res?.payload?.attached_gift,
          gift: backendCard.gift || backendCard.gift_data || res?.gift || res?.gift_data || res?.data?.gift || res?.data?.gift_data || res?.payload?.gift || res?.payload?.gift_data,
          attachedGift: backendCard.attachedGift || backendCard.attached_gift || res?.attachedGift || res?.attached_gift || res?.data?.attachedGift || res?.data?.attached_gift || res?.payload?.attachedGift || res?.payload?.attached_gift,
        }))
        setInteraction(res?.renderModel?.interaction || res?.data?.renderModel?.interaction || null)
        setReactions(res?.renderModel?.reactions || res?.data?.renderModel?.reactions || null)
        setNeedsPassword(false)
      }
    } catch (err) {
      setPasswordError(err.message || 'Incorrect password.')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    // 5.1: the server already painted this exact content before any JS
    // ran (see api/card-meta.js) — re-render it identically so there's no
    // flash while the real card fetch finishes in the background.
    if (ssrGate) {
      return (
        <div className="cv-page-loading cardora-ssr-gate">
          <img src="/cardora-logo.png?v=4" alt="Cardora" />
          <p className="cg-sender">{ssrGate.senderName || 'Someone'} sent you a card</p>
          <p className="cg-title">{ssrGate.title || 'Open to see what it is'}</p>
          <button className="cg-btn" type="button" disabled>Open Card</button>
        </div>
      )
    }
    // Generic fallback for the cases the server gate can't cover: a
    // client-side navigation into this route from elsewhere in the app
    // (the SPA shell is already warm, so a brief spinner is normal), or
    // the gate function failing to reach the backend in time. This is the
    // slow-connection path now, not the standard one.
    return (
      <div className="cv-page-loading">
        <div className="cv-logo-loader">
          <img src="/cardora-logo.png?v=4" alt="" />
        </div>
        <p>Preparing your surprise</p>
      </div>
    )
  }

  // ── Scheduled send: not open yet (6.3) ─────────────────────────────────
  if (isScheduled) {
    return (
      <div className="cv-page-gate">
        <div className="cv-gate-card">
          <span className="cv-gate-lock">⏳</span>
          <h2>This card isn't open yet</h2>
          <p>
            The sender scheduled it to unlock
            {scheduledUnlockAt ? ` on ${new Date(scheduledUnlockAt).toLocaleString()}` : ' soon'}.
          </p>
          {countdownText && <p className="cv-gate-countdown">{countdownText}</p>}
          {notifySubmitted ? (
            <p className="cv-gate-notify-done">We'll email you when it opens.</p>
          ) : (
            <div className="cv-gate-notify-form">
              <input
                type="email"
                value={notifyEmail}
                onChange={e => setNotifyEmail(e.target.value)}
                placeholder="you@example.com"
                className="cv-gate-input"
                onKeyDown={e => { if (e.key === 'Enter') handleNotifyMeSubmit() }}
              />
              {notifyError && <p className="auth-error">{notifyError}</p>}
              <button className="primary" type="button" disabled={notifySubmitting} onClick={handleNotifyMeSubmit}>
                {notifySubmitting ? 'Saving…' : 'Notify me when it opens'}
              </button>
            </div>
          )}
          <button className="ghost" type="button" onClick={() => navigate('/')}>
            Back Home
          </button>
        </div>
      </div>
    )
  }

  // ── Revoked (5.5: sender kill switch) ──────────────────────────────────
  if (isRevoked) {
    return (
      <div className="cv-page-gate">
        <div className="cv-gate-card">
          <span className="cv-gate-lock">🚫</span>
          <h2>This card was withdrawn</h2>
          <p>This card was withdrawn by the sender.</p>
        </div>
      </div>
    )
  }

  // ── Already opened elsewhere (5.5: first-open claim) ───────────────────
  if (alreadyOpenedElsewhere) {
    return (
      <div className="cv-page-gate">
        <div className="cv-gate-card">
          <span className="cv-gate-lock">✉️</span>
          <h2>Already opened</h2>
          <p>This card has already been opened by its recipient.</p>
        </div>
      </div>
    )
  }

  // ── Password gate (before card loads) ────────────────────────────────
  if (needsPassword && !card) {
    return (
      <div className="cv-page-gate">
        <div className="cv-gate-card">
          <span className="cv-gate-lock">🔒</span>
          <h2>This card is locked</h2>
          <p>{lockHint.trim() || 'Enter the password to open this card.'}</p>
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            placeholder="Password…"
            onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
            className="cv-gate-input"
          />
          {passwordError && <p className="auth-error">{passwordError}</p>}
          <button className="primary" type="button" onClick={handlePasswordSubmit}>
            Unlock Card
          </button>
          <button className="ghost" type="button" onClick={() => navigate('/')}>
            Back Home
          </button>
        </div>
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────
  if (!card) {
    return (
      <div className="cv-page-loading">
        <p style={{ color: 'rgba(220,242,247,0.7)', marginBottom: 8 }}>We could not find that card.</p>
        {fetchError && (
          <p style={{ fontSize: '0.78rem', opacity: 0.45, marginBottom: 20 }}>{fetchError}</p>
        )}
        <button className="primary" type="button" onClick={() => navigate('/')}>Back to home</button>
      </div>
    )
  }

  // ── Card found — derive cardObject ───────────────────────────────────
  const cardObject = backfillEnvelope(card.cardObject || structuredClone(defaultCardObject))
  if (card.giftEffect) {
    cardObject.giftEffect = card.giftEffect
  }
  const studioType = (card.type || 'personal').toLowerCase().replace('standard', 'personal').replace('moment', 'personal')
  const pollData = card.poll || null
  const triviaData = card.trivia || null

  // Backend submission callbacks
  const handlePollSubmit = async (optionId) => {
    const options = pollData?.options || []
    const optionIndex = options.findIndex(opt => (typeof opt === 'object' ? opt.id : opt) === optionId)
    const payload = optionId
      ? { optionId }
      : { optionIndex }
    try {
      await submitPollVote(card.slug || id, payload)
    } catch (e) {
      if (![404, 405].includes(e?.status)) throw e
      console.warn('Poll submit route missing, trying generic response endpoint', e)
      await submitCardResponse(card.slug || id, payload)
    }
  }
  const handleTriviaComplete = async (answers, name) => {
    // Calculate score: count how many answers match the correctIndex for each question
    const questions = triviaData?.questions || []
    const score = questions.reduce((acc, q, i) => {
      return acc + (Number(answers[i]) === Number(q.correctIndex) ? 1 : 0)
    }, 0)
    const payload = {
      answers,
      name: name || currentUser?.username || 'Anonymous',
      score,
      totalQuestions: questions.length,
    }
    try {
      await submitTriviaAnswer(card.slug || id, payload)
    } catch (e) {
      if (![404, 405].includes(e?.status)) throw e
      console.warn('Trivia submit route missing, trying generic response endpoint', e)
      await submitCardResponse(card.slug || id, payload)
    }
  }
  const handleChainReply = async (message, name) => {
    const payload = { response: message, name: name || currentUser?.username || 'Anonymous' }
    try {
      await submitChainReply(card.slug || id, payload)
    } catch (e) {
      if (![404, 405].includes(e?.status)) throw e
      console.warn('Chain reply route missing, trying generic response endpoint', e)
      await submitCardResponse(card.slug || id, payload)
    }
  }
  const handleAnonSubmit = async (message) => {
    await sendCardAnonymousMessage(card.slug || id, { message })
  }
  const handleQuestionResponse = async (answer) => {
    await submitCardResponse(card.slug || id, { answer })
  }
  const handleReact = async (emoji) => {
    const res = await reactToCard(card.slug || id, emoji)
    return { counts: res?.counts || res?.data?.counts, viewerReaction: res?.viewerReaction ?? res?.data?.viewerReaction ?? null }
  }

  return (
    <>
      <CardPreviewModal
        cardObject={cardObject}
        onClose={() => navigate('/')}
        tier={card.tier || 'classic'}
        studioType={studioType}
        cardTitle={card.title || ''}
        recipientEmail={card.recipient || card.recipientEmail || card.recipientEmailAddress || card.to || ''}
        pollData={pollData}
        triviaData={triviaData}
        pageMode={true}
        onPollSubmit={handlePollSubmit}
        onTriviaComplete={handleTriviaComplete}
        onChainReply={handleChainReply}
        onAnonSubmit={handleAnonSubmit}
        reactions={reactions}
        onReact={handleReact}
        onQuestionResponse={handleQuestionResponse}
        interaction={interaction}
        chainState={card._chainState}
        chainDelivered={!!card.chainDelivered}
        cardId={card.slug || card.id || id}
        senderName={card.senderName || card.sender || card.creatorName || ''}
        currentUser={currentUser}
        openAuthModal={openAuthModal}
        refreshBalance={refreshBalance}
      />
      {/* 5.5: "report on every card view" -- this had no trigger anywhere
          in this component before; showReport could only ever be set back
          to false. Works for a guest too (see reportRoutes.js's
          optionalAuth), since most recipients never make an account. */}
      <button
        type="button"
        className="cv-report-trigger"
        title="Report this card"
        aria-label="Report this card"
        onClick={() => setShowReport(true)}
      >
        &#9873; Report
      </button>
      {showReport && (
        <ReportModal
          type="card"
          targetId={card?.id || card?.slug || id}
          targetName={card?.title || ''}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  )
}

export default CardView
