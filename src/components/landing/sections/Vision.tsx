'use client'

import { useRef, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from '@/lib/landing/gsap'

/**
 * A FŐ cinematic szekció (designkép 6, Figma 289:551). GSAP `ScrollTrigger { pin, scrub }`:
 * a szekció a képernyőhöz ragad, és a scroll scrubbolja az 5 sor sorrendi felúszását/
 * világosodását, plusz a mögötte lévő 3D-objektum forgását/közelítését (a `progressRef`-en át).
 *
 * A Figma layout megtartva (centrált, óriási Geist sorok, eyebrow + „Görgess tovább"), de a
 * copy KONVERZIÓRA optimalizálva: nem brand-manifesztó, hanem „mit tud a rendszer" — egy-egy
 * sor egy konkrét értékajánlat. Mobilon / reduced-motion esetén nincs pin és nincs 3D.
 */
const MANIFESTO_LINES = [
  'Foglalás 0–24-ben.',
  'Nincs több telefon.',
  'Üres időpont? Nincs.',
  'Kevesebb lemondás.',
  'Te csak dolgozz.',
]

const Vision3D = dynamic(() => import('@/components/landing/Vision3D'), { ssr: false })

export function Vision() {
  const root = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const [enable3D, setEnable3D] = useState(false)

  // 3D csak desktopon + ha nem kér csökkentett mozgást.
  useEffect(() => {
    const ok = window.matchMedia('(min-width: 1024px)').matches && !prefersReducedMotion()
    setEnable3D(ok)
  }, [])

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const lines = gsap.utils.toArray<HTMLElement>('[data-vision-line]')

      gsap.set(lines, { opacity: 0.1, x: -20 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: '+=150%',
          pin: true,
          scrub: 1,
          onUpdate: (self) => {
            progressRef.current = self.progress
          },
        },
      })

      lines.forEach((line) => {
        tl.to(line, { opacity: 1, x: 0, ease: 'power2.out' }, '>-0.2')
      })

      return () => ScrollTrigger.getAll().forEach((t) => t.kill())
    },
    { scope: root },
  )

  return (
    <section className="mx-auto px-4 lg:px-5 pb-8">
      <div
        ref={root}
        className="relative rounded-[2rem] text-white overflow-hidden px-8 py-20 lg:px-20 lg:py-28 min-h-[60vh] flex flex-col justify-center"
        // Figma 289:551 háttér: enyhe sötétítő overlay + függőleges szürke gradient (#222 → 80%).
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(27,27,27,0.2) 0%, rgba(27,27,27,0.2) 100%), linear-gradient(180deg, rgb(34,34,34) 0%, rgba(34,34,34,0.8) 100%)',
        }}
      >
        {/* 3D réteg (csak desktop + motion ok) */}
        {enable3D && (
          <div className="absolute inset-0 z-0 opacity-70 pointer-events-none">
            <Vision3D progressRef={progressRef} />
          </div>
        )}

        {/* Minden középre igazítva (Figma: text-center, items-center). */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-white/40 text-base font-geist font-medium tracking-widest mb-12 lg:mb-20">(Mit tud a Schedulio)</p>
          <div className="w-full">
            {MANIFESTO_LINES.map((line) => (
              <p
                key={line}
                data-vision-line
                className="font-geist font-medium text-[#f4f2ee] text-5xl sm:text-6xl lg:text-8xl xl:text-9xl tracking-[-0.05em] leading-[1.1] py-1"
              >
                {line}
              </p>
            ))}
          </div>
          <p className="text-white/40 text-base font-geist font-medium tracking-widest mt-12 lg:mt-20">(Görgess tovább)</p>
        </div>
      </div>
    </section>
  )
}
