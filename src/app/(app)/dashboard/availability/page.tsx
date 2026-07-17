import { getOwnedSalon } from '@/lib/salonContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { SalonAvailabilityView } from '@/components/dashboard/SalonAvailabilityView'
import { type SalonException } from '@/components/dashboard/SalonAvailabilityExceptions'
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/restaurantTemplates'
import type { Availability } from '@/payload/payload-types'

export default async function AvailabilityPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireCapability(capabilities, 'settings.profile', '/dashboard')
  const payload = await getPayloadClient()

  const [weeklyRes, excRes] = await Promise.all([
    payload.find({
      collection: 'availability',
      where: { and: [{ salon: { equals: salon.id } }, { staff: { exists: false } }, { exception_date: { exists: false } }] },
      limit: 100,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'availability',
      where: { and: [{ salon: { equals: salon.id } }, { staff: { exists: false } }, { exception_date: { exists: true } }] },
      limit: 200,
      overrideAccess: true,
    }),
  ])

  // Heti rend — minden naphoz a meglévő rekord (ha van), hét sorrendben
  const byDay = new Map((weeklyRes.docs as Availability[]).map((h) => [h.day_of_week, h]))
  const days = DAYS_OF_WEEK.map((d: DayOfWeek) => {
    const h = byDay.get(d)
    return {
      day_of_week: d,
      id: h?.id ?? null,
      is_available: h?.is_available ?? false,
      start_time: h?.start_time ?? '09:00',
      end_time: h?.end_time ?? '18:00',
    }
  })

  // Eltérő napok
  const exceptions: SalonException[] = (excRes.docs as Availability[])
    .filter((e) => !!e.exception_date)
    .map((e) => ({
      id: e.id,
      date: e.exception_date as string,
      is_closed: !(e.is_available ?? false),
      open_time: e.start_time,
      close_time: e.end_time,
    }))

  // ── Hőtérkép óra-tartomány a tényleges nyitvatartásból (legkorábbi nyitás → legkésőbbi zárás) ──
  const openDays = days.filter((d) => d.is_available)
  let hStart = 24
  let hEnd = 0
  for (const d of openDays) {
    const oh = Number(d.start_time.split(':')[0])
    const [chRaw, cmRaw] = d.end_time.split(':').map(Number)
    let closeHour = (chRaw || 0) + ((cmRaw || 0) > 0 ? 1 : 0)
    if (d.end_time === '00:00' || closeHour === 0) closeHour = 24
    if (Number.isFinite(oh)) hStart = Math.min(hStart, oh)
    hEnd = Math.max(hEnd, closeHour)
  }
  if (hStart >= hEnd) { hStart = 9; hEnd = 19 }
  const heatStartHour = Math.max(0, hStart)
  const hourCount = Math.min(Math.min(24, hEnd) - heatStartHour, 18)

  // ── Hőtérkép: utolsó ~4 hét foglalásaiból nap×óra intenzitás ──
  const since = new Date()
  since.setDate(since.getDate() - 28)
  const sinceStr = since.toISOString().slice(0, 10)
  const bookingsRes = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { salon: { equals: salon.id } },
        { date: { greater_than_equal: sinceStr } },
        { status: { not_equals: 'cancelled' } },
      ],
    },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })
  const heat: number[][] = Array.from({ length: 7 }, () => Array(Math.max(1, hourCount)).fill(0))
  let heatTotal = 0
  for (const b of bookingsRes.docs as Array<{ date?: string; start_time?: string }>) {
    if (!b.date || !b.start_time) continue
    const d = new Date(b.date + 'T00:00:00')
    if (Number.isNaN(d.getTime())) continue
    const weekday = (d.getDay() + 6) % 7 // Mon=0
    const hour = Number(b.start_time.split(':')[0])
    if (Number.isNaN(hour)) continue
    const hi = hour - heatStartHour
    if (hi < 0 || hi >= hourCount) continue
    heat[weekday][hi] += 1
    heatTotal += 1
  }

  return (
    <SalonAvailabilityView
      salonId={salon.id}
      days={days}
      exceptions={exceptions}
      bufferMinutes={salon.booking_buffer_minutes ?? null}
      bookingWindowDays={salon.booking_window_days ?? null}
      heat={heat}
      heatTotal={heatTotal}
      heatStartHour={heatStartHour}
    />
  )
}
