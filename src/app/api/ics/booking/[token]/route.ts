import { getPayloadClient } from '@/lib/payload'
import type { Booking, Service, StaffMember, Salon } from '@/payload/payload-types'

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
    collection: 'bookings',
    where: { cancellation_token: { equals: token } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const booking = res.docs[0] as Booking & { cancellation_token?: string } | undefined
  if (!booking) return new Response('Not found', { status: 404 })

  const salon = typeof booking.salon === 'object' ? booking.salon as Salon : null
  const service = typeof booking.service === 'object' ? booking.service as Service : null
  const staff = typeof booking.staff === 'object' ? booking.staff as StaffMember : null

  const salonName = salon?.name ?? 'Foglalás'
  const serviceName = service?.name ?? 'Időpont'
  const staffName = staff?.name ?? ''
  const location = salon?.address ? `${salon.address}${salon.city ? ', ' + salon.city : ''}` : ''
  const description = `Munkatárs: ${staffName}\\nSzolgáltatás: ${serviceName}${salon?.phone ? '\\nTelefon: ' + salon.phone : ''}`

  const ics = buildICS({
    uid: `booking-${booking.id}@davelopment`,
    date: booking.date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    summary: `${serviceName} – ${salonName}`,
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
