'use client'

import { useRef, useState, useEffect, type CSSProperties } from 'react'
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

function TipCard({ tip, k2 = false }: { tip: Tip; k2?: boolean }) {
  // k2: a főoldali tippkártyák mintája — krém kártya, a borító (fehér alapon a telefon) a saját arányában, vágás nélkül,
  // alatta kis fehér kategória-pill, cím és kivonat
  if (k2) return (
    <motion.div variants={cardOuter} className="w-[80%] shrink-0 sm:w-[45%] lg:w-[30%]">
      <Link href={`/tips/${tip.slug}`} className="group flex h-full flex-col rounded-ui-container bg-white p-3">
        <motion.div variants={cardInner} className="relative aspect-[610/497] overflow-hidden rounded-ui-card bg-white ring-1 ring-ui-divider">
          <img src={tip.image} alt={tip.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:-translate-y-1" />
        </motion.div>
        <motion.div variants={cardInner} className="flex flex-1 flex-col px-3 pb-3 pt-4">
          <span className="self-start rounded-[8px] bg-ui-yellow/15 px-2.5 py-1 font-onest text-ui-meta font-medium text-ui-text/80">{tip.category}</span> {/* ui-allow: a koncepció pill-formája */}
          <p className="mt-3 font-onest text-ui-row font-medium text-ui-text group-hover:underline group-hover:underline-offset-4">{tip.title}</p>
          <p className="mt-1.5 line-clamp-2 text-ui-body text-ui-muted">{tip.excerpt}</p>
        </motion.div>
      </Link>
    </motion.div>
  )
  return (
    <motion.div variants={cardOuter} className={`shrink-0 ${k2 ? 'w-[80%] sm:w-[45%] lg:w-[30%]' : 'w-[85%] sm:w-[55%] lg:w-[38%]'}`}>
      <Link
        href={`/tips/${tip.slug}`}
        className={`group flex flex-col gap-4 ${k2 ? 'rounded-ui-container bg-ui-cell p-3' : 'rounded-[20px] bg-white p-4'}`}
      >
        <motion.div variants={cardInner} className={`relative overflow-hidden p-4 ${k2 ? 'h-[240px] rounded-ui-card sm:h-[280px]' : 'h-[275px] sm:h-[360px] rounded-[16px]'}`} style={{ background: '#f7f7f7' }}>
          <img
            src={tip.image}
            alt={tip.title}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] ${
              tip.coverPositionX == null ? (tip.imagePosition === 'center' ? 'object-center' : 'object-top') : ''
            }`}
            style={
              tip.coverPositionX != null
                ? ({
                    objectPosition: `${typeof tip.coverPositionX === 'number' ? `${tip.coverPositionX}%` : tip.coverPositionX} ${tip.imagePosition === 'center' ? '50%' : '0%'}`,
                  } as CSSProperties)
                : undefined
            }
          />
          <span
            className="relative inline-flex items-center rounded-full px-3 py-1.5 font-onest text-[12px] font-medium"
            style={{ background: '#FFD85F', color: '#1D1C19' }}
          >
            {tip.category}
          </span>
        </motion.div>
        <motion.div variants={cardInner} className={`flex flex-col gap-1.5 transition-transform duration-300 ease-out group-hover:scale-[1.02] ${k2 ? 'px-2 pb-2' : ''}`}>
          <p className={`font-onest font-medium tracking-[-0.03em] text-brand-ink leading-[1.2] group-hover:underline underline-offset-2 ${k2 ? 'text-ui-title' : 'text-[19px]'}`}>
            {tip.title}
          </p>
          <p className={`leading-[1.5] text-brand-ink/55 ${k2 ? 'text-ui-body' : 'text-[14px]'}`}>{tip.excerpt}</p>
        </motion.div>
      </Link>
    </motion.div>
  )
}

/**
 * Karusszel — a landingen az összes tippet mutatja, a cikkoldalon (relatedExclude)
 * az aktuálisat kihagyva "Kapcsolódó tippek" címmel.
 */
export function TipsTeaser({ relatedExclude, slugs, look }: {
  /** 'k2': a 2. landing-koncepció stílusa — középre zárt pill + cím, kerek kis nyilak, szürke kártyák */
  look?: 'k2'
  relatedExclude?: string
  /** csak ezek a cikkek, ebben a sorrendben (pl. funkció-oldal „Kapcsolódó” lapozója) */
  slugs?: string[]
}) {
  const items = slugs
    ? slugs.map((sl) => TIPS.find((t) => t.slug === sl)).filter((t): t is Tip => !!t)
    : relatedExclude ? TIPS.filter((t) => t.slug !== relatedExclude) : TIPS
  const related = !!relatedExclude || !!slugs
  const k2 = look === 'k2'
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
    // Pontosan egy kártyányit (+ a köztük lévő gap-4 rés) lépünk, ne a konténer-szélesség
    // egy önkényes hányadát — különben (pl. mobilon, ahol egy kártya 85%-ot foglal) a nyíl
    // csak félig görget a következő kártyáig, ahelyett hogy pontosan odaugorna.
    const card = el.querySelector<HTMLElement>(':scope > *')
    const GAP = 16 // gap-4
    const step = card ? card.offsetWidth + GAP : el.clientWidth * 0.4
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <section id="tippek" className="mx-auto max-w-7xl px-4 lg:px-5 py-16 lg:py-20">
      <motion.div
        variants={cardTrack}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        className={k2 ? 'mb-10 flex flex-col items-center gap-6 text-center' : 'flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8'}
      >
        <div className={`flex flex-col gap-4 ${k2 ? 'items-center' : ''}`}>
          <motion.span variants={cardItem} className={k2 ? 'inline-flex items-center rounded-[8px] bg-ui-yellow/15 px-3.5 py-1.5 font-onest text-[14px] font-medium text-ui-text/80' : 'inline-flex self-start items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]'}>
            {related ? 'Kapcsolódó tippek' : 'Tippek'}
          </motion.span>
          <motion.h2 variants={cardItem} className={k2 ? 'font-onest text-[clamp(2rem,3.6vw,48px)] font-medium leading-[1.08] tracking-[-0.035em] text-ui-text' : 'font-semibold text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] tracking-[-0.05em] text-brand-ink'}>
            {related ? 'Ezek is érdekelhetnek' : k2 ? 'Tippek az online foglaláshoz.' : <>Tekints meg néhány<br className="hidden sm:block" /> hasznos tippet a rendszerből.</>}
          </motion.h2>
        </div>

        <motion.div variants={cardItem} className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            aria-label="Előző"
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            className={`flex items-center justify-center transition-opacity disabled:opacity-40 ${k2 ? 'h-10 w-10 rounded-full' : 'h-[52px] w-[52px] rounded-[16px]'}`}
            style={{ background: k2 ? 'var(--ui-dark, #383838)' : '#3B3B3B' }}
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <button
            type="button"
            aria-label="Következő"
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            className={`flex items-center justify-center transition-opacity disabled:opacity-40 ${k2 ? 'h-10 w-10 rounded-full' : 'h-[52px] w-[52px] rounded-[16px]'}`}
            style={{ background: k2 ? 'var(--ui-dark, #383838)' : '#3B3B3B' }}
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
          <TipCard key={tip.slug} tip={tip} k2={k2} />
        ))}
      </motion.div>
    </section>
  )
}
