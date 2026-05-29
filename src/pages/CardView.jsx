import { useEffect, useState } from 'react'
import { useNavigate, useParams, useOutletContext } from 'react-router-dom'
import { getCardBySlug, submitCardResponse, submitPollVote, submitTriviaAnswer, submitChainReply, sendCardAnonymousMessage } from '../lib/api.js'
import { mapBackendCard } from '../lib/backendMappers.js'
import CardPreviewModal from '../components/CardPreviewModal.jsx'
import ReportModal from '../components/ReportModal.jsx'
import { backfillEnvelope, defaultCardObject } from '../data/cardDefaults.js'

function CardView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, openAuthModal, refreshBalance } = useOutletContext() || {}
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await getCardBySlug(id)
        if (cancelled) return

        const candidates = [
          res?.card, res?.data?.card,
          res?.renderModel, res?.data?.renderModel,
          res?.payload?.card, res?.payload,
          res?.result?.card, res?.result,
          res?.data, res,
        ]
        const isCardLike = (c) =>
          c && typeof c === 'object' && !Array.isArray(c) &&
          (c.slug || c._id || c.cardId || c.id ||
           c.config || c.title ||
           c.layoutdata || c.layoutData ||
           c.visuals || c.content || c.type)

        const backendCard = candidates.find(isCardLike)
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
          if (mapped.locked && mapped.lockType === 'password') setNeedsPassword(true)
          setLoading(false)
          return
        }

        console.warn('[CardView] Unrecognised response shape:', JSON.stringify(res)?.slice(0, 400))
        setFetchError('Card data format unrecognised')
      } catch (err) {
        if (err.status === 403 || err.payload?.locked) {
          setNeedsPassword(true)
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

  useEffect(() => {
    const title = card?.title ? `${card.title} | Cardora` : 'You have a surprise... | Cardora'
    const description = card ? 'Someone sent you something made to be opened, not just viewed.' : 'You have a surprise waiting on Cardora.'
    const image = `${window.location.origin}/cardora-logo.png?v=4`
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
        setNeedsPassword(false)
      }
    } catch (err) {
      setPasswordError(err.message || 'Incorrect password.')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cv-page-loading">
        <div className="cv-logo-loader">
          <img src="/cardora-logo.png?v=4" alt="" />
        </div>
        <p>Preparing your surprise</p>
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
          <p>Enter the password to open this card.</p>
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
    const payload = { response: message }
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

  return (
    <>
      <CardPreviewModal
        cardObject={cardObject}
        onClose={() => navigate('/')}
        tier={card.tier || 'classic'}
        studioType={studioType}
        cardTitle={card.title || ''}
        recipientEmail={card.recipient || card.recipientEmail || ''}
        pollData={pollData}
        triviaData={triviaData}
        pageMode={true}
        onPollSubmit={handlePollSubmit}
        onTriviaComplete={handleTriviaComplete}
        onChainReply={handleChainReply}
        onAnonSubmit={handleAnonSubmit}
        chainState={card._chainState}
        cardId={card.slug || card.id || id}
        senderName={card.senderName || card.sender || card.creatorName || ''}
        currentUser={currentUser}
        openAuthModal={openAuthModal}
        refreshBalance={refreshBalance}
      />
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
