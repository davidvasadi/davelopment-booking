import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, authOrUnauthorized } from '@/lib/salonRouteAuth'

export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const salonId = body.salon
  if (!salonId) return NextResponse.json({ error: 'salon kötelező' }, { status: 400 })

  const payload = await getPayloadClient()
  if (!await ownsThisSalon(payload, user, salonId))
    return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    const doc = await payload.create({ collection: 'services', data: body as never, overrideAccess: true })
    return NextResponse.json({ doc }, { status: 201 })
  } catch (e) {
    console.error('[api/services POST]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}
