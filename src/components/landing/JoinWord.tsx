'use client'

import { useRef } from 'react'
import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from '@/lib/landing/gsap'

/**
 * A footer óriási „Csatlakozz" felirata — scroll-on alulról felúszik + finoman „lélegzik".
 * Kis kliens-sziget, hogy a Footer többi része szerver-komponens maradhasson.
 */
export function JoinWord({ children }: { children: string }) {
  const ref = useRef<HTMLParagraphElement>(null)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap.from(ref.current, {
        yPercent: 30,
        opacity: 0,
        ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 95%', end: 'bottom bottom', scrub: 1 },
      })
      return () => ScrollTrigger.getAll().forEach((t) => t.kill())
    },
    { scope: ref },
  )

  return (
    <p
      ref={ref}
      className="select-none text-center font-black uppercase tracking-tighter leading-none text-[16vw]"
    >
      {children}
    </p>
  )
}
