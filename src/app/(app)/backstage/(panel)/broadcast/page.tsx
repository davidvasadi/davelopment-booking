import { requireAuth } from '@/lib/auth'
import { PageHead } from '@/components/ui-kit'
import { BroadcastView } from '@/components/backstage/BackstageViews'
import { BROADCAST_TARGETS } from '@/components/blocks/backstage'
import { getPayloadClient } from '@/lib/payload'
import { shortDate } from '@/lib/backstageView'
import { authQuery, sql } from '@/lib/authDb'
import type { BroadcastLogEntry } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

const TARGET_LABEL = Object.fromEntries(BROADCAST_TARGETS.map(([k, l]) => [k, l])) as Record<string, string>
const ownerOf = (o: unknown) => (o && typeof o === 'object' ? String((o as { id: unknown }).id) : o != null ? String(o) : null)

/** Backstage › Körüzenet (design B.14): írás a 8.2 szerkesztő-mintával (előnézet + címzettek), alatta az elküldöttek. */
export default async function BackstageBroadcastPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()
  const [salons, restaurants, paying, trial, logs] = await Promise.all([
    payload.find({ collection: 'salons', limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'restaurants', limit: 2000, depth: 0, overrideAccess: true }),
    payload.count({ collection: 'subscriptions', where: { status: { equals: 'active' } }, overrideAccess: true }),
    payload.count({ collection: 'subscriptions', where: { status: { equals: 'trialing' } }, overrideAccess: true }),
    payload.find({ collection: 'broadcast-log', sort: '-createdAt', limit: 30, depth: 0, overrideAccess: true }),
  ])
  // „Mindenki” = minden üzlet tulajdonosa (ahogy a küldés is számolja)
  const owners = new Set([...salons.docs, ...restaurants.docs].map((p) => ownerOf(p.owner)).filter(Boolean))
  // megkapta / megnyitotta kampányonként — egy összesítő lekérdezéssel (nem kampányonként kettővel)
  const ids = (logs.docs as BroadcastLogEntry[]).map((l) => Number(l.id))
  const stats = ids.length
    ? await authQuery<{ id: number; delivered: number; opened: number }>(sql`SELECT campaign_id::int AS id, COUNT(*)::int AS delivered, (COUNT(*) FILTER (WHERE "read"))::int AS opened FROM notifications WHERE campaign_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) GROUP BY campaign_id`).catch(() => [])
    : []
  const byId = new Map(stats.map((r) => [Number(r.id), r]))
  const history = (logs.docs as BroadcastLogEntry[]).map((log) => {
    const st = byId.get(Number(log.id))
    return { key: String(log.id), id: String(log.id), date: shortDate(log.createdAt), title: log.title, target: TARGET_LABEL[log.target] ?? log.target, delivered: Number(st?.delivered ?? 0), opened: Number(st?.opened ?? 0) }
  })
  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Körüzenet" sub={`Üzenet a tulajdonosok csengőjébe · eddig ${logs.totalDocs} körüzenet`} />
      <BroadcastView counts={[owners.size, paying.totalDocs, trial.totalDocs]} history={history} />
    </div>
  )
}
