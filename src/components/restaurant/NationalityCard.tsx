'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowUpRight, Users } from 'lucide-react'
import { COUNTRIES } from '@/components/booking/PhoneCountryInput'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/* davelopment chart-paletta: belföldi = ink, külföldi = gold. */
const C = { ink: '#1D1C19', accent: '#F1CE45' }

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
    return <p className="text-sm text-ink-soft text-center py-4">Még nincs adat ehhez az időszakhoz.</p>
  }
  const maxCount = Math.max(1, ...ranking.map((c) => c.count))

  // „Employee Composition" donut: belföldi (ink) vs külföldi (gold), középen összlétszám.
  const R = 52, CIRC = 2 * Math.PI * R
  const inkLen = (domesticPct / 100) * CIRC
  const goldLen = (foreignPct / 100) * CIRC

  return (
    <>
      {/* Donut: belföldi/külföldi összetétel */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative">
          <svg width="160" height="140" viewBox="0 0 160 140">
            <circle cx="80" cy="72" r={R} fill="none" stroke={C.ink} strokeWidth="18" strokeDasharray={`${inkLen} ${CIRC}`} transform="rotate(-90 80 72)" strokeLinecap="round" />
            <circle cx="80" cy="72" r={R} fill="none" stroke={C.accent} strokeWidth="18" strokeDasharray={`${goldLen} ${CIRC}`} strokeDashoffset={-inkLen - 4} transform="rotate(-90 80 72)" strokeLinecap="round" />
          </svg>
          <div className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="text-[28px] font-light tracking-[-0.02em] leading-none text-ink">{total}</div>
            <div className="text-xs font-medium text-ink-soft mt-0.5">vendég</div>
          </div>
        </div>
      </div>

      {/* Összegző sáv: belföldi (ink) vs külföldi (gold) */}
      <div className="flex h-8 w-full overflow-hidden rounded-[10px] bg-[var(--dav-glass-strong)] border border-line mb-2.5">
        {domestic > 0 && (
          <div className="flex items-center justify-center text-[11px] font-bold text-white transition-[width] duration-1000 ease-out" style={{ width: grown ? `${domesticPct}%` : '0%', background: C.ink }}>
            {domesticPct >= 14 && `${domesticPct}%`}
          </div>
        )}
        {foreign > 0 && (
          <div className="flex items-center justify-center text-[11px] font-bold text-ink-dark transition-[width] duration-1000 ease-out" style={{ width: grown ? `${foreignPct}%` : '0%', background: C.accent }}>
            {foreignPct >= 14 && `${foreignPct}%`}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft mb-5">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: C.ink }} />
          Belföldi · <span className="font-bold text-ink-soft2">{domesticPct}%</span>
          <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{domestic}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: C.accent }} />
          Külföldi · <span className="font-bold text-ink-soft2">{foreignPct}%</span>
          <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" />{foreign}</span>
        </span>
      </div>

      {/* Teljes ország-rangsor (a magyar is) — az összes vendéghez viszonyított aránnyal */}
      <div className="border-t border-line pt-4 space-y-2.5">
        {ranking.map((c) => {
          const isHU = c.code === 'HU'
          const pct = total > 0 ? Math.round((c.count / total) * 100) : 0
          return (
            <div key={c.code} className="flex items-center gap-2.5 sm:gap-3">
              <span className="w-24 sm:w-32 shrink-0 text-sm font-medium text-ink-soft2 truncate">
                {BY_CODE[c.code]?.name ?? c.code}
              </span>
              <div className="flex-1 min-w-0 h-5 rounded-md bg-[var(--dav-glass-strong)] border border-line overflow-hidden">
                <div
                  className="h-full rounded-md transition-[width] duration-1000 ease-out"
                  style={{ width: grown ? `${Math.max(6, (c.count / maxCount) * 100)}%` : '0%', background: isHU ? C.ink : C.accent }}
                />
              </div>
              <span className="flex w-16 sm:w-24 shrink-0 items-center justify-end gap-1 text-[11px] sm:text-xs tabular-nums text-ink-soft">
                <span className="font-bold text-ink-soft2">{pct}%</span>
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
  embedded = false,
}: {
  domesticCount: number
  foreignCount: number
  topCountries: TopCountry[]
  nationalityRaw: NationalityRaw[]
  periodLabel: string
  embedded?: boolean
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
    <div className={embedded ? '' : 'bg-[#fcfbf7] border border-line rounded-[26px] shadow-dav-card p-6'}>
      {!embedded && (
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">Elmúlt {periodLabel}</p>
            <h3 className="text-[19px] font-medium tracking-tight text-ink">Vendégek nemzetisége</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Részletek"
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      )}

      <Breakdown
        domestic={domesticCount}
        foreign={foreignCount}
        ranking={[
          ...(domesticCount > 0 ? [{ code: 'HU', count: domesticCount }] : []),
          ...topCountries,
        ].sort((a, b) => b.count - a.count)}
      />

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white">
          <SheetHeader className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-0.5">Részletek</p>
            <SheetTitle className="text-lg font-medium tracking-tight text-ink">Vendégek nemzetisége</SheetTitle>
          </SheetHeader>

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

          <div className="rounded-[18px] border border-line p-5">
            <Breakdown domestic={agg.domestic} foreign={agg.foreign} ranking={agg.ranking} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
