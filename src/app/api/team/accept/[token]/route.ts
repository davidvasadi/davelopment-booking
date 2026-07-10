import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Membership } from '@/payload/payload-types'

/**
 * Meghívó elfogadása. A token azonosít egy `invited` membershipet. Ha a bejelentkezett
 * user emailje egyezik a meghívóéval, a membership `active` lesz és a user-hez kötődik.
 * Egyszer-használatos: elfogadás után a token törlődik (invite_token → null).
 * DEFENZÍV: a tulaj-hozzáférést nem érinti; csak a membership-sort aktiválja.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Hiányzó token' }, { status: 400 })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges', needsAuth: true }, { status: 401 })

  const payload = await getPayloadClient()

  const res = await payload.find({
    collection: 'memberships',
    where: { invite_token: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const membership = res.docs[0] as Membership | undefined

  if (!membership) return NextResponse.json({ error: 'A meghívó nem található vagy már felhasználták' }, { status: 404 })
  if (membership.status === 'active') return NextResponse.json({ error: 'A meghívót már elfogadták', already: true }, { status: 409 })

  if ((user.email ?? '').trim().toLowerCase() !== (membership.email ?? '').trim().toLowerCase()) {
    return NextResponse.json(
      { error: 'Ez a meghívó egy másik email címre szól. Jelentkezz be a meghívott fiókkal.', emailMismatch: true },
      { status: 403 },
    )
  }

  await payload.update({
    collection: 'memberships',
    id: membership.id,
    overrideAccess: true,
    user,
    data: {
      status: 'active',
      user: user.id,
      name: user.name,
      invite_token: null,
    },
  })

  return NextResponse.json({ ok: true })
}

/** GET: az accept-oldal betöltésekor — érvényes-e a token, kinek szól. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Hiányzó token' }, { status: 400 })

  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'memberships',
    where: { invite_token: { equals: token } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const membership = res.docs[0] as Membership | undefined
  if (!membership) return NextResponse.json({ found: false }, { status: 404 })

  const biz =
    (membership.salon && typeof membership.salon === 'object' && membership.salon.name) ||
    (membership.restaurant && typeof membership.restaurant === 'object' && membership.restaurant.name) ||
    ''
  const type: 'salon' | 'restaurant' = membership.restaurant ? 'restaurant' : 'salon'

  return NextResponse.json({
    found: true,
    email: membership.email,
    role: membership.role,
    businessName: biz,
    type,
    already: membership.status === 'active',
  })
}
