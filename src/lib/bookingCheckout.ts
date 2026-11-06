import type { Payload } from 'payload'
import { issueDepositInvoiceBestEffort } from './depositInvoice'
import { salonPayee } from './payee'
import type { Booking, Salon, StaffMember } from '@/payload/payload-types'

/**
 * A foglalás lezárása a helyszíni fizetéssel (design 6.7.1) — a „Lezárás” gomb (/api/salon/booking-checkout) és a
 * kifizetett fizetési link (Stripe webhook) is ezt hívja.
 *  - a fizetendő = tételek − (a már fizetett előleg) − (a beváltott utalvány) — a levonások a foglalásból jönnek;
 *  - bizonylat: pénztárgépes módban „register” (nálunk csak rögzítés); számlázós módban, ha a vendég kér számlát:
 *    előleg nélkül a rendszer kiállítja (kiállító: az üzlet / szakemberenként a szakember), előleges foglalásnál a
 *    végszámla kézzel („manual”); ha nem kér: „none”. Fizetési linknél a pénz online jött → mindig a számlázóval.
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

export async function closeBookingWithPayment(payload: Payload, booking: Booking, salon: Salon, input: CheckoutInput, actor?: unknown) {
  const t = checkoutTotals(booking, input.lines)
  const mode = salon.onsite_payment?.mode === 'invoice' || input.method === 'link' ? 'invoice' : 'register'
  const wantsInvoice = mode === 'invoice' && input.invoice && t.due > 0
  const hadDepositInvoice = t.deposit > 0 && !!booking.invoice_number
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
    // az utalvány levonása arányosan a tételekből — a számlán a ténylegesen fizetett összeg szerepel
    const factor = t.total > 0 ? t.due / t.total : 0
    const invLines = t.lines.map((l) => ({ label: l.name, grossHuf: Math.round(l.amount * factor) }))
    const diff = t.due - invLines.reduce((n, l) => n + l.grossHuf, 0)
    if (invLines.length && diff) invLines[0].grossHuf += diff
    const b = input.buyer ?? {}
    void issueDepositInvoiceBestEffort({
      collection: 'bookings', id: booking.id,
      invoiceSettings: payee.invoiceSettings, sellerTaxNumber: payee.taxNumber,
      buyer: {
        name: b.name || booking.customer_name || 'Vendég', email: b.email || booking.customer_email || '',
        taxNumber: b.taxNumber || null, zip: b.zip || null, city: b.city || booking.customer_city || null, address: b.address || booking.customer_address || null,
      },
      label: t.lines[0]?.name ?? 'Szolgáltatás', grossHuf: t.due, lines: invLines.filter((l) => l.grossHuf > 0),
      orderRef: `manual-booking-${booking.id}`,
      paymentMethod: input.method === 'transfer' ? 'transfer' : input.method === 'cash' ? 'cash' : 'card',
    })
  }
  return { due: t.due, receipt }
}
