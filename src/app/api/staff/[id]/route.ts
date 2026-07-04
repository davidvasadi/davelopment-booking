import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, StaffMember } from '@/payload/payload-types'

/**
 * Egy szalon-munkatárs kezelése: GET (locale-lekérés), PATCH (mentés / lokalizált bio),
 * DELETE. Defenzív: csak a munkatárs szalonjának tulaja módosíthat. Az avatar relationship
 * SZÁM-ra coerce-ölve (a kliens string id-t küld).
 */
const num = (v: unknown) => (/^\d+$/.test(String(v)) ? Number(v) : v)

async function loadOwnedStaff(id: string, userId: string | number) {
  const payload = await getPayloadClient()
  let staff: StaffMember | undefined
  try {
    staff = (await payload.findByID({ collection: 'staff', id, depth: 0, overrideAccess: true })) as StaffMember
  } catch {
    return { error: 'A munkatárs nem található', status: 404 as const }
  }
  const salonId = staff.salon ? (typeof staff.salon === 'object' ? staff.salon.id : staff.salon) : null
  if (!salonId) return { error: 'Érvénytelen munkatárs', status: 400 as const }
  const s = (await payload.findByID({ collection: 'salons', id: salonId, depth: 0, overrideAccess: true })) as Salon
  const ownerId = typeof s.owner === 'object' && s.owner ? s.owner.id : s.owner
  if (String(ownerId) !== String(userId)) return { error: 'Nincs jogosultság', status: 403 as const }
  return { payload }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const loaded = await loadOwnedStaff(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const locale = request.nextUrl.searchParams.get('locale') || undefined
  const doc = await loaded.payload.findByID({
    collection: 'staff',
    id,
    depth: 0,
    overrideAccess: true,
    ...(locale ? { locale: locale as never } : {}),
  })
  return NextResponse.json(doc)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const loaded = await loadOwnedStaff(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const locale = request.nextUrl.searchParams.get('locale') || undefined
  const data: Record<string, unknown> = {
    ...body,
    ...(body.salon != null ? { salon: num(body.salon) } : {}),
    ...(body.avatar != null ? { avatar: num(body.avatar) } : {}),
  }

  try {
    const doc = await loaded.payload.update({
      collection: 'staff',
      id,
      data: data as never,
      overrideAccess: true,
      ...(locale ? { locale: locale as never } : {}),
    })
    return NextResponse.json(doc)
  } catch (e) {
    console.error('[api/staff PATCH] update failed', e)
    return NextResponse.json({ error: 'A munkatárs mentése sikertelen' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const loaded = await loadOwnedStaff(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  await loaded.payload.delete({ collection: 'staff', id, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
