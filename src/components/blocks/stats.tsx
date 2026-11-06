'use client'

import { Fragment, useState } from 'react'
import { ArrowUpRight, Briefcase, CalendarDays, Clock, Coins, Megaphone, Wallet, X } from 'lucide-react'
import { Avatar, Button, Card, CardTitle, IconButton, IconCircle, Kpi, ListRow, Meta, Note, Panel, Pill, SegmentBar, Segmented, SheetHandle, StatusPill } from '@/components/ui-kit'
import { DarkLineChart, Legend, Ring, ShareRow, smooth, WeekBars, type WeekBar } from './charts'
import type { StatsVM, Strip } from '@/lib/statsTypes'

/* Statisztikák (design 5.1–5.4): a kártyák és a részletes lapok. Az élő oldal (StatsView) és a /design, a landing
   ugyanezeket rendereli — props nélkül mintaadattal, élőben a valós adattal (`StatsVM` szeletei). */

const AV = '/landing/funkciok/csapat/avatar'
const nf = (n: number) => n.toLocaleString('hu-HU')
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} e` : String(Math.round(n)))
const comma = (n: number) => String(n).replace('.', ',')
const signed = (n: number, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${comma(Math.abs(n))}${unit}`

/** A design mintaadata (Fodrászat Budapest, 30 nap). */
export const SAMPLE_STATS: StatsVM = {
  restaurant: false, from: '2026-10-02', to: '2026-11-01', prevFrom: '2026-09-02', prevTo: '2026-10-01', days: 30, label: 'Október 2. – November 1.',
  status: { done: 78, pending: 9, cancelled: 10, noShow: 3 }, kpis: { bookings: 412, revenue: 4_100_000, returningPct: 64, guests: 0, saturation: 74 }, empty: false,
  week: {
    perWeek: 96, delta: 8, days: [{ d: 'H', v: 12 }, { d: 'K', v: 14 }, { d: 'Sze', v: 11 }, { d: 'Cs', v: 17 }, { d: 'P', v: 24, peak: true }, { d: 'Szo', v: 18 }, { d: 'V', v: 0, closed: true }],
    byDay: ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'].map((d, i) => ({ d, total: [12, 14, 11, 17, 24, 18, 0][i], rows: i === 4 ? [{ time: '09:30', name: 'Gál Zsófia', what: 'Női hajvágás', date: '2026-10-31' }, { time: '11:00', name: 'Kiss Réka', what: 'Géllakk', date: '2026-10-31' }, { time: '13:30', name: 'Juhász Hanna', what: 'Balayage', date: '2026-10-31' }] : [] })),
  },
  util: {
    pct: 74, booked: 296, open: 400, delta: 6,
    strip: { cols: [['H', '58%'], ['K', '61%'], ['Sze', '64%'], ['Cs', '86%'], ['P', '96%'], ['Szo', '91%'], ['V', '—']], blocks: [{ span: 3, tone: 'hatch', text: 'van szabad hely' }, { span: 3, tone: 'yellow', text: 'szinte mindig tele' }, { span: 1, tone: 'off', text: 'zárva' }] },
    parts: [{ name: 'Délelőtt (9–12)', value: '52%', pct: 52 }, { name: 'Délután (12–16)', value: '76%', pct: 76 }, { name: 'Késő délután (16–19)', value: '94%', pct: 94, lead: 'hi' }],
    staff: [{ name: 'Viktória', value: '88%', pct: 88, img: `${AV}/viktoria.webp` }, { name: 'Csaba', value: '71%', pct: 71, img: `${AV}/csaba.webp` }, { name: 'Dávid', value: '63%', pct: 63, img: `${AV}/dave.webp` }],
  },
  hours: {
    hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19], peak: 'Péntek 17–19', closedPct: 47,
    grid: Array.from({ length: 7 }, (_, di) => Array.from({ length: 11 }, (_, hi) => (di === 6 ? 0 : Math.min(1, ((di * 7 + hi * 3) % 10) / 10 + (di === 4 && hi > 7 ? 0.4 : 0) + (hi > 7 ? 0.15 : 0))))),
    created: [{ name: 'Reggel (6–10)', value: '14%', pct: 14 }, { name: 'Napközben (10–18)', value: '39%', pct: 39 }, { name: 'Este (18–23)', value: '41%', pct: 41, lead: 'hi' }, { name: 'Éjjel (23–6)', value: '6%', pct: 6 }],
  },
  source: { online: 68, phone: 22, walkIn: 10, delta: 9, leadDays: 4.2, avgValue: 9950, cancelPct: 10, tableTime: null },
  revenue: {
    total: 4_100_000, delta: 12, now: [40, 52, 48, 61, 58, 70, 66, 74, 69, 82, 78, 86].map((v) => v * 2000), prev: [44, 46, 50, 52, 55, 54, 58, 60, 59, 63, 62, 66].map((v) => v * 2000),
    ticks: ['Okt. 1.', 'Okt. 8.', 'Okt. 15.', 'Okt. 22.', 'Okt. 30.'], points: Array.from({ length: 12 }, (_, i) => `Okt. ${2 + i * 2.5 | 0}.`),
    parts: [{ name: 'Szolgáltatás', value: '3,5 M Ft', pct: 85, lead: 'hi' }, { name: 'Utalvány-eladás', value: '0,4 M Ft', pct: 10 }, { name: 'Termék', value: '0,2 M Ft', pct: 5 }],
  },
  top: {
    delta: 11,
    byCount: [['Női hajvágás', 86], ['Férfi hajvágás', 64], ['Festés', 47], ['Balayage', 31], ['Géllakk', 28], ['Szakálligazítás', 19]].map(([name, n]) => ({ name: name as string, value: String(n), pct: Math.round(((n as number) / 86) * 100) })),
    byRevenue: [['Balayage', 1_480_000], ['Festés', 940_000], ['Női hajvágás', 1_020_000]].map(([name, n]) => ({ name: name as string, value: `${short(n as number)} Ft`, pct: Math.round(((n as number) / 1_480_000) * 100) })),
    pairs: [{ title: 'Női hajvágás + Festés', count: 23 }, { title: 'Férfi hajvágás + Szakálligazítás', count: 15 }],
  },
  noShow: {
    pct: 3.2, count: 13, deltaPt: -1.1,
    trend: { now: [2, 1, 0, 2, 1, 3, 1, 0, 1, 2, 0, 0], prev: [3, 2, 2, 1, 3, 2, 2, 1, 2, 1, 1, 2], ticks: ['Okt. 1.', 'Okt. 8.', 'Okt. 15.', 'Okt. 22.', 'Okt. 30.'], points: Array.from({ length: 12 }, (_, i) => `Okt. ${2 + i * 2.5 | 0}.`) },
    byDay: [{ d: 'H', v: 1 }, { d: 'K', v: 2 }, { d: 'Sze', v: 1 }, { d: 'Cs', v: 2 }, { d: 'P', v: 5, peak: true }, { d: 'Szo', v: 2 }, { d: 'V', v: 0, closed: true }],
    bySource: [{ name: 'Online', value: '4,1% · 11 / 270', pct: 20 }, { name: 'Telefon', value: '2,2% · 2 / 91', pct: 11 }, { name: 'Beeső', value: '—', pct: 0 }],
    repeat: [{ name: 'Tóth Bence', meta: 'utoljára Okt. 24. · Férfi vágás', count: 3 }, { name: 'Szabó Lili', meta: 'utoljára Okt. 11. · Géllakk', count: 2 }, { name: 'Kovács Máté', meta: 'utoljára Szept. 30. · Szakálligazítás', count: 2 }] },
  guests: {
    total: 345, fresh: 21, domestic: 82, foreign: 18,
    trend: { now: [1, 3, 2, 0, 2, 1, 4, 2, 1, 3, 1, 1], prev: [2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1], ticks: ['Okt. 1.', 'Okt. 8.', 'Okt. 15.', 'Okt. 22.', 'Okt. 30.'], points: Array.from({ length: 12 }, (_, i) => `Okt. ${2 + i * 2.5 | 0}.`) },
    countries: [['🇭🇺', 'Magyarország', 283, 82], ['🇦🇹', 'Ausztria', 21, 6], ['🇬🇧', 'Egyesült Királyság', 17, 5], ['🇩🇪', 'Németország', 11, 3], ['🌍', 'Egyéb (9 ország)', 13, 4]].map(([lead, name, v, p]) => ({ lead: lead as string, name: name as string, value: String(v), pct: p as number })),
    cities: [['🇭🇺', 'Budapest', 198, 57], ['🇭🇺', 'Debrecen', 14, 4], ['🇦🇹', 'Bécs', 13, 4], ['🇬🇧', 'London', 9, 3], ['', 'Egyéb (41 város)', 111, 32]].map(([lead, name, v, p]) => ({ lead: (lead as string) || null, name: name as string, value: String(v), pct: p as number })),
  },
  reviews: { avg: 4.9, count: 128, google: true, dist: [86, 10, 3, 1, 0], fresh: 12, delta: 0.1, url: null },
  paxTrend: null,
  rest: null,
}
/** Az étterem mintaadata (5.4). */
export const SAMPLE_REST: StatsVM = {
  ...SAMPLE_STATS, restaurant: true, status: { done: 84, pending: 6, cancelled: 7, noShow: 3 }, kpis: { bookings: 612, revenue: 0, returningPct: null, guests: 1840, saturation: 72 },
  source: { online: 58, phone: 17, walkIn: 25, delta: 4, leadDays: 3.1, avgValue: null, cancelPct: 7, tableTime: 108 }, revenue: null, top: null,
  paxTrend: { total: 1840, delta: 9, now: [52, 61, 48, 70, 66, 84, 79, 90, 72, 95, 88, 101], prev: [50, 55, 52, 60, 58, 70, 66, 74, 69, 80, 78, 84], ticks: ['Okt. 1.', 'Okt. 8.', 'Okt. 15.', 'Okt. 22.', 'Okt. 30.'], points: Array.from({ length: 12 }, (_, i) => `Okt. ${2 + i * 2.5 | 0}.`), parts: [{ name: 'Online', value: '1 067 fő', pct: 58, lead: 'hi' }, { name: 'Telefon', value: '313 fő', pct: 17 }, { name: 'Beeső', value: '460 fő', pct: 25 }] },
  rest: {
    turns: 1.9, setTime: 120, tableTime: 108, idle: 12, avgParty: 3, partyDelta: 0.2,
    tables: [['T1', 18], ['T2', 16], ['T3', 21], ['T4', 15], ['T5', 24], ['T6', 19], ['T7', 13], ['T8', 9]].map(([d, v]) => ({ d: d as string, v: v as number, peak: v === 24 })),
    rooms: [{ name: 'Belső terem', value: '81%', pct: 81, lead: 'hi' }, { name: 'Terasz', value: '44%', pct: 44 }, { name: 'Különterem', value: '62%', pct: 62 }],
    party: { cols: [['2 fő', '46%'], ['3–4 fő', '34%'], ['5–6 fő', '14%'], ['7+ fő', '6%']], blocks: [{ span: 1, tone: 'yellow', text: '' }, { span: 1, tone: 'dark', text: '' }, { span: 1, tone: 'hatch', text: '' }, { span: 1, tone: 'hatch', text: '' }], weights: [46, 34, 14, 6] },
    partyRows: [{ title: '2 fő', meta: '46% a társaságokból · 4 db ilyen asztal', value: '94% foglalt', tone: 'yellow' }, { title: '3–4 fő', meta: '34% · 6 db ilyen asztal', value: '78% foglalt', tone: 'dark' }, { title: '5–6 fő', meta: '14% · 3 db ilyen asztal', value: '41% foglalt', tone: 'hatch' }, { title: '7+ fő', meta: '6% · különterem', value: '22% foglalt', tone: 'hatch' }],
  },
}

