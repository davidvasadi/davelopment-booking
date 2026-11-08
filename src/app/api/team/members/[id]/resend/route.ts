import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { sendTeamInviteEmail } from '@/lib/email'
import { roleLabel } from '@/lib/permissions'
import type { Membership, Salon, Restaurant, Role } from '@/payload/payload-types'
import { brandImageAbs, type BrandPlace } from '@/lib/brandImage'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/**
 * Meghívó újraküldése (Munkatársak 10.1 — tömeges művelet / sor-menü): egy még függő (`invited`) tagnak ugyanaz a
 * meghívó-e-mail megy ki újra, ugyanazzal a linkkel. RBAC: `team.manage` a tag üzletében.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const payload = await getPayloadClient()
  const m = (await payload.findByID({ collection: 'memberships', id, depth: 1, overrideAccess: true }).catch(() => null)) as Membership | null
  if (!m) return NextResponse.json({ error: 'A tag nem található' }, { status: 404 })
  if (m.status !== 'invited' || !m.invite_token) return NextResponse.json({ error: 'Ez a tag már nem függő meghívott' }, { status: 400 })

  const biz = (m.salon && typeof m.salon === 'object' ? m.salon : m.restaurant && typeof m.restaurant === 'object' ? m.restaurant : null) as Salon | Restaurant | null
  if (!biz) return NextResponse.json({ error: 'Érvénytelen tag' }, { status: 400 })
  const denied = await assertCapability(user.id, m.salon ? 'salon' : 'restaurant', biz.id, 'team.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const logo = brandImageAbs(biz as BrandPlace, 'email', APP_URL) // logó / ikon (design 24.2)
  try {
    await sendTeamInviteEmail({
      to: m.email,
      businessName: biz.name,
      businessLogoUrl: logo,
      roleLabel: (m.custom_role && typeof m.custom_role === 'object' ? (m.custom_role as Role).name : null) || roleLabel(m.role),
      inviterName: user.name,
      acceptUrl: `${APP_URL}/team/accept/${m.invite_token}`,
    })
  } catch (e) {
    console.error('[team/resend] meghívó email küldése sikertelen', e)
    return NextResponse.json({ error: 'Az e-mail küldése sikertelen' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
