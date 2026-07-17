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

  // SZALON-PARITÁS: a szalon minden felülete (Munkatársak, Beosztás, publikus foglalás,
  // statisztikák) a `staff` collectionből olvas — a membership önmagában láthatatlan ott.
  // Ezért szalon-meghívónál a membership mellé egy `staff` rekordot is létrehozunk/párosítunk.
  // Összekötés EMAIL alapján (nincs séma-változás): ha már van staff ezzel az emaillel a
  // szalonhoz, azt aktiváljuk (nem duplikálunk); különben újat hozunk létre a tag adataiból.
  // Étteremnél NINCS teendő — ott a membership maga a munkatárs.
  const salonId = membership.salon
    ? typeof membership.salon === 'object'
      ? (membership.salon as { id: number | string }).id
      : membership.salon
    : null
  if (salonId != null) {
    try {
      const email = (membership.email ?? '').trim().toLowerCase()
      const existingStaff = email
        ? await payload.find({
            collection: 'staff',
            where: { and: [{ salon: { equals: salonId } }, { email: { equals: email } }] },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
        : { docs: [] as { id: number | string }[] }

      // A Postgres-relationship SZÁMOT vár; az id lehet string — coerce (mint az invite route-nál).
      const salonRel = /^\d+$/.test(String(salonId)) ? Number(salonId) : salonId

      if (existingStaff.docs.length > 0) {
        // Már van staff ehhez az emailhez → csak biztosítjuk, hogy aktív (nem duplikálunk).
        await payload.update({
          collection: 'staff',
          id: existingStaff.docs[0].id,
          overrideAccess: true,
          user,
          data: { is_active: true },
        })
      } else {
        await payload.create({
          collection: 'staff',
          overrideAccess: true,
          user,
          data: {
            salon: salonRel,
            name: user.name || membership.name || email,
            email: email || undefined,
            is_active: true,
            role_title: membership.position || undefined,
            phone: membership.phone || undefined,
            join_date: membership.join_date || undefined,
            weekly_hours: membership.weekly_hours ?? undefined,
          },
        })
      }
    } catch (e) {
      // Nem fatális: a membership már aktív, a tag be tud lépni. A staff-párosítás
      // legrosszabb esetben a tulaj kézi felvételével pótolható — ne bukjon el az elfogadás.
      console.error('[team/accept] szalon staff-párosítás sikertelen', e)
    }
  }

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