/* ── a kártya kerete: kattintható (↗ vagy maga a kártya), hoverre megemelkedik, a nyíl sárga lesz ── */

function StatCard({ title, sub, extra, onOpen, hover = false, dark = false, arrowLabel = 'Megnyitás', arrowHref, className = '', children }: { title: React.ReactNode; sub?: React.ReactNode; /** a fejlécben a nyíl előtt (pl. jelmagyarázat) */ extra?: React.ReactNode; onOpen?: () => void; hover?: boolean; dark?: boolean; arrowLabel?: string; arrowHref?: string | null; className?: string; children: React.ReactNode }) {
  const click = !!onOpen
  return (
    <Card tone={dark ? 'dark' : undefined}
      className={`group relative flex flex-col transition-transform duration-300 ${click ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${hover ? '-translate-y-1 shadow-ui-popup ring-2 ring-ui-yellow/60' : ''} ${className}`}>
      {hover && <Pill tone="dark" size="sm" className="absolute -top-3 left-5">hover</Pill>}
      {/* az egész kártya kattintható; a nyíl a billentyűzetes elérés */}
      {click && <button type="button" onClick={onOpen} aria-label={typeof title === 'string' ? `${title} — részletek` : arrowLabel} className="absolute inset-0 z-0 rounded-ui-card outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/25" />}
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
        {sub ? <span><span className={`block text-ui-title ${dark ? '' : 'text-ui-text'}`}>{title}</span><span className={`mt-0.5 block text-ui-label ${dark ? 'text-white/50' : 'text-ui-muted'}`}>{sub}</span></span> : <span className={`text-ui-title ${dark ? '' : 'text-ui-text'}`}>{title}</span>}
        <span className="flex items-center gap-3">{extra}
        {arrowHref !== undefined
          ? <span className="pointer-events-auto">{arrowHref ? <IconButton icon={ArrowUpRight} label={arrowLabel} href={arrowHref} /> : <IconButton icon={ArrowUpRight} label={arrowLabel} disabled />}</span>
          : <IconButton icon={ArrowUpRight} label={arrowLabel} tabIndex={-1} variant={hover ? 'yellow' : dark ? 'onDark' : undefined} className={click ? 'group-hover:bg-ui-yellow group-hover:text-ui-dark' : ''} />}
        </span>
      </div>
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col [&_button]:pointer-events-auto">{children}</div>
    </Card>
  )
}

/* ── 5.1 kártyák ── */

