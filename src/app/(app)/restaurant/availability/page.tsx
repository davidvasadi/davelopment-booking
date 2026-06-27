import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { OpeningHoursEditor } from '@/components/restaurant/OpeningHoursEditor'
import { OpeningHoursExceptions, type Exception } from '@/components/restaurant/OpeningHoursExceptions'
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/restaurantTemplates'
import type { OpeningHour } from '@/payload/payload-types'
import { PageHeader } from '@/components/ui/page-header'

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
    <div className="p-5 lg:p-10 space-y-6 lg:space-y-8 max-w-2xl lg:max-w-none">
      <PageHeader
        eyebrow="Mely napokon fogadtok foglalást"
        title="Nyitvatartás"
        description="Állítsd be naponként, mikor fogadtok foglalásokat. A változások automatikusan menthetők."
      />
      <OpeningHoursEditor restaurantId={restaurant.id} initialDays={days} />

      <div className="pt-2">
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">
          Ünnepnapok és eltérő nyitvatartás
        </p>
        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Kivételek</h2>
        <p className="mt-2 mb-5 text-sm text-zinc-500 dark:text-white/40">
          Jelölj meg a naptárban napokat, amikor kivételesen zárva vagytok, vagy eltérő a nyitvatartás. Ezek felülírják a heti rendet.
        </p>
        <OpeningHoursExceptions restaurantId={restaurant.id} initial={exceptions} />
      </div>
    </div>
  )
}
