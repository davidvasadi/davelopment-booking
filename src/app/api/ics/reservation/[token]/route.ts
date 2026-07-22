import { getPayloadClient } from '@/lib/payload'
import type { Reservation, Restaurant } from '@/payload/payload-types'

function buildICS({ uid, date, startTime, endTime, summary, location, description }: {
  uid: string; date: string; startTime: string; endTime: string
  summary: string; location?: string; description?: string
}): string {
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  const [y, m, d] = date.split('-')
  const [sh, sm] = startTime.split(':')
  const [eh, em] = endTime.split(':')
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//davelopment booking//HU',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Budapest:${y}${m}${d}T${sh}${sm}00`,
    `DTEND;TZID=Europe/Budapest:${y}${m}${d}T${eh}${em}00`,
    `SUMMARY:${summary}`,
    ...(location ? [`LOCATION:${location}`] : []),
    ...(description ? [`DESCRIPTION:${description}`] : []),
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return new Response('Not found', { status: 404 })

  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'reservations',
    where: { cancel_token: { equals: token } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })

  const reservation = res.docs[0] as Reservation & { cancel_token?: string } | undefined
  if (!reservation) return new Response('Not found', { status: 404 })

  const restaurant = typeof reservation.restaurant === 'object' ? reservation.restaurant as Restaurant : null
  const restaurantName = restaurant?.name ?? 'Foglalás'
  const location = restaurant?.address ? `${restaurant.address}${restaurant.city ? ', ' + restaurant.city : ''}` : ''
  const description = `${reservation.pax} fő${restaurant?.phone ? '\\nTelefon: ' + restaurant.phone : ''}`

  const ics = buildICS({
    uid: `reservation-${reservation.id}@davelopment`,
    date: reservation.date,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    summary: `Asztalfoglalás – ${restaurantName}`,
    location,
    description,
  })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="foglalas.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
