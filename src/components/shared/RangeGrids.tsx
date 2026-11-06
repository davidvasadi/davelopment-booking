'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Avatar, Button, Card, IconButton, IconCircle, Pill, blockTone } from '@/components/ui-kit'
import { MiniBar } from '@/components/blocks/charts'
import { DayHead } from '@/components/blocks/calendar'
import { hhmmToMinutes } from '@/lib/utils'

/* A Foglalások hét / hónap nézete (a /design 6.4–6.6, 6.16–6.17) — szalon és étterem közös rácsai. */

const SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']
const HU_MONTHS_FULL = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const head = (day: string, today: string, closed: boolean) => {
  const d = toDate(day)
  return <DayHead key={day} d={SHORT[d.getDay()]} n={d.getDate()} today={day === today} closed={closed} />
}

/** Munkatárs-váltó a hét tetején (6.4 / 6.5): Mind + avatarok névvel; egy emberre váltva az ő óránkénti hete. */
export function StaffSwitch({ people, active, onPick }: { people: { id: string; name: string; img?: string | null }[]; active: string | null; onPick: (id: string | null) => void }) {
  const chip = (id: string | null, name: string, img?: string | null) => (
    <button key={id ?? 'all'} type="button" onClick={() => onPick(id)} aria-pressed={active === id}
      className={`inline-flex h-10 items-center gap-2 rounded-full text-ui-body outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 ${id ? 'py-1 pl-1 pr-3.5' : 'px-4'} ${active === id ? 'bg-ui-dark text-white' : 'bg-white/70 text-ui-text'}` /* ui-allow: a design 6.4 munkatárs-váltója (h-10, 32px avatar) */}>
      {id && <Avatar src={img ?? null} name={name} className="h-8 w-8" />}
      {name}
    </button>
  )
  return <div className="mb-4 flex flex-wrap items-center gap-1.5">{chip(null, 'Mind')}{people.map((p) => chip(p.id, p.name, p.img))}</div>
}

/** Egy foglalás kis chipként (6.5): idő + név az állapot színével; kattintásra megnyílik. */
export type WeekChip = { id: string; time: string; name: string; tone: string }

/**
 * Hét — sorok × napok (6.5 / 6.16): sor = munkatárs (szalon) vagy terem (étterem), oszlop = nap; a cella tartalmát a hívó
 * adja (`cell`: null = zárva / távol, csíkos). A mai oszlop világosabb. Sor végén a heti szám, alul opcionálisan a napi összeg.
 */
