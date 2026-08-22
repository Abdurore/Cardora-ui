import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ScreenHeader from './ScreenHeader.jsx'
import { getNotifications, markNotificationRead } from '../lib/api.js'

// 6.2: the notification bell is new -- nothing like it existed before.

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateSpy }
})

vi.mock('../lib/api.js', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}))

function renderHeader(user) {
  return render(
    <MemoryRouter>
      <ScreenHeader user={user} balance={0} onAuthOpen={() => {}} />
    </MemoryRouter>,
  )
}

describe('ScreenHeader — notification bell', () => {
  afterEach(() => {
    navigateSpy.mockClear()
    vi.mocked(getNotifications).mockReset()
    vi.mocked(markNotificationRead).mockReset()
  })

  it('does not render the bell at all for a signed-out visitor', () => {
    renderHeader(null)
    expect(screen.queryByLabelText('Notifications')).not.toBeInTheDocument()
    expect(getNotifications).not.toHaveBeenCalled()
  })

  it('shows the unread count badge once notifications load', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [{ id: 'n1', title: "Ada's Birthday is in 5 days", body: 'Create a card.', read: false }],
      unreadCount: 1,
    })
    renderHeader({ id: 'u1', username: 'test' })

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
  })

  it('opening a notification marks it read and navigates to its action url', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [{ id: 'n1', title: "Ada's Birthday is in 5 days", body: 'Create a card.', read: false, actionUrl: '/quick?type=personal' }],
      unreadCount: 1,
    })
    vi.mocked(markNotificationRead).mockResolvedValue({})
    renderHeader({ id: 'u1', username: 'test' })

    await waitFor(() => screen.getByLabelText('Notifications'))
    fireEvent.click(screen.getByLabelText('Notifications'))
    fireEvent.click(screen.getByText("Ada's Birthday is in 5 days"))

    expect(markNotificationRead).toHaveBeenCalledWith('n1')
    expect(navigateSpy).toHaveBeenCalledWith('/quick?type=personal')
  })

  it('does not re-mark an already-read notification', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      notifications: [{ id: 'n1', title: 'Old one', body: 'x', read: true, actionUrl: '/profile' }],
      unreadCount: 0,
    })
    renderHeader({ id: 'u1', username: 'test' })

    await waitFor(() => screen.getByLabelText('Notifications'))
    fireEvent.click(screen.getByLabelText('Notifications'))
    fireEvent.click(screen.getByText('Old one'))

    expect(markNotificationRead).not.toHaveBeenCalled()
    expect(navigateSpy).toHaveBeenCalledWith('/profile')
  })

  it('shows an empty state when there are no notifications', async () => {
    vi.mocked(getNotifications).mockResolvedValue({ notifications: [], unreadCount: 0 })
    renderHeader({ id: 'u1', username: 'test' })

    await waitFor(() => screen.getByLabelText('Notifications'))
    fireEvent.click(screen.getByLabelText('Notifications'))

    expect(screen.getByText('Nothing yet.')).toBeInTheDocument()
  })
})
