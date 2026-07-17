import { requireAuth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Building2, UtensilsCrossed, Mail, Phone, MapPin, Calendar,
  CreditCard, CalendarCheck, Clock, ExternalLink, FileText, Receipt, Wallet, Store,
} from 'lucide-react'
import { loadAccountProfile, daysUntil } from '@/lib/backstageMetrics'
import { PLAN_LABELS } from '@/lib/backstagePlaces'
import { HeroKpi, CARD } from '@/components/dashboard/overview-ui'
import { StatusBadge, ActivePill, SectionPanel, FIELD_LABEL, formatHuf } from '@/components/backstage/BackstageUi'
import AccountActions, { AccountNotes } from './AccountActions'

export const dynamic = 'force-dynamic'

function bookingBadgeCls(status: string): string {
  if (status === 'confirmed') return 'bg-ok-bg text-ok'
  if (status === 'cancelled' || status === 'no_show') return 'bg-bad-bg text-bad'
  if (status === 'completed') return 'bg-gold/20 text-ink-dark'
  return 'bg-warn-bg text-warn'
}

/** Egy kis „címke → érték" adatsor a fiók-panelekben (8dp ritmus, tiszta hierarchia). */
function DataRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gold/20 text-ink-dark">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-ink-soft">{label}</p>
        <div className="mt-0.5 text-[13.5px] text-ink">{children}</div>
      </div>
    </div>
  )
}

