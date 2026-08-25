import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(1000),
  target: z.enum(['all', 'paying', 'trial', 'custom']),
  ownerIds: z.array(z.union([z.string(), z.number()])).optional(),
})

/**
 * Admin körüzenet: minden (vagy szűrt) fiók userének dashboard-harangjába egyszerre beír egy
 * `notifications` rekordot. A rendszer notification-modellje HELYENKÉNT (salon/restaurant) +
 * audience:'owner' párosítással szűr (lásd /api/notifications placeFilter), nem közvetlenül
 * userenként — ezért helyenként (nem userenként) kell létrehozni a rekordokat.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const { title, body: message, target, ownerIds: customOwnerIds } = parsed.data

  const payload = await getPayloadClient()

  let ownerIds: (string | number)[] | null = null
  if (target === 'custom') {
    ownerIds = customOwnerIds ?? []
    if (ownerIds.length === 0) {
      return NextResponse.json({ error: 'no_recipients' }, { status: 400 })
    }
  } else if (target !== 'all') {
    const subs = await payload.find({
      collection: 'subscriptions',
      where: { status: { equals: target === 'paying' ? 'active' : 'trialing' } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    ownerIds = subs.docs.map(s => (typeof s.owner === 'object' ? s.owner?.id : s.owner)).filter((id): id is string | number => id != null)
    if (ownerIds.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }
  }

  const [salons, restaurants] = await Promise.all([
    payload.find({
      collection: 'salons',
      where: ownerIds ? { owner: { in: ownerIds } } : {},
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'restaurants',
      where: ownerIds ? { owner: { in: ownerIds } } : {},
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  // Napló-bejegyzés ELŐBB (0 sent_count-tal) — a kampány-id-t rá kell írni minden kiküldött
  // notifications sorra, hogy utólag visszakereshető legyen "mi ment ki, hányan olvasták el".
  const log = await payload.create({
    collection: 'broadcast-log',
    overrideAccess: true,
    data: { title, body: message, target, sent_count: 0, sent_by: user.id },
  })

  // Egymás után, nem Promise.all-lal — sok egyidejű bulk-create ugyanazon a megosztott
  // erőforráson (ugyanaz a tanulság, mint a ma esti törlés-versenyhelyzetnél).
  let sent = 0
  for (const salon of salons.docs) {
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: { audience: 'owner', type: 'admin_broadcast', title, body: message, salon: salon.id, campaign_id: Number(log.id), read: false },
    }).catch(() => null)
    sent++
  }
  for (const restaurant of restaurants.docs) {
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: { audience: 'owner', type: 'admin_broadcast', title, body: message, restaurant: restaurant.id, campaign_id: Number(log.id), read: false },
    }).catch(() => null)
    sent++
  }

  await payload.update({
    collection: 'broadcast-log',
    id: log.id,
    overrideAccess: true,
    data: { sent_count: sent },
  }).catch(() => null)

  return NextResponse.json({ ok: true, sent })
}
