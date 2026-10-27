import { getPayloadClient } from './payload'
import { decrypt } from './encryption'
import { createInvoice as createSzamlazzInvoice, type InvoicePaymentMethod } from './szamlazz'
import { createInvoice as createBillingoInvoice } from './billingo'

type InvoiceSettings = {
  invoice_provider?: string | null
  szamlazz_agent_key_enc?: string | null
  billingo_api_key_enc?: string | null
} | null | undefined

/**
 * Sikeres fizetés (előleg VAGY ajándékutalvány-vásárlás) után bizonylat kiállítása az üzlet
 * SAJÁT Számlázz.hu/Billingo fiókjából — best-effort, fire-and-forget (a hívó `void`-dal hívja,
 * nem blokkolja a válasz visszaadását, mint az emailküldés máshol is). Hiba esetén
 * `invoice_status: 'failed'`-ra állítja a rekordot — ez NEM vonja vissza a fizetést, csak jelzi
 * a tulajnak, hogy manuálisan kell számlát kiállítania. A név "deposit" marad (történeti okból,
 * ez épült elsőnek), de a `collection` unió miatt a voucher-vásárlás (`/api/vouchers`) is ezt
 * hívja — nincs értelme egy szinte szó szerint másolt második fájlnak.
 */
export async function issueDepositInvoiceBestEffort({
  collection,
  id,
  invoiceSettings,
  buyer,
  label,
  grossHuf,
  orderRef,
  paymentMethod,
}: {
  collection: 'bookings' | 'reservations' | 'gift-vouchers'
  id: string | number
  invoiceSettings: InvoiceSettings
  /** A Számlázz.hu a `city`-t (település) kötelezőnek tartja — ha a vendég nem adta meg,
   *  a bizonylat-kiállítás hibázni fog (best-effort, nem blokkolja a foglalást). A `taxNumber`
   *  opcionális — csak céges vásárlónál töltött, a `InvoiceBuyer.taxNumber`-be megy tovább. */
  buyer: { name: string; email: string; city?: string | null; address?: string | null; zip?: string | null; taxNumber?: string | null }
  label: string
  grossHuf: number
  orderRef: string
  /** számlán szereplő fizetési mód — alapból bankkártya (Stripe) */
  paymentMethod?: InvoicePaymentMethod
}): Promise<void> {
  if (!invoiceSettings?.invoice_provider || invoiceSettings.invoice_provider === 'none') return

  const payload = await getPayloadClient()
  try {
    let result: Awaited<ReturnType<typeof createSzamlazzInvoice>> | null = null

    if (invoiceSettings.invoice_provider === 'szamlazz' && invoiceSettings.szamlazz_agent_key_enc) {
      const agentKeyOverride = decrypt(invoiceSettings.szamlazz_agent_key_enc)
      result = await createSzamlazzInvoice({ buyer, lines: [{ label, grossHuf }], orderRef, paid: true, agentKeyOverride, paymentMethod })
    } else if (invoiceSettings.invoice_provider === 'billingo' && invoiceSettings.billingo_api_key_enc) {
      const apiKey = decrypt(invoiceSettings.billingo_api_key_enc)
      result = await createBillingoInvoice({ apiKey, buyer, lines: [{ label, grossHuf }], orderRef, paid: true, paymentMethod })
    } else {
      return // provider kiválasztva, de nincs elmentett kulcs — nincs mit hívni
    }

    if (result.ok) {
      await payload.update({
        collection, id, overrideAccess: true,
        data: { invoice_number: result.invoiceNumber, invoice_pdf_url: result.invoiceUrl ?? undefined, invoice_status: 'issued' },
      })
    } else if (!result.disabled) {
      console.error('[depositInvoice] számla-kiállítás hiba:', result.error)
      await payload.update({ collection, id, overrideAccess: true, data: { invoice_status: 'failed' } })
    }
  } catch (e) {
    console.error('[depositInvoice] váratlan hiba:', e)
    await payload.update({ collection, id, overrideAccess: true, data: { invoice_status: 'failed' } }).catch(() => null)
  }
}