/** Heti eloszlás: az időszak foglalásai a hét napjai szerint, nagyban az átlagos heti szám. */
export function StatWeekCard({ week = SAMPLE_STATS.week, onOpen, hover = false, className = '' }: { week?: StatsVM['week']; onOpen?: () => void; hover?: boolean; className?: string }) {
  return (
    <StatCard title="Heti eloszlás" onOpen={onOpen} hover={hover} className={className}>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-ui-num font-light text-ui-text">{nf(week.perWeek)}</span><span className="text-ui-label text-ui-muted">foglalás<br />átlag / hét</span></div>
      <WeekBars className="mt-3 h-[110px]" days={week.days} />
    </StatCard>
  )
}

/** Kihasználtság (étteremnél Telítettség): a nyitvatartásból / beosztásból foglalt idő. */
export function StatUtilCard({ util = SAMPLE_STATS.util, restaurant = false, onOpen, className = '' }: { util?: StatsVM['util']; restaurant?: boolean; onOpen?: () => void; className?: string }) {
  return (
    <StatCard title={restaurant ? 'Telítettség' : 'Kihasználtság'} sub={restaurant ? 'foglalt ülőhely-óra' : 'a nyitvatartásból foglalt'} onOpen={onOpen} className={className}>
      <Ring pct={util.pct ?? 0} className="mx-auto mt-2"><span className="text-ui-num font-light leading-none text-ui-text">{util.pct == null ? '—' : `${util.pct}%`}</span></Ring>
      <div className="mt-auto flex items-center justify-between border-t border-dashed border-ui-divider pt-3 text-ui-meta">
        <span className="text-ui-muted">{util.pct == null ? 'nincs nyitvatartás / beosztás' : `${nf(util.booked)} ó / ${nf(util.open)} ó ${restaurant ? 'ülőhely-óra' : 'nyitva'}`}</span>
        {util.delta != null && <StatusPill status={util.delta >= 0 ? 'ok' : 'bad'}>{signed(util.delta, ' pt')}</StatusPill>}
      </div>
    </StatCard>
  )
}

/** Mikor foglalnak: nap × óra pont-mátrix (sárga = csúcs). */
export function StatHoursCard({ hours = SAMPLE_STATS.hours, onOpen, className = '' }: { hours?: StatsVM['hours']; onOpen?: () => void; className?: string }) {
  const days = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
  const rows = hours.grid.map((r, i) => [days[i], r] as const).filter(([d, r]) => d !== 'V' || r.some((v) => v > 0))
  return (
    <StatCard dark title="Mikor foglalnak" sub={hours.peak ? `csúcs: ${hours.peak}` : 'még nincs elég adat'} onOpen={onOpen} className={className}>
      <div className="mt-4 grid items-center gap-1.5 text-ui-label text-white/45" style={{ gridTemplateColumns: `30px repeat(${hours.hours.length}, minmax(0, 1fr))` }}>
        <span />
        {hours.hours.map((h) => <span key={h} className="text-center">{h}</span>)}
        {rows.map(([d, r]) => (
          <Fragment key={d}>
            <span>{d}</span>
            {r.map((v, hi) => <span key={hi} className={`mx-auto aspect-square w-full max-w-[18px] rounded-full ${v > 0.85 ? 'bg-ui-yellow' : v > 0.5 ? 'bg-white/35' : 'bg-white/10'}`} />)}
          </Fragment>
        ))}
      </div>
    </StatCard>
  )
}

/** A Vendégforrás oszlopai (online / telefon / beeső) — a kártya és a részletes lap is ezt rajzolja. */
function SourceBars({ source, fixed = false }: { source: StatsVM['source']; /** a részletes lapon: mindig fix magas (ott nincs, ami kinyújtsa) */ fixed?: boolean }) {
  return (
          <div className={`mt-4 flex h-[220px] gap-2 ${fixed ? '' : 'lg:h-auto lg:min-h-[220px] lg:flex-1'}`}>
            {[{ l: 'Online', v: source.online, cls: 'bg-ui-dark text-white' }, { l: 'Telefon', v: source.phone, cls: 'bg-ui-yellow text-ui-dark' }, { l: 'Beeső', v: source.walkIn, cls: 'ui-hatch text-ui-text' }].map((g) => {
              // százalékos magasság helyett arány: az üres rész és a sáv osztozik a magasságon (minden böngészőben, mobilon is)
              const h = Math.max(18, g.v)
              return (
                <div key={g.l} className="flex flex-1 flex-col">
                  <div style={{ flexGrow: 100 - h }} />
                  <div className={`flex min-h-[44px] flex-col items-center justify-start rounded-ui-inner pt-3 text-ui-body ${g.cls}`} style={{ flexGrow: h, flexBasis: 0 }}>{g.v}%</div>
                  <div className="mt-2 text-center text-ui-meta text-ui-muted">{g.l}</div>
                </div>
              )
            })}
          </div>
  )
}

/** Vendégforrás: online / telefon / beeső oszlopokban; alatta az előrefoglalás, átlagérték (étteremnél asztal-idő), lemondás. */
export function StatSourceCard({ source: src, restaurant = false, onOpen, className = '' }: { source?: StatsVM['source']; restaurant?: boolean; onOpen?: () => void; className?: string }) {
  const source = src ?? (restaurant ? SAMPLE_REST : SAMPLE_STATS).source
  const facts: [string, string][] = [
    [source.leadDays == null ? '—' : `${comma(source.leadDays)} nap`, 'átl. előrefoglalás'],
    restaurant ? [source.tableTime == null ? '—' : `${Math.floor(source.tableTime / 60)} ó ${source.tableTime % 60} p`, 'átl. asztal-idő'] : [source.avgValue == null ? '—' : `${nf(source.avgValue)} Ft`, 'átl. érték'],
    [`${source.cancelPct}%`, 'lemondás'],
  ]
  return (
    <StatCard title="Vendégforrás" onOpen={onOpen} className={className}>
      {(
          <SourceBars source={source} />
        )}
      <div className="mt-4 space-y-[5px]">
        {facts.map(([v, l]) => <ListRow key={l} filled title={<span className="text-ui-label text-ui-muted">{l}</span>} trailing={<span className="text-ui-title font-light text-ui-text">{v}</span>} />)}
      </div>
    </StatCard>
  )
}

