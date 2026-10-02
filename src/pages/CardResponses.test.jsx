import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CardResponses from './CardResponses.jsx'
import { getMyCard, deleteChainEntry, getActiveAnonymousCard, setActiveAnonymousCard, extendCardLifetime, raiseCardViewCap } from '../lib/api.js'
import { generateAnonShareImage, shareOrDownloadAnonImage } from '../lib/anonShareImage.js'

// 6.4: originator moderation (delete a chain entry, no tombstone) and the
// terminal-recipient delivery status line -- nothing like either existed
// before this feature.
// 6.6: "set as my /ask/:username inbox" -- lets the sender point their one
// durable link at this specific anonymous card.

const navigateSpy = vi.fn()
let outletContext = { currentUser: { username: 'owner' }, balance: 0, openAuthModal: () => {} }
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useParams: () => ({ slug: 'test-chain' }),
    useOutletContext: () => outletContext,
  }
})

vi.mock('../lib/api.js', () => ({
  getMyCard: vi.fn(),
  revokeCard: vi.fn(),
  releaseCardClaim: vi.fn(),
  deleteChainEntry: vi.fn(),
  getActiveAnonymousCard: vi.fn(),
  setActiveAnonymousCard: vi.fn(),
  extendCardLifetime: vi.fn(),
  raiseCardViewCap: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}))

vi.mock('../lib/anonShareImage.js', () => ({
  generateAnonShareImage: vi.fn(),
  shareOrDownloadAnonImage: vi.fn(),
}))

function chainCard(overrides = {}) {
  return {
    slug: 'test-chain',
    type: 'chain',
    config: { content: { challenge: 'Add your memory', rules: [] } },
    layoutdata: {},
    state: {
      responses: [
        { id: 'e1', userId: 'guest:1', name: 'Bo', response: 'First entry', timestamp: new Date().toISOString() },
        { id: 'e2', userId: 'guest:2', name: 'Cy', response: 'Second entry', timestamp: new Date().toISOString() },
      ],
    },
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CardResponses />
    </MemoryRouter>,
  )
}

describe('CardResponses — 6.4 chain moderation', () => {
  afterEach(() => {
    vi.mocked(getMyCard).mockReset()
    vi.mocked(deleteChainEntry).mockReset()
  })

  it('shows a Delete button for entries that have an id', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard() })
    renderPage()

    await waitFor(() => expect(screen.getByText('First entry')).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2)
  })

  it('does not show a Delete button for an entry with no id (pre-6.4 data)', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({
      card: chainCard({ state: { responses: [{ userId: 'guest:1', name: 'Bo', response: 'Old entry', timestamp: new Date().toISOString() }] } }),
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Old entry')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('deleting an entry calls the API and removes it optimistically, with no tombstone', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard() })
    vi.mocked(deleteChainEntry).mockResolvedValueOnce({ message: 'Entry removed' })
    renderPage()

    await waitFor(() => expect(screen.getByText('First entry')).toBeInTheDocument())
    // The feed renders newest-first ([...responses].reverse()), so index 0
    // is "Second entry" (id e2), not "First entry".
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    await waitFor(() => expect(deleteChainEntry).toHaveBeenCalledWith('test-chain', 'e2'))
    await waitFor(() => expect(screen.queryByText('Second entry')).not.toBeInTheDocument())
    expect(screen.getByText('First entry')).toBeInTheDocument()
    expect(screen.queryByText(/deleted/i)).not.toBeInTheDocument()
  })

  it('shows the count-based terminal delivery status before delivery', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({
      card: chainCard({ layoutdata: { styleExtras: { chainTerminal: { recipientName: 'Ada', unlockType: 'count', unlockCount: 5 } } } }),
    })
    renderPage()

    await waitFor(() => expect(screen.getByText(/Delivers to Ada after 5 contributors/)).toBeInTheDocument())
  })

  it('shows the delivered status once chainDelivered is true', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({
      card: chainCard({
        chainDelivered: true,
        layoutdata: { styleExtras: { chainTerminal: { recipientName: 'Ada', unlockType: 'count', unlockCount: 2 } } },
      }),
    })
    renderPage()

    await waitFor(() => expect(screen.getByText(/Delivered to Ada/)).toBeInTheDocument())
  })

  it('shows no terminal status line at all for an open-ended chain', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard() })
    renderPage()

    await waitFor(() => expect(screen.getByText('First entry')).toBeInTheDocument())
    expect(screen.queryByText(/Delivers to|Delivered to/)).not.toBeInTheDocument()
  })
})

function anonCard(overrides = {}) {
  return {
    id: 'card_1',
    slug: 'ada-inbox',
    type: 'anonymous',
    config: { content: { message: 'Send me a secret!' } },
    state: { responses: [] },
    ...overrides,
  }
}

