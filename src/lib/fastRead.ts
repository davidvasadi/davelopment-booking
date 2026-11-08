// Gyors olvasás — KÖZVETLEN SQL a sok soros listákhoz (sebesség, docs/sebesseg/README.md, skill: fast-reads).
//
// A Payload `find` soronként ~2 ms-ot tölt az olvasási feldolgozással (752 foglalás: 1,4 mp, SQL-lel 4 ms), és amíg fut,
// az oldal többi lekérdezése is rá vár. Ezért a NEHÉZ OLVASÁSOK itt, közvetlenül az adatbázisból mennek, a Payload-
// dokumentumokkal AZONOS alakban (a hívó kód változatlan maradhat).
//
// SZABÁLYOK: csak olvasás (írás mindig Payloadon — ott futnak a hookok); minden lekérdezés üzletre szűr; csak
// paraméterezett `sql` template. Migrációnál (oszlop-átnevezés / törlés) ezt a fájlt is igazítani kell.
import { authQuery as rawQuery, sql } from '@/lib/authDb'
import type { Customer } from '@/payload/payload-types'

export { rawQuery, sql }

/** Postgres numeric → szám (a driver szövegként adja). */
export const num = (v: unknown): number | null => (v == null ? null : Number(v))
/** Postgres timestamptz → ISO szöveg (ahogy a Payload adja). */
export const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string | Date).toISOString())

export type BizRef = { salon: number | string } | { restaurant: number | string }
const bizWhere = (b: BizRef) => ('salon' in b ? sql`salon_id = ${Number(b.salon)}` : sql`restaurant_id = ${Number(b.restaurant)}`)

/** Egy üzlet összes vendég-rekordja (Customers), a Payload `find({ depth: 0 })` alakjában. A táblának nincs al-táblája. */
export async function customersOf(b: BizRef): Promise<Customer[]> {
  const rows = await rawQuery<Record<string, unknown>>(sql`SELECT * FROM customers WHERE ${bizWhere(b)} ORDER BY created_at DESC`)
  return rows.map((r) => ({
    id: r.id,
    restaurant: r.restaurant_id ?? null,
    salon: r.salon_id ?? null,
    customer_name: r.customer_name ?? null,
    customer_email: r.customer_email ?? null,
    customer_phone: r.customer_phone ?? null,
    customer_city: r.customer_city ?? null,
    customer_country: r.customer_country ?? null,
    birthday: iso(r.birthday),
    gender: r.gender ?? null,
    group_tag: r.group_tag ?? null,
    notes: r.notes ?? null,
    blocked: r.blocked ?? null,
    block_reason: r.block_reason ?? null,
    blocked_at: iso(r.blocked_at),
    match_index: r.match_index ?? null,
    marketing_consent: r.marketing_consent ?? null,
    marketing_consent_at: iso(r.marketing_consent_at),
    marketing_unsubscribed_at: iso(r.marketing_unsubscribed_at),
    billing_name: r.billing_name ?? null,
    billing_tax_number: r.billing_tax_number ?? null,
    billing_email: r.billing_email ?? null,
    billing_postal_code: r.billing_postal_code ?? null,
    billing_city: r.billing_city ?? null,
    billing_street: r.billing_street ?? null,
    visit_count: num(r.visit_count),
    cancellation_count: num(r.cancellation_count),
    no_show_count: num(r.no_show_count),
    last_cancellation_reason: r.last_cancellation_reason ?? null,
    total_revenue_huf: num(r.total_revenue_huf),
    external_id: r.external_id ?? null,
    updatedAt: iso(r.updated_at),
    createdAt: iso(r.created_at),
  }) as unknown as Customer)
}

/** Egy üzlet beosztásai (Shifts) egy naptól, a Payload `find({ depth: 0 })` alakjában (a dátum ISO szöveg, ahogy a Payload
 *  adja). A táblának nincs al-táblája; a sorrend a Payload alapértelmezése (-createdAt). */
export async function shiftsSince(b: BizRef, from: string, opts: { to?: string; type?: string } = {}) {
  const rows = await rawQuery<Record<string, unknown>>(sql`SELECT * FROM shifts WHERE ${bizWhere(b)} AND date >= ${from}${opts.to ? sql` AND date <= ${opts.to}` : sql``}${opts.type ? sql` AND type = ${opts.type}` : sql``} ORDER BY created_at DESC`)
  return rows.map((r) => ({
    id: r.id, staff: r.staff_id ?? null, member: r.member_id ?? null, salon: r.salon_id ?? null, restaurant: r.restaurant_id ?? null,
    owner_shift: r.owner_shift ?? null, date: iso(r.date), type: r.type, start_time: r.start_time ?? null, end_time: r.end_time ?? null,
    hours: num(r.hours), breaks: r.breaks ?? null, paid: r.paid ?? null, note: r.note ?? null,
    left_early_at: r.left_early_at ?? null, left_early_reason: r.left_early_reason ?? null, sick_note: r.sick_note_id ?? null,
    updatedAt: iso(r.updated_at), createdAt: iso(r.created_at),
  }))
}