/** Bevétel alakulása: most (sárga) és az előző időszak (szaggatott); a pontra mutatva az adott nap / hét összege. */
/** A Bevétel (étteremnél Vendégszám) világos vonal-grafikonja — a kártya és a részletes lap is ezt rajzolja. */
function RevenueChart({ revenue, unit = 'Ft', className = '' }: { revenue: NonNullable<StatsVM['revenue']>; unit?: string; className?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const now = revenue.now.length > 1 ? revenue.now : [revenue.now[0] ?? 0, revenue.now[0] ?? 0]
  const prev = revenue.prev.slice(0, now.length)
  // a tengely teteje kerek érték (pl. 200 e), a fele a középső felirat
  const raw = Math.max(1, ...now, ...prev)
  const step = 10 ** Math.floor(Math.log10(raw))
  const top = Math.max(4, Math.ceil((raw * 1.05) / (step / 2)) * (step / 2))
  const sel = hover ?? now.reduce((b, v, i) => (v >= now[b] ? i : b), 0)
  const x = (i: number) => (i / (now.length - 1)) * 100
  const yy = (v: number) => 100 - (v / top) * 100
  const pick = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (now.length - 1))) }
  // a buborék a szélén befelé fordul, hogy ne lógjon ki a kártyából
  const tx = sel <= now.length * 0.15 ? '-15%' : sel >= now.length * 0.85 ? '-85%' : '-50%'
  return (
    <div className={`flex flex-1 flex-col ${className}`}>
      <div className="mt-4 flex min-h-[200px] flex-1 gap-2">
        <div className="relative mb-6 w-9 shrink-0">{[[top, short(top)], [top / 2, short(top / 2)], [0, '0']].map(([v, l]) => <span key={l as string} className="absolute right-0 -translate-y-1/2 text-ui-label text-ui-muted" style={{ top: `${yy(v as number)}%` }}>{l as string}</span>)}</div>
        <div className="flex flex-1 flex-col">
          <div className="pointer-events-auto relative flex-1 cursor-crosshair touch-pan-y" onPointerMove={pick} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null) }}>
            <span className="absolute inset-y-0 w-[7%] -translate-x-1/2 rounded-full bg-white transition-[left] duration-200" style={{ left: `${Math.min(96.5, Math.max(3.5, x(sel)))}%` }} />
            {[100, 75, 50, 25, 0].map((v) => <span key={v} className="absolute inset-x-0 border-t border-ui-divider" style={{ top: `${v}%` }} />)}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              {prev.length > 1 && <path d={smooth(prev, 100, 100, 0, top)} fill="none" stroke="var(--ui-dark)" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
              <path d={smooth(now, 100, 100, 0, top)} fill="none" stroke="var(--ui-yellow)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-ui-dark bg-ui-yellow transition-all duration-200" style={{ left: `${x(sel)}%`, top: `${yy(now[sel])}%` }} />
            <span className="absolute transition-all duration-200" style={{ left: `${x(sel)}%`, top: `${yy(now[sel])}%`, transform: `translate(${tx}, calc(-100% - 12px))` }}>
              <Pill tone="dark" size="sm">{nf(now[sel])} {unit} <span className="text-white/50">· {revenue.points[sel] ?? ''}</span></Pill>
            </span>
          </div>
          <div className="mt-2 flex justify-between text-ui-label text-ui-muted">{revenue.ticks.map((m, i) => <span key={`${m}-${i}`} className="whitespace-nowrap">{m}</span>)}</div>
        </div>
      </div>
    </div>
  )
}

/** `title` / `unit`: étteremnél ugyanez a forma a vendégszám alakulására („Vendégszám alakulása”, fő). */
export function StatRevenueCard({ revenue: rv, title = 'Bevétel alakulása', unit = 'Ft', onOpen, className = '' }: { revenue?: NonNullable<StatsVM['revenue']>; title?: string; unit?: string; onOpen?: () => void; className?: string }) {
  const revenue = rv ?? (unit === 'Ft' ? SAMPLE_STATS.revenue! : SAMPLE_REST.paxTrend!)
  return (
    <StatCard title={title} extra={<Legend items={[['bg-ui-yellow', 'Most'], ['bg-ui-dark', 'Előző']]} />} onOpen={onOpen} className={`min-h-[280px] ${className}`}>
      <RevenueChart revenue={revenue} unit={unit} />
    </StatCard>
  )
}

/** Top szolgáltatás: a három legtöbbet foglalt. */
export function StatTopCard({ top = SAMPLE_STATS.top!, onOpen, className = '' }: { top?: NonNullable<StatsVM['top']>; onOpen?: () => void; className?: string }) {
  return (
    <StatCard title="Top szolgáltatás" onOpen={onOpen} className={className}>
      <div className="mt-1">
        {top.byCount.length ? top.byCount.slice(0, 3).map((s, i) => <ShareRow key={s.name} name={s.name} value={s.value} pct={s.pct} hi={i === 0} />) : <Meta className="py-4">Még nincs foglalás az időszakban.</Meta>}
      </div>
    </StatCard>
  )
}

/** Kártya-méretű élő sötét vonal-grafikon (No-show, Vendégek): a pontra mutatva az adott nap / hét értéke; alul az első és az
 *  utolsó dátum. */
function CardTrend({ trend: tIn, fmt }: { trend?: { now: number[]; prev: number[]; ticks: string[]; points: string[] }; fmt: (v: number) => string }) {
  // védelem: régebbi (frissítés előtti) szerver-adatban még nincs alakulás — ilyenkor üres vonal, nem hiba
  const trend = tIn ?? { now: [0, 0], prev: [], ticks: [], points: [] }
  const now = trend.now.length > 1 ? trend.now : [trend.now[0] ?? 0, trend.now[0] ?? 0]
  const [hover, setHover] = useState<number | null>(null)
  const sel = hover ?? now.reduce((b, v, i) => (v >= now[b] ? i : b), 0)
  const max = Math.max(1, ...now, ...trend.prev) * 1.15
  const pick = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (now.length - 1))) }
  return (
    <div className="pointer-events-auto mt-auto cursor-crosshair touch-pan-y" onPointerMove={pick} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null) }}>
      <DarkLineChart now={now} prev={trend.prev.slice(0, now.length)} sel={sel} min={0} max={max} h={80} label={`${fmt(now[sel] ?? 0)} · ${trend.points[sel] ?? ''}`} ticks={[trend.ticks[0] ?? '', trend.ticks[trend.ticks.length - 1] ?? '']} />
    </div>
  )
}

/** No-show: félkör, a meg nem jelentek aránya (a lapján az alakulás, a napok, a forrás). */
/** A No-show félköre — a kártya és a részletes lap is ezt rajzolja. */
function NoShowGauge({ noShow, className = '' }: { noShow: StatsVM['noShow']; className?: string }) {
  const fill = Math.min(1, 1 - noShow.pct / 100)
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 200 110" className="mt-2 w-[170px]">
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--ui-dark)" strokeWidth="18" strokeLinecap="round" />
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--ui-yellow)" strokeWidth="18" strokeLinecap="round" strokeDasharray={`${fill * Math.PI * 80} ${Math.PI * 80}`} />
      </svg>
      <div className="-mt-9 text-center"><div className="text-ui-sub font-light leading-none text-ui-text">{comma(noShow.pct)}%</div><div className="text-ui-label text-ui-muted">nem jött el</div></div>
    </div>
  )
}

export function StatNoShowCard({ noShow = SAMPLE_STATS.noShow, onOpen, className = '' }: { noShow?: StatsVM['noShow']; onOpen?: () => void; className?: string }) {
  return (
    <StatCard title="No-show" onOpen={onOpen} className={className}>
      <NoShowGauge noShow={noShow} />
      <div className="mt-auto flex w-full items-center justify-between border-t border-dashed border-ui-divider pt-3 text-ui-meta">
        <span className="text-ui-muted">{noShow.count} foglalás</span>
        {noShow.deltaPt != null && <StatusPill status={noShow.deltaPt <= 0 ? 'ok' : 'bad'}>{signed(noShow.deltaPt, ' pt')}</StatusPill>}
      </div>
    </StatCard>
  )
}

