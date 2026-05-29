'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Belépő-animáció wrapper: amikor az elem a nézetbe görget (IntersectionObserver),
 * fade + enyhe felúszás (animate-reveal). Egyszer fut le elemenként. A `delay`-jel
 * lépcsőzhető több kártya egymás után. Reduced-motion esetén azonnal látható.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  mountOnReveal = false,
  minHeight = 160,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  /** Ha igaz, a gyermek CSAK akkor renderelődik (mountol), amikor a nézetbe kerül.
   *  Így a benne lévő (pl. recharts) animáció ekkor fut le — és a viewporton kívüli
   *  elemek nem renderelődnek betöltéskor, ami gyorsítja az első festést. */
  mountOnReveal?: boolean
  /** Placeholder magasság mountOnReveal alatt, hogy a scroll ne ugráljon. */
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Akadálymentesség: ha a felhasználó csökkentett mozgást kér, ne animáljunk.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      // Kicsit a viewport alá is benézünk, hogy a görgetés közben időben induljon.
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${shown ? 'animate-reveal' : 'opacity-0'} ${className}`}
      style={{
        ...(shown && delay ? { animationDelay: `${delay}ms` } : {}),
        ...(mountOnReveal && !shown ? { minHeight } : {}),
      }}
    >
      {mountOnReveal ? (shown ? children : null) : children}
    </div>
  )
}
