import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function DELETE() {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth('salon_owner')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const salon = salonResult.docs[0]

  if (salon) {
    // A salon törlése a Salons collection `beforeDelete` hookját futtatja, ami kaszkádban
    // törli az ÖSSZES kapcsolódó rekordot: bookings, availability, services,
    // service-categories, staff ÉS subscriptions. Nem duplikáljuk itt kézzel (a korábbi
    // route kihagyta a subscriptions-t → árva előfizetések maradtak). Egy forrás = a hook.
    await payload.delete({ collection: 'salons', where: { id: { equals: salon.id } }, overrideAccess: true })
  }

  await payload.delete({ collection: 'users', where: { id: { equals: user.id } }, overrideAccess: true })

  const cookieStore = await cookies()
  cookieStore.delete('payload-token')

  return NextResponse.json({ ok: true })
}
