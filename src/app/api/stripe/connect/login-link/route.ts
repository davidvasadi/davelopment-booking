import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/**
 * Már-onboardolt üzletnek ad egy egyszer-használatos Stripe login linket a saját Express
 * dashboardjához (kifizetések, kártya-részletek, saját KYC-adatok) — enélkül az owner
 * "elveszne" a saját Stripe fiókjában, miután végzett az onboardinggal.
 */
export async function POST() {
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
  const accountId = (doc as { stripe_connect_account_id?: string | null }).stripe_connect_account_id
  if (!accountId) return NextResponse.json({ error: 'Nincs összekapcsolt Stripe fiók' }, { status: 400 })

  const loginLink = await stripe.accounts.createLoginLink(accountId)
  return NextResponse.json({ url: loginLink.url })
}
