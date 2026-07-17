/* Schedulio service worker — minimális offline réteg az étterem foglalás-oldalhoz.
 *
 * Stratégia:
 *  - Navigációs kérések (HTML oldalak): network-first, offline esetén a legutóbb
 *    cache-elt oldal (így a /restaurant/bookings betölt zárt fül / újraindítás után is).
 *  - Statikus assetek (_next/static, fontok, képek): stale-while-revalidate.
 *  - API kérések: NEM cache-eljük (a foglalás-adat változékony; offline a kliens
 *    a már betöltött adatból + lokális vázlatokból dolgozik).
 */
const CACHE = 'schedulio-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/uploads/') ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Az API-t sosem cache-eljük.
  if (url.pathname.startsWith('/api/')) return

  // HTML navigáció: network-first, offline fallback a cache-re.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/restaurant/bookings')),
        ),
    )
    return
  }

  // Statikus assetek: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
            return res
          })
          .catch(() => cached)
        return cached || network
      }),
    )
  }
})

/* ── WEB PUSH ──────────────────────────────────────────────────────────────
 * A szerver (web-push + VAPID) titkosított payloadot küld; itt jelenítjük meg
 * rendszer-értesítésként, és kattintásra a megfelelő oldalra ugrunk / fókuszálunk.
 * A payload JSON: { title, body, url, tag }.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_) {
    data = { title: 'davelopment booking', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'davelopment booking'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    tag: data.tag || undefined,
    // A kattintáskor megnyitandó relatív útvonal (lásd notificationclick).
    data: { url: data.url || '/' },
    renotify: !!data.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Ha már nyitva van egy ablak, azt fókuszáljuk és odanavigáljuk.
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(target).catch(() => {})
          return
        }
      }
      // Különben új ablak.
      if (self.clients.openWindow) return self.clients.openWindow(target)
    }),
  )
})
