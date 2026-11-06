'use client'

import { statusBlockClass, statusCard } from '@/components/shared/statusColors'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Avatar, Card, CardTitle, IconButton, Meta } from '@/components/ui-kit'
import { MobileDayTimeline, type DayRow } from '@/components/blocks/day-timeline'
import { OccasionBadge } from './OccasionBadge'

/**
 * Áttekintés — „Közelgő foglalások” (a /design 4.1 / 4.6 kártyája). Desktopon erőforrás-idővonal: bal oszlop
 * = munkatárs (szalon) vagy asztal (étterem), vízszintes időtengely, a foglalások blokkok a kit státusz-tónusaival,
 * sárga „most” vonal; a nyilak (és húzás / trackpad) óránként léptetnek. Mobilon (4.4) a függőleges nap-idővonal.
 * A design oldal és a landing is ezt mutatja mintaadattal (`nowAt`).
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
export type TimelineRow = { table: string; label?: React.ReactNode; avatarUrl?: string | null; blocks: TimelineBlock[] }

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
  nowAt,
  className = '',
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
  /** Rögzített „most” (perc a nap kezdetétől) — a design / landing mintájához; élesben az óra adja. */
  nowAt?: number
  className?: string
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
  // mobilon ennyi óra látszik a kezdő órától; a ⌄ négyesével bővíti
  const [mobileHours, setMobileHours] = useState(5)
  useEffect(() => {
    if (nowAt !== undefined) { setNowMin(nowAt); return }
    const upd = () => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()) }
    upd()
    const id = setInterval(upd, 60_000)
    return () => clearInterval(id)
  }, [nowAt])

  // a ma nézett idővonal követi az időt: ha a „most” vonal kifutna az ablakból, magától továbblép — amíg kézzel nem lapoztak
  const userNavRef = useRef(false)
  useEffect(() => {
    if (nowAt !== undefined || nowMin == null || userNavRef.current || (dayLabel && dayLabel !== 'Ma')) return
    const h = Math.floor(nowMin / 60)
    if (h >= winStart + win) setWinStart(Math.min(maxStart, h))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMin])

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
      if (past) { userNavRef.current = true; setWinStart((s) => Math.min(maxStart, s + 1)) }
      else if (back) { userNavRef.current = true; setWinStart((s) => Math.max(hourMin, s - 1)) }
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

  // a „most” vonal csak a mai napon (vagy a minta rögzített idejénél) — a sávon belül, így együtt csúszik a blokkokkal
  const showNow = nowMin != null && (nowAt !== undefined || !dayLabel || dayLabel === 'Ma') && nowMin >= hourMin * 60 && nowMin <= hourMax * 60
  const nowPct = showNow ? hourLeftPct(nowMin! / 60) : 0
  const range = `${padH(winStart)}:00 – ${padH(winStart + win)}:00`
  // a „Ma” fölösleges (mindig a mai nap az alap) — csak más napnál (pl. Holnap) írjuk ki
  const dayPrefix = dayLabel && dayLabel !== 'Ma' ? `${dayLabel} · ` : ''

  // Mobil (4.4): óránként egy sor a látható ablaktól — az óra első foglalása, a többi a sárga „+N” alatt kinyitható;
  // az alsó ⌄ további órákat tölt be.
  // a munkatárs avatarja (fotó nélkül monogram) — csak szalonnál, ahol a sor egy munkatárs (avatarUrl meg van adva)
  const flat = rows.flatMap((r) => r.blocks.map((b) => ({ b, avatar: r.avatarUrl !== undefined ? { src: r.avatarUrl, name: r.table } : null })))
  const nowH = showNow ? Math.floor(nowMin! / 60) : null
  const toEv = ({ b, avatar }: (typeof flat)[number]) => ({
    n: b.name,
    s: b.subline ?? `${fmt(b.startMin)}–${fmt(b.endMin)} · ${b.pax} fő`,
    // a színek a közös szabályból (shared/statusColors): megerősített sötét, függő sárga, befejezett fehér
    ...statusCard(b.status),
    avatars: avatar ? [avatar] : undefined,
  })
  const dayRows: DayRow[] = Array.from({ length: Math.max(1, Math.min(mobileHours, hourMax - winStart)) }, (_, i) => {
    const h = winStart + i
    const past = nowH != null && h < nowH
    const inHour = flat.filter(({ b }) => Math.floor(b.startMin / 60) === h).sort((x, y) => x.b.startMin - y.b.startMin)
    return {
      t: `${padH(h)}:00`,
      st: nowH == null ? undefined : past ? 'past' : h === nowH ? 'now' : undefined,
      ev: inHour[0] && toEv(inHour[0]),
      more: inHour.slice(1).map((x) => toEv(x)),
    }
  })

  return (
    <Card className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {/* MOBIL (4.4): cím + idősáv, ↗ a Foglalásokra; alatta a függőleges nap-idővonal */}
      <div className="sm:hidden">
        <div className="flex items-start justify-between">
          <span><CardTitle>{title}</CardTitle><Meta className="text-ui-label">{dayPrefix}{padH(winStart)}:00 – {padH(winStart + dayRows.length)}:00</Meta></span>
          <IconButton icon={ArrowUpRight} label="Összes foglalás" size="sm" href={allHref} />
        </div>
        {rows.length === 0
          ? <Meta className="py-8 text-center">Nincs közelgő foglalás.</Meta>
          : <div className="mt-3"><MobileDayTimeline rows={dayRows} more={winStart + mobileHours < hourMax} onMore={() => setMobileHours((n) => n + 4)} /></div>}
      </div>

      {/* DESKTOP: ← | cím + idősáv | → ↗ */}
      <div className="hidden items-start justify-between sm:flex">
        <IconButton icon={ArrowLeft} label="Korábbi óra" onClick={() => { userNavRef.current = true; setWinStart((s) => Math.max(hourMin, s - 1)) }} disabled={!canPrev} className="disabled:opacity-40" />
        <div className="min-w-0 text-center">
          <div className="truncate text-ui-title font-normal text-ui-text">{title}</div>
          <div className="relative overflow-hidden text-ui-meta text-ui-muted">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={`${winStart}-${win}`} initial={{ y: 7, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -7, opacity: 0 }} transition={{ duration: 0.18, ease: [0.42, 0, 0.58, 1] }} className="inline-block">
                {dayPrefix}{range}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        <span className="flex gap-1.5">
          <IconButton icon={ArrowRight} label="Későbbi óra" onClick={() => { userNavRef.current = true; setWinStart((s) => Math.min(maxStart, s + 1)) }} disabled={!canNext} className="disabled:opacity-40" />
          <IconButton icon={ArrowUpRight} label="Összes foglalás" href={allHref} />
        </span>
      </div>

      {/* Óra-fejléc (vízszintes időtengely) — egyetlen csúszó sáv a teljes [hourMin, hourMax] tartománnyal */}
      <div className="mt-4 hidden sm:flex">
        <div className="shrink-0" style={{ width: tableCol }} />
        <div ref={gridRef} className="relative h-5 flex-1 overflow-hidden" style={edgeMaskStyle}>
          <motion.div className="absolute inset-y-0 left-0" style={{ width: `${stripWidthPct}%` }} animate={{ x: `${stripXLive}%` }} transition={liveTransition}>
            {allHours.map((h) => (
              <span key={h} className="absolute top-0 text-ui-label text-ui-muted" style={{ left: `${hourLeftPct(h)}%` }}>{padH(h)}:00</span>
            ))}
            {showNow && <span className="absolute bottom-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ui-yellow" style={{ left: `${nowPct}%` }} />}
          </motion.div>
        </div>
      </div>

      {/* Sorok — explicit min-height kell: lg alatt a szülőnek nincs magassága, a flex-1 önmagában 0 lenne */}
      <div className="relative mt-1 hidden min-h-[200px] flex-1 sm:block">
        <motion.div
          ref={scrollRef}
          className="no-scrollbar absolute inset-0 select-none overflow-y-auto"
          data-lenis-prevent
          style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
          onPan={(_e, info) => handlePan(info)}
          onPanEnd={(_e, info) => handlePanEnd(info)}
        >
        {rows.length === 0 ? (
          <Meta className="flex h-full min-h-[160px] items-center justify-center">Nincs közelgő foglalás.</Meta>
        ) : (
          rows.map((row) => {
            const vis = row.blocks
              .filter((b) => b.endMin > hourMin * 60 && b.startMin < hourMax * 60)
              .sort((a, b) => a.startMin - b.startMin)
            return (
              <div key={row.table} className="flex border-t border-dotted border-ui-divider" style={{ minHeight: ROW_H }}>
                <div className="flex shrink-0 items-center gap-2 pr-2 text-ui-meta text-ui-text" style={{ width: tableCol }}>
                  {row.avatarUrl !== undefined && <Avatar size="xs" src={row.avatarUrl} name={row.table} />}
                  <span className="line-clamp-2 break-words leading-tight">{row.label ?? row.table}</span>
                </div>
                <div className="relative flex-1 overflow-hidden" style={{ minHeight: ROW_H, ...edgeMaskStyle }}>
                  {/* ugyanaz a csúszó sáv, mint a fejlécben — a blokkok abszolút idő szerint fixek, a sáv transform-ja léptet */}
                  <motion.div className="absolute inset-y-0 left-0" style={{ width: `${stripWidthPct}%` }} animate={{ x: `${stripXLive}%` }} transition={liveTransition}>
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
                      return <ReservationBlock key={b.id} b={b} left={left} width={width} freedEarly={effEnd < b.endMin} badge={badge} />
                    })}
                    {showNow && <span className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-ui-yellow" style={{ left: `${nowPct}%` }} />}
                  </motion.div>
                </div>
              </div>
            )
          })
        )}
        </motion.div>
      </div>
    </Card>
  )
}

