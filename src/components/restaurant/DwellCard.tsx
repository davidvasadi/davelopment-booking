'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/* davelopment chart-paletta. */
const C = { ink: '#1D1C19', accent: '#F1CE45' }

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
      {groups.map((d, i) => {
        const targetWidth = d.count > 0 ? `${Math.max(12, (d.avgMinutes / maxAvg) * 100)}%` : '0%'
        // A leghosszabb (peak) csoportot gold-dal emeljük ki, a többit ink.
        const peak = d.count > 0 && d.avgMinutes === maxAvg
        return (
          <div key={d.group} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-sm font-semibold text-ink-soft2 tabular-nums">{d.group}</span>
            <div className="flex-1 h-7 rounded-[10px] bg-[var(--dav-glass-strong)] border border-line overflow-hidden">
              <div
                className="h-full rounded-[10px] flex items-center justify-end px-2 transition-[width] duration-1000 ease-out"
                style={{ width: grown ? targetWidth : '0%', background: peak ? C.accent : C.ink }}
              >
                {d.count > 0 && <span className={`text-[11px] font-bold tabular-nums ${peak ? 'text-ink-dark' : 'text-white'}`}>{fmtDuration(d.avgMinutes)}</span>}
              </div>
            </div>
            <span className="w-14 shrink-0 text-right text-[11px] text-ink-soft tabular-nums">
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
    <div className={embedded ? '' : 'bg-[#fcfbf7] border border-line rounded-[26px] shadow-dav-card p-6'}>
      {!embedded && (
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">Elmúlt {periodLabel}</p>
            <h3 className="text-[19px] font-medium tracking-tight text-ink">Átlagos foglalási idő</h3>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-2xl font-light tracking-[-0.02em] text-ink">{fmtDuration(avgDwellOverall)}</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Részletek"
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink transition-transform hover:scale-105 active:scale-95"
            >
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
      {!embedded && <p className="text-xs text-ink-soft mb-5">A befejezett foglalások tényleges hossza alapján (mennyi ideig foglalt egy asztal).</p>}
      <Bars groups={avgDwell} />

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white">
          <SheetHeader className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-0.5">Részletek</p>
            <SheetTitle className="text-lg font-medium tracking-tight text-ink">Átlagos foglalási idő</SheetTitle>
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
                    ? 'bg-ink-dark text-white'
                    : 'bg-[var(--dav-glass-strong)] border border-line text-ink-soft2 hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Összesített + csoportbontás a szűrt időszakra */}
          <div className="rounded-[18px] p-5 bg-[var(--dav-glass)] border border-line mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-2">Átlagos idő ({PERIODS.find(p => p.value === innerPeriod)?.label})</p>
            <p className="text-4xl font-light tracking-[-0.02em] text-ink mb-1">{fmtDuration(agg.overall)}</p>
            <p className="text-xs text-ink-soft">{filtered.length} befejezett foglalásból</p>
          </div>

          <div className="rounded-[18px] border border-line p-4">
            <h4 className="text-sm font-semibold text-ink mb-3">Létszám szerint</h4>
            {filtered.length > 0
              ? <Bars groups={agg.groups} />
              : <p className="text-sm text-ink-soft text-center py-4">Nincs befejezett foglalás ebben az időszakban.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
