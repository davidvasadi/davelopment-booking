'use client'

import { useEffect } from 'react'

/**
 * A /sw.js service worker regisztrálása — ez adja az offline réteget
 * (a foglalás-oldal és statikus assetek cache-elése). Csak prod build-ben
 * regisztrálunk, hogy a dev (Turbopack HMR) ne ütközzön a cache-sel.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* a regisztráció hibája nem kritikus — az app SW nélkül is működik online */
      })
    }
    window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return null
}
