import { requireAuth } from '@/lib/auth'
import { CreditCard, Users, Wallet } from 'lucide-react'
import { loadBackstageData } from '@/lib/backstageMetrics'
import { BackstageHero } from '@/components/backstage/BackstageHero'
import { formatHuf } from '@/components/backstage/BackstageUi'
import AccountsClient, { type AccountRow } from './AccountsClient'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  await requireAuth('admin')
  const d = await loadBackstageData()

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

      <AccountsClient accounts={rows} />
    </div>
  )
}
