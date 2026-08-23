import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'

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
  const denied = await assertCapability(user.id, 'salon', salonId as string, 'catalog.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  try {
    const doc = await payload.create({ collection: 'services', data: body as never, overrideAccess: true })
    return NextResponse.json({ doc }, { status: 201 })
  } catch (e) {
    console.error('[api/services POST]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}