/** A minta kulcsai (ok, done, soon) → élő státusz; a szín a közös szabályból (shared/statusColors), mint a Foglalásokban. */
const STATUS_KEY: Record<string, string> = { ok: 'confirmed', soon: 'confirmed', done: 'completed' }

/** Egy foglalás-blokk a sávban: név, jobbra a létszám (étterem) vagy az időtartam (szalon); alkalom-jelvény. A korán
 *  zárt (felszabadult) idő csíkos, áthúzott névvel. A részletek a tooltipben. */
function ReservationBlock({ b, left, width, freedEarly, badge }: { b: TimelineBlock; left: number; width: number; freedEarly: boolean; badge: 'pax' | 'duration' }) {
  return (
    <div
      className={`absolute inset-y-[5px] flex items-center justify-between gap-2 overflow-hidden whitespace-nowrap rounded-ui-control px-3 pr-6 text-ui-meta ${freedEarly ? 'ui-hatch-cell text-ui-muted' : statusBlockClass(STATUS_KEY[b.status] ?? b.status)}`}
      style={{ left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)` }}
      title={freedEarly ? `${b.name} · korán befejezve, felszabadult` : [b.name, b.subline ?? `${b.pax} fő · ${fmt(b.startMin)}`].join(' · ')}
    >
      {!freedEarly && <span className={`absolute right-2 top-1.5 h-2 w-2 rounded-full ${statusCard(STATUS_KEY[b.status] ?? b.status).dot}`} />}
      <span className={`truncate ${freedEarly ? 'line-through' : ''}`}>{b.name}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {b.occasion && <OccasionBadge occasion={b.occasion} icon={b.occasionIcon} />}
        <span className="opacity-60">{badge === 'duration' ? fmtDur(b.endMin - b.startMin) : `${b.pax} fő`}</span>
      </span>
    </div>
  )
}
