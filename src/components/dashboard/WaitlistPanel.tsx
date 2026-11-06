import { getPayloadClient } from '@/lib/payload'
import { Clock } from 'lucide-react'
import { Card, CardTitle, ListRow, Meta, Pill } from '@/components/ui-kit'
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
    <Card>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-ui-muted" />
        <CardTitle>Várólista</CardTitle>
        <Meta className="ml-auto">{entries.length} bejegyzés</Meta>
      </div>
      <div className="mt-2">
        {entries.map((w) => (
          <ListRow
            key={w.id}
            title={w.customer_name}
            meta={[`${w.date} · ${w.time}`, w.pax != null ? `${w.pax} fő` : null, w.customer_phone].filter(Boolean).join(' · ')}
            trailing={<Pill tone="cell" size="sm">{STATUS_LABEL[w.status] ?? w.status}</Pill>}
          />
        ))}
      </div>
    </Card>
  )
}
