/**
 * PATCH /api/user/password
 *
 * A bejelentkezett felhasználó SAJÁT jelszavának megváltoztatása. A régi jelszót a
 * Payload `login`-nal ellenőrizzük (email + currentPassword) — így egy ellopott session
 * önmagában nem elég a jelszó átírásához. Sikeres ellenőrzés után `update`-tel állítjuk
 * az újat (a Payload a mentéskor hasheli).
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Google-OAuth usernek NINCS jelszava (a Payload-login „missing password"-del elszáll) →
 * a UI úgyis elrejti a jelszó-cserét (hasPassword=false). Ha mégis idehív, 400-at adunk.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 })
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'A jelszó legalább 6 karakter legyen.' }, { status: 400 })
  }
  if (!currentPassword) {
    return NextResponse.json({ error: 'Add meg a jelenlegi jelszavad.' }, { status: 400 })
  }
  if (!user.email) {
    return NextResponse.json({ error: 'A fiókhoz nem tartozik email cím.' }, { status: 400 })
  }

  const payload = await getPayloadClient()

  // 1. Régi jelszó ellenőrzése a Payload login-nal (nem állít cookie-t — csak validál).
  try {
    await payload.login({
      collection: 'users',
      data: { email: user.email, password: currentPassword },
    })
  } catch {
    // Rossz jelszó VAGY nincs is jelszava (Google-user) → egységes, nem-szivárgó üzenet.
    return NextResponse.json({ error: 'A jelenlegi jelszó nem megfelelő.' }, { status: 400 })
  }

  // 2. Új jelszó mentése (a Payload a beforeChange-ben hasheli).
  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { password: newPassword },
      overrideAccess: true,
    })
  } catch (e) {
    console.error('[api/user/password PATCH] update failed', e)
    return NextResponse.json({ error: 'A jelszó mentése sikertelen.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
