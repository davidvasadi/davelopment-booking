'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react'
import type { DayData, DowStat, HourStat, ServiceStat, StaffStat } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Kind = 'trend' | 'dow' | 'hour' | 'kpi' | 'service' | 'staff'
type Metric = 'revenue' | 'bookings' | 'completion' | 'avg_value'
type DayFilter = 'all' | 'weekday' | 'weekend'

/**
 * moneyless: étterem-mód. A DayData.revenue mező itt vendégszámot (pax) hordoz, nem pénzt,
 * ezért a "bevétel" feliratokat vendégszámra váltjuk és nincs HUF-formázás.
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

function useIsDark() {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark'
}

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

export function KpiDetailsSheet(props: Props) {
  const { kind, open, onClose, period } = props
  const moneyless = props.moneyless ?? false
  const dark = useIsDark()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Nagyobb időszakhoz több adat kell a szerverről: soft navigation (nem full reload),
  // a Sheet nyitva marad, a period prop frissül és az innerPeriod szinkronizál.
  const loadLargerPeriod = (value: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', String(value))
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // A "revenue" mező formázása: pénz (salon) vagy vendégszám (étterem).
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

  // Óránkénti forgalom a kiválasztott időszakra/napszűrőre, napi ÁTLAGként. A napi×órás
  // nyers adatból (hourlyByDate) a filteredDays dátumaira összegezünk óránként, majd
  // elosztunk a napok számával → így az óránkénti is reagál a sheet szűrőjére (nem a
  // kívülről kapott, fix period-összeget mutatja). Ha nincs hourlyByDate, a régi
  // (összeg-alapú, fix) data-ra esünk vissza.
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
  // Üres széli órák levágása (a HourChart-tal megegyező logika), hogy a 24-órás
  // tartomány ne töltse fel a tengelyt nullás oszlopokkal.
  const hourFirst = allHourData.findIndex(d => d.bookings > 0)
  const hourData = hourFirst === -1
    ? allHourData
    : allHourData.slice(hourFirst, allHourData.length - [...allHourData].reverse().findIndex(d => d.bookings > 0))

  const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const tickColor = dark ? 'rgba(255,255,255,0.25)' : '#94a3b8'

  const sheetTitle = kind === 'kpi' ? (props as Extract<Props, { kind: 'kpi' }>).title : KIND_TITLE[kind]
  const kpiProps = kind === 'kpi' ? (props as Extract<Props, { kind: 'kpi' }>) : null

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto bg-white dark:bg-zinc-950">
        <SheetHeader className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-0.5">Részletek</p>
          <SheetTitle className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">{sheetTitle}</SheetTitle>
        </SheetHeader>

        {kpiProps && (
          <div className="mb-5 rounded-2xl p-5 bg-gradient-to-br from-zinc-50 to-white dark:from-white/[0.04] dark:to-transparent border border-zinc-100 dark:border-white/[0.08]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-2">Aktuális érték</p>
            <p className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-1">{kpiProps.currentValue}</p>
            {kpiProps.currentDiff !== undefined && (
              <p className={`text-xs font-semibold ${kpiProps.currentDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : kpiProps.currentDiff < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}`}>
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
              <Calendar className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">Időszak</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    if (p.value > period) {
                      loadLargerPeriod(p.value)
                    } else {
                      setInnerPeriod(p.value)
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    innerPeriod === p.value
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.1]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {kind !== 'hour' && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <Filter className="h-3.5 w-3.5 text-zinc-400 dark:text-white/40" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">Napok</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['all', 'Összes'],
                    ['weekday', 'Hétköznap'],
                    ['weekend', 'Hétvége'],
                  ] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setDayFilter(v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        dayFilter === v
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.1]'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* KPI mini sor */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">{moneyless ? 'Összes vendég' : 'Összes bevétel'}</p>
              <p className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">{fmtRev(sumRevenue)}</p>
              <p className="text-xs text-zinc-400 dark:text-white/30 mt-0.5">napi átlag {fmtRev(avgRevenue)}</p>
            </div>
            <div className="rounded-xl p-3.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">Összes foglalás</p>
              <p className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">{sumBookings}</p>
              <p className="text-xs text-zinc-400 dark:text-white/30 mt-0.5">napi átlag {avgBookings.toFixed(1)}</p>
            </div>
          </div>

          {/* Fő chart kind szerint */}
          {(kind === 'trend' || kind === 'kpi') && (
            <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.06] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-white/80">{vkey === 'revenue' ? `${revLabel} napi bontás` : 'Foglalások napi bontás'}</h3>
                <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] rounded-lg p-0.5">
                  <button
                    onClick={() => setMetric('revenue')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${vkey === 'revenue' ? 'bg-white text-zinc-900 dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 dark:text-white/40'}`}
                  >{revLabel}</button>
                  <button
                    onClick={() => setMetric('bookings')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${vkey === 'bookings' ? 'bg-white text-zinc-900 dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 dark:text-white/40'}`}
                  >Foglalások</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={filteredDays} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sheet-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0099ff" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0099ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={vkey === 'revenue' ? fmtRevAxis : undefined} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                          <p className="text-zinc-400 dark:text-white/40 mb-0.5">{label}</p>
                          <p className="font-black">{vkey === 'revenue' ? fmtRev(Number(payload[0].value)) : `${payload[0].value} foglalás`}</p>
                        </div>
                      )
                    }}
                  />
                  <Area type="monotone" dataKey={vkey} stroke="#0099ff" strokeWidth={2} fill="url(#sheet-grad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {kind === 'kpi' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">Időszaki átlag</p>
                <p className="text-lg font-black text-zinc-900 dark:text-white">{vkey === 'revenue' ? formatPrice(Math.round(avgRevenue), 'HUF') : avgBookings.toFixed(1)}</p>
                <p className="text-xs text-zinc-400 dark:text-white/30 mt-0.5">naponta</p>
              </div>
              <div className="rounded-xl p-3.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">Átl. foglalás értéke</p>
                <p className="text-lg font-black text-zinc-900 dark:text-white">{formatPrice(Math.round(avgBookingValue), 'HUF')}</p>
                <p className="text-xs text-zinc-400 dark:text-white/30 mt-0.5">foglalásonként</p>
              </div>
            </div>
          )}

          {kind === 'dow' && (
            <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.06] p-4">
              <h3 className="text-sm font-bold text-zinc-700 dark:text-white/80 mb-3">Foglalások a hét napjai szerint</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dowAgg} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', radius: 6 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                          <p className="font-black">{payload[0].value} foglalás</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="bookings" fill="#0099ff" radius={[6, 6, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {kind === 'hour' && (
            <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.06] p-4">
              <h3 className="text-sm font-bold text-zinc-700 dark:text-white/80 mb-1">Óránkénti forgalom · napi átlag</h3>
              <p className="text-[11px] text-zinc-400 dark:text-white/30 mb-3">
                {PERIODS.find(p => p.value === innerPeriod)?.label ?? `${innerPeriod} nap`}
                {dayFilter === 'weekday' ? ' · hétköznap' : dayFilter === 'weekend' ? ' · hétvége' : ''}
                {` · ${filteredDays.length} nap átlaga`}
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', radius: 6 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                          <p className="text-zinc-400 dark:text-white/40 mb-0.5">{label}</p>
                          <p className="font-black">{Math.round(Number(payload[0].value) * 10) / 10} foglalás / nap</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="bookings" fill="#a855f7" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Csúcsok */}
          {kind !== 'hour' && best && worst && best.date !== worst.date && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Legjobb nap</p>
                </div>
                <p className="text-sm font-black text-zinc-900 dark:text-white">{best.label}</p>
                <p className="text-xs text-zinc-500 dark:text-white/50 mt-0.5">
                  {vkey === 'revenue' ? formatPrice(best.revenue, 'HUF') : `${best.bookings} foglalás`}
                </p>
              </div>
              <div className="rounded-xl p-3.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="h-3 w-3 text-zinc-400 dark:text-white/40" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">Leggyengébb nap</p>
                </div>
                <p className="text-sm font-black text-zinc-900 dark:text-white">{worst.label}</p>
                <p className="text-xs text-zinc-500 dark:text-white/50 mt-0.5">
                  {vkey === 'revenue' ? formatPrice(worst.revenue, 'HUF') : `${worst.bookings} foglalás`}
                </p>
              </div>
            </div>
          )}
          </>
          )}

          {kind === 'service' && (
            <ServiceStaffList items={(props as Extract<Props, { kind: 'service' }>).data.map(s => ({ name: s.name, revenue: s.revenue, bookings: s.bookings }))} color="#0099ff" sortKey="revenue" />
          )}

          {kind === 'staff' && (
            <ServiceStaffList items={(props as Extract<Props, { kind: 'staff' }>).data.map(s => ({ name: s.name, revenue: s.revenue, bookings: s.bookings }))} color="#00bb88" sortKey="bookings" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

type ListItem = { name: string; revenue: number; bookings: number }

function ServiceStaffList({ items, color, sortKey }: { items: ListItem[]; color: string; sortKey: 'revenue' | 'bookings' }) {
  const [sort, setSort] = useState<'revenue' | 'bookings'>(sortKey)
  const sorted = [...items].sort((a, b) => b[sort] - a[sort])
  const max = Math.max(1, ...sorted.map(s => s[sort]))
  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0)
  const totalBookings = items.reduce((s, i) => s + i.bookings, 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">Összesen</p>
          <p className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">{items.length}</p>
        </div>
        <div className="rounded-xl p-3.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">{sort === 'revenue' ? 'Össz bevétel' : 'Össz foglalás'}</p>
          <p className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">{sort === 'revenue' ? formatPrice(totalRevenue, 'HUF') : totalBookings}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-zinc-700 dark:text-white/80">Rangsor</h3>
          <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] rounded-lg p-0.5">
            <button onClick={() => setSort('revenue')} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${sort === 'revenue' ? 'bg-white text-zinc-900 dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 dark:text-white/40'}`}>Bevétel</button>
            <button onClick={() => setSort('bookings')} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${sort === 'bookings' ? 'bg-white text-zinc-900 dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 dark:text-white/40'}`}>Foglalás</button>
          </div>
        </div>
        <div className="space-y-3">
          {sorted.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-white/70 truncate pr-2">
                  <span className="text-zinc-400 dark:text-white/30 font-mono mr-2">#{i + 1}</span>{item.name}
                </span>
                <span className="text-xs font-black text-zinc-900 dark:text-white shrink-0">
                  {sort === 'revenue' ? formatPrice(item.revenue, 'HUF') : `${item.bookings} foglalás`}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${(item[sort] / max) * 100}%`, background: color }} />
              </div>
              <p className="text-xs text-zinc-400 dark:text-white/30 mt-1">
                {sort === 'revenue' ? `${item.bookings} foglalás` : formatPrice(item.revenue, 'HUF')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
