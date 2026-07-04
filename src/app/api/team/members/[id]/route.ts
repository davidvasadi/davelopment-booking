import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Membership, Salon, Restaurant } from '@/payload/payload-types'
import type { User } from '@/payload/payload-types'
import type { TeamRole } from '@/lib/permissions'

/**
 * Egy membership kezelése (szerep-váltás / eltávolítás). DEFENZÍV: csak az adott üzlet
 * tulaja (a bejelentkezett owner) módosíthat, és owner-szerep NEM állítható be tagra
 * (a tulaj az `owner` mezőn át van, nem membershipen). Ez nem érinti a tulaj-hozzáférést.
 */
async function loadOwnedMembership(id: string, user: User) {
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

  let ownerId: string | number | null = null
  if (salonId) {
    const s = (await payload.findByID({ collection: 'salons', id: salonId, depth: 0, overrideAccess: true })) as Salon
    ownerId = typeof s.owner === 'object' && s.owner ? s.owner.id : s.owner
  } else if (restaurantId) {
    const r = (await payload.findByID({ collection: 'restaurants', id: restaurantId, depth: 0, overrideAccess: true })) as Restaurant
    ownerId = typeof r.owner === 'object' && r.owner ? r.owner.id : r.owner
  }
  if (String(ownerId) !== String(user.id)) return { error: 'Nincs jogosultság', status: 403 as const }

  return { membership, payload }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  const role = body.role
  if (role !== 'owner' && role !== 'manager' && role !== 'staff') {
    return NextResponse.json({ error: 'Érvénytelen szerep' }, { status: 400 })
  }

  const loaded = await loadOwnedMembership(id, user)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  await loaded.payload.update({
    collection: 'memberships',
    id,
    overrideAccess: true,
    data: { role: role as TeamRole },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const loaded = await loadOwnedMembership(id, user)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  await loaded.payload.delete({ collection: 'memberships', id, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
