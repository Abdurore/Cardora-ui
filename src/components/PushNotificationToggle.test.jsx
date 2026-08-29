import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PushNotificationToggle from './PushNotificationToggle.jsx'
import { subscribeToPush, unsubscribeFromPush } from '../lib/api.js'

// 6.8: web push opt-in toggle -- nothing like it existed before. jsdom has
// no real Notification/PushManager/serviceWorker implementation, so every
// browser API this component touches is stubbed per test.

vi.mock('../lib/api.js', () => ({
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}))

const USER = { id: 'u1' }

function stubSupport({ permission = 'default', existingSubscription = null } = {}) {
  const unsubscribe = vi.fn().mockResolvedValue(true)
  const subscription = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' }, toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe }
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(existingSubscription ? subscription : null),
    subscribe: vi.fn().mockResolvedValue(subscription),
  }
  const registration = { pushManager }

  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn().mockResolvedValue(permission === 'denied' ? 'denied' : 'granted') })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  })
  vi.stubGlobal('PushManager', function () {})

  return { pushManager, subscription, unsubscribe }
}

function clearSupport() {
  vi.unstubAllGlobals()
  delete navigator.serviceWorker
}

describe('PushNotificationToggle', () => {
  beforeEach(() => {
    vi.mocked(subscribeToPush).mockReset().mockResolvedValue({})
    vi.mocked(unsubscribeFromPush).mockReset().mockResolvedValue({})
  })

  afterEach(() => {
    clearSupport()
  })

  it('renders nothing for a signed-out visitor', () => {
    stubSupport()
    render(<PushNotificationToggle currentUser={null} />)
    expect(screen.queryByText('Push Notifications')).not.toBeInTheDocument()
  })

  it('renders nothing when the browser has no push support', async () => {
    clearSupport()
    render(<PushNotificationToggle currentUser={USER} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText('Push Notifications')).not.toBeInTheDocument()
  })

  it('shows a blocked message with no button when permission is denied', async () => {
    stubSupport({ permission: 'denied' })
    render(<PushNotificationToggle currentUser={USER} />)
    await waitFor(() => expect(screen.getByText('Push Notifications')).toBeInTheDocument())
    expect(screen.getByText('Notifications are blocked in your browser settings.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows "Turn on" when not yet subscribed and subscribes on click', async () => {
    stubSupport({ permission: 'default', existingSubscription: false })
    render(<PushNotificationToggle currentUser={USER} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }))

    await waitFor(() => expect(subscribeToPush).toHaveBeenCalledWith({
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p', auth: 'a' },
    }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn off' })).toBeInTheDocument())
  })

  it('shows "Turn off" when already subscribed and unsubscribes on click', async () => {
    const { subscription } = stubSupport({ permission: 'granted', existingSubscription: true })
    render(<PushNotificationToggle currentUser={USER} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn off' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))

    await waitFor(() => expect(unsubscribeFromPush).toHaveBeenCalledWith(subscription.endpoint))
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument())
  })

  it('shows an error message and stays on "Turn on" if subscribing throws', async () => {
    const { pushManager } = stubSupport({ permission: 'default', existingSubscription: false })
    pushManager.subscribe.mockRejectedValue(new Error('nope'))
    render(<PushNotificationToggle currentUser={USER} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }))

    await waitFor(() => expect(screen.getByText('Could not enable notifications. Try again.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument()
  })
})
