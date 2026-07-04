import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { TablesManager } from '@/components/restaurant/TablesManager'
import type { Room, Table } from '@/payload/payload-types'
import { PageHeader } from '@/components/ui/page-header'

export default async function RestaurantTablesPage() {
  const { restaurant } = await getOwnedRestaurant()
  const payload = await getPayloadClient()

  const [roomsRes, tablesRes] = await Promise.all([
    payload.find({
      collection: 'rooms',
      where: { restaurant: { equals: restaurant.id } },
      sort: 'sort_order',
      limit: 100,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'tables',
      where: { restaurant: { equals: restaurant.id } },
      sort: 'sort_order',
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const rooms = roomsRes.docs as Room[]
  const tables = tablesRes.docs as Table[]

  return (
    <div className="p-5 lg:p-0 space-y-6">
      <PageHeader eyebrow="Termek és asztalok" title="Asztalok" description="Termek és asztalok kezelése · húzd a sorrendhez" />

      <TablesManager
        restaurantId={restaurant.id}
        initialRooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          sort_order: r.sort_order ?? 0,
          is_outdoor: r.is_outdoor ?? false,
          seasonal: r.seasonal ?? false,
          season_start: r.season_start ?? null,
          season_end: r.season_end ?? null,
        }))}
        initialTables={tables.map((t) => ({
          id: t.id,
          name: t.name,
          capacity: t.capacity,
          room: typeof t.room === 'object' && t.room ? t.room.id : (t.room ?? null),
          sort_order: t.sort_order ?? 0,
          combinable_with: (t.combinable_with ?? []).map((c) => (typeof c === 'object' && c ? c.id : c)),
        }))}
      />
    </div>
  )
}
