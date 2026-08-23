import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useOutletContext } from 'react-router-dom'
import { HiOutlineTrophy } from 'react-icons/hi2'
import { getMyCard, revokeCard, releaseCardClaim, deleteChainEntry, getActiveAnonymousCard, setActiveAnonymousCard } from '../lib/api.js'
import { generateAnonShareImage, shareOrDownloadAnonImage } from '../lib/anonShareImage.js'
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
      players: arrayFrom(
        rawCard.triviaSubmissions, rawCard.leaderboard,
        state.players, state.leaderboard, state.submissions, state.responses,
        state.triviaSubmissions, stats.players, stats.leaderboard, stats.submissions,
        rawCard.players, rawCard.submissions,
      ),
      totalQuestions: state.totalQuestions || rawCard.totalQuestions || stats.totalQuestions || 0,
    }
  }

  if (type === 'chain') {
    return {
      ...state,
      responses: arrayFrom(rawCard.chainReplies, state.chainReplies, state.replies, state.responses, rawCard.responses, rawCard.replies),
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
function AnonInboxView({ state, content, username, isActiveInbox, onSetActive, settingActive, activeMsg, onShareImage, sharingImage, shareImageError }) {
  const responses = state?.responses || []
  return (
    <div className="cr-section">
      {/* 6.6: durable anonymous link -- lets the sender point their one
          /ask/:username at this specific anonymous card ("rotate the card
          underneath"). isActiveInbox is null while still resolving. */}
      {isActiveInbox !== null && username && (
        <div className="cr-anon-active-block">
          {isActiveInbox ? (
            <p className="cr-anon-active-note">✓ This is your active /ask/{username} inbox.</p>
          ) : (
            <button type="button" className="cr-anon-active-btn" onClick={onSetActive} disabled={settingActive}>
              {settingActive ? 'Setting…' : `Set as my /ask/${username} inbox`}
            </button>
          )}
          {activeMsg && <p className="cr-anon-active-msg">{activeMsg}</p>}
          {/* 6.6: generated fresh every click from the prompt above, so a
              sender who edited it always gets an up-to-date image --
              "regenerate on prompt change" without persisting anything. */}
          <button type="button" className="cr-anon-active-btn" onClick={onShareImage} disabled={sharingImage}>
            {sharingImage ? 'Preparing image…' : 'Share to status'}
          </button>
          {shareImageError && <p className="cr-anon-active-msg">{shareImageError}</p>}
        </div>
      )}
      {content?.message && (
        <div className="cr-chain-challenge">
          <p className="cr-chain-challenge-label">Your prompt</p>
          <p className="cr-chain-challenge-text">{content.message}</p>
        </div>
      )}
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
                {/* 4.2: anonymous is text-only -- media/voice are no longer
                    rendered even for older messages that still have them. */}
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

// Resolve player display name from the many possible backend field names
function getPlayerName(player) {
  return player.name || player.username || player.displayName || player.playerName || player.user?.username || player.user?.name || ''
}

function TriviaLeaderboardView({ state, content }) {
  const players = state?.players || []
  const [expanded, setExpanded] = useState(null)

  // Find questions from all possible backend locations (mirrors mapBackendCard logic)
  const triviaContent = content?.trivia || content
  const questions = Array.isArray(triviaContent?.questions) ? triviaContent.questions : []
  // Also check state for totalQuestions sent by the submitter
  const totalFromState = state?.totalQuestions || 0
  const total = questions.length || totalFromState || (players.length > 0 ? (players.reduce((max, p) => Math.max(max, p.totalQuestions || 0), 0) || 1) : 1)

  const ranked = [...players].sort((a, b) => (b.score || 0) - (a.score || 0))
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
            const playerScore = player.score || 0
            // Use the player's own totalQuestions if available, otherwise use the card-level total
            const playerTotal = player.totalQuestions || total
            const pct = playerTotal > 0 ? Math.round((playerScore / playerTotal) * 100) : 0
            const displayName = getPlayerName(player) || 'Anonymous'
            const rowKey = player.userId || player.id || i
            const hasAnswers = Array.isArray(player.answers) && questions.length > 0
            const isOpen = expanded === rowKey
            return (
              <div key={rowKey} className="cr-trivia-row-wrap">
                <div
                  className={`cr-trivia-row ${i === 0 ? 'cr-trivia-row-top' : ''} ${hasAnswers ? 'cr-trivia-row-clickable' : ''}`}
                  onClick={hasAnswers ? () => setExpanded(isOpen ? null : rowKey) : undefined}
                  role={hasAnswers ? 'button' : undefined}
                  tabIndex={hasAnswers ? 0 : undefined}
                >
                  <div className="cr-trivia-rank">
                    {medals[i] || <span className="cr-trivia-rank-num">{i + 1}</span>}
                  </div>
                  <div className="cr-trivia-player-info">
                    <div className="cr-trivia-avatar">{displayName[0].toUpperCase()}</div>
                    <span className="cr-trivia-name">{displayName}</span>
                  </div>
                  <div className="cr-trivia-score-col">
                    <span className="cr-trivia-score-num">{playerScore}<span className="cr-trivia-score-total">/{playerTotal}</span></span>
                    <span className={`cr-trivia-pct ${pct === 100 ? 'perfect' : ''}`}>{pct}%</span>
                  </div>
                  <div className="cr-trivia-bar-mini">
                    <div className="cr-trivia-bar-mini-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {hasAnswers && isOpen && (
                  <div className="cr-trivia-answers">
                    {questions.map((q, qi) => {
                      const picked = player.answers[qi]
                      const correct = Number.isInteger(q.correctIndex) ? q.correctIndex : null
                      const isRight = picked === correct
                      const options = Array.isArray(q.options) ? q.options : []
                      return (
                        <div key={qi} className={`cr-trivia-answer-row ${isRight ? 'right' : 'wrong'}`}>
                          <p className="cr-trivia-answer-q">{qi + 1}. {q.question}</p>
                          <p className="cr-trivia-answer-picked">
                            {displayName} picked: {Number.isInteger(picked) ? (options[picked] ?? `Option ${picked + 1}`) : 'No answer'}
                            {isRight ? ' ✓' : ''}
                          </p>
                          {!isRight && correct !== null && (
                            <p className="cr-trivia-answer-correct">Correct answer: {options[correct] ?? `Option ${correct + 1}`}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Chain replies ─────────────────────────────────────────────────────
function ChainRepliesView({ state, content, terminal, chainDelivered, onDeleteEntry }) {
  const responses = state?.responses || []
  const [deletingId, setDeletingId] = useState(null)

  const handleDelete = async (entryId) => {
    setDeletingId(entryId)
    try {
      await onDeleteEntry(entryId)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="cr-section">
      {(content?.challenge || content?.prompt || content?.heading) && (
        <div className="cr-chain-challenge">
          <p className="cr-chain-challenge-label">Challenge</p>
          <p className="cr-chain-challenge-text">{content.challenge || content.prompt || content.heading}</p>
        </div>
      )}
      {Array.isArray(content?.rules) && content.rules.filter(Boolean).length > 0 && (
        <div className="cr-chain-rules">
          <p className="cr-chain-challenge-label">Rules</p>
          <ul className="cr-chain-rules-list">
            {content.rules.filter(Boolean).map((rule, i) => <li key={i}>{rule}</li>)}
          </ul>
        </div>
      )}
      {/* 6.4: terminal recipient + unlock condition status. Presence of
          the object is the signal -- the backend never stores one unless
          the originator turned it on (there's no separate `enabled` flag
          on the stored shape). */}
      {terminal && (
        <div className="cr-chain-terminal">
          {chainDelivered
            ? <p>✓ Delivered to {terminal.recipientName || 'the terminal recipient'}.</p>
            : terminal.unlockType === 'count'
              ? <p>Delivers to {terminal.recipientName || 'the terminal recipient'} after {terminal.unlockCount} contributors ({responses.length} so far).</p>
              : <p>Delivers to {terminal.recipientName || 'the terminal recipient'} on {terminal.unlockAt ? new Date(terminal.unlockAt).toLocaleString() : 'the set date'}.</p>}
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
            <div key={r.id || r.userId || i} className="cr-chain-item">
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
              {/* 6.4: originator moderation -- "delete any entry; deleted
                  entries collapse silently with no tombstone." Entries from
                  before this feature shipped have no id and aren't
                  individually deletable. */}
              {r.id && (
                <button
                  type="button"
                  className="cr-chain-delete-btn"
                  disabled={deletingId === r.id}
                  onClick={() => handleDelete(r.id)}
                >
                  {deletingId === r.id ? '…' : 'Delete'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Gift status (personal cards only) ───────────────────────────────
function GiftStatusBlock({ giftAttachment }) {
  if (!giftAttachment?.inventoryId) return null
  const claimed = giftAttachment.status === 'claimed'
  return (
    <div className={`cr-gift-status ${claimed ? 'cr-gift-status-claimed' : 'cr-gift-status-pending'}`}>
      <span className="cr-gift-status-icon">🎁</span>
      <div className="cr-gift-status-body">
        <p className="cr-gift-status-title">
          {claimed ? 'Gift claimed by the recipient' : 'Gift attached — waiting to be claimed'}
        </p>
        {giftAttachment.priceNgn ? (
          <p className="cr-gift-status-sub">Value: NGN {Number(giftAttachment.priceNgn).toLocaleString()}</p>
        ) : null}
        {claimed && giftAttachment.claimedAt && (
          <p className="cr-gift-status-sub">Claimed {timeSince(giftAttachment.claimedAt)}</p>
        )}
      </div>
    </div>
  )
}

// ── Personal responses ────────────────────────────────────────────────
function ViewsStatBlock({ views, firstOpenedAt }) {
  const count = Number(views) || 0
  return (
    <div className="cr-views-stat">
      <span className="cr-views-stat-num">{count}</span>
      <span className="cr-views-stat-label">{count === 1 ? 'person has' : 'people have'} opened this card's link</span>
      {firstOpenedAt && (
        <span className="cr-views-stat-label">First opened {timeSince(firstOpenedAt)}</span>
      )}
    </div>
  )
}

function PersonalResponsesView({ state, content, giftAttachment, views, firstOpenedAt }) {
  const answers = state?.answers || []
  const hasQuestion = content?.questionBlock?.enabled && content?.questionBlock?.question
  const message = content?.body || content?.message || ''

  if (!hasQuestion) {
    return (
      <div className="cr-section">
        <ViewsStatBlock views={views} firstOpenedAt={firstOpenedAt} />
        <GiftStatusBlock giftAttachment={giftAttachment} />
        {message && (
          <div className="cr-chain-challenge">
            {content?.header && <p className="cr-chain-challenge-label">{content.header}</p>}
            <p className="cr-chain-challenge-text">{message}</p>
          </div>
        )}
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
      <ViewsStatBlock views={views} />
      <GiftStatusBlock giftAttachment={giftAttachment} />
      {message && (
        <div className="cr-chain-challenge">
          {content?.header && <p className="cr-chain-challenge-label">{content.header}</p>}
          <p className="cr-chain-challenge-text">{message}</p>
        </div>
      )}
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
  const [linkCopied, setLinkCopied] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [revokeMsg, setRevokeMsg] = useState('')
  const [releasingClaim, setReleasingClaim] = useState(false)
  const [claimMsg, setClaimMsg] = useState('')
  // 6.6: null while resolving (or not applicable) -- distinguished from
  // false so AnonInboxView doesn't flash "Set as active" before the real
  // answer comes back.
  const [activeAnonSlug, setActiveAnonSlug] = useState(null)
  const [activeAnonResolved, setActiveAnonResolved] = useState(false)
  const [settingActiveAnon, setSettingActiveAnon] = useState(false)
  const [activeAnonMsg, setActiveAnonMsg] = useState('')
  const [sharingAnonImage, setSharingAnonImage] = useState(false)
  const [anonImageError, setAnonImageError] = useState('')

  const loadCard = useCallback(async () => {
    try {
      const res = await getMyCard(slug)
      // Phase 2.2/2.3: GET /cards/:slug's response contract is always
      // {message, card, renderModel} -- res.card is the one real path.
      const isCardLike = (c) =>
        c && typeof c === 'object' && !Array.isArray(c) &&
        (c.slug || c._id || c.cardId || c.id || c.config || c.type)
      let backendCard = isCardLike(res?.card) ? res.card : null
      if (!backendCard) {
        const fallbackCandidates = [
          res?.data?.card,
          res?.renderModel, res?.data?.renderModel,
          res?.result?.card, res?.result,
          res?.data, res,
        ]
        backendCard = fallbackCandidates.find(isCardLike) || null
        if (backendCard) {
          console.warn('[CardResponses] GET /cards/:slug response had no `card` field at the top level -- fell back to a legacy envelope shape. Report this response shape:', JSON.stringify(res)?.slice(0, 400))
        }
      }
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

  // 6.6: resolve whether this specific anonymous card is the one
  // /ask/:username currently points at.
  useEffect(() => {
    if (!rawCard || (rawCard.type || '').toLowerCase() !== 'anonymous' || !currentUser?.username) return
    let cancelled = false
    getActiveAnonymousCard(currentUser.username)
      .then((res) => {
        if (cancelled) return
        setActiveAnonSlug(res?.slug || res?.data?.slug || null)
        setActiveAnonResolved(true)
      })
      .catch(() => {
        if (cancelled) return
        setActiveAnonSlug(null)
        setActiveAnonResolved(true)
      })
    return () => { cancelled = true }
  }, [rawCard, currentUser])

  const handleSetActiveAnon = async () => {
    setSettingActiveAnon(true)
    setActiveAnonMsg('')
    try {
      const cardId = rawCard.id || rawCard.cardId || rawCard._id
      await setActiveAnonymousCard(cardId)
      setActiveAnonSlug(rawCard.slug)
      setActiveAnonResolved(true)
      setActiveAnonMsg('This is now your active /ask link.')
    } catch (err) {
      setActiveAnonMsg(err.message || 'Could not update your active inbox.')
    } finally {
      setSettingActiveAnon(false)
    }
  }

  const handleShareAnonImage = async () => {
    if (!currentUser?.username) return
    setSharingAnonImage(true)
    setAnonImageError('')
    try {
      const colors = rawCard.config?.colors || {}
      // fontFamily deliberately omitted -- "the display serif" is
      // Cardora's own fixed brand serif (the generator's default), not
      // whatever font this card's own theme happens to use.
      const blob = await generateAnonShareImage({
        prompt: content?.message || '',
        username: currentUser.username,
        colors: { background: colors.background, accent: colors.accent },
      })
      await shareOrDownloadAnonImage(blob, `cardora-ask-${currentUser.username}.png`)
    } catch (err) {
      setAnonImageError(err.message || 'Could not generate the share image.')
    } finally {
      setSharingAnonImage(false)
    }
  }

  // 5.5: sender revoke -- immediate kill switch, reversible (the same
  // endpoint reinstates with { revoked: false }).
  const handleToggleRevoke = async () => {
    setRevoking(true)
    setRevokeMsg('')
    try {
      const nextRevoked = !rawCard.isRevoked
      await revokeCard(slug, nextRevoked)
      setRawCard((prev) => ({ ...prev, isRevoked: nextRevoked }))
      setRevokeMsg(nextRevoked ? 'Card withdrawn.' : 'Card reinstated.')
    } catch (err) {
      setRevokeMsg(err.message || 'Could not update this card.')
    } finally {
      setRevoking(false)
    }
  }

  // 6.4: originator moderation -- removes the entry outright, no
  // tombstone. Optimistic local removal since the backend $pull can't fail
  // for any reason the sender needs to see (card/ownership were already
  // confirmed by every earlier render on this page).
  const handleDeleteChainEntry = async (entryId) => {
    await deleteChainEntry(slug, entryId)
    setRawCard((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        responses: (prev.state?.responses || []).filter((r) => r.id !== entryId),
      },
    }))
  }

  // 5.5: lets a new device claim this card fresh -- e.g. the recipient
  // lost their phone, or the sender wants to forward the link to someone
  // else entirely.
  const handleReleaseClaim = async () => {
    setReleasingClaim(true)
    setClaimMsg('')
    try {
      await releaseCardClaim(slug)
      setClaimMsg('Claim released — the next device to open this card will claim it.')
    } catch (err) {
      setClaimMsg(err.message || 'Could not release the claim.')
    } finally {
      setReleasingClaim(false)
    }
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
  // For trivia, questions may be nested under config.trivia, rawCard.trivia, etc.
  const layout = rawCard.layoutdata || rawCard.layoutData || {}
  const triviaContent = {
    ...content,
    trivia: content.trivia || config.trivia || rawCard.trivia || layout.trivia || null,
    questions: content.questions || (content.trivia || config.trivia || rawCard.trivia || layout.trivia || {}).questions || [],
  }
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
              <button className={`cr-action-btn ${linkCopied ? 'copied' : ''}`} type="button"
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/card/${rawCard.slug}`)
                  .then(() => {
                    setLinkCopied(true)
                    setTimeout(() => setLinkCopied(false), 1600)
                  })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                {linkCopied ? '✨ Copied' : 'Copy Link'}
              </button>
            )}
            <button
              className={`cr-action-btn ${rawCard.isRevoked ? 'copied' : ''}`}
              type="button"
              onClick={handleToggleRevoke}
              disabled={revoking}
            >
              {revoking ? 'Working…' : rawCard.isRevoked ? 'Reinstate card' : 'Withdraw card'}
            </button>
            {(rawCard.type || '').toLowerCase() === 'personal' && rawCard.firstOpenedAt && (
              <button className="cr-action-btn" type="button" onClick={handleReleaseClaim} disabled={releasingClaim}>
                {releasingClaim ? 'Working…' : 'Release claim'}
              </button>
            )}
          </div>
          {revokeMsg && <p className="cr-card-date">{revokeMsg}</p>}
          {claimMsg && <p className="cr-card-date">{claimMsg}</p>}
          {isChain && (
            <p className="cr-live-badge">
              <span className="cr-live-dot" />
              Live · auto-refreshes every 30s
            </p>
          )}
        </div>

        {state?.reactions?.length > 0 && (
          <div className="cr-reactions-summary">
            {Object.entries(
              state.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .map(([emoji, count]) => (
                <span key={emoji} className="cr-reaction-chip">{emoji} {count}</span>
              ))}
          </div>
        )}

        {/* Type-specific content */}
        {(type === 'anonymous' || type === 'anon') && (
          <AnonInboxView
            state={state}
            content={content}
            username={currentUser?.username}
            isActiveInbox={activeAnonResolved ? activeAnonSlug === rawCard.slug : null}
            onSetActive={handleSetActiveAnon}
            settingActive={settingActiveAnon}
            activeMsg={activeAnonMsg}
            onShareImage={handleShareAnonImage}
            sharingImage={sharingAnonImage}
            shareImageError={anonImageError}
          />
        )}
        {type === 'poll' && <PollResultsView state={state} content={content} />}
        {type === 'trivia' && <TriviaLeaderboardView state={state} content={triviaContent} />}
        {type === 'chain' && (
          <ChainRepliesView
            state={state}
            content={content}
            terminal={layout.styleExtras?.chainTerminal || null}
            chainDelivered={!!rawCard.chainDelivered}
            onDeleteEntry={handleDeleteChainEntry}
          />
        )}
        {type === 'personal' && <PersonalResponsesView state={state} content={content} giftAttachment={rawCard.giftAttachment} views={rawCard.views} firstOpenedAt={rawCard.firstOpenedAt} />}

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
