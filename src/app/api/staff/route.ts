import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon } from '@/payload/payload-types'

/**
 * Szalon-munkatárs LÉTREHOZÁSA. A StaffManager ide POST-ol (`{ ...data, salon, avatar }`).
 * Kritikus: a Postgres-relationship SZÁMOT vár, a kliens viszont STRING id-t küld — coerce
 * kell, különben ValidationError-ral bukik (ugyanaz a hiba, mint a tasks/invite flow-knál).
 * Defenzív: csak a szalon tulaja hozhat létre munkatársat.
 */
const num = (v: unknown) => (/^\d+$/.test(String(v)) ? Number(v) : v)

async function assertSalonOwner(salonId: unknown, userId: string | number): Promise<string | null> {
  const payload = await getPayloadClient()
  try {
    const s = (await payload.findByID({ collection: 'salons', id: salonId as string, depth: 0, overrideAccess: true })) as Salon
    const ownerId = typeof s.owner === 'object' && s.owner ? s.owner.id : s.owner
    if (String(ownerId) !== String(userId)) return 'Nincs jogosultság ehhez a szalonhoz'
    return null
  } catch {
    return 'A szalon nem található'
  }
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

  if (!body.salon) return NextResponse.json({ error: 'Hiányzó szalon' }, { status: 400 })
  const ownerErr = await assertSalonOwner(body.salon, user.id)
  if (ownerErr) return NextResponse.json({ error: ownerErr }, { status: 403 })

  const payload = await getPayloadClient()
  const locale = request.nextUrl.searchParams.get('locale') || undefined
  const data: Record<string, unknown> = {
    ...body,
    salon: num(body.salon),
    ...(body.avatar != null ? { avatar: num(body.avatar) } : {}),
  }

  try {
    const doc = await payload.create({
      collection: 'staff',
      data: data as never,
      overrideAccess: true,
      ...(locale ? { locale: locale as never } : {}),
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    console.error('[api/staff POST] create failed', e)
    return NextResponse.json({ error: 'A munkatárs mentése sikertelen' }, { status: 500 })
  }
}
