import { NextRequest, NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type {
  Salon,
  Restaurant,
  Booking,
  Reservation,
  Service,
  StaffMember,
  Table,
} from '@/payload/payload-types'

const VALID_DAYS = [1, 7, 30, 90, 180, 365]

const STATUS_LABEL: Record<string, string> = {
  pending: 'Függő',
  confirmed: 'Megerősített',
  cancelled: 'Lemondott',
  completed: 'Befejezett',
  seated: 'Leültetve',
  no_show: 'Nem jött meg',
}

const SOURCE_LABEL: Record<string, string> = {
  online: 'Online',
  walk_in: 'Beeső',
  phone: 'Telefon',
}

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** A perc-eltérés két HH:mm időpont közt (egész nap nélkül). */
function diffMinutes(start?: string | null, end?: string | null): number | '' {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return ''
  return eh * 60 + em - (sh * 60 + sm)
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'salon_owner' && user.role !== 'restaurant_owner' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayloadClient()

  const daysParam = Number(req.nextUrl.searchParams.get('days'))
  const days = VALID_DAYS.includes(daysParam) ? daysParam : 30
  const since = format(subDays(new Date(), days - 1), 'yyyy-MM-dd')

  // Az AKTÍV üzlet a forrás (több-üzletnél a cookie-ból), nem az első owner-találat.
  const { active } = await getActiveBusiness(user)
  const moduleParam = req.nextUrl.searchParams.get('module')
  const isRestaurant = active
    ? active.type === 'restaurant'
    : moduleParam === 'restaurant' || (moduleParam == null && user.role === 'restaurant_owner')

  let rows: string[]

  if (isRestaurant) {
    const restaurant = active
      ? ((await payload.findByID({ collection: 'restaurants', id: active.id, overrideAccess: true })) as Restaurant)
      : ((await payload.find({ collection: 'restaurants', where: { owner: { equals: user.id } }, limit: 1, overrideAccess: true })).docs[0] as Restaurant)
    if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

    const reservations = await payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurant.id } },
          { date: { greater_than_equal: since } },
        ],
      },
      sort: 'date',
      depth: 2,
      limit: 5000,
      overrideAccess: true,
    })

    rows = [
      ['Dátum', 'Időpont', 'Vége', 'Fő', 'Asztal', 'Vendég', 'Email', 'Telefon', 'Forrás', 'Időtartam (perc)', 'Státusz'].join(','),
    ]
    for (const r of reservations.docs as Reservation[]) {
      const tableNames = (r.tables ?? [])
        .map((t) => (typeof t === 'object' && t ? (t as Table).name : ''))
        .filter(Boolean)
        .join(' + ')
      rows.push([
        escapeCsv(r.date),
        escapeCsv(r.start_time),
        escapeCsv(r.end_time),
        escapeCsv(r.pax),
        escapeCsv(tableNames),
        escapeCsv(r.customer_name),
        escapeCsv(r.customer_email),
        escapeCsv(r.customer_phone),
        escapeCsv(SOURCE_LABEL[r.source] ?? r.source),
        escapeCsv(diffMinutes(r.start_time, r.end_time)),
        escapeCsv(STATUS_LABEL[r.status] ?? r.status),
      ].join(','))
    }
  } else {
    const salon = active
      ? ((await payload.findByID({ collection: 'salons', id: active.id, overrideAccess: true })) as Salon)
      : ((await payload.find({ collection: 'salons', where: { owner: { equals: user.id } }, limit: 1, overrideAccess: true })).docs[0] as Salon)
    if (!salon) return NextResponse.json({ error: 'Salon not found' }, { status: 404 })

    const bookings = await payload.find({
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

    rows = [
      ['Dátum', 'Időpont', 'Ügyfél', 'Email', 'Telefon', 'Szolgáltatás', 'Munkatárs', 'Időtartam (perc)', 'Ár (Ft)', 'Státusz'].join(','),
    ]
    for (const b of bookings.docs as Booking[]) {
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
  }

  const csv = rows.join('\n')
  const filename = `schedulio-foglalasok-${since}_${format(new Date(), 'yyyy-MM-dd')}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
