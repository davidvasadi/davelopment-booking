import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { sendTeamInviteEmail } from '@/lib/email'
import { assertCapability } from '@/lib/apiCapability'
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

  let body: { email?: string; role?: string; position?: string; custom_role?: string }
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
  const position = (body.position ?? '').trim()

  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 400 })

  // RBAC: `team.manage` (owner + manager) az AKTÍV üzletben.
  const denied = await assertCapability(user.id, active.type, active.id, 'team.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  // Az aktív üzlet betöltése (logó/név/pozíciók az email- és kategória-append-hez).
  const biz =
    active.type === 'salon'
      ? ((await payload.findByID({ collection: 'salons', id: active.id, depth: 1, overrideAccess: true })) as Salon)
      : ((await payload.findByID({ collection: 'restaurants', id: active.id, depth: 1, overrideAccess: true })) as Restaurant)

  // OWNER szerepben meghívni CSAK a tulaj tud (a manager team.manage-je manager/staff-ig terjed).
  const bizOwnerId = typeof biz.owner === 'object' && biz.owner ? biz.owner.id : biz.owner
  if (role === 'owner' && String(bizOwnerId) !== String(user.id)) {
    return NextResponse.json({ error: 'Tulajdonos szerepet csak a tulajdonos adhat' }, { status: 403 })
  }

  // Egyedi (custom) szerep: ha megadva, tartozzon EHHEZ az üzlethez. A neve = a tag pozíciója,
  // a képességei = a jogosultsága (nincs külön munkakör-kategória).
  let customRoleId: string | number | null = null
  let customRoleName: string | null = null
  if (body.custom_role) {
    const cr = await payload.findByID({ collection: 'roles', id: body.custom_role, depth: 0, overrideAccess: true }).catch(() => null)
    const crBiz = cr
      ? active.type === 'salon'
        ? (typeof cr.salon === 'object' && cr.salon ? cr.salon.id : cr.salon)
        : (typeof cr.restaurant === 'object' && cr.restaurant ? cr.restaurant.id : cr.restaurant)
      : null
    if (!cr || String(crBiz) !== String(active.id)) return NextResponse.json({ error: 'Érvénytelen szerep' }, { status: 400 })
    customRoleId = /^\d+$/.test(String(cr.id)) ? Number(cr.id) : cr.id
    customRoleName = cr.name
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
    user,
    data: {
      email,
      role,
      ...(customRoleId ? { custom_role: customRoleId } : {}),
      status: 'invited',
      invite_token: token,
      ...(position ? { position } : {}),
      ...(active.type === 'salon' ? { salon: bizRel } : { restaurant: bizRel }),
    },
  })

  const acceptUrl = `${APP_URL}/team/accept/${token}`
  // Az invitáló üzlet logója (abszolút URL) a meghívó-email fejlécébe; ha nincs, a neve jelenik meg.
  const bizLogo = biz.logo
  const businessLogoUrl =
    bizLogo && typeof bizLogo === 'object' && bizLogo.url
      ? (bizLogo.url.startsWith('http') ? bizLogo.url : `${APP_URL}${bizLogo.url}`)
      : null
  // Az email-küldés NEM fatális: ha az SMTP nem elérhető (pl. lokál), a meghívó akkor is
  // létrejön — a linket a tulaj kézzel is megoszthatja (visszaadjuk a válaszban).
  try {
    await sendTeamInviteEmail({
      to: email,
      businessName: biz.name,
      businessLogoUrl,
      // Egységes: a meghívó a megadott (egyedi) szerep NEVÉT mutatja, ha van; különben a beépített címke.
      roleLabel: customRoleName || roleLabel(role),
      inviterName: user.name,
      acceptUrl,
    })
  } catch (e) {
    console.error('[team/invite] meghívó email küldése sikertelen', e)
  }

  return NextResponse.json({ ok: true, acceptUrl })
}
