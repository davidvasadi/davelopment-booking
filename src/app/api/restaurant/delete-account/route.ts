import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness, ACTIVE_BUSINESS_COOKIE } from '@/lib/activeBusiness'
import { cookies } from 'next/headers'

/**
 * DELETE /api/restaurant/delete-account  (étterem-dashboard „Veszélyzóna")
 *
 * Azonos logika a szalon-megfelelőjével (lásd /api/delete-account):
 *  - Több üzlet → CSAK az aktív (étterem) üzletet töröljük; a fiók + többi üzlet marad.
 *  - Utolsó üzlet → teljes fiók-törlés.
 * A role-t NEM nézzük (több-üzlet modell: az aktív üzlet dönt).
 */
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await getPayloadClient()
  const { active, businesses } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'No active business' }, { status: 400 })

  const cookieStore = await cookies()

  if (businesses.length > 1) {
    const collection = active.type === 'salon' ? 'salons' : 'restaurants'
    await payload.delete({ collection, id: active.id, overrideAccess: true })
    cookieStore.delete(ACTIVE_BUSINESS_COOKIE)
    return NextResponse.json({ ok: true, deletedBusiness: true, accountDeleted: false })
  }

  await payload.delete({ collection: 'users', where: { id: { equals: user.id } }, overrideAccess: true })
  cookieStore.delete('payload-token')
  cookieStore.delete(ACTIVE_BUSINESS_COOKIE)
  return NextResponse.json({ ok: true, deletedBusiness: true, accountDeleted: true })
}
