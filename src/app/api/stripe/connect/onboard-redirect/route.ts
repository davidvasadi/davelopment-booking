import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getStripe } from '@/lib/stripe'
import { createAccountLink } from '@/lib/stripeConnect'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/**
 * GET-navigálható változat az onboardinghoz — a Stripe Account Link `refresh_url`-je csak GET
 * redirectet tud célozni (a böngésző oda navigál), a `/api/stripe/connect/onboard` viszont
 * POST-only (a kliens fetch-eli). Ez a route ugyanazt a fiókot használja fel (már létrejött az
 * első `onboard` hívásban) és csak egy FRISS Account Linket generál, majd 302-vel odairányít —
 * Stripe hivatalos mintája szerint a refresh_url-nek pontosan ezt kell tennie.
 */
export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get('type')
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)

  const { active } = await getActiveBusiness(user)
  if (!active || (type && active.type !== type)) return NextResponse.redirect(`${APP_URL}/dashboard/settings?tab=payments`)

  const stripe = getStripe()
  const collection = active.type === 'salon' ? 'salons' : 'restaurants'
  const settingsPath = active.type === 'salon' ? '/dashboard/settings' : '/restaurant/settings'
  if (!stripe) return NextResponse.redirect(`${APP_URL}${settingsPath}?tab=payments`)

  const payload = await getPayloadClient()
  const doc = await payload.findByID({ collection, id: active.id, overrideAccess: true })
  const accountId = (doc as { stripe_connect_account_id?: string | null }).stripe_connect_account_id
  if (!accountId) return NextResponse.redirect(`${APP_URL}${settingsPath}?tab=payments`)

  const accountLink = await createAccountLink(stripe, accountId, {
    returnUrl: `${APP_URL}/api/stripe/connect/return?type=${active.type}`,
    refreshUrl: `${APP_URL}/api/stripe/connect/onboard-redirect?type=${active.type}`,
  })

  return NextResponse.redirect(accountLink.url)
}
