import type { ReactNode } from 'react'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'

/**
 * Crextio design-primitívek a publikus foglaló-oldalhoz — 1:1 a Crextio referenciákkal.
 * Kulcs-jellemzők:
 *  - a kártyák SZÍNTELEN ÜVEG (backdrop-blur + desaturate), a krém-gradient áttűnik, de nem színez;
 *  - nagy, VÉKONY (font-light) számok, ink szöveg, arany (#F1CE45) kiemelés;
 *  - nagy lekerekítés (26px kártya), kör-ikon-gombok, szegmentált status-pill-bar.
 */

/* ── Színtelen üveg felület: a Crextio profil-badge üveg-hatása (blur + saturate 0.35). ── */
const GLASS_STYLE: React.CSSProperties = {
  backdropFilter: 'blur(22px) saturate(0.4) brightness(1.06)',
  WebkitBackdropFilter: 'blur(22px) saturate(0.4) brightness(1.06)',
  background: 'rgba(255,255,255,0.30)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(80,70,30,0.05), 0 18px 40px -28px rgba(80,70,30,0.22)',
  border: '1px solid rgba(255,255,255,0.5)',
}

/** Színtelen üveg-kártya (a Crextio krém-kártya megfelelője, de átengedi a hátteret). */
export function GlassCard({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div className={`rounded-[26px] ${padded ? 'p-[22px]' : ''} ${className}`} style={GLASS_STYLE}>
      {children}
    </div>
  )
}

/** Ink (sötét) kártya — akcentnek, a sok üveg közé (a Crextio egyetlen fekete kártyája). */
export function InkCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[26px] bg-ink-dark p-[22px] text-white shadow-[0_20px_44px_-26px_rgba(40,35,15,.5)] ${className}`}>
      {children}
    </div>
  )
}

/** Kör-ikon gomb (a kártya jobb-felső „↗" a Crextio-n). Fehér kör, finom árnyék. */
export function RoundIconButton({
  icon: Icon = ArrowUpRight,
  className = '',
  onClick,
}: {
  icon?: LucideIcon
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-[0_1px_4px_rgba(70,60,20,.1)] transition-colors hover:bg-paper ${className}`}
    >
      <Icon className="h-[16px] w-[16px]" strokeWidth={1.9} />
    </button>
  )
}

/** Nagy KPI: kis ikon-jel + nagy VÉKONY szám + címke (Crextio „78 Employe"). */
export function CrextioKpi({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon
  value: string | number
  label: string
}) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2">
        <Icon className="h-[18px] w-[18px] shrink-0 text-ink-soft" strokeWidth={1.6} />
        <div className="text-[38px] font-light leading-none tracking-[-0.03em] text-ink">{value}</div>
      </div>
      <div className="mt-1 text-[12.5px] font-medium text-ink-soft">{label}</div>
    </div>
  )
}

/* ── Szegmentált status-pill-bar (Crextio: fekete / sárga / szaggatott-hatch / outline). ── */
export type StatusSeg = {
  label: string
  /** Megjelenített érték a pillben (pl. „15%"). */
  value: string
  /** A szegmens relatív szélessége (flex-grow). */
  weight: number
  variant: 'ink' | 'gold' | 'hatch' | 'outline'
}

const SEG_CLASS: Record<StatusSeg['variant'], string> = {
  ink: 'bg-ink-dark text-white',
  gold: 'bg-gold text-ink-dark',
  hatch: 'text-ink-soft',
  outline: 'border border-ink-soft/40 text-ink-soft',
}
const HATCH_BG =
  'repeating-linear-gradient(115deg, rgba(255,255,255,.55) 0 7px, rgba(190,180,140,.22) 7px 14px)'

/** Crextio felső státusz-csík: fölötte kis címke, alatta a kitöltött pill. */
export function StatusPillBar({ segments, className = '' }: { segments: StatusSeg[]; className?: string }) {
  return (
    <div className={`flex items-end gap-2.5 ${className}`}>
      {segments.map((s, i) => (
        <div key={i} className="flex flex-col" style={{ flexGrow: Math.max(s.weight, 0.4), flexBasis: 0, minWidth: 56 }}>
          <span className="mb-1.5 pl-1 text-[11px] font-medium text-ink-soft">{s.label}</span>
          <div
            className={`flex h-10 items-center justify-center rounded-[20px] px-3 text-[12.5px] font-semibold ${SEG_CLASS[s.variant]} ${s.variant === 'outline' ? 'bg-transparent' : ''}`}
            style={s.variant === 'hatch' ? { background: HATCH_BG } : undefined}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}
