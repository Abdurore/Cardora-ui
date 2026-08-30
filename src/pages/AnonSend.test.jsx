import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AnonSend from './AnonSend.jsx'
import { getPublicProfile, getActiveAnonymousCard } from '../lib/api.js'

// 6.6: /ask/:username now tries the durable-link resolve first (whichever
// anonymous card the user has marked active) before falling back to the
// old "no inbox connected" messaging.

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateSpy }
})

vi.mock('../lib/api.js', () => ({
  getPublicProfile: vi.fn(),
  getActiveAnonymousCard: vi.fn(),
}))

function renderAt(username) {
  return render(
    <MemoryRouter initialEntries={[`/ask/${username}`]}>
      <Routes>
        <Route path="/ask/:username" element={<AnonSend />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AnonSend — 6.6 durable anonymous link', () => {
  afterEach(() => {
    navigateSpy.mockClear()
    vi.mocked(getPublicProfile).mockReset()
    vi.mocked(getActiveAnonymousCard).mockReset()
  })

  it('redirects to the resolved card when an active inbox is set', async () => {
    vi.mocked(getActiveAnonymousCard).mockResolvedValueOnce({ slug: 'ada-inbox', username: 'ada' })
    renderAt('ada')

    // 5.3: the inbox owner's username IS the card's sender, passed through
    // so CardView's loading screen can say "Preparing Ada's surprise"
    // instead of the fully generic fallback (no SSR embed for this
    // client-side navigation to read instead).
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/card/ada-inbox', { replace: true, state: { senderName: 'ada' } }))
    expect(getPublicProfile).not.toHaveBeenCalled()
  })

  it('falls back to the "no inbox connected" screen when no active inbox is set', async () => {
    vi.mocked(getActiveAnonymousCard).mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }))
    vi.mocked(getPublicProfile).mockResolvedValueOnce({ profile: { username: 'ada' } })
    renderAt('ada')

    await waitFor(() => expect(screen.getByText('No inbox link connected yet')).toBeInTheDocument())
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('shows "User not found" when the username has no account at all', async () => {
    vi.mocked(getActiveAnonymousCard).mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }))
    vi.mocked(getPublicProfile).mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }))
    renderAt('nobody')

    await waitFor(() => expect(screen.getByText('User not found')).toBeInTheDocument())
  })
})
