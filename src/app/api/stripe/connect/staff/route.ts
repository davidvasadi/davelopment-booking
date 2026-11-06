import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'
import { getStripe } from '@/lib/stripe'
import { createConnectAccount, createAccountLink, isAccountFullyOnboarded } from '@/lib/stripeConnect'
import type { StaffMember } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/**
 * A szakember SAJÁT Stripe Connect fiókja (szakemberenkénti számlázás — design 16.7 / 10.4): az előleg és a fizetési
 * link pénze ide érkezik. Ugyanaz, mint az üzlet bekötése (onboard / return / refresh), csak a munkatárs rekordján.
 * Indíthatja maga a szakember (a hozzá kötött belépés), vagy aki az üzletben `payments.manage` jogú — a Stripe-nál a
 * személyes adatokat és a bankszámlát úgyis a szakembernek kell megadnia.
 *  POST { staffId } → { url }  (az Account Link)
 *  GET ?staffId=…&step=return|refresh → vissza a beállításokhoz / új link
 */
async function authorize(staffId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') return { error: NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 400 }) }
  const payload = await getPayloadClient()
  const staff = (await payload.findByID({ collection: 'staff', id: staffId, depth: 0, overrideAccess: true }).catch(() => null)) as StaffMember | null
  const staffSalon = staff ? String(typeof staff.salon === 'object' && staff.salon ? staff.salon.id : staff.salon) : null
  if (!staff || staffSalon !== String(active.id)) return { error: NextResponse.json({ error: 'Munkatárs nem található' }, { status: 404 }) }
  const self = String(typeof staff.user === 'object' && staff.user ? staff.user.id : staff.user ?? '') === String(user.id)
  if (!self && !can(active.capabilities, 'payments.manage')) return { error: NextResponse.json({ error: 'Nincs jogosultsága' }, { status: 403 }) }
  return { user, payload, staff }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { staffId?: string | number }
  if (!body.staffId) return NextResponse.json({ error: 'Hiányzó munkatárs' }, { status: 400 })
  const a = await authorize(String(body.staffId))
  if ('error' in a) return a.error
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })

  let accountId = a.staff.stripe_connect_account_id
  if (!accountId) {
    const account = await createConnectAccount(stripe, a.staff.email || a.user.email || '')
    accountId = account.id
    await a.payload.update({ collection: 'staff', id: a.staff.id, overrideAccess: true, data: { stripe_connect_account_id: accountId } })
  }
  const link = await createAccountLink(stripe, accountId, {
    returnUrl: `${APP_URL}/api/stripe/connect/staff?staffId=${a.staff.id}&step=return`,
    refreshUrl: `${APP_URL}/api/stripe/connect/staff?staffId=${a.staff.id}&step=refresh`,
  })
  return NextResponse.json({ url: link.url })
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const staffId = sp.get('staffId') ?? ''
  const back = `${APP_URL}/dashboard/staff?connect=1`
  const a = await authorize(staffId)
  if ('error' in a) return NextResponse.redirect(`${APP_URL}/dashboard/staff`)
  const stripe = getStripe()
  const accountId = a.staff.stripe_connect_account_id
  if (!stripe || !accountId) return NextResponse.redirect(back)

  if (sp.get('step') === 'refresh') {
    // lejárt / félbehagyott link → új link ugyanarra a fiókra
    const link = await createAccountLink(stripe, accountId, {
      returnUrl: `${APP_URL}/api/stripe/connect/staff?staffId=${a.staff.id}&step=return`,
      refreshUrl: `${APP_URL}/api/stripe/connect/staff?staffId=${a.staff.id}&step=refresh`,
    })
    return NextResponse.redirect(link.url)
  }
  // return: azonnal frissítjük az állapotot (a webhook account.updated marad az elsődleges forrás)
  const account = await stripe.accounts.retrieve(accountId)
  await a.payload.update({ collection: 'staff', id: a.staff.id, overrideAccess: true, data: { stripe_connect_onboarded: isAccountFullyOnboarded(account) } })
  return NextResponse.redirect(back)
}
