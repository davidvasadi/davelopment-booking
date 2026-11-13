import { requireAuth } from '@/lib/auth'
import { CreditCard, Users, Wallet } from 'lucide-react'
import { Kpi, PageHead, SegmentBar } from '@/components/ui-kit'
import { FunnelCard } from '@/components/blocks/backstage'
import { AccountsView, OrphanCard, type OrphanSub } from '@/components/backstage/BackstageViews'
import { loadBackstageData, loadRegistrationFunnel } from '@/lib/backstageMetrics'
import { accountPlacesLite, accountVM, shortDate, thousands } from '@/lib/backstageView'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

/** Backstage › Előfizetők (design B.3): fiók-lista + adatlap, regisztrációs tölcsér, gazdátlan előfizetések. */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAuth('admin')
  const { status } = await searchParams
  const payload = await getPayloadClient()
  const d = await loadBackstageData()
  const [funnel, orphanRes] = await Promise.all([
    loadRegistrationFunnel(d.accounts),
    payload.find({ collection: 'subscriptions', where: { owner: { exists: false } }, limit: 50, depth: 0, overrideAccess: true }),
  ])
  // Gazdátlan előfizetések: owner nélküli sorok — a fő lista userekből indul, ezért itt külön jelennek meg.
  const orphans: OrphanSub[] = orphanRes.docs.map((s) => ({ id: String(s.id), plan: s.plan ?? null, status: s.status, breakdown: s.breakdown ?? null, created: shortDate(s.createdAt) }))
  const accounts = [...d.accounts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const rows = accounts.map(accountVM)
  const places = Object.fromEntries(accounts.map((a) => [a.ownerId, accountPlacesLite(a)]))
  const risk = d.pastDueCount + d.pausedCount + d.canceledCount
  const total = d.payingAccounts + d.trialingCount + risk

  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Előfizetők" sub={`${d.totalAccounts} fiók a platformon`}
        bar={<SegmentBar segments={[
          { label: 'Fizető', value: String(d.payingAccounts), weight: total ? d.payingAccounts : 34, tone: 'dark' },
          { label: 'Próba', value: String(d.trialingCount), weight: total ? d.trialingCount : 33, tone: 'yellow' },
          { label: 'Kockázat', value: String(risk), weight: total ? Math.max(risk, total * 0.06) : 33, tone: 'hatch' },
        ]} />}
        kpis={<><Kpi icon={Users} value={String(d.payingAccounts)} label="Fizető fiók" /><Kpi icon={Wallet} value={thousands(d.mrr)} label="Havi bevétel" /><Kpi icon={CreditCard} value={thousands(d.arpa)} label="Átlag / fiók" /></>} />
      <AccountsView accounts={rows} places={places} initialStatus={status} />
      <div className={`mt-[5px] grid grid-cols-1 gap-[5px] [&>*]:min-w-0 ${orphans.length ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <FunnelCard steps={funnel.map((f) => [f.label, f.count] as [string, number])} />
        {orphans.length > 0 && <OrphanCard subs={orphans} />}
      </div>
    </div>
  )
}
