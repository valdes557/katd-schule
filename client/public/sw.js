/* Service Worker KATD SCHÜLE — Notifications Web Push & Fonctionnement Hors-Ligne (Offline).
   Pre-cache du shell SPA, mise en cache dynamique des scripts/styles et fallback hors-ligne. */

const CACHE_STATIC = 'katd-static-v2'
const CACHE_API = 'katd-api-v2'

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
]

// Installation : pré-mise en cache du shell de l'application
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW Precache warning]:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activation : nettoyage des anciens caches et prise de contrôle immédiate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_STATIC && k !== CACHE_API) {
            return caches.delete(k)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Stratégie de requêtes : Offline first pour assets, Network first pour API et navigation
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Ignore les requêtes non-GET ou de protocoles spéciaux (chrome-extension, etc.)
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return
  }

  // 1. Navigation SPA (Pages HTML) : Network-First avec fallback vers index.html en cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          // Met à jour la copie en cache
          const resClone = networkRes.clone()
          caches.open(CACHE_STATIC).then((c) => c.put(req, resClone))
          return networkRes
        })
        .catch(async () => {
          // Hors-ligne : sert la page demandée depuis le cache ou index.html
          const cached = await caches.match(req)
          if (cached) return cached
          return caches.match('/index.html')
        })
    )
    return
  }

  // 2. Requêtes API GET : Network-First avec mise en cache et fallback hors-ligne
  if (url.pathname.startsWith('/api/')) {
    // Ne pas cacher les flux temps réel ou uploads
    if (url.pathname.includes('/sse') || url.pathname.includes('/socket') || url.pathname.includes('/stream')) {
      return
    }

    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone()
            caches.open(CACHE_API).then((c) => c.put(req, resClone))
          }
          return networkRes
        })
        .catch(async () => {
          // Si hors-ligne : renvoyer la dernière réponse API mise en cache
          const cachedRes = await caches.match(req)
          if (cachedRes) {
            return cachedRes
          }
          return new Response(
            JSON.stringify({ offline: true, message: 'Vous êtes actuellement hors connexion.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
        })
    )
    return
  }

  // 3. Fichiers statiques (Vite bundles JS/CSS, images, polices) : Stale-While-Revalidate
  const isStatic =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.json')

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const resClone = networkRes.clone()
              caches.open(CACHE_STATIC).then((c) => c.put(req, resClone))
            }
            return networkRes
          })
          .catch(() => cached)

        // Renvoie immédiatement le cache s'il est présent, sinon attend le réseau
        return cached || fetchPromise
      })
    )
    return
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Web Push Notifications
// ─────────────────────────────────────────────────────────────────────────────

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

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
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
