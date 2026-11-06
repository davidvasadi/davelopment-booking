import type { Payload } from 'payload'
import { decrypt } from './encryption'
import { fetchInvoicePdf } from './szamlazz'
import { invoiceSettingsForRecord } from './payee'
import type { Salon, Restaurant } from '@/payload/payload-types'

/**
 * Egy vendégnek kiállított számla PDF-je (`ref`: v-<utalvány> | b-<foglalás>). Ha a rekordon van tárolt PDF-link
 * (pl. Billingo), azt adja (`url`); különben az üzlet SAJÁT Számlázz.hu fiókjából kéri le a számlaszám alapján (`pdf`).
 * Az egyes letöltés és a „Kijelöltek letöltése” (ZIP) is ezt használja.
 */
export type InvoicePdf =
  | { ok: true; number: string; url: string; pdf?: undefined }
  | { ok: true; number: string; pdf: Uint8Array; url?: undefined }
  | { ok: false; status: number; error: string }

export async function loadInvoicePdf(payload: Payload, kind: 'salon' | 'restaurant', bizId: string, ref: string): Promise<InvoicePdf> {
  if (!/^[vb]-.+$/.test(ref)) return { ok: false, status: 400, error: 'Hiányzó paraméter' }
  const recId = ref.slice(2)
  const collection = ref.startsWith('v-') ? 'gift-vouchers' : kind === 'salon' ? 'bookings' : 'reservations'
  const rec = (await payload.findByID({ collection, id: recId, depth: 0, overrideAccess: true }).catch(() => null)) as
    | { salon?: unknown; restaurant?: unknown; staff?: unknown; invoice_number?: string | null; invoice_pdf_url?: string | null } | null
  const owner = rec ? (kind === 'salon' ? rec.salon : rec.restaurant) : null
  const ownerId = owner && typeof owner === 'object' ? (owner as { id: unknown }).id : owner
  if (!rec || String(ownerId) !== String(bizId)) return { ok: false, status: 404, error: 'Számla nem található' }
  const number = rec.invoice_number ?? recId
  if (rec.invoice_pdf_url) return { ok: true, number, url: rec.invoice_pdf_url }
  if (!rec.invoice_number) return { ok: false, status: 404, error: 'Ehhez a tételhez nem készült számla.' }
  const biz = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id: bizId, depth: 0, overrideAccess: true }).catch(() => null)) as Salon | Restaurant | null
  const inv = biz ? await invoiceSettingsForRecord(payload, biz, collection, rec) : null
  const enc = inv?.szamlazz_agent_key_enc
  if (!enc) return { ok: false, status: 404, error: 'A PDF a számlázó fiókodból kérhető le — nincs elmentett Számlázz.hu-kulcs.' }
  let key = ''
  try { key = decrypt(enc) } catch { return { ok: false, status: 500, error: 'A Számlázz.hu-kulcs nem olvasható.' } }
  const r = await fetchInvoicePdf(key, rec.invoice_number)
  if (!r.ok) return { ok: false, status: 502, error: r.error }
  return { ok: true, number, pdf: new Uint8Array(r.pdf) }
}
