import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { BroadcastLogEntry, User } from '@/payload/payload-types'
import { BackstageHeader } from '@/components/backstage/BackstageUi'
import BroadcastForm from './BroadcastForm'
import BroadcastHistoryRow from './BroadcastHistoryRow'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 15

export default async function BackstageBroadcastPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAuth('admin')
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const payload = await getPayloadClient()

  const logs = await payload.find({
    collection: 'broadcast-log',
    sort: '-createdAt',
    limit: PAGE_SIZE,
    page,
    depth: 1,
    overrideAccess: true,
  })
  const history = logs.docs as BroadcastLogEntry[]

  const withReadCounts = await Promise.all(
    history.map(async (log) => {
      const [deliveredCount, openedCount] = await Promise.all([
        payload.count({ collection: 'notifications', where: { campaign_id: { equals: Number(log.id) } }, overrideAccess: true }),
        payload.count({ collection: 'notifications', where: { campaign_id: { equals: Number(log.id) }, read: { equals: true } }, overrideAccess: true }),
      ])
      return { log, delivered: deliveredCount.totalDocs, opened: openedCount.totalDocs }
    }),
  )

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <BackstageHeader
        title="Körüzenet"
        subtitle={`Egyszerre minden (vagy szűrt) userednek a dashboard-harangjába · ${logs.totalDocs} kampány eddig`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_1.3fr] lg:items-start">
        <BroadcastForm />

        <div className="rounded-[26px] p-2.5 dav-card-glass">
          <p className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
            Korábbi körüzenetek
          </p>
          {withReadCounts.length === 0 ? (
            <p className="px-4 pb-6 text-[13.5px] text-ink-soft">Még nem küldtél körüzenetet.</p>
          ) : (
            <div>
              {withReadCounts.map(({ log, delivered, opened }, i) => {
                const sender = typeof log.sent_by === 'object' ? (log.sent_by as User) : null
                return (
                  <div key={log.id} className={i > 0 ? 'border-t border-line' : ''}>
                    <BroadcastHistoryRow
                      id={String(log.id)}
                      title={log.title}
                      body={log.body}
                      target={log.target}
                      createdAt={new Date(log.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      senderLabel={sender ? (sender.name || sender.email) : null}
                      delivered={delivered}
                      opened={opened}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {logs.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <Link
                href={`/backstage/broadcast?page=${page - 1}`}
                aria-disabled={!logs.hasPrevPage}
                className={`flex items-center gap-1 text-[12px] font-medium ${logs.hasPrevPage ? 'text-ink hover:underline' : 'pointer-events-none text-ink-soft2'}`}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Előző
              </Link>
              <span className="text-[11.5px] text-ink-soft2">{page} / {logs.totalPages}</span>
              <Link
                href={`/backstage/broadcast?page=${page + 1}`}
                aria-disabled={!logs.hasNextPage}
                className={`flex items-center gap-1 text-[12px] font-medium ${logs.hasNextPage ? 'text-ink hover:underline' : 'pointer-events-none text-ink-soft2'}`}
              >
                Következő <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
