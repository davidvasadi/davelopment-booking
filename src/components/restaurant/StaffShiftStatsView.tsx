'use client'

import { useRef, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { formatPrice } from '@/lib/utils'
import type { MyShiftStats } from '@/lib/myShiftStats'
import { WeekMiniBars, WeekDayLabels, TrendLineChart, type WeekBar, type SeriesPoint } from '@/components/shared/OverviewCharts'
import { PageHeader } from '@/components/ui/page-header'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import type { ReactNode } from 'react'

/** Lazán tipizált recharts-tooltip payload (verzió-független) — az AnalyticsOverview mintája. */
type TipEntry = { value?: number; payload?: Record<string, unknown> }
type TipProps = { active?: boolean; payload?: TipEntry[] }

const DOW_SHORT3: Record<string, string> = {
  'Hétfő': 'Hét', 'Kedd': 'Ked', 'Szerda': 'Sze', 'Csütörtök': 'Csü', 'Péntek': 'Pén', 'Szombat': 'Szo', 'Vasárnap': 'Vas',
}
const DOW_ROWS = ['Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas']

/** Fehér/sötét pill-tooltip a donutokhoz — az AnalyticsOverview `DonutTip`-jének mintája. */
function DonutTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const pp = p.payload as { color?: string; label?: string; name?: string } | undefined
  return (
    <div className="rounded-[12px] bg-[#1D1C19] px-3 py-2 text-xs text-white shadow-dav-card ring-1 ring-white/15">
      <p className="flex items-center gap-1.5 font-semibold">
        <span className="h-2 w-2 rounded-full" style={{ background: pp?.color ?? '#F1CE45' }} />
        {pp?.label ?? pp?.name}
      </p>
      {typeof p.value === 'number' && <p className="mt-0.5 text-white/70">{Math.round(p.value)}%</p>}
    </div>
  )
}

/**
 * Saját "Statisztika" nézet éttermi tagoknak, akiknek nincs `analytics.view`-juk (csak
 * `.view.own`) — SAJÁT, a céges Statisztikák oldaltól (`AnalyticsOverview`) FÜGGETLEN
 * komponens, de UGYANAZT a bento-elrendezést követi (col1: sötét donut + Bontások lista ·
 * col2: 2 grafikon-kártya felül + nagy trend alul · col3: hőtérkép + összetétel-donut), hogy a
 * két nézet vizuálisan egységes maradjon. Itt nincs bevétel/foglalás (az étteremben a foglalás
 * asztalhoz, nem felszolgálóhoz kötött) — a valós saját adat a beosztás.
 */
