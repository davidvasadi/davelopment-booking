import { type LucideIcon } from 'lucide-react'

/** Az Áttekintés (Overview) bento közös, prezentációs építőelemei — szalon ÉS étterem
 *  ugyanezeket használja (davelopment-design, Crextio bento). */

/** Fehér bento-kártya alap-osztály. */
export const CARD = 'rounded-[26px] bg-white/70 backdrop-blur-lg shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]'

/** Hero KPI: kis ikon + nagy szám + címke. */
/** `compact`: sok KPI egy sorban (mobilon) → kisebb, a képernyő szélességéhez igazodó betű. */
export function HeroKpi({ icon: Icon, value, label, compact = false }: { icon: LucideIcon; value: string; label: string; compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-start">
      <div className={`flex items-center ${compact ? 'gap-1.5 lg:gap-2.5' : 'gap-2.5'}`}>
        <Icon className={`shrink-0 text-ui-muted ${compact ? 'h-[18px] w-[18px] lg:h-6 lg:w-6' : 'h-6 w-6'}`} strokeWidth={1.6} />
        <div className={`whitespace-nowrap font-light leading-none tracking-[-0.02em] text-ui-text lg:text-[42px] ${compact ? 'text-[clamp(20px,5.6vw,36px)]' : 'text-4xl'}`}>{value}</div>
      </div>
      <div className={`mt-1.5 whitespace-nowrap font-medium text-ui-muted ${compact ? 'text-[12px] lg:text-[13px]' : 'text-[13px]'}`}>{label}</div>
    </div>
  )
}

/** Státusz-csík egy szegmense (pill). */
export function StatusPill({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="shrink-0">
      <p className="mb-2 text-xs font-medium text-ui-muted">{label}</p>
      <div className={`flex h-11 items-center rounded-[21px] px-5 text-sm font-semibold ${className}`}>{value}</div>
    </div>
  )
}
