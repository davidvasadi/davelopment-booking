'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ArrowUpRight, User, UserRound } from 'lucide-react'
import { OccasionBadge } from './OccasionBadge'
import { buttonHover } from '@/lib/motion'

const MotionLink = motion.create(Link)

/**
 * Áttekintés — „Naptár" erőforrás-idővonal (Crextio-stílus). BAL oszlop = ASZTALOK (soronként
 * egy asztal), VÍZSZINTES időtengely: az órák oszlopokban, függőleges pontozott vonalakkal.
 * A foglalások vízszintesen elnyúló, lekerekített blokkok az adott asztal sorában, idő szerint
 * pozicionálva. Egyszerre néhány óra látszik (reszponzív — a kártya szélességétől függ, ld.
 * `win` state), a jobb-felső Apple-nyilak léptetik az idősávot.
 * Sötét kártya = megerősített/VIP; halványsárga = függő/beeső. Ease-in-out beúszás.
 */
export type TimelineBlock = {
  id: string
  name: string
  startMin: number // perc a nap kezdetétől
  endMin: number
  pax: number
  status: string
  source: string
  occasion?: string | null
  occasionIcon?: string | null
  subline?: string | null // ha megadott, felülírja a "N fő · HH:MM" sort
}
export type TimelineRow = { table: string; label?: string; avatarUrl?: string | null; blocks: TimelineBlock[] }

const TABLE_COL = 88 // bal asztal-oszlop szélessége (px)
const ROW_H = 54
// Ha egy blokk ennél szűkebb, a ReservationBlock "+N" kompakt módra vált (ld. lent). Ugyanezt
// használjuk a látható óraszám (win) kiszámolásához is, hogy a két érték ne csússzon szét.
const BLOCK_COMPACT_PX = 168
// Rövid foglalás-blokk minimum szélessége (px), ha a sorban van mellette hely.
const MIN_BLOCK_PX = 104
const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
// Óra-CÍMKÉHEZ: az ablak túlnyúlhat éjfélen (pl. 21–25h a belső logikában), de egy nap
// max 24 óráig tart — a KIJELZETT címke 24/25/26… helyett 00/01/02-t mutasson.
const padH = (h: number) => pad(h % 24)
// Időtartam röviden (mint a napi nézet pillján): 45p · 1ó · 1,5ó
const fmtDur = (m: number) => (m < 60 ? `${m}p` : `${(m / 60).toFixed(m % 60 === 0 ? 0 : 1).replace('.', ',')}ó`)