export function StaffShiftStatsView({ stats, filter }: { stats: MyShiftStats; filter?: ReactNode }) {
  const dowBars: WeekBar[] = stats.byDayOfWeek.map((d) => ({ label: DOW_SHORT3[d.day] ?? d.day, value: d.hours }))
  const dowMax = Math.max(1, ...dowBars.map((b) => b.value))
  const dowBarsPeaked = dowBars.map((b) => ({ ...b, peak: b.value === dowMax && b.value > 0 }))

  // Heti bontású sorozatok a Bontások kattintható soraihoz + a nagy trend-kártyához — a
  // HISTORIKUS `trend` (napi adat, a kiválasztott periódusra) hétfőn kezdődő hetekbe gyűjtve.
  // FONTOS: ez FÜGGETLEN a `stats.heatmap`-től — az utóbbi szándékosan ELŐRETEKINTŐ (a jövőbeli
  // beosztás, lásd "Mikor dolgozom"), a hetekre bontásnál viszont a MÚLTBELI adatokat kell
  // összesíteni.
  const weekBuckets = (() => {
    const map = new Map<string, { label: string; hours: number; workedDays: number; leaveDays: number; sickDays: number }>()
    for (const d of stats.trend) {
      const date = new Date(d.date + 'T00:00:00')
      const dow = (date.getDay() + 6) % 7
      date.setDate(date.getDate() - dow)
      const key = format(date, 'yyyy-MM-dd')
      const b = map.get(key) ?? { label: format(date, 'MMM d.', { locale: hu }), hours: 0, workedDays: 0, leaveDays: 0, sickDays: 0 }
      b.hours += d.hours
      if (d.hours > 0) b.workedDays += 1
      b.leaveDays += d.leave
      b.sickDays += d.sick
      map.set(key, b)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, b]) => b)
  })()

  const weeklySeries = {
    hours: weekBuckets.map((b) => ({ label: b.label, value: Math.round(b.hours * 10) / 10 })) as SeriesPoint[],
    days: weekBuckets.map((b) => ({ label: b.label, value: b.workedDays })) as SeriesPoint[],
    ratio: weekBuckets.map((b) => ({ label: b.label, value: Math.round((b.workedDays / 7) * 100) })) as SeriesPoint[],
    avg: weekBuckets.map((b) => ({ label: b.label, value: b.workedDays > 0 ? Math.round((b.hours / b.workedDays) * 10) / 10 : 0 })) as SeriesPoint[],
    leave: weekBuckets.map((b) => ({ label: b.label, value: b.leaveDays })) as SeriesPoint[],
    sick: weekBuckets.map((b) => ({ label: b.label, value: b.sickDays })) as SeriesPoint[],
  }

  const totalDaysForBar = Math.max(1, stats.workedDays + stats.leaveDays + stats.sickDays)
  const workedPct = Math.round((stats.workedDays / totalDaysForBar) * 100)
  const leavePct = Math.round((stats.leaveDays / totalDaysForBar) * 100)
  const sickPct = Math.max(0, 100 - workedPct - leavePct)
  // Munkanap-arány a Bontásoknál/összetétel-donutnál: a nevező a TELJES periódus (nem csak az
  // elszámolt napok) — az alapértelmezés, hogy akire nincs beosztva műszak, az szabadnapon van.
  const workVsFreePct = Math.round((stats.workedDays / Math.max(1, stats.period)) * 100)

  const statusSegs = [
    { label: 'Ledolgozva', pct: workedPct, value: stats.workedDays, suffix: ' nap', background: '#1D1C19', color: '#fff' },
    { label: 'Szabadság', pct: leavePct, value: stats.leaveDays, suffix: ' nap', background: '#F1CE45', color: '#1D1C19' },
    { label: 'Beteg', pct: sickPct, value: stats.sickDays, suffix: ' nap', background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)' },
  ]

  // Kattintható Bontások-sorok — csak azoknál, amikhez van értelmes HETI sorozat (lásd
  // `weeklySeries`), így a nagy trend-kártya tényleg tud rájuk váltani. A Kereset (bér+borravaló)
  // nem heti bontású, ezért statikus marad.
  const trendOptions: Record<string, { label: string; value: string; deltaPct?: number; series: SeriesPoint[] }> = {
    hours: { label: 'Ledolgozott órák', value: `${stats.periodHours} óra`, deltaPct: stats.periodHoursDiff, series: weeklySeries.hours },
    days: { label: 'Ledolgozott napok', value: `${stats.workedDays} nap`, deltaPct: stats.workedDaysDiff, series: weeklySeries.days },
    ratio: { label: 'Munkanap-arány', value: `${workVsFreePct}%`, series: weeklySeries.ratio },
    avg: { label: 'Átl. műszakhossz', value: `${stats.avgShiftHours} óra`, series: weeklySeries.avg },
    leave: { label: 'Szabadság', value: `${stats.leaveDays} nap`, series: weeklySeries.leave },
    sick: { label: 'Betegszabadság', value: `${stats.sickDays} nap`, series: weeklySeries.sick },
  }
  const TREND_IDS = ['hours', 'days', 'ratio', 'avg', 'leave', 'sick'] as const
  const [selectedId, setSelectedId] = useState<keyof typeof trendOptions>('hours')
  const selected = trendOptions[selectedId]
  const trendRef = useRef<HTMLDivElement>(null)
  // Mobilon a Bontások lista és a nagy trend-kártya a tördelt sorrendben messze kerül
  // egymástól — kattintáskor scroll-olunk hozzá, különben a váltás észrevétlen maradna.
  function selectTrend(id: keyof typeof trendOptions) {
    setSelectedId(id)
    trendRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  // A kártya szélén lévő 2 nyíl helyben lépteti a mutatót — nem kell a Bontásokig görgetni.
  function stepTrend(dir: 1 | -1) {
    const i = TREND_IDS.indexOf(selectedId as (typeof TREND_IDS)[number])
    const next = TREND_IDS[(i + dir + TREND_IDS.length) % TREND_IDS.length]
    setSelectedId(next)
  }

  const earningsHuf = (stats.wageHuf ?? 0) + (stats.tipHuf ?? 0)
  const breakdownRows: { id?: keyof typeof trendOptions; label: string; value: string }[] = [
    { id: 'hours', label: trendOptions.hours.label, value: trendOptions.hours.value },
    { id: 'days', label: trendOptions.days.label, value: trendOptions.days.value },
    { id: 'ratio', label: trendOptions.ratio.label, value: trendOptions.ratio.value },
    { id: 'avg', label: trendOptions.avg.label, value: trendOptions.avg.value },
    { id: 'leave', label: trendOptions.leave.label, value: trendOptions.leave.value },
    { id: 'sick', label: trendOptions.sick.label, value: trendOptions.sick.value },
    ...((stats.wageHuf != null || stats.tipHuf != null) ? [{
      label: stats.payLabel ? `Kereset (becsült, ${stats.payLabel})` : 'Kereset',
      value: formatPrice(earningsHuf, 'HUF'),
    }] : []),
  ]

  return (
    <div className="p-5 lg:p-0 space-y-6">
      <PageHeader
        eyebrow="Saját nézet"
        title="Saját statisztika"
        description="Tekintsd meg a ledolgozott napjaidat, óráidat, szabadságodat és a beosztásoddal kapcsolatos adataidat egy helyen."
        action={filter}
      />

      <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <StatusPills eager className="flex-1 lg:max-w-[760px]" segments={statusSegs} minSegmentWidth={88} />
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          <CountUpKpi icon="clock" value={stats.periodHours} label="Ledolgozott óra" suffix=" óra" decimals={1} />
          <CountUpKpi icon="gauge" value={stats.avgShiftHours} label="Átl. műszakhossz" suffix=" óra" decimals={1} />
          <CountUpKpi icon="calendar" value={stats.upcomingShiftsCount} label="Közelgő műszak" />
        </div>
      </div>

      {/* Ugyanaz a bento-rács, mint a céges Statisztikák oldalon: col1 = sötét donut + Bontások ·
          col2 = 2 grafikon-kártya felül + nagy trend alul · col3 = hőtérkép + összetétel-donut. */}
      <div className="grid grid-cols-1 gap-[5px] lg:grid-cols-[280px_minmax(0,1fr)_312px]">
        <div className="contents lg:flex lg:flex-col lg:gap-[5px] lg:row-span-2">
          <EarningsDonutCard tipHuf={stats.tipHuf} wageHuf={stats.wageHuf} />
          <div className="order-6 lg:order-none flex flex-col rounded-[26px] dav-card-glass p-4 lg:p-5">
            <div className="mb-3 text-[19px] font-medium text-[#22221e]">Bontások</div>
            {/* Fix felső korlát + belső görgetés — enélkül a lista magassága a CSS grid során
                keresztül a szomszédos (col2/col3) kártyákat is odébb tolná/átméretezné, ahogy az
                AnalyticsOverview eredeti Bontások-listájánál is (lásd ottani komment). */}
            <div className="flex max-h-[420px] flex-col overflow-y-auto" data-lenis-prevent>
              {breakdownRows.map((r, i) => {
                const border = i < breakdownRows.length - 1 ? 'border-b border-[#efebdf]' : ''
                const isSelected = r.id !== undefined && r.id === selectedId
                if (!r.id) {
                  return (
                    <div key={r.label} className={`flex items-center justify-between py-3.5 ${border}`}>
                      <span className="min-w-0 truncate text-[15px] font-medium text-[#3a352a]">{r.label}</span>
                      <span className="shrink-0 text-sm font-medium text-ink-soft tabular-nums">{r.value}</span>
                    </div>
                  )
                }
                return (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => selectTrend(r.id as keyof typeof trendOptions)}
                    className={`flex w-full items-center justify-between gap-2 py-3.5 text-left transition-colors ${border}`}
                  >
                    <span className={`min-w-0 truncate text-[15px] ${isSelected ? 'font-semibold text-ink' : 'font-medium text-[#3a352a]'}`}>{r.label}</span>
                    <span className="flex shrink-0 items-center gap-2.5">
                      <span className="text-sm font-medium text-ink-soft tabular-nums">{r.value}</span>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${isSelected ? 'bg-gold' : 'bg-transparent'}`} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="order-3 lg:order-none grid grid-cols-1 gap-[5px] sm:grid-cols-2">
          <div className="flex min-h-[212px] flex-col rounded-[26px] dav-card-glass p-4 lg:p-5">
            <span className="mb-2 text-[17px] font-medium text-ink">Heti eloszlás</span>
            <div className="flex flex-1 flex-col justify-end">
              <WeekMiniBars bars={dowBarsPeaked} weekMax={dowMax} unit="óra" />
              <WeekDayLabels bars={dowBarsPeaked} />
            </div>
          </div>
          <div className="flex min-h-[212px] flex-col rounded-[26px] dav-card-glass p-4 lg:p-5">
            <span className="text-[17px] font-medium text-ink">Következő műszakjaid</span>
            {/* NEM egy újabb Ledolgozva/Szabadság/Beteg-diagram — konkrét, előretekintő lista a
                beütemezett műszakokról (dátum + időpont), amit sehol máshol nem mutat az oldal. */}
            {stats.upcomingShifts.length > 0 ? (
              <div className="mt-2 flex flex-col divide-y divide-[#efebdf]">
                {stats.upcomingShifts.map((s) => (
                  <div key={s.date} className="flex items-center gap-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-line bg-[var(--dav-glass-strong)]">
                      <CalendarDays className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
                    </span>
                    {/* Dátum és időpont EGYMÁS ALATT (nem egy sorban) — így keskeny kártyánál/
                        mobilon sosem versengenek ugyanazért a vízszintes helyért, nincs
                        túlcsordulás. */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-[#3a352a] capitalize">{s.label}</div>
                      <div className="text-xs font-medium text-ink-soft tabular-nums">
                        {s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center text-sm text-ink-soft">Nincs beütemezett közelgő műszakod.</div>
            )}
          </div>
        </div>

        <div className="order-4 lg:order-none lg:contents">
          <HeatmapCalendarCard heatmap={stats.heatmap} />
        </div>

        <div ref={trendRef} className="order-2 lg:order-none flex min-w-0 scroll-mt-5 flex-col rounded-[26px] dav-card-glass p-4 lg:p-5">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="text-[19px] font-medium text-ink truncate">{selected.label}</div>
                {selected.deltaPct !== undefined && (
                  <span className="flex items-center gap-3.5">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft2">
                      <span className="h-2 w-2 rounded-full" style={{ background: '#F1CE45' }} />Aktuális
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft2">
                      <span className="h-2 w-2 rounded-full" style={{ background: '#1D1C19' }} />Előző
                    </span>
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <p className="text-3xl lg:text-[30px] font-light tracking-[-0.02em] text-ink">{selected.value}</p>
                {selected.deltaPct !== undefined && <DeltaText pct={selected.deltaPct} />}
              </div>
            </div>
            {/* 2 nyíl a kártya szélén — helyben lépteti a mutatót, nem kell a Bontásokig görgetni. */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => stepTrend(-1)} aria-label="Előző mutató" className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-[var(--dav-glass-strong)] text-ink-soft transition-colors hover:text-ink">
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <button type="button" onClick={() => stepTrend(1)} aria-label="Következő mutató" className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-[var(--dav-glass-strong)] text-ink-soft transition-colors hover:text-ink">
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
          {/* Heti bontású (nem napi) sorozat — a napi adat 0-ák közti hirtelen tüskékben fut
              (dolgozott/nem dolgozott), ami "gagyi" tördelt görbét adott; hetente összesítve
              kevesebb, de értelmesebben elkülönülő pont lesz, valódi trend-jelleggel. A
              Bontások soraira kattintva ez a kártya vált a kiválasztott mutatóra. */}
          <div key={selectedId} className="relative mt-3 w-full" style={{ height: 192 }}>
            <TrendLineChart series={selected.series} deltaPct={selected.deltaPct} />
          </div>
        </div>

        <div className="order-5 lg:order-none lg:contents">
          <CompositionDonutCard pct={workVsFreePct} label="Munkanap-arány" />
        </div>
      </div>
    </div>
  )
}

function DeltaText({ pct }: { pct: number }) {
  const cls = pct > 0 ? 'text-[#1D9D63]' : pct < 0 ? 'text-bad' : 'text-ink-soft'
  return <span className={`text-xs font-semibold ${cls}`}>{pct > 0 ? '+' : ''}{pct}%</span>
}

/** Sötét "Kereset" donut + legenda kártya — az AnalyticsOverview col1 fejkártyájának mintáját
 *  követi. SZÁNDÉKOSAN nem a nap-összetételt (Ledolgozva/Szabadság/Beteg) ismétli meg — azt már
 *  a felső StatusPills csík ÉS a Bontások lista is mutatja —, hanem bér/borravaló megoszlást. */
function EarningsDonutCard({ tipHuf, wageHuf }: { tipHuf: number | null; wageHuf: number | null }) {
  const hasData = (wageHuf ?? 0) > 0 || (tipHuf ?? 0) > 0
  const COLORS = ['#F1CE45', '#C9A24B']
  const total = Math.max(1, (wageHuf ?? 0) + (tipHuf ?? 0))
  const segs = [
    { label: 'Bér', value: formatPrice(wageHuf ?? 0, 'HUF'), pct: Math.round(((wageHuf ?? 0) / total) * 100), color: COLORS[0] },
    { label: 'Borravaló', value: formatPrice(tipHuf ?? 0, 'HUF'), pct: Math.round(((tipHuf ?? 0) / total) * 100), color: COLORS[1] },
  ]
  return (
    <div className="order-1 lg:order-none flex flex-col rounded-[26px] bg-ink-dark p-6 text-white shadow-dav-card">
      <div className="text-xs font-medium text-white/55">Kereset</div>
      {hasData ? (
        <>
          <div className="mx-auto mt-4 h-[104px] w-[104px] shrink-0">
            <ResponsiveContainer width="100%" height="100%" debounce={50} initialDimension={{ width: 104, height: 104 }}>
              <PieChart>
                <Pie data={segs} dataKey="pct" nameKey="label" cx="50%" cy="50%" innerRadius={30} outerRadius={50} startAngle={90} endAngle={-270} paddingAngle={2} cornerRadius={6} stroke="none" isAnimationActive animationDuration={800}>
                  {segs.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip content={<DonutTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-3">
            {segs.map((seg) => (
              <div key={seg.label} className="flex flex-col items-center gap-1 text-center">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: seg.color }} />
                  <span className="truncate text-[12px] text-white/70">{seg.label}</span>
                </span>
                <span className="text-[14px] font-semibold tabular-nums">{seg.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 flex-1 text-[13px] leading-snug text-white/50">Nincs bér/borravaló adat beállítva ehhez a beosztáshoz.</div>
      )}
    </div>
  )
}

/** Világos "· összetétel" telítettség-gyűrű kártya — az AnalyticsOverview `CompositionDonut`
 *  mintáját követi (sötét track + gold ív, közép a % + label, alatta 2 legend-sor). */
function CompositionDonutCard({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const rest = 100 - clamped
  const TRACK = '#33322e'
  const data = [
    { name: 'Munkanap', pct: clamped, color: '#F1CE45' },
    { name: 'Szabadnap', pct: rest, color: TRACK },
  ]
  return (
    <div className="rounded-[26px] dav-card-glass p-5 lg:p-6 flex flex-col h-full">
      <div className="mb-1 text-[19px] font-medium text-ink">{label} · összetétel</div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative my-3 h-[150px] w-[170px]">
          <ResponsiveContainer width="100%" height="100%" debounce={50} initialDimension={{ width: 170, height: 150 }}>
            <PieChart>
              <Pie data={data} dataKey="pct" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={68} startAngle={90} endAngle={-270} cornerRadius={6} stroke="none" isAnimationActive animationDuration={800}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<DonutTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div className="text-[32px] font-light tracking-[-0.02em] leading-none text-ink">{clamped}%</div>
            <div className="mt-1 max-w-[92px] truncate text-[10px] font-medium leading-tight text-ink-soft">{label}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-6">
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#F1CE45' }} />{clamped}%
            <span className="text-xs font-medium text-ink-soft">munkanap</span>
          </span>
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TRACK }} />{rest}%
            <span className="text-xs font-medium text-ink-soft">szabadnap</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** "Mikor dolgozom" — VALÓDI naptár-elrendezés: a hetek a SOROK (fentről lefelé, mint egy fali-
 *  naptár), a napok (Hét..Vas) az OSZLOPOK — ellentétben a GitHub-stílusú "contribution graph"-
 *  fal-elrendezéssel (ahol a hetek lennének az oszlopok), ez sokkal olvashatóbb naptárként és a
 *  7 fix oszlop egyenletesen kitölti a kártya szélességét, függetlenül a hetek számától. Minden
 *  cellában a hónap napja — sárga = dolgozott, sötét = nem. */
function HeatmapCalendarCard({ heatmap }: { heatmap: MyShiftStats['heatmap'] }) {
  const { grid, dates, columnLabels: weekLabels } = heatmap
  // A rács NEM egy naptári hónap, hanem a kiválasztott időszakot lefedő, hétfőn kezdődő hetek —
  // ezért a periódus (nem hónap) elejét/végét írjuk ki, hogy egyértelmű legyen, mit takar (pl.
  // 30 nap gyakran két naptári hónap közé esik).
  const flatDates = dates.flat().filter((d): d is string => !!d).sort()
  const rangeLabel = flatDates.length > 0
    ? `${new Date(flatDates[0] + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })} – ${new Date(flatDates[flatDates.length - 1] + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}`
    : ''
  return (
    <div className="flex h-full flex-col rounded-[26px] bg-ink-dark p-5 text-white lg:p-6">
      <div className="text-[15px] font-medium text-white">Mikor dolgozom</div>
      {/* ELŐRETEKINTŐ (a beosztásod a mai héttől előre) — NEM a lenti historikus periódus, és
          NEM egy naptári hónap; ezért a tényleges dátum-tartomány van kiírva. */}
      <div className="mb-4 text-xs text-white/40">{rangeLabel ? `Beosztásod · ${rangeLabel}` : 'Beosztásod'}</div>
      {weekLabels.length > 0 ? (
        <>
          <div className="flex flex-1 flex-col justify-center gap-2">
            <div className="flex items-center gap-1.5 pl-12">
              {DOW_ROWS.map((d) => (
                <span key={d} className="flex-1 text-center text-[10px] font-medium text-white/40">{d}</span>
              ))}
            </div>
            <div className="flex flex-1 flex-col justify-between gap-1.5">
              {weekLabels.map((weekLabel, wi) => (
                <div key={wi} className="flex flex-1 items-stretch gap-1.5">
                  <span className="flex w-11 shrink-0 items-center text-[10px] font-medium text-white/40">{weekLabel}</span>
                  {DOW_ROWS.map((_, di) => {
                    const v = grid[di][wi]
                    const date = dates[di]?.[wi]
                    if (v === -1 || !date) return <span key={di} className="flex-1" />
                    const dayNum = Number(date.slice(8, 10))
                    const fullLabel = new Date(date + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
                    return (
                      <span key={di} className="flex flex-1 items-center justify-center">
                        <span
                          className="flex aspect-square w-full max-w-9 cursor-default items-center justify-center rounded-full text-[12px] font-semibold transition-transform duration-150 hover:scale-[1.1] hover:ring-2 hover:ring-white/60"
                          style={{ background: v === 1 ? '#F1CE45' : '#2c2b27', color: v === 1 ? '#1D1C19' : 'rgba(255,255,255,.5)' }}
                          title={`${fullLabel} · ${v === 1 ? 'Beosztva' : 'Nincs beosztva'}`}
                        >
                          {dayNum}
                        </span>
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-3 text-[10px] font-medium text-white/40">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#2c2b27' }} />Nincs beosztva</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#F1CE45' }} />Beosztva</span>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-white/50">Nincs adat a periódusra.</div>
      )}
    </div>
  )
}
