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
  const { is_active } = await req.json()

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'salons',
    id: salonId,
    data: { is_active },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
