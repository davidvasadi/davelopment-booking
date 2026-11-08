import type { Payload } from 'payload'
import { issueDepositInvoiceBestEffort } from './depositInvoice'
import { salonPayee } from './payee'
import type { Booking, Salon, StaffMember } from '@/payload/payload-types'

/**
 * A foglalás lezárása a helyszíni fizetéssel (design 6.7.1) — a „Lezárás” gomb (/api/salon/booking-checkout) és a
 * kifizetett fizetési link (Stripe webhook) is ezt hívja.
 *  - a fizetendő = tételek − (a már fizetett előleg) − (a beváltott utalvány) — a levonások a foglalásból jönnek;
 *  - bizonylat: pénztárgépes módban „register” (nálunk csak rögzítés); számlázós módban, ha a vendég kér számlát:
 *    a rendszer kiállítja (kiállító: az üzlet / szakemberenként a szakember); régi (áfás előleg-számlás) foglalásnál a
 *    végszámla kézzel („manual”); ha nem kér: „none”. Fizetési linknél a pénz online jött → mindig a számlázóval.
 *  - ÁFA a beváltáskor (docs/manual): a foglaló (`deposit_kind: 'foglalo'`) és az új utalvány (`vat_mode: 'redemption'`)
 *    befizetése áfa nélküli volt, ezért a végszámla a TELJES összegről szól, áfával — a foglaló / az utalvány ott csak
 *    fizetési mód (megjegyzésben). A régiek (már áfásan számlázva) továbbra is levonódnak a számlából.
 */
export type CheckoutInput = {
  lines: { name: string; amount: number }[]
  method: 'cash' | 'card' | 'transfer' | 'link'
  invoice: boolean
  buyer?: { name?: string; email?: string; taxNumber?: string; zip?: string; city?: string; address?: string }
}

export function checkoutTotals(booking: Booking, lines: CheckoutInput['lines']) {
  const clean = lines.filter((l) => l.amount > 0)
  const total = clean.reduce((n, l) => n + l.amount, 0)
  const deposit = booking.payment_status === 'paid' ? Math.round(Number(booking.deposit_amount_huf ?? 0)) : 0
  const voucher = Math.round(Number(booking.voucher_discount_huf ?? 0))
  return { lines: clean, total, deposit, voucher, due: Math.max(0, total - deposit - voucher) }
}

/** A végszámla összege: a teljes összeg, mínusz amit már áfásan számláztunk (régi előleg-számla / régi utalvány). */
async function invoiceBase(payload: Payload, booking: Booking, t: ReturnType<typeof checkoutTotals>) {
  const depositTaxed = t.deposit > 0 && booking.deposit_kind !== 'foglalo'
  let voucherTaxed = false
  if (t.voucher > 0 && booking.voucher_code) {
    const v = await payload.find({ collection: 'gift-vouchers', where: { code: { equals: booking.voucher_code } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => null)
    voucherTaxed = (v?.docs[0] as { vat_mode?: string | null } | undefined)?.vat_mode !== 'redemption'
  }
  const gross = Math.max(0, t.total - (depositTaxed ? t.deposit : 0) - (voucherTaxed ? t.voucher : 0))
  const fmt = (n: number) => `${n.toLocaleString('hu-HU')} Ft`
  const paidBy = [
    t.deposit > 0 && !depositTaxed ? `foglalóval ${fmt(t.deposit)}` : null,
    t.voucher > 0 && !voucherTaxed ? `ajándékutalvánnyal${booking.voucher_code ? ` (${booking.voucher_code})` : ''} ${fmt(t.voucher)}` : null,
  ].filter(Boolean)
  return { gross, depositTaxed, note: paidBy.length ? `Ebből kiegyenlítve: ${paidBy.join(', ')}.` : undefined }
}

export async function closeBookingWithPayment(payload: Payload, booking: Booking, salon: Salon, input: CheckoutInput, actor?: unknown) {
  const t = checkoutTotals(booking, input.lines)
  const base = await invoiceBase(payload, booking, t)
  const mode = salon.onsite_payment?.mode === 'invoice' || input.method === 'link' ? 'invoice' : 'register'
  // a végszámla akkor is kell, ha a foglaló / az utalvány mindent fedez (az ÁFA ott keletkezik)
  const wantsInvoice = mode === 'invoice' && input.invoice && base.gross > 0
  const hadDepositInvoice = base.depositTaxed && !!booking.invoice_number
  const receipt: 'invoice' | 'register' | 'none' | 'manual' =
    mode === 'register' ? 'register' : !wantsInvoice ? 'none' : hadDepositInvoice ? 'manual' : 'invoice'

  await payload.update({
    collection: 'bookings', id: booking.id, overrideAccess: true, ...(actor ? { user: actor as never } : {}),
    data: {
      status: 'completed', paid_amount_huf: t.due, pay_method: t.due > 0 ? input.method : null, pay_receipt: receipt,
      paid_lines: t.lines, paid_at: new Date().toISOString(),
      ...(receipt === 'invoice' ? { invoice_status: 'none' as const } : {}),
    },
  })

  if (receipt === 'invoice') {
    const staffId = typeof booking.staff === 'object' && booking.staff ? booking.staff.id : booking.staff
    const staff = staffId ? ((await payload.findByID({ collection: 'staff', id: staffId, depth: 0, overrideAccess: true }).catch(() => null)) as StaffMember | null) : null
    const payee = salonPayee(salon, staff)
    // a már áfásan számlázott rész (régi előleg / régi utalvány) arányos levonása a tételekből; a foglaló és az új
    // utalvány nem vonódik le — a végszámla a teljes összegről szól, ők a megjegyzésben fizetési módként
    const factor = t.total > 0 ? base.gross / t.total : 0
    const invLines = t.lines.map((l) => ({ label: l.name, grossHuf: Math.round(l.amount * factor) }))
    const diff = base.gross - invLines.reduce((n, l) => n + l.grossHuf, 0)
    if (invLines.length && diff) invLines[0].grossHuf += diff
    const b = input.buyer ?? {}
    void issueDepositInvoiceBestEffort({
      collection: 'bookings', id: booking.id,
      invoiceSettings: payee.invoiceSettings, sellerTaxNumber: payee.taxNumber,
      buyer: {
        name: b.name || booking.customer_name || 'Vendég', email: b.email || booking.customer_email || '',
        taxNumber: b.taxNumber || null, zip: b.zip || null, city: b.city || booking.customer_city || null, address: b.address || booking.customer_address || null, country: booking.customer_country || null,
      },
      label: t.lines[0]?.name ?? 'Szolgáltatás', grossHuf: base.gross, lines: invLines.filter((l) => l.grossHuf > 0), note: base.note,
      orderRef: `manual-booking-${booking.id}`,
      paymentMethod: input.method === 'transfer' ? 'transfer' : input.method === 'cash' ? 'cash' : 'card',
    })
  }
  return { due: t.due, receipt }
}
