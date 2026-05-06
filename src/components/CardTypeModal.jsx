import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from './CardIcons.jsx'

const CARD_TYPES = [
  {
    id: 'personal',
    icon: PersonalCardIcon,
    label: 'Personal Card',
    tagline: 'The full cinematic experience',
    description: 'Envelope reveals, background music, animations, images, gifts, questions — everything.',
    accent: 'warm',
    tiers: ['classic', 'premium', 'elite'],
  },
  {
    id: 'poll',
    icon: PollCardIcon,
    label: 'Poll Card',
    tagline: 'Ask and see who answers',
    description: 'Embed a live poll. Recipients vote and see real-time results.',
    accent: 'cool',
    tiers: ['classic', 'elite'],
  },
  {
    id: 'trivia',
    icon: TriviaCardIcon,
    label: 'Trivia Card',
    tagline: 'Quiz your people',
    description: 'Create a scored quiz. Recipients see their score and correct answers at the end.',
    accent: 'rose',
    tiers: ['classic', 'elite'],
  },
  {
    id: 'chain',
    icon: ChainCardIcon,
    label: 'Chain Card',
    tagline: 'Send and receive back',
    description: 'Send a card that invites the recipient to reply with their own card back.',
    accent: 'emerald',
    tiers: ['classic', 'elite'],
  },
  {
    id: 'anonymous',
    icon: AnonCardIcon,
    label: 'Anonymous Card',
    tagline: 'Receive honest messages',
    description: 'Share a link and let anyone send you a message — anonymously, beautifully wrapped.',
    accent: 'mint',
    tiers: ['classic', 'elite'],
  },
]

const TIER_INFO = {
  classic: { label: 'Classic', note: 'Free · Clean animated reveal' },
  premium: { label: 'Premium', note: 'Music + richer visuals · Costs CC' },
  elite: { label: 'Elite', note: 'Full effects + gifts · Costs CC' },
}

function CardTypeModal({ open, onClose, preselectedType, currentUser = null }) {
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState(null)
  const [selectedTier, setSelectedTier] = useState(null)
  const isArtist = currentUser?.role === 'Artist'

  // Reset state when modal opens / closes or preselection changes
  useEffect(() => {
    if (open && preselectedType) {
      setSelectedType(preselectedType)
      const type = CARD_TYPES.find((t) => t.id === preselectedType)
      // Artists default to Elite — they're building signature work
      setSelectedTier(isArtist ? (type?.tiers.includes('elite') ? 'elite' : type?.tiers[type.tiers.length - 1]) : (type?.tiers[0] || 'classic'))
    } else if (open) {
      setSelectedType(null)
      setSelectedTier(null)
    }
  }, [open, preselectedType, isArtist])

  if (!open) return null

  const activeType = CARD_TYPES.find((t) => t.id === selectedType)

  const handleStart = () => {
    if (!selectedType || !selectedTier) return
    onClose()
    navigate(`/studio?type=${selectedType}&tier=${selectedTier}`)
  }

  const handleSelectType = (typeId) => {
    setSelectedType(typeId)
    const type = CARD_TYPES.find((t) => t.id === typeId)
    // Auto-select the first tier
    setSelectedTier(type?.tiers[0] || 'classic')
  }

  const handleBack = () => {
    if (selectedType) {
      setSelectedType(null)
      setSelectedTier(null)
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
            {selectedType ? '← Back' : '✕'}
          </button>
          <div className="ctm-header-text">
            <p className="eyebrow">{isArtist ? 'Artist Studio' : 'Create a Card'}</p>
            <h2>
              {selectedType
                ? (isArtist ? 'Pick a tier to design for' : 'Choose your tier')
                : (isArtist ? 'What signature piece are you designing?' : 'What are you creating?')}
            </h2>
            {isArtist && !selectedType && (
              <p className="ctm-artist-sub">You're building for the marketplace — every tier is open to you, no CC cost. Design something people will save.</p>
            )}
            {isArtist && selectedType && (
              <p className="ctm-artist-sub">Pick the tier of experience you want this template to showcase. Your studio won't be capped either way.</p>
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
                  <span className="ctm-card-tiers-hint">
                    {type.tiers.map((t) => TIER_INFO[t].label).join(' · ')}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Tier Selection */}
        {selectedType && activeType && (() => {
          const Icon = activeType.icon
          return (
          <div className="ctm-tier-section">
            <div className={`ctm-type-summary ctm-${activeType.accent}`}>
              <div className="ctm-type-summary-icon">
                <Icon size={28} className="ctm-card-icon" />
              </div>
              <div>
                <h3>{activeType.label}</h3>
                <p>{activeType.description}</p>
              </div>
            </div>

            <div className="ctm-tier-grid">
              {activeType.tiers.map((tier) => {
                const info = TIER_INFO[tier]
                const artistNote = tier === 'classic'
                  ? 'Free tier feel · Minimal reveal'
                  : tier === 'premium'
                  ? 'Music + richer visuals'
                  : 'Full cinematic experience'
                return (
                  <button
                    key={tier}
                    type="button"
                    className={`ctm-tier ${selectedTier === tier ? 'active' : ''} ctm-tier-${tier}`}
                    onClick={() => setSelectedTier(tier)}
                  >
                    <span className="ctm-tier-name">{info.label}</span>
                    <span className="ctm-tier-note">{isArtist ? artistNote : info.note}</span>
                    {selectedTier === tier && <span className="ctm-tier-check">✓</span>}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className={`ctm-start ctm-start-${activeType.accent}`}
              disabled={!selectedTier}
              onClick={handleStart}
            >
              {isArtist ? 'Open the Artist Studio →' : 'Start Creating →'}
            </button>
          </div>
          )
        })()}
      </div>
    </section>
  )
}

export default CardTypeModal
export { CARD_TYPES, TIER_INFO }
