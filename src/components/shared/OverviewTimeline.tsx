'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ArrowUpRight, User } from 'lucide-react'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'
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
export type TimelineRow = { table: string; label?: string; blocks: TimelineBlock[] }

const TABLE_COL = 88 // bal asztal-oszlop szélessége (px)
const ROW_H = 54
// Ha egy blokk ennél szűkebb, a ReservationBlock "+N" kompakt módra vált (ld. lent). Ugyanezt
// használjuk a látható óraszám (win) kiszámolásához is, hogy a két érték ne csússzon szét.
const BLOCK_COMPACT_PX = 168
const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
// Óra-CÍMKÉHEZ: az ablak túlnyúlhat éjfélen (pl. 21–25h a belső logikában), de egy nap
// max 24 óráig tart — a KIJELZETT címke 24/25/26… helyett 00/01/02-t mutasson.
const padH = (h: number) => pad(h % 24)

export function OverviewTimeline({
  rows,
  hourMin,
  hourMax,
  initialWin,
  dayLabel,
  allHref = '/restaurant/bookings',
  title = 'Közelgő foglalások',
  compactPx = BLOCK_COMPACT_PX,
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
  const handlePan = (info: { offset: { x: number; y: number } }) => {
    if (dragDirRef.current === null) {
      if (Math.abs(info.offset.x) < 6 && Math.abs(info.offset.y) < 6) return
      dragDirRef.current = Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.2 ? 'x' : 'y'
    }
    if (dragDirRef.current !== 'x' || gridPx === 0) return
    const stripPx = gridPx * (stripWidthPct / 100)
    setDragPct((info.offset.x / stripPx) * 100)
  }
  const handlePanEnd = (info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
    if (dragDirRef.current === 'x' && gridPx > 0) {
      const hourPx = gridPx / win
      const past = info.offset.x <= -hourPx * 0.28 || info.velocity.x < -450
      const back = info.offset.x >= hourPx * 0.28 || info.velocity.x > 450
      if (past) setWinStart((s) => Math.min(maxStart, s + 1))
      else if (back) setWinStart((s) => Math.max(hourMin, s - 1))
    }
    dragDirRef.current = null
    setDragPct(0)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[26px] bg-[var(--dav-glass-strong)] backdrop-blur-lg p-[22px] shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
      {/* Fejléc: BAL óra-léptető, KÖZÉPEN a cím (referencia), JOBBRA óra-léptető + ↗ a foglalásokra */}
      <div className="flex items-center gap-2">
        <div className="flex w-[84px] shrink-0 items-center">
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
        </div>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[19px] font-medium text-ink">{title}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-ink-soft">
            {dayLabel} <span className="text-ink-soft2">|</span>{' '}
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
          </div>
        </div>
        <div className="flex w-[84px] shrink-0 items-center justify-end gap-1.5">
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
        </div>
      </div>

      {/* Óra-fejléc (vízszintes időtengely) */}
      <div className="mt-4 flex">
        <div className="shrink-0" style={{ width: TABLE_COL }} />
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
      <div className="relative mt-1 min-h-[200px] flex-1">
        <motion.div
          className="no-scrollbar absolute inset-0 overflow-y-auto"
          data-lenis-prevent
          style={{ touchAction: 'pan-y' }}
          onPan={(_e, info) => handlePan(info)}
          onPanEnd={(_e, info) => handlePanEnd(info)}
        >
        {rows.length === 0 ? (
          <div className="flex h-full min-h-[160px] items-center justify-center text-[13px] text-ink-soft">
            Nincs közelgő foglalás.
          </div>
        ) : (
          rows.map((row) => {
            const vis = row.blocks.filter((b) => b.endMin > hourMin * 60 && b.startMin < hourMax * 60)
            return (
              <div key={row.table} className="flex" style={{ minHeight: ROW_H }}>

                <div
                  className="flex shrink-0 items-center border-t border-dotted border-[#e4dfd0] pr-2 text-[12px] font-semibold text-ink"
                  style={{ width: TABLE_COL }}
                >
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
                    {vis.map((b) => {
                      // Ha KORÁN befejezték (completed) és még nem járt le az idő, a blokk a MOST-ig zsugorodik,
                      // így a felszabaduló idő láthatóvá válik a sávban.
                      const effEnd = b.status === 'completed' && nowMin != null && nowMin > b.startMin
                        ? Math.max(b.startMin, Math.min(b.endMin, nowMin))
                        : b.endMin
                      const left = Math.max(0, ((b.startMin - hourMin * 60) / (totalHours * 60)) * 100)
                      const right = Math.min(100, ((effEnd - hourMin * 60) / (totalHours * 60)) * 100)
                      const width = Math.max(right - left, minBlockPct)
                      return (
                        <ReservationBlock key={b.id} b={b} left={left} width={width} tone={blockTone(b.status)} freedEarly={effEnd < b.endMin} compactPx={compactPx} />
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
  b, left, width, tone, freedEarly, compactPx,
}: {
  b: TimelineBlock
  left: number
  width: number
  tone: BlockTone
  freedEarly: boolean
  compactPx: number
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
  const showCount = b.pax > 3
  // A ring a BLOKK hátterével egyezik → tiszta kaszkád-elválasztás. Felszabadult blokknál semleges.
  const ringColor = freedEarly ? '#e6e3da' : tone.bg
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
        <div className={`flex items-center gap-1 truncate text-[12px] font-semibold leading-tight ${freedEarly ? 'line-through decoration-[#a9a498]' : ''}`}>
          {b.name}{b.occasion && (() => { const OccIcon = eventIconByKey(b.occasionIcon); return <OccIcon className="ml-1 h-3 w-3 shrink-0" /> })()}
        </div>
        <div className={`truncate text-[10px] ${freedEarly ? 'text-ink-soft2' : tone.sub}`}>
          {freedEarly ? 'korán zárt · felszabadult' : (b.subline ?? `${b.pax} fő · ${fmt(b.startMin)}`)}
        </div>
      </div>
      {/* Létszám-jelző. SZŰK blokk → egyetlen, fix méretű „+N" kör (nem deformál). */}
      {compact ? (
        <span
          className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
          style={{ background: countBg, color: countFg, boxShadow: `0 0 0 2px ${ringColor}` }}
        >
          +{b.pax}
        </span>
      ) : (
        <div className="flex shrink-0 items-center pr-0.5">
          {Array.from({ length: showCount ? 3 : Math.min(b.pax, 3) }).map((_, i) => (
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
              +{b.pax - 3}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
