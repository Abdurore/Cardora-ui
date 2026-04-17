import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const CARD_TYPES = [
  {
    id: 'moment',
    label: 'Moment Card',
    icon: '✉',
    desc: 'A cinematic card with envelope reveal, music, media, and effects.',
    accent: '#f0c060',
    tiers: [
      { id: 'classic', label: 'Classic', desc: 'Clean design, no effects', cost: '0 CC' },
      { id: 'premium', label: 'Premium', desc: 'Music, animations, full effects', cost: '5 CC' },
      { id: 'elite', label: 'Elite', desc: 'Everything + exclusive envelope styles', cost: '10 CC' },
    ],
  },
  {
    id: 'poll',
    label: 'Poll',
    icon: '📊',
    desc: 'Ask your audience a question. See live results when they answer.',
    accent: '#60a5fa',
    tiers: [
      { id: 'classic', label: 'Classic', desc: 'Simple question + options', cost: '0 CC' },
      { id: 'premium', label: 'Premium', desc: 'Styled card with effects', cost: '5 CC' },
    ],
  },
  {
    id: 'trivia',
    label: 'Trivia',
    icon: '💡',
    desc: 'Quiz your friends. They see their score and correct answers.',
    accent: '#a78bfa',
    tiers: [
      { id: 'classic', label: 'Classic', desc: 'Standard quiz format', cost: '0 CC' },
      { id: 'premium', label: 'Premium', desc: 'Styled card with animations', cost: '5 CC' },
    ],
  },
  {
    id: 'chain',
    label: 'Chain',
    icon: '🔗',
    desc: 'Send a card that invites the recipient to reply with their own card back.',
    accent: '#34d399',
    tiers: [
      { id: 'classic', label: 'Classic', desc: 'Simple card with chain prompt', cost: '0 CC' },
      { id: 'premium', label: 'Premium', desc: 'Styled card with animations', cost: '5 CC' },
    ],
  },
  {
    id: 'anon',
    label: 'Anonymous',
    icon: '👁',
    desc: 'Let anyone send you anonymous messages wrapped in a designed card.',
    accent: '#7ef7ff',
    tiers: [
      { id: 'classic', label: 'Classic', desc: 'Free to receive, clean template', cost: '0 CC' },
      { id: 'premium', label: 'Premium', desc: 'Premium template with effects', cost: '5 CC' },
    ],
  },
]

function CreateCardPicker() {
  const navigate = useNavigate()
  const [step, setStep] = useState('type')
  const [selectedType, setSelectedType] = useState(null)

  return (
    <div className="ccp-backdrop" onClick={() => navigate(-1)}>
      <div className="ccp-modal" onClick={e => e.stopPropagation()}>
        {step === 'type' && (
          <>
            <button className="ccp-close" onClick={() => navigate(-1)}>×</button>
            <p className="eyebrow">Create</p>
            <h2 className="ccp-heading">What kind of card?</h2>
            <div className="ccp-type-grid">
              {CARD_TYPES.map(type => (
                <button
                  key={type.id}
                  className="ccp-type-card"
                  style={{ '--type-accent': type.accent }}
                  onClick={() => { setSelectedType(type); setStep('tier') }}
                >
                  <span className="ccp-type-icon">{type.icon}</span>
                  <strong className="ccp-type-label">{type.label}</strong>
                  <p className="ccp-type-desc">{type.desc}</p>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 'tier' && selectedType && (
          <>
            <button className="ccp-back" onClick={() => setStep('type')}>← Back</button>
            <p className="eyebrow" style={{ color: selectedType.accent }}>{selectedType.icon} {selectedType.label}</p>
            <h2 className="ccp-heading">Choose a tier</h2>
            <div className="ccp-tier-list">
              {selectedType.tiers.map(tier => (
                <button
                  key={tier.id}
                  className="ccp-tier-card"
                  style={{ '--type-accent': selectedType.accent }}
                  onClick={() => navigate('/studio', { state: { cardType: selectedType.id, cardTier: tier.id } })}
                >
                  <div className="ccp-tier-top">
                    <strong className="ccp-tier-label">{tier.label}</strong>
                    <span className="ccp-tier-cost">{tier.cost}</span>
                  </div>
                  <p className="ccp-tier-desc">{tier.desc}</p>
                  <span className="ccp-tier-arrow">→</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CreateCardPicker
