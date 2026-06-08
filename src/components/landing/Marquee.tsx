'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'

const MARQUEE_ITEMS = ['ÉTTEREM', 'CSONTKOVÁCS', 'FODRÁSZAT', 'SZEMÉLYI EDZŐ', 'JÓGA', 'KOZMETIKA', 'MASSZŐR', 'KÖRÖMSZALON']

/**
 * Egy végtelen futósor: az alap-animáció folyamatosan megy, ÉS a teljes oldal
 * görgetése extra x-eltolást ad (scroll-reaktív parallax). A duplázott tartalom
 * teszi varratmentessé a -50% ↔ 0% loopot.
 */
function MarqueeRow({
  reverse = false,
  duration = 18,
  scroll,
  emphasis = false,
}: {
  reverse?: boolean
  duration?: number
  scroll: MotionValue<number>
  emphasis?: boolean
}) {
  const row = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  const scrollX = useTransform(scroll, [0, 1], reverse ? ['-6%', '14%'] : ['6%', '-14%'])
  return (
    <div className="overflow-hidden">
      <motion.div style={{ x: scrollX }}>
        <motion.div
          className="flex whitespace-nowrap will-change-transform"
          animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
          transition={{ duration, ease: 'linear', repeat: Infinity }}
        >
          {row.map((item, i) => (
            <span
              key={i}
              className="flex items-center font-black text-[2rem] sm:text-4xl lg:text-6xl tracking-tighter uppercase px-4 lg:px-6"
            >
              <span className={emphasis ? 'text-brand-ink' : 'text-brand-ink/85'}>{item}</span>
              <span className="mx-4 lg:mx-6 text-brand-ink/30 text-2xl lg:text-4xl">✳</span>
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

/** Három soros, gyors, váltakozó irányú futószalag — scroll-reaktív parallaxszal. */
export function Marquee() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  return (
    <div
      ref={ref}
      className="relative bg-brand-accent border-y border-brand-ink/10 overflow-hidden py-6 lg:py-8 space-y-5"
    >
      <MarqueeRow duration={22} scroll={scrollYProgress} />
      <MarqueeRow reverse duration={28} scroll={scrollYProgress} emphasis />
      <MarqueeRow duration={18} scroll={scrollYProgress} />
      {/* lágy él-elhalványítás a két szélen */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 lg:w-32 bg-gradient-to-r from-brand-accent to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 lg:w-32 bg-gradient-to-l from-brand-accent to-transparent" />
    </div>
  )
}