describe('CardResponses — 6.6 durable anonymous link', () => {
  afterEach(() => {
    vi.mocked(getMyCard).mockReset()
    vi.mocked(getActiveAnonymousCard).mockReset()
    vi.mocked(setActiveAnonymousCard).mockReset()
    vi.mocked(generateAnonShareImage).mockReset()
    vi.mocked(shareOrDownloadAnonImage).mockReset()
    outletContext = { currentUser: { username: 'owner' }, balance: 0, openAuthModal: () => {} }
  })

  it('shows "Set as active" when this card is not the resolved active inbox', async () => {
    outletContext = { currentUser: { username: 'ada' }, balance: 0, openAuthModal: () => {} }
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: anonCard() })
    vi.mocked(getActiveAnonymousCard).mockResolvedValueOnce({ slug: 'some-other-card' })
    renderPage()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Set as my /ask/ada inbox' })).toBeInTheDocument())
  })

  it('shows the active-inbox note when this card is the resolved active inbox', async () => {
    outletContext = { currentUser: { username: 'ada' }, balance: 0, openAuthModal: () => {} }
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: anonCard() })
    vi.mocked(getActiveAnonymousCard).mockResolvedValueOnce({ slug: 'ada-inbox' })
    renderPage()

    await waitFor(() => expect(screen.getByText('✓ This is your active /ask/ada inbox.')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Set as my/ })).not.toBeInTheDocument()
  })

  it('clicking "Set as active" calls the API and flips to the active note', async () => {
    outletContext = { currentUser: { username: 'ada' }, balance: 0, openAuthModal: () => {} }
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: anonCard() })
    vi.mocked(getActiveAnonymousCard).mockResolvedValueOnce({ slug: 'some-other-card' })
    vi.mocked(setActiveAnonymousCard).mockResolvedValueOnce({ message: 'ok' })
    renderPage()

    const btn = await screen.findByRole('button', { name: 'Set as my /ask/ada inbox' })
    fireEvent.click(btn)

    await waitFor(() => expect(setActiveAnonymousCard).toHaveBeenCalledWith('card_1'))
    await waitFor(() => expect(screen.getByText('✓ This is your active /ask/ada inbox.')).toBeInTheDocument())
  })

  it('shows neither state while still resolving (no flash of the wrong one)', async () => {
    outletContext = { currentUser: { username: 'ada' }, balance: 0, openAuthModal: () => {} }
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: anonCard() })
    vi.mocked(getActiveAnonymousCard).mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    await waitFor(() => expect(screen.getByText('Your prompt')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Set as my/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/This is your active/)).not.toBeInTheDocument()
  })

  it('clicking "Share to status" generates a fresh image from the current prompt', async () => {
    outletContext = { currentUser: { username: 'ada' }, balance: 0, openAuthModal: () => {} }
    vi.mocked(getMyCard).mockResolvedValueOnce({
      card: anonCard({ config: { colors: { background: '#111', accent: '#7ef7ff' }, content: { message: 'Send me a secret!' } } }),
    })
    vi.mocked(getActiveAnonymousCard).mockResolvedValueOnce({ slug: 'ada-inbox' })
    const fakeBlob = new Blob(['fake'], { type: 'image/png' })
    vi.mocked(generateAnonShareImage).mockResolvedValueOnce(fakeBlob)
    vi.mocked(shareOrDownloadAnonImage).mockResolvedValueOnce()
    renderPage()

    const btn = await screen.findByRole('button', { name: 'Share to status' })
    fireEvent.click(btn)

    await waitFor(() => expect(generateAnonShareImage).toHaveBeenCalledWith({
      prompt: 'Send me a secret!',
      username: 'ada',
      colors: { background: '#111', accent: '#7ef7ff' },
    }))
    await waitFor(() => expect(shareOrDownloadAnonImage).toHaveBeenCalledWith(fakeBlob, 'cardora-ask-ada.png'))
  })
})

