'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type DwellRaw = { date: string; pax: number; minutes: number }
type DwellGroup = { group: string; avgMinutes: number; count: number }

const PERIODS = [
  { value: 7, label: '7 nap' },
  { value: 30, label: '30 nap' },
  { value: 90, label: '90 nap' },
  { value: 180, label: '6 hónap' },
  { value: 365, label: '1 év' },
]

/** Létszám → csoport-címke (egyezik a szerveri avgDwell csoportokkal). */
function groupOf(pax: number): string {
  if (pax <= 2) return '1–2 fő'
  if (pax <= 4) return '3–4 fő'
  return '5+ fő'
}
const GROUP_ORDER = ['1–2 fő', '3–4 fő', '5+ fő']

function fmtDuration(min: number): string {
  if (min <= 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} p`
  if (m === 0) return `${h} ó`
  return `${h} ó ${m} p`
}

/** Egy adott nyers dwell-halmazból csoportonkénti átlag + összesített átlag. */
function aggregate(raw: DwellRaw[]): { groups: DwellGroup[]; overall: number } {
  const groups = GROUP_ORDER.map((group) => {
    const rs = raw.filter((d) => groupOf(d.pax) === group)
    const total = rs.reduce((s, d) => s + d.minutes, 0)
    return { group, avgMinutes: rs.length ? Math.round(total / rs.length) : 0, count: rs.length }
  })
  const total = raw.reduce((s, d) => s + d.minutes, 0)
  return { groups, overall: raw.length ? Math.round(total / raw.length) : 0 }
}

function Bars({ groups }: { groups: DwellGroup[] }) {
  const maxAvg = Math.max(1, ...groups.map((g) => g.avgMinutes))
  // A sávok mount után 0-ról a tényleges szélességre nőnek (mint a recharts bar-ok).
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div className="space-y-3">
      {groups.map((d) => {
        const targetWidth = d.count > 0 ? `${Math.max(12, (d.avgMinutes / maxAvg) * 100)}%` : '0%'
        return (
          <div key={d.group} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-sm font-semibold text-zinc-700 dark:text-white/70 tabular-nums">{d.group}</span>
            <div className="flex-1 h-7 rounded-lg bg-zinc-100 dark:bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-lg bg-amber-400/90 flex items-center justify-end px-2 transition-[width] duration-1000 ease-out"
                style={{ width: grown ? targetWidth : '0%' }}
              >
                {d.count > 0 && <span className="text-[11px] font-bold text-amber-950 tabular-nums">{fmtDuration(d.avgMinutes)}</span>}
              </div>
            </div>
            <span className="w-14 shrink-0 text-right text-[11px] text-zinc-400 dark:text-white/30 tabular-nums">
              {d.count > 0 ? `${d.count} db` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Átlagos foglalási idő kártya + „Részletek" sidebar. A kártya a szerver által számolt
 * (aktuális időszak) adatot mutatja; a sidebarban időszak-választóval a `dwellRaw`-ból
 * újraszámolódik az átlag és a csoportbontás.
 */
export function DwellCard({
  avgDwell,
  avgDwellOverall,
  dwellRaw,
  periodLabel,
  embedded = false,
}: {
  avgDwell: DwellGroup[]
  avgDwellOverall: number
  dwellRaw: DwellRaw[]
  periodLabel: string
  embedded?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [innerPeriod, setInnerPeriod] = useState(30)

  // A sidebar a kiválasztott időszakra szűri a nyers adatot (mától visszafelé innerPeriod nap).
  const filtered = useMemo(() => {
    const today = new Date()
    const from = new Date(today.getTime() - (innerPeriod - 1) * 86_400_000)
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const fromStr = ymd(from)
    return dwellRaw.filter((d) => d.date >= fromStr)
  }, [dwellRaw, innerPeriod])

  const agg = useMemo(() => aggregate(filtered), [filtered])

  return (
    <div className={embedded ? '' : 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6'}>
      {!embedded && (
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Elmúlt {periodLabel}</p>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Átlagos foglalási idő</h3>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{fmtDuration(avgDwellOverall)}</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60 transition-colors"
            >
              <span className="hidden sm:inline">Részletek</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      {!embedded && <p className="text-xs text-zinc-400 dark:text-white/30 mb-5">A befejezett foglalások tényleges hossza alapján (mennyi ideig foglalt egy asztal).</p>}
      <Bars groups={avgDwell} />

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-950">
          <SheetHeader className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-0.5">Részletek</p>
            <SheetTitle className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Átlagos foglalási idő</SheetTitle>
          </SheetHeader>

          {/* Időszak-választó */}
          <div className="flex flex-wrap gap-2 mb-6">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setInnerPeriod(p.value)}
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

          {/* Összesített + csoportbontás a szűrt időszakra */}
          <div className="rounded-2xl p-5 bg-gradient-to-br from-zinc-50 to-white dark:from-white/[0.04] dark:to-transparent border border-zinc-100 dark:border-white/[0.08] mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-2">Átlagos idő ({PERIODS.find(p => p.value === innerPeriod)?.label})</p>
            <p className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-1">{fmtDuration(agg.overall)}</p>
            <p className="text-xs text-zinc-400 dark:text-white/30">{filtered.length} befejezett foglalásból</p>
          </div>

          <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.06] p-4">
            <h4 className="text-sm font-bold text-zinc-700 dark:text-white/80 mb-3">Létszám szerint</h4>
            {filtered.length > 0
              ? <Bars groups={agg.groups} />
              : <p className="text-sm text-zinc-400 dark:text-white/30 text-center py-4">Nincs befejezett foglalás ebben az időszakban.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
