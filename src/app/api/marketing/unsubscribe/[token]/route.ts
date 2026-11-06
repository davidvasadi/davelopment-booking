import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { verifyUnsubscribeToken } from '@/lib/marketingUnsubscribeToken'

/**
 * Publikus, auth nélküli leiratkozó link minden kiküldött hírlevélben — aláírt tokennel
 * azonosítja a `Customers` rekordot (nincs bejelentkezés, mint egy szokásos email-leiratkozás).
 * A `/api/cancel/[token]` mintáját követi: GET → művelet → redirect egy statikus, márkázott
 * visszajelző oldalra.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

  const customerId = await verifyUnsubscribeToken(token)
  if (!customerId) {
    return NextResponse.redirect(new URL('/marketing/unsubscribed?error=invalid', appUrl))
  }

  try {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'customers',
      id: customerId,
      data: { marketing_consent: false, marketing_unsubscribed_at: new Date().toISOString() },
      overrideAccess: true,
    })
    return NextResponse.redirect(new URL('/marketing/unsubscribed', appUrl))
  } catch (err) {
    console.error('[marketing/unsubscribe] Error:', err)
    return NextResponse.redirect(new URL('/marketing/unsubscribed?error=server', appUrl))
  }
}
