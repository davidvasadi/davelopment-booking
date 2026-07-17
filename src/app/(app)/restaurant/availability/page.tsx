import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { AvailabilityView } from '@/components/restaurant/AvailabilityView'
import { type Exception } from '@/components/restaurant/OpeningHoursExceptions'
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/restaurantTemplates'
import type { OpeningHour } from '@/payload/payload-types'

export default async function RestaurantAvailabilityPage() {
  const { restaurant, capabilities } = await getOwnedRestaurant()
  requireCapability(capabilities, 'settings.profile', '/restaurant')
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

  // ── Hőtérkép óra-tartomány a TÉNYLEGES nyitvatartásból (legkorábbi nyitás → legkésőbbi zárás) ──
  const openDays = days.filter((d) => d.is_open)
  let hStart = 24
  let hEnd = 0
  for (const d of openDays) {
    const oh = Number(d.open_time.split(':')[0])
    const [chRaw, cmRaw] = d.close_time.split(':').map(Number)
    let closeHour = (chRaw || 0) + ((cmRaw || 0) > 0 ? 1 : 0)
    if (d.close_time === '00:00' || closeHour === 0) closeHour = 24 // éjfél
    if (Number.isFinite(oh)) hStart = Math.min(hStart, oh)
    hEnd = Math.max(hEnd, closeHour)
  }
  if (hStart >= hEnd) { hStart = 10; hEnd = 22 } // fallback, ha minden nap zárva
  const heatStartHour = Math.max(0, hStart)
  const hourCount = Math.min(Math.min(24, hEnd) - heatStartHour, 18) // biztonsági felső korlát

  // ── Hőtérkép: utolsó ~4 hét foglalásaiból nap×óra intenzitás (a nyitvatartás órái) ──
  const since = new Date()
  since.setDate(since.getDate() - 28)
  const sinceStr = since.toISOString().slice(0, 10)
  const resvRes = await payload.find({
    collection: 'reservations',
    where: {
      restaurant: { equals: restaurant.id },
      date: { greater_than_equal: sinceStr },
      status: { not_in: ['cancelled', 'no_show'] },
    },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })
  // heat[weekdayMon0][hourIndex 0..hourCount-1 => heatStartHour..]
  const heat: number[][] = Array.from({ length: 7 }, () => Array(hourCount).fill(0))
  let heatTotal = 0
  for (const r of resvRes.docs as Array<{ date?: string; start_time?: string }>) {
    if (!r.date || !r.start_time) continue
    const d = new Date(r.date + 'T00:00:00')
    if (Number.isNaN(d.getTime())) continue
    const weekday = (d.getDay() + 6) % 7 // Mon=0
    const hour = Number(r.start_time.split(':')[0])
    if (Number.isNaN(hour)) continue
    const hi = hour - heatStartHour
    if (hi < 0 || hi >= hourCount) continue
    heat[weekday][hi] += 1
    heatTotal += 1
  }

  return (
    <AvailabilityView
      restaurantId={restaurant.id}
      days={days}
      exceptions={exceptions}
      turnMinutes={restaurant.turn_duration_minutes ?? null}
      lastSeatingBuffer={restaurant.last_seating_buffer_minutes ?? null}
      bookingWindowDays={restaurant.booking_window_days ?? null}
      heat={heat}
      heatTotal={heatTotal}
      heatStartHour={heatStartHour}
    />
  )
}
