import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { GuestsView, type MetricVM } from '@/components/dashboard/guests-view'
import { aggregateGuests, withManualGuests, bucketByCountry, type GuestSource } from '@/lib/guests'
import { buildGuestVMs, buildArrivals, returningPct, tierSegments, originSplit, reviewRowValue } from '@/lib/guestsView'
import { getGuestReviewMap } from '@/lib/reviews'
import type { Booking, Service, Customer } from '@/payload/payload-types'

export default async function SalonGuestsPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['guests.view', 'guests.manage'], '/dashboard')
  const payload = await getPayloadClient()

  const res = await payload.find({
    collection: 'bookings',
    where: { salon: { equals: salon.id } },
    sort: '-date',
    depth: 1,
    limit: 2000,
    overrideAccess: true,
  })

  const docs = res.docs as Booking[]

  const serviceName = (svc: Booking['service']): string =>
    svc && typeof svc === 'object' ? (svc as Service).name : ''
  // A `price_snapshot`-ot (foglaláskori ár) részesítjük előnyben a szolgáltatás mindenkori
  // aktuális árával szemben — lásd dashboardStats.ts azonos logikáját.
  const servicePrice = (b: Booking): number | null => {
    if (typeof b.price_snapshot === 'number') return b.price_snapshot
    const svc = b.service
    if (svc && typeof svc === 'object') {
      const p = (svc as Service & { price?: number | null }).price
      return typeof p === 'number' ? p : null
    }
    return null
  }

  // A szalon bookings-ban nincs `country` → a térkép a telefon-előhívóból töltődik.
  type Src = GuestSource & {
    time?: string
    svcName?: string
    price?: number | null
    note?: string | null
    customAnswers?: Record<string, { question: string; answer: string }> | null
  }
  const sources: Src[] = docs.map((b) => ({
    name: b.customer_name,
    email: b.customer_email,
    phone: b.customer_phone,
    date: b.date,
    city: b.customer_city,
    status: b.status,
    time: b.start_time,
    svcName: serviceName(b.service),
    price: servicePrice(b),
    note: (b as { notes?: string | null }).notes ?? null,
    customAnswers: b.custom_answers ?? null,
  }))

  const latestNote = (own: GuestSource[]): string | null => {
    const hit = [...own]
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .map((s) => (s as Src).note?.trim())
      .find((v) => v)
    return hit || null
  }

  // Customers-rekordok (tiltás + kézi felülírás) a szalonhoz.
  const custRes = await payload.find({
    collection: 'customers',
    where: { salon: { equals: salon.id } },
    depth: 0,
    limit: 2000,
    overrideAccess: true,
  })
  const custByKey = new Map<string, Customer>()
  for (const c of custRes.docs as Customer[]) {
    for (const k of (c.match_index ?? '').split('\n')) if (k) custByKey.set(k, c)
    if (c.customer_email) custByKey.set(c.customer_email.trim().toLowerCase(), c)
    if (c.customer_phone) custByKey.set(c.customer_phone.trim(), c)
  }
  const custFor = (g: { email?: string | null; phone?: string | null }): Customer | null =>
    (g.email && custByKey.get(g.email.toLowerCase())) || (g.phone && custByKey.get(g.phone.trim())) || null

  // Kézi felülírások SOURCE-szinten → az ország (telefonból) és minden nézet frissül.
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

  const reviewMap = await getGuestReviewMap('salon', salon.id)

  const guests = withManualGuests(aggregateGuests(sources), custRes.docs as Customer[])
  const buckets = bucketByCountry(sources)
  const total = guests.length
  const retPct = returningPct(guests)
  const returningNum = guests.filter((g) => g.tier >= 2).length
  const newNum = total - returningNum

  const fmtHuf = (n: number) => `${n.toLocaleString('hu-HU')} Ft`
  const priceOf = (s: GuestSource) => (s as { price?: number | null }).price ?? 0
  const favService = (own: GuestSource[]): string => {
    const counts = new Map<string, number>()
    for (const s of own) {
      const n = (s as { svcName?: string }).svcName
      if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
    }
    let best = ''
    let bestN = 0
    for (const [n, c] of counts) if (c > bestN) ((bestN = c), (best = n))
    return best || '—'
  }

  // Egyedi kérdések TÖRTÉNETE a vendég profilján — kérdés-SZÖVEGENKÉNT (nem id-nkánt, mert a
  // sablon időközben módosulhat/törölhető) a legutóbbi (legfrissebb dátumú) nem-üres választ
  // tartjuk meg. NEM külön tárolt mezőből jön, hanem a foglalás-történetből levezetve.
  const latestCustomAnswers = (own: GuestSource[]): { label: string; value: string }[] => {
    const byQuestion = new Map<string, string>()
    for (const s of [...own].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
      const answers = (s as Src).customAnswers
      if (!answers) continue
      for (const qa of Object.values(answers)) byQuestion.set(qa.question, qa.answer)
    }
    return Array.from(byQuestion.entries()).map(([label, value]) => ({ label, value }))
  }

  const guestVMs = buildGuestVMs(guests, sources, {
    salon: true,
    labelFor: (s) => (s as { svcName?: string }).svcName || 'Foglalás',
    amountFor: (s) => {
      const p = (s as { price?: number | null }).price
      return typeof p === 'number' ? fmtHuf(p) : null
    },
    favFor: (_g, own) => favService(own),
    rowsFor: (g, { past, upcoming }) => {
      const pastSpend = past.reduce((a, s) => a + priceOf(s), 0)
      const note = latestNote([...past, ...upcoming])
      const review = reviewMap.get(g.key)
      return [
        { label: 'Látogatás', value: String(past.length) },
        { label: 'Összes költés eddig', value: pastSpend > 0 ? fmtHuf(pastSpend) : '—' },
        { label: 'Közelgő foglalás', value: upcoming.length > 0 ? `${upcoming.length} foglalás` : '—' },
        { label: 'Kedvenc', value: favService([...past, ...upcoming]) },
        ...(review ? [{ label: 'Értékelés', value: reviewRowValue(review.average, review.count) }] : []),
        ...(note ? [{ label: 'Megjegyzés', value: note }] : []),
        ...(review?.latestComment ? [{ label: 'Vendég értékelése', value: review.latestComment }] : []),
        ...latestCustomAnswers([...past, ...upcoming]),
      ]
    },
    noteFor: (own) => ({ guest: latestNote(own), internal: null }),
    historyDetailFor: (s) => {
      const src = s as Src
      const rows: Array<{ label: string; value: string }> = []
      if (src.time) rows.push({ label: 'Időpont', value: src.time.slice(0, 5) })
      if (src.svcName) rows.push({ label: 'Szolgáltatás', value: src.svcName })
      if (typeof src.price === 'number') rows.push({ label: 'Ár', value: fmtHuf(src.price) })
      return { rows, note: src.note?.trim() || null }
    },
    blockedFor: (g) => !!custFor(g)?.blocked,
    blockReasonFor: (g) => custFor(g)?.block_reason ?? null,
  })

  // Érkezések: a MAI nap valós foglalásai idő szerint (a lista az időben következő 5-öt hozza).
  const arrivals = buildArrivals(guests, sources, {
    salon: true,
    timeFor: (s) => (s as { time?: string }).time ?? null,
  })

  const { domestic, foreign } = originSplit(buckets)
  const metrics: MetricVM[] = [
    { icon: 'users', value: total, label: 'Összes vendég' },
    { icon: 'home', value: domestic, label: 'Belföldi', suffix: '%' },
    { icon: 'globe', value: foreign, label: 'Külföldi', suffix: '%' },
  ]

  const mapEmpty = (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#f2eee2] to-[#e7e2d4] p-6 text-center">
      <p className="text-base font-medium text-ink">Helyadat hamarosan</p>
      <p className="mt-1 max-w-xs text-sm text-ink-soft">
        A foglaláskor megadott telefonszám országából töltődik fel a vendégtérkép.
      </p>
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