describe('CardResponses — 6.7 card retention', () => {
  afterEach(() => {
    vi.mocked(getMyCard).mockReset()
    vi.mocked(extendCardLifetime).mockReset()
  })

  it('shows the closing date and an extend button for a card with an active expiry', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard({ id: 'card_1', expiresAt: '2026-06-15T00:00:00.000Z' }) })
    renderPage()

    await waitFor(() => expect(screen.getByText(/Closes/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Extend lifetime (3 CC)' })).toBeInTheDocument()
  })

  it('shows neither for a card that never expires', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard({ id: 'card_1', expiresAt: null }) })
    renderPage()

    await waitFor(() => expect(screen.getByText('Add your memory')).toBeInTheDocument())
    expect(screen.queryByText(/Closes/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Extend lifetime/ })).not.toBeInTheDocument()
  })

  it('accounts for bonusLifetimeDays when displaying the closing date', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({
      card: chainCard({ id: 'card_1', expiresAt: '2026-06-15T00:00:00.000Z', bonusLifetimeDays: 365 }),
    })
    renderPage()

    await waitFor(() => expect(screen.getByText(/Closes/)).toBeInTheDocument())
    // 2026-06-15 + 365 days -> 2027-06-15, not the raw stored date.
    expect(screen.getByText(/Jun 15, 2027/)).toBeInTheDocument()
  })

  it('clicking "Extend lifetime" calls the API and updates the shown closing date', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard({ id: 'card_1', expiresAt: '2026-06-15T00:00:00.000Z' }) })
    vi.mocked(extendCardLifetime).mockResolvedValueOnce({ message: 'ok' })
    renderPage()

    const btn = await screen.findByRole('button', { name: 'Extend lifetime (3 CC)' })
    fireEvent.click(btn)

    await waitFor(() => expect(extendCardLifetime).toHaveBeenCalledWith('card_1'))
    await waitFor(() => expect(screen.getByText(/Jun 15, 2027/)).toBeInTheDocument())
    expect(screen.getByText('Extended by 12 months.')).toBeInTheDocument()
  })
})

describe('CardResponses — 6.9 view cap', () => {
  afterEach(() => {
    vi.mocked(getMyCard).mockReset()
    vi.mocked(raiseCardViewCap).mockReset()
  })

  it('shows the view count and a raise button for a classic card', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard({ id: 'card_1', tier: 'classic', views: 42 }) })
    renderPage()

    await waitFor(() => expect(screen.getByText('Views 42 / 100')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Raise view cap (2 CC)' })).toBeInTheDocument()
  })

  it('accounts for viewCapBonus when displaying the effective cap', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard({ id: 'card_1', tier: 'premium', views: 520, viewCapBonus: 3 }) })
    renderPage()

    // 500 + 3*50 = 650
    await waitFor(() => expect(screen.getByText('Views 520 / 650')).toBeInTheDocument())
  })

  it('shows neither for an elite (unlimited) card', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard({ id: 'card_1', tier: 'elite', views: 42 }) })
    renderPage()

    await waitFor(() => expect(screen.getByText('Add your memory')).toBeInTheDocument())
    expect(screen.queryByText(/^Views /)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Raise view cap/ })).not.toBeInTheDocument()
  })

  it('shows neither for an anonymous card regardless of tier (6.6 exemption)', async () => {
    vi.mocked(getActiveAnonymousCard).mockResolvedValueOnce({})
    vi.mocked(getMyCard).mockResolvedValueOnce({
      card: chainCard({ id: 'card_1', type: 'anonymous', tier: 'classic', views: 42, config: { content: { message: 'Ask away' } } }),
    })
    renderPage()

    await waitFor(() => expect(screen.queryByRole('button', { name: /Raise view cap/ })).not.toBeInTheDocument())
  })

  it('clicking "Raise view cap" calls the API and updates the shown cap', async () => {
    vi.mocked(getMyCard).mockResolvedValueOnce({ card: chainCard({ id: 'card_1', tier: 'classic', views: 42 }) })
    vi.mocked(raiseCardViewCap).mockResolvedValueOnce({ message: 'ok' })
    renderPage()

    const btn = await screen.findByRole('button', { name: 'Raise view cap (2 CC)' })
    fireEvent.click(btn)

    await waitFor(() => expect(raiseCardViewCap).toHaveBeenCalledWith('card_1'))
    await waitFor(() => expect(screen.getByText('Views 42 / 150')).toBeInTheDocument())
    expect(screen.getByText('View cap raised by 50.')).toBeInTheDocument()
  })
})

// An anonymous GET /cards/:slug is a recipient open as far as the backend
// can tell -- it claims a Personal Card, counts a view, and notifies the
// sender. This owner-only page must never make one.
describe('CardResponses — never fetches without a settled session', () => {
  afterEach(() => {
    vi.mocked(getMyCard).mockReset()
    outletContext = { currentUser: { username: 'owner' }, balance: 0, openAuthModal: () => {} }
  })

  it('does not fetch while the session is still hydrating', async () => {
    outletContext = { currentUser: null, authReady: false, balance: 0, openAuthModal: () => {} }
    renderPage()

    await new Promise((r) => setTimeout(r, 20))
    expect(getMyCard).not.toHaveBeenCalled()
  })

  it('does not fetch when signed out, and offers sign-in instead', async () => {
    const openAuthModal = vi.fn()
    outletContext = { currentUser: null, authReady: true, balance: 0, openAuthModal }
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in to view' }))
    expect(openAuthModal).toHaveBeenCalled()
    expect(getMyCard).not.toHaveBeenCalled()
  })
})
