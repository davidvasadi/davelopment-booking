import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { Restaurant } from '@/payload/payload-types'

/**
 * Kategória (szerepkör) HOZZÁADÁSA az AKTÍV étterem saját listájához. A meghíváskori
 * append mellett ez teszi lehetővé, hogy a tulaj a kategóriát AZONNAL (meghívás nélkül is)
 * elmentse — így nem vész el a „felét elfelejti" hiba szerint. Owner-only, idempotens.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { label?: string; level?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  const label = (body.label ?? '').trim()
  if (!label) return NextResponse.json({ error: 'Név szükséges' }, { status: 400 })
  const level: 'lead' | 'staff' = body.level === 'lead' ? 'lead' : 'staff'

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') {
    return NextResponse.json({ error: 'Kategóriák csak étteremhez tartoznak' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const biz = (await payload.findByID({ collection: 'restaurants', id: active.id, depth: 0, overrideAccess: true })) as Restaurant
  const ownerId = typeof biz.owner === 'object' && biz.owner ? biz.owner.id : biz.owner
  if (String(ownerId) !== String(user.id)) {
    return NextResponse.json({ error: 'Nincs jogosultság ehhez az üzlethez' }, { status: 403 })
  }

  const existing = (biz.positions ?? []).map((p) => p.label)
  if (!existing.includes(label)) {
    await payload.update({
      collection: 'restaurants',
      id: active.id,
      overrideAccess: true,
      user,
      data: { positions: [...(biz.positions ?? []).map((p) => ({ label: p.label, level: p.level })), { label, level }] },
    })
  }

  return NextResponse.json({ ok: true })
}
