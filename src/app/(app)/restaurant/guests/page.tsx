import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { GuestsView, type MetricVM } from '@/components/dashboard/guests-view'
import { aggregateGuests, withManualGuests, bucketByCountry, type GuestSource } from '@/lib/guests'
import { buildGuestVMs, buildArrivals, returningPct, tierSegments, originSplit, reviewRowValue } from '@/lib/guestsView'
import { getGuestReviewMap } from '@/lib/reviews'
import type { Reservation, Customer } from '@/payload/payload-types'

const DAYS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

export default async function RestaurantGuestsPage() {
  const { restaurant, capabilities } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['guests.view', 'guests.manage'], '/restaurant')
  const payload = await getPayloadClient()

  const res = await payload.find({
    collection: 'reservations',
    where: { restaurant: { equals: restaurant.id } },
    sort: '-date',
    depth: 0,
    limit: 2000,
    overrideAccess: true,
  })

  const docs = res.docs as Reservation[]

  // Asztal-nevek (id → név) a „mely asztaloknál ült" sorhoz.
  const tablesRes = await payload.find({
    collection: 'tables',
    where: { restaurant: { equals: restaurant.id } },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })
  const tableName = new Map<number, string>()
  for (const t of tablesRes.docs as Array<{ id: number; name?: string | null }>) {
    if (t.name) tableName.set(t.id, t.name)
  }
  const tablesOf = (raw: Reservation['tables']): string[] =>
    (Array.isArray(raw) ? raw : [])
      .map((t) => (typeof t === 'object' && t ? (t as { name?: string | null }).name ?? null : tableName.get(Number(t)) ?? null))
      .filter((v): v is string => !!v)

  // Forrás + eredeti időpont/pax/jegyzet/alkalom/asztalok megőrzése a részletekhez.
  type Src = GuestSource & {
    time?: string
    occasion?: string | null
    occasionIcon?: string | null
    note?: string | null
    internal?: string | null
    tables?: string[]
    customAnswers?: Record<string, { question: string; answer: string }> | null
  }
  const sources: Src[] = docs.map((r) => ({
    name: r.customer_name,
    email: r.customer_email,
    phone: r.customer_phone,
    date: r.date,
    pax: r.pax,
    country: r.country,
    city: r.customer_city,
    status: r.status,
    time: r.start_time,
    occasion: r.occasion ?? null,
    occasionIcon: r.occasion_icon ?? null,
    note: r.notes,
    internal: r.internal_notes,
    tables: tablesOf(r.tables),
    customAnswers: r.custom_answers ?? null,
  }))

  const latestNote = (own: GuestSource[], pick: (s: Src) => string | null | undefined): string | null => {
    const hit = [...own]
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .map((s) => pick(s as Src)?.trim())
      .find((v) => v)
    return hit || null
  }

  // Customers-rekordok (tiltás + kézi felülírás) az étteremhez.
  const custRes = await payload.find({
    collection: 'customers',
    where: { restaurant: { equals: restaurant.id } },
    depth: 0,
    limit: 2000,
    overrideAccess: true,
  })
  // A rekord MINDEN azonosítója (match_index: régi+új e-mail/telefon) → átlinkeléshez.
  const custByKey = new Map<string, Customer>()
  for (const c of custRes.docs as Customer[]) {
    for (const k of (c.match_index ?? '').split('\n')) if (k) custByKey.set(k, c)
    if (c.customer_email) custByKey.set(c.customer_email.trim().toLowerCase(), c)
    if (c.customer_phone) custByKey.set(c.customer_phone.trim(), c)
  }
  const custFor = (g: { email?: string | null; phone?: string | null }): Customer | null =>
    (g.email && custByKey.get(g.email.toLowerCase())) || (g.phone && custByKey.get(g.phone.trim())) || null

  // Kézi felülírások SOURCE-szinten → az ország (telefonból) ÉS minden nézet (térkép,
  // érkezések, zászló) frissül. Telefon-felülírásnál a régi országot töröljük, hogy az új
  // szám előhívója döntsön.
  for (const s of sources) {
    const c = custFor(s)
    if (!c) continue
    if (c.customer_name) s.name = c.customer_name
    if (c.customer_email) s.email = c.customer_email
    if (c.customer_phone) {
      s.phone = c.customer_phone
      s.country = null
    }
  }

  const reviewMap = await getGuestReviewMap('restaurant', restaurant.id)

  const guests = withManualGuests(aggregateGuests(sources), custRes.docs as Customer[])
  const buckets = bucketByCountry(sources)
  const total = guests.length
  const retPct = returningPct(guests)
  const returningNum = guests.filter((g) => g.tier >= 2).length
  const newNum = total - returningNum

  const favDay = (own: GuestSource[]): string => {
    const counts = new Map<number, number>()
    for (const s of own) {
      if (!s.date) continue
      const d = new Date(s.date).getDay()
      counts.set(d, (counts.get(d) ?? 0) + 1)
    }
    let best = -1
    let bestN = 0
    for (const [d, n] of counts) if (n > bestN) ((bestN = n), (best = d))
    return best >= 0 ? DAYS[best] : '—'
  }

  // Egyedi kérdések TÖRTÉNETE a vendég profilján — kérdés-SZÖVEGENKÉNT (nem id-nkánt, mert a
  // sablon időközben módosulhat/törölhető) a legutóbbi (legfrissebb dátumú) nem-üres választ
  // tartjuk meg. NEM külön tárolt mezőből jön, hanem a foglalás-történetből levezetve.
  // A kérdés BELSŐ AZONOSÍTÓJA (a `custom_answers` objektum kulcsa) alapján csoportosítunk, NEM
  // a kérdés akkori szövege szerint — így ha a tulaj utólag átfogalmazza a kérdést, a régi és
  // új válasz EGY sorban marad (a legfrissebb foglalás szövegével címkézve), nem szakad ketté.
  const latestCustomAnswers = (own: GuestSource[]): { label: string; value: string }[] => {
    const byQuestionId = new Map<string, { label: string; value: string }>()
    for (const s of [...own].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
      const answers = (s as Src).customAnswers
      if (!answers) continue
      for (const [qid, qa] of Object.entries(answers)) byQuestionId.set(qid, { label: qa.question, value: qa.answer })
    }
    return Array.from(byQuestionId.values())
  }

  const guestVMs = buildGuestVMs(guests, sources, {
    labelFor: (s) => `${s.pax ?? 0} fő foglalás`,
    amountFor: () => null,
    favFor: (_g, own) => favDay(own),
    rowsFor: (g, { past, upcoming }) => {
      const upPax = upcoming.reduce((a, s) => a + (s.pax ?? 0), 0)
      const allOwn = [...past, ...upcoming]
      const tables = Array.from(new Set(allOwn.flatMap((s) => (s as Src).tables ?? [])))
      const note = latestNote(allOwn, (s) => s.note)
      const review = reviewMap.get(g.key)
      // Ha a vendég egy guest-szintű élettartam-összesítőt adó exportból jött, a Customer-
      // rekordon tárolt import-összesítő élvez elsőbbséget a foglalás-történetből számolt
      // értékkel szemben (lásd a szalon-oldali guests/page.tsx azonos logikáját).
      const cust = custFor(g)
      const cancelCount = cust?.cancellation_count ?? allOwn.filter((s) => s.status === 'cancelled').length
      const noShowCount = cust?.no_show_count ?? allOwn.filter((s) => s.status === 'no_show').length
      const visitCount = cust?.visit_count ?? past.length
      return [
        { label: 'Látogatás', value: String(visitCount) },
        { label: 'Közelgő foglalás', value: upcoming.length > 0 ? `${upcoming.length} · ${upPax} fő` : '—' },
        { label: 'Asztalok', value: tables.length > 0 ? tables.join(', ') : '—' },
        { label: 'Kedvenc nap', value: favDay(allOwn) },
        ...(cancelCount > 0 ? [{ label: 'Lemondások száma', value: String(cancelCount) }] : []),
        ...(noShowCount > 0 ? [{ label: 'Nem jött el', value: String(noShowCount) }] : []),
        ...(cust?.last_cancellation_reason ? [{ label: 'Utolsó lemondás oka', value: cust.last_cancellation_reason }] : []),
        ...(review ? [{ label: 'Értékelés', value: reviewRowValue(review.average, review.count) }] : []),
        ...(note ? [{ label: 'Megjegyzés', value: note }] : []),
        ...(review?.latestComment ? [{ label: 'Vendég értékelése', value: review.latestComment }] : []),
        ...latestCustomAnswers([...past, ...upcoming]),
      ]
    },
    birthdayDateFor: (own) => {
      const bd = [...own]
        .filter((s) => (s as Src).occasion && s.date)
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]
      return bd?.date ?? null
    },
    noteFor: (own) => ({ guest: latestNote(own, (s) => s.note), internal: latestNote(own, (s) => s.internal) }),
    historyDetailFor: (s) => {
      const src = s as Src
      const rows: Array<{ label: string; value: string }> = []
      if (src.time) rows.push({ label: 'Időpont', value: src.time.slice(0, 5) })
      rows.push({ label: 'Létszám', value: `${src.pax ?? 0} fő` })
      if (src.tables && src.tables.length > 0) rows.push({ label: 'Asztal', value: src.tables.join(', ') })
      if (src.occasion) rows.push({ label: 'Alkalom', value: src.occasion })
      return { rows, note: src.note?.trim() || null }
    },
    blockedFor: (g) => !!custFor(g)?.blocked,
    blockReasonFor: (g) => custFor(g)?.block_reason ?? null,
  })

  // Érkezések: a MAI nap valós foglalásai idő szerint (a lista az időben következő 5-öt hozza).
  const arrivals = buildArrivals(guests, sources, {
    timeFor: (s) => (s as { time?: string }).time ?? null,
  })

  const { domestic, foreign } = originSplit(buckets)
  const metrics: MetricVM[] = [
    { icon: 'users', value: total, label: 'Összes vendég' },
    { icon: 'home', value: domestic, label: 'Belföldi', suffix: '%' },
    { icon: 'globe', value: foreign, label: 'Külföldi', suffix: '%' },
  ]

  const mapEmpty = (
    <div className="flex h-full items-center justify-center bg-[#EDEDE9] p-6 text-center text-sm text-ink-soft">
      Helyadat hamarosan — a foglaláskor kért országgal töltődik fel.
    </div>
  )

  return (
    <GuestsView
      pills={tierSegments(guests)}
      metrics={metrics}
      guests={guestVMs}
      arrivals={arrivals}
      arrivalsDateLabel="Ma"
      returningPct={retPct}
      returningNum={returningNum}
      newNum={newNum}
      buckets={buckets}
      mapLabel="Honnan érkeznek"
      mapEmpty={mapEmpty}
      canManage={can(capabilities, 'guests.manage')}
    />
  )
}
