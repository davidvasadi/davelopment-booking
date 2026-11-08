import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { verifyUnsubscribeToken } from '@/lib/marketingUnsubscribeToken'

/**
 * Publikus, auth nélküli leiratkozó link minden kiküldött hírlevélben — aláírt tokennel
 * azonosítja a `Customers` rekordot (nincs bejelentkezés, mint egy szokásos email-leiratkozás).
 * A `/api/cancel/[token]` mintáját követi: GET → művelet → redirect egy statikus, márkázott
 * visszajelző oldalra.
 */
/** A leiratkozás maga: 'ok' / 'invalid' (rossz token) / 'error'. */
async function unsubscribe(token: string): Promise<'ok' | 'invalid' | 'error'> {
  const customerId = await verifyUnsubscribeToken(token)
  if (!customerId) return 'invalid'
  try {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'customers',
      id: customerId,
      data: { marketing_consent: false, marketing_unsubscribed_at: new Date().toISOString() },
      overrideAccess: true,
    })
    return 'ok'
  } catch (err) {
    console.error('[marketing/unsubscribe] Error:', err)
    return 'error'
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const r = await unsubscribe(token)
  return NextResponse.redirect(new URL(r === 'ok' ? '/marketing/unsubscribed' : `/marketing/unsubscribed?error=${r === 'invalid' ? 'invalid' : 'server'}`, appUrl))
}

/** Egy kattintásos leiratkozás a levelező saját gombjáról (List-Unsubscribe-Post, RFC 8058) — nincs átirányítás. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const r = await unsubscribe(token)
  return new NextResponse(null, { status: r === 'ok' ? 200 : r === 'invalid' ? 400 : 500 })
}
