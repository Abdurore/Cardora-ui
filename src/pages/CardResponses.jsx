import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useOutletContext } from 'react-router-dom'
import { HiOutlineTrophy } from 'react-icons/hi2'
import { getMyCard } from '../lib/api.js'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from '../components/CardIcons.jsx'

const TYPE_META = {
  personal:  { label: 'Responses',       Icon: PersonalCardIcon, color: '#e2b96e' },
  standard:  { label: 'Responses',       Icon: PersonalCardIcon, color: '#e2b96e' },
  moment:    { label: 'Responses',       Icon: PersonalCardIcon, color: '#e2b96e' },
  poll:      { label: 'Poll Results',    Icon: PollCardIcon,     color: '#7eb3ff' },
  trivia:    { label: 'Leaderboard',     Icon: TriviaCardIcon,   color: '#ffe066' },
  chain:     { label: 'Chain Replies',   Icon: ChainCardIcon,    color: '#62ffa2' },
  anonymous: { label: 'Anonymous Inbox', Icon: AnonCardIcon,     color: '#c084fc' },
  anon:      { label: 'Anonymous Inbox', Icon: AnonCardIcon,     color: '#c084fc' },
}

function timeSince(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 0) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function arrayFrom(...values) {
  return values.find(Array.isArray) || []
}

function objectFrom(...values) {
  return values.find(value => value && typeof value === 'object' && !Array.isArray(value)) || {}
}

function normalizeResponsesState(rawCard, type) {
  const state = rawCard?.state || {}
  const stats = rawCard?.stats || rawCard?.analytics || {}

  if (type === 'poll') {
    return {
      ...state,
      votes: arrayFrom(state.votes, state.pollVotes, rawCard.pollVotes, rawCard.votes, stats.votes),
      counts: objectFrom(state.counts, state.voteCounts, state.pollCounts, rawCard.voteCounts, rawCard.pollCounts, stats.counts),
    }
  }

  if (type === 'trivia') {
    return {
      ...state,
      players: arrayFrom(state.players, state.leaderboard, state.submissions, state.responses, rawCard.triviaSubmissions, rawCard.leaderboard),
    }
  }

  if (type === 'chain') {
    return {
      ...state,
      responses: arrayFrom(state.responses, state.replies, state.chainReplies, rawCard.chainReplies, rawCard.responses, rawCard.replies),
    }
  }

  if (type === 'anonymous' || type === 'anon') {
    return {
      ...state,
      responses: arrayFrom(state.responses, state.messages, rawCard.messages, rawCard.responses),
    }
  }

  return state
}

// ── Empty state ───────────────────────────────────────────────────────
function EmptyState({ icon, message }) {
  return (
    <div className="cr-empty">
      <span className="cr-empty-icon">{icon}</span>
      <p className="cr-empty-msg">{message}</p>
    </div>
  )
}

