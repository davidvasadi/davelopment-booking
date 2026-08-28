import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { autofillSalonSchedule } from '@/lib/scheduleAutofill'

/** A naptár-kivétel írása/törlése után a Naptár/Shifts azonnal kövesse — ne várjon az éjszakai cronra. */
async function resyncSalonSchedule(payload: Awaited<ReturnType<typeof getPayloadClient>>, salonId: unknown) {
  try {
    const salon = await payload.findByID({ collection: 'salons', id: salonId as string | number, depth: 0, overrideAccess: true })
    if (salon) await autofillSalonSchedule(payload, String(salon.id), salon.booking_window_days ?? 60)
  } catch (err) {
    payload.logger.error(`[availability] schedule-autofill szinkron hiba: ${String(err)}`)
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

  const denied = await assertCapability(user.id, 'salon', existing.salon, 'availability.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  try {
    const doc = await payload.update({
      collection: 'availability',
      id: numId,
      data: body as never,
      overrideAccess: true,
      user,
    })
    await resyncSalonSchedule(payload, existing.salon)
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

  const denied = await assertCapability(user.id, 'salon', existing.salon, 'availability.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  try {
    await payload.delete({ collection: 'availability', id: numId, overrideAccess: true })
    await resyncSalonSchedule(payload, existing.salon)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/availability DELETE]', e)
    return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
  }
}
