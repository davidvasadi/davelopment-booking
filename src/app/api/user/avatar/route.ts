/**
 * PATCH /api/user/avatar
 *
 * A bejelentkezett felhasználó profilkép-URL-jét (`avatar_url`) frissíti.
 * Body: { avatar_url: string | null }. Üres/null érték törli az avatart
 * (ilyenkor a felületen a monogramos fallback jelenik meg).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { avatar_url?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 })
  }

  const raw = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : ''
  // Csak http(s) URL-t fogadunk el; üres → törlés.
  if (raw && !/^https?:\/\//i.test(raw)) {
    return NextResponse.json({ error: 'invalid-url' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { avatar_url: raw || null },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, avatar_url: raw || null })
}
