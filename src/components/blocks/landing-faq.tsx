'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { IconCircle } from '@/components/ui-kit'
import { cn } from '@/lib/utils'
import { EASE } from '@/lib/motion'
import { FadeUp, RevealText } from '@/components/landing/Motion'
import type { LandingPricing } from '@/components/landing/types'
import { buildFaqItems } from '@/lib/faqContent'
import { HeroButton } from './landing-herobutton'
import { GrainCanvas, DARK_SURFACE_BG } from '@/components/landing/GrainCanvas'

/**
 * Plus→Minus morph ikon: a vízszintes szár marad, a függőleges szár nyitáskor 0-ra skálázódik
 * (és kicsit fordul) → szemmel követhető a + → − átmenet. A közös EASE-szel.
 */
function PlusMinus({ open }: { open: boolean }) {
  return (
    // Az egész ikon perdül egyet nyitáskor (+ → ×/− látványos átfordulás), miközben a
    // függőleges szár el is tűnik. Így kattintásra szemmel követhető az állapotváltás.
    <motion.span
      className="relative grid h-6 w-6 place-items-center"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {/* vízszintes szár — végig látszik */}
      <span className="col-start-1 row-start-1 h-[2.5px] w-[18px] rounded-full bg-current" />
      {/* függőleges szár — nyitáskor a közepe felé skálázódik el (rotate nélkül, nem csúszik) */}
      <motion.span
        className="col-start-1 row-start-1 h-[18px] w-[2.5px] origin-center rounded-full bg-current"
        animate={{ scaleY: open ? 0 : 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      />
    </motion.span>
  )
}

export function FaqAccordion({ items, compact = false, k2 = false }: {
  items: { q: string; a: string }[]
  /** Keskeny oszlopba (pl. CTA mellé): balra zárt, kisebb kérdés/válasz. */
  compact?: boolean
  /** a 2. landing-koncepció: nyitva világosszürke sor, a +/− chip szürke (nem sárga) */
  k2?: boolean
}) {
  const [open, setOpen] = useState<number | null>(1)
  return (
    <div className="flex flex-col gap-2 w-full">
      {items.map(({ q, a }, i) => {
        const isOpen = open === i
        return (
          <FadeUp key={i} delay={i * 0.04}>
            {/* Sor: nyitva világosszürke lekerekített kártya; zárva sima sor */}
            <motion.div
              className={cn('relative rounded-ui-container px-2 py-2.5')}
            >
              {/* nyitva fehér kártya — a fehér réteg úszik be (átlátszóság), a szín a ui-* tokené */}
              <motion.span aria-hidden className={cn('absolute inset-0 rounded-ui-container', k2 ? 'bg-ui-cell' : 'bg-white')} initial={false} animate={{ opacity: isOpen ? 1 : 0 }} transition={{ duration: 0.3, ease: EASE }} />
              <button
                className="relative w-full grid grid-cols-[auto_1fr_auto] items-center gap-4 px-3 py-2 text-left"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                {/* Szám-chip — nyitva sötét (fehér szám), zárva sima. A háttér/szöveg
                    átmenete Framerrel megy (ugyanaz a motor, mint a sor-háttéré), NEM
                    CSS transition-colors — így a height-animáció alatti repaint-versenyt
                    elkerüljük, a transform-gpu pedig külön rétegre teszi, nem vibrál. */}
                <motion.span
                  className={cn('relative isolate flex items-center justify-center rounded-ui-inner transform-gpu transition-colors duration-300 [backface-visibility:hidden]', isOpen ? 'text-white' : 'text-ui-text', compact ? 'w-[46px] py-2 text-ui-title leading-[24px]' : 'px-[15px] py-[9px] text-ui-title lg:text-ui-num leading-[28px]')}
                >
                  <motion.span aria-hidden className="absolute inset-0 -z-10 rounded-ui-inner bg-ui-dark" initial={false} animate={{ opacity: isOpen ? 1 : 0 }} transition={{ duration: 0.3, ease: EASE }} />
                  {String(i + 1).padStart(2, '0')}
                </motion.span>
                {/* Kérdés — középen */}
                <span className={cn('font-medium text-ui-text', compact ? 'text-left text-ui-row lg:text-ui-title' : 'text-center text-ui-title lg:text-ui-num')}>
                  {q}
                </span>
                {/* +/− chip — mindig sárga; kattintásra apró rugós visszajelzés */}
                <motion.span
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className={cn('flex items-center justify-center rounded-ui-inner px-[15px] py-[9px] text-ui-text', k2 ? (isOpen ? 'bg-white' : 'bg-ui-cell') : 'bg-ui-yellow')}
                >
                  <PlusMinus open={isOpen} />
                </motion.span>
              </button>
              {/* Nyitás: height + opacity + enyhe felfelé-csúszás. A válasz ZÁRVA is a DOM-ban
                  marad (0 magasság, rejtve) — így a keresők és az AI-keresők is látják, és
                  egyezik a FAQPage strukturált adattal. */}
              <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{
                  height: { duration: 0.4, ease: EASE },
                  opacity: { duration: 0.3, ease: 'easeOut' },
                }}
                className="relative overflow-hidden"
                aria-hidden={!isOpen}
              >
                <motion.p
                  initial={false}
                  animate={{ y: isOpen ? 0 : 8 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className={cn(' text-ui-text', compact ? 'pb-5 pl-[82px] pr-6 pt-1 text-left text-ui-row text-ui-muted max-sm:pl-4' : 'mx-auto max-w-[714px] px-6 pb-6 pt-2 text-center text-ui-row lg:text-ui-title')}
                >
                  {a}
                </motion.p>
              </motion.div>
            </motion.div>
          </FadeUp>
        )
      })}
    </div>
  )
}

export function Faq({
  pricing,
  extraItems,
  look,
}: {
  pricing: LandingPricing
  /** 'k2': a 2. landing-koncepció stílusa — középre zárt pill + cím */
  look?: 'k2'
  /** Iparági landingeknél a szakmának szóló extra GYIK-pontok, a lista végén. */
  extraItems?: { q: string; a: string }[]
}) {
  const items = buildFaqItems(pricing, extraItems)
  return (
    <section id="gyik" className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28 flex flex-col gap-[54px]">
      {/* Fejléc: eyebrow + nagy cím (bal) | leírás (jobb felső) */}
      {look === 'k2' ? (
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="inline-flex items-center rounded-[8px] bg-ui-yellow/15 px-3.5 py-1.5 font-onest text-[14px] font-medium text-ui-text/80">GYIK</span>
          <FadeUp><RevealText text="Gyakran kérdezik." className="font-onest text-[clamp(2rem,3.6vw,48px)] font-medium leading-[1.08] tracking-[-0.035em] text-ui-text" /></FadeUp>
        </div>
      ) : (
      <div className="flex flex-col gap-[54px]">
        <span className="inline-flex self-start items-center rounded-ui-control bg-white px-3 py-1.5 font-onest text-ui-body font-medium text-ui-text">
          FAQ
        </span>
        <FadeUp>
          <RevealText text="Gyakran kérdezik." className="font-light text-ui-num lg:text-ui-page text-ui-text" />
        </FadeUp>
      </div>
      )}
      {/* két oszlop, mint a funkció-oldalakon: balra a CTA-kártya, jobbra a harmonika */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <FaqCta trialDays={pricing.trial_days} k2={look === 'k2'} />
        <FaqAccordion items={items} compact k2={look === 'k2'} />
      </div>
    </section>
  )
}

/**
 * A GYIK melletti marketing-CTA (funkció-oldalak): sötét kártya, desktopon ragad a harmonika
 * mellett, amíg végig nem görgetsz rajta.
 */
export function FaqCta({
  trialDays,
  title = 'Próbáld ki a saját üzleteden.',
  body = 'A legtöbb kérdésre a gyakorlat válaszol: állítsd be a szolgáltatásaidat, és nézd meg, hogyan foglalnak a vendégeid.',
  k2 = false,
}: { trialDays: number; title?: string; body?: string; /** a 2. koncepció pill-formája */ k2?: boolean }) {
  return (
    <FadeUp className="max-lg:order-last lg:sticky lg:top-[96px]">
      <div className="relative isolate overflow-hidden rounded-ui-card bg-ui-dark text-white">
        <GrainCanvas strength="light" opacity={0.8} zIndex={-1} />
        <div className="relative px-7 py-9 lg:px-10 lg:py-12">
          <span className={k2 ? 'inline-flex items-center rounded-[8px] bg-white px-3.5 py-1.5 font-onest text-[14px] font-medium text-ui-text/80' : 'inline-flex items-center rounded-ui-control bg-white px-3 py-1.5 font-onest text-ui-body font-medium text-ui-text'}>
            Nem találod a választ?
          </span>
          <RevealText as="p" text={title} className="mt-6 text-ui-sub lg:text-ui-page font-light" />
          <p className="mt-4 text-ui-row text-white/55">
            {body}
          </p>
          <ul className="mt-7 flex flex-col gap-3">
            {[`${trialDays} napig ingyenes`, 'Kártya nélkül indul', 'Bármikor lemondható'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-ui-row text-white/80">
                {k2
                  ? <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ui-ok-dot text-ui-dark"><Check className="h-3.5 w-3.5" strokeWidth={2.6} /></span>
                  : <IconCircle icon={Check} tone="ok" size="xs" />}
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
            <HeroButton href="/register" label="Kipróbálom ingyen" light />
            <a href="/kapcsolat" className="text-ui-row font-medium text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline">
              Írj nekünk
            </a>
          </div>
        </div>
      </div>
    </FadeUp>
  )
}
