import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'

// Ezeket NEM szabad patch-elni ezen a végponton (owner/tier csak admin módosíthatja).
const FORBIDDEN_KEYS = new Set(['id', 'owner', 'tier', 'createdAt', 'updatedAt'])

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') {
    return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 400 })
  }

  if (!can(active.capabilities, 'settings.profile')) {
    return NextResponse.json({ error: 'Nincs jogosultsága' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const safeBody = Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(([k]) => !FORBIDDEN_KEYS.has(k)),
  )

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'restaurants',
    id: active.id,
    data: safeBody,
    overrideAccess: true,
    user,
  })

  return NextResponse.json({ ok: true })
}