/** Vendégek: sötét kártya, az új vendégek alakulása (most és az előző időszak); a belföldi / külföldi bontás a lapján. */
export function StatGuestsCard({ guests = SAMPLE_STATS.guests, onOpen, className = '' }: { guests?: StatsVM['guests']; onOpen?: () => void; className?: string }) {
  return (
    <StatCard dark title="Vendégek" sub={`${nf(guests.fresh)} új az időszakban`} onOpen={onOpen} className={className}>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-ui-num font-light leading-none">{nf(guests.total)}</span>
        <span className="text-ui-meta text-white/50">vendég</span>
      </div>
      <CardTrend trend={guests.trend} fmt={(v) => `${v} új`} />
    </StatCard>
  )
}

/** Értékelések — nincs részletes lap: a ↗ a Google értékelés-oldalra visz (Beállítások › Google). */
export function StatReviewsCard({ reviews = SAMPLE_STATS.reviews, className = '' }: { reviews?: StatsVM['reviews']; className?: string }) {
  return (
    <StatCard title="Értékelések" arrowLabel="Megnyitás a Google-ben" arrowHref={reviews.url} className={className}>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-ui-num font-light leading-none text-ui-text">{reviews.avg == null ? '—' : comma(reviews.avg)}</span><span className="text-ui-meta text-ui-muted">/ 5 · {nf(reviews.count)} {reviews.google ? 'Google-értékelés' : 'értékelés'}</span></div>
      <div className="mt-3 flex flex-1 flex-col justify-between gap-1.5">
        {reviews.dist.map((pc, i) => (
          <div key={i} className="flex items-center gap-2 text-ui-label text-ui-muted">
            <span className="w-3">{5 - i}</span>
            <span className="flex h-[6px] flex-1 gap-0.5 overflow-hidden rounded-full"><span className={`rounded-full ${i === 0 ? 'bg-ui-yellow' : 'bg-ui-dark'}`} style={{ width: `${pc}%` }} /><span className="flex-1 rounded-full ui-hatch-cell" /></span>
            <span className="w-7 text-right">{pc}%</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-ui-divider pt-3 text-ui-meta">
        <span className="text-ui-muted">{reviews.fresh} új az időszakban</span>
        {reviews.delta != null && <StatusPill status={reviews.delta >= 0 ? 'ok' : 'bad'}>{signed(reviews.delta)}</StatusPill>}
      </div>
    </StatCard>
  )
}

/* ── 5.4 étterem-kártyák ── */

/** Napcsík (Crextio naptár-csík): fent oszloponként felirat + nagy szám, alatta összefüggő sávok több oszlopon át. */
export function BlockStrip({ cols, blocks, weights, className = '' }: Strip & { className?: string }) {
  const tone = { hatch: 'ui-hatch ui-hatch-text font-medium text-ui-text', yellow: 'bg-ui-yellow text-ui-dark', dark: 'bg-ui-dark text-white', off: 'ui-hatch-cell text-ui-label text-ui-muted' }
  // arányos oszlopok (pl. a társaságok százaléka szerint), különben egyformák
  const template = weights ? weights.map((w) => `minmax(0, ${w}fr)`).join(' ') : `repeat(${cols.length}, minmax(0, 1fr))`
  return (
    <Card tone="cell" inner className={className}>
      <div className="grid gap-1.5 text-center" style={{ gridTemplateColumns: template }}>
        {cols.map(([l, v]) => <div key={l} className="min-w-0"><div className="truncate text-ui-label text-ui-muted">{l}</div><div className="mt-1 truncate text-ui-title font-light text-ui-text">{v}</div></div>)}
      </div>
      <div className="mt-3 grid h-14 gap-1.5" style={{ gridTemplateColumns: template }}>
        {blocks.map((b, i) => <div key={`${b.text}-${i}`} className={`flex min-w-0 items-center justify-center overflow-hidden rounded-ui-inner px-1 text-center text-ui-label leading-tight ${tone[b.tone]}`} style={{ gridColumn: `span ${b.span}` }}>{b.text}</div>)}
      </div>
    </Card>
  )
}

/** Étterem — Létszám (a szalon Top szolgáltatásának helyén): hány fős társaságok jönnek, és van-e hozzá asztal — ugyanaz a
 *  napcsík, mint a részletes lapján. */
export function RestPartyCard({ rest = SAMPLE_REST.rest!, onOpen, className = '' }: { rest?: NonNullable<StatsVM['rest']>; onOpen?: () => void; className?: string }) {
  return (
    <StatCard title="Létszám" onOpen={onOpen} className={className}>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-ui-num font-light leading-none text-ui-text">{rest.avgParty == null ? '—' : comma(rest.avgParty)}</span><span className="text-ui-meta text-ui-muted">fő átlagosan</span></div>
      <BlockStrip className="mt-auto" {...rest.party} />
    </StatCard>
  )
}

/* ── 5.2 részletes lapok ── */

/** A részletes lapok sötét vonal-grafikonja (DarkLineChart) élőben: a pontra mutatva / koppintva az adott nap / hét értéke. */
export function LiveDarkLine({ now: nowIn, prev, ticks, points, fmt, title, className = '' }: { now: number[]; prev?: number[]; ticks: string[]; points: string[]; fmt: (v: number) => string; title: string; className?: string }) {
  const now = nowIn.length > 1 ? nowIn : [nowIn[0] ?? 0, nowIn[0] ?? 0]
  const [hover, setHover] = useState<number | null>(null)
  const peak = now.reduce((b, v, i) => (v >= now[b] ? i : b), 0)
  const sel = hover ?? peak
  const max = Math.max(1, ...now, ...(prev ?? [])) * 1.15
  const pick = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (now.length - 1))) }
  return (
    <Card tone="dark" className={className}>
      <div className="flex items-center justify-between text-ui-label"><span className="text-ui-title">{title}</span><Legend dark items={[['bg-ui-yellow', 'Most'], ['bg-white/40', 'Előző']]} /></div>
      <div className="cursor-crosshair touch-pan-y px-2" onPointerMove={pick} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null) }} onPointerDown={pick}>
        <DarkLineChart now={now} prev={prev?.slice(0, now.length)} sel={sel} min={0} max={max} label={`${fmt(now[sel] ?? 0)} · ${points[sel] ?? ''}`} ticks={ticks} />
      </div>
    </Card>
  )
}

/** A részletes lap kerete: fent hol vagyunk (időszak) és a bezárás; élőben az egységes felugró ablakban. */
export function StatDetailPanel({ meta = 'Statisztikák · 30 nap', onClose, children, className = '' }: { meta?: string; onClose?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <Panel size="sm" className={`relative w-full max-sm:rounded-b-none sm:min-h-full ${className}`}>
      {/* mobilon alulról nyíló lap, mint minden felugró ablak: fogantyú (koppintásra zár), X csak desktopon */}
      <button type="button" aria-label="Bezárás" onClick={onClose} className="-mt-3 mb-2 w-full sm:hidden"><SheetHandle /></button>
      <div className="flex items-center justify-between"><span className="text-ui-meta text-ui-muted">{meta}</span><IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onClose} className="max-sm:hidden" /></div>
      <div className="mt-2">{children}</div>
    </Panel>
  )
}

