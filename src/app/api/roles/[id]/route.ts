import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability, capabilitiesForBusiness } from '@/lib/apiCapability'
import { can, ALL_CAPABILITIES, type Capability } from '@/lib/permissions'
import type { Role } from '@/payload/payload-types'

function cleanCaps(input: unknown): Capability[] {
  if (!Array.isArray(input)) return []
  return input.filter((c): c is Capability => ALL_CAPABILITIES.includes(c as Capability))
}

/** A szerep + az üzlete (a capability-guardhoz). */
async function loadRole(id: string): Promise<{ type: 'salon' | 'restaurant'; bizId: string } | null> {
  const payload = await getPayloadClient()
  const role = (await payload.findByID({ collection: 'roles', id, depth: 0, overrideAccess: true }).catch(() => null)) as Role | null
  if (!role) return null
  const salonId = typeof role.salon === 'object' && role.salon ? role.salon.id : role.salon
  const restId = typeof role.restaurant === 'object' && role.restaurant ? role.restaurant.id : role.restaurant
  if (salonId) return { type: 'salon', bizId: String(salonId) }
  if (restId) return { type: 'restaurant', bizId: String(restId) }
  return null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const { id } = await params

  const loaded = await loadRole(id)
  if (!loaded) return NextResponse.json({ error: 'A szerep nem található' }, { status: 404 })
  const denied = await assertCapability(user.id, loaded.type, loaded.bizId, 'team.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  let body: { name?: unknown; capabilities?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string') {
    const n = body.name.trim()
    if (!n) return NextResponse.json({ error: 'A szerep neve kötelező' }, { status: 400 })
    data.name = n
  }
  if ('capabilities' in body) {
    const mine = await capabilitiesForBusiness(user.id, loaded.type, loaded.bizId)
    data.capabilities = cleanCaps(body.capabilities).filter((c) => can(mine, c))
  }

  const payload = await getPayloadClient()
  try {
    const doc = await payload.update({ collection: 'roles', id, data: data as never, overrideAccess: true, user })
    return NextResponse.json(doc)
  } catch (e) {
    console.error('[api/roles PATCH] update failed', e)
    return NextResponse.json({ error: 'A szerep mentése sikertelen' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const { id } = await params

  const loaded = await loadRole(id)
  if (!loaded) return NextResponse.json({ error: 'A szerep nem található' }, { status: 404 })
  const denied = await assertCapability(user.id, loaded.type, loaded.bizId, 'team.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  await payload.delete({ collection: 'roles', id, overrideAccess: true, user })
  return NextResponse.json({ ok: true })
}
