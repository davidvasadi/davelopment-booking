import type { LucideIcon } from 'lucide-react'
import { HeroKpi } from '@/components/dashboard/overview-ui'
import { StatusPills, type StatusSeg } from '@/components/dashboard/StatusPills'

/**
 * Backstage oldal-hero — a dashboard Áttekintő hero-blokkjának mintája: cím + akció felül,
 * majd egy sorban BAL: arányos státusz-csík (StatusPills), JOBB: 3 nagy szöveges KPI (HeroKpi,
 * ikon + font-light szám + label). Az Áttekintő, Előfizetők és Kockázat oldal ugyanezt kapja,
 * csak más adattal — így vizuálisan egységes a felső blokk (a user kérése).
 *
 * SZERVER-komponens: a HeroKpi ikonjait közvetlenül átadhatjuk (a HeroKpi is szerver). A
 * StatusPills kliens, de csak plain `segments`-et kap.
 */
export function BackstageHero({
  title, subtitle, action, segments, kpis, pillsClassName = 'flex-1 lg:max-w-[720px]',
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  /** Az arányos státusz-csík szegmensei (pl. Fizető/Próba/Kockázat). */
  segments: StatusSeg[]
  /** A jobb oldali 3 nagy KPI. */
  kpis: { icon: LucideIcon; value: string; label: string }[]
  pillsClassName?: string
}) {
  return (
    <div className="space-y-6">
      {/* Cím + akció */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-light leading-[1.05] tracking-[-0.02em] text-ink lg:text-[46px]">{title}</h1>
          {subtitle && <p className="mt-2 text-[13.5px] font-medium text-ink-soft">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Státusz-csík (bal) + HeroKpi klaszter (jobb) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <StatusPills eager className={pillsClassName} segments={segments} />
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          {kpis.map((k) => (
            <HeroKpi key={k.label} icon={k.icon} value={k.value} label={k.label} />
          ))}
        </div>
      </div>
    </div>
  )
}
