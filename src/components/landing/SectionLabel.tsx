import { cn } from '@/lib/utils'

/**
 * Egységes szekció-„eyebrow" felirat a landingen — pl. „(Értékelések)", „(Árazás)", „(GYIK)".
 * Egy helyen a méret/stílus → minden szekció ugyanúgy néz ki, innen hangolható.
 * A zárójelet a hívó adja a children-ben (pl. <SectionLabel>(Értékelések)</SectionLabel>).
 */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('font-semibold text-[18px] tracking-[0.144px] text-brand-ink', className)}>
      {children}
    </p>
  )
}
