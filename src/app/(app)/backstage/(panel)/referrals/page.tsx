import { requireAuth } from '@/lib/auth'
import { Check, Gift, UserPlus } from 'lucide-react'
import { Kpi, PageHead } from '@/components/ui-kit'
import { ReferralAdminTable, type BsReferral } from '@/components/blocks/backstage'
import { ReferralCreditButton } from '@/components/backstage/BackstageViews'
import { getPayloadClient } from '@/lib/payload'
import { referralAdminList } from '@/lib/referrals'
import { shortDate } from '@/lib/backstageView'

export const dynamic = 'force-dynamic'

/** Backstage › Ajánlások (design B.11): az Ajánló program (+1 hónap) — ki kit hozott, hol tart, megkapta-e az ajánló
 *  a hónapot; elakadt jóváírásnál kézi pótlás. (A „Keress pénzt” 10%-os program még nem él — a backendje külön feladat.) */
export default async function ReferralsPage() {
  await requireAuth('admin')
  const { rows, clicks } = await referralAdminList(await getPayloadClient())
  const vm: (BsReferral & { id: number })[] = rows.map((r) => ({
    key: String(r.id), id: r.id, referrer: r.referrer, referrerHref: `/backstage/accounts/${r.referrerId}`,
    invited: r.invited, invitedHref: r.invitedId ? `/backstage/accounts/${r.invitedId}` : undefined,
    code: r.code, date: shortDate(r.createdAt), state: r.status, credited: r.creditedAt ? shortDate(r.creditedAt) : null,
  }))
  const months = rows.filter((r) => r.creditedAt).length
  const subscribed = rows.filter((r) => r.status === 'subscribed').length
  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Ajánlások" sub="Ajánló program — minden előfizető után az ajánló +1 hónapot kap"
        kpis={<><Kpi icon={UserPlus} value={String(rows.length)} label="Regisztrált ajánlással" /><Kpi icon={Check} value={String(subscribed)} label="Előfizetett" /><Kpi icon={Gift} value={String(months)} label="Ingyen hónap kiadva" /></>} />
      <ReferralAdminTable rows={vm} stats={{ clicks, registered: rows.length, months }} credit={(r) => <ReferralCreditButton id={Number(r.key)} />} />
    </div>
  )
}
