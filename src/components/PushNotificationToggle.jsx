import { useEffect, useState } from 'react'
import { subscribeToPush, unsubscribeFromPush } from '../lib/api.js'

// 6.8: web push opt-in. No existing UI trigger point for this (unlike the
// install prompt, which the spec pinned to "after first send"), so it's a
// Profile settings toggle -- self-contained like RemindersSection, only
// needs currentUser to know whether to render.

// PushManager.subscribe wants applicationServerKey as a Uint8Array; VITE_
// env vars are always strings. Standard base64url decode (MDN's web-push
// sample) -- there's no built-in browser helper for it.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function isPushSupported() {
  // No VAPID key baked into the build means subscribe() can only throw, so
  // don't offer a button that always fails.
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return false
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function PushNotificationToggle({ currentUser }) {
  // checking | unsupported | denied | subscribed | unsubscribed
  const [status, setStatus] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser) return
    if (!isPushSupported()) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }

    let cancelled = false
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => { if (!cancelled) setStatus(subscription ? 'subscribed' : 'unsubscribed') })
      .catch(() => { if (!cancelled) setStatus('unsubscribed') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  if (!currentUser || status === 'checking' || status === 'unsupported') return null

  const handleEnable = async () => {
    setBusy(true)
    setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const { endpoint, keys } = subscription.toJSON()
      await subscribeToPush({ endpoint, keys })
      setStatus('subscribed')
    } catch {
      setError('Could not enable notifications. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    setBusy(true)
    setError('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        // Drop the backend record even if the local unsubscribe below throws
        // -- a stale endpoint on the server just wastes one push attempt
        // (pruned automatically on its next 404/410), whereas leaving the
        // backend row behind on a client-side failure keeps pushing someone
        // who asked to stop.
        await unsubscribeFromPush(subscription.endpoint).catch(() => {})
        await subscription.unsubscribe()
      }
      setStatus('unsubscribed')
    } catch {
      setError('Could not disable notifications. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-push">
      <div className="profile-push-head">
        <h4 className="section-title">Push Notifications</h4>
      </div>
      <p className="profile-push-desc">
        {status === 'denied'
          ? 'Notifications are blocked in your browser settings.'
          : status === 'subscribed'
            ? 'Get notified when your cards are opened, unlock, or someone replies.'
            : 'Turn on notifications for card opens, unlocks, and replies.'}
      </p>
      {error && <p className="profile-push-error">{error}</p>}
      {status !== 'denied' && (
        <button
          type="button"
          className={status === 'subscribed' ? 'ghost' : 'primary'}
          onClick={status === 'subscribed' ? handleDisable : handleEnable}
          disabled={busy}
        >
          {busy ? 'Working…' : status === 'subscribed' ? 'Turn off' : 'Turn on'}
        </button>
      )}
    </div>
  )
}

export default PushNotificationToggle
