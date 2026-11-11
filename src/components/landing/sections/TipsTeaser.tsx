'use client'

import { useRef, useState, useEffect, type CSSProperties } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HeroButton } from '@/components/landing/FeatureHeroCentered'
import { EASE } from '@/lib/motion'
import { TIPS, type Tip } from '@/lib/tips-content'

// Kártya-belépő — stagger a szülő (cardTrack) triggereli, mint a DavelopmentBanner szöveg-oszlopánál
const cardTrack = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
} as const

const cardItem = {
  hidden: { opacity: 0, transform: 'translateY(24px)' },
  show: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.5, ease: EASE } },
} as const

// Kártya-tartalom belépő — a TELJES kártya scale-lel jön be, utána a kép, majd a szöveg
// úszik fel (staggerChildren a szülőn), mint a SegmentToggle cardV/imgV párosa.
const cardOuter = {
  hidden: { opacity: 0, transform: 'scale(0.94)' },
  show: {
    opacity: 1,
    transform: 'scale(1)',
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.06 },
  },
} as const

const cardInner = {
  hidden: { opacity: 0, transform: 'translateY(24px)' },
  show: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.5, ease: EASE } },
} as const

function TipCard({ tip, k2 = false, grid = false }: { tip: Tip; k2?: boolean; grid?: boolean }) {
  // k2: a főoldali tippkártyák mintája — krém kártya, a borító (fehér alapon a telefon) a saját arányában, vágás nélkül,
  // alatta kis fehér kategória-pill, cím és kivonat
  if (k2) return (
    // ugyanaz a kártya, mint a főoldali „Tippek” blokké (TipsK2): krém kártya, 190 px-es fehér képmező (a borító teteje),
    // alatta fehér kategória-pill, cím, kivonat. `grid`: rácsban (kevés cikknél), különben a lapozó sávban
    <motion.div variants={cardOuter} className={grid ? 'w-[88%] shrink-0 snap-start md:w-auto' : 'w-[80%] shrink-0 sm:w-[45%] lg:w-[30%]'}>
      <Link href={`/tips/${tip.slug}`} className="group flex h-full flex-col rounded-ui-container bg-ui-yellow/15 p-3">
        <div className="relative h-[190px] overflow-hidden rounded-ui-card bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tip.image} alt={tip.title} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:-translate-y-1" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
        </div>
        <div className="flex flex-1 flex-col px-3 pb-3 pt-4 font-onest">
          <span className="self-start rounded-[8px] bg-white px-2.5 py-1 text-ui-meta font-medium text-ui-text/80">{tip.category}</span> {/* ui-allow: a koncepció pill-formája */}
          <h3 className="mt-3 text-ui-row font-medium text-ui-text group-hover:underline group-hover:underline-offset-4">{tip.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-ui-body text-ui-muted">{tip.excerpt}</p>
        </div>
      </Link>
    </motion.div>
  )
  return (
    <motion.div variants={cardOuter} className={`shrink-0 ${k2 ? 'w-[80%] sm:w-[45%] lg:w-[30%]' : 'w-[85%] sm:w-[55%] lg:w-[38%]'}`}>
      <Link href={`/tips/${tip.slug}`} className={`group flex h-full flex-col p-3 ${k2 ? 'rounded-ui-container bg-ui-cell' : 'rounded-ui-container bg-[#F7F7F7]'}`}>
        {/* ugyanaz a kártya, mint a főoldali tippeké (TipsK2): fehér, 190 px-es képmező, alatta pill, cím, leírás */}
        <div className="relative h-[190px] overflow-hidden rounded-ui-card bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tip.image} alt={tip.title} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:-translate-y-1" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
        </div>
        <div className="flex flex-1 flex-col px-3 pb-3 pt-4 font-onest">
          <span className="self-start rounded-[8px] bg-[#FFF9E7] px-2.5 py-1 text-ui-meta font-medium text-ui-text/80">{tip.category}</span> {/* ui-allow: a koncepció pill-formája */}
          <h3 className="mt-3 text-ui-row font-medium text-ui-text group-hover:underline group-hover:underline-offset-4">{tip.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-ui-body text-ui-muted">{tip.excerpt}</p>
        </div>
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
  // kevés cikk (≤ 3) a k2-ben: rács, mint a főoldalon — nincs mit lapozni, a nyilak nem kellenek
  const grid = k2 && items.length <= 3
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
    <section id="tippek" className={`mx-auto px-4 py-16 lg:py-20 ${grid ? 'max-w-6xl' : 'max-w-7xl lg:px-5'}`}>
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

        {!grid && <motion.div variants={cardItem} className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            aria-label="Előző"
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            className={`flex items-center justify-center transition-opacity disabled:opacity-40 ${k2 ? 'h-10 w-10 rounded-full' : 'h-[52px] w-[52px] rounded-[16px]'}`}
            style={{ background: k2 ? 'var(--ui-dark, #383838)' : '#3B3B3B' }}
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <button
            type="button"
            aria-label="Következő"
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            className={`flex items-center justify-center transition-opacity disabled:opacity-40 ${k2 ? 'h-10 w-10 rounded-full' : 'h-[52px] w-[52px] rounded-[16px]'}`}
            style={{ background: k2 ? 'var(--ui-dark, #383838)' : '#3B3B3B' }}
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </motion.div>}
      </motion.div>

      <motion.div
        ref={trackRef}
        onScroll={updateArrows}
        variants={cardTrack}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className={grid ? '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0' : 'flex gap-4 overflow-x-auto pb-2'}
        style={grid ? undefined : { scrollbarWidth: 'none', width: trackWidth ? `${trackWidth}px` : '100%' }}
      >
        {items.map((tip) => (
          <TipCard key={tip.slug} tip={tip} k2={k2} grid={grid} />
        ))}
      </motion.div>
      {k2 && <div className="mt-10 flex justify-center"><HeroButton href="/tips" label="Összes tipp" /></div>}
    </section>
  )
}
