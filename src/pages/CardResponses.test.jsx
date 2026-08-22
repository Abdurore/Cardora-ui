import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CardResponses from './CardResponses.jsx'
import { getMyCard, deleteChainEntry } from '../lib/api.js'

// 6.4: originator moderation (delete a chain entry, no tombstone) and the
// terminal-recipient delivery status line -- nothing like either existed
// before this feature.

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useParams: () => ({ slug: 'test-chain' }),
    useOutletContext: () => ({ currentUser: null, balance: 0, openAuthModal: () => {} }),
  }
})

vi.mock('../lib/api.js', () => ({
  getMyCard: vi.fn(),
  revokeCard: vi.fn(),
  releaseCardClaim: vi.fn(),
  deleteChainEntry: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
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
