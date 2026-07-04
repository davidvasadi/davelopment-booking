import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { sendTeamInviteEmail } from '@/lib/email'
import { roleLabel, type TeamRole } from '@/lib/permissions'
import type { Salon, Restaurant } from '@/payload/payload-types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

/**
 * Tag meghívása az AKTÍV üzletbe. A tulaj (bejelentkezett user, aki az owner) megad egy
 * emailt + szerepet → létrejön egy `invited` membership tokennel + meghívó-email megy ki.
 * DEFENZÍV: csak a saját üzletébe hívhat meg, a tulaj-hozzáférés nem változik.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { email?: string; role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Érvényes email cím szükséges' }, { status: 400 })
  }
  const role: TeamRole =
    body.role === 'owner' || body.role === 'manager' || body.role === 'staff' ? body.role : 'staff'

  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 400 })

  const payload = await getPayloadClient()

  // Tulajdonos-ellenőrzés: a bejelentkezett user tényleg birtokolja-e az aktív üzletet.
  const biz =
    active.type === 'salon'
      ? ((await payload.findByID({ collection: 'salons', id: active.id, depth: 0, overrideAccess: true })) as Salon)
      : ((await payload.findByID({ collection: 'restaurants', id: active.id, depth: 0, overrideAccess: true })) as Restaurant)
  const ownerId = typeof biz.owner === 'object' && biz.owner ? biz.owner.id : biz.owner
  if (String(ownerId) !== String(user.id)) {
    return NextResponse.json({ error: 'Nincs jogosultság ehhez az üzlethez' }, { status: 403 })
  }

  const scope: Where = active.type === 'salon' ? { salon: { equals: active.id } } : { restaurant: { equals: active.id } }

  // Ne duplikáljunk: már meghívott/aktív ugyanezzel az emaillel ehhez az üzlethez?
  const existing = await payload.find({
    collection: 'memberships',
    where: { and: [scope, { email: { equals: email } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return NextResponse.json({ error: 'Ezt az emailt már meghívtad ehhez az üzlethez' }, { status: 409 })
  }

  const token = crypto.randomBytes(24).toString('hex')

  // A Postgres-relationship SZÁMOT vár; az active.id string (lásd getActiveBusiness → String(id)).
  // Coerce, különben ValidationError-ral bukik a create (ugyanaz a hiba, mint a tasks-nál volt).
  const bizRel = /^\d+$/.test(String(active.id)) ? Number(active.id) : active.id

  await payload.create({
    collection: 'memberships',
    overrideAccess: true,
    data: {
      email,
      role,
      status: 'invited',
      invite_token: token,
      ...(active.type === 'salon' ? { salon: bizRel } : { restaurant: bizRel }),
    },
  })

  const acceptUrl = `${APP_URL}/team/accept/${token}`
  // Az email-küldés NEM fatális: ha az SMTP nem elérhető (pl. lokál), a meghívó akkor is
  // létrejön — a linket a tulaj kézzel is megoszthatja (visszaadjuk a válaszban).
  try {
    await sendTeamInviteEmail({
      to: email,
      businessName: biz.name,
      roleLabel: roleLabel(role),
      inviterName: user.name,
      acceptUrl,
    })
  } catch (e) {
    console.error('[team/invite] meghívó email küldése sikertelen', e)
  }

  return NextResponse.json({ ok: true, acceptUrl })
}
