import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

async function ownsThisSalon(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  user: { id: string | number; role?: string },
  salonId: unknown,
): Promise<boolean> {
  if (user.role === 'admin') return true
  const sid = salonId && typeof salonId === 'object' ? (salonId as { id: unknown }).id : salonId
  if (sid == null) return false
  try {
    const salon = await payload.findByID({ collection: 'salons', id: sid as string | number, depth: 0, overrideAccess: true })
    const ownerId = salon?.owner && typeof salon.owner === 'object' ? (salon.owner as { id: unknown }).id : salon?.owner
    return String(ownerId) === String(user.id)
  } catch {
    return false
  }
}

/**
 * GET  /api/availability  — lista lekérése (StaffCalendarSheet)
 * POST /api/availability  — naptár-kivétel létrehozása
 *
 * A Payload beépített REST API-ján a CSRF/access check blokkolja a POST-ot a kliens-oldali
 * kéréseknél, ezért saját route-on kezeljük (overrideAccess + manuális auth).
 */

export async function GET(request: NextRequest) {
  const payload = await getPayloadClient()
  const searchParams = request.nextUrl.searchParams

  const where: Record<string, unknown> = {}
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('where[')) {
      const match = key.match(/^where\[(\w+)\]\[(\w+)\]$/)
      if (match) {
        const [, field, op] = match
        if (!where[field]) where[field] = {}
        let parsed: unknown = value
        if (value === 'true') parsed = true
        else if (value === 'false') parsed = false
        else if (value !== '' && !isNaN(Number(value))) parsed = Number(value)
        ;(where[field] as Record<string, unknown>)[op] = parsed
      }
    }
  }

  const limit = Number(searchParams.get('limit') ?? 300)

  const res = await payload.find({
    collection: 'availability',
    where: Object.keys(where).length ? where as never : undefined,
    limit,
    depth: 0,
    overrideAccess: true,
  })
  return NextResponse.json(res)
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const salonId = body.salon
  if (!salonId) return NextResponse.json({ error: 'salon kötelező' }, { status: 400 })

  const payload = await getPayloadClient()
  const owns = await ownsThisSalon(payload, user, salonId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    const doc = await payload.create({
      collection: 'availability',
      data: body as never,
      overrideAccess: true,
      user,
    })
    return NextResponse.json({ doc }, { status: 201 })
  } catch (e) {
    console.error('[api/availability POST]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}
