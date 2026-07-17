import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import type { Membership, Salon, Restaurant, Role } from '@/payload/payload-types'
import type { User } from '@/payload/payload-types'
import type { TeamRole } from '@/lib/permissions'

/**
 * Egy membership kezelése (szerep-váltás / státusz / eltávolítás).
 * - STÁTUSZ (aktív ↔ felfüggesztett) és ELTÁVOLÍTÁS: a tulaj VAGY egy aktív VEZETŐ (manager).
 * - SZEREP-váltás: CSAK a tulaj.
 * A tulaj-hozzáférést nem érinti (az `owner` mezőn át van, nem membershipen).
 * Felfüggesztett tag → `getActiveBusiness` már nem veszi be (csak `active`), így kiesik a rendszerből.
 */
async function loadManageableMembership(id: string, user: User) {
  const payload = await getPayloadClient()
  let membership: Membership | undefined
  try {
    membership = (await payload.findByID({ collection: 'memberships', id, depth: 0, overrideAccess: true })) as Membership
  } catch {
    return { error: 'A tag nem található', status: 404 as const }
  }
  if (!membership) return { error: 'A tag nem található', status: 404 as const }

  const salonId = membership.salon ? (typeof membership.salon === 'object' ? membership.salon.id : membership.salon) : null
  const restaurantId = membership.restaurant ? (typeof membership.restaurant === 'object' ? membership.restaurant.id : membership.restaurant) : null

  // Az üzlet-típus + id a tag rekordjából jön (salon VAGY restaurant).
  const bizType: 'salon' | 'restaurant' | null = salonId ? 'salon' : restaurantId ? 'restaurant' : null
  const bizId = salonId ?? restaurantId
  if (!bizType || !bizId) return { error: 'Érvénytelen tag', status: 400 as const }

  // RBAC: `team.manage` (owner + manager) — státusz/eltávolítás mindkettőnek szabad.
  const denied = await assertCapability(user.id, bizType, bizId, 'team.manage')
  if (denied) return { error: denied.error, status: denied.status }

  // A SZEREP-váltás és a BÉR-mezők owner-only-ok — az owner-flag ehhez kell.
  const biz =
    bizType === 'salon'
      ? ((await payload.findByID({ collection: 'salons', id: bizId, depth: 0, overrideAccess: true })) as Salon)
      : ((await payload.findByID({ collection: 'restaurants', id: bizId, depth: 0, overrideAccess: true })) as Restaurant)
  const ownerId = typeof biz.owner === 'object' && biz.owner ? biz.owner.id : biz.owner
  const isOwner = String(ownerId) === String(user.id)

  return { membership, payload, isOwner, bizType, bizId }
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

  const loaded = await loadManageableMembership(id, user)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  // STÁTUSZ (aktív/felfüggesztett) — tulaj VAGY vezető. Felfüggesztéskor rögzítjük a NAPOT.
  if (body.status !== undefined) {
    const status = String(body.status)
    if (status !== 'active' && status !== 'suspended') {
      return NextResponse.json({ error: 'Érvénytelen státusz' }, { status: 400 })
    }
    await loaded.payload.update({
      collection: 'memberships',
      id,
      overrideAccess: true,
      user,
      data: { status, suspended_at: status === 'suspended' ? new Date().toISOString() : null } as never,
    })

    // SZINKRON a Munkatársak-felületre: szalon-tagnál a párosított `staff` rekord is_active-ját
    // tükrözzük (salon + email párosítás). Így a Csapat-jogokban végzett suspend a Munkatársaknál
    // is látszik. Best-effort — nem blokkolja a választ. (A staff→membership irány a staff route-ban.)
    if (loaded.bizType === 'salon') {
      try {
        const mail = (loaded.membership.email ?? '').trim().toLowerCase()
        if (mail) {
          const staffRes = await loaded.payload.find({
            collection: 'staff',
            where: { and: [{ salon: { equals: loaded.bizId } }, { email: { equals: mail } }] },
            limit: 10,
            depth: 0,
            overrideAccess: true,
          })
          const isActive = status === 'active'
          for (const s of staffRes.docs) {
            if (s.is_active === isActive) continue
            await loaded.payload.update({ collection: 'staff', id: s.id, data: { is_active: isActive }, overrideAccess: true, user })
          }
        }
      } catch (e) {
        console.error('[team/members PATCH] staff is_active szinkron sikertelen', e)
      }
    }

    return NextResponse.json({ ok: true })
  }

  // SZEREP — a team.manage (owner + manager) válthat (B-döntés: a vezető is adhat szerepet).
  // De OWNER szerepet adni CSAK a tulaj tud (privilégium-eszkaláció ellen).
  if (body.role !== undefined) {
    const role = String(body.role)
    if (role !== 'owner' && role !== 'manager' && role !== 'staff') {
      return NextResponse.json({ error: 'Érvénytelen szerep' }, { status: 400 })
    }
    if (role === 'owner' && !loaded.isOwner) {
      return NextResponse.json({ error: 'Tulajdonos szerepet csak a tulajdonos adhat' }, { status: 403 })
    }
    // Beépített szerepre váltáskor az egyedi szerepet leszedjük (különben az felülírná).
    await loaded.payload.update({ collection: 'memberships', id, overrideAccess: true, user, data: { role: role as TeamRole, custom_role: null } as never })
    return NextResponse.json({ ok: true })
  }

  // EGYEDI SZEREP hozzárendelése/eltávolítása (team.manage). A neve = pozíció, a jogai = jogosultság.
  if (body.custom_role !== undefined) {
    const val = body.custom_role
    if (!val) {
      await loaded.payload.update({ collection: 'memberships', id, overrideAccess: true, user, data: { custom_role: null } as never })
      return NextResponse.json({ ok: true })
    }
    const cr = (await loaded.payload.findByID({ collection: 'roles', id: String(val), depth: 0, overrideAccess: true }).catch(() => null)) as Role | null
    const crBiz = cr
      ? loaded.bizType === 'salon'
        ? (typeof cr.salon === 'object' && cr.salon ? cr.salon.id : cr.salon)
        : (typeof cr.restaurant === 'object' && cr.restaurant ? cr.restaurant.id : cr.restaurant)
      : null
    if (!cr || String(crBiz) !== String(loaded.bizId)) return NextResponse.json({ error: 'Érvénytelen szerep' }, { status: 400 })
    const crId = /^\d+$/.test(String(cr.id)) ? Number(cr.id) : cr.id
    await loaded.payload.update({ collection: 'memberships', id, overrideAccess: true, user, data: { custom_role: crId, role: 'staff' } as never })
    return NextResponse.json({ ok: true })
  }

  // PROFIL (HR-adatok) — tulaj VAGY vezető. A BÉR csak a tulajé (vezetőtől figyelmen kívül hagyjuk).
  const stored = loaded.membership
  const data: Record<string, unknown> = {}
  const textFields = ['name', 'position', 'phone', 'birthday', 'address', 'tax_id', 'emergency_contact', 'join_date', 'bio']
  for (const k of textFields) if (k in body) data[k] = body[k] === '' ? null : body[k]
  if ('weekly_hours' in body) data.weekly_hours = body.weekly_hours === '' || body.weekly_hours == null ? null : Number(body.weekly_hours)
  if ('salary' in body && loaded.isOwner) data.salary = body.salary === '' || body.salary == null ? null : Number(body.salary)
  // Bér típusa + rate — csak a tulaj (a fizetés a naptárból számolódik a profilon).
  if ('pay_type' in body && loaded.isOwner) data.pay_type = body.pay_type === 'hourly' ? 'hourly' : 'daily'
  if ('pay_rate' in body && loaded.isOwner) data.pay_rate = body.pay_rate === '' || body.pay_rate == null ? null : Number(body.pay_rate)
  if ('tip_eligible' in body && loaded.isOwner) data.tip_eligible = !!body.tip_eligible

  // Pozíció-előzmény: a kliens által (törlésekkel) szerkesztett lista az alap; a VÁLTÁS auto-naplózódik.
  const storedPos = (stored.position ?? '').trim()
  const newPos = typeof body.position === 'string' ? body.position.trim() : undefined
  const posChanged = newPos !== undefined && newPos !== storedPos
  if ('position_history' in body || posChanged) {
    let history = Array.isArray(body.position_history)
      ? (body.position_history as { position?: string; changed_at?: string }[])
      : ((stored.position_history ?? []) as { position?: string; changed_at?: string }[])
    history = history.filter((h) => h && h.position).map((h) => ({ position: h.position, changed_at: h.changed_at }))
    if (posChanged && newPos) history = [...history, { position: newPos, changed_at: new Date().toISOString().slice(0, 10) }]
    data.position_history = history
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nincs menthető mező' }, { status: 400 })
  }
  await loaded.payload.update({ collection: 'memberships', id, overrideAccess: true, user, data: data as never })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const loaded = await loadManageableMembership(id, user)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  // Az emailt a törlés ELŐTT olvassuk ki (utána a rekord már nincs).
  const mail = (loaded.membership.email ?? '').trim().toLowerCase()

  await loaded.payload.delete({ collection: 'memberships', id, overrideAccess: true, user })

  // SZINKRON: szalon-tagnál a párosított `staff` rekord (Munkatársak) is törlődik, hogy ne
  // maradjon árva. Best-effort — nem blokkolja a választ. (Étteremnél nincs külön staff-rekord.)
  if (loaded.bizType === 'salon' && mail) {
    try {
      const res = await loaded.payload.find({
        collection: 'staff',
        where: { and: [{ salon: { equals: loaded.bizId } }, { email: { equals: mail } }] },
        limit: 10,
        depth: 0,
        overrideAccess: true,
      })
      for (const s of res.docs) {
        await loaded.payload.delete({ collection: 'staff', id: s.id, overrideAccess: true, user })
      }
    } catch (e) {
      console.error('[team/members DELETE] staff-szinkron törlés sikertelen', e)
    }
  }

  return NextResponse.json({ ok: true })
}
