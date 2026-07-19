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
 * PATCH  /api/availability/[id]  — naptár-kivétel frissítése
 * DELETE /api/availability/[id]  — naptár-kivétel törlése
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const { id } = await params
  const numId = Number(id)
  if (!numId) return NextResponse.json({ error: 'Érvénytelen ID' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'availability', id: numId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const owns = await ownsThisSalon(payload, user, existing.salon)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    const doc = await payload.update({
      collection: 'availability',
      id: numId,
      data: body as never,
      overrideAccess: true,
      user,
    })
    return NextResponse.json({ doc })
  } catch (e) {
    console.error('[api/availability PATCH]', e)
    return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const { id } = await params
  const numId = Number(id)
  if (!numId) return NextResponse.json({ error: 'Érvénytelen ID' }, { status: 400 })

  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'availability', id: numId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Nem található' }, { status: 404 })

  const owns = await ownsThisSalon(payload, user, existing.salon)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  try {
    await payload.delete({ collection: 'availability', id: numId, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/availability DELETE]', e)
    return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
  }
}
