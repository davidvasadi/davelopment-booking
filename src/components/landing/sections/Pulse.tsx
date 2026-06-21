'use client'

import { useRef } from 'react'
import { TrendingUp, Bell, Calendar } from 'lucide-react'
import { SpinButton } from '@/components/landing/LandingButton'
import { PhoneMockupSVG } from '@/components/landing/Mockups'
import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from '@/lib/landing/gsap'

/**
 * „Pulse" hero-variáns (designkép 1): sötét, lekerekített konténer, mögötte halvány sugár-
 * vonalak, bal oldalon a vállalkozás „lüktetését" jelképező hullámvonal (scroll-on rajzolódik
 * fel — GSAP strokeDashoffset draw), jobb oldalon telefon-mockup.
 *
 * NEM végleges copy — a Schedulio üzenete (a template „Keep Your Finger on the … Pulse" helyett).
 */
export function Pulse() {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const paths = gsap.utils.toArray<SVGPathElement>('[data-pulse-line]')
      paths.forEach((path, i) => {
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top 75%',
            end: 'bottom 60%',
            scrub: 1,
          },
          delay: i * 0.1,
        })
      })
      return () => ScrollTrigger.getAll().forEach((t) => t.kill())
    },
    { scope: root },
  )

  return (
    <section className="mx-auto px-4 lg:px-5 pb-8">
      <div ref={root} className="rounded-[2rem] bg-brand-ink overflow-hidden relative">
        {/* Háttér sugár-vonalak (halvány) */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.07] pointer-events-none"
          preserveAspectRatio="none"
          viewBox="0 0 800 400"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1="400" y1="200" x2={i * 100} y2={i % 2 === 0 ? 0 : 400} stroke="#ecf95a" strokeWidth="1" />
          ))}
        </svg>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-center">
          {/* Bal: copy + lüktető hullámvonal */}
          <div className="p-10 lg:p-14 relative z-10">
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/60 mb-5">
              Valós idejű rálátás
            </span>
            <h2 className="text-3xl lg:text-5xl font-black tracking-tighter text-white leading-tight">
              Érezd a vállalkozásod
              <br />
              lüktetését.
            </h2>
            <p className="mt-5 text-white/50 leading-relaxed max-w-sm">
              Foglalások, bevétel, kihasználtság — élőben, egy pillantásra. Mindig tudod,
              mi történik, anélkül hogy keresned kéne.
            </p>

            {/* Lüktető hullámvonal (scroll-on rajzolódik) */}
            <svg className="mt-8 w-full max-w-md" viewBox="0 0 460 90" fill="none">
              <path
                data-pulse-line
                d="M0,45 H120 L140,15 L160,75 L180,30 L200,60 L220,45 H300 L320,20 L340,70 L360,45 H460"
                stroke="#ecf95a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <div className="mt-8 flex flex-wrap gap-3">
              <SpinButton href="/register" label="Kipróbálom ingyen" variant="light" />
            </div>

            {/* Mini metrika-pillek */}
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                { icon: Calendar, label: 'Élő naptár' },
                { icon: Bell, label: 'Azonnali értesítés' },
                { icon: TrendingUp, label: 'Bevétel-trend' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-medium text-white/70"
                >
                  <Icon className="h-3.5 w-3.5 text-brand-accent" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Jobb: telefon-mockup */}
          <div className="flex justify-center lg:justify-end overflow-hidden relative">
            <div className="w-[220px] lg:w-[260px] lg:mr-12 lg:-mb-8">
              <PhoneMockupSVG />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
