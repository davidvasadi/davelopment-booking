import type { Payload } from 'payload'
import type { Booking, Customer, GiftVoucher, Reservation, Service } from '@/payload/payload-types'
import { capsWords } from '@/lib/utils'

/** Egy kezelendő tétel az Áttekintés akkordeonjában. */
export type InboxRow = { id: string; title: string; meta: string }
export type OverviewInbox = { unclosed: InboxRow[]; pending: InboxRow[]; birthdays: InboxRow[]; vouchers: InboxRow[] }

const VOUCHER_DAYS = 30
const fmtDate = (d: string) => capsWords(new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }))

/**
 * Az Áttekintés „kezelendők” (a /design 4.1): tegnapról lezáratlan foglalás (Megjelent / Nem jött), jóváhagyásra
 * váró foglalás, ma szülinapos vendég, 30 napon belül lejáró aktív utalvány. Szalon (bookings) és étterem (reservations) is.
 */
export async function getOverviewInbox(payload: Payload, kind: 'salon' | 'restaurant', businessId: string | number, today: string, yesterday: string): Promise<OverviewInbox> {
  const scope = { [kind]: { equals: businessId } }
  const collection = kind === 'salon' ? 'bookings' : 'reservations'
  const soon = new Date(); soon.setDate(soon.getDate() + VOUCHER_DAYS)
  const mmdd = today.slice(5) // „11-03”
  // A születésnap dátum-mező (időbélyeg, éjfél valamelyik időzónában) — +12 órával a UTC-nap mindig a megadott nap.
  const bday = (iso: string) => new Date(new Date(iso).getTime() + 12 * 3600_000).toISOString().slice(0, 10)

  const [unclosedRes, pendingRes, birthdayRes, voucherRes] = await Promise.all([
    payload.find({
      collection,
      where: { and: [scope, { date: { equals: yesterday } }, { status: { in: kind === 'salon' ? ['pending', 'confirmed'] : ['pending', 'confirmed', 'seated'] } }] },
      sort: 'start_time', depth: 1, limit: 50, overrideAccess: true,
    }),
    payload.find({
      collection,
      where: { and: [scope, { date: { greater_than_equal: today } }, { status: { equals: 'pending' } }] },
      sort: ['date', 'start_time'], depth: 1, limit: 50, overrideAccess: true,
    }),
    payload.find({
      collection: 'customers',
      where: { and: [scope, { birthday: { exists: true } }] },
      select: { customer_name: true, customer_phone: true, birthday: true },
      depth: 0, limit: 5000, pagination: false, overrideAccess: true,
    }),
    payload.find({
      collection: 'gift-vouchers',
      where: { and: [scope, { status: { equals: 'active' } }, { expires_at: { less_than_equal: soon.toISOString() } }, { expires_at: { greater_than_equal: new Date().toISOString() } }] },
      sort: 'expires_at', depth: 0, limit: 50, overrideAccess: true,
    }),
  ])

  const bookingRow = (b: Booking | Reservation, withDate: boolean): InboxRow => {
    const what = 'service' in b
      ? (typeof b.service === 'object' && b.service ? (b.service as Service).name : '')
      : `${(b as Reservation).pax} fő`
    return { id: String(b.id), title: b.customer_name, meta: [withDate ? `${fmtDate(b.date)} ${b.start_time ?? ''}`.trim() : b.start_time, what].filter(Boolean).join(' · ') }
  }

  return {
    unclosed: (unclosedRes.docs as (Booking | Reservation)[]).map((b) => bookingRow(b, false)),
    pending: (pendingRes.docs as (Booking | Reservation)[]).map((b) => bookingRow(b, true)),
    birthdays: (birthdayRes.docs as Customer[])
      .filter((c) => c.birthday && bday(c.birthday).slice(5) === mmdd)
      .slice(0, 50)
      .map((c) => ({ id: c.id, title: c.customer_name ?? 'Vendég', meta: [`${Number(today.slice(0, 4)) - Number(bday(c.birthday!).slice(0, 4))} éves`, c.customer_phone].filter(Boolean).join(' · ') })),
    vouchers: (voucherRes.docs as GiftVoucher[]).map((v) => ({
      id: v.id,
      title: v.recipient_name || v.purchaser_name,
      meta: `${v.code} · ${v.amount_huf.toLocaleString('hu-HU')} Ft · lejár ${fmtDate(v.expires_at)}`,
    })),
  }
}
