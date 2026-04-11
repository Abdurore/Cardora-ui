import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getTierInfo } from '../utils/tier.js'
import { getCardBySlug, submitCardResponse, submitPollVote, submitChainReply, submitTriviaAnswer } from '../lib/api.js'
import { mapBackendCard, layoutDataToCardObject } from '../lib/backendMappers.js'
import { exploreCards, homeCards, profileCreations } from '../data/catalog.js'
import Envelope from '../components/Envelope.jsx'
import { backfillEnvelope, defaultCardObject } from '../data/cardDefaults.js'

const fallbackMusic =
  'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

function CardView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [responseSubmitted, setResponseSubmitted] = useState(false)
  const [pollVotes, setPollVotes] = useState([])
  const [chainInput, setChainInput] = useState('')
  const [chainSubmitted, setChainSubmitted] = useState(false)
  const [triviaAnswers, setTriviaAnswers] = useState([])
  const [triviaSubmitted, setTriviaSubmitted] = useState(false)
  const [interactionMsg, setInteractionMsg] = useState('')
  const audioRef = useRef(null)

  // Try loading from backend by slug
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await getCardBySlug(id)
        if (!cancelled) {
          const backendCard = res?.card || res?.data?.card || res?.data || res
          if (backendCard && (backendCard.layoutdata || backendCard.layoutData || backendCard.title)) {
            const mapped = mapBackendCard(backendCard)
            setCard(mapped)
            if (mapped.locked && mapped.lockType === 'password') {
              setNeedsPassword(true)
            }
            setLoading(false)
            return
          }
        }
      } catch (err) {
        // If 403/locked, prompt for password
        if (err.status === 403 || err.payload?.locked) {
          setNeedsPassword(true)
          setLoading(false)
          if (!cancelled) return
        }
        // Fall through to local lookup
      }

      // Fallback: check localStorage + local catalog
      const stored = JSON.parse(localStorage.getItem('cardora:sentCards') || '[]')
      const match = stored.find((item) => item.id === id)
      if (match) {
        if (!cancelled) { setCard(match); setLoading(false) }
        return
      }
      const templateMatch = [...homeCards, ...exploreCards, ...profileCreations].find(
        (item) => item.id === id,
      )
      if (templateMatch) {
        if (!cancelled) {
          setCard({
            id: templateMatch.id,
            templateId: templateMatch.id,
            title: templateMatch.title,
            subtitle: templateMatch.subtitle,
            message: templateMatch.message,
            recipient: 'You',
            sender: 'Cardora',
            tier: templateMatch.tier || 'simple',
            gift: null,
          })
          setLoading(false)
        }
      } else {
        if (!cancelled) { setCard(null); setLoading(false) }
      }
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

  const handleResponse = async (response) => {
    try {
      await submitCardResponse(card.slug || id, { response, password: passwordInput || undefined })
      setResponseSubmitted(true)
      setInteractionMsg(response === 'yes' ? 'Thank you! 💛' : 'Response noted.')
    } catch (err) {
      setInteractionMsg(err.message || 'Could not submit response.')
    }
  }

  const handlePollVote = async () => {
    try {
      await submitPollVote(card.slug || id, { optionIndexes: pollVotes, password: passwordInput || undefined })
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
          <span className="card-lock-icon">🔒</span>
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
        {!isOpen ? (
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
            <div className="card-open-shell">
              <p className="entry-sub">To {card.recipient || 'You'}</p>
              <h3>{card.subtitle || heading}</h3>
              <div className="card-open-message">
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

              {tierInfo.key === 'signature' ? (
                <div className="music-row">
                  <audio
                    ref={audioRef}
                    src={layout?.background?.music?.url || card.music || fallbackMusic}
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

              {/* Yes/No Response */}
              {!responseSubmitted && !poll && !chain && !trivia && (
                <div className="experience-questions">
                  <p className="eyebrow">Interactive moment</p>
                  <div className="question-actions">
                    <button className="yes" type="button" onClick={() => handleResponse('yes')}>Yes, absolutely</button>
                    <button className="no" type="button" onClick={() => handleResponse('no')}>Tell me more</button>
                  </div>
                </div>
              )}

              {/* Poll */}
              {poll && (
                <div className="experience-questions">
                  <p className="eyebrow">Poll</p>
                  <h4>{poll.question}</h4>
                  <div className="card-poll-options">
                    {poll.options?.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`card-poll-option ${pollVotes.includes(i) ? 'selected' : ''}`}
                        onClick={() => {
                          if (poll.allowMultiple) {
                            setPollVotes(prev => prev.includes(i) ? prev.filter(v => v !== i) : [...prev, i])
                          } else {
                            setPollVotes([i])
                          }
                        }}
                      >
                        {typeof opt === 'string' ? opt : opt.text || `Option ${i + 1}`}
                      </button>
                    ))}
                  </div>
                  <button className="primary" type="button" onClick={handlePollVote} disabled={pollVotes.length === 0}>
                    Submit Vote
                  </button>
                </div>
              )}

              {/* Chain Reply */}
              {chain && !chainSubmitted && (
                <div className="experience-questions">
                  <p className="eyebrow">Chain</p>
                  <h4>{chain.topic || 'Add your message'}</h4>
                  <textarea
                    className="card-chain-input"
                    rows={3}
                    value={chainInput}
                    onChange={e => setChainInput(e.target.value)}
                    placeholder="Write your reply..."
                  />
                  <button className="primary" type="button" onClick={handleChainSubmit}>
                    Add Reply
                  </button>
                </div>
              )}

              {/* Trivia */}
              {trivia && !triviaSubmitted && (
                <div className="experience-questions">
                  <p className="eyebrow">Trivia</p>
                  {trivia.questions?.map((q, qi) => (
                    <div key={qi} className="card-trivia-question">
                      <p><strong>{q.question || q.text}</strong></p>
                      <div className="card-poll-options">
                        {q.options?.map((opt, oi) => (
                          <button
                            key={oi}
                            type="button"
                            className={`card-poll-option ${triviaAnswers[qi] === oi ? 'selected' : ''}`}
                            onClick={() => {
                              const next = [...triviaAnswers]
                              next[qi] = oi
                              setTriviaAnswers(next)
                            }}
                          >
                            {typeof opt === 'string' ? opt : opt.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button className="primary" type="button" onClick={handleTriviaSubmit}>
                    Submit Answers
                  </button>
                </div>
              )}

              {interactionMsg && <p className="card-interaction-msg">{interactionMsg}</p>}

              {/* Questions */}
              {questions.length > 0 && (
                <div className="experience-questions">
                  <p className="eyebrow">Questions for you</p>
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
                <Link className="primary" to="/studio">
                  Create yours
                </Link>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CardView
