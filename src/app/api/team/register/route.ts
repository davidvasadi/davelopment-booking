import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { startSession } from '@/lib/authLogin'
import { getPayloadClient } from '@/lib/payload'
import type { Membership } from '@/payload/payload-types'

/**
 * POST /api/team/register — új fiók egy csapat-meghívó elfogadásához, JELSZÓ NÉLKÜL (2026-11: a belépés mindenhol
 * kóddal megy, csak a backstage jelszavas).
 *
 * A meghívó-token igazolja az e-mail-tulajdonlást (a linket erre a címre küldtük ki), ezért a fiók `_verified: true`-val
 * jön létre, és rögtön be is lép (munkamenet + süti) — utána a kliens elfogadja a meghívót (`POST /api/team/accept`).
 * A jelszó egy véletlen, soha ki nem adott érték (a Payload auth-gyűjteménye megköveteli).
 * Ha az e-mailhez már van fiók: 409 — a meghívott ilyenkor kóddal lép be (`/login?email=…&from=/team/accept/…`).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: string; name?: string } | null
  if (!body?.token) return NextResponse.json({ error: 'Hiányzó adatok' }, { status: 400 })

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
    // Már van fiók ezzel az emaillel — a kliens a kódos belépésre küldi, onnan vissza a meghívóhoz.
    return NextResponse.json({ error: 'already_registered' }, { status: 409 })
  }

  const role = membership.restaurant ? 'restaurant_owner' : 'salon_owner'
  let user: { id: number | string; email: string; role?: string | null }
  try {
    user = await payload.create({
      collection: 'users',
      data: {
        name: body.name?.trim() || email,
        email,
        password: crypto.randomBytes(24).toString('base64url'),
        role,
        // A meghívó-token maga az email-tulajdonlás igazolása — nincs szükség egy MÁSODIK,
        // Payload-generálta megerősítő emailre ugyanahhoz a címhez.
        _verified: true,
      },
      overrideAccess: true,
      disableVerificationEmail: true,
    }) as unknown as typeof user
  } catch (e) {
    console.error('[team/register] user create error:', e)
    return NextResponse.json({ error: 'A fiók létrehozása sikertelen.' }, { status: 500 })
  }

  const out = NextResponse.json({ ok: true })
  await startSession(req, out, { id: user.id, email: user.email, role: user.role })
  return out
}
