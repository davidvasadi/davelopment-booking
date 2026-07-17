import {
  Users, CreditCard, Building2, CalendarCheck, TrendingUp, Percent, AlertTriangle,
  Clock, Activity, Wallet, PiggyBank, type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { STATUS_LABELS } from '@/lib/backstagePlaces'
import type { SubStatus } from '@/lib/backstageMetrics'

/**
 * Ikon-kulcs → komponens map. A hívók string-kulcsot adnak (nem komponenst) — így a
 * szerver-komponens sosem ad át függvényt egy esetleges kliens-határon, és a hívás rövidebb.
 */
export type MetricIconKey =
  | 'accounts' | 'revenue' | 'places' | 'bookings' | 'trend' | 'percent'
  | 'risk' | 'clock' | 'activity' | 'wallet' | 'piggy'
const METRIC_ICONS: Record<MetricIconKey, LucideIcon> = {
  accounts: Users, revenue: CreditCard, places: Building2, bookings: CalendarCheck,
  trend: TrendingUp, percent: Percent, risk: AlertTriangle, clock: Clock,
  activity: Activity, wallet: Wallet, piggy: PiggyBank,
}

/** Badge-tint (Crextio): gold a pozitív/semleges kiemelés, zöld/piros a státusz. */
export type MetricTint = 'gold' | 'green' | 'red' | 'neutral'
const TINTS: Record<MetricTint, { badge: string; icon: string }> = {
  gold: { badge: 'bg-gold/20', icon: 'text-ink-dark' },
  green: { badge: 'bg-ok-bg', icon: 'text-ok' },
  red: { badge: 'bg-bad-bg', icon: 'text-bad' },
  neutral: { badge: 'bg-[var(--dav-glass-strong)] border border-line', icon: 'text-ink-soft' },
}

/**
 * Közös backstage UI-primitívek — EGY helyen a badge-ek, panelek, fejlécek és statisztika-sorok,
 * hogy minden backstage-oldal AZONOS vizuális nyelvet beszéljen (davelopment-design). A fő
 * paneleink ÜVEGESEK (.dav-card-glass) a gradient-konténeren, a beágyazott sorok/popoverek fehérek.
 */

/* ── Kártya-osztályok (a hívó adja a paddingot/radiust, vagy a preset-eket használja) ── */
export const GLASS_PANEL = 'rounded-[26px] dav-card-glass'
export const GLASS_PANEL_LG = 'rounded-[26px] p-6 dav-card-glass'
/** Beágyazott, tömör fehér belső csempe (üveg-panelen belül). */
export const INNER_TILE = 'rounded-[18px] border border-line bg-white p-4'

/* ── Státusz-badge (előfizetés) ── */
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-ok-bg text-ok',
  trialing: 'bg-warn-bg text-warn',
  past_due: 'bg-bad-bg text-bad',
  canceled: 'bg-paper text-ink-soft',
  paused: 'bg-paper text-ink-soft',
}

export function StatusBadge({ status, icon: Icon, className = '' }: { status: SubStatus | null; icon?: LucideIcon; className?: string }) {
  const key = status ?? 'none'
  const cls = STATUS_BADGE[key] ?? 'bg-paper text-ink-soft'
  const label = status ? (STATUS_LABELS[status] ?? status) : 'Nincs előfizetés'
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls} ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </span>
  )
}

/* ── Aktív/Inaktív pill (üzlet) ── */
export function ActivePill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? 'bg-ok-bg text-ok' : 'bg-paper text-ink-soft'}`}>
      {active ? 'Aktív' : 'Inaktív'}
    </span>
  )
}

/* ── Oldal-fejléc (backstage variáns) — nagy könnyű cím + jobb oldali akció ── */
export function BackstageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[13.5px] font-medium text-ink-soft">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ── Metrika-kártya (Crextio KPI-anatómia: ikon-badge bal-felül, nagy font-light szám) ── */
export function MetricTile({ label, value, sub, danger, icon, tint }: {
  label: string; value: string; sub?: string; danger?: boolean
  icon?: MetricIconKey; tint?: MetricTint
}) {
  const t = TINTS[tint ?? (danger ? 'red' : 'gold')]
  const Icon = icon ? METRIC_ICONS[icon] : null
  return (
    <div className="rounded-[26px] p-5 dav-card-glass lg:p-6">
      <div className="mb-3 flex items-start justify-between">
        {Icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.badge}`}>
            <Icon className={`h-[18px] w-[18px] ${t.icon}`} strokeWidth={1.9} />
          </span>
        )}
        <p className={`text-[12px] font-medium text-ink-soft ${Icon ? 'pt-1 text-right' : ''}`}>{label}</p>
      </div>
      <p className={`text-[28px] font-light leading-none tracking-[-0.02em] lg:text-[38px] ${danger ? 'text-bad' : 'text-ink'}`}>{value}</p>
      {sub && <p className="mt-2 text-[12px] font-medium text-ink-soft">{sub}</p>}
    </div>
  )
}

/* ── Szekció-panel fejléccel (üveges konténer, benne fehér lista) — Crextio panel-cím: 17px medium ── */
export function SectionPanel({ title, icon: Icon, iconClass = 'bg-gold/20 text-ink-dark', count, action, children }: {
  title: string; icon?: LucideIcon; iconClass?: string; count?: number; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className={`overflow-hidden ${GLASS_PANEL}`}>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${iconClass}`}>
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
        )}
        <h2 className="flex-1 text-[17px] font-medium text-ink">{title}</h2>
        {count !== undefined && <span className="text-[13px] font-medium text-ink-soft">{count}</span>}
        {action}
      </div>
      {children}
    </div>
  )
}

/* ── Belső mező-címke (uppercase eyebrow) ── */
export const FIELD_LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-ink-soft'

/* ── „Összes →" link ── */
export function SeeAllLink({ href, label = 'Összes' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="whitespace-nowrap text-[12px] font-semibold text-ink-soft transition-colors hover:text-ink">
      {label} →
    </Link>
  )
}

/** Ft-formázás locale-tudatosan. */
export function formatHuf(n: number): string {
  return `${Math.round(n).toLocaleString('hu-HU')} Ft`
}

/** Rövid Ft (ezres) — chart-tengelyekhez: 128 500 → „128k". */
export function shortHuf(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}
