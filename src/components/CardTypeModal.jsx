import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdBolt, MdPalette } from 'react-icons/md'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from './CardIcons.jsx'
import { TIER_COST_BY_TYPE } from '../lib/tierRequirements.js'

const CARD_TYPES = [
  {
    id: 'personal',
    icon: PersonalCardIcon,
    label: 'Personal Card',
    tagline: 'The full cinematic experience',
    description: 'Envelope reveals, background music, animations, images, gifts, questions — everything.',
    accent: 'warm',
  },
  {
    id: 'poll',
    icon: PollCardIcon,
    label: 'Poll Card',
    tagline: 'Ask and see who answers',
    description: 'Embed a live poll. Recipients vote and see real-time results.',
    accent: 'cool',
  },
  {
    id: 'trivia',
    icon: TriviaCardIcon,
    label: 'Trivia Card',
    tagline: 'Quiz your people',
    description: 'Create a scored quiz. Recipients see their score and correct answers at the end.',
    accent: 'rose',
  },
  {
    id: 'chain',
    icon: ChainCardIcon,
    label: 'Chain Card',
    tagline: 'Send and receive back',
    description: 'Send a card that invites the recipient to reply with their own card back.',
    accent: 'emerald',
  },
  {
    id: 'anonymous',
    icon: AnonCardIcon,
    label: 'Anonymous Card',
    tagline: 'Receive honest messages',
    description: 'Share a link and let anyone send you a message — anonymously, beautifully wrapped.',
    accent: 'mint',
  },
]

// Honest pricing hint for the type tiles — under the computed-tier model
// there's no upfront tier to pick, so this just tells the sender the studio
// is free to design in and names the ceiling if they use every paid touch.
function pricingHint(typeId) {
  const costs = TIER_COST_BY_TYPE[typeId] || TIER_COST_BY_TYPE.personal
  const max = Math.max(...Object.values(costs).filter((v) => typeof v === 'number'))
  return max > 0 ? `Free to start · premium touches up to ${max} CC` : 'Free to start'
}

function CardTypeModal({ open, onClose, preselectedType, currentUser = null }) {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState(null)
  const [modeStep, setModeStep] = useState(false)
  const isArtist = String(currentUser?.role || '').toLowerCase() === 'artist'

  // Reset state when modal opens / closes or preselection changes
  useEffect(() => {
    setModeStep(false)
    if (open && preselectedType) {
      setSelectedType(preselectedType)
      if (!isArtist) setModeStep(true)
    } else if (open) {
      setSelectedType(null)
    }
  }, [open, preselectedType, isArtist])

  if (!open) return null

  const activeType = CARD_TYPES.find((t) => t.id === selectedType)

  const handleSelectType = (typeId) => {
    if (isArtist) {
      // Artists are unlocked for everything regardless — no tier or mode
      // screen for them, straight into the Studio.
      onClose()
      navigate(`/studio?type=${typeId}`, { state: { isNew: true } })
      return
    }
    setSelectedType(typeId)
    setModeStep(true)
  }

  const handleBack = () => {
    if (modeStep) {
      setModeStep(false)
      setSelectedType(null)
    } else {
      onClose()
    }
  }

  return (
    <section className={`ctm-overlay ${isArtist ? 'ctm-artist' : ''}`} role="dialog" aria-modal="true" aria-label="Choose card type">
      <div className="ctm-backdrop" onClick={onClose} />
      <div className="ctm-shell">
        {/* Header */}
        <div className="ctm-header">
          <button type="button" className="ctm-back" onClick={handleBack}>
            {(selectedType || modeStep) ? '← Back' : '✕'}
          </button>
          <div className="ctm-header-text">
            <p className="eyebrow">{isArtist ? 'Artist Studio' : 'Create a Card'}</p>
            <h2>
              {modeStep
                ? 'How do you want to build?'
                : (isArtist ? 'What signature piece are you designing?' : 'What are you creating?')}
            </h2>
            {isArtist && !selectedType && (
              <p className="ctm-artist-sub">You're building for the marketplace — every tool is open to you, no CC cost. Design something people will save.</p>
            )}
          </div>
        </div>

        {/* Type Selection */}
        {!selectedType && (
          <div className="ctm-grid">
            {CARD_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.id}
                  type="button"
                  className={`ctm-card ctm-${type.accent}`}
                  onClick={() => handleSelectType(type.id)}
                >
                  <div className="ctm-card-icon-wrap">
                    <Icon size={36} className="ctm-card-icon" />
                  </div>
                  <h3>{type.label}</h3>
                  <p className="ctm-card-tagline">{type.tagline}</p>
                  <p className="ctm-card-desc">{type.description}</p>
                  {!isArtist && (
                    <span className="ctm-card-tiers-hint">{pricingHint(type.id)}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Mode Selection — non-artist only */}
        {selectedType && activeType && modeStep && !isArtist && (
          <div className="ctm-mode-section">
            <div className={`ctm-type-summary ctm-${activeType.accent}`}>
              <div className="ctm-type-summary-icon">
                <activeType.icon size={28} className="ctm-card-icon" />
              </div>
              <div>
                <h3>{activeType.label}</h3>
                <p>{activeType.description}</p>
              </div>
            </div>
            <div className="ctm-mode-grid">
              <button
                type="button"
                className="ctm-mode-card ctm-mode-quick"
                onClick={() => { onClose(); navigate(`/quick?type=${selectedType}`) }}
              >
                <div className="ctm-mode-icon"><MdBolt size={24} /></div>
                <h3>Quick Start</h3>
                <p>Pick a theme, add your text and a photo — ready in minutes.</p>
                <span className="ctm-mode-hint">Simple · Fast · Clean</span>
              </button>
              <button
                type="button"
                className="ctm-mode-card ctm-mode-studio"
                onClick={() => { onClose(); navigate(`/studio?type=${selectedType}`, { state: { isNew: true } }) }}
              >
                <div className="ctm-mode-icon"><MdPalette size={24} /></div>
                <h3>Full Studio</h3>
                <p>Complete control — design, effects, music, and more.</p>
                <span className="ctm-mode-hint">Advanced · Creative · Powerful</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default CardTypeModal
export { CARD_TYPES }
