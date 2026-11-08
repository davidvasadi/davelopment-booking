/**
 * Billingo — Számla API v3 kliens (üzletenkénti BYO API-kulccsal).
 *
 * ELLENTÉTBEN a Számlázz.hu-integrációval (`src/lib/szamlazz.ts`, ami a platform saját
 * SaaS-előfizetés-számlázásához használt, meglévő minta), ez a klienst 100%-ban ÚJ — a
 * Billingónak nincs meglévő mintája ebben a kódbázisban. Kizárólag üzletek SAJÁT
 * (dekódolt) API-kulcsával hívjuk, vendég-előleg bizonylat kiállításához.
 *
 * ⚠️ A Billingo v3 API pontos mező-elnevezése (partner/document block-ok) az ő oldalukon
 * változhat — implementáláskor/éles bekötés előtt validáld a hivatalos Billingo API
 * dokumentációval (https://www.billingo.hu/api-doc), ez a kliens a nyilvánosan ismert v3
 * struktúra alapján készült, de a Billingo oldali finomságok (pl. blokk-típus, fizetési mód
 * enumok) ellenőrzést igényelnek élesítés előtt.
 *
 * Ugyanazt a `CreateInvoiceParams`/`CreateInvoiceResult` shape-et adja vissza, mint a
 * `szamlazz.ts`, hogy a hívó oldal (bookings/reservations route) egységesen kezelhesse a két
 * szolgáltatót.
 */

import { invoiceComment, type InvoiceBuyer, type InvoiceLine, type CreateInvoiceResult, type InvoicePaymentMethod, type InvoiceVat } from './szamlazz'

import { isForeignCountry, normalizeCountry } from './countries'

const API_BASE = 'https://api.billingo.hu/v3'

export interface BillingoCreateInvoiceParams {
  apiKey: string
  buyer: InvoiceBuyer
  lines: InvoiceLine[]
  orderRef?: string
  paid?: boolean
  paymentMethod?: InvoicePaymentMethod
  /** ÁFA-kulcs (a kiállító adószámából) — alapból AAM */
  vat?: InvoiceVat
  /** a megjegyzésbe */
  note?: string
}

const BILLINGO_PAYMENT: Record<InvoicePaymentMethod, string> = { card: 'bankcard', cash: 'cash', transfer: 'wire_transfer' }

function todayYmd(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export async function createInvoice(params: BillingoCreateInvoiceParams, now: Date = new Date()): Promise<CreateInvoiceResult> {
  if (!params.apiKey) return { ok: false, disabled: true }
  if (!params.lines.length) return { ok: false, error: 'Nincs számlázható tétel' }

  const date = todayYmd(now)

  const body = {
    partner: {
      name: params.buyer.name,
      address: {
        country_code: normalizeCountry(params.buyer.country) ?? 'HU',
        post_code: params.buyer.zip ?? '',
        city: params.buyer.city ?? '',
        address: params.buyer.address ?? '',
      },
      emails: params.buyer.email ? [params.buyer.email] : [],
      taxcode: params.buyer.taxNumber ?? undefined,
    },
    block_id: 1, // az üzlet első számla-tömbje — Billingón a tulaj állítja be, melyiket használjuk
    type: 'invoice',
    fulfillment_date: date,
    due_date: date,
    payment_method: BILLINGO_PAYMENT[params.paymentMethod ?? 'card'],
    language: isForeignCountry(params.buyer.country) ? 'en' : 'hu',
    currency: 'HUF',
    conversion_rate: { value: 1 },
    electronic: true,
    paid: !!params.paid,
    comment: [invoiceComment(params.orderRef, isForeignCountry(params.buyer.country)), params.note].filter(Boolean).join(' · ') || undefined,
    items: params.lines.map((l) => ({
      name: l.label,
      quantity: 1,
      unit: 'db',
      // AAM: nettó = bruttó (változatlan); 27%: a bruttó egységárat adjuk meg, a nettót a Billingo számolja
      // AAM / TAHK: nettó = bruttó; 27%: a bruttó egységárat adjuk meg
      ...((l.vat ?? params.vat) === '27'
        ? { unit_price: Math.round(l.grossHuf), unit_price_type: 'gross', vat: '27%' }
        : { net_unit_price: Math.round(l.grossHuf), vat: (l.vat ?? params.vat) === 'TAHK' ? 'TAHK' : 'AAM' }),
    })),
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': params.apiKey },
      body: JSON.stringify(body),
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Hálózati hiba a Billingo felé' }
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => null) as { message?: string } | null
    return { ok: false, error: errBody?.message ?? `Billingo hiba (${res.status})`, code: String(res.status) }
  }

  const data = (await res.json().catch(() => null)) as { id?: number; invoice_number?: string; public_url?: string } | null
  if (!data?.invoice_number) {
    return { ok: false, error: 'Ismeretlen Billingo válasz (nincs számlaszám)' }
  }

  return { ok: true, invoiceNumber: data.invoice_number, invoiceUrl: data.public_url ?? null, pdfBase64: null, test: false }
}

/**
 * Egy kiállított számla sztornózása (Billingo v3: a bizonylatot a számlaszáma alapján megkeressük, majd
 * `POST /documents/{id}/cancel`). Visszaadja a sztornó bizonylat számát (és a nyilvános linkjét, ha van).
 */
export async function cancelInvoice(apiKey: string, invoiceNumber: string): Promise<{ ok: true; number: string; url: string | null } | { ok: false; error: string }> {
  const headers = { 'Content-Type': 'application/json', 'X-API-KEY': apiKey }
  try {
    const found = await fetch(`${API_BASE}/documents?query=${encodeURIComponent(invoiceNumber)}&per_page=25`, { headers, signal: AbortSignal.timeout(15000) })
    if (!found.ok) return { ok: false, error: `Billingo hiba (${found.status})` }
    const list = (await found.json().catch(() => null)) as { data?: { id: number; invoice_number?: string }[] } | null
    const doc = list?.data?.find((d) => d.invoice_number === invoiceNumber)
    if (!doc) return { ok: false, error: 'A számla nem található a Billingo-fiókban.' }
    const res = await fetch(`${API_BASE}/documents/${doc.id}/cancel`, { method: 'POST', headers, signal: AbortSignal.timeout(20000) })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null
      return { ok: false, error: err?.message ?? `Billingo hiba (${res.status})` }
    }
    const data = (await res.json().catch(() => null)) as { invoice_number?: string; public_url?: string } | null
    return { ok: true, number: data?.invoice_number ?? '', url: data?.public_url ?? null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Hálózati hiba a Billingo felé' }
  }
}
