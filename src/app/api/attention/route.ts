import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'
import { fixMediaUrl, hhmmToMinutes, ymdLocal } from '@/lib/utils'
import type { Booking, Reservation, Salon, Service, StaffMember } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/attention — „Ami figyelmet kér” (design 6.8.1) az aktív üzletben, annak, aki intézheti (`bookings.manage`):
 *  - `pending`: a jóváhagyásra váró foglalások (a legrégebbi elöl) — a sávhoz / popuphoz, a popup adataival;
 *  - `paymentDue`: szalonnál (helyszíni fizetés bekapcsolva) a véget ért, de fizetéssel le nem zárt foglalások (7 napra);
 *  - `prefs`: a felhasználó saját beállítása (popup a sáv helyett; fizetés-sáv).
 * Az AppShell `AttentionHost`-ja kérdezi le percenként.
 */
const DOW = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
const MON = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const dayLabel = (ymd: string) => { const d = new Date(`${ymd}T12:00:00`); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}.` }
const ft = (n: number) => `${Math.round(n).toLocaleString('hu-HU')} Ft`
const SRC: Record<string, string> = { online: 'Online · foglalóoldal', phone: 'Telefon', walk_in: 'Beeső' }

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { active } = await getActiveBusiness(user)
  const empty = { pending: [], paymentDue: { count: 0 }, prefs: { pendingPopup: false, paymentBar: false } }
  if (!active || !can(active.capabilities, 'bookings.manage')) return NextResponse.json(empty)

  const payload = await getPayloadClient()
  const me = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true }).catch(() => null)
  const p = (me?.personal_notif_prefs ?? {}) as { pending_popup?: boolean | null; payment_bar?: boolean | null }
  const prefs = { pendingPopup: p.pending_popup === true, paymentBar: p.payment_bar === true }
  const today = ymdLocal(new Date())

  if (active.type === 'restaurant') {
    const r = await payload.find({ collection: 'reservations', where: { and: [{ restaurant: { equals: active.id } }, { status: { equals: 'pending' } }, { date: { greater_than_equal: today } }] }, sort: 'createdAt', limit: 100, depth: 1, overrideAccess: true })
    // a foglaláskor kiosztott asztal(ok) neve — a jóváhagyó lapon az avatar helyén (javasolt asztal)
    const tableName = (x: Reservation) => (x.tables ?? []).map((t) => (typeof t === 'object' && t ? (t as { name?: string }).name : null)).filter(Boolean).join(' + ')
    const pending = (r.docs as Reservation[]).map((x) => ({
      id: String(x.id), name: x.customer_name || 'Vendég', when: `${dayLabel(x.date.slice(0, 10))} · ${x.start_time}`, createdAt: x.createdAt,
      service: `${x.pax} fő`, detail: tableName(x) ? `${x.occasion ?? 'asztalfoglalás'} · javasolt asztal` : (x.occasion ?? 'asztalfoglalás'), price: '', staffName: undefined, img: null, table: tableName(x) || undefined,
      rows: ([['Telefon', x.customer_phone], ['Megjegyzés', x.notes]] as [string, string | null | undefined][]).filter((y): y is [string, string] => !!y[1]),
    }))
    return NextResponse.json({ ...empty, pending, pendingTotal: r.totalDocs, prefs, kind: 'restaurant' })
  }

  const b = await payload.find({ collection: 'bookings', where: { and: [{ salon: { equals: active.id } }, { status: { equals: 'pending' } }, { date: { greater_than_equal: today } }] }, sort: 'createdAt', limit: 100, depth: 1, overrideAccess: true })
  // a szakember képe: a feltöltött munkatárs-fotó, különben a saját profilképe (e-mail alapján) — mint a Munkatársaknál
  const staffDocs = (b.docs as Booking[]).map((x) => (typeof x.staff === 'object' ? (x.staff as StaffMember) : null)).filter((x): x is StaffMember => !!x)
  const emails = [...new Set(staffDocs.filter((m) => !(m.avatar && typeof m.avatar === 'object') && m.email).map((m) => m.email!.toLowerCase()))]
  const userAvatar: Record<string, string> = {}
  if (emails.length) {
    const us = await payload.find({ collection: 'users', where: { email: { in: emails } }, limit: 100, depth: 0, overrideAccess: true })
    for (const u of us.docs as { email?: string | null; avatar_url?: string | null }[]) { const url = fixMediaUrl(u.avatar_url); if (u.email && url) userAvatar[u.email.toLowerCase()] = url }
  }
  const avatarOf = (m: StaffMember | null) => {
    if (!m) return null
    if (m.avatar && typeof m.avatar === 'object') return fixMediaUrl((m.avatar as { url?: string | null }).url) ?? null
    return m.email ? userAvatar[m.email.toLowerCase()] ?? null : null
  }
  const pending = (b.docs as Booking[]).map((x) => {
    const svc = typeof x.service === 'object' ? (x.service as Service) : null
    const st = typeof x.staff === 'object' ? (x.staff as StaffMember) : null
    const price = x.price_snapshot ?? svc?.price ?? null
    const img = avatarOf(st)
    return {
      id: String(x.id), name: x.customer_name || 'Vendég', when: `${dayLabel(String(x.date).slice(0, 10))} · ${x.start_time}–${x.end_time}`, createdAt: x.createdAt,
      service: svc?.name ?? 'Szolgáltatás', detail: [svc?.duration_minutes ? `${svc.duration_minutes} perc` : null, st?.name].filter(Boolean).join(' · '),
      price: price ? ft(Number(price)) : '—', staffName: st?.name, img,
      rows: ([['Telefon', x.customer_phone], ['Forrás', SRC[x.source ?? ''] ?? x.source], ['Megjegyzés', x.notes]] as [string, string | null | undefined][]).filter((y): y is [string, string] => !!y[1]),
    }
  })

  // fizetésre vár: helyszíni fizetés bekapcsolva, megerősített, véget ért, nincs fizetéssel lezárva (az elmúlt 7 nap)
  let paymentDue: { count: number; oldest?: { name: string; when: string } } = { count: 0 }
  const salon = (await payload.findByID({ collection: 'salons', id: active.id, depth: 0, overrideAccess: true }).catch(() => null)) as Salon | null
  if (salon?.onsite_payment?.enabled) {
    const from = ymdLocal(new Date(Date.now() - 7 * 86_400_000))
    const q = await payload.find({ collection: 'bookings', where: { and: [{ salon: { equals: active.id } }, { status: { equals: 'confirmed' } }, { paid_at: { exists: false } }, { date: { greater_than_equal: from } }, { date: { less_than_equal: `${today}T23:59:59` } }] }, sort: 'date', limit: 200, depth: 0, overrideAccess: true })
    const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes()
    const due = (q.docs as Booking[]).filter((x) => { const d = String(x.date).slice(0, 10); return d < today || (d === today && nowMin >= hhmmToMinutes(x.end_time)) })
    paymentDue = { count: due.length, ...(due[0] ? { oldest: { name: due[0].customer_name || 'Vendég', when: `${String(due[0].date).slice(0, 10) === today ? 'ma' : dayLabel(String(due[0].date).slice(0, 10))} ${due[0].end_time} óta` } } : {}) }
  }

  // pendingTotal: az összes várakozó (ugyanaz a szabály, mint az Áttekintés „Jóváhagyásra vár” listájáé) — a sáv ezt írja ki
  return NextResponse.json({ pending, pendingTotal: b.totalDocs, paymentDue, prefs, kind: 'salon' })
}
