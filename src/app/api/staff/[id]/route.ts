import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import type { StaffMember } from '@/payload/payload-types'

/**
 * Egy szalon-munkatárs kezelése: GET (locale-lekérés), PATCH (mentés / lokalizált bio),
 * DELETE. RBAC: `staff.manage` (owner + manager) a munkatárs szalonjában. Az avatar
 * relationship SZÁM-ra coerce-ölve (a kliens string id-t küld).
 */
const num = (v: unknown) => (/^\d+$/.test(String(v)) ? Number(v) : v)

async function loadManageableStaff(id: string, userId: string | number) {
  const payload = await getPayloadClient()
  let staff: StaffMember | undefined
  try {
    staff = (await payload.findByID({ collection: 'staff', id, depth: 0, overrideAccess: true })) as StaffMember
  } catch {
    return { error: 'A munkatárs nem található', status: 404 as const }
  }
  const salonId = staff.salon ? (typeof staff.salon === 'object' ? staff.salon.id : staff.salon) : null
  if (!salonId) return { error: 'Érvénytelen munkatárs', status: 400 as const }
  const denied = await assertCapability(userId, 'salon', salonId, 'staff.manage')
  if (denied) return { error: denied.error, status: denied.status }
  return { payload, staff, salonId }
}

/**
 * A staff felfüggesztés/aktiválás tükrözése a párosított membershipre (Csapat és jogok).
 * A két rekord salon + email párral kapcsolódik (nincs séma-reláció köztük). Így a
 * Munkatársaknál végzett suspend a Csapat-jogok státuszában is látszik. Best-effort:
 * ha nincs párosított membership (nem meghívott tag, csak kézi staff), nincs teendő.
 */
async function syncMembershipStatus(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  salonId: string | number,
  email: string | null | undefined,
  isActive: boolean,
): Promise<void> {
  const mail = (email ?? '').trim().toLowerCase()
  if (!mail) return
  const res = await payload.find({
    collection: 'memberships',
    where: { and: [{ salon: { equals: salonId } }, { email: { equals: mail } }] },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  const status = isActive ? 'active' : 'suspended'
  for (const m of res.docs) {
    // Csak a már elfogadott (active/suspended) tagságot mozgatjuk; egy még függő
    // `invited` meghívót nem függesztünk fel/aktiválunk automatikusan.
    if (m.status === 'invited') continue
    if (m.status === status) continue
    await payload.update({ collection: 'memberships', id: m.id, data: { status }, overrideAccess: true })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const loaded = await loadManageableStaff(id, user.id)
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

  const loaded = await loadManageableStaff(id, user.id)
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
      user,
      ...(locale ? { locale: locale as never } : {}),
    })

    // Ha a felfüggesztés-állapot (is_active) változott, tükrözzük a párosított membershipre,
    // hogy a Csapat és jogok is a helyes státuszt mutassa. Best-effort — nem blokkolja a mentést.
    if (typeof body.is_active === 'boolean' && loaded.staff?.email) {
      try {
        await syncMembershipStatus(loaded.payload, loaded.salonId, loaded.staff.email, body.is_active)
      } catch (e) {
        console.error('[api/staff PATCH] membership-státusz szinkron sikertelen', e)
      }
    }

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

  const loaded = await loadManageableStaff(id, user.id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  await loaded.payload.delete({ collection: 'staff', id, overrideAccess: true, user })

  // SZINKRON: a párosított membership (Csapat és jogok) is törlődik, hogy ne maradjon árva
  // jogosultság-rekord (salon + email párosítás). Best-effort — nem blokkolja a választ.
  if (loaded.staff?.email) {
    try {
      const mail = loaded.staff.email.trim().toLowerCase()
      const res = await loaded.payload.find({
        collection: 'memberships',
        where: { and: [{ salon: { equals: loaded.salonId } }, { email: { equals: mail } }] },
        limit: 10,
        depth: 0,
        overrideAccess: true,
      })
      for (const m of res.docs) {
        await loaded.payload.delete({ collection: 'memberships', id: m.id, overrideAccess: true, user })
      }
    } catch (e) {
      console.error('[api/staff DELETE] membership-szinkron törlés sikertelen', e)
    }
  }

  return NextResponse.json({ ok: true })
}
