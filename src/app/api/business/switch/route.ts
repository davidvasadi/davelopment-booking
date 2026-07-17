/**
 * POST /api/business/switch
 *
 * Több-üzlet (multi-tenant) aktív-üzlet váltó. Body: `{ type, id }`.
 * Ellenőrzi, hogy a bejelentkezett user TÉNYLEG birtokolja az üzletet, majd:
 *  - beállítja a `davelopment_active_business` cookie-t (HttpOnly — csak a szerver írja),
 *  - elmenti a `User.last_active_business` DB-mezőt (cookie-törlést túlélő fallback),
 *  - visszaad egy redirect-célt az üzlet típusa szerint (/restaurant vagy /dashboard).
 *
 * Lásd: src/lib/activeBusiness.ts, docs/multi-business-plan.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import {
  ACTIVE_BUSINESS_COOKIE,
  getUserBusinesses,
  businessKey,
  type BusinessType,
} from '@/lib/activeBusiness'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { type?: string; id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const type = body.type as BusinessType
  const id = body.id != null ? String(body.id) : ''
  if ((type !== 'restaurant' && type !== 'salon') || !id) {
    return NextResponse.json({ error: 'Invalid type/id' }, { status: 400 })
  }

  // Tulajdonlás-ellenőrzés: csak a user saját üzletére válthat.
  const businesses = await getUserBusinesses(user.id)
  const target = businesses.find((b) => b.type === type && b.id === id)
  if (!target) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const key = businessKey(target)

  // DB-fallback frissítése (a cookie törlését túléli, eszközök közt szinkron).
  try {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { last_active_business: key },
      overrideAccess: true,
    })
  } catch {
    // A DB-írás hibája nem blokkolja a váltást — a cookie önmagában is működik.
  }

  const redirectTo = target.type === 'restaurant' ? '/restaurant' : '/dashboard'
  const res = NextResponse.json({ ok: true, redirectTo })
  res.cookies.set(ACTIVE_BUSINESS_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 év
  })
  return res
}
