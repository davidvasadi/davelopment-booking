import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { getStripeBillingDetails } from '@/lib/stripeBillingDetails'

export const dynamic = 'force-dynamic'

/**
 * Beállítások › Előfizetés (design 16.5): a fiók mentett fizetési módja a Stripe-tól ÉLŐBEN (márka, utolsó 4, lejárat) —
 * nálunk nincs tárolva. Csak akkor kérjük le, ha az Előfizetés fül megnyílik (külső hívás, ne lassítsa a Beállításokat).
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await getPayloadClient()
  const sub = await findAccountSubscription({ payload }, user.id)
  const { card } = await getStripeBillingDetails(sub?.stripe_customer_id)
  return NextResponse.json({ card: card ? { brand: card.brand, last4: card.last4, expiry: card.expiry } : null })
}
