import { getPayloadClient } from '@/lib/payload'
import { Clock } from 'lucide-react'
import type { Waitlist } from '@/payload/payload-types'

/**
 * Minimális, olvasható várólista-lista a tulaj bookings-oldalára. Additív: csak akkor jelenít
 * meg bármit, ha van 'waiting'/'notified' bejegyzés. A saját üzletre szűr (salonId/restaurantId).
 */
const STATUS_LABEL: Record<string, string> = {
  waiting: 'Várakozik',
  notified: 'Értesítve',
  promoted: 'Foglalássá vált',
  expired: 'Lejárt',
}

export default async function WaitlistPanel({
  salonId,
  restaurantId,
}: {
  salonId?: string | number
  restaurantId?: string | number
}) {
  if (salonId == null && restaurantId == null) return null

  const payload = await getPayloadClient()
  const relField = salonId != null ? 'salon' : 'restaurant'
  const relId = salonId != null ? salonId : restaurantId!

  const res = await payload
    .find({
      collection: 'waitlist',
      where: {
        and: [{ [relField]: { equals: relId } }, { status: { in: 'waiting,notified' } }],
      },
      sort: '-createdAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  const entries = (res?.docs ?? []) as Waitlist[]
  if (entries.length === 0) return null

  return (
    <div className="rounded-[22px] dav-card-glass overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
        <Clock className="h-4 w-4 text-ink-soft" />
        <h2 className="text-sm font-semibold text-ink">Várólista</h2>
        <span className="ml-auto text-xs text-ink-soft">{entries.length} bejegyzés</span>
      </div>
      <ul className="divide-y divide-line">
        {entries.map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{w.customer_name}</p>
              <p className="truncate text-xs text-ink-soft">
                {w.date} · {w.time}
                {w.pax != null ? ` · ${w.pax} fő` : ''}
                {w.customer_phone ? ` · ${w.customer_phone}` : ''}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-soft">
              {STATUS_LABEL[w.status] ?? w.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
