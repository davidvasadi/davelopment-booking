import { NextRequest, NextResponse } from 'next/server'
import { isLocalRequest } from '@/lib/localRequest'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { getStripe, hufToStripeMinor } from '@/lib/stripe'
import { salonPayee } from '@/lib/payee'
import { checkoutTotals } from '@/lib/bookingCheckout'
import { emailLayout, COLORS, escapeHtml } from '@/lib/emailLayout'
import type { Booking, Salon, StaffMember } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')

/**
 * POST /api/salon/booking-paylink — fizetési link a foglalás lezárásához (design 6.7.1): Stripe Checkout a fizetés
 * fogadójánál (az üzlet, vagy szakemberenként a szakember — lib/payee), a fizetendő összegre (tételek − előleg −
 * utalvány). A QR-kódot a pultnál a vendég beolvassa, vagy (`send`) e-mailben megkapja. A kifizetés után a Stripe
 * webhook (payment_intent.succeeded, kind=booking-checkout) zárja le a foglalást a `pay_pending` adataival.
 * Helyi fejlesztésben (localhost) e-mailt nem küld — a link a válaszban és a terminálban van.
 */
const schema = z.object({
  bookingId: z.union([z.string(), z.number()]),
  lines: z.array(z.object({ name: z.string().trim().min(1).max(120), amount: z.number().int().min(0).max(10_000_000) })).min(1).max(30),
  invoice: z.boolean().optional(),
  buyer: z.object({ name: z.string().max(160).optional(), email: z.string().max(200).optional(), taxNumber: z.string().max(20).optional(), zip: z.string().max(10).optional(), city: z.string().max(80).optional(), address: z.string().max(200).optional() }).optional(),
  send: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  const b = parsed.data

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 404 })
  const denied = await assertCapability(user.id, 'salon', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'A fizetés jelenleg nincs konfigurálva.' }, { status: 503 })

  const payload = await getPayloadClient()
  const booking = (await payload.findByID({ collection: 'bookings', id: b.bookingId, depth: 0, overrideAccess: true }).catch(() => null)) as Booking | null
  const salonId = booking && (typeof booking.salon === 'object' ? booking.salon.id : booking.salon)
  if (!booking || String(salonId) !== String(active.id)) return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  if (booking.paid_at) return NextResponse.json({ error: 'Ez a foglalás már le van zárva fizetéssel' }, { status: 409 })

  const salon = (await payload.findByID({ collection: 'salons', id: active.id, depth: 0, overrideAccess: true })) as Salon
  const staffId = typeof booking.staff === 'object' && booking.staff ? booking.staff.id : booking.staff
  const staff = staffId ? ((await payload.findByID({ collection: 'staff', id: staffId, depth: 0, overrideAccess: true }).catch(() => null)) as StaffMember | null) : null
  const payee = salonPayee(salon, staff)
  if (!payee.canTakePayments || !payee.accountId) {
    return NextResponse.json({ error: payee.kind === 'staff' ? `${payee.name} még nem kötötte be a Stripe-ot — nála nincs fizetési link.` : 'Előbb kösd be a Stripe-ot (Beállítások › Fizetés & számlázás).' }, { status: 400 })
  }

  const t = checkoutTotals(booking, b.lines)
  if (t.due <= 0) return NextResponse.json({ error: 'Nincs mit fizetni — zárd le fizetés nélkül.' }, { status: 400 })

  const email = b.buyer?.email || booking.customer_email || undefined
  const meta = { kind: 'booking-checkout', bookingId: String(booking.id), salonId: String(active.id) }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency: 'huf', unit_amount: hufToStripeMinor(t.due), product_data: { name: `${salon.name} — ${t.lines.map((l) => l.name).join(', ').slice(0, 200)}` } }, quantity: 1 }],
    ...(email ? { customer_email: email } : {}),
    metadata: meta,
    payment_intent_data: { metadata: meta, ...(email ? { receipt_email: email } : {}) },
    success_url: `${APP_URL}/${salon.slug}?paid=1`,
    cancel_url: `${APP_URL}/${salon.slug}`,
  }, { stripeAccount: payee.accountId })

  await payload.update({
    collection: 'bookings', id: booking.id, overrideAccess: true,
    data: { pay_link_url: session.url, pay_link_session: session.id, pay_pending: { lines: t.lines, invoice: !!b.invoice, buyer: b.buyer ?? null } },
  })

  let sent = false
  if (b.send && email && session.url) {
    if (isLocalRequest(req.headers)) {
      console.log(`\n[booking-paylink] HELYI — nem küldünk levelet (${email}): ${session.url}\n`)
    } else {
      const content = `<tr><td style="background:${COLORS.surface};padding:34px 32px 30px">
        <h1 style="margin:0;font-size:22px;font-weight:300;color:${COLORS.text}">Fizetés — ${escapeHtml(salon.name)}</h1>
        <p style="margin:10px 0 0;color:${COLORS.textSoft};font-size:14px;line-height:1.6">${escapeHtml(t.lines.map((l) => l.name).join(', '))} · <strong>${t.due.toLocaleString('hu-HU')} Ft</strong></p>
        <a href="${session.url}" style="display:inline-block;margin:22px 0 0;background:${COLORS.ink};color:#FFFFFF;text-decoration:none;border-radius:999px;padding:12px 22px;font-size:14px">Fizetés kártyával</a>
        <p style="margin:18px 0 0;color:${COLORS.textFaint};font-size:12px">Kártyával, Apple Pay-jel vagy Google Pay-jel fizethetsz, a Stripe biztonságos oldalán.</p>
      </td></tr>`
      await payload.sendEmail({ to: email, subject: `Fizetési link — ${salon.name}`, html: emailLayout({ brandName: salon.name, content }) })
        .then(() => { sent = true })
        .catch((e: unknown) => console.error('[booking-paylink] e-mail hiba:', e))
    }
  }
  return NextResponse.json({ url: session.url, due: t.due, sent })
}
