import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertCapability } from '@/lib/apiCapability'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const sp = request.nextUrl.searchParams
  const locale = (sp.get('locale') as 'hu' | 'en') ?? undefined
  // A dashboard fordítás-szerkesztője `fallback-locale=null`-lal kéri le a nyelvi tartalmat,
  // hogy ÜRESEN lássa a még le nem fordított mezőket (különben a HU-fallback becsapná: úgy
  // tűnne, mintha már le lenne fordítva, pedig csak a magyar szöveg jött vissza).
  const fallbackParam = sp.get('fallback-locale')
  const fallbackLocale = fallbackParam === 'null' || fallbackParam === 'false' ? false : undefined
  const payload = await getPayloadClient()
  try {
    const doc = await payload.findByID({ collection: 'services', id, depth: Number(sp.get('depth') ?? 1), locale, fallbackLocale, overrideAccess: true })
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

  const denied = await assertCapability(user.id, 'salon', existing.salon, 'catalog.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const doUpdate = () => payload.update({ collection: 'services', id, data: body as never, locale, overrideAccess: true })
  try {
    // Payload v3/Drizzle locales-join bug: `_locale`/`_parent_id` leak into validation a
    // localizált kollekció ELSŐ update-hívásánál (a `services.name`/`description` localized) —
    // a második próbálkozás mindig sikeres, ezért csendben újrapróbáljuk (ugyanaz a minta, mint
    // a szalon/étterem settings PATCH-nél).
    const doc = await doUpdate()
    return NextResponse.json({ doc })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'ValidationError') {
      try {
        const doc = await doUpdate()
        return NextResponse.json({ doc })
      } catch (e2) {
        console.error('[api/services PATCH]', e2)
        return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
      }
    }
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

  const denied = await assertCapability(user.id, 'salon', existing.salon, 'catalog.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  try {
    await payload.delete({ collection: 'services', id, overrideAccess: true })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/services DELETE]', e)
    return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
  }
}
