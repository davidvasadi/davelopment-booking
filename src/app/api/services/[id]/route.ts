import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, authOrUnauthorized } from '@/lib/salonRouteAuth'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const sp = request.nextUrl.searchParams
  const locale = (sp.get('locale') as 'hu' | 'en') ?? undefined
  const payload = await getPayloadClient()
  try {
    const doc = await payload.findByID({ collection: 'services', id, depth: Number(sp.get('depth') ?? 1), locale, overrideAccess: true })
    return NextResponse.json(doc)
  } catch {
    return NextResponse.json({ error: 'Nem található' }, { status: 404 })
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const locale = (request.nextUrl.searchParams.get('locale') as 'hu' | 'en') ?? undefined

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'services', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  if (!await ownsThisSalon(payload, user, existing.salon))
    return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    const doc = await payload.update({ collection: 'services', id, data: body as never, locale, overrideAccess: true })
    return NextResponse.json({ doc })
  } catch (e) {
    console.error('[api/services PATCH]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'services', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  if (!await ownsThisSalon(payload, user, existing.salon))
    return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    await payload.delete({ collection: 'services', id, overrideAccess: true })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/services DELETE]', e)
    return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
  }
}
