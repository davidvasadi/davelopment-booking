import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability, assertOwner, capabilitiesForBusiness } from '@/lib/apiCapability'
import { can, ALL_CAPABILITIES, type Capability } from '@/lib/permissions'

/**
 * EGYEDI SZEREPEK (2. fázis) — CRUD. Üzletenként (szalon/étterem) a tulaj/vezető definiálhat
 * saját jogosultság-szerepeket (pl. „Supervisor"). Anti-eszkaláció: a szerep NEM adhat több
 * jogot, mint amennyivel a létrehozó maga rendelkezik.
 */
const num = (v: unknown) => (/^\d+$/.test(String(v)) ? Number(v) : v)

function cleanCaps(input: unknown): Capability[] {
  if (!Array.isArray(input)) return []
  return input.filter((c): c is Capability => ALL_CAPABILITIES.includes(c as Capability))
}

type BookingNotifyLevel = 'off' | 'own' | 'all'
function cleanBookingNotifyLevel(input: unknown): BookingNotifyLevel {
  return input === 'own' || input === 'all' ? input : 'off'
}

// GET /api/roles?type=salon|restaurant&id=... → az üzlet egyedi szerepei
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const type = request.nextUrl.searchParams.get('type')
  const id = request.nextUrl.searchParams.get('id')
  if ((type !== 'salon' && type !== 'restaurant') || !id) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })

  const denied = await assertCapability(user.id, type, id, 'team.view')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'roles',
    where: { [type]: { equals: id } },
    sort: 'name',
    limit: 100,
    overrideAccess: true,
  })
  return NextResponse.json({ roles: res.docs })
}

// POST /api/roles → { type, id, name, capabilities: Capability[] }
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { type?: string; id?: string; name?: string; description?: unknown; capabilities?: unknown; booking_notify_level?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  const type = body.type
  const id = body.id
  if ((type !== 'salon' && type !== 'restaurant') || !id) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })

  // Szerep LÉTREHOZÁSA szándékosan owner-only — lásd `assertOwner` kommentjét.
  const denied = await assertOwner(user.id, type, id)
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'A szerep neve kötelező' }, { status: 400 })

  // Anti-eszkaláció: csak olyan jogot adhat a szerepnek, amivel maga is rendelkezik.
  const mine = await capabilitiesForBusiness(user.id, type, id)
  const caps = cleanCaps(body.capabilities).filter((c) => can(mine, c))
  // "Csak a sajátja" csak szalonnál értelmezhető (a foglalás ott van szakemberhez kötve) —
  // étteremnél nincs mit "sajátra" szűkíteni, konzervatívan kikapcsolva marad.
  let bookingNotifyLevel = cleanBookingNotifyLevel(body.booking_notify_level)
  if (type === 'restaurant' && bookingNotifyLevel === 'own') bookingNotifyLevel = 'off'

  const payload = await getPayloadClient()
  try {
    const doc = await payload.create({
      collection: 'roles',
      data: { name, description: typeof body.description === 'string' ? body.description.trim().slice(0, 200) : null, capabilities: caps, booking_notify_level: bookingNotifyLevel, [type]: num(id) } as never,
      overrideAccess: true,
      user,
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    console.error('[api/roles POST] create failed', e)
    return NextResponse.json({ error: 'A szerep mentése sikertelen' }, { status: 500 })
  }
}