export function WeekGrid({ days, today, closed, rows, cell, totalLabel = 'Hét', footer, onDay, top, rooms = false }: {
  days: string[]
  today: string
  closed: (day: string) => boolean
  rows: { id: string; label: React.ReactNode; total: React.ReactNode }[]
  cell: (rowId: string, day: string) => React.ReactNode | null
  totalLabel?: string
  footer?: { label: string; values: (number | null)[]; total: number }
  onDay?: (day: string) => void
  /** a rács fölött (szalon: munkatárs-váltó) */
  top?: React.ReactNode
  /** étterem (6.16): termek, a cella két sorban (szám fent, telítettség lent), a zárt napon „zárva” */
  rooms?: boolean
}) {
  // a név-oszlop mobilon (sm alatt) keskeny (szalon: csak az avatar) — különben a nevek elfoglalták a képernyőt
  const scroller = useTodayScroll(days, today)
  const cols = rooms ? `var(--wk-name,150px) repeat(${days.length},minmax(0,1fr)) 70px` : `var(--wk-name,140px) repeat(${days.length},minmax(0,1fr)) 60px`
  return (
    // mobilon: a lap fehér (a ragadós név-oszlop alatt ne látszódjanak át a chipek), a rács vízszintesen görgethető, a
    // nevek / termek bal oldalt ragadósak, és betöltéskor a mai napra görget
    <Card className={`max-sm:bg-white ${rooms ? 'max-sm:[--wk-name:96px]' : 'max-sm:[--wk-name:44px]'}`}>
      {top}
      <div ref={scroller} className={SCROLLER}>
      <div className={`relative grid gap-1.5 ${rooms ? 'min-w-[900px] max-sm:min-w-[720px]' : 'min-w-[860px] max-sm:min-w-[700px]'}`} style={{ gridTemplateColumns: cols }}>
        <span data-first-col className={`${STICKY} ${STICKY_TOP} max-sm:z-30`} />
        {days.map((d) => (
          <button key={d} type="button" data-today={d === today || undefined} onClick={() => onDay?.(d)} className={`${STICKY_TOP} rounded-ui-control outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20`} aria-label="A nap megnyitása">{head(d, today, closed(d))}</button>
        ))}
        <span className={`self-end pb-1 text-right text-ui-label text-ui-muted ${STICKY_TOP}`}>{totalLabel}</span>
        {rows.map((r) => (
          <Fragment key={r.id}>
            <span className={`border-t border-dashed border-ui-divider py-2 ${STICKY} ${rooms ? '' : 'flex items-center gap-2'}`}>{r.label}</span>
            {days.map((d) => {
              const c = cell(r.id, d)
              // a mai napot a sötét nap-fej jelzi (design 6.5: desktopon a mai oszlop kicsit világosabb); mobilon a lap fehér, a cellák szürkék
              const bg = c === null ? 'ui-hatch-cell' : d === today ? 'bg-white/80 max-sm:bg-ui-cell/60' : 'bg-white/40 max-sm:bg-ui-cell/60'
              return (
                <div key={d} className={`relative rounded-ui-control border-t border-dashed border-ui-divider ${rooms ? 'flex min-h-[92px] flex-col justify-between p-2' : 'min-h-[96px] space-y-1 p-1.5'} ${bg}`}>
                  {c === null ? rooms && <span className="text-ui-label text-ui-muted">zárva</span> : c}
                </div>
              )
            })}
            <span className="flex items-center justify-end border-t border-dashed border-ui-divider text-ui-title font-light text-ui-text">{r.total}</span>
          </Fragment>
        ))}
        {footer && (
          <>
            <span className={`pt-2 text-ui-label text-ui-muted ${STICKY}`}>{footer.label}</span>
            {footer.values.map((v, i) => <span key={i} className="pt-2 text-center text-ui-title font-light text-ui-text">{v || '—'}</span>)}
            <span className="pt-2 text-right text-ui-title font-light text-ui-text">{footer.total}</span>
          </>
        )}
      </div>
      </div>
    </Card>
  )
}

/** Mobilon a heti rács saját görgető dobozban van (mindkét irányba): így a dátumsor fent, az első oszlop bal oldalt
 *  ragadós tud maradni. Betöltéskor (és hét-váltáskor) a mai napra görget. */
function useTodayScroll(days: string[], today: string) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ref.current, el = box?.querySelector<HTMLElement>('[data-today]')
    if (!box) return
    // nem az aktuális hét (nincs benne a mai nap): a hét elejétől
    if (!el) { box.scrollLeft = 0; return }
    if (box.scrollWidth <= box.clientWidth) return
    const first = (box.querySelector<HTMLElement>('[data-first-col]')?.offsetWidth ?? 0) + 6
    box.scrollLeft = Math.max(0, el.offsetLeft - first)
  }, [days.join(), today]) // eslint-disable-line react-hooks/exhaustive-deps -- a napok tartalma számít, nem a tömb
  return ref
}
const SCROLLER = 'overflow-x-auto max-sm:max-h-[70dvh] max-sm:overflow-y-auto'
/** a dátumsor mobilon fent ragad (a görgető dobozban) */
const STICKY_TOP = 'max-sm:sticky max-sm:top-0 max-sm:z-20 max-sm:bg-white'

