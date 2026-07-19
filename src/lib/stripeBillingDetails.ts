import { getStripe } from './stripe'

export interface StripeBillingCard {
  brand: string
  last4: string
  expiry: string
  holder: string
}

export interface StripeBillingInvoice {
  date: string
  number: string
  plan: string
  amount: string
  status: string
  downloadUrl: string | null
}

export interface StripeBillingDetails {
  card: StripeBillingCard | null
  invoices: StripeBillingInvoice[]
}

const EMPTY: StripeBillingDetails = { card: null, invoices: [] }

function hufFromMinor(minor: number): string {
  return `${Math.round(minor / 100).toLocaleString('hu-HU')} Ft`
}

function invoiceStatusLabel(status: string | null): string {
  switch (status) {
    case 'paid': return 'Kifizetve'
    case 'open': return 'Esedékes'
    case 'uncollectible':
    case 'void': return 'Érvénytelen'
    default: return 'Feldolgozás'
  }
}

/**
 * Szerver-oldali Stripe lekérdezés: fizetési mód (kártya) + számlalista.
 * Hiba esetén EMPTY-vel tér vissza — a billing panel gracefully kezeli.
 */
export async function getStripeBillingDetails(
  stripeCustomerId: string | null | undefined,
): Promise<StripeBillingDetails> {
  if (!stripeCustomerId) return EMPTY

  const stripe = getStripe()
  if (!stripe) return EMPTY

  try {
    const [pmResult, invoicesResult] = await Promise.all([
      stripe.paymentMethods.list({ customer: stripeCustomerId, type: 'card', limit: 1 }),
      stripe.invoices.list({ customer: stripeCustomerId, limit: 24, status: 'paid' }),
    ])

    let card: StripeBillingCard | null = null
    if (pmResult.data.length > 0) {
      const pm = pmResult.data[0]
      const c = pm.card
      if (c) {
        card = {
          brand: c.brand.toUpperCase(),
          last4: c.last4,
          expiry: `${String(c.exp_month).padStart(2, '0')}/${String(c.exp_year).slice(-2)}`,
          holder: pm.billing_details?.name ?? '',
        }
      }
    }

    const invoices: StripeBillingInvoice[] = invoicesResult.data.map((inv) => ({
      date: new Date(inv.created * 1000).toLocaleDateString('hu-HU', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),
      number: inv.number ?? '—',
      plan: inv.lines?.data?.[0]?.description?.replace(/\s*×.*$/, '').trim() ?? 'Előfizetés',
      amount: hufFromMinor(inv.amount_paid),
      status: invoiceStatusLabel(inv.status),
      downloadUrl: inv.hosted_invoice_url ?? inv.invoice_pdf ?? null,
    }))

    return { card, invoices }
  } catch (err) {
    console.error('[stripeBillingDetails] Stripe API hiba:', err)
    return EMPTY
  }
}