// ── Anonymous inbox ───────────────────────────────────────────────────
function AnonInboxView({ state }) {
  const responses = state?.responses || []
  return (
    <div className="cr-section">
      <div className="cr-section-header">
        <h2 className="cr-section-title">Anonymous Messages</h2>
        <span className="cr-count-badge">{responses.length}</span>
      </div>
      {responses.length === 0 ? (
        <EmptyState icon="👁" message="No messages yet. Share your card link and watch the inbox fill up." />
      ) : (
        <div className="cr-anon-list">
          {[...responses].reverse().map((r, i) => (
            <div key={r.id || i} className="cr-anon-item">
              <div className="cr-anon-avatar">A</div>
              <div className="cr-anon-content">
                <p className="cr-anon-text">{r.text || r.message || '—'}</p>
                <span className="cr-anon-time">{timeSince(r.timestamp || r.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Poll results ──────────────────────────────────────────────────────
function PollResultsView({ state, content }) {
  const votes = state?.votes || []
  const counts = state?.counts || {}
  const options = content?.options || []
  const totalVotes = Object.values(counts).reduce((a, b) => a + Number(b), 0)
    || votes.length
    || 0

  // Sort options by vote count descending
  const sorted = [...options].map((opt, i) => {
    const optId = typeof opt === 'object' ? opt.id : `opt_${i}`
    const optText = typeof opt === 'object' ? opt.text : opt
    const countKeys = [optId, String(i), i, optText].filter(key => key !== undefined && key !== null && key !== '')
    const count = countKeys.reduce((sum, key) => sum + (Number(counts[key]) || 0), 0)
      || votes.filter(v => countKeys.includes(v.optionId) || countKeys.includes(v.option) || countKeys.includes(v.choice)).length
    return { optId, optText, count }
  }).sort((a, b) => b.count - a.count)

  return (
    <div className="cr-section">
      <div className="cr-section-header">
        <h2 className="cr-section-title">Poll Results</h2>
        <span className="cr-count-badge">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
      </div>
      {content?.question && (
        <p className="cr-poll-question">{content.question}</p>
      )}
      {totalVotes === 0 ? (
        <EmptyState icon="📊" message="No votes yet. Share your card to start collecting responses." />
      ) : (
        <div className="cr-poll-bars">
          {sorted.map(({ optId, optText, count }) => {
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
            const isTop = count === sorted[0].count && count > 0
            return (
              <div key={optId} className={`cr-poll-bar ${isTop ? 'cr-poll-bar-top' : ''}`}>
                <div className="cr-poll-bar-label-row">
                  <span className="cr-poll-bar-text">{optText}</span>
                  <span className="cr-poll-bar-pct">{pct}%</span>
                </div>
                <div className="cr-poll-bar-track">
                  <div className="cr-poll-bar-fill" style={{ '--pct': `${pct}%` }} />
                </div>
                <span className="cr-poll-bar-votes">{count} vote{count !== 1 ? 's' : ''}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Trivia leaderboard ────────────────────────────────────────────────
function TriviaLeaderboardView({ state, content }) {
  const players = state?.players || []
  const questions = content?.questions || []
  const total = questions.length || 1

  const ranked = [...players].sort((a, b) => b.score - a.score)
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="cr-section">
      <div className="cr-section-header">
        <h2 className="cr-section-title">Leaderboard</h2>
        <span className="cr-count-badge">{players.length} player{players.length !== 1 ? 's' : ''}</span>
      </div>
      {players.length === 0 ? (
        <EmptyState icon={<HiOutlineTrophy size={32} />} message="No players yet. Share your trivia card to challenge people." />
      ) : (
        <div className="cr-trivia-board">
          {ranked.map((player, i) => {
            const pct = Math.round((player.score / total) * 100)
            return (
              <div key={player.userId || player.id || i} className={`cr-trivia-row ${i === 0 ? 'cr-trivia-row-top' : ''}`}>
                <div className="cr-trivia-rank">
                  {medals[i] || <span className="cr-trivia-rank-num">{i + 1}</span>}
                </div>
                <div className="cr-trivia-player-info">
                  <div className="cr-trivia-avatar">{(player.name || '?')[0].toUpperCase()}</div>
                  <span className="cr-trivia-name">{player.name || 'Anonymous'}</span>
                </div>
                <div className="cr-trivia-score-col">
                  <span className="cr-trivia-score-num">{player.score}<span className="cr-trivia-score-total">/{total}</span></span>
                  <span className={`cr-trivia-pct ${pct === 100 ? 'perfect' : ''}`}>{pct}%</span>
                </div>
                <div className="cr-trivia-bar-mini">
                  <div className="cr-trivia-bar-mini-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Chain replies ─────────────────────────────────────────────────────
function ChainRepliesView({ state, content }) {
  const responses = state?.responses || []

  return (
    <div className="cr-section">
      {(content?.challenge || content?.prompt || content?.heading) && (
        <div className="cr-chain-challenge">
          <p className="cr-chain-challenge-label">Challenge</p>
          <p className="cr-chain-challenge-text">{content.challenge || content.prompt || content.heading}</p>
        </div>
      )}
      <div className="cr-section-header">
        <h2 className="cr-section-title">Chain Replies</h2>
        <span className="cr-count-badge">{responses.length}</span>
      </div>
      {responses.length === 0 ? (
        <EmptyState icon="🔗" message="No replies yet. Share your card to start the chain." />
      ) : (
        <div className="cr-chain-list">
          {[...responses].reverse().map((r, i) => (
            <div key={r.userId || r.id || i} className="cr-chain-item">
              <div className="cr-chain-avatar">
                {(r.name || '?')[0].toUpperCase()}
              </div>
              <div className="cr-chain-body">
                <div className="cr-chain-meta">
                  <span className="cr-chain-name">{r.name || 'Someone'}</span>
                  <span className="cr-chain-time">{timeSince(r.timestamp || r.createdAt)}</span>
                </div>
                <p className="cr-chain-text">{r.response || r.message || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Personal responses ────────────────────────────────────────────────
function PersonalResponsesView({ state, content }) {
  const answers = state?.answers || []
  const hasQuestion = content?.questionBlock?.enabled && content?.questionBlock?.question

  if (!hasQuestion) {
    return (
      <div className="cr-section">
        <EmptyState
          icon="✉"
          message="This is a personal card. Viewers can open and experience it via the shared link."
        />
      </div>
    )
  }

  const yesCount = answers.filter(a => a.answer === 'yes').length
  const noCount = answers.filter(a => a.answer === 'no').length
  const total = answers.length

  return (
    <div className="cr-section">
      <div className="cr-section-header">
        <h2 className="cr-section-title">Question Responses</h2>
        <span className="cr-count-badge">{total}</span>
      </div>
      <p className="cr-poll-question">{content.questionBlock.question}</p>
      {total === 0 ? (
        <EmptyState icon="❓" message="No responses yet." />
      ) : (
        <div className="cr-poll-bars">
          {[{ label: 'Yes ✓', count: yesCount }, { label: 'No', count: noCount }].map(({ label, count }) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={label} className="cr-poll-bar">
                <div className="cr-poll-bar-label-row">
                  <span className="cr-poll-bar-text">{label}</span>
                  <span className="cr-poll-bar-pct">{pct}%</span>
                </div>
                <div className="cr-poll-bar-track">
                  <div className="cr-poll-bar-fill" style={{ '--pct': `${pct}%` }} />
                </div>
                <span className="cr-poll-bar-votes">{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
function CardResponses() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { currentUser, balance, openAuthModal } = useOutletContext()
  const [rawCard, setRawCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  const loadCard = useCallback(async () => {
    try {
      const res = await getMyCard(slug)
      const candidates = [
        res?.card, res?.data?.card,
        res?.renderModel, res?.data?.renderModel,
        res?.result?.card, res?.result,
        res?.data, res,
      ]
      const isCardLike = (c) =>
        c && typeof c === 'object' && !Array.isArray(c) &&
        (c.slug || c._id || c.cardId || c.id || c.config || c.type)
      const backendCard = candidates.find(isCardLike)
      if (backendCard) {
        setRawCard(backendCard)
        setLastRefresh(new Date())
        setError(null)
      } else {
        setError('Card not found')
      }
    } catch (err) {
      setError(err.message || 'Failed to load card data')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { loadCard() }, [loadCard])

  // Auto-refresh chain cards every 30 seconds
  useEffect(() => {
    if (!rawCard) return
    const type = (rawCard.type || '').toLowerCase()
    if (type !== 'chain') return
    const id = setInterval(loadCard, 30000)
    return () => clearInterval(id)
  }, [rawCard, loadCard])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadCard()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="cr-page">
        <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
        <div className="cr-loading"><div className="chat-loading-spinner" /></div>
        <ScreenNav />
      </div>
    )
  }

  if (error || !rawCard) {
    return (
      <div className="cr-page">
        <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
        <div className="cr-loading">
          <p style={{ color: 'rgba(220,242,247,0.6)', marginBottom: 16 }}>{error || 'Card not found'}</p>
          <button className="primary" type="button" onClick={() => navigate('/profile')}>Back to Profile</button>
        </div>
        <ScreenNav />
      </div>
    )
  }

  const type = (rawCard.type || 'personal').toLowerCase()
    .replace('standard', 'personal').replace('moment', 'personal')
  const meta = TYPE_META[type] || TYPE_META.personal
  const Icon = meta.Icon
  const state = normalizeResponsesState(rawCard, type)
  const config = rawCard.config || {}
  const content = config.content || rawCard.content || {}
  const title = rawCard.title || content.header || content.message || content.question || 'Card'
  const createdAt = rawCard.createdAt || rawCard.created_at

  const isChain = type === 'chain'

  return (
    <div className="cr-page">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="cr-wrap">

        {/* Page header */}
        <div className="cr-page-header">
          <button className="cr-back-btn" type="button" onClick={() => navigate('/profile')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            My Cards
          </button>
        </div>

        {/* Card identity */}
        <div className="cr-card-identity">
          <div className="cr-type-chip" style={{ color: meta.color, borderColor: `${meta.color}30`, background: `${meta.color}10` }}>
            <Icon size={13} color={meta.color} />
            <span>{meta.label}</span>
          </div>
          <h1 className="cr-card-title">{title}</h1>
          {createdAt && <p className="cr-card-date">Created {formatDate(createdAt)}</p>}

          <div className="cr-actions-row">
            <button className="cr-action-btn" type="button" onClick={handleRefresh} disabled={refreshing}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                style={{ animation: refreshing ? 'crSpin 0.8s linear infinite' : 'none' }}>
                <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              {refreshing ? 'Refreshing…' : lastRefresh ? `Updated ${timeSince(lastRefresh)}` : 'Refresh'}
            </button>
            {rawCard.slug && (
              <button className="cr-action-btn" type="button"
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/card/${rawCard.slug}`)
                  .then(() => alert('Card link copied!'))}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy Link
              </button>
            )}
          </div>
          {isChain && (
            <p className="cr-live-badge">
              <span className="cr-live-dot" />
              Live · auto-refreshes every 30s
            </p>
          )}
        </div>

        {/* Type-specific content */}
        {(type === 'anonymous' || type === 'anon') && <AnonInboxView state={state} />}
        {type === 'poll' && <PollResultsView state={state} content={content} />}
        {type === 'trivia' && <TriviaLeaderboardView state={state} content={content} />}
        {type === 'chain' && <ChainRepliesView state={state} content={content} />}
        {type === 'personal' && <PersonalResponsesView state={state} content={content} />}

        {/* Slashed Cardora signature animation at the bottom left */}
        <div className="cp-personal-signature" style={{ 
          '--sig-accent': meta.color, 
          color: 'rgba(223, 244, 248, 0.9)', 
          position: 'absolute', 
          left: '24px', 
          bottom: '28px', 
          zIndex: 1 
        }}>
          <span className="cp-personal-signature-cardora">Cardora</span>
        </div>
      </div>
      <ScreenNav />
    </div>
  )
}

export default CardResponses
