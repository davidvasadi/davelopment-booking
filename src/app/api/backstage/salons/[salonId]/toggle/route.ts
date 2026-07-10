import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ salonId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { salonId } = await params
  const body = await req.json()
  // Mindkét mezőt kezeli: a toggle gomb `is_active`-ot, a sheet jegyzet-mentése `admin_notes`-t küld.
  const data: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') data.is_active = body.is_active
  if (typeof body.admin_notes === 'string') data.admin_notes = body.admin_notes

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'salons',
    id: salonId,
    data,
    overrideAccess: true,
    user,
  })

  return NextResponse.json({ ok: true })
}
