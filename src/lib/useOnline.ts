'use client'

import { useState, useEffect } from 'react'

/**
 * Élő online/offline állapot a böngésző jelzései alapján.
 * SSR-en true-t ad (feltételezzük az online indulást), a kliensen pedig a
 * navigator.onLine + online/offline eseményekre frissül.
 *
 * Megjegyzés: a navigator.onLine néha téveszt (pl. csak a router halott, de a
 * gép szerint "online"), ezért a tényleges mentési hiba is offline-jelnek
 * számít a hívó oldalon — ez a hook csak a passzív állapotot adja.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return online
}
