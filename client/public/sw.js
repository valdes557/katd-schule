/* Service Worker KATD SCHÜLE — notifications Web Push.
   Rôle minimal : recevoir les push et ouvrir la bonne page au clic.
   (Pas de cache offline agressif pour ne pas casser l'app SPA.) */

self.addEventListener('install', (event) => {
  // Active immédiatement la nouvelle version.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Réception d'une notification push envoyée par le serveur.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'KATD SCHÜLE', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'KATD SCHÜLE'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Clic sur la notification : focus l'onglet existant ou en ouvre un nouveau sur l'URL cible.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Si un onglet de l'app est déjà ouvert, on le focus et on navigue.
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client && targetUrl) client.navigate(targetUrl).catch(() => {})
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
