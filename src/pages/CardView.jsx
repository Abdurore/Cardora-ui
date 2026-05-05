import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getTierInfo } from '../utils/tier.js'
import { getCardBySlug, submitCardResponse, submitPollVote, submitChainReply, submitTriviaAnswer } from '../lib/api.js'
import { mapBackendCard, layoutDataToCardObject } from '../lib/backendMappers.js'
import Envelope from '../components/Envelope.jsx'
import ReportModal from '../components/ReportModal.jsx'
import { backfillEnvelope, defaultCardObject } from '../data/cardDefaults.js'
import { shouldShowEnvelope } from '../lib/tierLimits.js'

const fallbackMusic =
  'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

function CardView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { openCardTypeModal } = useOutletContext() || {}
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [responseSubmitted, setResponseSubmitted] = useState(false)
  const [pollVotes, setPollVotes] = useState([])
  const [pollSubmitted, setPollSubmitted] = useState(false)
  const [chainInput, setChainInput] = useState('')
  const [chainSubmitted, setChainSubmitted] = useState(false)
  const [triviaAnswers, setTriviaAnswers] = useState([])
  const [triviaSubmitted, setTriviaSubmitted] = useState(false)
  const [triviaStepIdx, setTriviaStepIdx] = useState(0)
  const [interactionMsg, setInteractionMsg] = useState('')
  const [showReport, setShowReport] = useState(false)
  const audioRef = useRef(null)

  // Try loading from backend by slug
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await getCardBySlug(id)
        if (cancelled) return

        // Backend may wrap the card under `card`, `data.card`, `data`, or
        // return either the raw card or the renderModel directly. Try every
        // candidate and pick the first one that looks like a card/renderModel.
        const candidates = [
          res?.card,
          res?.data?.card,
          res?.renderModel,
          res?.data?.renderModel,
          res?.data,
          res,
        ]
        const isCardLike = (c) =>
          c && typeof c === 'object' &&
          (c.slug || c._id || c.cardId || c.id ||
           c.config || c.title ||
           c.layoutdata || c.layoutData ||
           c.visuals || c.content || c.type)

        const backendCard = candidates.find(isCardLike)

        if (backendCard) {
          const mapped = mapBackendCard(backendCard)
          setCard(mapped)
          if (mapped.locked && mapped.lockType === 'password') {
            setNeedsPassword(true)
          }
          setLoading(false)
          return
        }

        console.warn('[CardView] Backend response did not contain a card. Response:', res)
      } catch (err) {
        // If 403/locked, prompt for password
        if (err.status === 403 || err.payload?.locked) {
          setNeedsPassword(true)
          setLoading(false)
          if (!cancelled) return
        }
        console.warn('[CardView] Fetch failed:', err.status, err.message)
        // Fall through to local lookup
      }

      // Fallback: check localStorage for any locally-sent cards (e.g. drafts
      // rendered from the studio before backend save).
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

  const handlePasswordSubmit = async () => {
    setPasswordError('')
    try {
      const res = await getCardBySlug(id, passwordInput)
      const backendCard = res?.card || res?.data?.card || res?.data || res
      if (backendCard) {
        setCard(mapBackendCard(backendCard))
        setNeedsPassword(false)
      }
    } catch (err) {
      setPasswordError(err.message || 'Incorrect password.')
    }
  }

  useEffect(() => {
    if (!isOpen || card?.tier !== 'signature') return
    if (audioRef.current) {
      audioRef.current.play().catch(() => {})
    }
  }, [card?.tier, isOpen])

  const tierInfo = useMemo(() => getTierInfo(card?.tier), [card?.tier])
  const messageLines = useMemo(() => {
    const msg = card?.message || card?.cardObject?.content?.body || ''
    if (!msg) return []
    if (msg.includes('\n')) return msg.split('\n')
    const parts = msg.split('. ')
    return parts.map((line, index) => (index < parts.length - 1 ? `${line}.` : line))
  }, [card])

  const layout = card?.cardObject || card?.layoutdata || {}
  const content = layout?.content || {}
  const heading = content.heading || card?.title || ''
  const body = content.body || card?.message || ''
  const extendedBody = content.extendedBody || ''
  const questions = layout?.questions?.items || []
  const poll = card?.poll || null
  const chain = card?.chain || null
  const trivia = card?.trivia || null
  const primaryImage = layout?.media?.images?.[0] || null
  const rawCardType = (card?.type || layout?.type || (poll ? 'poll' : trivia ? 'trivia' : chain ? 'chain' : 'personal')).toLowerCase()
  const cardType = rawCardType === 'standard' || rawCardType === 'moment' ? 'personal' : rawCardType
  const accentColor = layout?.theme?.accentColor || '#76efff'
  const cardTextColor = layout?.card?.textColor || '#edf8ff'
  const cardHeadingColor = layout?.card?.headingColor || '#ffffff'
  const backgroundMusic = layout?.background?.music?.url || card?.music || ''
  const triviaQuestions = trivia?.questions || []
  const activeTriviaQuestion = triviaQuestions[triviaStepIdx] || null
  const triviaScore = triviaQuestions.filter((q, i) => {
    const correctIndex = q.correctIndex ?? q.correctAnswerIndex ?? q.answerIndex
    return triviaAnswers[i] === correctIndex
  }).length

  const handleResponse = async (response) => {
    try {
      await submitCardResponse(card.slug || id, { response, password: passwordInput || undefined })
      setResponseSubmitted(true)
      setInteractionMsg(response === 'yes' ? 'Thank you! ðŸ’›' : 'Response noted.')
    } catch (err) {
      setInteractionMsg(err.message || 'Could not submit response.')
    }
  }

  const handlePollVote = async () => {
    try {
      // Backend expects optionId — poll options are { id, text } objects.
      // pollVotes holds selected indices; map them to their stable IDs.
      const options = poll?.options || []
      const selectedIds = pollVotes.map(i => {
        const opt = options[i]
        return typeof opt === 'object' ? opt.id : `opt_${i}`
      }).filter(Boolean)
      await submitPollVote(card.slug || id, { optionId: selectedIds[0] || '', password: passwordInput || undefined })
      setPollSubmitted(true)
      setInteractionMsg('Vote submitted!')
    } catch (err) {
      setInteractionMsg(err.message || 'Could not submit vote.')
    }
  }

  const handleChainSubmit = async () => {
    if (!chainInput.trim()) return
    try {
      await submitChainReply(card.slug || id, { message: chainInput.trim(), password: passwordInput || undefined })
      setChainSubmitted(true)
      setInteractionMsg('Reply added!')
    } catch (err) {
      setInteractionMsg(err.message || 'Could not add reply.')
    }
  }

  const handleTriviaSubmit = async () => {
    try {
      await submitTriviaAnswer(card.slug || id, { answers: triviaAnswers, password: passwordInput || undefined })
      setTriviaSubmitted(true)
      setInteractionMsg('Answers submitted!')
    } catch (err) {
      setInteractionMsg(err.message || 'Could not submit answers.')
    }
  }

  const handleTriviaAdvance = async () => {
    if (triviaAnswers[triviaStepIdx] == null) return
    if (triviaStepIdx < triviaQuestions.length - 1) {
      setTriviaStepIdx(prev => prev + 1)
      return
    }
    await handleTriviaSubmit()
  }

  const cardBackgroundStyle = useMemo(() => {
    const background = layout?.background || {}
    if (background.type === 'gradient' || background.type === 'animated') {
      return { background: `linear-gradient(145deg, ${(background.colors || ['#081118', '#12242f']).join(', ')})` }
    }
    if (background.type === 'image' && background.imageUrl) {
      return {
        backgroundImage: `linear-gradient(180deg, rgba(4, 10, 16, 0.2), rgba(4, 10, 16, 0.88)), url(${background.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    if (background.type === 'color') {
      return { background: background.colors?.[0] || '#081118' }
    }
    return { background: 'linear-gradient(145deg, #081118, #12242f)' }
  }, [layout])

  const shellBorderStyle = useMemo(() => {
    const border = layout?.card?.cardBorder || {}
    if (border.type === 'solid') {
      return { border: `${border.width || 1}px solid ${border.colors?.[0] || 'rgba(126, 247, 255, 0.18)'}` }
    }
    if ((border.type === 'gradient' || border.type === 'animated') && border.colors?.length) {
      return {
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: `inset 0 0 0 ${Math.max(border.width || 1, 1)}px ${border.colors[0]}, 0 24px 80px rgba(0, 0, 0, 0.26)`,
      }
    }
    return { border: '1px solid rgba(126, 247, 255, 0.16)' }
  }, [layout])

  const pollResultPercents = useMemo(() => {
    const options = poll?.options || []
    if (!options.length) return []
    const backendResults = poll?.results || poll?.percentages || null
    if (Array.isArray(backendResults) && backendResults.length === options.length) {
      return backendResults.map((value) => {
        if (typeof value === 'number') return value
        return value?.percent ?? value?.percentage ?? value?.value ?? 0
      })
    }
    if (!pollSubmitted) return options.map(() => 0)
    const selectedCount = Math.max(pollVotes.length, 1)
    const unselectedCount = Math.max(options.length - pollVotes.length, 1)
    return options.map((_, index) => {
      if (pollVotes.includes(index)) {
        return poll?.allowMultiple ? Math.max(28, Math.floor(76 / selectedCount)) : 68
      }
      return pollVotes.length === options.length ? 100 / options.length : Math.max(8, Math.floor(24 / unselectedCount))
    })
  }, [poll, pollVotes, pollSubmitted])

  useEffect(() => {
    setResponseSubmitted(false)
    setPollVotes([])
    setPollSubmitted(false)
    setChainInput('')
    setChainSubmitted(false)
    setTriviaAnswers([])
    setTriviaSubmitted(false)
    setTriviaStepIdx(0)
    setInteractionMsg('')
  }, [card?.id])

  if (loading) {
    return (
      <div className="card-view">
        <div className="card-view-empty">
          <div className="chat-loading-spinner" />
          <p>Loading card...</p>
        </div>
      </div>
    )
  }

  if (needsPassword && !card) {
    return (
      <div className="card-view">
        <div className="card-view-empty card-password-gate">
          <span className="card-lock-icon">ðŸ”’</span>
          <h2>This card is locked</h2>
          <p>Enter the password to view this card.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            placeholder="Enter password..."
            onKeyDown={e => { if (e.key === 'Enter') handlePasswordSubmit() }}
          />
          {passwordError && <p className="auth-error">{passwordError}</p>}
          <button className="primary" type="button" onClick={handlePasswordSubmit}>
            Unlock Card
          </button>
          <Link className="ghost" to="/">Back Home</Link>
        </div>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="card-view">
        <div className="card-view-empty">
          <p>We could not find that card.</p>
          <button className="primary" type="button" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`card-view tier-${tierInfo.key}`}>
      <div className="card-view-top">
        <Link className="ghost" to="/">
          Back Home
        </Link>
        <span className="tier-badge card-view-tier">{tierInfo.label}</span>
      </div>
      <AnimatePresence mode="wait">
        {!isOpen && shouldShowEnvelope(cardType) ? (
          <motion.section
            key="entry"
            className="card-entry cinematic-entry"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <Envelope
              cardObject={backfillEnvelope(card.cardObject || structuredClone(defaultCardObject))}
              tier={tierInfo.key}
              recipientEmail={card.recipient || card.recipientEmail || ''}
              onOpenComplete={() => setIsOpen(true)}
            />
          </motion.section>
        ) : (
          <motion.section
            key="open"
            className="card-open cinematic-open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {tierInfo.key === 'special' ? (
              <div className="special-floaters">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span key={`floater-${index}`} className={`floater f${index + 1}`} />
                ))}
              </div>
            ) : null}
            {tierInfo.key === 'signature' ? (
              <>
                <div className="signature-confetti">
                  {Array.from({ length: 18 }).map((_, index) => (
                    <span key={`confetti-${index}`} className="confetti-piece" />
                  ))}
                </div>
                <div className="signature-emojis">
                  {['\u{1F496}', '\u2728', '\u{1F48C}', '\u{1F4AB}', '\u{1F31F}'].map(
                    (emoji, index) => (
                      <span key={`${emoji}-${index}`} className={`emoji e${index + 1}`}>
                        {emoji}
                      </span>
                    ),
                  )}
                </div>
              </>
            ) : null}
            <div className={`card-open-shell cv-shell-${cardType}`} style={{ ...cardBackgroundStyle, ...shellBorderStyle, '--cv-accent': accentColor, '--cv-text': cardTextColor, '--cv-heading': cardHeadingColor }}>
              {layout?.background?.type === 'video' && layout?.background?.videoUrl ? (
                <video className="card-open-shell-video" src={layout.background.videoUrl} autoPlay muted loop playsInline />
              ) : null}
              <div className="card-open-overlay" />
              <div className="card-open-content">
                <div className="card-open-meta-row">
                  <p className="entry-sub">To {card.recipient || 'You'}</p>
                  <span className="cv-type-chip">{cardType === 'personal' ? 'Personal Card' : cardType === 'poll' ? 'Poll Card' : cardType === 'trivia' ? 'Trivia Card' : cardType === 'chain' ? 'Chain Card' : 'Card Experience'}</span>
                </div>
                <h3 style={{ color: cardHeadingColor }}>{card.subtitle || heading}</h3>

                {primaryImage ? (
                  <div className="card-open-hero-media">
                    <img
                      src={typeof primaryImage === 'string' ? primaryImage : primaryImage.url}
                      alt=""
                      style={{
                        objectFit: primaryImage.fit || 'cover',
                        objectPosition: `${primaryImage.positionX ?? 50}% ${primaryImage.positionY ?? 50}%`,
                      }}
                    />
                  </div>
                ) : null}

                <div className="card-open-message" style={{ color: cardTextColor }}>
                  {tierInfo.key === 'signature' ? (
                    messageLines.map((line, index) => (
                      <motion.p
                        key={`line-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.2, duration: 0.4 }}
                      >
                        {line}
                      </motion.p>
                    ))
                  ) : (
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {body || card.message}
                    </motion.p>
                  )}
                  {extendedBody && (
                    <motion.p
                      className="card-extended-body"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8, duration: 0.5 }}
                    >
                      {extendedBody}
                    </motion.p>
                  )}
                </div>

                {backgroundMusic ? (
                  <div className="music-row">
                    <audio
                      ref={audioRef}
                      src={backgroundMusic}
                      muted={isMuted}
                      loop
                      autoPlay
                    />
                    <button
                      className="ghost music-toggle"
                      type="button"
                      onClick={() => setIsMuted((prev) => !prev)}
                    >
                      {isMuted ? '\u{1F507}' : '\u{1F50A}'}
                    </button>
                  </div>
                ) : null}

                {!responseSubmitted && !poll && !chain && !trivia && (
                  <div className="experience-questions cv-type-section">
                    <p className="cv-type-eyebrow" style={{ color: accentColor }}>Interactive Moment</p>
                    <div className="question-actions">
                      <button className="yes" type="button" onClick={() => handleResponse('yes')}>Yes, absolutely</button>
                      <button className="no" type="button" onClick={() => handleResponse('no')}>Tell me more</button>
                    </div>
                  </div>
                )}

                {poll && (
                  <div className="cv-type-section cv-poll-stage-card">
                    <p className="cv-type-eyebrow" style={{ color: accentColor }}>Poll Card</p>
                    <h4 className="cv-poll-question">{poll.question}</h4>
                    <div className="cv-poll-options">
                      {poll.options?.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`cv-poll-option ${pollVotes.includes(i) ? 'selected' : ''} ${pollSubmitted ? 'submitted' : ''}`}
                          onClick={() => {
                            if (pollSubmitted) return
                            if (poll.allowMultiple) {
                              setPollVotes(prev => prev.includes(i) ? prev.filter(v => v !== i) : [...prev, i])
                            } else {
                              setPollVotes([i])
                            }
                          }}
                        >
                          <span className="cv-poll-radio" />
                          <span className="cv-poll-option-copy">{typeof opt === 'string' ? opt : opt.text || `Option ${i + 1}`}</span>
                          {pollSubmitted ? <span className="cv-poll-result-value">{pollResultPercents[i]}%</span> : null}
                          {pollSubmitted ? (
                            <span className="cv-poll-result-bar">
                              <span style={{ width: `${pollResultPercents[i]}%`, background: accentColor }} />
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                    {!pollSubmitted ? (
                      <button className="cv-poll-submit" type="button" onClick={handlePollVote} disabled={pollVotes.length === 0} style={{ background: `linear-gradient(135deg, ${accentColor}, rgba(255,255,255,0.92))`, color: '#041015' }}>
                        Submit Vote
                      </button>
                    ) : (
                      <p className="cv-poll-thanks" style={{ color: accentColor }}>Your vote has been counted. Results are now visible.</p>
                    )}
                  </div>
                )}

                {chain && !chainSubmitted && (
                  <div className="cv-type-section cv-chain-section">
                    <p className="cv-type-eyebrow" style={{ color: accentColor }}>Chain Card</p>
                    <h4 className="cv-chain-prompt">{chain.challenge || chain.topic || chain.prompt || 'Add your message'}</h4>
                    <textarea
                      className="cv-chain-input"
                      rows={4}
                      value={chainInput}
                      onChange={e => setChainInput(e.target.value)}
                      placeholder="Add your reply to keep the chain going..."
                    />
                    <button className="cv-chain-submit" type="button" onClick={handleChainSubmit} style={{ background: `linear-gradient(135deg, ${accentColor}, rgba(255,255,255,0.9))`, color: '#041015' }}>
                      Add Reply
                    </button>
                  </div>
                )}

                {trivia && !triviaSubmitted && activeTriviaQuestion && (
                  <div className="cv-type-section">
                    <p className="cv-type-eyebrow" style={{ color: accentColor }}>Trivia Card</p>
                    <div className="cv-trivia-progress">
                      {triviaQuestions.map((_, index) => (
                        <div key={index} className={`cv-trivia-dot ${index < triviaStepIdx ? 'done' : ''} ${index === triviaStepIdx ? 'active' : ''}`} />
                      ))}
                    </div>
                    <p className="cv-trivia-counter" style={{ color: accentColor }}>Question {triviaStepIdx + 1} of {triviaQuestions.length}</p>
                    <div className="cv-trivia-question">
                      <p>{activeTriviaQuestion.question || activeTriviaQuestion.text}</p>
                    </div>
                    <div className="cv-trivia-options">
                      {activeTriviaQuestion.options?.map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          className={`cv-trivia-opt ${triviaAnswers[triviaStepIdx] === oi ? 'selected' : ''}`}
                          onClick={() => {
                            const next = [...triviaAnswers]
                            next[triviaStepIdx] = oi
                            setTriviaAnswers(next)
                          }}
                        >
                          <span className="cv-trivia-letter">{String.fromCharCode(65 + oi)}</span>
                          <span>{typeof opt === 'string' ? opt : opt.text}</span>
                        </button>
                      ))}
                    </div>
                    <button className="cv-trivia-submit" type="button" onClick={handleTriviaAdvance} disabled={triviaAnswers[triviaStepIdx] == null} style={{ background: `linear-gradient(135deg, ${accentColor}, rgba(255,255,255,0.88))`, color: '#041015' }}>
                      {triviaStepIdx < triviaQuestions.length - 1 ? 'Next Question' : 'Submit Answers'}
                    </button>
                  </div>
                )}

                {trivia && triviaSubmitted && (
                  <div className="cv-type-section cv-trivia-results">
                    <span className="cv-trivia-score-value">{triviaScore}/{triviaQuestions.length}</span>
                    <h4 style={{ margin: 0, color: cardHeadingColor }}>Quiz Complete</h4>
                    <p>You answered {triviaScore} out of {triviaQuestions.length} correctly.</p>
                  </div>
                )}

                {interactionMsg && <p className="cv-interaction-msg">{interactionMsg}</p>}

                {questions.length > 0 && (
                  <div className="experience-questions cv-type-section">
                    <p className="cv-type-eyebrow" style={{ color: accentColor }}>Questions for you</p>
                    {questions.map((q, i) => (
                      <div key={i} className="card-question-item">
                        <p>{q.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="experience-end">
                  <Link className="ghost" to="/profile">
                    Save this card
                  </Link>
                  <button className="primary" type="button" onClick={() => openCardTypeModal?.()}>
                    Create yours
                  </button>
                </div>

                <div className="cv-watermark">
                  <span>Made with</span>
                  <Link to="/" className="cv-watermark-brand">Cardora</Link>
                  <span className="cv-watermark-sep">·</span>
                  <Link to="/create" className="cv-watermark-cta">Create yours →</Link>
                  <button
                    type="button"
                    className="cv-report-btn"
                    onClick={() => setShowReport(true)}
                    title="Report this card"
                  >
                    Report
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {showReport && (
        <ReportModal
          type="card"
          targetId={card?.id || card?.slug || id}
          targetName={card?.title || ''}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}

export default CardView







