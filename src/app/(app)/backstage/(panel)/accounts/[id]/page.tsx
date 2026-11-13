import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { loadAccountProfile } from '@/lib/backstageMetrics'
import { auditRows, bookingStatus, bookingWhen, dayTime, daysLeft, shortDate } from '@/lib/backstageView'
import { referralFactsFor } from '@/lib/referrals'
import { getPayloadClient } from '@/lib/payload'
import { AccountProfileView, type ProfileVM } from '@/components/backstage/BackstageViews'
import type { BsStatus, BsTier } from '@/components/blocks/backstage'

export const dynamic = 'force-dynamic'

const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

/** Backstage › Előfizető-profil (design B.5–B.6): a fiók teljes képe és a műveletei. */
export default async function AccountProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const profile = await loadAccountProfile(id)
  if (!profile) notFound()
  const payload = await getPayloadClient()
  const { owner, sub, status, mrr, places } = profile

  const salonIds = places.filter((p) => p.kind === 'salon').map((p) => p.id)
  const restIds = places.filter((p) => p.kind === 'restaurant').map((p) => p.id)
  const or: Record<string, unknown>[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restIds.length) or.push({ restaurant: { in: restIds } })
  if (sub) or.push({ and: [{ collection_name: { equals: 'subscriptions' } }, { doc_id: { equals: String(sub.id) } }] })
  const [audit, refs] = await Promise.all([
    or.length ? payload.find({ collection: 'audit-log', where: { or } as never, sort: '-createdAt', limit: 8, depth: 1, overrideAccess: true }).then((r) => r.docs).catch(() => []) : Promise.resolve([]),
    referralFactsFor(payload, id).catch(() => ({ by: null, invited: [], credited: 0 })),
  ])

  const bsStatus = (status ?? null) as BsStatus | null
  const salons = places.filter((p) => p.kind === 'salon').length
  const rests = places.length - salons
  const placesLabel = [salons ? `${salons} szalon` : null, rests ? `${rests} étterem` : null].filter(Boolean).join(' · ') || 'üzlet'
  const fee = mrr || sub?.amount_huf || 0
  const periodEnd = status === 'trialing' ? sub?.trial_ends_at : sub?.current_period_end
  const recent30 = places.reduce((n, p) => n + p.monthBookings, 0)

  const vm: ProfileVM = {
    a: {
      key: id, name: owner.name || owner.email || '—', business: places[0]?.name || owner.name || owner.email || '—', email: owner.email ?? '', img: owner.avatar_url ?? null, phone: owner.phone ?? null,
      salons, restaurants: rests, tier: (places[0]?.tier ?? null) as BsTier | null, fee, annual: sub?.billing_cycle === 'annual', bookings30: recent30,
      status: bsStatus, trialLeft: status === 'trialing' ? daysLeft(sub?.trial_ends_at) : null, since: shortDate(owner.createdAt), periodEnd: periodEnd ? shortDate(periodEnd) : null, note: sub?.notes ?? null,
    },
    hasSub: !!sub,
    trialEndYmd: sub?.trial_ends_at ? new Date(sub.trial_ends_at).toISOString().slice(0, 10) : null,
    notes: sub?.notes ?? '',
    facts: {
      account: [
        ['E-mail', owner.email ?? '—'],
        ...(owner.phone ? [['Telefon', owner.phone] as [string, string]] : []),
        ['Regisztrált', shortDate(owner.createdAt)],
        ['Utolsó belépés', owner.last_login_at ? dayTime(owner.last_login_at) : '—'],
      ],
      sub: sub ? [
        ['Csomag', `${sub.plan === 'paid' ? 'Fizető' : 'Próba'}${sub.breakdown ? ` · ${sub.breakdown}` : ''}`],
        ['Számlázás', sub.billing_cycle === 'annual' ? 'Éves (−20%)' : 'Havi'],
        ['Havi díj', fee ? ft(fee) : '—'],
        [status === 'trialing' ? 'Próba vége' : 'Időszak vége', `${periodEnd ? shortDate(periodEnd) : '—'}${sub.cancel_at_period_end ? ' · a végén lemond' : ''}`],
      ] : null,
      invoice: sub?.last_invoice_number ? { number: sub.last_invoice_number, url: sub.last_invoice_url ?? null } : null,
      referral: [
        ['Őt ajánlotta', refs.by?.name ?? '—'],
        ['Ő ajánlotta', refs.invited.length ? refs.invited.map((r) => `${r.name}${r.subscribed ? ' · előfizetett' : ''}`).join(', ') : '—'],
        ['Ingyen hónap', refs.credited ? `+${refs.credited} hónap` : '—'],
      ],
    },
    places: places.map((p) => ({
      key: `${p.kind}:${p.id}`, name: p.name, kind: p.kind, city: p.city ?? '', owner: owner.name || owner.email || '—', ownerKey: id, tier: p.tier as BsTier,
      month: p.monthBookings, total: p.totalBookings, since: shortDate(p.createdAt), active: p.is_active, status: bsStatus, slug: p.slug, customFee: p.customFee,
    })),
    bookings: profile.recentBookings.slice(0, 8).map((b) => ({ key: `${b.kind}-${b.id}`, guest: b.customerName, what: b.detail, where: b.placeName, when: bookingWhen(b.date, b.time), ...bookingStatus(b.status) })),
    audit: auditRows(audit as Parameters<typeof auditRows>[0]),
    kpis: { fee: fee ? fee.toLocaleString('hu-HU') : '—', places: String(places.length), placesLabel, bookings: recent30.toLocaleString('hu-HU') },
  }
  return <AccountProfileView vm={vm} />
}
