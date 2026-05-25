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
