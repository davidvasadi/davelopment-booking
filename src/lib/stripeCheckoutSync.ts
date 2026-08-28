import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { Pool } from 'pg'
import { mapStripeStatus } from './stripe'
import { createInvoice } from './szamlazz'

/**
 * A Stripe-webhook (`checkout.session.completed` / `invoice.paid`) tényleges DB-szinkron logikája,
 * kiemelve a webhook route-ból — így ugyanezt a `/api/stripe/checkout/verify` (a checkout-redirect
 * UTÁNI, azonnali fallback-ellenőrzés) is meg tudja hívni, ha a webhook még nem (vagy sosem) ért ide.
 * MINDKÉT hívó ugyanezt futtatja, tehát nincs eltérő/duplikált logika a két úton — csak a
 * TRIGGER (esemény vs. kliens-kérés) különbözik.
 */

// A Stripe API-verziótól függően a periódus-vég a subscriptionön vagy az itemen ül — defenzív olvasás.
export function periodEndISO(sub: Stripe.Subscription): string | undefined {
  const raw = (sub as unknown as { current_period_end?: number }).current_period_end
    ?? sub.items?.data?.[0]?.current_period_end
  return typeof raw === 'number' ? new Date(raw * 1000).toISOString() : undefined
}

/** A sikeres Checkout eredményét írja a mi `subscriptions` rekordunkra (idempotens — újrafuttatva ugyanazt az állapotot állítja be). */
export async function applyCheckoutCompleted(payload: Payload, params: {
  ourSubId: string
  stripeSub: Stripe.Subscription
  custId?: string | null
  cycle: 'monthly' | 'annual'
}): Promise<void> {
  const { ourSubId, stripeSub, custId, cycle } = params
  const end = periodEndISO(stripeSub)
  await payload.update({
    collection: 'subscriptions', id: ourSubId, overrideAccess: true,
    data: {
      plan: 'paid',
      status: mapStripeStatus(stripeSub.status),
      billing_cycle: cycle,
      stripe_subscription_id: stripeSub.id,
      ...(custId ? { stripe_customer_id: custId } : {}),
      ...(end ? { current_period_end: end } : {}),
      cancel_at_period_end: stripeSub.cancel_at_period_end,
    },
  })
}

async function savePdfToDb(invoiceId: string | number, pdfBase64: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URI })
  try {
    await pool.query(
      'INSERT INTO invoice_pdfs (invoice_id, pdf_base64) VALUES ($1, $2) ON CONFLICT (invoice_id) DO UPDATE SET pdf_base64 = EXCLUDED.pdf_base64',
      [invoiceId, pdfBase64]
    )
  } finally {
    await pool.end()
  }
}

/**
 * Számlázz.hu számla kiállítása egy Stripe `invoice.paid`-hoz — idempotens
 * (`stripe_invoice_id` alapján kihagyja, ha már feldolgoztuk). `our` a mi `subscriptions`
 * rekordunk (owner relationnel).
 */
export async function ensureInvoiceForStripeInvoice(
  payload: Payload,
  our: { id: string | number; owner?: unknown; billing_cycle?: string | null; amount_huf?: number | null },
  inv: Stripe.Invoice,
): Promise<void> {
  const ownerId = typeof our.owner === 'object' && our.owner ? (our.owner as { id: string | number }).id : (our.owner as string | number | undefined)
  if (!ownerId) return

  const stripeInvId = typeof inv.id === 'string' ? inv.id : null
  if (stripeInvId) {
    const existing = await payload.find({ collection: 'invoices', where: { stripe_invoice_id: { equals: stripeInvId } }, limit: 1, overrideAccess: true })
    if (existing.totalDocs > 0) return
  }

  // Vevő adatok: az owner összes üzlete közül az első amelyiknek van billing_city kitöltve
  // (a felhasználó bármelyik üzlet beállításaiban menthette az adatokat).
  const [salonsRes, restaurantsRes] = await Promise.all([
    payload.find({ collection: 'salons', where: { owner: { equals: ownerId } }, limit: 50, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'restaurants', where: { owner: { equals: ownerId } }, limit: 50, depth: 0, overrideAccess: true }),
  ])
  const allBiz = [...salonsRes.docs, ...restaurantsRes.docs] as Record<string, unknown>[]
  const biz = (allBiz.find((b) => b.billing_city) ?? allBiz[0] ?? null) as Record<string, string | null | undefined> | null
  const user = await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true }).catch(() => null) as { email?: string; name?: string } | null

  const b = biz
  const buyerName = b?.legal_name || b?.name || user?.name || ''
  const buyerEmail = b?.billing_email || b?.email || user?.email || ''

  const label = `davelopment booking előfizetés — ${our.billing_cycle === 'annual' ? 'éves' : 'havi'}`
  // A TÉNYLEGESEN beérkezett Stripe-összeg az elsődleges forrás — a helyi `amount_huf` csak
  // vészhelyzeti tartalék, ha a Stripe invoice valamiért nem hordozná (elvileg mindig hordozza).
  // Korábban fordítva volt (amount_huf elsőbbséggel), ami eltérést engedett a ténylegesen
  // terhelt és a számlázott összeg között, ha a kettő bármi okból szétcsúszik.
  const paidFromStripeHuf = typeof inv.amount_paid === 'number' ? Math.round(inv.amount_paid / 100) : null
  const grossHuf = paidFromStripeHuf ?? our.amount_huf ?? 0

  const result = await createInvoice({
    buyer: {
      name: buyerName,
      email: buyerEmail,
      zip: b?.billing_postal_code ?? null,
      city: b?.billing_city ?? null,
      address: b?.billing_street ?? null,
      taxNumber: b?.tax_number ?? null,
    },
    lines: [{ label, grossHuf }],
    orderRef: stripeInvId ?? undefined,
    paid: true,
  })

  if (result.ok) {
    const newInv = await payload.create({
      collection: 'invoices',
      overrideAccess: true,
      data: {
        subscription: our.id,
        invoice_number: result.invoiceNumber,
        invoice_url: result.invoiceUrl ?? undefined,
        amount_huf: grossHuf,
        stripe_invoice_id: stripeInvId ?? undefined,
        issued_at: new Date().toISOString(),
        test: result.test,
      },
    })
    if (result.pdfBase64) {
      await savePdfToDb(newInv.id, result.pdfBase64).catch((e) =>
        console.error('[stripeCheckoutSync] PDF mentés hiba:', e)
      )
    }
    await payload.update({ collection: 'subscriptions', id: our.id, overrideAccess: true, data: { last_invoice_number: result.invoiceNumber, ...(result.invoiceUrl ? { last_invoice_url: result.invoiceUrl } : {}) } })
    console.log(`[stripeCheckoutSync] Számla kiállítva: ${result.invoiceNumber}${result.test ? ' (TESZT)' : ''}`)
  } else if (!result.disabled) {
    console.error('[stripeCheckoutSync] Számlázz.hu hiba:', result.error)
  }
}