export function DetailHead({ title, value, unit, delta, good = true }: { title: string; value: string; unit: string; delta?: string | null; good?: boolean }) {
  return (
    <>
      <div className="text-ui-sub font-light text-ui-text">{title}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2"><span className="text-ui-page font-light leading-none text-ui-text">{value}</span><span className="text-ui-meta text-ui-muted">{unit}{delta && <> · <span className={good ? 'text-ui-ok' : 'text-ui-bad'}>{delta}</span></>}</span></div>
    </>
  )
}
const Facts = ({ items }: { items: [string, string][] }) => (
  <div className="mt-4 grid grid-cols-3 gap-[5px]">{items.map(([v, l]) => <Card key={l} tone="cell" inner pad="sm"><div className="text-ui-title font-light text-ui-text">{v}</div><Meta className="text-ui-label">{l}</Meta></Card>)}</div>
)

export function WeekDetail({ week = SAMPLE_STATS.week, onAll, onRow }: { week?: StatsVM['week']; onAll?: (dayIdx: number) => void; onRow?: (date: string) => void }) {
  const peak = Math.max(0, week.days.findIndex((d) => d.peak))
  const [day, setDay] = useState(peak)
  const sel = week.byDay[day]
  return (
    <>
      <DetailHead title="Heti eloszlás" value={nf(week.perWeek)} unit="foglalás / hét átlagosan" delta={week.delta != null ? `${signed(week.delta, '%')} az előző időszakhoz` : null} good={(week.delta ?? 0) >= 0} />
      {/* a napra kattintva alatta az aznapi foglalások */}
      {/* a napok közös skálán (a hét legnagyobbjához); a kiválasztott nap kiemelve, rá kattintva alatta a foglalásai */}
      <div className="mt-8 grid grid-cols-7 gap-1">
        {week.days.map((d, i) => <button key={d.d} type="button" onClick={() => setDay(i)} className={`rounded-ui-inner pt-8 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ui-dark/20 ${i === day ? 'bg-ui-cell' : 'hover:bg-ui-cell/60'}`}><WeekBars className="h-[130px] py-1" h={90} max={Math.max(1, ...week.days.map((x) => x.v))} days={[{ ...d, peak: i === day && d.v > 0 }]} /></button>)}
      </div>
      <div className="mt-4 text-ui-meta text-ui-muted">{sel?.d} · {sel?.total ?? 0} foglalás az időszakban</div>
      <div className="-mx-3">
        {sel?.rows.length ? sel.rows.map((r, i) => {
          const row = <ListRow leading={<span className="w-12 text-ui-body text-ui-muted">{r.time}</span>} title={r.name} meta={r.what} trailing={<ArrowUpRight className="h-4 w-4 text-ui-muted" />} />
          return onRow ? <button key={i} type="button" onClick={() => onRow(r.date)} className="block w-full text-left outline-none hover:bg-ui-cell/50 focus-visible:ring-2 focus-visible:ring-ui-dark/20">{row}</button> : <div key={i}>{row}</div>
        }) : <Meta className="px-3 py-3">Ezen a napon nem volt foglalás.</Meta>}
      </div>
      {(sel?.total ?? 0) > 0 && <Button variant="cell" className="mt-2 w-full" onClick={onAll ? () => onAll(day) : undefined}>Foglalások megnyitása</Button>}
    </>
  )
}

export function RevenueDetail({ revenue = SAMPLE_STATS.revenue!, total = SAMPLE_STATS.kpis.revenue, title = 'Bevétel alakulása', unit = 'Ft', partsTitle = 'Miből jött' }: { revenue?: NonNullable<StatsVM['revenue']>; total?: number; title?: string; unit?: string; partsTitle?: string }) {
  return (
    <>
      <DetailHead title={title} value={unit === 'Ft' ? short(total) : nf(total)} unit={unit} delta={revenue.delta != null ? `${signed(revenue.delta, '%')} az előző időszakhoz` : null} good={(revenue.delta ?? 0) >= 0} />
      <Card tone="cell" inner className="mt-4 flex min-h-[260px] flex-col"><Legend items={[['bg-ui-yellow', 'Most'], ['bg-ui-dark', 'Előző']]} /><RevenueChart revenue={revenue} unit={unit} /></Card>
      <div className="mt-4 text-ui-meta text-ui-muted">{partsTitle}</div>
      <div>{revenue.parts.map((p) => <ShareRow key={p.name} name={p.name} value={p.value} pct={p.pct} hi={p.lead === 'hi'} />)}</div>
    </>
  )
}

/** Vendégek — fent belföldi / külföldi, alatta kapcsolóval ország vagy város szerint. */
export function GuestsDetail({ guests = SAMPLE_STATS.guests, by: byInit = 'country' }: { guests?: StatsVM['guests']; by?: 'country' | 'city' }) {
  const [by, setBy] = useState(byInit)
  const rows = by === 'country' ? guests.countries : guests.cities
  return (
    <>
      <DetailHead title="Vendégek" value={nf(guests.total)} unit="vendég" delta={`+${guests.fresh} új`} />
      <LiveDarkLine className="mt-4" title="Új vendégek" now={guests.trend?.now ?? [0, 0]} prev={guests.trend?.prev ?? []} ticks={guests.trend?.ticks ?? []} points={guests.trend?.points ?? []} fmt={(v) => `${v} új`} />
      <SegmentBar joined className="mt-5" segments={[{ label: 'Belföldi', value: `${guests.domestic}%`, weight: Math.max(24, guests.domestic), tone: 'yellow' }, { label: 'Külföldi', value: `${guests.foreign}%`, weight: Math.max(24, guests.foreign), tone: 'dark' }]} />
      <div className="mt-5 flex items-center justify-between gap-2">
        <Meta>{by === 'country' ? 'Országonként' : 'Városonként'}</Meta>
        <Segmented size="sm" options={['Ország', 'Város']} active={by === 'country' ? 0 : 1} onSelect={(i) => setBy(i ? 'city' : 'country')} />
      </div>
      <div className="mt-1">{rows.length ? rows.map((r, i) => <ShareRow key={r.name} lead={r.lead || undefined} name={r.name} value={r.value} pct={r.pct} hi={i === 0} />) : <Meta className="py-3">Még nincs adat ({by === 'country' ? 'telefonszám-országkód' : 'megadott város'}).</Meta>}</div>
      <Meta className="mt-3">A telefonszám országkódja és a megadott cím alapján.</Meta>
    </>
  )
}

/** Kihasználtság — a hét napjai átlagban az időszakra; a napcsík, napszakok, munkatársak. */
export function UtilDetail({ util = SAMPLE_STATS.util, restaurant = false, onOffer }: { util?: StatsVM['util']; restaurant?: boolean; onOffer?: () => void }) {
  return (
    <>
      <DetailHead title={restaurant ? 'Telítettség' : 'Kihasználtság'} value={util.pct == null ? '—' : `${util.pct}%`} unit={restaurant ? 'átlag · foglalt ülőhely-óra' : 'átlag · a nyitvatartásból foglalt'} delta={util.delta != null ? signed(util.delta, ' pt') : null} good={(util.delta ?? 0) >= 0} />
      <Ring pct={util.pct ?? 0} size={180} className="mx-auto mt-4"><span className="text-ui-page font-light leading-none text-ui-text">{util.pct == null ? '—' : `${util.pct}%`}</span></Ring>
      <div className="mt-5 text-ui-meta text-ui-muted">A hét napjai</div>
      <BlockStrip className="mt-2" {...util.strip} />
      <Facts items={[[`${nf(util.open)} ó`, 'nyitva'], [`${nf(util.booked)} ó`, 'foglalt'], [`${nf(Math.max(0, util.open - util.booked))} ó`, 'szabad']]} />
      {util.parts.length > 0 && <><div className="mt-4 text-ui-meta text-ui-muted">Napszakonként</div><div>{util.parts.map((p) => <ShareRow key={p.name} name={p.name} value={p.value} pct={p.pct} hi={p.pct === Math.max(...util.parts.map((x) => x.pct))} />)}</div></>}
      {util.staff.length > 0 && <><div className="mt-4 text-ui-meta text-ui-muted">Munkatársanként</div><div>{util.staff.map((p, i) => <ShareRow key={p.name} lead={<Avatar size="xs" src={p.img ?? null} name={p.name} />} name={p.name} value={p.value} pct={p.pct} hi={i === 0} />)}</div></>}
      <Button variant="dark" icon={Megaphone} className="mt-3 w-full" onClick={onOffer}>Last-minute ajánlat a szabad helyekre</Button>
    </>
  )
}

