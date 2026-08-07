'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { EASE } from '@/lib/motion'
import { TIPS, type Tip } from '@/lib/tips-content'

// Kártya-belépő — stagger a szülő (cardTrack) triggereli, mint a DavelopmentBanner szöveg-oszlopánál
const cardTrack = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
} as const

const cardItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
} as const

// Kártya-tartalom belépő — a TELJES kártya scale-lel jön be, utána a kép, majd a szöveg
// úszik fel (staggerChildren a szülőn), mint a SegmentToggle cardV/imgV párosa.
const cardOuter = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.06 },
  },
} as const

const cardInner = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
} as const

function TipCard({ tip }: { tip: Tip }) {
  return (
    <motion.div variants={cardOuter} className="shrink-0 w-[85%] sm:w-[55%] lg:w-[38%]">
      <Link
        href={`/tips/${tip.slug}`}
        className="group flex flex-col rounded-[20px] bg-white p-4 gap-4"
      >
        <motion.div variants={cardInner} className="relative h-[275px] sm:h-[360px] rounded-[16px] p-4 overflow-hidden" style={{ background: '#f7f7f7' }}>
          <img
            src={tip.image}
            alt={tip.title}
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
          <span
            className="relative inline-flex items-center rounded-full px-3 py-1.5 font-onest text-[12px] font-medium"
            style={{ background: '#FFD85F', color: '#1D1C19' }}
          >
            {tip.category}
          </span>
        </motion.div>
        <motion.div variants={cardInner} className="flex flex-col gap-1.5 transition-transform duration-300 ease-out group-hover:scale-[1.02]">
          <p className="font-onest font-medium text-[19px] tracking-[-0.03em] text-brand-ink leading-[1.2] group-hover:underline underline-offset-2">
            {tip.title}
          </p>
          <p className="text-[14px] leading-[1.5] text-brand-ink/55">{tip.excerpt}</p>
        </motion.div>
      </Link>
    </motion.div>
  )
}

/**
 * Karusszel — a landingen az összes tippet mutatja, a cikkoldalon (relatedExclude)
 * az aktuálisat kihagyva "Kapcsolódó tippek" címmel.
 */
export function TipsTeaser({ relatedExclude }: { relatedExclude?: string }) {
  const items = relatedExclude ? TIPS.filter((t) => t.slug !== relatedExclude) : TIPS
  const trackRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(true)
  const [trackWidth, setTrackWidth] = useState<number>()

  const updateArrows = () => {
    const el = trackRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  // A sáv a bal oldali (max-w-7xl konténerhez igazodó) pozíciójában marad,
  // csak a szélességét nyújtjuk ki pontosan a viewport jobb széléig.
  useEffect(() => {
    const update = () => {
      const el = trackRef.current
      if (!el) return
      setTrackWidth(window.innerWidth - el.getBoundingClientRect().left)
      updateArrows()
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.4, behavior: 'smooth' })
  }

  return (
    <section id="tippek" className="mx-auto max-w-7xl px-4 lg:px-5 py-16 lg:py-20">
      <motion.div
        variants={cardTrack}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8"
      >
        <div className="flex flex-col gap-4">
          <motion.span variants={cardItem} className="inline-flex self-start items-center rounded-full bg-white px-4 py-2 font-onest text-[15px] tracking-[-0.03em] text-brand-ink">
            {relatedExclude ? 'Kapcsolódó tippek' : 'Tippek'}
          </motion.span>
          <motion.h2 variants={cardItem} className="font-semibold text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] tracking-[-0.05em] text-brand-ink">
            {relatedExclude ? 'Ezek is érdekelhetnek' : <>Tekints meg néhány<br className="hidden sm:block" /> hasznos tippet a rendszerből.</>}
          </motion.h2>
        </div>

        <motion.div variants={cardItem} className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            aria-label="Előző"
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] transition-opacity disabled:opacity-40"
            style={{ background: '#3B3B3B' }}
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <button
            type="button"
            aria-label="Következő"
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] transition-opacity disabled:opacity-40"
            style={{ background: '#3B3B3B' }}
          >
            <ArrowRight className="h-4 w-4 text-white" />
          </button>
        </motion.div>
      </motion.div>

      <motion.div
        ref={trackRef}
        onScroll={updateArrows}
        variants={cardTrack}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', width: trackWidth ? `${trackWidth}px` : '100%' }}
      >
        {items.map((tip) => (
          <TipCard key={tip.slug} tip={tip} />
        ))}
      </motion.div>
    </section>
  )
}
