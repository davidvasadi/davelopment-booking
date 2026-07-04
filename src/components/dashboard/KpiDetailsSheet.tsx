'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react'
import type { DayData, DowStat, HourStat, ServiceStat, StaffStat } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Kind = 'trend' | 'dow' | 'hour' | 'kpi' | 'service' | 'staff'
type Metric = 'revenue' | 'bookings' | 'completion' | 'avg_value'
type DayFilter = 'all' | 'weekday' | 'weekend'

/* davelopment-design chart-paletta. */
const C = {
  ink: '#1D1C19',
  accent: '#F1CE45',
  grid: 'rgba(120,110,70,.14)',
  tick: '#9b9788',
}

/**
 * moneyless: étterem-mód. A DayData.revenue mező itt vendégszámot (pax) hordoz, nem pénzt.
 */
type Props =
  | { kind: 'trend'; open: boolean; onClose: () => void; period: number; data: DayData[]; moneyless?: boolean }
  | { kind: 'dow'; open: boolean; onClose: () => void; period: number; data: DayData[]; moneyless?: boolean }
  | { kind: 'hour'; open: boolean; onClose: () => void; period: number; data: HourStat[]; rawDays?: DayData[]; hourlyByDate?: Record<string, number[]>; moneyless?: boolean }
  | { kind: 'kpi'; open: boolean; onClose: () => void; period: number; metric: Metric; title: string; currentValue: string; currentDiff?: number; data: DayData[]; moneyless?: boolean }
  | { kind: 'service'; open: boolean; onClose: () => void; period: number; data: ServiceStat[]; moneyless?: boolean }
  | { kind: 'staff'; open: boolean; onClose: () => void; period: number; data: StaffStat[]; moneyless?: boolean }

const KIND_TITLE: Record<Exclude<Kind, 'kpi'>, string> = {
  trend: 'Trend részletek',
  dow: 'Heti eloszlás részletek',
  hour: 'Óránkénti forgalom részletek',
  service: 'Szolgáltatások részletek',
  staff: 'Munkatársak részletek',
}

