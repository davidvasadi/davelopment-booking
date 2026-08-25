import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

/**
 * Körüzenet-kampány törlése: a naplóbejegyzés MELLETT a hozzá tartozó, már kiküldött
 * `notifications` sorokat is töröljük (campaign_id alapján) — a törlés tehát ténylegesen
 * visszavonja az üzenetet a userek harangjából, nem csak a backstage-naplóból tünteti el.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const payload = await getPayloadClient()

  await payload.delete({
    collection: 'notifications',
    where: { campaign_id: { equals: Number(id) } },
    overrideAccess: true,
  }).catch(() => null)

  await payload.delete({
    collection: 'broadcast-log',
    id,
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
