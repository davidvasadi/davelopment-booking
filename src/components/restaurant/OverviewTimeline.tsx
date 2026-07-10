'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowUpRight, User } from 'lucide-react'
import { eventIconByKey } from '@/components/settings/eventTypeIcons'

/**
 * Áttekintés — „Naptár" erőforrás-idővonal (Crextio-stílus). BAL oszlop = ASZTALOK (soronként
 * egy asztal), VÍZSZINTES időtengely: az órák oszlopokban, függőleges pontozott vonalakkal.
 * A foglalások vízszintesen elnyúló, lekerekített blokkok az adott asztal sorában, idő szerint
 * pozicionálva. Egyszerre `WIN` óra látszik — a jobb-felső Apple-nyilak léptetik az idősávot.
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
}
export type TimelineRow = { table: string; blocks: TimelineBlock[] }

const WIN = 4 // egyszerre látható órák
const TABLE_COL = 88 // bal asztal-oszlop szélessége (px)
const ROW_H = 54
const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`

export function OverviewTimeline({
  rows,
  hourMin,
  hourMax,
  initialWin,
  dayLabel,
  allHref = '/restaurant/bookings',
}: {
  rows: TimelineRow[]
  hourMin: number
  hourMax: number
  initialWin: number
  dayLabel: string
  allHref?: string
}) {
  const maxStart = Math.max(hourMin, hourMax - WIN)
  const [winStart, setWinStart] = useState(() => Math.min(Math.max(initialWin, hourMin), maxStart))

  // „Most" perc a nap kezdetétől — a korán befejezett (completed) foglalás blokkját eddig zsugorítjuk,
  // hogy a felszabaduló idő láthatóvá váljon. Kliensen frissül (percenként), SSR-en null.
  const [nowMin, setNowMin] = useState<number | null>(null)
  useEffect(() => {
    const upd = () => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()) }
    upd()
    const id = setInterval(upd, 60_000)
    return () => clearInterval(id)
  }, [])

  const winStartMin = winStart * 60
  const winMin = WIN * 60
  const gridHours = Array.from({ length: WIN + 1 }, (_, i) => winStart + i)

  const canPrev = winStart > hourMin
  const canNext = winStart < maxStart

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[26px] bg-[var(--dav-glass-strong)] backdrop-blur-lg p-[22px] shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
      {/* Fejléc: BAL óra-léptető, KÖZÉPEN a cím (referencia), JOBBRA óra-léptető + ↗ a foglalásokra */}
      <div className="flex items-center gap-2">
        <div className="flex w-[84px] shrink-0 items-center">
          <button
            type="button"
            onClick={() => setWinStart((s) => Math.max(hourMin, s - 1))}
            disabled={!canPrev}
            aria-label="Korábbi óra"
            title="Korábbi óra"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink shadow-[0_1px_3px_rgba(40,40,40,.08)] transition-all hover:bg-[#e6e5e1] active:scale-95 disabled:opacity-35 disabled:hover:bg-[#f1f0ed]"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[19px] font-medium text-ink">Közelgő foglalások</div>
          <div className="mt-0.5 truncate text-[12.5px] text-ink-soft">
            {dayLabel} <span className="text-ink-soft2">|</span> {pad(winStart)}:00 – {pad(winStart + WIN)}:00
          </div>
        </div>
        <div className="flex w-[84px] shrink-0 items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setWinStart((s) => Math.min(maxStart, s + 1))}
            disabled={!canNext}
            aria-label="Későbbi óra"
            title="Későbbi óra"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink shadow-[0_1px_3px_rgba(40,40,40,.08)] transition-all hover:bg-[#e6e5e1] active:scale-95 disabled:opacity-35 disabled:hover:bg-[#f1f0ed]"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
          <Link
            href={allHref}
            aria-label="Összes foglalás"
            title="Összes foglalás"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink shadow-[0_1px_3px_rgba(40,40,40,.08)] transition-all hover:bg-[#e6e5e1] active:scale-95"
          >
            <ArrowUpRight className="h-[15px] w-[15px]" strokeWidth={2.2} />
          </Link>
        </div>
      </div>

      {/* Óra-fejléc (vízszintes időtengely) */}
      <div className="mt-4 flex">
        <div className="shrink-0" style={{ width: TABLE_COL }} />
        <div className="relative h-4 flex-1">
          {gridHours.slice(0, WIN).map((h, i) => (
            <span
              key={h}
              className="absolute top-0 pl-1 text-[10.5px] font-semibold text-ink-soft2"
              style={{ left: `${(i / WIN) * 100}%` }}
            >
              {pad(h)}:00
            </span>
          ))}
        </div>
      </div>

      {/* Sorok = asztalok; jobbra a vízszintes idővonal. A KÜLSŐ konténer flex-1 (a bentóval
          együtt nyúlik), a BELSŐ abszolút görgő sáv → a sok asztal-sor NEM húzza fel a magasságot
          (nem kell mindnek kiférnie), de a kártya egységesen mozog a többivel. */}
      <div className="relative mt-1 min-h-0 flex-1">
        <div className="no-scrollbar absolute inset-0 overflow-y-auto" data-lenis-prevent>
        {rows.length === 0 ? (
          <div className="flex h-full min-h-[160px] items-center justify-center text-[13px] text-ink-soft">
            Nincs közelgő foglalás.
          </div>
        ) : (
          rows.map((row) => {
            const vis = row.blocks.filter((b) => b.endMin > winStartMin && b.startMin < winStartMin + winMin)
            return (
              <div key={row.table} className="flex" style={{ minHeight: ROW_H }}>
                <div
                  className="flex shrink-0 items-center border-t border-dotted border-[#e4dfd0] pr-2 text-[12px] font-semibold text-ink"
                  style={{ width: TABLE_COL }}
                >
                  <span className="truncate">{row.table}</span>
                </div>
                <div className="relative flex-1 border-t border-dotted border-[#e4dfd0]" style={{ minHeight: ROW_H }}>
                  {/* Függőleges óra-vonalak (a sor teljes magasságában) */}
                  {gridHours.map((h, i) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute top-0 bottom-0 border-l border-dotted border-[#e4dfd0]"
                      style={{ left: `${(i / WIN) * 100}%` }}
                    />
                  ))}
                  {/* Foglalás-blokkok az asztal sorában (idő szerint pozicionálva) */}
                  {vis.map((b) => {
                    // Ha KORÁN befejezték (completed) és még nem járt le az idő, a blokk a MOST-ig zsugorodik,
                    // így a felszabaduló idő láthatóvá válik a sávban.
                    const effEnd = b.status === 'completed' && nowMin != null && nowMin > b.startMin
                      ? Math.max(b.startMin, Math.min(b.endMin, nowMin))
                      : b.endMin
                    const left = Math.max(0, ((b.startMin - winStartMin) / winMin) * 100)
                    const right = Math.min(100, ((effEnd - winStartMin) / winMin) * 100)
                    const width = Math.max(right - left, 8)
                    return (
                      <ReservationBlock key={b.id} b={b} left={left} width={width} tone={blockTone(b.status)} freedEarly={effEnd < b.endMin} />
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
        </div>
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
  b, left, width, tone, freedEarly,
}: {
  b: TimelineBlock
  left: number
  width: number
  tone: BlockTone
  freedEarly: boolean
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
  const compact = px === 0 || px < 168
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
          {freedEarly ? 'korán zárt · felszabadult' : `${b.pax} fő · ${fmt(b.startMin)}`}
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
