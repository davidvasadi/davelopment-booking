import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getStripe } from '@/lib/stripe'
import { isAccountFullyOnboarded } from '@/lib/stripeConnect'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/**
 * Stripe ide dob vissza a hosztolt onboarding UTÁN — ez NEM garantálja, hogy a folyamat
 * ténylegesen befejeződött (Express-nél a user kiléphet félbehagyva). Szinkron ellenőrizzük a
 * fiók állapotát (jobb UX, mint a webhookra várni, ami dev/lokál környezetben késhet), és ha
 * kész, azonnal frissítjük a `stripe_connect_onboarded` flaget. A webhook (`account.updated`)
 * marad az ELSŐDLEGES igazságforrás — ez a route csak UX-gyorsítás.
 */
export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get('type')
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)

  const { active } = await getActiveBusiness(user)
  const settingsPath = type === 'salon' ? '/dashboard/settings' : '/restaurant/settings'
  if (!active) return NextResponse.redirect(`${APP_URL}${settingsPath}?tab=payments`)

  const stripe = getStripe()
  const collection = active.type === 'salon' ? 'salons' : 'restaurants'

  if (stripe) {
    const payload = await getPayloadClient()
    const doc = await payload.findByID({ collection, id: active.id, overrideAccess: true })
    const accountId = (doc as { stripe_connect_account_id?: string | null }).stripe_connect_account_id
    if (accountId) {
      const account = await stripe.accounts.retrieve(accountId)
      await payload.update({
        collection, id: active.id, overrideAccess: true,
        data: { stripe_connect_onboarded: isAccountFullyOnboarded(account) },
      })
    }
  }

  return NextResponse.redirect(`${APP_URL}${active.type === 'salon' ? '/dashboard/settings' : '/restaurant/settings'}?tab=payments&connect=1`)
}