/** No-show — ki nem jött el, és egy lépés ellene (előleg). */
export function NoShowDetail({ noShow = SAMPLE_STATS.noShow, onDeposit }: { noShow?: StatsVM['noShow']; onDeposit?: () => void }) {
  return (
    <>
      <DetailHead title="No-show" value={`${comma(noShow.pct)}%`} unit={`${noShow.count} foglalás`} delta={noShow.deltaPt != null ? signed(noShow.deltaPt, ' pt') : null} good={(noShow.deltaPt ?? 0) <= 0} />
      <NoShowGauge noShow={noShow} className="mt-2" />
      <LiveDarkLine className="mt-4" title="Meg nem jelentek alakulása" now={noShow.trend.now} prev={noShow.trend.prev} ticks={noShow.trend.ticks} points={noShow.trend.points} fmt={(v) => `${v} foglalás`} />
      <div className="mt-4 text-ui-meta text-ui-muted">Melyik napon</div>
      <WeekBars className="mt-8 h-[110px]" days={noShow.byDay} />
      <div className="mt-4 text-ui-meta text-ui-muted">Honnan jött a foglalás</div>
      <div>{noShow.bySource.map((s) => <ShareRow key={s.name} name={s.name} value={s.value} pct={s.pct} hi={s.pct === Math.max(...noShow.bySource.map((x) => x.pct)) && s.pct > 0} />)}</div>
      <div className="mt-4 text-ui-meta text-ui-muted">Többször nem jött el</div>
      <div className="-mx-3">{noShow.repeat.length ? noShow.repeat.map((r) => <ListRow key={r.name + r.meta} title={r.name} meta={r.meta} trailing={<Pill tone="yellow" size="sm">{r.count}×</Pill>} />) : <Meta className="px-3 py-3">Senki nem maradt ki kétszer.</Meta>}</div>
      <Note tip className="mt-3">A 2× vagy többször kimaradt vendégeknél kérhetsz előleget — online foglaláskor automatikusan.</Note>
      <Button variant="cell" className="mt-2 w-full" onClick={onDeposit}>Előleg beállítása</Button>
    </>
  )
}

/** Mikor foglalnak — a pont-mátrix nagyban, alatta: mikor adják le a foglalást. */
export function HoursDetail({ hours = SAMPLE_STATS.hours }: { hours?: StatsVM['hours'] }) {
  return (
    <>
      <DetailHead title="Mikor foglalnak" value={hours.peak ?? '—'} unit="a legkeresettebb idősáv" />
      <StatHoursCard className="mt-4" hours={hours} />
      <div className="mt-4 text-ui-meta text-ui-muted">Mikor adják le a foglalást (online)</div>
      <div>{hours.created.map((c) => <ShareRow key={c.name} name={c.name} value={c.value} pct={c.pct} hi={c.lead === 'hi'} />)}</div>
      {hours.closedPct != null && <Meta className="mt-3">A foglalások {hours.closedPct}%-a zárva tartás alatt jön — ezek telefonon elvesznének.</Meta>}
    </>
  )
}

/** Vendégforrás — honnan jön a foglalás. */
export function SourceDetail({ source: src, restaurant = false }: { source?: StatsVM['source']; restaurant?: boolean }) {
  const source = src ?? (restaurant ? SAMPLE_REST : SAMPLE_STATS).source
  return (
    <>
      <DetailHead title="Vendégforrás" value={`${source.online}%`} unit="online" delta={source.delta != null ? signed(source.delta, ' pt') : null} good={(source.delta ?? 0) >= 0} />
      <SourceBars fixed source={source} />
      <Facts items={[[source.leadDays == null ? '—' : `${comma(source.leadDays)} nap`, 'előrefoglalás'], restaurant ? [source.tableTime == null ? '—' : `${Math.floor(source.tableTime / 60)} ó ${source.tableTime % 60} p`, 'asztal-idő'] : [source.avgValue == null ? '—' : `${nf(source.avgValue)} Ft`, 'átl. érték'], [`${source.cancelPct}%`, 'lemondás']]} />
    </>
  )
}

/** Top szolgáltatás — kapcsolóval darab vagy bevétel szerint, alatta, mit kérnek együtt. */
export function TopDetail({ top = SAMPLE_STATS.top! }: { top?: NonNullable<StatsVM['top']> }) {
  const [rev, setRev] = useState(false)
  const rows = rev ? top.byRevenue : top.byCount
  return (
    <>
      <DetailHead title="Top szolgáltatás" value={top.byCount[0]?.name ?? '—'} unit={top.byCount[0] ? `${top.byCount[0].value} foglalás` : ''} delta={top.delta != null ? signed(top.delta, '%') : null} good={(top.delta ?? 0) >= 0} />
      <div className="mt-5 flex items-center justify-between gap-2">
        <Meta>{rev ? 'Bevétel szerint' : 'Foglalás szerint'}</Meta>
        <Segmented size="sm" options={['Darab', 'Bevétel']} active={rev ? 1 : 0} onSelect={(i) => setRev(i === 1)} />
      </div>
      <div className="mt-1">{rows.map((s, i) => <ShareRow key={s.name} name={s.name} value={s.value} pct={s.pct} hi={i === 0} />)}</div>
      {top.pairs.length > 0 && <>
        <div className="mt-4 text-ui-meta text-ui-muted">Gyakran együtt foglalják</div>
        <div className="-mx-3">{top.pairs.map((p) => <ListRow key={p.title} title={p.title} meta={`${p.count} alkalom`} />)}</div>
      </>}
    </>
  )
}

/** Étterem — Létszám részletes lap: hány fős társaságok jönnek és van-e hozzá elég asztal; alatta az asztalok: forgás,
 *  asztal-idő a beállítotthoz képest, termenként. */
