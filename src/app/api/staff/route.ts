import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import { sendTeamInviteEmail } from '@/lib/email'
import { emitBookingChange } from '@/lib/sseEmitter'
import type { Salon } from '@/payload/payload-types'

/**
 * Szalon-munkatárs LÉTREHOZÁSA. A StaffManager ide POST-ol (`{ ...data, salon, avatar }`).
 * Ha az új munkatársnak van email-je, automatikusan létrejön egy `invited` membership is —
 * így megjelenik a Csapat & jogok panelen is, és kap egy meghívó emailt.
 * RBAC: `staff.manage` (owner + manager)
 */
const num = (v: unknown) => (/^\d+$/.test(String(v)) ? Number(v) : v)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser({ allowHeaderAuth: true })
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
  const salonId = body.salon as string | number
  const data: Record<string, unknown> = {
    ...body,
    salon: num(salonId),
    ...(body.avatar != null ? { avatar: num(body.avatar) } : {}),
  }

  let doc
  try {
    doc = await payload.create({
      collection: 'staff',
      data: data as never,
      overrideAccess: true,
      user,
      ...(locale ? { locale: locale as never } : {}),
    })
  } catch (e) {
    console.error('[api/staff POST] create failed', e)
    return NextResponse.json({ error: 'A munkatárs mentése sikertelen' }, { status: 500 })
  }

  // Ha van email → automatikus membership meghívó (non-fatal: a staff record már megvan).
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    try {
      const existing = await payload.find({
        collection: 'memberships',
        where: { and: [{ salon: { equals: salonId } }, { email: { equals: email } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (existing.docs.length === 0) {
        const token = crypto.randomBytes(24).toString('hex')
        const bizRel = /^\d+$/.test(String(salonId)) ? Number(salonId) : salonId
        const customRoleId = typeof body.custom_role === 'string' || typeof body.custom_role === 'number'
          ? (/^\d+$/.test(String(body.custom_role)) ? Number(body.custom_role) : body.custom_role)
          : undefined

        await payload.create({
          collection: 'memberships',
          overrideAccess: true,
          data: {
            email,
            name: typeof body.name === 'string' ? body.name : '',
            role: 'staff',
            status: 'invited',
            invite_token: token,
            ...(customRoleId !== undefined ? { custom_role: customRoleId } : {}),
            salon: bizRel,
          },
        })

        const acceptUrl = `${APP_URL}/team/accept/${token}`
        try {
          const salon = await payload.findByID({
            collection: 'salons',
            id: bizRel,
            depth: 1,
            overrideAccess: true,
          }) as Salon
          const bizLogo = salon.logo
          const businessLogoUrl =
            bizLogo && typeof bizLogo === 'object' && bizLogo.url
              ? (bizLogo.url.startsWith('http') ? bizLogo.url : `${APP_URL}${bizLogo.url}`)
              : null
          await sendTeamInviteEmail({
            to: email,
            businessName: salon.name,
            businessLogoUrl,
            roleLabel: 'Munkatárs',
            inviterName: user.name ?? '',
            acceptUrl,
          })
        } catch (e) {
          console.error('[api/staff POST] meghívó email küldése sikertelen', e)
        }
      }
    } catch (e) {
      console.error('[api/staff POST] membership létrehozás sikertelen', e)
    }
  }

  emitBookingChange({ kind: 'salon', businessId: String(salonId), op: 'create' })
  return NextResponse.json(doc, { status: 201 })
}
