import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, authOrUnauthorized } from '@/lib/salonRouteAuth'

export async function GET(request: NextRequest) {
  const payload = await getPayloadClient()
  const sp = request.nextUrl.searchParams
  const salonId = sp.get('where[salon][equals]')
  const res = await payload.find({
    collection: 'service-categories',
    where: salonId ? { salon: { equals: Number(salonId) } } : undefined,
    sort: (sp.get('sort') as never) ?? 'sort_order',
    depth: 0,
    limit: Number(sp.get('limit') ?? 100),
    overrideAccess: true,
  })
  return NextResponse.json(res)
}

export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

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
      collection: 'service-categories',
      data: body as never,
      overrideAccess: true,
    })
    return NextResponse.json({ doc }, { status: 201 })
  } catch (e) {
    console.error('[api/service-categories POST]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}
