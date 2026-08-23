import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { getPayloadClient } from '@/lib/payload'
import type { EmailLogEntry } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

interface ResendWebhookEvent {
  type: string
  created_at: string
  data: { email_id?: string; [key: string]: unknown }
}

const STATUS_BY_EVENT: Partial<Record<string, EmailLogEntry['status'] & string>> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  // A küldés-időpontban elkapott hiba (email.ts/restaurantEmail.ts catch ága) már `failed`-re
  // állítja a rekordot szinkron — ez csak arra az esetre, ha Resend UTÓLAG, aszinkron módon
  // jelezné ugyanezt egy webhook-eseményben.
  'email.failed': 'failed',
}

// Egy "előrébb tartó" állapotot (pl. megnyitva) ne írjon felül egy később beérkező, de
// "kevesebb infót hordozó" esemény (pl. egy elkésett "kézbesítve" webhook a megnyitás után).
const RANK: Record<string, number> = { sent: 0, delivered: 1, bounced: 1, complained: 1, opened: 2, clicked: 3, failed: 0 }

/**
 * Resend webhook — email.delivered/opened/clicked/bounced/complained eseményeket fogad, Svix-
 * aláírással hitelesítve (ugyanaz a minta, mint a Stripe webhooknál: nyers body + secret).
 * A `data.email_id` a `resend.emails.send()` válaszának id-je, amit a `logEmail()` az
 * `email-log` rekord `resend_id` mezőjében tárol el küldéskor — ezzel párosít ide vissza.
 * A Resend dashboardon (Webhooks) kell beállítani az URL-t + a titkot RESEND_WEBHOOK_SECRET-be.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'A webhook nincs konfigurálva.' }, { status: 503 })

  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Hiányzó aláírás' }, { status: 400 })
  }

  const raw = await req.text()
  let event: ResendWebhookEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(raw, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent
  } catch (err) {
    console.error('[Resend webhook] aláírás-ellenőrzés hibás:', err)
    return NextResponse.json({ error: 'Érvénytelen aláírás' }, { status: 400 })
  }

  const status = STATUS_BY_EVENT[event.type]
  const emailId = event.data.email_id
  if (!status || !emailId) return NextResponse.json({ received: true })

  try {
    const payload = await getPayloadClient()
    const existing = await payload.find({
      collection: 'email-log',
      where: { resend_id: { equals: emailId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = existing.docs[0] as EmailLogEntry | undefined
    if (!doc) return NextResponse.json({ received: true })

    const currentRank = RANK[doc.status ?? 'sent'] ?? 0
    const nextRank = RANK[status] ?? 0
    const data: Partial<EmailLogEntry> = {}
    if (nextRank >= currentRank) data.status = status
    if (status === 'delivered' && !doc.delivered_at) data.delivered_at = event.created_at
    if (status === 'opened' && !doc.opened_at) data.opened_at = event.created_at

    if (Object.keys(data).length > 0) {
      await payload.update({ collection: 'email-log', id: doc.id, overrideAccess: true, data })
    }
  } catch (err) {
    console.error(`[Resend webhook] feldolgozási hiba (${event.type}):`, err)
    return NextResponse.json({ error: 'Feldolgozási hiba' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
