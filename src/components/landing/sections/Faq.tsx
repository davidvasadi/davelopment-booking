'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE } from '@/lib/motion'
import { FadeUp, RevealText } from '@/components/landing/Motion'
import type { LandingPricing } from '@/components/landing/types'
import { buildFaqItems } from '@/lib/faqContent'
import { HeroButton } from '@/components/landing/FeatureHeroCentered'
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
  /** új stílus: a nyitott sor világosszürke (fehér oldalon) */
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
              className={cn('rounded-[30px] px-2 py-2.5')}
              animate={{ backgroundColor: isOpen ? '#ffffff' : 'rgba(244,244,244,0)' }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <button
                className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-4 px-3 py-2 text-left"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                {/* Szám-chip — nyitva sötét (fehér szám), zárva sima. A háttér/szöveg
                    átmenete Framerrel megy (ugyanaz a motor, mint a sor-háttéré), NEM
                    CSS transition-colors — így a height-animáció alatti repaint-versenyt
                    elkerüljük, a transform-gpu pedig külön rétegre teszi, nem vibrál. */}
                <motion.span
                  className={cn('flex items-center justify-center rounded-[16px] transform-gpu [backface-visibility:hidden]', compact ? 'w-[46px] py-2 text-[18px] leading-[24px] tracking-[-0.5px]' : 'px-[15px] py-[9px] text-[clamp(1.25rem,2vw,30px)] leading-[28px] tracking-[-0.9px]')}
                  initial={false}
                  animate={{
                    backgroundColor: isOpen ? (k2 ? '#383838' : '#191314') : 'rgba(25,19,20,0)',
                    color: isOpen ? '#f4f4f4' : '#000000',
                  }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  {String(i + 1).padStart(2, '0')}
                </motion.span>
                {/* Kérdés — középen */}
                <span className={cn('font-semibold leading-[1.15] text-brand-ink', compact ? 'text-left text-[clamp(1.05rem,1.5vw,21px)] tracking-[-0.5px]' : 'text-center text-[clamp(1.1rem,2vw,30px)] tracking-[-0.9px]')}>
                  {q}
                </span>
                {/* +/− chip — mindig sárga; kattintásra apró rugós visszajelzés */}
                <motion.span
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className="flex items-center justify-center rounded-[16px] bg-brand-accent px-[15px] py-[9px] text-brand-ink"
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
                className="overflow-hidden"
                aria-hidden={!isOpen}
              >
                <motion.p
                  initial={false}
                  animate={{ y: isOpen ? 0 : 8 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className={cn('leading-[1.5] text-brand-ink', compact ? 'pb-5 pl-[82px] pr-6 pt-1 text-left text-[16px] text-brand-ink/70 max-sm:pl-4' : 'mx-auto max-w-[714px] px-6 pb-6 pt-2 text-center text-[clamp(1rem,1.4vw,20px)] tracking-[-0.6px]')}
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
}: {
  pricing: LandingPricing
  /** Iparági landingeknél a szakmának szóló extra GYIK-pontok, a lista végén. */
  extraItems?: { q: string; a: string }[]
}) {
  const items = buildFaqItems(pricing, extraItems)
  return (
    <section id="gyik" className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28 flex flex-col gap-[54px]">
      {/* Fejléc: eyebrow + nagy cím (bal) | leírás (jobb felső) */}
      <div className="flex flex-col gap-[54px]">
        <span className="inline-flex self-start items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]">
          FAQ
        </span>
        <FadeUp>
          <RevealText text="Gyakran kérdezik." className="font-semibold text-[clamp(2rem,4.2vw,52px)] leading-[0.98] tracking-[-0.05em] text-brand-ink" />
        </FadeUp>
      </div>
      {/* két oszlop, mint a funkció-oldalakon: balra a CTA-kártya, jobbra a harmonika */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <FaqCta trialDays={pricing.trial_days} />
        <FaqAccordion items={items} compact />
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
}: { trialDays: number; title?: string; body?: string; /** új stílus: tömör ui-dark, szemcse nélkül */ k2?: boolean }) {
  return (
    <FadeUp className="max-lg:order-last lg:sticky lg:top-[96px]">
      <div className={`relative isolate overflow-hidden text-white ${k2 ? 'rounded-ui-container bg-ui-dark' : 'rounded-[20px]'}`} style={k2 ? undefined : { background: DARK_SURFACE_BG }}>
        {!k2 && <GrainCanvas strength="light" opacity={0.8} zIndex={-1} />}
        <div className="relative px-7 py-9 lg:px-10 lg:py-12">
          <span className="inline-flex items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]">
            Nem találod a választ?
          </span>
          <RevealText as="p" text={title} className="mt-6 text-[clamp(1.75rem,3vw,40px)] font-medium leading-[1.04] tracking-[-0.05em]" />
          <p className="mt-4 text-[16px] leading-[1.6] text-white/55">
            {body}
          </p>
          <ul className="mt-7 flex flex-col gap-3">
            {[`${trialDays} napig ingyenes`, 'Kártya nélkül indul', 'Bármikor lemondható'].map((t) => (
              <li key={t} className="flex items-center gap-3 text-[15px] text-white/80">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-fill text-[#1D1C19]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
            <HeroButton href="/register" label="Kipróbálom ingyen" light />
            <a href="/kapcsolat" className="text-[15px] font-medium text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline">
              Írj nekünk
            </a>
          </div>
        </div>
      </div>
    </FadeUp>
  )
}
