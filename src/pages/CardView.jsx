import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getTierInfo } from '../utils/tier.js'
import { exploreCards, homeCards, profileCreations } from '../data/catalog.js'
import PremiumGiftReveal from '../components/PremiumGiftReveal.jsx'

const fallbackMusic =
  'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

function CardView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [card, setCard] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [showGiftReveal, setShowGiftReveal] = useState(false)
  const [giftStatus, setGiftStatus] = useState('pending')
  const audioRef = useRef(null)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('cardora:sentCards') || '[]')
    const match = stored.find((item) => item.id === id)
    if (match) {
      setCard(match)
      return
    }
    const templateMatch = [...homeCards, ...exploreCards, ...profileCreations].find(
      (item) => item.id === id,
    )
    if (templateMatch) {
      setCard({
        id: templateMatch.id,
        templateId: templateMatch.id,
        title: templateMatch.title,
        subtitle: templateMatch.subtitle,
        message: templateMatch.message,
        recipient: 'You',
        sender: 'Cardora',
        tier: templateMatch.tier || 'simple',
        gift:
          templateMatch.tier === 'signature'
            ? {
                effectKey: 'necklace',
                title: 'Premium Gift',
                amount: '$150',
                actionLabel: 'Claim Gift',
                secondaryAction: 'View Instructions',
              }
            : null,
      })
    } else {
      setCard(null)
    }
  }, [id])

  useEffect(() => {
    setGiftStatus('pending')
    setShowGiftReveal(false)
  }, [card?.id])

  useEffect(() => {
    if (!isOpen || card?.tier !== 'signature') return
    if (audioRef.current) {
      audioRef.current.play().catch(() => {})
    }
  }, [card?.tier, isOpen])

  const tierInfo = useMemo(() => getTierInfo(card?.tier), [card?.tier])
  const messageLines = useMemo(() => {
    if (!card?.message) return []
    if (card.message.includes('\n')) return card.message.split('\n')
    const parts = card.message.split('. ')
    return parts.map((line, index) => (index < parts.length - 1 ? `${line}.` : line))
  }, [card?.message])

  const giftConfig = card?.gift || null

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
            <div className="card-entry-scene" aria-hidden="true">
              <div className="card-entry-envelope">
                <span className="entry-flap" />
                <span className="entry-seal" />
              </div>
              <div className="card-entry-glow" />
            </div>
            <p className="entry-label">{'You have received a card \u{1F48C}'}</p>
            <h2>{card.title}</h2>
            <p className="entry-sub">From {card.sender}</p>
            <button className="primary" type="button" onClick={() => setIsOpen(true)}>
              Open Card
            </button>
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
              <p className="entry-sub">To {card.recipient}</p>
              <h3>{card.subtitle}</h3>
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
                    {card.message}
                  </motion.p>
                )}
              </div>
              {tierInfo.key === 'signature' ? (
                <div className="music-row">
                  <audio
                    ref={audioRef}
                    src={card.music || fallbackMusic}
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
              <div className="experience-questions">
                <p className="eyebrow">Interactive moment</p>
                <div className="question-actions">
                  <button className="yes" type="button">Yes, absolutely</button>
                  <button className="no" type="button">Tell me more</button>
                </div>
              </div>
              {giftConfig ? (
                <div className="experience-gift-card">
                  <p className="eyebrow">Gift Handoff</p>
                  <h4>A gift has been sent to you</h4>
                  <p className="detail-message">
                    Reach the end of the card, then choose when you want the reveal to happen.
                  </p>
                  <div className="experience-gift-meta">
                    <span>{giftConfig.title}</span>
                    <span className="dot" />
                    <span>{giftConfig.amount}</span>
                    <span className="dot" />
                    <span>{giftStatus === 'pending' ? 'Locked' : 'Opened'}</span>
                  </div>
                  <div className="experience-end">
                    <button
                      className="primary"
                      type="button"
                      onClick={() => {
                        setGiftStatus('opened')
                        setShowGiftReveal(true)
                      }}
                    >
                      {giftConfig.actionLabel || 'Claim Gift'}
                    </button>
                    <button className="ghost" type="button">
                      {giftConfig.secondaryAction || 'View Instructions'}
                    </button>
                  </div>
                </div>
              ) : null}
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
      {showGiftReveal && giftConfig ? (
        <PremiumGiftReveal
          effect={giftConfig.effectKey}
          onComplete={() => setShowGiftReveal(false)}
        />
      ) : null}
    </div>
  )
}

export default CardView
