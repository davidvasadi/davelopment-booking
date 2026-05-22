import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { OpeningHoursEditor } from '@/components/restaurant/OpeningHoursEditor'
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/restaurantTemplates'
import type { OpeningHour } from '@/payload/payload-types'

export default async function RestaurantAvailabilityPage() {
  const { restaurant } = await getOwnedRestaurant()
  const payload = await getPayloadClient()

  const res = await payload.find({
    collection: 'opening-hours',
    where: { restaurant: { equals: restaurant.id } },
    limit: 100,
    overrideAccess: true,
  })
  const existing = res.docs as OpeningHour[]

  // Minden naphoz társítjuk a meglévő rekordot (ha van), hét sorrendben
  const byDay = new Map(existing.map((h) => [h.day_of_week, h]))
  const days = DAYS_OF_WEEK.map((d: DayOfWeek) => {
    const h = byDay.get(d)
    return {
      day_of_week: d,
      id: h?.id ?? null,
      is_open: h?.is_open ?? false,
      open_time: h?.open_time ?? '11:00',
      close_time: h?.close_time ?? '22:00',
    }
  })

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">
          Mely napokon fogadtok foglalást
        </p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Nyitvatartás</h1>
      </div>
      <OpeningHoursEditor restaurantId={restaurant.id} initialDays={days} />
    </div>
  )
}
