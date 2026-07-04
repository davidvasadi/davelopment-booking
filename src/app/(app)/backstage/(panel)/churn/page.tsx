import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, Restaurant, Subscription } from '@/payload/payload-types'
import { AlertTriangle, Clock, CalendarX, Building2, UtensilsCrossed, Store, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { toPlace, ownerIdOfSubscription, ownerIdOfPlace, type Place } from '@/lib/backstagePlaces'

function PlaceRow({ place, sub, badge }: {
  place: Place
  sub?: Subscription
  badge: { label: string; color: string }
}) {
  const Icon = place.kind === 'restaurant' ? UtensilsCrossed : Building2
  const typeLabel = place.kind === 'restaurant' ? 'Étterem' : 'Szalon'
  // A szalon-detail full-page route létezik; étteremnél a Helyek lista detail-sheetjére visszük.
  const href = place.kind === 'salon'
    ? `/backstage/salons/${place.id}`
    : `/backstage/salons?place=restaurant:${place.id}`
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[20px] p-[13px] transition-colors hover:bg-[#FCFAF1]">
      <div className="h-9 w-9 rounded-[13px] bg-[#F6F2E4] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-ink-soft" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1.5 min-w-0">
          <span className="text-ink text-[13.5px] font-semibold truncate">{place.name}</span>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{typeLabel}</span>
        </p>
        <p className="text-ink-soft text-[12px] truncate">{place.owner?.email ?? '—'}{place.city ? ` · ${place.city}` : ''}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {sub && <span className="text-[11px] text-ink-soft">{sub.plan}</span>}
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-ink-soft2" />
      </div>
    </Link>
  )
}

function Section({ title, icon: Icon, color, count, children, empty }: {
  title: string; icon: React.ElementType; color: string; count: number
  children: React.ReactNode; empty: string
}) {
  return (
    <div className="rounded-[24px] bg-white border border-line shadow-dav-card overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex items-center gap-3">
        <div className={`h-8 w-8 rounded-[11px] flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-ink font-semibold text-[15px] flex-1">{title}</h2>
        <span className="text-ink-soft text-[13px] font-semibold">{count}</span>
      </div>
      {count === 0
        ? <p className="px-5 py-6 text-ink-soft text-[13.5px]">{empty}</p>
        : <div className="p-1.5">{children}</div>
      }
    </div>
  )
}

export default async function ChurnPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const now = new Date()
  const in14 = new Date(); in14.setDate(now.getDate() + 14)
  const ago30 = new Date(); ago30.setDate(now.getDate() - 30)
  const ago14 = new Date(); ago14.setDate(now.getDate() - 14)

  const [salonsResult, restaurantsResult, subsResult] = await Promise.all([
    payload.find({ collection: 'salons', limit: 500, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', limit: 500, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', limit: 500, depth: 1, overrideAccess: true }),
  ])

  // Szalon + étterem egységes Place-listában; a kulcs `${kind}:${id}` (az ID-k ütközhetnek típusok közt).
  const places: Place[] = [
    ...(salonsResult.docs as Salon[]).map(s => toPlace('salon', s)),
    ...(restaurantsResult.docs as Restaurant[]).map(r => toPlace('restaurant', r)),
  ]
  const placeKey = (p: Place) => `${p.kind}:${p.id}`

  const subs = subsResult.docs as Subscription[]
  // Fiók-szintű: a sub az owner-höz kötött → ownerId → sub. Egy hely subja a tulajdonosáé.
  const subByOwner = new Map<string, Subscription>()
  for (const sub of subs) {
    const oid = ownerIdOfSubscription(sub)
    if (oid) subByOwner.set(oid, sub)
  }
  const subByPlace = new Map<string, Subscription>()
  for (const p of places) {
    const oid = ownerIdOfPlace(p)
    const sub = oid ? subByOwner.get(oid) : undefined
    if (sub) subByPlace.set(`${p.kind}:${p.id}`, sub)
  }

  // Foglalás-számok helyenként (szalon → bookings, étterem → reservations).
  const bookingCounts = await Promise.all(
    places.map(async p => {
      const collection = p.kind === 'restaurant' ? 'reservations' : 'bookings'
      const relField = p.kind === 'restaurant' ? 'restaurant' : 'salon'
      const [total, recent] = await Promise.all([
        payload.find({ collection, where: { [relField]: { equals: p.id } }, limit: 0, overrideAccess: true }),
        payload.find({ collection, where: { [relField]: { equals: p.id }, createdAt: { greater_than: ago30.toISOString() } }, limit: 0, overrideAccess: true }),
      ])
      return [placeKey(p), { total: total.totalDocs, recent: recent.totalDocs }] as const
    })
  )
  const bookingMap = new Map(bookingCounts)

  // Fiók-sub státuszból a fiók ÖSSZES helye (a sub az owner-höz kötött).
  const placesForOwners = (ownerIds: Set<string>): Place[] =>
    places.filter(p => { const oid = ownerIdOfPlace(p); return oid != null && ownerIds.has(oid) })

  // 1. Lejáró próbaidőszak (14 napon belül) — a próbán lévő fiókok összes helye
  const expiringOwners = new Set(
    subs.filter(sub => {
      if (sub.status !== 'trialing' || !sub.trial_ends_at) return false
      const end = new Date(sub.trial_ends_at)
      return end >= now && end <= in14
    }).map(ownerIdOfSubscription).filter((x): x is string => !!x)
  )
  const expiringTrialPlaces = placesForOwners(expiringOwners)

  // 2. Lejárt fizetés — a past_due fiókok összes helye
  const pastDueOwners = new Set(
    subs.filter(s => s.status === 'past_due').map(ownerIdOfSubscription).filter((x): x is string => !!x)
  )
  const pastDuePlaces = placesForOwners(pastDueOwners)

  // 3. Aktív, de 30 napja nincs foglalás (de volt valaha)
  const dormant = places.filter(p => {
    if (!p.is_active) return false
    const b = bookingMap.get(placeKey(p))
    return b && b.total > 0 && b.recent === 0
  })

  // 4. Soha nem volt foglalás (14+ napja regisztrált)
  const neverBooked = places.filter(p => {
    const b = bookingMap.get(placeKey(p))
    const old = new Date(p.createdAt) <= ago14
    return old && b && b.total === 0
  })

  // 5. Inaktív helyek
  const inactive = places.filter(p => !p.is_active)

  return (
    <div className="space-y-[22px] p-5 font-onest lg:p-8">
      <div>
        <h1 className="text-[34px] font-light tracking-[-0.02em] text-ink lg:text-[43px] leading-none">Kockázat & Churn</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Figyelmet igénylő ügyfelek (szalon + étterem)</p>
      </div>

      <div className="space-y-4">
        <Section title="Lejáró próbaidőszak (14 napon belül)" icon={Clock} color="bg-[#FBF4DC] text-[#7A6A2E]" count={expiringTrialPlaces.length} empty="Nincs lejáró próbaidőszak a következő 14 napban.">
          {expiringTrialPlaces.map(p => {
            const sub = subByPlace.get(placeKey(p))
            const days = sub?.trial_ends_at ? Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86400000) : null
            return <PlaceRow key={placeKey(p)} place={p} sub={sub} badge={{ label: days != null ? `${days} nap` : 'Lejár', color: 'bg-[#FBF4DC] text-[#7A6A2E]' }} />
          })}
        </Section>

        <Section title="Lejárt fizetés" icon={AlertTriangle} color="bg-[#F8E9E7] text-[#C0392B]" count={pastDuePlaces.length} empty="Nincs lejárt fizetésű előfizetés.">
          {pastDuePlaces.map(p => (
            <PlaceRow key={placeKey(p)} place={p} sub={subByPlace.get(placeKey(p))} badge={{ label: 'Lejárt', color: 'bg-[#F8E9E7] text-[#C0392B]' }} />
          ))}
        </Section>

        <Section title="30 napja nem volt foglalás" icon={CalendarX} color="bg-[#FBF4DC] text-[#7A6A2E]" count={dormant.length} empty="Minden aktív helynek volt foglalása az elmúlt 30 napban.">
          {dormant.map(p => {
            const b = bookingMap.get(placeKey(p))
            return <PlaceRow key={placeKey(p)} place={p} sub={subByPlace.get(placeKey(p))} badge={{ label: `${b?.total ?? 0} összes`, color: 'bg-[#FBF4DC] text-[#7A6A2E]' }} />
          })}
        </Section>

        <Section title="Soha nem volt foglalás" icon={Store} color="bg-[#F0EAD8] text-ink-soft" count={neverBooked.length} empty="Minden helynek volt már foglalása.">
          {neverBooked.map(p => {
            const daysAgo = Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / 86400000)
            return <PlaceRow key={placeKey(p)} place={p} sub={subByPlace.get(placeKey(p))} badge={{ label: `${daysAgo} napja regisztrált`, color: 'bg-[#F0EAD8] text-ink-soft' }} />
          })}
        </Section>

        <Section title="Inaktív helyek" icon={Store} color="bg-[#F0EAD8] text-ink-soft" count={inactive.length} empty="Nincs inaktív hely.">
          {inactive.map(p => (
            <PlaceRow key={placeKey(p)} place={p} sub={subByPlace.get(placeKey(p))} badge={{ label: 'Inaktív', color: 'bg-[#F0EAD8] text-ink-soft' }} />
          ))}
        </Section>
      </div>
    </div>
  )
}