export function OverviewTimeline({
  rows,
  hourMin,
  hourMax,
  initialWin,
  dayLabel,
  allHref = '/restaurant/bookings',
  title = 'Közelgő foglalások',
  compactPx = BLOCK_COMPACT_PX,
  tableCol = TABLE_COL,
  badge = 'pax',
}: {
  rows: TimelineRow[]
  hourMin: number
  hourMax: number
  initialWin: number
  dayLabel: string
  allHref?: string
  title?: string
  /** Az óránkénti "kompakt-küszöb" px-ben — ennél szűkebb 1 órás sávnál a blokk "+N" módra
   *  vált. Alapból 1 órás (szalon) foglalásokhoz van hangolva; hosszabb átlag-időtartamú
   *  helyeken (pl. étterem, ahol egy asztalfoglalás jellemzően 1,5-2+ óra) kisebbre állítva
   *  több/keskenyebb óra fér ki egyszerre anélkül, hogy a jellemző foglalás olvashatatlanná válna. */
  compactPx?: number
  /** Bal (asztal/munkatárs) oszlop szélessége px-ben — étteremnél a rövid asztalnevek miatt keskenyebb. */
  tableCol?: number
  /** Jobb oldali jelző a blokkon: létszám (étterem) vagy időtartam (szalon — ott mindig 1 fő). */
  badge?: 'pax' | 'duration'
}) {
  // Hány órát mutatunk egyszerre — a rácsterület (TABLE_COL-on túli rész) szélességétől függ.
  // Annyi órát mutatunk, hogy egy 1 órás foglalás blokkja ÁTLÉPJE a kompakt-küszöböt
  // (rácsszélesség / win >= compactPx) — tehát a tartalma (név, "N fő · idő") tényleg
  // olvasható legyen, ne essen rögtön "+N" kompakt módba.
  const gridRef = useRef<HTMLDivElement>(null)
  const [win, setWin] = useState(4)
  const [gridPx, setGridPx] = useState(0)
  useEffect(() => {
    const el = gridRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      setGridPx(e.contentRect.width)
      const fits = Math.floor(e.contentRect.width / compactPx)
      setWin(Math.max(1, Math.min(4, fits)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [compactPx])

  const maxStart = Math.max(hourMin, hourMax - win)
  const [winStart, setWinStart] = useState(() => Math.min(Math.max(initialWin, hourMin), maxStart))
  // Ha a win (látható órák száma) menet közben változik (ResizeObserver), a winStart-ot is
  // vissza kell fogni az új (esetleg szűkebb) [hourMin, maxStart] tartományba.
  useEffect(() => {
    setWinStart((s) => Math.min(Math.max(s, hourMin), maxStart))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win, hourMin, maxStart])

  // „Most" perc a nap kezdetétől — a korán befejezett (completed) foglalás blokkját eddig zsugorítjuk,
  // hogy a felszabaduló idő láthatóvá váljon. Kliensen frissül (percenként), SSR-en null.
  const [nowMin, setNowMin] = useState<number | null>(null)
  useEffect(() => {
    const upd = () => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()) }
    upd()
    const id = setInterval(upd, 60_000)
    return () => clearInterval(id)
  }, [])

  const canPrev = winStart > hourMin
  const canNext = winStart < maxStart

  // Egységes "csúszó filmszalag" koordináta-rendszer: a teljes [hourMin, hourMax] tartományt
  // egyetlen (a látszó ablaknál szélesebb) sávra képezzük le, és EZT a sávot toljuk el
  // (translateX) winStart változásakor — így az óra-fejléc, a rácsvonalak ÉS a foglalás-blokkok
  // MIND együtt, folyamatosan csúsznak, nem csak a blokkok. A blokkok saját left/width-je
  // (a sávon BELÜL, abszolút idő szerint) ezután már NEM függ winStart-tól, csak a foglalás
  // idejétől — a léptetést kizárólag a sáv transform-ja adja.
  const totalHours = Math.max(1, hourMax - hourMin)
  const PEEK_HOURS = 0.3 // a jobb szélen ennyi óra "kukucskál ki" (elhalványulva), mielőtt levágnánk
  const visibleSpan = win + PEEK_HOURS
  const stripWidthPct = (totalHours / visibleSpan) * 100
  const stripX = -((winStart - hourMin) / totalHours) * 100
  const allHours = Array.from({ length: totalHours + 1 }, (_, i) => hourMin + i)
  const hourLeftPct = (h: number) => ((h - hourMin) / totalHours) * 100
  const minBlockPct = 8 * (visibleSpan / totalHours)
  // MIN_BLOCK_PX a csúszó sáv %-ában (a sáv = rácsszélesség × stripWidthPct).
  const minBlockPctPx = gridPx > 0 ? (MIN_BLOCK_PX / (gridPx * (stripWidthPct / 100))) * 100 : 0
  // Jobb szélen halványuló maszk — jelzi, hogy a sáv folytatódik (a "kukucskáló" óra ez alatt tűnik el).
  const edgeMaskStyle = {
    maskImage: 'linear-gradient(to right, black calc(100% - 12px), transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 12px), transparent 100%)',
  } as const
  // Rugalmas, kicsit "túllendülő" spring — a sáv (óra-fejléc + rácsvonalak + blokkok) EGYSZERRE,
  // pulzáló-rugalmas mozgással csússzon, ne mechanikus ease-timing-gel.
  const stripTransition = { type: 'spring' as const, stiffness: 280, damping: 24, mass: 0.9 }

  // Mobilon a nyilak MELLETT kézzel (touch) is húzható a sáv — húzás közben a sáv élőben,
  // azonnal (transition nélkül) követi az ujjat; elengedéskor egy küszöb/lendület alapján
  // 1 órát lép (mint a nyíl), és rugalmasan a helyére pattan. `touchAction: pan-y` kell, hogy a
  // sorlista függőleges natív görgetése (overflow-y-auto) ne törjön el, a vízszintes gesztust
  // pedig a saját onPan kezelőnk kapja el (irány-zár: az első pár px dönti el, x vagy y-e).
  const [dragPct, setDragPct] = useState(0)
  const dragDirRef = useRef<'x' | 'y' | null>(null)
  const isDragging = dragDirRef.current === 'x'
  const stripXLive = isDragging ? stripX + dragPct : stripX
  const liveTransition = isDragging ? { duration: 0 } : stripTransition
  // Húzás-eltolás → sáv-% (a széleken, ahol nincs hova lépni, rugalmas fékezéssel).
  const followDrag = (offsetX: number) => {
    if (gridPx === 0) return
    const blocked = (offsetX < 0 && !canNext) || (offsetX > 0 && !canPrev)
    const stripPx = gridPx * (stripWidthPct / 100)
    setDragPct(((blocked ? offsetX * 0.25 : offsetX) / stripPx) * 100)
  }
  const commitDrag = (offsetX: number, velocityX: number) => {
    if (dragDirRef.current === 'x' && gridPx > 0) {
      const hourPx = gridPx / win
      const past = offsetX <= -hourPx * 0.28 || velocityX < -450
      const back = offsetX >= hourPx * 0.28 || velocityX > 450
      if (past) setWinStart((s) => Math.min(maxStart, s + 1))
      else if (back) setWinStart((s) => Math.max(hourMin, s - 1))
    }
    dragDirRef.current = null
    setDragPct(0)
  }
  const handlePan = (info: { offset: { x: number; y: number } }) => {
    if (dragDirRef.current === null) {
      if (Math.abs(info.offset.x) < 6 && Math.abs(info.offset.y) < 6) return
      dragDirRef.current = Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.2 ? 'x' : 'y'
    }
    if (dragDirRef.current !== 'x') return
    followDrag(info.offset.x)
  }
  const handlePanEnd = (info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) =>
    commitDrag(info.offset.x, info.velocity.x)

  // Desktop: a trackpad kétujjas oldalra-húzása `wheel` esemény (nem pan) — ugyanúgy élőben
  // viszi a sávot, és a gesztus (lendülettel együtt) végén 1 órát lép. Natív, nem-passzív
  // listener kell, hogy a preventDefault megfogja a böngésző „vissza" swipe-navigációját.
  const scrollRef = useRef<HTMLDivElement>(null)
  const wheelRef = useRef<{ acc: number; timer: ReturnType<typeof setTimeout> | null }>({ acc: 0, timer: null })
  const dragFnsRef = useRef({ followDrag, commitDrag, hourPx: gridPx / win })
  dragFnsRef.current = { followDrag, commitDrag, hourPx: gridPx / win }
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const w = wheelRef.current
      if (w.timer === null && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      const { followDrag: follow, hourPx } = dragFnsRef.current
      dragDirRef.current = 'x'
      w.acc = Math.max(-hourPx, Math.min(hourPx, w.acc - e.deltaX))
      follow(w.acc)
      if (w.timer) clearTimeout(w.timer)
      w.timer = setTimeout(() => {
        dragFnsRef.current.commitDrag(w.acc, 0)
        w.acc = 0
        w.timer = null
      }, 140)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[26px] bg-[var(--dav-glass-strong)] backdrop-blur-lg p-[22px] shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
      {/* Fejléc — a gombok egyszer definiálva, két elrendezésben használva */}
      {(() => {
        const prevBtn = (
          <motion.button
            type="button"
            onClick={() => setWinStart((s) => Math.max(hourMin, s - 1))}
            disabled={!canPrev}
            aria-label="Korábbi óra"
            title="Korábbi óra"
            variants={buttonHover}
            initial="rest"
            whileHover={canPrev ? 'hover' : undefined}
            whileTap={canPrev ? 'hover' : undefined}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink shadow-[0_1px_3px_rgba(40,40,40,.08)] transition-colors hover:bg-[#e6e5e1] disabled:opacity-35 disabled:hover:bg-[#f1f0ed]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </motion.button>
        )
        const nextBtn = (
          <motion.button
            type="button"
            onClick={() => setWinStart((s) => Math.min(maxStart, s + 1))}
            disabled={!canNext}
            aria-label="Későbbi óra"
            title="Későbbi óra"
            variants={buttonHover}
            initial="rest"
            whileHover={canNext ? 'hover' : undefined}
            whileTap={canNext ? 'hover' : undefined}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink shadow-[0_1px_3px_rgba(40,40,40,.08)] transition-colors hover:bg-[#e6e5e1] disabled:opacity-35 disabled:hover:bg-[#f1f0ed]"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </motion.button>
        )
        const allLink = (
          <MotionLink
            href={allHref}
            aria-label="Összes foglalás"
            title="Összes foglalás"
            variants={buttonHover}
            initial="rest"
            whileHover="hover"
            whileTap="hover"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink shadow-[0_1px_3px_rgba(40,40,40,.08)] transition-colors hover:bg-[#e6e5e1]"
          >
            <ArrowUpRight className="h-[15px] w-[15px]" strokeWidth={2.2} />
          </MotionLink>
        )
        const timeLabel = (
          <span className="relative inline-block overflow-hidden align-bottom">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${winStart}-${win}`}
                  initial={{ y: 7, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -7, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.42, 0, 0.58, 1] }}
                  className="inline-block"
                >
                  {padH(winStart)}:00 – {padH(winStart + win)}:00
                </motion.span>
              </AnimatePresence>
            </span>
        )
        // a „Ma” fölösleges (mindig a mai nap az alap) — csak más napnál (pl. Holnap) írjuk ki
        const dayPrefix = dayLabel && dayLabel !== 'Ma' ? <>{dayLabel} <span className="text-ink-soft2">|</span>{' '}</> : null
        return (
          <>
            {/* MOBIL: felül a cím (teljes szélesség) + ↗, alatta ‹ nap | idősáv › — a lapozó az
                időpontot lépteti, így oda is tartozik, a cím pedig kifér */}
            <div className="sm:hidden">
              {/* cím középen: bal oldalt a ↗-vel azonos szélességű üres hely */}
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1 truncate text-center text-[19px] font-medium text-ink">{title}</div>
                {allLink}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                {prevBtn}
                <div className="min-w-0 truncate text-center text-[12.5px] text-ink-soft">
                  {dayPrefix}{timeLabel}
                </div>
                {nextBtn}
              </div>
            </div>
            {/* ASZTAL: BAL óra-léptető, KÖZÉPEN a cím, JOBBRA óra-léptető + ↗ a foglalásokra */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex w-[84px] shrink-0 items-center">{prevBtn}</div>
              <div className="min-w-0 flex-1 text-center">
                <div className="truncate text-[19px] font-medium text-ink">{title}</div>
                <div className="mt-0.5 truncate text-[12.5px] text-ink-soft">
                  {dayPrefix}{timeLabel}
                </div>
              </div>
              <div className="flex w-[84px] shrink-0 items-center justify-end gap-1.5">{nextBtn}{allLink}</div>
            </div>
          </>
        )
      })()}

      {/* Óra-fejléc (vízszintes időtengely) */}
      <div className="mt-4 flex">
        <div className="shrink-0" style={{ width: tableCol }} />
        <div ref={gridRef} className="relative h-4 flex-1 overflow-hidden" style={edgeMaskStyle}>
          {/* Egyetlen csúszó sáv a TELJES [hourMin, hourMax] tartomány óráival — winStart
              változásakor a sávot toljuk (transform), a jobb szélen kimaszkolt rész adja a
              "kukucskáló" következő óra hatását, folyamatosan csúszva a blokkokkal együtt. */}
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{ width: `${stripWidthPct}%` }}
            animate={{ x: `${stripXLive}%` }}
            transition={liveTransition}
          >
            {allHours.map((h) => (
              <span
                key={h}
                className="absolute top-0 pl-1 text-[10.5px] font-semibold text-ink-soft2"
                style={{ left: `${hourLeftPct(h)}%` }}
              >
                {padH(h)}:00
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Sorok = asztalok; jobbra a vízszintes idővonal. A KÜLSŐ konténer flex-1 (a bentóval
          együtt nyúlik, ha a szülőnek van magassága — pl. lg: 3-oszlopos grid), DE explicit
          min-height is kell: lg alatt a grid 1 oszlopra esik, a sorok egymás alá kerülnek, és
          a szülőnek NINCS meghatározott magassága → flex-1 önmagában 0-ra esne, az abszolút
          görgő sáv (inset-0) is 0 magas lenne, és semmi (még az üres-állapot szöveg sem) látszana. */}
      <div className="relative mt-1 min-h-[340px] flex-1 lg:min-h-[200px]">
        <motion.div
          ref={scrollRef}
          className="no-scrollbar absolute inset-0 select-none overflow-y-auto"
          data-lenis-prevent
          style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
          onPan={(_e, info) => handlePan(info)}
          onPanEnd={(_e, info) => handlePanEnd(info)}
        >
        {rows.length === 0 ? (
          <div className="flex h-full min-h-[160px] items-center justify-center text-[13px] text-ink-soft">
            Nincs közelgő foglalás.
          </div>
        ) : (
          rows.map((row) => {
            const vis = row.blocks
              .filter((b) => b.endMin > hourMin * 60 && b.startMin < hourMax * 60)
              .sort((a, b) => a.startMin - b.startMin)
            return (
              <div key={row.table} className="flex" style={{ minHeight: ROW_H }}>

                <div
                  className="flex shrink-0 items-center gap-1.5 border-t border-dotted border-[#e4dfd0] pr-2 text-[12px] font-semibold text-ink"
                  style={{ width: tableCol }}
                >
                  {row.avatarUrl !== undefined && (
                    row.avatarUrl ? (
                      <img src={row.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover object-top" />
                    ) : (
                      // Ugyanaz a fallback, mint a Foglalások oldal `Ava` komponensében — sötét
                      // gradiens + UserRound ikon, ha nincs feltöltött profilkép.
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}
                      >
                        <UserRound className="h-[55%] w-[55%] text-white/30" strokeWidth={1.2} />
                      </span>
                    )
                  )}
                  <span className="line-clamp-2 break-words leading-tight">{row.label ?? row.table}</span>
                </div>
                <div
                  className="relative flex-1 overflow-hidden border-t border-dotted border-[#e4dfd0]"
                  style={{ minHeight: ROW_H, ...edgeMaskStyle }}
                >
                  {/* Ugyanaz a csúszó sáv, mint a fejlécben — a rácsvonalak ÉS a blokkok a sávon
                      BELÜL, abszolút idő szerint fix pozícióban vannak; a sáv transform-ja adja
                      a léptetést, így minden együtt, folyamatosan csúszik. */}
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${stripWidthPct}%` }}
                    animate={{ x: `${stripXLive}%` }}
                    transition={liveTransition}
                  >
                    {allHours.map((h) => (
                      <div
                        key={h}
                        className="pointer-events-none absolute top-0 bottom-0 border-l border-dotted border-[#e4dfd0]"
                        style={{ left: `${hourLeftPct(h)}%` }}
                      />
                    ))}
                    {/* Foglalás-blokkok az asztal sorában (idő szerint, a sávon belül fix pozícióban) */}
                    {vis.map((b, k) => {
                      // Ha KORÁN befejezték (completed) és még nem járt le az idő, a blokk a MOST-ig zsugorodik,
                      // így a felszabaduló idő láthatóvá válik a sávban.
                      const effEnd = b.status === 'completed' && nowMin != null && nowMin > b.startMin
                        ? Math.max(b.startMin, Math.min(b.endMin, nowMin))
                        : b.endMin
                      const left = Math.max(0, ((b.startMin - hourMin * 60) / (totalHours * 60)) * 100)
                      const right = Math.min(100, ((effEnd - hourMin * 60) / (totalHours * 60)) * 100)
                      // Rövid (pl. 30 perces) foglalás is olvasható legyen: ha van hely, legalább
                      // MIN_BLOCK_PX széles — de csak a sor következő foglalásáig, hogy ne fedjék egymást.
                      const next = vis[k + 1]
                      const nextLeft = next ? ((next.startMin - hourMin * 60) / (totalHours * 60)) * 100 : 100
                      const minPct = minBlockPctPx > 0 && effEnd === b.endMin ? Math.min(minBlockPctPx, nextLeft - left) : 0
                      const width = Math.max(right - left, minBlockPct, minPct)
                      return (
                        <ReservationBlock key={b.id} b={b} left={left} width={width} tone={blockTone(b.status)} freedEarly={effEnd < b.endMin} compactPx={compactPx} badge={badge} />
                      )
                    })}
                  </motion.div>
                </div>
              </div>
            )
          })
        )}
        </motion.div>
      </div>
    </div>
  )
}

/** Blokk-tónus a KÁNONI státusz-paletta szerint (mint a DailyView `statusBlock`).
 *  A cancelled/no_show ide nem jut el (kiszűrve). `onDark` = fehér szövegű háttér. */
type BlockTone = { bg: string; text: string; sub: string; onDark: boolean }
function blockTone(status: string): BlockTone {
  switch (status) {
    case 'pending':   return { bg: '#F1CE45', text: 'text-ink-dark',  sub: 'text-ink-dark/60', onDark: false } // függő — gold
    case 'seated':    return { bg: '#1D9D63', text: 'text-white',     sub: 'text-white/60',    onDark: true }  // leültetve — zöld
    case 'completed': return { bg: '#D8D2C2', text: 'text-ink-soft2', sub: 'text-ink-soft2',   onDark: false } // befejezett — bézs
    default:          return { bg: '#1D1C19', text: 'text-white',     sub: 'text-white/55',    onDark: true }  // megerősített — sötét
  }
}

/**
 * Egyetlen foglalás-blokk a sávban. Saját szélességét ResizeObserverrel figyeli: ha SZŰK
 * (a küszöb alatt), az egymásra csúsztatott avatarok helyett EGYETLEN, nem deformálódó
 * „+N" létszám-kört mutat (a teljes fővel), hogy a kör ne torzuljon és ne legyen zavaros.
 */
function ReservationBlock({
  b, left, width, tone, freedEarly, compactPx, badge,
}: {
  b: TimelineBlock
  left: number
  width: number
  tone: BlockTone
  freedEarly: boolean
  compactPx: number
  badge: 'pax' | 'duration'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [px, setPx] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setPx(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Szűk blokk → csak egy létszám-kör. (px===0 az első festésig: legyen compact, hogy sose deformáljon.)
  const compact = px === 0 || px < compactPx
  // A ring a BLOKK hátterével egyezik → tiszta kaszkád-elválasztás. Felszabadult blokknál semleges.
  const ringColor = freedEarly ? '#e6e3da' : tone.bg
  // Max 2 profil-ikon, a többi fő „+N" körben — így a blokk szélén is kifér.
  const AVATARS = 2
  const showCount = b.pax > AVATARS
  // Alkalom (szülinap stb.) — kis ikon-kör az alkalom saját színével (mint a napi nézetben);
  // a létszám elé kerül, hogy szűk blokkon se csússzon ki a név mögül.
  const occasionBadge = b.occasion ? <OccasionBadge occasion={b.occasion} icon={b.occasionIcon} ring={ringColor} /> : null
  // TÖMÖR (nem átlátszó) avatar-chipek → átfedéskor tisztán takarják egymást; a gyűrű (tone.bg)
  // adja a kaszkád-elválasztást. Sötét blokkon világos chip, világoson sötét chip.
  const avatarBg = freedEarly ? '#d3cec0' : tone.onDark ? '#efece5' : '#1D1C19'
  const avatarFg = freedEarly ? '#6f6b5f' : tone.onDark ? '#1D1C19' : '#ffffff'
  const countBg = freedEarly ? '#8a8779' : tone.onDark ? '#ffffff' : '#1D1C19'
  const countFg = freedEarly ? '#ffffff' : tone.onDark ? '#1D1C19' : '#ffffff'

  return (
    <div
      ref={ref}
      className={`absolute top-[5px] bottom-[5px] flex items-center gap-2 overflow-hidden rounded-[14px] px-2.5 ${
        freedEarly
          ? 'border border-dashed border-[#c9c3b4] text-ink-soft2'
          : b.status === 'completed'
            ? `border border-[#c9c2ae] ${tone.text}`
            : tone.text
      }`}
      // left/width a csúszó SÁVON belül fix (abszolút idő szerint) — a léptetést a szülő sáv
      // transform-ja adja, ezért itt már nem kell animálni, csak statikusan pozicionálni.
      style={{
        left: `calc(${left}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        background: freedEarly
          ? 'repeating-linear-gradient(115deg, rgba(230,227,218,.6) 0 6px, rgba(214,210,196,.6) 6px 12px)'
          : b.status === 'completed'
            // Befejezett — szaggatott „börtön" hatch (mint a napi nézetben), nem szolid bézs.
            ? 'repeating-linear-gradient(115deg, rgba(255,255,255,.55) 0 7px, rgba(190,180,140,.26) 7px 14px)'
            : tone.bg,
      }}
      title={freedEarly ? `${b.name} · ${b.pax} fő · korán befejezve, felszabadult` : `${b.name} · ${b.pax} fő`}
    >
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[12px] font-semibold leading-tight ${freedEarly ? 'line-through decoration-[#a9a498]' : ''}`}>
          {b.name}
        </div>
        <div className={`truncate text-[10px] ${freedEarly ? 'text-ink-soft2' : tone.sub}`}>
          {freedEarly ? 'korán zárt · felszabadult' : (b.subline ?? `${b.pax} fő · ${fmt(b.startMin)}`)}
        </div>
      </div>
      {occasionBadge}
      {/* Szalon: időtartam-pill (pl. „1,5ó") a létszám helyett. */}
      {badge === 'duration' ? (
        <span
          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums"
          style={{ background: countBg, color: countFg, boxShadow: `0 0 0 2px ${ringColor}` }}
        >
          {fmtDur(b.endMin - b.startMin)}
        </span>
      ) : /* Létszám-jelző. SZŰK blokk → egyetlen, fix méretű „+N" kör (nem deformál). */
      compact ? (
        <span
          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
          style={{ background: countBg, color: countFg, boxShadow: `0 0 0 2px ${ringColor}` }}
        >
          +{b.pax}
        </span>
      ) : (
        <div className="flex shrink-0 items-center pr-0.5">
          {Array.from({ length: Math.min(b.pax, AVATARS) }).map((_, i) => (
            <span
              key={i}
              className="flex h-5 w-5 items-center justify-center rounded-full"
              // A jobbszélső elem FELÜL (növekvő z-index), hogy a cascade tiszta legyen.
              style={{ marginLeft: i ? -8 : 0, zIndex: i + 1, background: avatarBg, color: avatarFg, boxShadow: `0 0 0 2px ${ringColor}` }}
            >
              <User className="h-3 w-3" strokeWidth={2} />
            </span>
          ))}
          {showCount && (
            <span
              className="relative flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums"
              style={{ marginLeft: -8, zIndex: 10, background: countBg, color: countFg, boxShadow: `0 0 0 2px ${ringColor}` }}
            >
              +{b.pax - AVATARS}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
