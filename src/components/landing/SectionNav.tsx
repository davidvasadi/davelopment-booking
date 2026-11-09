'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion, type MotionValue } from 'framer-motion'
import { ChevronUp } from 'lucide-react'
import { EASE, SPRING_SNAPPY, SHEET_SPRING } from '@/lib/motion'

/**
 * Navigáció a funkció-oldal szakaszai között:
 *  - lent középen lebegő „Ezen az oldalon” pill az aktuális szakasszal, haladás-gyűrűvel és
 *    felfelé nyíló listával (minden méreten);
 *  - desktopon a jobb szélen pöttyök, az aktív megnyúlik és kitöltéssel mutatja a haladást.
 * Csak a funkció-szakaszok között látszanak. Az aktív szakaszt görgetéskor rAF-fel ritkítva
 * számolja; a szakaszon belüli haladás MotionValue (nincs React-render görgetés közben).
 * SEO: a feltérképezhető horgonylinkek a „Miért fontos” listában vannak, ez kényelmi réteg.
 */
type Item = { slug: string; title: string }

function useSectionProgress(items: Item[]) {
  const [active, setActive] = useState(0)
  const [inRange, setInRange] = useState(false)
  const progress = useMotionValue(0)

  useEffect(() => {
    // Teljesítmény: a szakaszok helyét (oldal-koordinátában) csak betöltéskor / méretváltozáskor
    // mérjük le; görgetés közben már csak a `scrollY`-t olvassuk — nincs kényszerített layout
    // képkockánként. Állapotot csak akkor írunk, ha tényleg változott.
    let tops: number[] = []
    let bottoms: number[] = []
    let raf = 0
    let lastActive = -1
    let lastRange: boolean | null = null

    const measureGeometry = () => {
      const y = window.scrollY
      tops = []
      bottoms = []
      for (const it of items) {
        const r = document.getElementById(it.slug)?.getBoundingClientRect()
        tops.push(r ? r.top + y : Infinity)
        bottoms.push(r ? r.bottom + y : -Infinity)
      }
    }
    const update = () => {
      raf = 0
      if (!tops.length) return
      const y = window.scrollY
      const vh = window.innerHeight
      const line = y + vh * 0.4
      let idx = 0
      for (let i = 0; i < tops.length; i++) if (tops[i] <= line) idx = i
      const h = bottoms[idx] - tops[idx]
      if (h > 0 && Number.isFinite(h)) progress.set(Math.min(1, Math.max(0, (line - tops[idx]) / h)))
      const range = tops[0] <= y + vh * 0.6 && bottoms[bottoms.length - 1] >= y + vh * 0.4
      if (idx !== lastActive) { lastActive = idx; setActive(idx) }
      if (range !== lastRange) { lastRange = range; setInRange(range) }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    const remeasure = () => { measureGeometry(); onScroll() }

    remeasure()
    // a tartalom (képek, harmonikák) betöltése/nyílása eltolhatja a szakaszokat → újramérés
    const ro = new ResizeObserver(remeasure)
    ro.observe(document.body)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', remeasure)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', remeasure)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [items, progress])

  return { active, inRange, progress }
}

/** Sima görgetés a szakaszhoz (csökkentett mozgásnál ugrás) + a hash frissítése új history-bejegyzés nélkül. */
function useJump() {
  const reduce = useReducedMotion()
  return (e: React.MouseEvent, slug: string) => {
    const el = document.getElementById(slug)
    if (!el) return
    e.preventDefault()
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', `#${slug}`)
  }
}

export function SectionNav({ items }: { items: Item[] }) {
  const { active, inRange, progress } = useSectionProgress(items)
  const smooth = useSpring(progress, { stiffness: 220, damping: 32, mass: 0.4 })
  return (
    <>
      <Dots items={items} active={active} visible={inRange} progress={smooth} />
      <FloatingPill items={items} active={active} visible={inRange} progress={smooth} />
    </>
  )
}

function FloatingPill({ items, active, visible, progress }: { items: Item[]; active: number; visible: boolean; progress: MotionValue<number> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const jump = useJump()
  const reduce = useReducedMotion()

  useEffect(() => { if (!visible) setOpen(false) }, [visible])
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cur = items[active]
  const slide = reduce ? {} : { initial: { y: 12, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -12, opacity: 0 } }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={ref}
          className="fixed inset-x-0 z-50 mx-auto w-max max-w-[calc(100vw-24px)]"
          style={{ bottom: 'max(20px, env(safe-area-inset-bottom))' }}
          initial={{ y: 90, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 90, opacity: 0, scale: 0.96 }}
          transition={SPRING_SNAPPY}
        >
          {/* Lista — felfelé nyílik, lépcsőzve */}
          <AnimatePresence>
            {open && (
              <motion.nav
                id="section-nav-list"
                aria-label="Ezen az oldalon"
                className="absolute inset-x-0 bottom-[calc(100%+10px)] mx-auto w-[min(340px,calc(100vw-24px))] origin-bottom rounded-[20px] bg-[#1D1C19] p-1.5 shadow-[0_30px_70px_-24px_rgba(0,0,0,.55)]"
                // a dashboard menüinek rugós, enyhén túllendülő „pop”-ja
                initial={{ opacity: 0, y: 14, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: SHEET_SPRING }}
                exit={{ opacity: 0, y: 10, scale: 0.96, transition: { duration: 0.14, ease: 'easeIn' } }}
              >
                <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } } }}>
                  {items.map((it, i) => (
                    <motion.li key={it.slug} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } } }}>
                      <a
                        href={`#${it.slug}`}
                        aria-current={i === active ? 'location' : undefined}
                        onClick={(e) => { jump(e, it.slug); setOpen(false) }}
                        className={`relative flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[14px] font-medium transition-colors ${i === active ? 'text-white' : 'text-white/55 hover:text-white'}`}
                      >
                        {i === active && <motion.span layoutId="section-nav-active" className="absolute inset-0 rounded-[14px] bg-white/10" transition={SPRING_SNAPPY} />}
                        <span className="relative w-5 text-[12px] tabular-nums text-white/35">{String(i + 1).padStart(2, '0')}</span>
                        <span className="relative">{it.title}</span>
                      </a>
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.nav>
            )}
          </AnimatePresence>

          {/* Pill — a szélessége rugósan követi a címet */}
          <motion.button
            layout
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="section-nav-list"
            whileTap={{ scale: 0.94 }}
            transition={{ layout: SPRING_SNAPPY, scale: { type: 'spring', stiffness: 520, damping: 18 } }}
            className="flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-full bg-[#1D1C19] py-1.5 pl-4 pr-1.5 text-[14px] font-medium text-white shadow-[0_18px_44px_-16px_rgba(0,0,0,.6)]"
          >
            <motion.span layout="position" className="hidden text-white/40 sm:inline">Ezen az oldalon</motion.span>
            <span className="relative grid max-w-[52vw] overflow-hidden sm:max-w-[320px]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={cur?.slug} className="truncate" transition={{ duration: 0.3, ease: EASE }} {...slide}>
                  {cur?.title}
                </motion.span>
              </AnimatePresence>
            </span>
            <motion.span layout="position" className="tabular-nums text-white/40">
              {active + 1}/{items.length}
            </motion.span>
            {/* Sárga gomb, körülötte a szakaszon belüli haladás gyűrűje */}
            <motion.span layout="position" className="relative flex h-9 w-9 items-center justify-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r="16.5" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
                <motion.circle cx="18" cy="18" r="16.5" fill="none" stroke="#F1CE45" strokeWidth="2" strokeLinecap="round" style={{ pathLength: progress }} />
              </svg>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1CE45] text-[#1D1C19]">
                <ChevronUp className={`h-4 w-4 transition-transform duration-200 ${open ? '' : 'rotate-180'}`} strokeWidth={2.4} />
              </span>
            </motion.span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Dots({ items, active, visible, progress }: { items: Item[]; active: number; visible: boolean; progress: MotionValue<number> }) {
  const jump = useJump()
  const fill = useTransform(progress, (v) => `${Math.round(v * 100)}%`)
  return (
    <div className="pointer-events-none fixed inset-y-0 right-5 z-40 hidden items-center lg:flex">
      <motion.nav
        aria-label="Szakaszok"
        className="flex flex-col items-end gap-0"
        initial={false}
        animate={{ opacity: visible ? 1 : 0, x: visible ? 0 : 12 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
      >
        {items.map((it, i) => (
          <a
            key={it.slug}
            href={`#${it.slug}`}
            onClick={(e) => jump(e, it.slug)}
            aria-label={it.title}
            aria-current={i === active ? 'location' : undefined}
            className="group flex items-center gap-3 py-px"
          >
            <span className="pointer-events-none translate-x-1 whitespace-nowrap rounded-full bg-[#1D1C19] px-3 py-1.5 text-[13px] font-medium text-white opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
              {it.title}
            </span>
            <motion.span
              className="relative block w-2 overflow-hidden rounded-full bg-brand-ink/15 group-hover:bg-brand-ink/35"
              animate={{ height: i === active ? 28 : 8 }}
              transition={SPRING_SNAPPY}
            >
              {i === active && <motion.span className="absolute inset-x-0 top-0 rounded-full bg-[#1D1C19]" style={{ height: fill }} />}
              {i < active && <span className="absolute inset-0 rounded-full bg-[#1D1C19]/60" />}
            </motion.span>
          </a>
        ))}
      </motion.nav>
    </div>
  )
}
