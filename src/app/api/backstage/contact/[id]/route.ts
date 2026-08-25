import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  if (body.status !== 'new' && body.status !== 'answered') {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'contact-messages',
    id,
    data: { status: body.status },
    overrideAccess: true,
    user,
  })

  return NextResponse.json({ ok: true })
}
