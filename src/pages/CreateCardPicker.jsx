import { useNavigate } from 'react-router-dom'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from '../components/CardIcons.jsx'
import { TIER_COST_BY_TYPE } from '../lib/tierRequirements.js'

// No tier step anymore — "design free, pay at send": the studio is fully
// open from the start, and the card's tier/cost is computed live from what
// actually gets used (see src/lib/tierRequirements.js), shown in the studio's
// own tier meter. This page is just type selection now.
const CARD_TYPES = [
  {
    id: 'personal',
    label: 'Personal Card',
    Icon: PersonalCardIcon,
    desc: 'A cinematic card with envelope reveal, music, media, and effects.',
    accent: '#f0c060',
  },
  {
    id: 'chain',
    label: 'Chain',
    Icon: ChainCardIcon,
    desc: 'Send a card that invites the recipient to reply with their own card back.',
    accent: '#f97316',
  },
  {
    id: 'anonymous',
    label: 'Anonymous',
    Icon: AnonCardIcon,
    desc: 'Let anyone send you anonymous messages wrapped in a designed card.',
    accent: '#7ef7ff',
  },
  {
    id: 'poll',
    label: 'Poll',
    Icon: PollCardIcon,
    desc: 'Ask your audience a question. See live results when they answer.',
    accent: '#60a5fa',
  },
  {
    id: 'trivia',
    label: 'Trivia',
    Icon: TriviaCardIcon,
    desc: 'Quiz your friends. They see their score and correct answers.',
    accent: '#a78bfa',
  },
]

function pricingHint(typeId) {
  const costs = TIER_COST_BY_TYPE[typeId] || TIER_COST_BY_TYPE.personal
  // Base tier prices only -- music, Galaxy, locks etc. add to this, so quote
  // the cheapest paid rung ("from") instead of an "up to" that isn't a ceiling.
  const paid = Object.values(costs).filter((v) => typeof v === 'number' && v > 0)
  return paid.length ? `Free to start · premium from ${Math.min(...paid)} CC` : 'Free to start'
}

function CreateCardPicker() {
  const navigate = useNavigate()

  return (
    <div className="ccp-backdrop" onClick={() => navigate(-1)}>
      <div className="ccp-modal" onClick={e => e.stopPropagation()}>
        <button className="ccp-close" onClick={() => navigate(-1)}>×</button>
        <p className="eyebrow">Create</p>
        <h2 className="ccp-heading">What kind of card?</h2>
        <div className="ccp-type-grid">
          {CARD_TYPES.map(type => (
            <button
              key={type.id}
              className="ccp-type-card"
              style={{ '--type-accent': type.accent }}
              onClick={() => navigate(`/studio?type=${type.id}`, { state: { isNew: true } })}
            >
              <type.Icon size={32} className="ccp-type-icon" />
              <strong className="ccp-type-label">{type.label}</strong>
              <p className="ccp-type-desc">{type.desc}</p>
              <span className="ccp-type-pricing">{pricingHint(type.id)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CreateCardPicker
