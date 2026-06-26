'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { gsap, useGSAP, prefersReducedMotion } from '@/lib/landing/gsap'
import { SectionLabel } from '@/components/landing/SectionLabel'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'

const EASE = [0.22, 1, 0.36, 1] as const

const CARDS = [
  {
    tag: 'Dashboard',
    title: 'Minden adat egy helyen.',
    body: 'A napi foglalások, a havi bevétel és a kihasználtság egyetlen pillantással. Nincs több szétszórt Excel.',
    img: '/demo/schedulio-laptop.webp',
  },
  {
    tag: 'Mobil',
    title: 'A zsebedben is ott van.',
    body: 'Az ügyfeled telefonról foglal — te telefonon látod. Az értesítések azonnal megérkeznek, bárhol vagy.',
    img: '/demo/schedulio-mobile.avif',
  },
  {
    tag: 'Asztaltérkép',
    title: 'A teljes terem egy képen.',
    body: 'Lista, időszalag vagy teremnézet — ahogy neked kényelmes. Minden asztal, minden időpont átlátható.',
    img: '/demo/schedulio-tablet.webp',
  },
]

export function Demo() {
  return (
    <>
      <DemoDesktop />
      <DemoMobile />
    </>
  )
}

/* ===================== DESKTOP ===================== */
// Kártyaméret: 60vh × 60vh (négyzet)
// Jobb panel: 36vw–100vw → közepe 68vw
// Első kártya bal éle: 68vw - 30vh → pontosan középre igazítja
const CARD_SIZE = '80vh'

