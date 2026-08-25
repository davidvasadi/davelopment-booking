import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { ContactMessage } from '@/payload/payload-types'
import { BackstageHeader } from '@/components/backstage/BackstageUi'
import ContactMessageCard from './ContactMessageCard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

export default async function BackstageContactPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAuth('admin')
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const payload = await getPayloadClient()

  const [result, newCountResult] = await Promise.all([
    payload.find({
      collection: 'contact-messages',
      sort: '-createdAt',
      limit: PAGE_SIZE,
      page,
      depth: 0,
      overrideAccess: true,
    }),
    payload.count({
      collection: 'contact-messages',
      where: { status: { equals: 'new' } },
      overrideAccess: true,
    }),
  ])
  const messages = result.docs as ContactMessage[]

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <BackstageHeader
        title="Kapcsolat"
        subtitle={`${result.totalDocs} beérkezett üzenet · ${newCountResult.totalDocs} új`}
      />

      {messages.length === 0 ? (
        <div className="rounded-[26px] p-10 text-center dav-card-glass">
          <p className="text-[13.5px] text-ink-soft">Még nem érkezett kapcsolatfelvételi üzenet.</p>
        </div>
      ) : (
        <div className="rounded-[26px] p-2.5 dav-card-glass">
          <div className="space-y-3">
            {messages.map(m => (
              <ContactMessageCard key={m.id} message={m} />
            ))}
          </div>

          {result.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-2.5 pt-3">
              <Link
                href={`/backstage/contact?page=${page - 1}`}
                aria-disabled={!result.hasPrevPage}
                className={`flex items-center gap-1 text-[12px] font-medium ${result.hasPrevPage ? 'text-ink hover:underline' : 'pointer-events-none text-ink-soft2'}`}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Előző
              </Link>
              <span className="text-[11.5px] text-ink-soft2">{page} / {result.totalPages}</span>
              <Link
                href={`/backstage/contact?page=${page + 1}`}
                aria-disabled={!result.hasNextPage}
                className={`flex items-center gap-1 text-[12px] font-medium ${result.hasNextPage ? 'text-ink hover:underline' : 'pointer-events-none text-ink-soft2'}`}
              >
                Következő <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
