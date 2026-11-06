import type { CollectionAfterChangeHook, Payload } from 'payload'
import { isSilentImport } from '../../lib/silentImport'
import { postWebhook, type WebhookEvent } from '../../lib/outboundWebhook'

/**
 * Zapier / Make webhook (design 16.15.2): ha az üzletnél be van állítva `webhook_url`, az üzlet eseményeit elküldjük rá:
 *  - foglalás: új, módosított (dátum / idő / szakember / asztal), lemondott (ugyanazok a szabályok, mint az app-értesítésnél);
 *  - vendég: új vendég-rekord;
 *  - számla: a vendégnek kiállított számla (előleg a foglaláson, utalvány) — amikor a számlaszám megérkezik;
 *  - utalvány: eladott, beváltott;
 *  - értékelés: új értékelés a saját értékelő-oldalról.
 * Importált adatnál nem küldünk. Nem várjuk meg (a mentés nem lassul); a hibát csak naplózzuk.
 */

const relId = (val: unknown) => (val && typeof val === 'object' && 'id' in val ? String((val as { id: unknown }).id) : val ? String(val) : '')
const nameOf = (v: unknown) => (v && typeof v === 'object' && 'name' in v ? String((v as { name: unknown }).name ?? '') : null)
type Kind = 'salon' | 'restaurant'
type Doc = Record<string, unknown>

/** Az üzlet és a típusa egy dokumentumból (a `salon` / `restaurant` kapcsolat alapján). */
const businessOf = (doc: Doc): { kind: Kind; id: string } | null => (relId(doc.salon) ? { kind: 'salon', id: relId(doc.salon) } : relId(doc.restaurant) ? { kind: 'restaurant', id: relId(doc.restaurant) } : null)

function send(payload: Payload, biz: { kind: Kind; id: string }, event: WebhookEvent, build: () => Promise<Record<string, unknown>>) {
  void (async () => {
    try {
      const place = await payload.findByID({ collection: biz.kind === 'salon' ? 'salons' : 'restaurants', id: biz.id, depth: 0, overrideAccess: true }) as { name?: string; webhook_url?: string | null }
      const url = place?.webhook_url?.trim()
      if (!url) return
      const r = await postWebhook(url, event, { business: { type: biz.kind, id: biz.id, name: place.name ?? '' }, ...(await build()) })
      if (!r.ok) payload.logger.warn(`[webhook] ${biz.kind} ${biz.id} ${event}: ${r.status ?? r.error}`)
    } catch (e) {
      payload.logger.error(`[webhook] ${biz.kind} ${biz.id} ${event}: ${String(e)}`)
    }
  })()
}

const invoiceIssued = (doc: Doc, prev?: Doc) => !!doc.invoice_number && doc.invoice_number !== prev?.invoice_number

/** Foglalás / asztalfoglalás: új, módosított, lemondott — és a kiállított előleg-számla. */
export function webhookOnBooking(kind: Kind): CollectionAfterChangeHook {
  return async ({ req, doc, previousDoc, operation }) => {
    if (isSilentImport(req)) return doc
    const cancelled = operation === 'update' && doc.status === 'cancelled' && previousDoc?.status !== 'cancelled'
    const slot = kind === 'salon' ? 'staff' : 'table'
    const modified = operation === 'update' && !cancelled && doc.status !== 'cancelled' && (doc.date !== previousDoc?.date || doc.start_time !== previousDoc?.start_time || doc.end_time !== previousDoc?.end_time || relId(doc[slot]) !== relId(previousDoc?.[slot]))
    const event: WebhookEvent | null = operation === 'create' ? 'booking.created' : cancelled ? 'booking.cancelled' : modified ? 'booking.updated' : null
    const biz = { kind, id: relId(doc[kind]) }
    if (!biz.id) return doc
    const booking = async () => {
      const full = await req.payload.findByID({ collection: kind === 'salon' ? 'bookings' : 'reservations', id: doc.id, depth: 1, overrideAccess: true }) as Doc
      return {
        id: String(doc.id), status: full.status ?? doc.status, date: String(full.date ?? '').slice(0, 10), start_time: full.start_time ?? null, end_time: full.end_time ?? null,
        customer_name: full.customer_name ?? null, customer_email: full.customer_email ?? null, customer_phone: full.customer_phone ?? null, notes: full.notes ?? null,
        ...(kind === 'salon' ? { service: nameOf(full.service), staff: nameOf(full.staff) } : { pax: full.pax ?? null, table: nameOf(full.table) }),
      }
    }
    if (event) send(req.payload, biz, event, async () => ({ booking: await booking() }))
    if (operation === 'update' && invoiceIssued(doc, previousDoc)) {
      send(req.payload, biz, 'invoice.issued', async () => ({ invoice: { number: doc.invoice_number, pdf_url: doc.invoice_pdf_url ?? null, type: 'deposit', amount_huf: doc.deposit_amount_huf ?? null, customer_name: doc.customer_name ?? null, customer_email: doc.customer_email ?? null }, booking: await booking() }))
    }
    return doc
  }
}

/** Új vendég-rekord. */
export const webhookOnCustomer: CollectionAfterChangeHook = async ({ req, doc, operation }) => {
  if (operation !== 'create' || isSilentImport(req)) return doc
  const biz = businessOf(doc)
  if (biz) send(req.payload, biz, 'customer.created', async () => ({ customer: { id: String(doc.id), name: doc.customer_name ?? null, email: doc.customer_email ?? null, phone: doc.customer_phone ?? null, city: doc.customer_city ?? null, marketing_consent: !!doc.marketing_consent } }))
  return doc
}

/** Ajándékutalvány: eladott, beváltott — és a kiállított utalvány-számla. */
export const webhookOnVoucher: CollectionAfterChangeHook = async ({ req, doc, previousDoc, operation }) => {
  if (isSilentImport(req)) return doc
  const biz = businessOf(doc)
  if (!biz) return doc
  const voucher = () => ({ code: doc.code, amount_huf: doc.amount_huf, type: doc.type_name ?? null, status: doc.status, purchaser_name: doc.purchaser_name ?? null, purchaser_email: doc.purchaser_email ?? null, recipient_name: doc.recipient_name ?? null, expires_at: doc.expires_at ?? null })
  if (operation === 'create') send(req.payload, biz, 'voucher.purchased', async () => ({ voucher: voucher() }))
  if (operation === 'update' && doc.status === 'redeemed' && previousDoc?.status !== 'redeemed') send(req.payload, biz, 'voucher.redeemed', async () => ({ voucher: voucher() }))
  if (invoiceIssued(doc, operation === 'update' ? previousDoc : undefined)) send(req.payload, biz, 'invoice.issued', async () => ({ invoice: { number: doc.invoice_number, pdf_url: doc.invoice_pdf_url ?? null, type: 'voucher', amount_huf: doc.amount_huf ?? null, customer_name: doc.purchaser_name ?? null, customer_email: doc.purchaser_email ?? null }, voucher: voucher() }))
  return doc
}

/** Új értékelés a saját értékelő-oldalról. */
export const webhookOnReview: CollectionAfterChangeHook = async ({ req, doc, operation }) => {
  if (operation !== 'create') return doc
  const biz = businessOf(doc)
  if (biz) send(req.payload, biz, 'review.received', async () => ({ review: { rating: doc.rating, comment: doc.comment ?? null, customer_name: doc.customer_name ?? null, booking_id: relId(doc.booking) || relId(doc.reservation) || null } }))
  return doc
}
