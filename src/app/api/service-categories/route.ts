import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'

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
  const denied = await assertCapability(user.id, 'salon', salonId as string, 'catalog.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

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
