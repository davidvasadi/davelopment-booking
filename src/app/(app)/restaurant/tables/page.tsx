import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { TablesManager } from '@/components/restaurant/TablesManager'
import type { Room, Table } from '@/payload/payload-types'

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

  const flatMode = restaurant.capacity_mode === 'flat'

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">
          {flatMode ? 'Összesített kapacitás' : 'Termek és asztalok'}
        </p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Asztalok</h1>
      </div>

      {flatMode ? (
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            Az étterem <strong>egyszerű (flat)</strong> kapacitás-módban van. Az asztaltérkép a Beállításoknál
            kapcsolható át „Asztalok szerint” módra.
          </p>
        </div>
      ) : (
        <TablesManager
          restaurantId={restaurant.id}
          initialRooms={rooms.map((r) => ({ id: r.id, name: r.name, sort_order: r.sort_order ?? 0 }))}
          initialTables={tables.map((t) => ({
            id: t.id,
            name: t.name,
            capacity: t.capacity,
            room: typeof t.room === 'object' && t.room ? t.room.id : (t.room ?? null),
            sort_order: t.sort_order ?? 0,
          }))}
        />
      )}
    </div>
  )
}
