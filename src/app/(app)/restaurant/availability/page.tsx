import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { OpeningHoursEditor } from '@/components/restaurant/OpeningHoursEditor'
import { OpeningHoursExceptions, type Exception } from '@/components/restaurant/OpeningHoursExceptions'
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

  const excRes = await payload.find({
    collection: 'opening-hours-exceptions',
    where: { restaurant: { equals: restaurant.id } },
    limit: 200,
    overrideAccess: true,
  })
  const exceptions = excRes.docs as unknown as Exception[]

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
      <OpeningHoursEditor restaurantId={restaurant.id} initialDays={days} turnMinutes={restaurant.turn_duration_minutes ?? null} />

      <OpeningHoursExceptions restaurantId={restaurant.id} initial={exceptions} />
    </div>
  )
}
