import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { subId } = await params
  const data = await req.json()

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'subscriptions',
    id: subId,
    data,
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
