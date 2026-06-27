import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from 'lucide-react'

/** Trend-irány → tint. A pozitív zöld, a negatív piros, a semleges/ismeretlen szürke. */
export type Tint = 'green' | 'red' | 'blue' | 'orange' | 'neutral'

const TINTS: Record<Tint, { badge: string; icon: string }> = {
  green: { badge: 'bg-[#00bb88]/10', icon: 'text-[#00bb88]' },
  red: { badge: 'bg-red-400/10', icon: 'text-red-400' },
  blue: { badge: 'bg-[#0099ff]/10', icon: 'text-[#0099ff]' },
  orange: { badge: 'bg-amber-400/10', icon: 'text-amber-500' },
  neutral: { badge: 'bg-zinc-100 dark:bg-white/[0.06]', icon: 'text-zinc-400 dark:text-white/40' },
}

export function tintFromDiff(diff?: number): Tint {
  if (diff === undefined || diff === 0) return 'neutral'
  return diff > 0 ? 'green' : 'red'
}

export function DiffBadge({ diff }: { diff: number }) {
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

interface StatCardProps {
  sub: string
  label: string
  value: string
  diff?: number
  /** Az értékhez tartozó arány, kis pirulában a fő szám mellett (pl. "12%"). */
  pct?: number
  /** A badge ikonja. Ha nincs megadva, a trend irányát mutató nyíl jelenik meg. */
  icon?: LucideIcon
  /**
   * A badge tintje. Alapból a `diff` előjeléből számolódik (zöld fel / piros le /
   * semleges 0), de felül is írható egy fix színnel.
   */
  tint?: Tint
  /** Kattintható kártya (drill-down). Ekkor jobb felül megjelenik a nyíl-jelző. */
  onClick?: () => void
}

/**
 * Egységes KPI-kártya — bal felül tintázott ikon-badge, alatta a fő érték, majd
 * a sub/label feliratok. A szalon- (`KpiCardWithDetails`) és étterem-modul
 * (`RestaurantKpiCard`) ezt használja közös kártya-archoz; a drill-down sheetjüket
 * ők maguk hozzák.
 */
export function StatCard({ sub, label, value, diff, pct, icon: Icon, tint, onClick }: StatCardProps) {
  const t = TINTS[tint ?? tintFromDiff(diff)]
  const BadgeIcon: LucideIcon =
    Icon ?? (diff === undefined || diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight)

  const inner = (
    <>
      <div className="flex items-start justify-between mb-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.badge}`}>
          <BadgeIcon className={`h-[18px] w-[18px] ${t.icon}`} />
        </span>
        {onClick && (
          <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30 group-hover:text-zinc-700 dark:group-hover:text-white/60 transition-colors shrink-0 mt-0.5" />
        )}
      </div>
      <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white truncate">{value}</p>
      <div className="flex items-end justify-between gap-1 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-600 dark:text-white/60 truncate">{sub}</p>
          <p className="text-[11px] text-zinc-400 dark:text-white/35 truncate">{label}</p>
        </div>
        {diff !== undefined && <DiffBadge diff={diff} />}
        {pct !== undefined && (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-[#0099ff] bg-[#0099ff]/10 rounded-full px-1.5 py-0.5">
            {pct}%
          </span>
        )}
      </div>
    </>
  )

  const cardClass =
    'rounded-2xl p-5 lg:p-7 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group ${cardClass} hover:border-zinc-300 dark:hover:border-white/[0.16] transition-colors text-left w-full`}
      >
        {inner}
      </button>
    )
  }

  return <div className={cardClass}>{inner}</div>
}
