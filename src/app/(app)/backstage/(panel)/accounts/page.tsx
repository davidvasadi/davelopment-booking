import { requireAuth } from '@/lib/auth'
import { CreditCard, Users, Wallet } from 'lucide-react'
import { loadBackstageData } from '@/lib/backstageMetrics'
import { getPayloadClient } from '@/lib/payload'
import { BackstageHero } from '@/components/backstage/BackstageHero'
import { formatHuf } from '@/components/backstage/BackstageUi'
import AccountsClient, { type AccountRow, type Filter } from './AccountsClient'
import OrphanSubscriptions, { type OrphanSub } from './OrphanSubscriptions'

export const dynamic = 'force-dynamic'

const VALID_FILTERS: Filter[] = ['all', 'active', 'trialing', 'past_due', 'canceled']

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAuth('admin')
  const { status } = await searchParams
  const initialStatus = VALID_FILTERS.includes(status as Filter) ? (status as Filter) : undefined
  const d = await loadBackstageData()

  // Árva előfizetések: owner nélküli subscription-sorok — a fő lista USEREKBŐL indul ki, ezért
  // ezeket sose látná (a Subscriptions oldal viszont raw subscription-lekérdezésből építkezett,
  // ott látszottak — összevonáskor ide kerülnek, külön kis szekcióban, hogy ne tűnjenek el).
  const payload = await getPayloadClient()
  const orphanResult = await payload.find({
    collection: 'subscriptions',
    where: { owner: { exists: false } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  const orphans: OrphanSub[] = orphanResult.docs.map(s => ({
    id: String(s.id), plan: s.plan, status: s.status, breakdown: s.breakdown ?? null, createdAt: s.createdAt,
  }))

  const rows: AccountRow[] = d.accounts.map(a => ({
    ownerId: a.ownerId,
    email: a.owner.email,
    name: a.owner.name,
    status: a.status,
    mrr: a.mrr,
    salonCount: a.salonCount,
    restaurantCount: a.restaurantCount,
    placeCount: a.placeCount,
    totalBookings: a.totalBookings,
    recentBookings: a.recentBookings,
    createdAt: a.createdAt,
    trialEndsAt: a.sub?.trial_ends_at ?? null,
  }))

  const total = d.payingAccounts + d.trialingCount + d.pastDueCount + d.canceledCount + d.pausedCount || 1
  const payingPct = Math.round((d.payingAccounts / total) * 100)
  const trialPct = Math.round((d.trialingCount / total) * 100)
  const riskPct = Math.round(((d.pastDueCount + d.canceledCount + d.pausedCount) / total) * 100)

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <BackstageHero
        title="Előfizetők"
        subtitle={`${d.totalAccounts} fiók a platformon`}
        segments={[
          { label: 'Fizető', pct: payingPct, background: '#1D1C19', color: '#fff' },
          { label: 'Próba', pct: trialPct, background: '#F1CE45', color: '#1D1C19' },
          { label: 'Kockázat', pct: riskPct, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
        ]}
        kpis={[
          { icon: Users, value: String(d.payingAccounts), label: 'Fizető fiók' },
          { icon: CreditCard, value: formatHuf(d.mrr), label: 'Havi bevétel (MRR)' },
          { icon: Wallet, value: formatHuf(d.arpa), label: 'Átlag / fiók' },
        ]}
      />

      <AccountsClient accounts={rows} initialStatus={initialStatus} />
      {orphans.length > 0 && <OrphanSubscriptions subs={orphans} />}
    </div>
  )
}
