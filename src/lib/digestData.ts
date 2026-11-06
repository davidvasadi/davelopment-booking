import type { Payload } from 'payload'
import type { Booking, Reservation, Salon, Restaurant, Service, StaffMember, Shift } from '@/payload/payload-types'
import type { DigestData, DigestPerson, DigestTodo } from '@/components/blocks/digest'
import { getOverviewInbox } from './overviewInbox'
import { fixMediaUrl } from './utils'

/**
 * A napi összefoglaló adatai (design 22.x) — EGY helyen összerakva: a cron ezt teszi az értesítésbe (metadata.digest), az
 * Áttekintés kártyája ugyanezt kéri le. Reggel: mi vár ma; este: hogy ment a nap, mi maradt, mi jön holnap.
 * Szalon (bookings / staff) és étterem (reservations / pax) ugyanabba az alakba.
 */
const DOW = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
const MON = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
export const digestDayLabel = (ymd: string) => { const d = new Date(`${ymd}T12:00:00`); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}.` }
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const ft = (n: number) => `${Math.round(n).toLocaleString('hu-HU')} Ft`
const kft = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000).toLocaleString('hu-HU')} e Ft` : ft(n))
const idOf = (v: unknown) => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v == null ? '' : String(v))
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null)

async function staffAvatars(payload: Payload, staff: StaffMember[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  const emails = staff.filter((s) => !(s.avatar && typeof s.avatar === 'object') && s.email).map((s) => s.email!.toLowerCase())
  const byEmail: Record<string, string> = {}
  if (emails.length) {
    const us = await payload.find({ collection: 'users', where: { email: { in: emails } }, limit: 200, depth: 0, overrideAccess: true })
    for (const u of us.docs as { email?: string | null; avatar_url?: string | null }[]) { const url = fixMediaUrl(u.avatar_url); if (u.email && url) byEmail[u.email.toLowerCase()] = url }
  }
  for (const s of staff) out.set(String(s.id), s.avatar && typeof s.avatar === 'object' ? fixMediaUrl((s.avatar as { url?: string | null }).url) ?? null : s.email ? byEmail[s.email.toLowerCase()] ?? null : null)
  return out
}

/** Új / visszatérő vendég: a nap vendégei közül kinek volt korábban (nem lemondott) foglalása itt (telefon / e-mail). */
async function guestSplit(payload: Payload, collection: 'bookings' | 'reservations', scope: Record<string, unknown>, day: string, docs: { customer_phone?: string | null; customer_email?: string | null; customer_name?: string | null }[]) {
  const keys = new Map<string, { phone?: string | null; email?: string | null }>()
  for (const b of docs) keys.set(b.customer_phone ? `p:${b.customer_phone}` : b.customer_email ? `e:${b.customer_email}` : `n:${b.customer_name}`, { phone: b.customer_phone, email: b.customer_email })
  const phones = [...new Set([...keys.values()].map((c) => c.phone).filter(Boolean))] as string[]
  const emails = [...new Set([...keys.values()].map((c) => c.email).filter(Boolean))] as string[]
  const seen = new Set<string>()
  if (phones.length || emails.length) {
    const prior = await payload.find({ collection, where: { and: [scope, { date: { less_than: day } }, { status: { not_equals: 'cancelled' } }, { or: [...(phones.length ? [{ customer_phone: { in: phones } }] : []), ...(emails.length ? [{ customer_email: { in: emails } }] : [])] }] } as never, depth: 0, limit: 1000, overrideAccess: true })
    for (const b of prior.docs as { customer_phone?: string | null; customer_email?: string | null }[]) { if (b.customer_phone) seen.add(`p:${b.customer_phone}`); if (b.customer_email) seen.add(`e:${b.customer_email}`) }
  }
  let fresh = 0, returning = 0
  for (const c of keys.values()) ((c.phone && seen.has(`p:${c.phone}`)) || (c.email && seen.has(`e:${c.email}`)) ? returning++ : fresh++)
  return { fresh, returning }
}

/** A legutóbbi (7 napon belüli) heti tipp — a reggeli összefoglaló „A nap tippje”. */
async function latestTip(payload: Payload, kind: 'salon' | 'restaurant', id: string | number) {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const r = await payload.find({ collection: 'notifications', where: { and: [{ [kind]: { equals: id } }, { type: { equals: 'weekly_tip' } }, { createdAt: { greater_than_equal: since } }] } as never, sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true }).catch(() => null)
  const n = r?.docs[0] as { title?: string; body?: string | null } | undefined
  return n?.title ? { title: n.title, body: n.body ?? '' } : null
}

export async function buildSalonDigest(payload: Payload, salon: Salon, day: string, kind: 'morning' | 'evening'): Promise<DigestData> {
  const scope = { salon: { equals: salon.id } }
  const evening = kind === 'evening'
  const [dayRes, inbox, tomorrowRes, lastWeekRes] = await Promise.all([
    payload.find({ collection: 'bookings', where: { and: [scope, { date: { equals: day } }] }, sort: 'start_time', depth: 1, limit: 500, overrideAccess: true }),
    getOverviewInbox(payload, 'salon', salon.id, day, addDays(day, -1)),
    evening ? payload.find({ collection: 'bookings', where: { and: [scope, { date: { equals: addDays(day, 1) } }, { status: { in: ['pending', 'confirmed'] } }] }, sort: 'start_time', depth: 0, limit: 500, overrideAccess: true }) : Promise.resolve(null),
    evening ? payload.find({ collection: 'bookings', where: { and: [scope, { date: { equals: addDays(day, -7) } }, { status: { equals: 'completed' } }] }, depth: 0, limit: 500, overrideAccess: true }) : Promise.resolve(null),
  ])
  const all = dayRes.docs as Booking[]
  const live = all.filter((b) => b.status !== 'cancelled')
  const priceOf = (b: Booking) => Number(b.paid_at ? (b.paid_amount_huf ?? 0) + (b.payment_status === 'paid' ? b.deposit_amount_huf ?? 0 : 0) : b.price_snapshot ?? (typeof b.service === 'object' ? (b.service as Service).price ?? 0 : 0))
  const staffList = [...new Map(live.filter((b) => typeof b.staff === 'object' && b.staff).map((b) => [idOf(b.staff), b.staff as StaffMember])).values()]
  const avatars = await staffAvatars(payload, staffList)

  const done = all.filter((b) => b.status === 'completed')
  const revenue = done.reduce((n, b) => n + priceOf(b), 0)
  const expected = live.reduce((n, b) => n + priceOf(b), 0)

  const people: DigestPerson[] = staffList.map((s) => {
    const mine = (evening ? done : live).filter((b) => idOf(b.staff) === String(s.id))
    return evening
      ? { name: s.name, img: avatars.get(String(s.id)) ?? null, meta: `${mine.length} vendég`, value: ft(mine.reduce((n, b) => n + priceOf(b), 0)) }
      : { name: s.name, img: avatars.get(String(s.id)) ?? null, meta: `első: ${mine[0]?.start_time ?? '—'}`, value: `${mine.length} foglalás` }
  }).filter((p) => p.value !== '0 Ft').sort((a, b) => parseInt(b.value.replace(/\D/g, '')) - parseInt(a.value.replace(/\D/g, '')))

  const svc = new Map<string, number>()
  for (const b of evening ? done : live) { const n = typeof b.service === 'object' && b.service ? (b.service as Service).name : null; if (n) svc.set(n, (svc.get(n) ?? 0) + 1) }
  const topArr = [...svc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const top = topArr.map(([name, n]) => ({ name, value: String(n), pct: Math.round((n / (topArr[0]?.[1] || 1)) * 100) }))

  const payDue = evening && salon.onsite_payment?.enabled ? all.filter((b) => b.status === 'confirmed' && !b.paid_at).length : 0
  const todos: DigestTodo[] = [
    ...(inbox.pending.length ? [{ key: 'pending', label: 'Jóváhagyásra vár', count: inbox.pending.length, tone: 'pending' as const }] : []),
    ...(payDue ? [{ key: 'pay', label: 'Fizetésre vár (nincs lezárva)', count: payDue, tone: 'pending' as const }] : []),
    ...(!evening && inbox.unclosed.length ? [{ key: 'unclosed', label: 'Tegnapról lezáratlan', count: inbox.unclosed.length, tone: 'bad' as const }] : []),
    ...(!evening && inbox.birthdays.length ? [{ key: 'bday', label: 'Születésnapos vendég ma', count: inbox.birthdays.length, tone: 'neutral' as const }] : []),
  ]

  const lastWeek = lastWeekRes ? (lastWeekRes.docs as Booking[]).reduce((n, b) => n + priceOf(b), 0) : 0
  const diff = pct(revenue, lastWeek)
  const tomorrow = tomorrowRes ? (tomorrowRes.docs as Booking[]) : []
  const guests = live.length ? await guestSplit(payload, 'bookings', scope, day, live) : null

  return {
    kind, day: digestDayLabel(day),
    stats: evening
      ? [{ icon: 'calendar', label: `${live.length} foglalás` }, { icon: 'users', label: `${done.length} vendég` }, { icon: 'wallet', label: ft(revenue) }]
      : [{ icon: 'calendar', label: `${live.length} foglalás` }, { icon: 'users', label: `${staffList.length} munkatárs` }, { icon: 'wallet', label: `~ ${kft(expected)} várható` }],
    firstLast: !evening && live.length ? { first: `${live[0].start_time} · ${live[0].customer_name}`, last: `${live[live.length - 1].start_time} · ${live[live.length - 1].customer_name}` } : null,
    people, todos,
    outcome: evening ? { done: done.length, cancelled: all.filter((b) => b.status === 'cancelled').length, noShow: all.filter((b) => b.status === 'no_show').length } : null,
    revenue: evening ? { value: ft(revenue), vsLastWeek: diff != null ? `${diff >= 0 ? '+' : ''}${diff}% a múlt heti ugyanehhez a naphoz` : null } : null,
    top, guests,
    tomorrow: evening && tomorrow.length ? { count: `${tomorrow.length} foglalás`, first: `${tomorrow[0].start_time} · ${tomorrow[0].customer_name}` } : null,
    tip: !evening ? await latestTip(payload, 'salon', salon.id) : null,
  }
}

export async function buildRestaurantDigest(payload: Payload, restaurant: Restaurant, day: string, kind: 'morning' | 'evening'): Promise<DigestData> {
  const scope = { restaurant: { equals: restaurant.id } }
  const evening = kind === 'evening'
  const [dayRes, inbox, shiftsRes, tomorrowRes] = await Promise.all([
    payload.find({ collection: 'reservations', where: { and: [scope, { date: { equals: day } }] }, sort: 'start_time', depth: 0, limit: 1000, overrideAccess: true }),
    getOverviewInbox(payload, 'restaurant', restaurant.id, day, addDays(day, -1)),
    payload.find({ collection: 'shifts', where: { and: [scope, { date: { equals: day } }] }, sort: 'start_time', depth: 1, limit: 50, overrideAccess: true }).catch(() => ({ docs: [] as unknown[] })),
    evening ? payload.find({ collection: 'reservations', where: { and: [scope, { date: { equals: addDays(day, 1) } }, { status: { in: ['pending', 'confirmed'] } }] }, sort: 'start_time', depth: 0, limit: 1000, overrideAccess: true }) : Promise.resolve(null),
  ])
  const all = dayRes.docs as Reservation[]
  const live = all.filter((r) => r.status !== 'cancelled')
  const pax = live.reduce((n, r) => n + (r.pax ?? 0), 0)
  const done = all.filter((r) => r.status === 'completed' || r.status === 'seated')
  const deposits = all.filter((r) => r.payment_status === 'paid').reduce((n, r) => n + Number(r.deposit_amount_huf ?? 0), 0)
  const occ = new Map<string, number>()
  for (const r of live) if (r.occasion) occ.set(r.occasion, (occ.get(r.occasion) ?? 0) + 1)
  const occArr = [...occ.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const OCC: Record<string, string> = { birthday: 'Születésnap', anniversary: 'Évforduló', business: 'Céges', date: 'Randi' }
  const first = (shiftsRes.docs as Shift[])[0] as (Shift & { staff?: unknown; member?: unknown; start_time?: string | null; end_time?: string | null }) | undefined
  const manager = first && typeof first.staff === 'object' && first.staff ? (first.staff as StaffMember) : null
  const tomorrow = tomorrowRes ? (tomorrowRes.docs as Reservation[]) : []
  const todos: DigestTodo[] = [
    ...(inbox.pending.length ? [{ key: 'pending', label: 'Jóváhagyásra vár', count: inbox.pending.length, tone: 'pending' as const }] : []),
    ...(!evening && inbox.unclosed.length ? [{ key: 'unclosed', label: 'Tegnapról lezáratlan', count: inbox.unclosed.length, tone: 'bad' as const }] : []),
    ...(!evening && inbox.birthdays.length ? [{ key: 'bday', label: 'Születésnapos vendég ma', count: inbox.birthdays.length, tone: 'neutral' as const }] : []),
  ]
  const guests = live.length ? await guestSplit(payload, 'reservations', scope, day, live) : null
  return {
    kind, restaurant: true, day: digestDayLabel(day),
    stats: [{ icon: 'calendar', label: `${live.length} foglalás` }, { icon: 'users', label: `${pax} fő` }, ...(deposits ? [{ icon: 'wallet' as const, label: `${ft(deposits)} előleg` }] : [])],
    firstLast: !evening && live.length ? { first: `${live[0].start_time} · ${live[0].customer_name} (${live[0].pax} fő)`, last: `${live[live.length - 1].start_time} · ${live[live.length - 1].customer_name}` } : null,
    people: manager ? [{ name: manager.name, img: null, meta: 'műszakvezető', value: first?.start_time && first?.end_time ? `${first.start_time}–${first.end_time}` : '' }] : [],
    todos,
    outcome: evening ? { done: done.length, cancelled: all.filter((r) => r.status === 'cancelled').length, noShow: all.filter((r) => r.status === 'no_show').length } : null,
    revenue: evening && deposits ? { value: `${ft(deposits)} előleg`, vsLastWeek: null } : null,
    top: occArr.map(([k, n]) => ({ name: OCC[k] ?? k, value: String(n), pct: Math.round((n / (occArr[0]?.[1] || 1)) * 100) })),
    guests,
    tomorrow: evening && tomorrow.length ? { count: `${tomorrow.length} foglalás · ${tomorrow.reduce((n, r) => n + (r.pax ?? 0), 0)} fő`, first: `${tomorrow[0].start_time} · ${tomorrow[0].customer_name} (${tomorrow[0].pax} fő)` } : null,
    tip: !evening ? await latestTip(payload, 'restaurant', restaurant.id) : null,
  }
}
