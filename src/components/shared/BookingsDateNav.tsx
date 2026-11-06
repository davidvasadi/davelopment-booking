'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react'
import { Button, IconButton, Segmented } from '@/components/ui-kit'
import { ymdLocal as ymd, capsWords } from '@/lib/utils'
import { DatePickerPopover, useMonthClosed } from './DatePickerPopover'
import { isClosedDay } from '@/lib/closedDays'
import { DayPicker, type PickDay } from '@/components/blocks/booking'

export type BookingsRange = 'day' | 'week' | 'month'

const HU_MONTHS = ['Jan.', 'Feb.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const HU_MONTHS_FULL = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December']
const HU_DAYS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
const RANGES: BookingsRange[] = ['day', 'week', 'month']

function toDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function mondayOf(s: string): Date {
  const d = toDate(s)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** A gomb felirata, minden szó nagy kezdőbetűvel (Dave kérése): nap — „Ma, Péntek, Nov. 7.” / „Kedd, Nov. 11.”;
 *  hét — „Nov. 3–9.”; hónap — „2026. November”. */
function labelOf(s: string, range: BookingsRange, today: string): string {
  const d = toDate(s)
  if (range === 'day') return capsWords(`${s === today ? 'ma, ' : ''}${HU_DAYS[d.getDay()]}, ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`)
  if (range === 'week') {
    const mon = mondayOf(s)
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6)
    return capsWords(mon.getMonth() === sun.getMonth()
      ? `${HU_MONTHS[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()}.`
      : `${HU_MONTHS[mon.getMonth()]} ${mon.getDate()}. – ${HU_MONTHS[sun.getMonth()]} ${sun.getDate()}.`)
  }
  return capsWords(`${d.getFullYear()}. ${HU_MONTHS_FULL[d.getMonth()]}`)
}

/**
 * A Foglalások fejlécének dátum-kezelője (a /design 6.1): ← dátum (naptár-popover, a napok terheltségével) →,
 * „Ma” csak ha máshol állsz, mellette Nap / Hét / Hónap (mobilon az a nézet-választó lapon van). Szalon és étterem közös.
 */
export function BookingsDateNav({ base, currentDate, range = 'day', loadEndpoint }: { base: string; currentDate: string; range?: BookingsRange; loadEndpoint: string }) {
  const router = useRouter()
  const go = (to: string, r: BookingsRange = range) => router.push(`${base}/bookings?date=${to}&range=${r}`)
  const step = (offset: number) => {
    const d = toDate(currentDate)
    if (range === 'day') d.setDate(d.getDate() + offset)
    else if (range === 'week') d.setDate(d.getDate() + offset * 7)
    else d.setMonth(d.getMonth() + offset)
    go(ymd(d))
  }
  const today = ymd(new Date())
  const unit = range === 'day' ? 'nap' : range === 'week' ? 'hét' : 'hónap'

  return (
    <>
      <IconButton icon={ArrowLeft} label={`Előző ${unit}`} onClick={() => step(-1)} />
      <DatePickerPopover value={currentDate} onChange={(d) => go(d, 'day')} loadEndpoint={loadEndpoint}>
        {labelOf(currentDate, range, today)}
      </DatePickerPopover>
      <IconButton icon={ArrowRight} label={`Következő ${unit}`} onClick={() => step(1)} />
      {currentDate !== today && <Button onClick={() => go(today)}>Ma</Button>}
      <Segmented options={['Nap', 'Hét', 'Hónap']} active={RANGES.indexOf(range)} onSelect={(i) => go(currentDate, RANGES[i])} className="ml-1.5 hidden lg:inline-flex" />
    </>
  )
}

const SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']

/** Mobil napcsík (a /design 6.11): a kiválasztott nap nagyban, a többi halványul a középtől távolodva. Ujjal oldalra
 *  görgethető (±30 nap, a napokra igazodva, mint egy óra-görgető); mindig a középen álló nap van kiemelve. Betölt: egy napra koppintva azonnal, vagy ha görgetés
 *  után a középső napon 2 másodpercig megáll. Fölötte „Ma” (vagy a nap neve) és a dátum. */
