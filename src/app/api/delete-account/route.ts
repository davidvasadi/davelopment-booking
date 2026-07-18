import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness, ACTIVE_BUSINESS_COOKIE } from '@/lib/activeBusiness'
import { cookies } from 'next/headers'

/**
 * DELETE /api/delete-account  (szalon-dashboard „Veszélyzóna")
 *
 * Több-üzlet (multi-tenant) törlés-logika:
 *  - Ha a felhasználónak TÖBB üzlete van → CSAK az AKTÍV üzletet töröljük (a hozzá tartozó
 *    foglalásokkal/munkatársakkal/előfizetéssel — a collection beforeDelete hookja kaszkádol).
 *    A fiók és a többi üzlet megmarad; az aktív cookie-t töröljük, a feloldás a következő
 *    üzletre esik.
 *  - Ha ez az UTOLSÓ üzlet → a teljes fiókot (usert) töröljük (a Users hook mindent visz).
 *
 * (A role-t NEM nézzük — a több-üzlet modellben a nézet/művelet az aktív üzlethez kötött.)
 */
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await getPayloadClient()
  const { active, businesses } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'No active business' }, { status: 400 })

  const cookieStore = await cookies()

  if (businesses.length > 1) {
    // Több üzlet → csak az aktívat töröljük. A salons/restaurants beforeDelete hook kaszkádol.
    const collection = active.type === 'salon' ? 'salons' : 'restaurants'
    await payload.delete({ collection, id: active.id, overrideAccess: true })
    cookieStore.delete(ACTIVE_BUSINESS_COOKIE)
    return NextResponse.json({ ok: true, deletedBusiness: true, accountDeleted: false })
  }

  // Utolsó üzlet → teljes fiók-törlés (a Users beforeDelete hook mindent kaszkádol).
  // id alapján töröljük (nem where-rel) — csak az előbbi megbízhatóan triggereli a beforeDelete hookot.
  await payload.delete({ collection: 'users', id: user.id as number, overrideAccess: true })
  cookieStore.delete('payload-token')
  cookieStore.delete(ACTIVE_BUSINESS_COOKIE)
  return NextResponse.json({ ok: true, deletedBusiness: true, accountDeleted: true })
}
