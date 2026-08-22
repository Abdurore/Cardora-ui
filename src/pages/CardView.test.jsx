import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CardView from './CardView.jsx'
import { getCardBySlug, notifyMeForScheduledCard } from '../lib/api.js'

// 5.1: api/card-meta.js embeds window.__CARDORA_SSR_CARD__ so the very
// first client paint matches the server-rendered gate with zero flash,
// instead of always showing a generic "Preparing your surprise" spinner.

vi.mock('../lib/api.js', () => ({
  // Never resolves -- keeps the component in its loading state for the
  // whole test, which is exactly the state under test here.
  getCardBySlug: vi.fn(() => new Promise(() => {})),
  submitCardResponse: vi.fn(),
  submitPollVote: vi.fn(),
  submitChainReply: vi.fn(),
  submitTriviaAnswer: vi.fn(),
  sendCardAnonymousMessage: vi.fn(),
  reactToCard: vi.fn(),
  notifyMeForScheduledCard: vi.fn(),
}))

function renderAt(slug) {
  return render(
    <MemoryRouter initialEntries={[`/card/${slug}`]}>
      <Routes>
        <Route path="/card/:id" element={<CardView />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CardView — SSR gate handoff', () => {
  afterEach(() => {
    delete window.__CARDORA_SSR_CARD__
  })

  it('renders the embedded sender/title immediately instead of the generic spinner', () => {
    window.__CARDORA_SSR_CARD__ = { slug: 'abc123', senderName: 'Ada', title: 'Happy Birthday!' }

    renderAt('abc123')

    expect(screen.getByText('Ada sent you a card')).toBeInTheDocument()
    expect(screen.getByText('Happy Birthday!')).toBeInTheDocument()
    expect(screen.queryByText('Preparing your surprise')).not.toBeInTheDocument()
  })

  it('falls back to the generic spinner when no SSR data was embedded', () => {
    renderAt('abc123')

    expect(screen.getByText('Preparing your surprise')).toBeInTheDocument()
  })

  it('ignores a stale embed left over from a different card slug', () => {
    window.__CARDORA_SSR_CARD__ = { slug: 'a-different-card', senderName: 'Ada', title: 'Happy Birthday!' }

    renderAt('abc123')

    expect(screen.getByText('Preparing your surprise')).toBeInTheDocument()
    expect(screen.queryByText('Ada sent you a card')).not.toBeInTheDocument()
  })

  it('consumes the global so a later read (e.g. a second mount) never reuses it', () => {
    window.__CARDORA_SSR_CARD__ = { slug: 'abc123', senderName: 'Ada', title: 'Happy Birthday!' }

    renderAt('abc123')

    expect(window.__CARDORA_SSR_CARD__).toBeUndefined()
  })

  it('falls back to "Someone" when the embed has no sender name', () => {
    window.__CARDORA_SSR_CARD__ = { slug: 'abc123', senderName: '', title: 'Happy Birthday!' }

    renderAt('abc123')

    expect(screen.getByText('Someone sent you a card')).toBeInTheDocument()
  })
})

// 5.5: revoke and first-open-claim each get their own dedicated screen --
// not a generic error, not a 404 -- per the master prompt's failure-states
// table (6.9) and card-privacy spec (5.5).
describe('CardView — 5.5 blocked states', () => {
  it('shows a dedicated screen when the card was revoked by the sender', async () => {
    const err = new Error('Gone')
    err.status = 410
    err.payload = { revoked: true, message: 'This card was withdrawn by the sender.' }
    vi.mocked(getCardBySlug).mockRejectedValueOnce(err)

    renderAt('abc123')

    await waitFor(() => expect(screen.getByText('This card was withdrawn by the sender.')).toBeInTheDocument())
    expect(screen.getByText('This card was withdrawn')).toBeInTheDocument()
  })

  it('shows a dedicated screen when a different device already claimed the card', async () => {
    const err = new Error('Conflict')
    err.status = 409
    err.payload = { alreadyOpened: true, message: 'This card has already been opened by its recipient.' }
    vi.mocked(getCardBySlug).mockRejectedValueOnce(err)

    renderAt('abc123')

    await waitFor(() => expect(screen.getByText('This card has already been opened by its recipient.')).toBeInTheDocument())
    expect(screen.getByText('Already opened')).toBeInTheDocument()
  })
})

// 6.3: scheduled send. The backend gate is also a 403, like the password
// lock -- these tests exist specifically to prove the two never get
// conflated (a real bug caught while building this: the password-lock
// branch checked `err.status === 403` with no further narrowing, so it
// would have matched every scheduled-and-not-yet-due card too).
describe('CardView — 6.3 scheduled send', () => {
  afterEach(() => {
    vi.mocked(notifyMeForScheduledCard).mockClear()
  })

  it('shows the countdown/notify-me gate, not the password gate, for a scheduled 403', async () => {
    const unlockAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const err = new Error('Not yet')
    err.status = 403
    err.payload = { scheduled: true, unlockAt, message: "This card isn't open yet." }
    vi.mocked(getCardBySlug).mockRejectedValueOnce(err)

    renderAt('abc123')

    await waitFor(() => expect(screen.getByText("This card isn't open yet")).toBeInTheDocument())
    expect(screen.queryByText('This card is locked')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Password…')).not.toBeInTheDocument()
  })

  it('submits the notify-me email and shows a confirmation', async () => {
    const unlockAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const err = new Error('Not yet')
    err.status = 403
    err.payload = { scheduled: true, unlockAt }
    vi.mocked(getCardBySlug).mockRejectedValueOnce(err)
    vi.mocked(notifyMeForScheduledCard).mockResolvedValueOnce({ message: 'ok' })

    renderAt('abc123')

    await waitFor(() => expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'fan@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Notify me when it opens/i }))

    await waitFor(() => expect(notifyMeForScheduledCard).toHaveBeenCalledWith('abc123', 'fan@example.com'))
    await waitFor(() => expect(screen.getByText("We'll email you when it opens.")).toBeInTheDocument())
  })

  it('rejects submitting an empty email without calling the API', async () => {
    const unlockAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const err = new Error('Not yet')
    err.status = 403
    err.payload = { scheduled: true, unlockAt }
    vi.mocked(getCardBySlug).mockRejectedValueOnce(err)

    renderAt('abc123')

    await waitFor(() => expect(screen.getByRole('button', { name: /Notify me when it opens/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Notify me when it opens/i }))

    expect(screen.getByText('Enter an email address.')).toBeInTheDocument()
    expect(notifyMeForScheduledCard).not.toHaveBeenCalled()
  })
})
