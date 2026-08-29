// 6.8: custom service worker (injectManifest strategy -- generateSW mode
// can't attach custom `push`/`notificationclick` listeners, only precaching
// and runtime-caching routes). vite-plugin-pwa bundles this file and
// injects the precache manifest into self.__WB_MANIFEST at build time.
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

// SPA offline fallback -- same behavior as the previous generateSW
// navigateFallback: any uncached navigation (e.g. reload while offline)
// still renders the app shell so React Router can take over client-side.
// /api/ is excluded -- those are Vercel's bot-facing meta serverless
// functions, which must hit the network, not the cached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//],
}))

// Web push. Payload is always JSON -- { title, body, actionUrl } -- see
// Backend/Cardora's pushController.js sendPushToUser.
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }
  const { title, body, actionUrl } = payload || {}
  event.waitUntil(
    self.registration.showNotification(title || 'Cardora', {
      body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { actionUrl },
    }),
  )
})

// Mirrors ScreenHeader's in-app notification click handling: focus an
// already-open tab on that route if one exists, otherwise open a new one.
// actionUrl here is always a relative in-app path -- scheduler.js's push
// triggers never emit the absolute/external URLs the 6.3/6.4 in-app-only
// notifications sometimes do.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const actionUrl = event.notification.data?.actionUrl || '/'
  const targetUrl = new URL(actionUrl, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(actionUrl)
    })(),
  )
})
