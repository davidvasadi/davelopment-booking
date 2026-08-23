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

import type { InvoiceBuyer, InvoiceLine, CreateInvoiceResult } from './szamlazz'

const API_BASE = 'https://api.billingo.hu/v3'

export interface BillingoCreateInvoiceParams {
  apiKey: string
  buyer: InvoiceBuyer
  lines: InvoiceLine[]
  orderRef?: string
  paid?: boolean
}

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
        country_code: 'HU',
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
    payment_method: 'bankcard',
    language: 'hu',
    currency: 'HUF',
    conversion_rate: { value: 1 },
    electronic: true,
    paid: !!params.paid,
    comment: params.orderRef ? `Stripe: ${params.orderRef}` : undefined,
    items: params.lines.map((l) => ({
      name: l.label,
      quantity: 1,
      unit: 'db',
      net_unit_price: Math.round(l.grossHuf), // AAM-ekvivalens: nettó = bruttó, 0% ÁFA a legtöbb kisvállalkozásnál
      vat: 'AAM',
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
