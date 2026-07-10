import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

// Étterem aktív/inaktív váltás + admin-megjegyzés mentése (a salons/[salonId]/toggle mintájára).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { restaurantId } = await params
  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') data.is_active = body.is_active
  if (typeof body.admin_notes === 'string') data.admin_notes = body.admin_notes

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'restaurants',
    id: restaurantId,
    data,
    overrideAccess: true,
    user,
  })

  return NextResponse.json({ ok: true })
}
