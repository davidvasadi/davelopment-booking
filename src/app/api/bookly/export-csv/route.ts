import { NextRequest, NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Booking, Service, StaffMember } from '@/payload/payload-types'

const VALID_DAYS = [7, 30, 90, 180, 365]

const STATUS_LABEL: Record<string, string> = {
  pending: 'Függő',
  confirmed: 'Megerősített',
  cancelled: 'Lemondott',
  completed: 'Befejezett',
}

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'salon_owner' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
    overrideAccess: true,
  })
  const salon = salonResult.docs[0] as Salon
  if (!salon) return NextResponse.json({ error: 'Salon not found' }, { status: 404 })

  const daysParam = Number(req.nextUrl.searchParams.get('days'))
  const days = VALID_DAYS.includes(daysParam) ? daysParam : 30
  const since = format(subDays(new Date(), days - 1), 'yyyy-MM-dd')

  const result = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { salon: { equals: salon.id } },
        { date: { greater_than_equal: since } },
      ],
    },
    sort: 'date',
    depth: 2,
    limit: 5000,
    overrideAccess: true,
  })

  const rows: string[] = [
    ['Dátum', 'Időpont', 'Ügyfél', 'Email', 'Telefon', 'Szolgáltatás', 'Munkatárs', 'Időtartam (perc)', 'Ár (Ft)', 'Státusz'].join(','),
  ]

  for (const b of result.docs as Booking[]) {
    const svc = b.service as Service | null
    const staff = b.staff as StaffMember | null
    rows.push([
      escapeCsv(b.date),
      escapeCsv(b.start_time),
      escapeCsv(b.customer_name),
      escapeCsv(b.customer_email),
      escapeCsv(b.customer_phone),
      escapeCsv(typeof svc === 'object' ? svc?.name : ''),
      escapeCsv(typeof staff === 'object' ? staff?.name : ''),
      escapeCsv(typeof svc === 'object' ? svc?.duration_minutes : ''),
      escapeCsv(typeof svc === 'object' ? svc?.price : ''),
      escapeCsv(STATUS_LABEL[b.status] ?? b.status),
    ].join(','))
  }

  const csv = rows.join('\n')
  const filename = `bookly-foglalasok-${since}_${format(new Date(), 'yyyy-MM-dd')}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