/** Szűrő a foglalás-listákhoz. `from` / `to`: dátum-tartomány (zárt), `before`: e nap ELŐTT; a sorrend a Payload
 *  alapértelmezése (-createdAt), hogy az „első előfordulás” jellegű számítások ugyanazt adják. */
export type RowFilter = { from?: string; to?: string; before?: string; statusIn?: string[]; statusNotIn?: string[]; staffId?: string | number | null }
const list = (arr: string[]) => sql.join(arr.map((v) => sql`${v}`), sql`, `)
const filterSql = (f: RowFilter) => sql.join([
  f.from ? sql` AND date >= ${f.from}` : sql``,
  f.to ? sql` AND date <= ${f.to}` : sql``,
  f.before ? sql` AND date < ${f.before}` : sql``,
  f.statusIn?.length ? sql` AND status IN (${list(f.statusIn)})` : sql``,
  f.statusNotIn?.length ? sql` AND status NOT IN (${list(f.statusNotIn)})` : sql``,
  f.staffId != null ? sql` AND staff_id = ${Number(f.staffId)}` : sql``,
], sql``)

/** Szalon-foglalások (Bookings) a statisztikához / listákhoz, a Payload `find({ depth: 0 })` alakjában (a kapcsolatok
 *  azonosítóként). Csak a gyakran kellő mezők. */
export async function bookingsFor(salonId: number | string, f: RowFilter = {}) {
  const rows = await rawQuery<Record<string, unknown>>(sql`
    SELECT id, date, start_time, end_time, status, source, created_at, customer_name, customer_email, customer_phone, customer_city, service_id, staff_id, price_snapshot
    FROM bookings WHERE salon_id = ${Number(salonId)}${filterSql(f)} ORDER BY created_at DESC`)
  return rows.map((r) => ({
    id: r.id, date: r.date, start_time: r.start_time ?? null, end_time: r.end_time ?? null, status: r.status, source: r.source ?? null,
    createdAt: iso(r.created_at), customer_name: r.customer_name, customer_email: r.customer_email ?? null, customer_phone: r.customer_phone ?? null,
    customer_city: r.customer_city ?? null, service: r.service_id ?? null, staff: r.staff_id ?? null, price_snapshot: num(r.price_snapshot),
  }))
}

/** Éttermi foglalások (Reservations) ugyanígy, az asztalokkal (`tables`: azonosítók, a Payload sorrendjében). */
export async function reservationsFor(restaurantId: number | string, f: RowFilter = {}) {
  const rid = Number(restaurantId)
  const rows = await rawQuery<Record<string, unknown>>(sql`
    SELECT id, date, start_time, end_time, status, source, created_at, customer_name, customer_email, customer_phone, customer_city, country, pax, payment_status, deposit_amount_huf
    FROM reservations WHERE restaurant_id = ${rid}${filterSql({ ...f, staffId: null })} ORDER BY created_at DESC`)
  const ids = rows.map((r) => Number(r.id))
  const rels = ids.length ? await rawQuery<{ parent_id: number; tables_id: number }>(sql`
    SELECT parent_id, tables_id FROM reservations_rels WHERE path = 'tables' AND tables_id IS NOT NULL AND parent_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) ORDER BY parent_id, "order"`) : []
  const byRes = new Map<number, number[]>()
  for (const x of rels) byRes.set(x.parent_id, [...(byRes.get(x.parent_id) ?? []), x.tables_id])
  return rows.map((r) => ({
    id: r.id, date: r.date, start_time: r.start_time ?? null, end_time: r.end_time ?? null, status: r.status, source: r.source ?? null,
    createdAt: iso(r.created_at), customer_name: r.customer_name, customer_email: r.customer_email ?? null, customer_phone: r.customer_phone ?? null,
    customer_city: r.customer_city ?? null, country: r.country ?? null, pax: num(r.pax), tables: byRes.get(Number(r.id)) ?? [],
    payment_status: r.payment_status ?? null, deposit_amount_huf: num(r.deposit_amount_huf),
  }))
}

/**
 * Kiküldött hírlevél-e-mailek havonta (az utolsó `months` hónap, a mostanival együtt) — az Előfizetés › Felhasználás
 * grafikonjához. Közvetlen SQL — sebesség, docs/sebesseg (egy csoportosított számolás, üzletre szűrve). A hiányzó hónap 0.
 */
export async function marketingEmailsByMonth(b: BizRef, months = 6): Promise<{ ym: string; n: number }[]> {
  const rows = await rawQuery<{ ym: string; n: unknown }>(sql`
    SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'Europe/Budapest'), 'YYYY-MM') AS ym, count(*) AS n
    FROM email_log
    WHERE ${bizWhere(b)} AND type = 'marketing_broadcast'
      AND created_at >= (date_trunc('month', now() AT TIME ZONE 'Europe/Budapest') - make_interval(months => ${months - 1})) AT TIME ZONE 'Europe/Budapest'
    GROUP BY 1`)
  const got = new Map(rows.map((r) => [r.ym, Number(r.n)]))
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { ym, n: got.get(ym) ?? 0 }
  })
}
