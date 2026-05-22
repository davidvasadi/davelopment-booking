import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function DELETE() {
  let user: Awaited<ReturnType<typeof requireAuth>>
  try {
    user = await requireAuth('restaurant_owner')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'restaurants',
    where: { owner: { equals: user.id } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const restaurant = result.docs[0]

  // A Restaurants beforeDelete hook kaszkádol (reservations, opening-hours,
  // tables, rooms, subscriptions), ezért itt csak az éttermet töröljük.
  if (restaurant) {
    await payload.delete({
      collection: 'restaurants',
      where: { id: { equals: restaurant.id } },
      overrideAccess: true,
    })
  }

  await payload.delete({ collection: 'users', where: { id: { equals: user.id } }, overrideAccess: true })

  const cookieStore = await cookies()
  cookieStore.delete('payload-token')

  return NextResponse.json({ ok: true })
}