export default async function AccountProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const profile = await loadAccountProfile(id)
  if (!profile) notFound()

  const { owner, sub, status, mrr, places, totalBookings, monthBookings, recentBookings } = profile
  const anyActive = places.some(p => p.is_active)
  const initial = (owner.name || owner.email || '?').trim()[0]?.toUpperCase() ?? '?'

  const periodEnd = sub
    ? (status === 'trialing' && sub.trial_ends_at ? sub.trial_ends_at : sub.current_period_end ?? null)
    : null
  const periodDays = daysUntil(periodEnd)
  const salonCount = places.filter(p => p.kind === 'salon').length
  const restaurantCount = places.filter(p => p.kind === 'restaurant').length

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <Link href="/backstage/accounts" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-soft transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Előfizetők
      </Link>

      {/* ── HERO: avatar + név + státusz + akciók ── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[26px] font-semibold text-white">{initial}</span>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-light leading-[1.05] tracking-[-0.02em] text-ink lg:text-[38px]">{owner.name || owner.email}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <StatusBadge status={status} icon={CreditCard} />
              <span className="text-[12.5px] text-ink-soft">{owner.email}</span>
            </div>
          </div>
        </div>
        <AccountActions ownerId={id} status={status} plan={sub?.plan ?? null} anyActive={anyActive} hasSub={!!sub} />
      </div>

      {/* ── KPI klaszter (HeroKpi, mint a dashboardon) ── */}
      <div className="flex flex-wrap items-start gap-8 rounded-[26px] p-6 dav-card-glass lg:gap-12">
        <HeroKpi icon={Wallet} value={formatHuf(mrr)} label="Havi díj (MRR)" />
        <HeroKpi icon={Store} value={String(places.length)} label={`${salonCount} szalon · ${restaurantCount} étterem`} />
        <HeroKpi icon={CalendarCheck} value={totalBookings.toLocaleString('hu-HU')} label={`${monthBookings} ebben a hónapban`} />
      </div>

      {/* ── BENTO: bal = fiók + előfizetés + számla · jobb = üzletek + foglalások ── */}
      <div className="grid gap-[5px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">

        {/* Bal oszlop */}
        <div className="flex flex-col gap-[5px]">
          {/* Fiók-adatok */}
          <div className={`${CARD} p-5`}>
            <p className={`${FIELD_LABEL} mb-2`}>Fiók</p>
            <div className="divide-y divide-line">
              <DataRow icon={Mail} label="Email">{owner.email}</DataRow>
              {owner.phone && <DataRow icon={Phone} label="Telefon">{owner.phone}</DataRow>}
              {owner.address && <DataRow icon={MapPin} label="Cím">{owner.address}</DataRow>}
              <DataRow icon={Calendar} label="Regisztrált">{new Date(owner.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}</DataRow>
            </div>
          </div>

          {/* Előfizetés */}
          <div className={`${CARD} p-5`}>
            <p className={`${FIELD_LABEL} mb-2`}>Előfizetés</p>
            {sub ? (
              <div className="divide-y divide-line">
                <DataRow icon={CreditCard} label="Csomag">
                  <span className="flex items-center gap-2">{PLAN_LABELS[sub.plan] ?? sub.plan}<StatusBadge status={status} /></span>
                </DataRow>
                <DataRow icon={Wallet} label="Számlázás">{sub.billing_cycle === 'annual' ? 'Éves ciklus (−20%)' : 'Havi ciklus'} · {formatHuf(mrr)}</DataRow>
                {periodEnd && (
                  <DataRow icon={Clock} label={status === 'trialing' ? 'Próba vége' : 'Időszak vége'}>
                    {new Date(periodEnd).toLocaleDateString('hu-HU')}{periodDays != null && periodDays >= 0 && <span className="text-ink-soft"> · {periodDays} nap</span>}
                    {sub.cancel_at_period_end && <span className="ml-1 text-warn">⚠ végén lemond</span>}
                  </DataRow>
                )}
                {sub.breakdown && <DataRow icon={Store} label="Összetétel">{sub.breakdown}</DataRow>}
              </div>
            ) : (
              <p className="py-3 text-[13.5px] text-ink-soft">Ehhez a fiókhoz nem tartozik előfizetés.</p>
            )}
          </div>

          {/* Utolsó számla */}
          <div className={`${CARD} p-5`}>
            <p className={`${FIELD_LABEL} mb-2`}>Utolsó számla</p>
            {sub?.last_invoice_number ? (
              <div className="divide-y divide-line">
                <DataRow icon={Receipt} label="Számlaszám (Számlázz.hu)">{sub.last_invoice_number}</DataRow>
                {sub.last_invoice_url && (
                  <DataRow icon={FileText} label="PDF">
                    <a href={sub.last_invoice_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline">Megnyitás</a>
                  </DataRow>
                )}
              </div>
            ) : (
              <p className="py-3 text-[13.5px] text-ink-soft">Még nincs kiállított számla.</p>
            )}
          </div>

          {/* Belső jegyzet */}
          <div className={`${CARD} p-5`}>
            <p className={`${FIELD_LABEL} mb-3`}>Belső megjegyzés</p>
            <AccountNotes ownerId={id} initialNotes={sub?.notes ?? ''} disabled={!sub} />
          </div>
        </div>

        {/* Jobb oszlop */}
        <div className="flex flex-col gap-[5px]">
          {/* Üzletek */}
          <SectionPanel title="Üzletek" icon={Building2} iconClass="bg-gold/20 text-ink-dark" count={places.length}>
            {places.length === 0 ? (
              <p className="px-5 py-8 text-[13.5px] text-ink-soft">Ehhez a fiókhoz nem tartozik üzlet.</p>
            ) : (
              <div className="p-2.5">
                {places.map((p) => {
                  const Icon = p.kind === 'restaurant' ? UtensilsCrossed : Building2
                  const detailHref = p.kind === 'salon' ? `/backstage/salons/${p.id}` : `/backstage/salons?place=restaurant:${p.id}`
                  return (
                    <div key={`${p.kind}-${p.id}`} className="flex items-center gap-3 rounded-[16px] px-3 py-3 transition-colors hover:bg-white">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gold/20 text-ink-dark">
                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5">
                          <Link href={detailHref} className="truncate text-[13.5px] font-semibold text-ink hover:underline">{p.name}</Link>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{p.kind === 'restaurant' ? 'Étterem' : 'Szalon'}</span>
                        </p>
                        <p className="truncate text-[12px] text-ink-soft">{p.city ? `${p.city} · ` : ''}{p.totalBookings} foglalás · {p.monthBookings} e hónap</p>
                      </div>
                      <ActivePill active={p.is_active} />
                      <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-gold/20 hover:text-ink-dark" title="Nyilvános oldal">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionPanel>

          {/* Legutóbbi foglalások */}
          <SectionPanel title="Legutóbbi foglalások" icon={CalendarCheck} iconClass="bg-gold/20 text-ink-dark" count={recentBookings.length}>
            {recentBookings.length === 0 ? (
              <p className="px-5 py-8 text-[13.5px] text-ink-soft">Nincs foglalás a fiók egyetlen helyén sem.</p>
            ) : (
              <div className="p-2.5">
                {recentBookings.map((b) => (
                  <div key={`${b.kind}-${b.id}`} className="flex items-center justify-between gap-3 rounded-[16px] px-3 py-2.5 transition-colors hover:bg-white">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{b.customerName}</p>
                      <p className="truncate text-[12px] text-ink-soft">{b.placeName} · {b.detail} · {b.date} {b.time}</p>
                    </div>
                    <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${bookingBadgeCls(b.status)}`}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionPanel>
        </div>
      </div>
    </div>
  )
}
