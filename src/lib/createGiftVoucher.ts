import { getPayloadClient } from './payload'
import { generateUniqueVoucherCode } from './voucherCode'
import { generateVoucherQrDataUrl } from './voucherQr'
import { fixMediaUrl } from './utils'
import { issueDepositInvoiceBestEffort } from './depositInvoice'
import { sendVoucherPurchaseEmail, sendVoucherGiftEmail } from './email'
import { sendVoucherPurchaseEmail as sendRestaurantVoucherPurchaseEmail, sendVoucherGiftEmail as sendRestaurantVoucherGiftEmail } from './restaurantEmail'
import type { Salon, Restaurant, GiftVoucherType } from '@/payload/payload-types'
import { isForeignCountry } from './countries'
import { brandImage, type BrandPlace } from './brandImage'

/**
 * A ténylegesen kifizetett (vagy helyszínen készpénzben/kártyával átvett) ajándékutalvány
 * rekord létrehozása — a kód/QR generálás, a rekord mentése, a számla-kiállítás és az emailek
 * KÖZÖS törzse. Három hívó van: a guest online vásárlás (`/api/vouchers`, kliens-visszaigazolt
 * Stripe-fizetés után), az admin "már kifizetve" helyszíni kiállítás
 * (`/api/gift-vouchers/manual-create`, nincs Stripe), és a Connect webhook (`/api/stripe/
 * connect/webhook`, admin által küldött fizetési link SIKERES fizetése után). Mindhárom
 * hívó a SAJÁT útján már megbizonyosodott arról, hogy a fizetés valós/rendben van — ez a
 * függvény már nem ellenőriz semmit, csak létrehoz.
 */
export async function createGiftVoucher(params: {
  kind: 'salon' | 'restaurant'
  business: Salon | Restaurant
  amountHuf: number
  voucherTypeId?: string | null
  paymentIntentId: string
  paymentMethod?: 'online' | 'payment_link' | 'cash' | 'pos_card' | 'transfer' | 'other'
  /** `city` ÉS `address` KÖTELEZŐ (nem opcionális!) — a Számlázz.hu enélkül nem tudja kiküldeni
   *  emailben a számlát (nem csak a kiállítás hasal el rajta, lásd `depositInvoice.ts`). Minden
   *  hívónak zod-szinten is `.min(1)`-gyel kell kikényszerítenie, ne csak UI-oldalon. */
  buyer: { name: string; email: string; city: string; address: string; taxNumber?: string | null; country?: string | null }
  recipient?: { name?: string | null; email?: string | null; message?: string | null }
  locale?: string | null
  /** dashboardon kiállító felhasználó (helyben / fizetési link); üres = vendég online vásárlása */
  issuedBy?: string | number | null
  /** false = a kiállító nem kért számlát (pl. pénztárgépből számláz) → 'skipped', nincs hívás */
  issueInvoice?: boolean
}): Promise<{ code: string; amountHuf: number; qrCodeDataUrl: string; expiresAt: string }> {
  const { kind, business, amountHuf, voucherTypeId, paymentIntentId, paymentMethod, buyer, recipient, locale, issuedBy, issueInvoice = true } = params
  const payload = await getPayloadClient()

  const voucherType = voucherTypeId
    ? ((await payload.findByID({ collection: 'gift-voucher-types', id: voucherTypeId, depth: 1, overrideAccess: true }).catch(() => null)) as GiftVoucherType | null)
    : null

  const code = await generateUniqueVoucherCode()
  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + (business.voucher_settings?.validity_months ?? 12))
  // a QR-kód közepe: a tulaj választása (ikon / logó / nincs — design 24.2, lib/brandImage)
  const qrImg = brandImage(business as BrandPlace, 'qr')
  const logoUrl = qrImg ? fixMediaUrl(qrImg) : null
  const qrCodeDataUrl = await generateVoucherQrDataUrl(business.slug, code, logoUrl)

  const imageId = voucherType?.image && typeof voucherType.image === 'object' ? voucherType.image.id : (voucherType?.image ?? undefined)

  const voucher = await payload.create({
    collection: 'gift-vouchers',
    overrideAccess: true,
    data: {
      ...(kind === 'salon' ? { salon: business.id } : { restaurant: business.id }),
      ...(voucherType ? { voucher_type: voucherType.id, type_name: voucherType.name } : {}),
      code,
      amount_huf: amountHuf,
      ...(imageId ? { image: imageId } : {}),
      qr_code_url: qrCodeDataUrl,
      purchaser_name: buyer.name,
      purchaser_email: buyer.email,
      recipient_name: recipient?.name || undefined,
      recipient_email: recipient?.email || undefined,
      message: recipient?.message || undefined,
      status: 'active',
      payment_intent_id: paymentIntentId,
      payment_method: paymentMethod ?? null,
      expires_at: expiresAt.toISOString(),
      locale: locale || 'hu',
      // az utalvány eladása áfa nélküli; az ÁFA a beváltáskor keletkezik (docs/manual — régi utalványnál üres)
      vat_mode: 'redemption',
      ...(issuedBy != null && issuedBy !== '' ? { issued_by: Number(issuedBy) || issuedBy } : {}),
      ...(issueInvoice ? {} : { invoice_status: 'skipped' as const }),
    },
  })

  if (issueInvoice) void issueDepositInvoiceBestEffort({
    collection: 'gift-vouchers',
    id: voucher.id,
    invoiceSettings: business.invoice_settings,
    sellerTaxNumber: business.tax_number,
    buyer: { name: buyer.name, email: buyer.email, city: buyer.city, address: buyer.address, taxNumber: buyer.taxNumber, country: buyer.country },
    // az utalvány eladása NEM áfás (TAHK — mint a pénz: még nem tudni, mire költik); az ÁFA a beváltáskor, az üzlet
    // végszámláján / kasszájában keletkezik, ahol az utalvány fizetési mód. Külföldi vevőnél a számla angol.
    label: isForeignCountry(buyer.country) ? `Gift voucher – ${business.name} (outside the scope of VAT)` : `Ajándékutalvány – ${business.name} (ÁFA tv. hatályán kívül)`,
    vatOverride: 'TAHK',
    note: isForeignCountry(buyer.country) ? `Voucher code: ${code}. VAT is charged on redemption.` : `Utalványkód: ${code}. Az ÁFA a beváltáskor kerül felszámításra.`,
    grossHuf: amountHuf,
    orderRef: paymentIntentId,
    // helyszíni kiállításnál a valós fizetési mód kerüljön a számlára (eddig mindig bankkártya volt)
    paymentMethod: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'transfer' ? 'transfer' : 'card',
  })

  const emailData = {
    code, amountHuf, qrCodeDataUrl,
    purchaserName: buyer.name, purchaserEmail: buyer.email,
    recipientName: recipient?.name || null, recipientEmail: recipient?.email || null,
    message: recipient?.message || null,
  }
  if (kind === 'salon') {
    void sendVoucherPurchaseEmail({ salon: business as Salon, ...emailData })
    if (recipient?.email) void sendVoucherGiftEmail({ salon: business as Salon, ...emailData })
  } else {
    void sendRestaurantVoucherPurchaseEmail({ restaurant: business as Restaurant, ...emailData })
    if (recipient?.email) void sendRestaurantVoucherGiftEmail({ restaurant: business as Restaurant, ...emailData })
  }

  return { code, amountHuf, qrCodeDataUrl, expiresAt: expiresAt.toISOString() }
}
