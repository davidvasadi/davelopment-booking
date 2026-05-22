import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function DiffBadge({ diff }: { diff: number }) {
  if (diff > 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-[#00bb88]">
      <TrendingUp className="h-3 w-3" />+{diff}%
    </span>
  )
  if (diff < 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-red-400">
      <TrendingDown className="h-3 w-3" />{diff}%
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-zinc-400 dark:text-white/30">
      <Minus className="h-3 w-3" />0%
    </span>
  )
}

/**
 * Egyszerű, statikus KPI-kártya — a KpiCardWithDetails vizuális stílusát követi,
 * de részletek-sheet nélkül (étterem-modul, ahol nincs revenue-alapú drill-down).
 */
export function StatCard({
  sub,
  label,
  value,
  diff,
}: {
  sub: string
  label: string
  value: string
  diff?: number
}) {
  return (
    <div className="rounded-2xl p-5 lg:p-7 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">{sub}</p>
      <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white truncate">{value}</p>
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <p className="text-xs text-zinc-500 dark:text-white/40">{label}</p>
        {diff !== undefined && <DiffBadge diff={diff} />}
      </div>
    </div>
  )
}