function DemoDesktop() {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const trackEl = track.current
      const rootEl = root.current
      if (!trackEl || !rootEl) return

      const cards = gsap.utils.toArray<HTMLElement>('[data-card]', trackEl)

      // jobb panel közepe pixelben
      const panelCenter = () => window.innerWidth * 0.68

      // mennyit kell csúsztatni hogy minden kártya egyszer középre kerüljön
      const getSlideDistance = () => {
        const last = cards[cards.length - 1] as HTMLElement
        return Math.max(0, (last.offsetLeft + last.offsetWidth / 2) - panelCenter())
      }

      const PHASE1_RATIO = 0.25 // az össz scroll első 25%-a = fázis 1

      const onUpdate = (self: { progress: number }) => {
        const p = self.progress
        const fx = panelCenter()

        // fázis 1: track áll, csak az első kártya nő
        if (p <= PHASE1_RATIO) {
          const t = p / PHASE1_RATIO
          gsap.set(cards[0], { scale: 0.38 + 0.62 * t })
          gsap.set(trackEl, { x: 0 })
          cards.slice(1).forEach((c) => gsap.set(c, { scale: 0.38 }))
          setActive(0)
          return
        }

        // fázis 2: track csúszik, scale pozíció alapján
        const slideP = (p - PHASE1_RATIO) / (1 - PHASE1_RATIO)
        const dist = getSlideDistance()
        gsap.set(trackEl, { x: -dist * slideP })

        const x = -dist * slideP
        let bestI = 0, bestDist = Infinity
        cards.forEach((card, i) => {
          const center = (card as HTMLElement).offsetLeft + x + (card as HTMLElement).offsetWidth / 2
          const d = Math.abs(center - fx)
          if (d < bestDist) { bestDist = d; bestI = i }
          const raw = d / (window.innerWidth * 0.35)
          gsap.set(card, { scale: 0.38 + 0.62 * Math.max(0, 1 - raw) })
        })
        setActive((prev) => (prev === bestI ? prev : bestI))
      }

      const st = gsap.to({}, {
        scrollTrigger: {
          trigger: rootEl,
          start: 'top top',
          end: () => `+=${window.innerWidth * 2}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate,
        },
      })

      gsap.set(cards[0], { scale: 0.38 })
      cards.slice(1).forEach((c) => gsap.set(c, { scale: 0.38 }))

      return () => { st.scrollTrigger?.kill(); st.kill() }
    },
    { scope: root },
  )

  const card = CARDS[active]

  return (
    <div ref={root} className="relative hidden lg:block overflow-hidden bg-white h-screen">
      {/* Fix bal panel */}
      <div className="absolute inset-y-0 left-0 z-10 w-[36%] bg-white">
        <div className="flex h-full w-full flex-col justify-center px-12 xl:px-16">
          <SectionLabel className="mb-4">(Demo)</SectionLabel>
          <h2 className="font-semibold text-[clamp(2.5rem,4.5vw,4.5rem)] leading-[0.92] tracking-[-0.05em] text-brand-ink">
            Lásd működés<br />közben.
          </h2>
          <div className="mt-6 h-[120px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <span className="inline-block rounded-full bg-brand-accent px-3 py-1 text-xs font-semibold text-brand-ink mb-3">
                  {card.tag}
                </span>
                <p className="text-[clamp(1rem,1.4vw,1.2rem)] leading-[1.5] text-brand-ink/60 max-w-sm">
                  {card.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-8">
            <RollButton href="/davelopment" label="Megnyitom a demót" variant="inkLight" size="md" icon />
          </div>
          <div className="mt-10 flex gap-2">
            {CARDS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-8 bg-brand-ink' : 'w-1.5 bg-zinc-300'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Track: első kártya pontosan a jobb panel közepére igazítva calc-kal */}
      <div
        ref={track}
        className="flex h-screen w-max items-center"
        style={{
          paddingLeft: `calc(68vw - ${CARD_SIZE} / 2)`,
          paddingRight: `calc(32vw - ${CARD_SIZE} / 2)`,
          gap: '4vw',
        }}
      >
        {CARDS.map((card, i) => (
          <div
            key={i}
            data-card
            className="shrink-0 overflow-hidden rounded-[30px] will-change-transform"
            style={{ width: CARD_SIZE, height: CARD_SIZE, transform: 'scale(0.38)' }}
          >
            <img src={card.img} alt={card.title} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===================== MOBIL ===================== */
const MOBILE_PHASE1 = 0.25
const MOBILE_INIT_SCALE = 0.55

function DemoMobile() {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      const trackEl = track.current
      const rootEl = root.current
      if (!trackEl || !rootEl) return

      const cards = gsap.utils.toArray<HTMLElement>('[data-card-m]', trackEl)
      const w = () => window.innerWidth
      const center = () => w() / 2

      const getSlide = () => {
        const last = cards[cards.length - 1] as HTMLElement
        return Math.max(0, (last.offsetLeft + last.offsetWidth / 2) - center())
      }

      const onUpdate = (self: { progress: number }) => {
        const p = self.progress

        if (p <= MOBILE_PHASE1) {
          const t = p / MOBILE_PHASE1
          gsap.set(cards[0], { scale: MOBILE_INIT_SCALE + (1 - MOBILE_INIT_SCALE) * t })
          gsap.set(trackEl, { x: 0 })
          cards.slice(1).forEach((c) => gsap.set(c, { scale: MOBILE_INIT_SCALE }))
          return
        }

        const slideP = (p - MOBILE_PHASE1) / (1 - MOBILE_PHASE1)
        const x = -getSlide() * slideP
        gsap.set(trackEl, { x })

        const fx = center()
        cards.forEach((card) => {
          const cardCenter = (card as HTMLElement).offsetLeft + x + (card as HTMLElement).offsetWidth / 2
          const raw = Math.abs(cardCenter - fx) / (w() * 0.5)
          const t = Math.max(0, 1 - raw)
          gsap.set(card, { scale: MOBILE_INIT_SCALE + (1 - MOBILE_INIT_SCALE) * t })
        })
      }

      const st = gsap.to({}, {
        scrollTrigger: {
          trigger: rootEl,
          start: 'top top',
          end: () => `+=${w() * 2.5}`,
          pin: true,
          scrub: 2,
          invalidateOnRefresh: true,
          onUpdate,
        },
      })

      return () => { st.scrollTrigger?.kill(); st.kill() }
    },
    { scope: root },
  )

  return (
    <div className="lg:hidden">
      <div className="px-5 pt-12 pb-6">
        <SectionLabel className="mb-3">(Demo)</SectionLabel>
        <h2 className="font-semibold text-[clamp(2.25rem,9vw,3.25rem)] leading-[0.94] tracking-[-0.05em] text-brand-ink">
          Lásd működés közben.
        </h2>
        <p className="mt-4 text-[15px] leading-[1.5] text-brand-ink/50">
          Demo elérhető, bankkártya nélkül.
        </p>
      </div>

      <div ref={root} className="relative overflow-hidden bg-white h-[100svh]">
        <div
          ref={track}
          className="flex h-[100svh] w-max items-center"
          style={{ gap: '0px' }}
        >
          {CARDS.map((card) => (
            <div
              key={card.tag}
              data-card-m
              className="relative shrink-0 overflow-hidden rounded-[28px] will-change-transform"
              style={{ width: '100vw', height: '100svh', transform: `scale(${MOBILE_INIT_SCALE})` }}
            >
              <img src={card.img} alt={card.title} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-x-4 bottom-4 rounded-[18px] bg-black/30 backdrop-blur-md p-4">
                <span className="inline-block rounded-full bg-brand-accent px-3 py-1 text-xs font-semibold text-brand-ink mb-2">
                  {card.tag}
                </span>
                <h3 className="font-semibold tracking-[-0.04em] leading-[1.1] text-white text-[clamp(1.4rem,6vw,1.9rem)]">
                  {card.title}
                </h3>
                <p className="mt-1.5 text-white/75 leading-relaxed text-[13px]">{card.body}</p>
              </div>
            </div>
          ))}

          {/* CTA lap */}
          <div
            data-card-m
            className="relative shrink-0 overflow-hidden rounded-[28px] will-change-transform"
            style={{ width: 'calc(100vw - 10px)', height: 'calc(100svh - 10px)', transform: `scale(${MOBILE_INIT_SCALE})`, borderRadius: '20px', margin: '5px' }}
          >
            <div className="flex h-full w-full flex-col items-start justify-end gap-4 bg-brand-ink px-7 pb-10 pt-8 text-white">
              <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70 tracking-wide uppercase">
                Demo
              </span>
              <h3 className="font-semibold tracking-[-0.04em] leading-[1.05] text-[clamp(2rem,9vw,2.75rem)]">
                Próbáld ki<br />most, ingyen.
              </h3>
              <p className="text-white/50 text-[14px] leading-relaxed max-w-[260px]">
                Bankkártya nem kell. Regisztrálj és azonnal látod hogyan működik a Schedulio az üzletedben.
              </p>
              <div className="mt-2">
                <RollButton href="/davelopment" label="Megnyitom a demót" variant="accent" size="md" icon />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

