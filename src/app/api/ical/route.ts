import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getPayloadClient } from '@/lib/payload'

function icalToken(type: string, id: string) {
  const secret = process.env.PAYLOAD_SECRET ?? 'dev-secret'
  return createHmac('sha256', secret).update(`ical-${type}-${id}`).digest('hex').slice(0, 24)
}

function esc(s: string) {
  return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
}

function dtStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
}

function dt(date: string, time?: string) {
  const d = date.replace(/-/g, '')
  if (!time) return `${d}`
  const t = time.replace(':', '') + '00'
  return `${d}T${t}00`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') ?? ''
  const type = searchParams.get('type') ?? 'salon'
  const token = searchParams.get('token') ?? ''

  if (!id || token !== icalToken(type, id)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const payload = await getPayloadClient()
  const businessId = Number(id)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//davelopment booking//HU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Europe/Budapest',
  ]

  if (type === 'salon') {
    const salon = await payload.findByID({ collection: 'salons', id: businessId, depth: 0, overrideAccess: true })
    lines.push(`X-WR-CALNAME:${esc(salon.name ?? 'Foglalások')}`)
    const bookings = await payload.find({
      collection: 'bookings',
      where: { salon: { equals: businessId } },
      limit: 500, depth: 1, overrideAccess: true,
      sort: '-date',
    })
    for (const b of bookings.docs) {
      const service = typeof b.service === 'object' && b.service ? (b.service as { name?: string }).name ?? 'Foglalás' : 'Foglalás'
      const staff = typeof b.staff === 'object' && b.staff ? (b.staff as { name?: string }).name : null
      const summary = staff ? `${service} – ${staff}` : service
      lines.push(
        'BEGIN:VEVENT',
        `UID:booking-${b.id}@davelopment`,
        `DTSTAMP:${dtStamp()}`,
        `DTSTART:${dt(b.date, b.start_time)}`,
        `DTEND:${dt(b.date, b.end_time ?? b.start_time)}`,
        `SUMMARY:${esc(summary)}`,
        b.customer_name ? `DESCRIPTION:${esc(b.customer_name)}${b.customer_phone ? ` · ${esc(b.customer_phone)}` : ''}` : '',
        `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : b.status === 'cancelled' ? 'CANCELLED' : 'TENTATIVE'}`,
        'END:VEVENT',
      )
    }
  } else {
    const restaurant = await payload.findByID({ collection: 'restaurants', id: businessId, depth: 0, overrideAccess: true })
    lines.push(`X-WR-CALNAME:${esc((restaurant as unknown as { name?: string }).name ?? 'Foglalások')}`)
    const reservations = await payload.find({
      collection: 'reservations',
      where: { restaurant: { equals: businessId } },
      limit: 500, depth: 0, overrideAccess: true,
      sort: '-date',
    })
    for (const r of reservations.docs) {
      const summary = `${esc(r.customer_name ?? 'Vendég')} (${r.pax ?? 1} fő)`
      lines.push(
        'BEGIN:VEVENT',
        `UID:reservation-${r.id}@davelopment`,
        `DTSTAMP:${dtStamp()}`,
        `DTSTART:${dt(r.date, r.start_time)}`,
        `DTEND:${dt(r.date, r.end_time ?? r.start_time)}`,
        `SUMMARY:${summary}`,
        r.customer_phone ? `DESCRIPTION:${esc(r.customer_phone)}` : '',
        `STATUS:${r.status === 'confirmed' ? 'CONFIRMED' : r.status === 'cancelled' ? 'CANCELLED' : 'TENTATIVE'}`,
        'END:VEVENT',
      )
    }
  }

  lines.push('END:VCALENDAR')
  const ics = lines.filter(Boolean).join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="foglalasok.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
