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
    if (process.env.NODE_ENV !== 'production') {
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
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('load', onLoad)
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
