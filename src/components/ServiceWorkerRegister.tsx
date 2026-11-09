'use client'

import { useEffect } from 'react'

/**
 * A /sw.js service worker regisztrálása — ez adja az offline réteget
 * (a foglalás-oldal és statikus assetek cache-elése). Csak prod build-ben
 * regisztrálunk, hogy a dev (Turbopack HMR) ne ütközzön a cache-sel.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // DEV: ha egy korábbi prod-teszt regisztrált egy SW-t, az cache-first módon a RÉGI
    // buildet szolgálja ki Turbopack-HMR alatt is → „semmi nem változik" reload után sem.
    // Ezért dev-ben AKTÍVAN kivezetjük az összes SW-t ÉS töröljük a cache-eket (öngyógyítás).
    // A helyi .env-ben NODE_ENV=production van, ezért a fejlesztői gépen a hostnévből is döntünk: localhoston / helyi
    // hálózaton SOHA nincs SW (különben a régi CSS/JS chunkokat adja vissza → „szétesik minden”, ChunkLoadError).
    const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname) || location.hostname.endsWith('.local')
    if (process.env.NODE_ENV !== 'production' || local) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {})
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
      }
      return
    }

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* a regisztráció hibája nem kritikus — az app SW nélkül is működik online */
      })
    }
    window.addEventListener('load', onLoad)

    // Új SW aktiválásakor (deploy után) az összes nyitott lap újratölt,
    // hogy az elavult JS-bundle / Server Action ID-k ne okozzanak hibát.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SW_UPDATED') window.location.reload()
      // push-értesítésre koppintva: a SW kéri, hogy nyissuk meg az értesítés tárgyát (pl. a foglalást)
      if (e.data?.type === 'OPEN_URL' && typeof e.data.url === 'string') {
        const u = new URL(e.data.url, location.origin)
        if (u.origin === location.origin) window.location.assign(u.pathname + u.search + u.hash)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('load', onLoad)
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