const PERIODS = [
  { value: 1, label: 'Ma' },
  { value: 7, label: '7 nap' },
  { value: 30, label: '30 nap' },
  { value: 90, label: '90 nap' },
  { value: 180, label: '6 hónap' },
  { value: 365, label: '1 év' },
]

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}e`
  return String(n)
}

function tailSlice<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n))
}

function isWeekendIso(iso: string): boolean {
  const d = new Date(iso).getDay()
  return d === 0 || d === 6
}

function dayOfWeekIndex(iso: string): number {
  const d = new Date(iso).getDay()
  return d === 0 ? 6 : d - 1
}

const DOW_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

function valueKey(metric: Metric): 'revenue' | 'bookings' {
  return metric === 'bookings' ? 'bookings' : 'revenue'
}

/** davelopment toggle-pill (light). */
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active ? 'bg-ink-dark text-white' : 'bg-[var(--dav-glass-strong)] border border-line text-ink-soft2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/** davelopment kis toggle (chart fejlécben). */
function MiniToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-[10px] text-[11px] font-semibold transition-colors ${
        active ? 'bg-ink-dark text-white shadow-sm' : 'text-ink-soft2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

const STAT = 'rounded-[14px] p-3.5 bg-[var(--dav-glass)] border border-line'

export function KpiDetailsSheet(props: Props) {
  const { kind, open, onClose, period } = props
  const moneyless = props.moneyless ?? false
  const router = useRouter()
  const searchParams = useSearchParams()

  const loadLargerPeriod = (value: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', String(value))
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const revLabel = moneyless ? 'Vendégszám' : 'Bevétel'
  const fmtRev = (n: number) => (moneyless ? `${Math.round(n)} fő` : formatPrice(Math.round(n), 'HUF'))
  const fmtRevAxis = moneyless ? undefined : fmt
  const initialMetric: Metric = kind === 'kpi' ? (props as Extract<Props, { kind: 'kpi' }>).metric : 'revenue'
  const [metric, setMetric] = useState<Metric>(initialMetric)
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [innerPeriod, setInnerPeriod] = useState<number>(period)

  useEffect(() => setInnerPeriod(period), [period])
  useEffect(() => setMetric(initialMetric), [initialMetric])

  const hasDayData = kind === 'trend' || kind === 'dow' || kind === 'kpi' || kind === 'hour'
  const filteredDays: DayData[] = useMemo(() => {
    if (!hasDayData) return []
    const src =
      kind === 'trend' || kind === 'dow' || kind === 'kpi'
        ? (props as Extract<Props, { kind: 'trend' | 'dow' | 'kpi' }>).data
        : ((props as Extract<Props, { kind: 'hour' }>).rawDays ?? [])
    const sliced = tailSlice(src, innerPeriod)
    return sliced.filter((d) => {
      if (dayFilter === 'weekday') return !isWeekendIso(d.date)
      if (dayFilter === 'weekend') return isWeekendIso(d.date)
      return true
    })
  }, [hasDayData, kind, props, innerPeriod, dayFilter])

  const vkey = valueKey(metric)
  const sumRevenue = filteredDays.reduce((s, d) => s + d.revenue, 0)
  const sumBookings = filteredDays.reduce((s, d) => s + d.bookings, 0)
  const avgRevenue = filteredDays.length ? sumRevenue / filteredDays.length : 0
  const avgBookings = filteredDays.length ? sumBookings / filteredDays.length : 0
  const avgBookingValue = sumBookings > 0 ? sumRevenue / sumBookings : 0
  const best = filteredDays.reduce<DayData | null>((acc, d) => (!acc || d[vkey] > acc[vkey] ? d : acc), null)
  const worst = filteredDays.reduce<DayData | null>((acc, d) => (!acc || d[vkey] < acc[vkey] ? d : acc), null)

  const dowAgg = useMemo<DowStat[]>(() => {
    const buckets = Array.from({ length: 7 }, () => 0)
    for (const d of filteredDays) buckets[dayOfWeekIndex(d.date)] += d.bookings
    return buckets.map((bookings, i) => ({ day: DOW_LABELS[i], bookings }))
  }, [filteredDays])

  const hourlyByDate = kind === 'hour' ? (props as Extract<Props, { kind: 'hour' }>).hourlyByDate : undefined
  const allHourData = useMemo<HourStat[]>(() => {
    if (kind !== 'hour') return []
    if (!hourlyByDate) return (props as Extract<Props, { kind: 'hour' }>).data
    const dates = filteredDays.map(d => d.date)
    const sums = Array.from({ length: 24 }, () => 0)
    for (const date of dates) {
      const arr = hourlyByDate[date]
      if (arr) for (let h = 0; h < 24; h++) sums[h] += arr[h] ?? 0
    }
    const dayCount = Math.max(1, dates.length)
    return sums.map((total, h) => ({ hour: `${String(h).padStart(2, '0')}:00`, bookings: total / dayCount }))
  }, [kind, hourlyByDate, props, filteredDays])
  const hourFirst = allHourData.findIndex(d => d.bookings > 0)
  const hourData = hourFirst === -1
    ? allHourData
    : allHourData.slice(hourFirst, allHourData.length - [...allHourData].reverse().findIndex(d => d.bookings > 0))

  const dowPeak = dowAgg.reduce((mi, d, i, a) => (d.bookings > (a[mi]?.bookings ?? -1) ? i : mi), 0)
  const hourPeak = hourData.reduce((mi, d, i, a) => (d.bookings > (a[mi]?.bookings ?? -1) ? i : mi), 0)

  const sheetTitle = kind === 'kpi' ? (props as Extract<Props, { kind: 'kpi' }>).title : KIND_TITLE[kind]
  const kpiProps = kind === 'kpi' ? (props as Extract<Props, { kind: 'kpi' }>) : null

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto bg-white">
        <SheetHeader className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-0.5">Részletek</p>
          <SheetTitle className="text-lg font-medium tracking-tight text-ink">{sheetTitle}</SheetTitle>
        </SheetHeader>

        {kpiProps && (
          <div className="mb-5 rounded-[18px] p-5 bg-[var(--dav-glass)] border border-line">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-2">Aktuális érték</p>
            <p className="text-4xl font-light tracking-[-0.02em] text-ink mb-1">{kpiProps.currentValue}</p>
            {kpiProps.currentDiff !== undefined && (
              <p className={`text-xs font-semibold ${kpiProps.currentDiff > 0 ? 'text-[#1D9D63]' : kpiProps.currentDiff < 0 ? 'text-bad' : 'text-ink-soft'}`}>
                {kpiProps.currentDiff > 0 ? '+' : ''}{kpiProps.currentDiff}% az előző időszakhoz képest
              </p>
            )}
          </div>
        )}

        <div className="space-y-5">
          {hasDayData && (
          <>
          {/* Szűrők */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-ink-soft" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Időszak</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <Pill
                  key={p.value}
                  active={innerPeriod === p.value}
                  onClick={() => {
                    if (p.value > period) loadLargerPeriod(p.value)
                    else setInnerPeriod(p.value)
                  }}
                >
                  {p.label}
                </Pill>
              ))}
            </div>
            {kind !== 'hour' && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <Filter className="h-3.5 w-3.5 text-ink-soft" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Napok</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['all', 'Összes'],
                    ['weekday', 'Hétköznap'],
                    ['weekend', 'Hétvége'],
                  ] as const).map(([v, l]) => (
                    <Pill key={v} active={dayFilter === v} onClick={() => setDayFilter(v)}>{l}</Pill>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* KPI mini sor */}
          <div className="grid grid-cols-2 gap-2">
            <div className={STAT}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">{moneyless ? 'Összes vendég' : 'Összes bevétel'}</p>
              <p className="text-xl font-light tracking-[-0.02em] text-ink">{fmtRev(sumRevenue)}</p>
              <p className="text-xs text-ink-soft mt-0.5">napi átlag {fmtRev(avgRevenue)}</p>
            </div>
            <div className={STAT}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">Összes foglalás</p>
              <p className="text-xl font-light tracking-[-0.02em] text-ink">{sumBookings}</p>
              <p className="text-xs text-ink-soft mt-0.5">napi átlag {avgBookings.toFixed(1)}</p>
            </div>
          </div>

          {/* Fő chart kind szerint */}
          {(kind === 'trend' || kind === 'kpi') && (
            <div className="rounded-[18px] border border-line p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink">{vkey === 'revenue' ? `${revLabel} napi bontás` : 'Foglalások napi bontás'}</h3>
                <div className="flex gap-1 bg-[var(--dav-glass-strong)] border border-line rounded-[12px] p-0.5">
                  <MiniToggle active={vkey === 'revenue'} onClick={() => setMetric('revenue')}>{revLabel}</MiniToggle>
                  <MiniToggle active={vkey === 'bookings'} onClick={() => setMetric('bookings')}>Foglalások</MiniToggle>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={filteredDays} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sheet-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.ink} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={C.ink} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} tickFormatter={vkey === 'revenue' ? fmtRevAxis : undefined} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-[14px] border border-line bg-white text-ink text-xs px-3 py-2 shadow-dav-card">
                          <p className="text-ink-soft mb-0.5">{label}</p>
                          <p className="font-semibold">{vkey === 'revenue' ? fmtRev(Number(payload[0].value)) : `${payload[0].value} foglalás`}</p>
                        </div>
                      )
                    }}
                  />
                  <Area type="monotone" dataKey={vkey} stroke={C.ink} strokeWidth={2} fill="url(#sheet-grad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {kind === 'kpi' && (
            <div className="grid grid-cols-2 gap-2">
              <div className={STAT}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">Időszaki átlag</p>
                <p className="text-lg font-light tracking-[-0.02em] text-ink">{vkey === 'revenue' ? formatPrice(Math.round(avgRevenue), 'HUF') : avgBookings.toFixed(1)}</p>
                <p className="text-xs text-ink-soft mt-0.5">naponta</p>
              </div>
              <div className={STAT}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">Átl. foglalás értéke</p>
                <p className="text-lg font-light tracking-[-0.02em] text-ink">{formatPrice(Math.round(avgBookingValue), 'HUF')}</p>
                <p className="text-xs text-ink-soft mt-0.5">foglalásonként</p>
              </div>
            </div>
          )}

          {kind === 'dow' && (
            <div className="rounded-[18px] border border-line p-4">
              <h3 className="text-sm font-semibold text-ink mb-3">Foglalások a hét napjai szerint</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dowAgg} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(120,110,70,.06)', radius: 6 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return <div className="rounded-[14px] border border-line bg-white text-ink text-xs px-3 py-2 shadow-dav-card"><p className="font-semibold">{payload[0].value} foglalás</p></div>
                    }}
                  />
                  <Bar dataKey="bookings" radius={[6, 6, 0, 0]}>
                    {dowAgg.map((_, i) => <Cell key={i} fill={i === dowPeak ? C.accent : C.ink} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {kind === 'hour' && (
            <div className="rounded-[18px] border border-line p-4">
              <h3 className="text-sm font-semibold text-ink mb-1">Óránkénti forgalom · napi átlag</h3>
              <p className="text-[11px] text-ink-soft mb-3">
                {PERIODS.find(p => p.value === innerPeriod)?.label ?? `${innerPeriod} nap`}
                {dayFilter === 'weekday' ? ' · hétköznap' : dayFilter === 'weekend' ? ' · hétvége' : ''}
                {` · ${filteredDays.length} nap átlaga`}
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: C.tick }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(120,110,70,.06)', radius: 6 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-[14px] border border-line bg-white text-ink text-xs px-3 py-2 shadow-dav-card">
                          <p className="text-ink-soft mb-0.5">{label}</p>
                          <p className="font-semibold">{Math.round(Number(payload[0].value) * 10) / 10} foglalás / nap</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="bookings" radius={[4, 4, 0, 0]}>
                    {hourData.map((_, i) => <Cell key={i} fill={i === hourPeak ? C.accent : C.ink} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Csúcsok */}
          {kind !== 'hour' && best && worst && best.date !== worst.date && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[14px] p-3.5 bg-ok-bg border border-ok/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3 w-3 text-ok" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ok">Legjobb nap</p>
                </div>
                <p className="text-sm font-semibold text-ink">{best.label}</p>
                <p className="text-xs text-ink-soft2 mt-0.5">
                  {vkey === 'revenue' ? formatPrice(best.revenue, 'HUF') : `${best.bookings} foglalás`}
                </p>
              </div>
              <div className={STAT}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="h-3 w-3 text-ink-soft" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">Leggyengébb nap</p>
                </div>
                <p className="text-sm font-semibold text-ink">{worst.label}</p>
                <p className="text-xs text-ink-soft2 mt-0.5">
                  {vkey === 'revenue' ? formatPrice(worst.revenue, 'HUF') : `${worst.bookings} foglalás`}
                </p>
              </div>
            </div>
          )}
          </>
          )}

          {kind === 'service' && (
            <ServiceStaffList items={(props as Extract<Props, { kind: 'service' }>).data.map(s => ({ name: s.name, revenue: s.revenue, bookings: s.bookings }))} sortKey="revenue" />
          )}

          {kind === 'staff' && (
            <ServiceStaffList items={(props as Extract<Props, { kind: 'staff' }>).data.map(s => ({ name: s.name, revenue: s.revenue, bookings: s.bookings }))} sortKey="bookings" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

type ListItem = { name: string; revenue: number; bookings: number }

function ServiceStaffList({ items, sortKey }: { items: ListItem[]; sortKey: 'revenue' | 'bookings' }) {
  const [sort, setSort] = useState<'revenue' | 'bookings'>(sortKey)
  const sorted = [...items].sort((a, b) => b[sort] - a[sort])
  const max = Math.max(1, ...sorted.map(s => s[sort]))
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0)
  const totalBookings = items.reduce((s, i) => s + i.bookings, 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className={STAT}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">Összesen</p>
          <p className="text-xl font-light tracking-[-0.02em] text-ink">{items.length}</p>
        </div>
        <div className={STAT}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">{sort === 'revenue' ? 'Össz bevétel' : 'Össz foglalás'}</p>
          <p className="text-xl font-light tracking-[-0.02em] text-ink">{sort === 'revenue' ? formatPrice(totalRevenue, 'HUF') : totalBookings}</p>
        </div>
      </div>

      <div className="rounded-[18px] border border-line p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink">Rangsor</h3>
          <div className="flex gap-1 bg-[var(--dav-glass-strong)] border border-line rounded-[12px] p-0.5">
            <MiniToggle active={sort === 'revenue'} onClick={() => setSort('revenue')}>Bevétel</MiniToggle>
            <MiniToggle active={sort === 'bookings'} onClick={() => setSort('bookings')}>Foglalás</MiniToggle>
          </div>
        </div>
        <div className="space-y-3">
          {sorted.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-ink truncate pr-2">
                  <span className="text-ink-soft font-mono mr-2">#{i + 1}</span>{item.name}
                </span>
                <span className="text-xs font-semibold text-ink shrink-0">
                  {sort === 'revenue' ? formatPrice(item.revenue, 'HUF') : `${item.bookings} foglalás`}
                </span>
              </div>
              <div className="h-2 bg-[var(--dav-glass-strong)] border border-line rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${(item[sort] / max) * 100}%`, background: i === 0 ? C.accent : C.ink }} />
              </div>
              <p className="text-xs text-ink-soft mt-1">
                {sort === 'revenue' ? `${item.bookings} foglalás` : formatPrice(item.revenue, 'HUF')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
