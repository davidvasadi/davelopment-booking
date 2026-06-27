'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAppPage =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/backstage') ||
    pathname.startsWith('/restaurant')

  useEffect(() => {
    if (isAppPage) return

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: true,
      touchMultiplier: 1.5,
    })

    // A Lenis smooth-scrollt a GSAP ScrollTrigger-rel szinkronizáljuk: minden Lenis-scroll
    // frissíti a ScrollTriggert, és a GSAP saját tickere hajtja a Lenis raf-ját (egyetlen RAF-loop,
    // nincs jitter a két rendszer közt). Lásd docs/landing-cinematic-plan.md §2.
    lenis.on('scroll', ScrollTrigger.update)
    const onTick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(onTick)
      lenis.destroy()
    }
  }, [isAppPage])

  return <>{children}</>
}
