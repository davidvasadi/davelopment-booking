'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE } from '@/lib/motion'
import { FadeUp } from '@/components/landing/Motion'
import type { LandingPricing } from '@/components/landing/types'
import { buildFaqItems } from '@/lib/faqContent'

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

function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
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
                  className="flex items-center justify-center rounded-[16px] px-[15px] py-[9px] text-[clamp(1.25rem,2vw,30px)] leading-[28px] tracking-[-0.9px] transform-gpu [backface-visibility:hidden]"
                  initial={false}
                  animate={{
                    backgroundColor: isOpen ? '#191314' : 'rgba(25,19,20,0)',
                    color: isOpen ? '#f4f4f4' : '#000000',
                  }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  {String(i + 1).padStart(2, '0')}
                </motion.span>
                {/* Kérdés — középen */}
                <span className="text-center font-semibold text-[clamp(1.1rem,2vw,30px)] leading-[1.1] tracking-[-0.9px] text-brand-ink">
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
              {/* Nyitás: height + opacity + enyhe felfelé-csúszás (a tartalom „bekúszik") */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.4, ease: EASE },
                      opacity: { duration: 0.3, ease: 'easeOut' },
                    }}
                    className="overflow-hidden"
                  >
                    <motion.p
                      initial={{ y: 8 }}
                      animate={{ y: 0 }}
                      exit={{ y: 8 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="mx-auto max-w-[714px] px-6 pb-6 pt-2 text-center text-[clamp(1rem,1.4vw,20px)] leading-[1.4] tracking-[-0.6px] text-brand-ink"
                    >
                      {a}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </FadeUp>
        )
      })}
    </div>
  )
}

export function Faq({ pricing }: { pricing: LandingPricing }) {
  const items = buildFaqItems(pricing)
  return (
    <section id="gyik" className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28 flex flex-col gap-[54px]">
      {/* Fejléc: eyebrow + nagy cím (bal) | leírás (jobb felső) */}
      <div className="flex flex-col gap-[54px]">
        <span className="inline-flex self-start items-center rounded-full bg-white px-4 py-2 font-onest text-[20px] tracking-[-0.06em] text-brand-ink">
          FAQ
        </span>
        <FadeUp>
          <h2 className="font-semibold text-[clamp(2.75rem,7vw,100px)] leading-[0.94] tracking-[-0.05em] text-brand-ink">
            Gyakran kérdezik.
          </h2>
        </FadeUp>
      </div>
      <FaqAccordion items={items} />
    </section>
  )
}