/** A heti rács első oszlopa mobilon ragadós (a nevek görgetéskor is látszanak) — fehér alappal, a lap színével. */
const STICKY = 'max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:bg-white'

/** Étterem heti cellája (6.16): foglalás + fő, az alkalmak száma ikonnal, alul a telítettség sávja (95% fölött sárga). */
export function RoomWeekCell({ count, pax, pct, occasions, occIcon, onOpen }: { count: number; pax: number; pct: number | null; occasions: number; occIcon?: React.ReactNode; onOpen?: () => void }) {
  if (!count) return <span className="text-ui-label text-ui-muted">nincs foglalás</span>
  return (
    <button type="button" onClick={onOpen} className="flex h-full w-full flex-col justify-between gap-2 text-left outline-none">
      <span className="flex w-full items-start justify-between gap-1">
        <span><span className="block text-ui-body text-ui-text">{count} foglalás</span><span className="block text-ui-label text-ui-muted">{pax} fő</span></span>
        {occasions > 0 && <span className="flex items-center gap-1 text-ui-label text-ui-muted">{occIcon}{occasions}</span>}
      </span>
      {pct != null && <MiniBar pct={pct} hi={pct >= 95} className="w-full" />}
    </button>
  )
}

/** A heti cella chipjei: legfeljebb 3; ha több van, az első kettő és „+N további” (az a nap idővonalát nyitja). */
export function WeekChips({ chips, onOpen, onMore }: { chips: WeekChip[]; onOpen: (id: string) => void; onMore: () => void }) {
  const shown = chips.length > 3 ? chips.slice(0, 2) : chips
  return (
    <>
      {shown.map((c) => (
        <button key={c.id} type="button" onClick={() => onOpen(c.id)} className={`flex w-full items-center gap-1 overflow-hidden whitespace-nowrap rounded-ui-control px-1.5 py-1 text-left text-ui-label outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 ${c.tone}`}>
          <span className="opacity-60">{c.time}</span><span className="truncate">{c.name}</span>
        </button>
      ))}
      {chips.length > 3 && <button type="button" onClick={onMore} className="block w-full"><Pill tone="cell" size="sm" className="w-full justify-center">+{chips.length - 2} további</Pill></button>}
    </>
  )
}

/** Egy foglalás az óránkénti héten (6.4). `lane`/`lanes`: párhuzamos foglalások egymás mellett. */
export type HourItem = { id: string; day: string; start: string; end: string; title: string; status: string; tone: string; who?: { name: string; img?: string | null } }

/** Hét — egy munkatárs (6.4): oszlop = nap, függőlegesen az órák; a blokkok az állapot színével, kicsiben a név és az
 *  avatar. A mai oszlop kiemelve, „most” vonallal; a zárt nap csíkos; párhuzamos foglalások egymás mellett. */
