import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'
import { getStripe } from '@/lib/stripe'
import { createConnectAccount, createAccountLink } from '@/lib/stripeConnect'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/**
 * Stripe Connect Express onboarding indítása/folytatása az aktív üzlethez. Létrehozza (vagy
 * újrahasznosítja) a csatlakoztatott Stripe-számlát, generál egy Account Linket, és a hívó
 * (kliens) erre az URL-re navigál (`window.location.href`). A `stripe_connect_account_id`
 * mentése SZERVER-OLDALON, közvetlen `payload.update`-tel történik — NEM a kliens felőli
 * settings-PATCH-en keresztül (az a route a Connect-mezőket explicit tiltja, lásd
 * src/app/api/salon|restaurant/settings/route.ts FORBIDDEN_KEYS).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'Nincs aktív üzlet' }, { status: 400 })
  if (!can(active.capabilities, 'payments.manage')) {
    return NextResponse.json({ error: 'Nincs jogosultsága' }, { status: 403 })
  }

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })

  const collection = active.type === 'salon' ? 'salons' : 'restaurants'
  const payload = await getPayloadClient()
  const doc = await payload.findByID({ collection, id: active.id, overrideAccess: true })

  let accountId = (doc as { stripe_connect_account_id?: string | null }).stripe_connect_account_id
  if (!accountId) {
    const account = await createConnectAccount(stripe, user.email ?? '')
    accountId = account.id
    await payload.update({ collection, id: active.id, overrideAccess: true, data: { stripe_connect_account_id: accountId } })
  }

  const accountLink = await createAccountLink(stripe, accountId, {
    returnUrl: `${APP_URL}/api/stripe/connect/return?type=${active.type}`,
    refreshUrl: `${APP_URL}/api/stripe/connect/onboard-redirect?type=${active.type}`,
  })

  return NextResponse.json({ url: accountLink.url })
}
