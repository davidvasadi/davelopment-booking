import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import type { Membership } from '@/payload/payload-types'

/**
 * POST /api/team/register — fiók létrehozása egy csapat-meghívó elfogadásához.
 *
 * A `team/accept/[token]` oldal korábban a sima `POST /api/users`-t hívta, majd rögtön
 * bejelentkezést próbált — ez a Users collection `verify: true`-ja miatt MINDIG elbukott
 * (`UnverifiedEmail`), mert egy frissen létrehozott userrel a megerősítő email linkjére
 * kattintás nélkül nem lehet bejelentkezni (lásd `Users.ts` `auth.verify` kommentje, és az
 * `/api/auth/register` route ugyanerről). A meghívott ilyenkor beragadt: a fiók létrejött, de
 * a `POST /api/team/accept/[token]` sosem futott le, így a membership `invited` maradt — a
 * user később, sikeres bejelentkezés után `getActiveBusiness()`-ben üzlet nélkül találta
 * magát, és a `/register` oldalra irányította.
 *
 * A meghívó-token maga már igazolja az email-tulajdonlást (a linket erre a címre küldtük ki),
 * ezért itt — az Auth.js Google-bejelentkezéshez hasonlóan (lásd `Users.ts` `_verified: true`
 * megjegyzése) — `_verified: true`-val hozzuk létre a usert: nincs értelme egy MÁSODIK
 * megerősítést kérni ugyanahhoz az emailhez.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: string; name?: string; password?: string } | null
  if (!body?.token || !body.password) return NextResponse.json({ error: 'Hiányzó adatok' }, { status: 400 })
  if (body.password.length < 6) return NextResponse.json({ error: 'A jelszó legalább 6 karakter legyen.' }, { status: 400 })

  const payload = await getPayloadClient()

  const res = await payload.find({
    collection: 'memberships',
    where: { invite_token: { equals: body.token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const membership = res.docs[0] as Membership | undefined
  if (!membership) return NextResponse.json({ error: 'A meghívó nem található vagy már felhasználták' }, { status: 404 })
  if (membership.status === 'active') return NextResponse.json({ error: 'A meghívót már elfogadták', already: true }, { status: 409 })

  const email = (membership.email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'A meghívóhoz nincs email rendelve' }, { status: 400 })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    // Már van fiók ezzel az emaillel — a kliens ilyenkor a beírt jelszóval bejelentkezést
    // próbál a meglévő fiókkal (lásd team/accept/[token]/page.tsx `register()`).
    return NextResponse.json({ error: 'already_registered' }, { status: 409 })
  }

  const role = membership.restaurant ? 'restaurant_owner' : 'salon_owner'
  try {
    await payload.create({
      collection: 'users',
      data: {
        name: body.name?.trim() || email,
        email,
        password: body.password,
        role,
        // A meghívó-token maga az email-tulajdonlás igazolása — nincs szükség egy MÁSODIK,
        // Payload-generálta megerősítő emailre ugyanahhoz a címhez.
        _verified: true,
      },
      overrideAccess: true,
      disableVerificationEmail: true,
    })
  } catch (e) {
    console.error('[team/register] user create error:', e)
    return NextResponse.json({ error: 'A fiók létrehozása sikertelen.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