export function WeekHours({ days, today, closed, items, openMin, closeMin, nowMin, onOpen, top: header }: {
  days: string[]; today: string; closed: (day: string) => boolean; items: HourItem[]; openMin: number; closeMin: number; nowMin: number | null; onOpen: (id: string) => void; top?: React.ReactNode
}) {
  const h0 = Math.floor(openMin / 60), h1 = Math.ceil(closeMin / 60)
  const top = (min: number) => ((min / 60 - h0) / Math.max(1, h1 - h0)) * 100
  // óránként 56px — így a félórás foglalás is olvasható (név + idő egy sorban)
  const HOUR_PX = 56
  const height = Math.max(1, h1 - h0) * HOUR_PX
  const scroller = useTodayScroll(days, today)
  return (
    // mobilon saját görgető doboz: a dátumsor fent, az órák oszlopa bal oldalt ragad; a mai napra görget
    <Card className="max-sm:bg-white">
      {header}
      <div ref={scroller} className={SCROLLER}>
      <div className="relative grid min-w-[760px] gap-1.5" style={{ gridTemplateColumns: `44px repeat(${days.length},minmax(0,1fr))` }}>
        <span data-first-col className={`${STICKY} ${STICKY_TOP} max-sm:z-30`} />
        {days.map((d) => <span key={d} data-today={d === today || undefined} className={STICKY_TOP}>{head(d, today, closed(d))}</span>)}
        <div className={`relative ${STICKY}`} style={{ height }}>{Array.from({ length: h1 - h0 + 1 }, (_, i) => <span key={i} className="absolute right-1 -translate-y-1/2 text-ui-label text-ui-muted" style={{ top: `${top((h0 + i) * 60)}%` }}>{h0 + i}:00</span>)}</div>
        {days.map((d) => {
          const list = items.filter((x) => x.day === d).sort((a, b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start))
          // sávok: egy foglalás a legelső olyan sávba kerül, ahol nem fed át az előzővel
          const laneEnd: number[] = []
          const lane = new Map<string, number>()
          for (const x of list) {
            const s = hhmmToMinutes(x.start)
            let l = laneEnd.findIndex((e) => e <= s)
            if (l === -1) { l = laneEnd.length; laneEnd.push(0) }
            laneEnd[l] = hhmmToMinutes(x.end)
            lane.set(x.id, l)
          }
          const lanes = Math.max(1, laneEnd.length)
          return (
            <div key={d} style={{ height }} className={`relative rounded-ui-inner ${closed(d) ? 'ui-hatch-cell' : d === today ? 'bg-white/80 max-sm:bg-ui-cell/60' : 'bg-white/40 max-sm:bg-ui-cell/60'}`}>
              {Array.from({ length: h1 - h0 + 1 }, (_, i) => <span key={i} className="absolute inset-x-0 border-t border-dotted border-ui-divider" style={{ top: `${top((h0 + i) * 60)}%` }} />)}
              {d === today && nowMin != null && nowMin >= h0 * 60 && nowMin <= h1 * 60 && (
                <span className="absolute inset-x-0 z-[2] border-t-2 border-ui-yellow" style={{ top: `${top(nowMin)}%` }}><span className="absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-ui-yellow" /></span>
              )}
              {list.map((x) => {
                const l = lane.get(x.id) ?? 0
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => onOpen(x.id)}
                    title={`${x.title} · ${x.start}–${x.end}`}
                    className={`absolute z-[1] flex flex-col justify-between overflow-hidden rounded-ui-control p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/30 ${x.tone}`}
                    style={{ top: `calc(${top(hhmmToMinutes(x.start))}% + 1px)`, height: `calc(${top(hhmmToMinutes(x.end)) - top(hhmmToMinutes(x.start))}% - 2px)`, left: lanes > 1 ? `calc(${(l / lanes) * 100}% + 3px)` : '3px', width: lanes > 1 ? `calc(${100 / lanes}% - 6px)` : 'calc(100% - 6px)' }}
                  >
                    <span className="truncate text-ui-label font-medium">{x.title}</span>
                    {x.who && <Avatar size="xs" src={x.who.img ?? null} name={x.who.name} className="h-4 w-4 ring-1 ring-white/60" />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      </div>
    </Card>
  )
}

/**
 * Hónap (6.6 / 6.17): szürke cellák, bal felül a dátum (a mai sötét körben), alul pill a számmal (foglalás vagy fő) és
 * jobbra a telítettség %. Teltház (95% felett) sárga, zárt nap csíkos, hónapon kívüli halvány. Sor végén a hét összege.
 * Napra kattintva a nap idővonala nyílik.
 */
/** mobil havi nézet: a kiválasztott nap részletei (a hívó adja) */
export type MonthDayInfo = { first?: string | null; last?: string | null; who?: { name: string; img?: string | null }[]; extra?: string | null }
export function MonthGrid({ month, today, counts, pct, unit, closed, onDay, onStep, dayInfo }: {
  /** mobilon a rács alatti nap-kártyához: első / utolsó időpont, ki dolgozik, egyéb sor */
  dayInfo?: (day: string) => MonthDayInfo
  /** bármelyik nap a hónapból (YYYY-MM-DD) */
  month: string
  today: string
  counts: Record<string, number>
  /** a nap telítettsége (0–100), ha ismert */
  pct?: (day: string) => number | null
  unit: string
  closed: (day: string) => boolean
  onDay: (day: string) => void
  /** a fejléc lapozója: előző (-1) / következő (+1) hónap */
  onStep?: (dir: -1 | 1) => void
}) {
  const m0 = toDate(month); m0.setDate(1)
  const start = new Date(m0); start.setDate(1 - ((m0.getDay() + 6) % 7))
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const weeks: Date[][] = []
  for (let cur = new Date(start); weeks.length < 6; ) {
    const row: Date[] = []
    for (let i = 0; i < 7; i++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    if (row.some((d) => d.getMonth() === m0.getMonth())) weeks.push(row)
    else if (weeks.length) break
  }
  const inMonth = weeks.flat().filter((d) => d.getMonth() === m0.getMonth())
  const total = inMonth.reduce((sum, d) => sum + (counts[ymd(d)] ?? 0), 0)
  const pcts = pct ? inMonth.filter((d) => !closed(ymd(d))).map((d) => pct(ymd(d))).filter((v): v is number => v != null) : []
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null
  // a hét napja zárt, ha a hónapban minden ilyen napon zárva (a fejlécben piros)
  // mobil: koppintás = kiválasztás (a rács alatt a nap kártyája, „Megnyitás” gombbal); desktopon azonnal a nap nyílik
  const monthKey = ymd(m0).slice(0, 7)
  const [sel, setSel] = useState<string>(today.startsWith(monthKey) ? today : `${monthKey}-01`)
  useEffect(() => { setSel(today.startsWith(monthKey) ? today : `${monthKey}-01`) }, [monthKey, today])
  const tap = (key: string) => { if (window.matchMedia('(max-width: 639px)').matches) setSel(key); else onDay(key) }
  const closedCol = [0, 1, 2, 3, 4, 5, 6].map((i) => { const ds = weeks.map((w) => w[i]).filter((d) => d.getMonth() === m0.getMonth()); return ds.length > 0 && ds.every((d) => closed(ymd(d))) })
  return (
    <>
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {onStep && <IconButton icon={ArrowLeft} label="Előző" onClick={() => onStep(-1)} />}
          <span className="text-ui-sub font-light text-ui-text">{m0.getFullYear()}. {HU_MONTHS_FULL[m0.getMonth()]}</span>
          {onStep && <IconButton icon={ArrowRight} label="Következő" onClick={() => onStep(1)} />}
        </span>
        <span className="flex items-baseline gap-4">
          {avg != null && <span className="text-ui-body text-ui-muted">átl. {avg}% telt</span>}
          <span className="text-ui-sub font-light text-ui-text">{total.toLocaleString('hu-HU')} <span className="text-ui-body text-ui-muted">{unit}</span></span>
        </span>
      </div>
      {/* mobilon (sm alatt) csak a 7 nap: a heti összeg oszlopa, a „zárva” felirat és a pill nem fér el */}
      <div className="grid grid-cols-7 gap-1 text-center text-ui-meta sm:grid-cols-[repeat(7,minmax(0,1fr))_64px] sm:gap-1.5">
        {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((d, i) => <span key={d} className={closedCol[i] ? 'text-ui-bad-dot' : 'text-ui-muted'}>{d}</span>)}
        <span className="text-ui-muted max-sm:hidden">Hét</span>
      </div>
      <div className="mt-2 space-y-1 sm:space-y-1.5">
        {weeks.map((row, wi) => {
          const total = row.reduce((sum, d) => sum + (d.getMonth() === m0.getMonth() ? counts[ymd(d)] ?? 0 : 0), 0)
          return (
            <div key={wi} className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(7,minmax(0,1fr))_64px] sm:gap-1.5">
              {row.map((d) => {
                const key = ymd(d), out = d.getMonth() !== m0.getMonth(), isClosed = closed(key)
                const n = out ? 0 : counts[key] ?? 0
                const p = out || isClosed ? null : pct?.(key) ?? null
                const full = p != null && p >= 95
                return (
                  <button key={key} type="button" onClick={() => tap(key)} className={`relative flex h-16 flex-col justify-between overflow-hidden rounded-ui-inner p-1.5 text-left ${key === sel && !out && !isClosed && !full ? 'max-sm:!bg-white' : ''} sm:h-[82px] sm:p-2.5 outline-none transition-[filter] hover:brightness-[.97] focus-visible:ring-2 focus-visible:ring-ui-dark/20 ${out || isClosed ? 'ui-hatch-cell' : full ? 'bg-ui-yellow' : 'bg-ui-cell'} ${out ? 'opacity-55' : ''}`}>
                    <span className="flex items-center justify-between">
                      {key === today ? <IconCircle size="sm">{d.getDate()}</IconCircle> : <span className={`text-ui-body ${out ? 'text-ui-muted' : 'text-ui-text'}`}>{d.getDate()}</span>}
                      {isClosed && !out && <span className="text-ui-label text-ui-muted max-sm:hidden">zárva</span>}
                    </span>
                    {/* mobilon a desktop pillje, csak a szám (a „db” és a % nem fér el) */}
                    {/* mobil: a foglalások száma kis sárga számlálóban (teltháznál — sárga cellán — sötétben), mint a Naptár létszáma */}
                    {n > 0 && <span className={`absolute bottom-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-ui-label leading-none sm:hidden ${full ? 'bg-ui-dark text-white' : 'bg-ui-yellow text-ui-dark'}`}>{n}</span>}
                    {n > 0 && (
                      <span className="flex items-center justify-between gap-1 max-sm:hidden">
                        <Pill tone={full ? 'dark' : 'white'} size="sm">{n} {unit}</Pill>
                        {p != null && <span className="text-ui-label text-ui-muted">{p}%</span>}
                      </span>
                    )}
                  </button>
                )
              })}
              <div className="flex flex-col items-center justify-center rounded-ui-inner bg-white/70 max-sm:hidden">
                <span className="text-ui-title font-light leading-none text-ui-text">{total || '—'}</span>
                <span className="mt-1 text-ui-label text-ui-muted">{unit}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-ui-divider pt-3 text-ui-label text-ui-muted">
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-6 rounded-ui-control bg-ui-cell" />Nyitott nap</span>
        {pct && <span className="flex items-center gap-1.5"><span className="h-3.5 w-6 rounded-ui-control bg-ui-yellow" />Teltház (95% felett)</span>}
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-6 rounded-ui-control ui-hatch-cell" />Zárva</span>
        <span className="flex items-center gap-1.5"><IconCircle size="xs">{toDate(today).getDate()}</IconCircle>Ma</span>
      </div>
    </Card>
    {/* mobil: a rács alatt a kiválasztott nap, és a hónap legforgalmasabb napjai */}
    {(() => {
      const sd = toDate(sel), sn = counts[sel] ?? 0, sp = closed(sel) ? null : pct?.(sel) ?? null, info = dayInfo?.(sel)
      const top = inMonth.map((d) => ymd(d)).filter((k) => (counts[k] ?? 0) > 0).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)).slice(0, 3)
      return (
        <div className="mt-[5px] space-y-[5px] sm:hidden">
          <Card>
            <div className="text-ui-title font-light text-ui-text">{sel === today ? 'Ma, ' : ''}{HU_DAY_NAME[sd.getDay()]}, {HU_MONTH_SHORT[sd.getMonth()]} {sd.getDate()}.</div>
            {closed(sel) ? <div className="mt-1 text-ui-meta text-ui-muted">Zárva</div> : (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <span><span className="block text-ui-sub font-light leading-none text-ui-text">{sn}</span><span className="mt-1 block text-ui-label text-ui-muted">{unit}</span></span>
                  <span><span className="block text-ui-sub font-light leading-none text-ui-text">{sp != null ? `${sp}%` : '—'}</span><span className="mt-1 block text-ui-label text-ui-muted">telítettség</span></span>
                  <span><span className="block text-ui-sub font-light leading-none text-ui-text">{info?.first ? `${info.first}` : '—'}</span><span className="mt-1 block text-ui-label text-ui-muted">{info?.last ? `első · utolsó ${info.last}` : 'első'}</span></span>
                </div>
                {info?.extra && <div className="mt-3 text-ui-meta text-ui-muted">{info.extra}</div>}
                {info?.who && info.who.length > 0 && (
                  <div className="mt-3 flex items-center gap-2"><span className="flex -space-x-2">{info.who.slice(0, 6).map((w) => <Avatar key={w.name} size="sm" src={w.img ?? null} name={w.name} className="ring-2 ring-white" />)}</span><span className="text-ui-meta text-ui-muted">{info.who.length} dolgozik</span></div>
                )}
              </>
            )}
            <Button className="mt-4 w-full" onClick={() => onDay(sel)}>Megnyitás</Button>
          </Card>
          {/* a hónap 3 legforgalmasabb napja: három álló oszlop (a meglévő oszlopdiagram), alatta a napok adatai */}
          {top.length > 0 && (
            <Card>
              <div className="text-ui-title font-light text-ui-text">Legforgalmasabb napok</div>
              {/* széles, lekerekített oszlopok (mint a „Foglaltság a héten” kártyán): a legforgalmasabb sárga, felettük a szám */}
              <div className="mt-4 flex h-[200px] items-end justify-center gap-4">
                {top.map((k, i) => { const d = toDate(k), v = counts[k] ?? 0, mx = counts[top[0]] ?? 1; return (
                  <div key={k} className="flex w-full max-w-[64px] flex-col items-center justify-end">
                    <span className="mb-1 text-ui-meta text-ui-text">{v}</span>
                    <div className={`ui-grow-y w-full rounded-ui-inner ${i === 0 ? 'bg-ui-yellow' : 'bg-ui-dark'}`} style={{ height: Math.max(16, (v / mx) * 150), ['--i' as string]: i }} />
                    <span className="mt-1.5 text-ui-label text-ui-muted">{HU_MONTH_SHORT[d.getMonth()]} {d.getDate()}.</span>
                  </div>
                ) })}
              </div>
              <div className="mt-4 space-y-1 border-t border-dashed border-ui-divider pt-2">
                {top.map((k) => { const d = toDate(k), pp = pct?.(k) ?? null; return (
                  <button key={k} type="button" onClick={() => setSel(k)} className="flex w-full items-center justify-between rounded-ui-control px-2 py-2 text-left outline-none transition-colors hover:bg-ui-cell">
                    <span className="text-ui-body text-ui-text">{HU_DAY_NAME[d.getDay()]}, {HU_MONTH_SHORT[d.getMonth()]} {d.getDate()}.</span>
                    <span className="text-ui-meta text-ui-muted">{counts[k]} {unit}{pp != null ? ` · ${pp}%` : ''}</span>
                  </button>
                ) })}
              </div>
            </Card>
          )}
        </div>
      )
    })()}
    </>
  )
}
const HU_DAY_NAME = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
const HU_MONTH_SHORT = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']

/** A foglalás-chip színe a kit szerint (megerősített sötét, függő sárga, befejezett szürke, lemondott piros). */
export const chipTone = (status: string) => (status === 'pending' ? blockTone('pending') : status === 'completed' ? blockTone('done') : status === 'cancelled' || status === 'no_show' ? 'bg-ui-bad-bg text-ui-bad' : blockTone('ok'))
