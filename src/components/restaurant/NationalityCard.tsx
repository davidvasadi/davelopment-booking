'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowUpRight, Users } from 'lucide-react'
import { COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]))

type TopCountry = { code: string; count: number }
type NationalityRaw = { date: string; country: string; pax: number }

const PERIODS = [
  { value: 7, label: '7 nap' },
  { value: 30, label: '30 nap' },
  { value: 90, label: '90 nap' },
  { value: 180, label: '6 hónap' },
  { value: 365, label: '1 év' },
]

/** Nyers adatból belföldi/külföldi összesítés + MINDEN ország rangsora (HU is, az élén). */
function aggregate(raw: NationalityRaw[]): { domestic: number; foreign: number; ranking: TopCountry[] } {
  let domestic = 0
  let foreign = 0
  const counts: Record<string, number> = {}
  for (const r of raw) {
    const code = !r.country ? 'HU' : r.country
    const p = r.pax ?? 0 // létszám-alapú
    if (code === 'HU') domestic += p
    else foreign += p
    counts[code] = (counts[code] ?? 0) + p
  }
  // Minden ország (HU is) darabszám szerint csökkenő rangsorban.
  const ranking = Object.entries(counts).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count)
  return { domestic, foreign, ranking }
}

/**
 * A nemzetiség-bontás megjelenítése: belföldi/külföldi összegző sáv + MINDEN ország
 * (a magyart is beleértve) rangsora aránnyal. Reszponzív: a sávok mobilon is olvashatók.
 */
function Breakdown({ domestic, foreign, ranking }: { domestic: number; foreign: number; ranking: TopCountry[] }) {
  const total = domestic + foreign
  const domesticPct = total > 0 ? Math.round((domestic / total) * 100) : 0
  const foreignPct = total > 0 ? 100 - domesticPct : 0

  // A sávok mount után 0-ról a tényleges szélességre nőnek (mint a többi grafikon).
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (total === 0) {
    return <p className="text-sm text-zinc-400 dark:text-white/30 text-center py-4">Még nincs adat ehhez az időszakhoz.</p>
  }
  const maxCount = Math.max(1, ...ranking.map((c) => c.count))
  return (
    <>
      {/* Összegző sáv: belföldi vs külföldi */}
      <div className="flex h-8 w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-white/[0.05] mb-2.5">
        {domestic > 0 && (
          <div className="flex items-center justify-center bg-orange-600 text-[11px] font-bold text-amber-950 transition-[width] duration-1000 ease-out" style={{ width: grown ? `${domesticPct}%` : '0%' }}>
            {domesticPct >= 14 && `${domesticPct}%`}
          </div>
        )}
        {foreign > 0 && (
          <div className="flex items-center justify-center bg-orange-300 text-[11px] font-bold text-amber-800 transition-[width] duration-1000 ease-out" style={{ width: grown ? `${foreignPct}%` : '0%' }}>
            {foreignPct >= 14 && `${foreignPct}%`}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-white/50 mb-5">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-600" />
          Belföldi · <span className="font-bold text-zinc-700 dark:text-white/70">{domesticPct}%</span>
          <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{domestic}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-300" />
          Külföldi · <span className="font-bold text-zinc-700 dark:text-white/70">{foreignPct}%</span>
          <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{foreign}</span>
        </span>
      </div>

      {/* Teljes ország-rangsor (a magyar is) — az összes vendéghez viszonyított aránnyal */}
      <div className="border-t border-zinc-100 dark:border-white/[0.06] pt-4 space-y-2.5">
        {ranking.map((c) => {
          const isHU = c.code === 'HU'
          const pct = total > 0 ? Math.round((c.count / total) * 100) : 0
          return (
            <div key={c.code} className="flex items-center gap-2.5 sm:gap-3">
              <span className="w-24 sm:w-32 shrink-0 text-sm font-medium text-zinc-700 dark:text-white/70 truncate">
                {BY_CODE[c.code]?.name ?? c.code}
              </span>
              <div className="flex-1 min-w-0 h-5 rounded-md bg-zinc-100 dark:bg-white/[0.05] overflow-hidden">
                <div
                  className={`h-full rounded-md transition-[width] duration-1000 ease-out ${isHU ? 'bg-orange-600' : 'bg-orange-300'}`}
                  style={{ width: grown ? `${Math.max(6, (c.count / maxCount) * 100)}%` : '0%' }}
                />
              </div>
              <span className="flex w-16 sm:w-24 shrink-0 items-center justify-end gap-1 text-[11px] sm:text-xs tabular-nums text-zinc-400 dark:text-white/30">
                <span className="font-bold text-zinc-600 dark:text-white/50">{pct}%</span>
                <span className="hidden sm:inline-flex items-center gap-0.5">· <Users className="h-3 w-3" />{c.count}</span>
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

/**
 * Nemzetiség-bontás kártya + „Részletek" sidebar. A kártya az aktuális időszak adatát
 * mutatja; a sidebarban időszak-választóval a `nationalityRaw`-ból újraszámolódik.
 */
export function NationalityCard({
  domesticCount,
  foreignCount,
  topCountries,
  nationalityRaw,
  periodLabel,
}: {
  domesticCount: number
  foreignCount: number
  topCountries: TopCountry[]
  nationalityRaw: NationalityRaw[]
  periodLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [innerPeriod, setInnerPeriod] = useState(30)

  const filtered = useMemo(() => {
    const today = new Date()
    const from = new Date(today.getTime() - (innerPeriod - 1) * 86_400_000)
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const fromStr = ymd(from)
    return nationalityRaw.filter((d) => d.date >= fromStr)
  }, [nationalityRaw, innerPeriod])

  const agg = useMemo(() => aggregate(filtered), [filtered])

  return (
    <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Elmúlt {periodLabel}</p>
          <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Vendégek nemzetisége</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60 transition-colors shrink-0"
        >
          <span className="hidden sm:inline">Részletek</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <Breakdown
        domestic={domesticCount}
        foreign={foreignCount}
        ranking={[
          ...(domesticCount > 0 ? [{ code: 'HU', count: domesticCount }] : []),
          ...topCountries,
        ].sort((a, b) => b.count - a.count)}
      />

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-zinc-950">
          <SheetHeader className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-0.5">Részletek</p>
            <SheetTitle className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Vendégek nemzetisége</SheetTitle>
          </SheetHeader>

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

          <div className="rounded-2xl border border-zinc-100 dark:border-white/[0.06] p-5">
            <Breakdown domestic={agg.domestic} foreign={agg.foreign} ranking={agg.ranking} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
