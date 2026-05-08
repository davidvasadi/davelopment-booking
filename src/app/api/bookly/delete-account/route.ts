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
    const salonId = salon.id

    await Promise.all([
      payload.delete({ collection: 'bookings', where: { salon: { equals: salonId } }, overrideAccess: true }),
      payload.delete({ collection: 'availability', where: { salon: { equals: salonId } }, overrideAccess: true }),
      payload.delete({ collection: 'services', where: { salon: { equals: salonId } }, overrideAccess: true }),
      payload.delete({ collection: 'staff', where: { salon: { equals: salonId } }, overrideAccess: true }),
    ])

    await payload.delete({ collection: 'salons', where: { id: { equals: salonId } }, overrideAccess: true })
  }

  await payload.delete({ collection: 'users', where: { id: { equals: user.id } }, overrideAccess: true })

  const cookieStore = await cookies()
  cookieStore.delete('payload-token')

  return NextResponse.json({ ok: true })
}
