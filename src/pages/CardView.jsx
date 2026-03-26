import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getTierInfo } from '../utils/tier.js'
import { exploreCards, homeCards, profileCreations } from '../data/catalog.js'

const fallbackMusic =
  'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

function CardView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [card, setCard] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
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
      })
    } else {
      setCard(null)
    }
  }, [id])

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
            className="card-entry"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
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
            className="card-open"
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
                  {[
                    '\u{1F496}',
                    '\u2728',
                    '\u{1F48C}',
                    '\u{1F4AB}',
                    '\u{1F31F}',
                  ].map((emoji, index) => (
                    <span key={`${emoji}-${index}`} className={`emoji e${index + 1}`}>
                      {emoji}
                    </span>
                  ))}
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
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CardView
