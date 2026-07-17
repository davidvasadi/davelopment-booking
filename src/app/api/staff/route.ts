import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'

/**
 * Szalon-munkatárs LÉTREHOZÁSA. A StaffManager ide POST-ol (`{ ...data, salon, avatar }`).
 * Kritikus: a Postgres-relationship SZÁMOT vár, a kliens viszont STRING id-t küld — coerce
 * kell, különben ValidationError-ral bukik (ugyanaz a hiba, mint a tasks/invite flow-knál).
 * RBAC: `staff.manage` (owner + manager) — a staff nem hozhat létre munkatársat.
 */
const num = (v: unknown) => (/^\d+$/.test(String(v)) ? Number(v) : v)

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const denied = await assertCapability(user.id, 'salon', body.salon as string | undefined, 'staff.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()
  const locale = request.nextUrl.searchParams.get('locale') || undefined
  const data: Record<string, unknown> = {
    ...body,
    salon: num(body.salon),
    ...(body.avatar != null ? { avatar: num(body.avatar) } : {}),
  }

  try {
    const doc = await payload.create({
      collection: 'staff',
      data: data as never,
      overrideAccess: true,
      user,
      ...(locale ? { locale: locale as never } : {}),
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (e) {
    console.error('[api/staff POST] create failed', e)
    return NextResponse.json({ error: 'A munkatárs mentése sikertelen' }, { status: 500 })
  }
}