const STRIP_RANGE = 30
// a design (6.11) „justify-between” sora: a szélső napok a csík széléig érnek → egy nap szélessége (W - 36px) / 6,
// a 36px a két szélső (kis) nap fele-fele szélessége
const stripItem = (cw: number) => (cw - 36) / 6
// a design áttetszősége napról napra: 1 → 0,55 → 0,32 → 0,16 (köztes helyzetben a kettő közt)
const STRIP_OPACITY = [1, 0.55, 0.32, 0.16]
const stripOpacity = (dist: number) => { const i = Math.min(Math.floor(dist), 2), f = Math.min(dist - i, 1); return dist >= 3 ? 0.16 : STRIP_OPACITY[i] + (STRIP_OPACITY[i + 1] - STRIP_OPACITY[i]) * f }
export function DayStrip({ base, date, onPick }: { base?: string; date: string; /** saját napváltás (pl. Naptár) — nélküle a Foglalások napjára navigál */ onPick?: (d: string) => void }) {
  const router = useRouter()
  const today = ymd(new Date())
  const d0 = toDate(date)
  const box = useRef<HTMLDivElement>(null)
  // a görgetés helyzete (a halványítás a doboz közepétől mért távolság szerint)
  const [pos, setPos] = useState<{ sl: number; cw: number }>({ sl: 0, cw: 0 })
  // a kiválasztott nap középre — betöltéskor és napváltáskor, görgetés-animáció nélkül
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const w = stripItem(el.clientWidth)
    el.scrollLeft = STRIP_RANGE * w + w / 2 - el.clientWidth / 2
    setPos({ sl: el.scrollLeft, cw: el.clientWidth })
  }, [date])
  const pick = (d: Date) => { if (onPick) onPick(ymd(d)); else router.push(`${base}/bookings?date=${ymd(d)}&range=day`) }
  // görgetés után: ha a középső nap 2 mp-ig nem változik, azt választja (a saját középre-állítás nem számít, az a mai nap)
  const rest = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (rest.current) clearTimeout(rest.current) }, [date])
  const onScroll = (el: HTMLDivElement) => {
    setPos({ sl: el.scrollLeft, cw: el.clientWidth })
    if (rest.current) clearTimeout(rest.current)
    rest.current = setTimeout(() => {
      const iw = stripItem(el.clientWidth)
      const o = Math.round((el.scrollLeft + el.clientWidth / 2 - iw / 2) / iw) - STRIP_RANGE
      if (o) { const d = toDate(date); d.setDate(d.getDate() + o); pick(d) }
    }, 2000)
  }
  const w = pos.cw ? stripItem(pos.cw) : 0
  return (
    <>
      <span className="block text-ui-sub font-light text-ui-text">{date === today ? 'Ma' : HU_DAYS[d0.getDay()][0].toUpperCase() + HU_DAYS[d0.getDay()].slice(1)}</span>
      <span className="block text-ui-label text-ui-muted">{HU_DAYS[d0.getDay()]}, {HU_MONTHS[d0.getMonth()]} {d0.getDate()}.</span>
      <div ref={box} onScroll={(e) => onScroll(e.currentTarget)}
        className="mt-2 flex snap-x snap-mandatory items-end overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: STRIP_RANGE * 2 + 1 }, (_, i) => i - STRIP_RANGE).map((o) => {
          const d = toDate(date); d.setDate(d.getDate() + o)
          // a doboz közepétől mért távolság (napban) — ebből a halványítás, mint egy óra-görgetőn
          const dist = w ? Math.abs(((o + STRIP_RANGE) * w + w / 2 - (pos.sl + pos.cw / 2)) / w) : Math.abs(o)
          // folyamatos kiemelés: a középhez közeledve a nap fokozatosan nő és erősödik (34→26px szám, 13→11px nap-név)
          const t = Math.min(dist, 1)
          const opacity = stripOpacity(dist)
          return (
            <button key={o} type="button" onClick={() => { if (o) pick(d) }} aria-label={`${HU_DAYS[d.getDay()]}, ${HU_MONTHS[d.getMonth()]} ${d.getDate()}.`} aria-current={o === 0 ? 'date' : undefined}
              className="w-[calc((100%-36px)/6)] shrink-0 snap-center rounded-ui-control px-1 text-center text-ui-dark outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20" style={{ opacity }}>
              {/* mint az eredeti: az alj egy vonalon, a középső szám felfelé nő — a szám az aljáról kicsinyedik, a nap neve
                  annyival lejjebb csúszik, amennyivel a szám teteje (≈42px magas szám × a kicsinyítés) */}
              <span className="block origin-bottom text-ui-body will-change-transform" style={{ transform: `translateY(${t * 10}px) scale(${1 - t * 0.154})` }}>{SHORT[d.getDay()]}</span>
              <span className="block origin-bottom text-ui-num font-light leading-tight will-change-transform" style={{ transform: `scale(${1 - t * 0.235})` }}>{d.getDate()}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

/** Napválasztó az új foglaláshoz (a /design 6.9 „Időpont”): a kiválasztott nap körüli 6 nap egy sorban (a
 *  kiválasztott sötét), mellette a teljes naptár (terheltséggel) a távolabbi napokhoz. */
export function DayPickerStrip({ value, onPick, loadEndpoint }: { value: string; onPick: (d: string) => void; loadEndpoint?: string }) {
  // a zárt nap csíkos (design DayPicker offClass) — a sáv első és utolsó napjának hónapjából (hónapváltásnál kettő)
  const edge = (o: number) => { const d = toDate(value); d.setDate(d.getDate() + o); return ymd(d).slice(0, 7) }
  const c1 = useMonthClosed(loadEndpoint, edge(-3))
  const c2 = useMonthClosed(loadEndpoint, edge(2))
  const closed = c1 || c2 ? { closedDates: [...(c1?.closedDates ?? []), ...(c2?.closedDates ?? [])], closedWeekdays: c1?.closedWeekdays ?? c2?.closedWeekdays ?? [] } : null
  // a design DayPicker-je élő adattal: a kiválasztott a 4. helyen, csak a zárt nap csíkos (kézzel ez is választható),
  // a szélén a kit felugró naptára a távolabbi napokhoz
  const days: PickDay[] = [-3, -2, -1, 0, 1, 2].map((o) => {
    const d = toDate(value); d.setDate(d.getDate() + o)
    const key = ymd(d)
    // a heti zárt nap a sáv múltbeli napjain is csíkos (mint a designban)
    const isClosed = !!closed && isClosedDay(key, '', closed)
    return { key, d: SHORT[d.getDay()], n: d.getDate(), on: o === 0, off: isClosed, title: isClosed ? 'Zárva' : undefined }
  })
  return (
    <DayPicker days={days} onPick={onPick} calendar={
      <DatePickerPopover value={value} onChange={onPick} loadEndpoint={loadEndpoint} triggerClassName="flex h-full w-12 shrink-0 items-center justify-center rounded-ui-control bg-ui-cell text-ui-text outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ui-dark/20">
        <CalendarDays className="h-4 w-4" strokeWidth={1.8} /><span className="sr-only">Naptár</span>
      </DatePickerPopover>
    } />
  )
}
