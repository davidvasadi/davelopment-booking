import { ArrowUpRight, ChevronDown, type LucideIcon } from 'lucide-react'

/** Az Áttekintés (Overview) bento közös, prezentációs építőelemei — szalon ÉS étterem
 *  ugyanezeket használja (davelopment-design, Crextio bento). */

/** Fehér bento-kártya alap-osztály. */
export const CARD = 'rounded-[26px] bg-[var(--dav-glass-strong)] backdrop-blur-lg shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]'

/** Hero KPI: kis ikon + nagy szám + címke. */
export function HeroKpi({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2.5">
        <Icon className="h-6 w-6 shrink-0 text-ink-soft" strokeWidth={1.6} />
        <div className="text-4xl lg:text-[42px] font-light leading-none tracking-[-0.02em] text-ink">{value}</div>
      </div>
      <div className="mt-1.5 text-[13px] font-medium text-ink-soft">{label}</div>
    </div>
  )
}

/** Státusz-csík egy szegmense (pill). */
export function StatusPill({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="shrink-0">
      <p className="mb-2 text-xs font-medium text-ink-soft">{label}</p>
      <div className={`flex h-11 items-center rounded-[21px] px-5 text-sm font-semibold ${className}`}>{value}</div>
    </div>
  )
}

/** Jobb-felső kör-ikon a kártyákon (kifelé mutató nyíl). */
export function CardIcon() {
  return (
    <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(80,70,30,.07)]">
      <ArrowUpRight className="h-[15px] w-[15px] text-ink" strokeWidth={1.8} />
    </div>
  )
}

/** Szaggatott elválasztó (Részletek-akkordeon). */
export function Dashed() {
  return <div className="border-t border-dashed" style={{ borderColor: 'rgba(120,110,70,.28)' }} />
}

/** Akkordeon-sor (cím + lefelé chevron). */
export function AccRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[15px] font-medium text-ink">{label}</span>
      <ChevronDown className="h-4 w-4 text-ink-soft" />
    </div>
  )
}