export function RestPartyDetail({ rest = SAMPLE_REST.rest!, onSettings, onTables }: { rest?: NonNullable<StatsVM['rest']>; onSettings?: () => void; onTables?: () => void }) {
  const hm = (m: number | null) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)} ó${m % 60 ? ` ${m % 60} p` : ''}` : `${m} p`)
  return (
    <>
      <DetailHead title="Létszám" value={rest.avgParty == null ? '—' : comma(rest.avgParty)} unit="fő átlagosan" delta={rest.partyDelta != null ? signed(rest.partyDelta) : null} good={(rest.partyDelta ?? 0) >= 0} />
      <BlockStrip className="mt-4" {...rest.party} />
      <Meta className="mt-3 leading-relaxed">Fent: a társaságok hány százaléka jön ekkora létszámmal. Alatta: van-e elég ilyen asztalod — ezt az mutatja, mennyire foglaltak az ekkora asztalok.</Meta>
      <div className="-mx-3 mt-2">{rest.partyRows.map((r) => <ListRow key={r.title} title={r.title} meta={r.meta} trailing={<Pill tone={r.tone} size="sm">{r.value}</Pill>} />)}</div>
      <Button variant="cell" className="mt-3 w-full" onClick={onTables}>Asztalok szerkesztése</Button>
      <div className="mt-6 text-ui-title font-light text-ui-text">Asztalok</div>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-ui-num font-light leading-none text-ui-text">{rest.turns == null ? '—' : `${comma(rest.turns)}×`}</span><span className="text-ui-meta text-ui-muted">átlagos forgás / este</span></div>
      {rest.tables.length > 0 && <WeekBars className="mt-4 h-[130px]" h={90} tag={(v) => `${comma(v / 10)}×`} days={rest.tables} />}
      <Facts items={[[hm(rest.tableTime), 'átl. asztal-idő'], [hm(rest.setTime), 'beállítva'], [hm(rest.idle), 'üresjárat']]} />
      {rest.idle != null && rest.idle >= 10 && <Note tip className="mt-2">A társaságok átlagban {rest.idle} perccel hamarabb távoznak, mint a beállított asztal-idő — rövidebb asztal-idővel esténként több foglalás férne be.</Note>}
      {rest.rooms.length > 0 && <><div className="mt-4 text-ui-meta text-ui-muted">Termenként</div><div>{rest.rooms.map((r) => <ShareRow key={r.name} name={r.name} value={r.value} pct={r.pct} hi={r.lead === 'hi'} />)}</div></>}
      <Button variant="cell" className="mt-3 w-full" onClick={onSettings}>Asztal-idő beállítása</Button>

    </>
  )
}

/** 5.5: a munkatárs saját statisztikája (étterem: akinek csak `analytics.view.own` joga van) — a beosztásból: ledolgozott
 *  óra, munkanap, átlagos műszak, bér / borravaló (ha van), a hét napjai szerinti órák, jelenlét az előző időszakhoz
 *  képest, távollét (szabadság, beteg), és a közelgő műszakok. Élőben minden adat a hívótól (`lib/myShiftStats`). */
export type StaffStatsData = {
  periodLabel: string
  hours: string; hoursDiff?: number | null
  days: number; daysDiff?: number | null
  avgShift: string
  pay?: { label: string; value: string } | null
  tip?: string | null
  dow: WeekBar[]
  presence: { now: number; prev: number }
  leave: number; sick: number
  upcoming: { key: string; day: string; time: string }[]
}
const SAMPLE_STAFF_STATS: StaffStatsData = {
  periodLabel: 'Az elmúlt 30 nap', hours: '142 ó', hoursDiff: 6, days: 19, daysDiff: 2, avgShift: '7,5 ó', pay: { label: 'Bér', value: '312 400 Ft' }, tip: '48 600 Ft',
  dow: [['H', 0], ['K', 22], ['Sze', 24], ['Cs', 24], ['P', 30], ['Szo', 32], ['V', 10]].map(([d, v]) => ({ d: d as string, v: v as number, peak: d === 'Szo', closed: v === 0 })),
  presence: { now: 19, prev: 17 }, leave: 2, sick: 1,
  upcoming: [{ key: '1', day: 'Ma, Csütörtök', time: '16:00 – 23:00' }, { key: '2', day: 'Péntek, Nov. 7.', time: '16:00 – 24:00' }, { key: '3', day: 'Szombat, Nov. 8.', time: '12:00 – 24:00' }],
}
export function StaffStats({ data = SAMPLE_STAFF_STATS, period }: { data?: StaffStatsData; /** az időszak-váltó (élőben a hívótól) */ period?: React.ReactNode }) {
  const d = data
  const delta = (v?: number | null) => (v ? <span className={`text-ui-label ${v > 0 ? 'text-ui-ok' : 'text-ui-bad'}`}>{v > 0 ? '+' : ''}{v}%</span> : null)
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-ui-num font-light leading-none text-ui-text lg:text-ui-page">Statisztikák</h1><div className="mt-2 text-ui-body text-ui-muted">A saját munkád · {d.periodLabel}</div></div>
        {period}
      </div>
      <div className="mb-6 flex flex-wrap gap-x-10 gap-y-4">
        <div className="flex items-end gap-2"><Kpi icon={Clock} value={d.hours} label="ledolgozva" />{delta(d.hoursDiff)}</div>
        <div className="flex items-end gap-2"><Kpi icon={CalendarDays} value={d.days} label="munkanap" />{delta(d.daysDiff)}</div>
        <Kpi icon={Briefcase} value={d.avgShift} label="átlagos műszak" />
        {d.pay && <Kpi icon={Wallet} value={d.pay.value} label={d.pay.label} />}
        {d.tip && <Kpi icon={Coins} value={d.tip} label="borravaló" />}
      </div>
      <div className="grid gap-[5px] md:grid-cols-2 xl:grid-cols-3">
        <Card className="flex flex-col">
          <CardTitle>A hét napjai</CardTitle><Meta className="text-ui-label">ledolgozott órák napok szerint</Meta>
          <WeekBars className="mt-auto h-[120px] pt-4" days={d.dow} tag={(v) => `${v} ó`} />
        </Card>
        <Card className="flex flex-col">
          <CardTitle>Jelenlét</CardTitle><Meta className="text-ui-label">munkanapok az előző időszakhoz képest</Meta>
          <div className="mt-4 space-y-3">
            {([['Most', d.presence.now, 'bg-ui-yellow'], ['Előtte', d.presence.prev, 'bg-ui-cell']] as const).map(([l, v, c]) => (
              <div key={l}><div className="mb-1 flex justify-between text-ui-meta"><span className="text-ui-muted">{l}</span><span className="text-ui-text">{v} nap</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-ui-cell"><span className={`block h-full rounded-full ${c === 'bg-ui-cell' ? 'bg-ui-grey' : c}`} style={{ width: `${Math.round((v / Math.max(1, d.presence.now, d.presence.prev)) * 100)}%` }} /></div></div>
            ))}
          </div>
          <div className="mt-auto flex justify-between gap-2 border-t border-dashed border-ui-divider pt-3 text-ui-meta"><span className="text-ui-muted">Szabadság · beteg</span><span className="text-ui-text">{d.leave} · {d.sick} nap</span></div>
        </Card>
        <Card className="md:col-span-2 xl:col-span-1">
          <CardTitle>Közelgő műszakok</CardTitle>
          {d.upcoming.length === 0
            ? <Meta className="py-6 text-center">Nincs közelgő beosztásod.</Meta>
            : <div className="mt-2">{d.upcoming.map((u, i) => <ListRow key={u.key} leading={<IconCircle tone={i === 0 ? 'yellow' : 'cell'} size="sm" icon={CalendarDays} />} title={u.day} meta={u.time} />)}</div>}
        </Card>
      </div>
    </div>
  )
}
