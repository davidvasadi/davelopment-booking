import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const sp = request.nextUrl.searchParams
  const locale = (sp.get('locale') as 'hu' | 'en') ?? undefined
  const fallbackParam = sp.get('fallback-locale')
  const fallbackLocale = fallbackParam === 'null' || fallbackParam === 'false' ? false : undefined
  const payload = await getPayloadClient()
  try {
    const doc = await payload.findByID({
      collection: 'service-categories',
      id,
      depth: 0,
      locale,
      fallbackLocale,
      overrideAccess: true,
    })
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
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const payload = await getPayloadClient()

  const existing = await payload.findByID({ collection: 'service-categories', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const denied = await assertCapability(user.id, 'salon', existing.salon, 'catalog.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const doUpdate = () => payload.update({
    collection: 'service-categories',
    id,
    data: body as never,
    locale,
    overrideAccess: true,
  })
  try {
    // Payload v3/Drizzle locales-join bug: `_locale`/`_parent_id` leak into validation a
    // localizált kollekció ELSŐ update-hívásánál — a második próbálkozás mindig sikeres.
    const doc = await doUpdate()
    return NextResponse.json({ doc })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'ValidationError') {
      try {
        const doc = await doUpdate()
        return NextResponse.json({ doc })
      } catch (e2) {
        console.error('[api/service-categories PATCH]', e2)
        return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
      }
    }
    console.error('[api/service-categories PATCH]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const payload = await getPayloadClient()

  const existing = await payload.findByID({ collection: 'service-categories', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const denied = await assertCapability(user.id, 'salon', existing.salon, 'catalog.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  // Ellenőrzés: van-e a kategóriához rendelt szolgáltatás? (NOT NULL FK miatt nem törölhető ha igen)
  const servicesInCat = await payload.find({
    collection: 'services',
    where: { category: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (servicesInCat.totalDocs > 0) {
    return NextResponse.json(
      { error: `A kategóriában ${servicesInCat.totalDocs} szolgáltatás van. Töröld vagy rendeld át őket, mielőtt a kategóriát törlöd.` },
      { status: 409 },
    )
  }

  try {
    await payload.delete({ collection: 'service-categories', id, overrideAccess: true })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/service-categories DELETE]', e)
    return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
  }
}
