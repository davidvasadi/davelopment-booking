import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, Restaurant, User, Subscription } from '@/payload/payload-types'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import RecentSalonsClient from './RecentSalonsClient'
import { subAmountHuf } from '@/lib/backstagePlaces'
import { BackstageKpiCard, type TrendPoint } from '@/components/backstage/BackstageKpiCard'

function formatHuf(n: number) {
  return `${n.toLocaleString('hu-HU')} Ft`
}

const TREND_DAYS = 30

/**
 * Egy ENTITÁS összes `createdAt`-jéből 30 napos KUMULÁLT napi idősor (az adott napig létrejött
 * összes elem száma). Az ablak előtti elemek adják a kezdő alapszintet, így a sparkline a valós
 * összlétszám alakulását mutatja, nem csak az ablakban újakat.
 */
function cumulativeTrend(allCreatedAts: string[]): TrendPoint[] {
  const days: TrendPoint[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (TREND_DAYS - 1))

  let baseBefore = 0
  const perDay = new Map<string, number>()
  for (const iso of allCreatedAts) {
    const d = new Date(iso); d.setHours(0, 0, 0, 0)
    if (d < start) { baseBefore += 1; continue }
    const key = d.toISOString().slice(0, 10)
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }

  let running = baseBefore
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    running += perDay.get(key) ?? 0
    days.push({ label: d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }), value: running })
  }
  return days
}

/** Csak a `createdAt`-mezőket kérjük le egy collectionből (idősorhoz), nagy limittel. */
async function createdAtList(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  collection: 'salons' | 'restaurants' | 'users' | 'bookings' | 'reservations' | 'subscriptions',
  where?: Record<string, unknown>,
): Promise<string[]> {
  const res = await payload.find({ collection, where, limit: 5000, depth: 0, overrideAccess: true, select: { createdAt: true } } as Parameters<typeof payload.find>[0])
  return (res.docs as unknown as { createdAt: string }[]).map(d => d.createdAt)
}

export default async function BackstagePage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [
    salonsResult, activeSalons, restaurantsResult, activeRestaurants,
    salonOwners, restaurantOwners,
    bookingsResult, monthBookings, reservationsResult, monthReservations,
    recentSalons, recentRestaurants, subsResult,
    // createdAt-listák a KPI-sparkline-okhoz
    salonDates, restaurantDates, salonOwnerDates, restaurantOwnerDates,
    bookingDates, reservationDates,
  ] = await Promise.all([
    payload.find({ collection: 'salons', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'salons', where: { is_active: { equals: true } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'restaurants', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'restaurants', where: { is_active: { equals: true } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'users', where: { role: { equals: 'salon_owner' } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'users', where: { role: { equals: 'restaurant_owner' } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', where: { createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'reservations', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'reservations', where: { createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    // Legutóbbi regisztrációk — időablak NÉLKÜL (a lista mindig a legfrissebb helyeket mutatja,
    // különben üres, ha rég volt új reg). A dátum a soron látszik.
    payload.find({ collection: 'salons', sort: '-createdAt', limit: 10, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', sort: '-createdAt', limit: 10, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', limit: 200, depth: 1, overrideAccess: true }),
    createdAtList(payload, 'salons'),
    createdAtList(payload, 'restaurants'),
    createdAtList(payload, 'users', { role: { equals: 'salon_owner' } }),
    createdAtList(payload, 'users', { role: { equals: 'restaurant_owner' } }),
    createdAtList(payload, 'bookings'),
    createdAtList(payload, 'reservations'),
  ])

  const subs = subsResult.docs as Subscription[]
  const activeSubs = subs.filter(s => s.status === 'active')
  const trialingSubs = subs.filter(s => s.status === 'trialing')
  const pastDueSubs = subs.filter(s => s.status === 'past_due')
  const canceledSubs = subs.filter(s => s.status === 'canceled')
  const mrr = activeSubs.reduce((sum, s) => sum + subAmountHuf(s), 0)

  const totalPlaces = salonsResult.totalDocs + restaurantsResult.totalDocs
  const activePlaces = activeSalons.totalDocs + activeRestaurants.totalDocs
  const totalOwners = salonOwners.totalDocs + restaurantOwners.totalDocs
  const totalBookings = bookingsResult.totalDocs + reservationsResult.totalDocs
  const monthBookingsTotal = monthBookings.totalDocs + monthReservations.totalDocs

  // Származtatott mérőszámok.
  const arr = mrr * 12
  const arpu = activeSubs.length > 0 ? Math.round(mrr / activeSubs.length) : 0
  const payingVsTrial = activeSubs.length + trialingSubs.length
  const conversionRate = payingVsTrial > 0 ? Math.round((activeSubs.length / payingVsTrial) * 100) : 0
  const churnRate = subs.length > 0 ? ((canceledSubs.length / subs.length) * 100).toFixed(1) : '0.0'

  const now = new Date()
  const in14 = new Date(); in14.setDate(now.getDate() + 14)
  const expiringTrials = trialingSubs.filter(s => {
    if (!s.trial_ends_at) return false
    const end = new Date(s.trial_ends_at)
    return end >= now && end <= in14
  })

  // KPI-sparkline-ok: 30 napos kumulált idősor a createdAt-ekből.
  const placesTrend = cumulativeTrend([...salonDates, ...restaurantDates])
  const ownersTrend = cumulativeTrend([...salonOwnerDates, ...restaurantOwnerDates])
  const bookingsTrend = cumulativeTrend([...bookingDates, ...reservationDates])
  const activeSubsTrend = cumulativeTrend(activeSubs.map(s => s.createdAt))

  // Étteri KPI-stílus: nincs színes ikon, nagy fekete/fehér szám + szürke uppercase eyebrow + sparkline.
  const primaryStats = [
    { label: 'Összes hely', value: String(totalPlaces), sub: `${activePlaces} aktív · ${salonsResult.totalDocs} szalon / ${restaurantsResult.totalDocs} étterem`, trend: placesTrend, color: '#8b5cf6', title: 'Helyek (szalon + étterem)', description: 'A platformon regisztrált összes üzlet (szalon és étterem) számának alakulása az elmúlt 30 napban.' },
    { label: 'Tulajdonosok', value: String(totalOwners), sub: 'regisztrált', trend: ownersTrend, color: '#3b82f6', title: 'Tulajdonosok', description: 'A regisztrált szalon- és étterem-tulajdonosok számának alakulása.' },
    { label: 'Összes foglalás', value: String(totalBookings), sub: `${monthBookingsTotal} ebben a hónapban`, trend: bookingsTrend, color: '#10b981', title: 'Foglalások', description: 'Az összes foglalás (szalon bookings + étterem reservations) kumulált alakulása.' },
    { label: 'Aktív előfizetés', value: String(activeSubs.length), sub: `${trialingSubs.length} próbaidőszak`, trend: activeSubsTrend, color: '#f59e0b', title: 'Aktív előfizetések', description: 'A fizető (aktív) előfizetések számának alakulása az elmúlt 30 napban.' },
  ]
  const metricStats = [
    { label: 'Trial → fizető konverzió', value: `${conversionRate}%`, sub: `${activeSubs.length} fizető / ${payingVsTrial} aktív+trial` },
    { label: 'Churn ráta', value: `${churnRate}%`, sub: `${canceledSubs.length} lemondott`, danger: canceledSubs.length > 0 },
    { label: 'ARR', value: formatHuf(arr), sub: 'éves vetített bevétel' },
    { label: 'ARPU', value: formatHuf(arpu), sub: 'átlag / fizető ügyfél' },
  ]

  // Recent: szalon + étterem összevonva, dátum szerint.
  const recentPlaces = [
    ...(recentSalons.docs as Salon[]).map(s => ({ kind: 'salon' as const, doc: s })),
    ...(recentRestaurants.docs as Restaurant[]).map(r => ({ kind: 'restaurant' as const, doc: r })),
  ]
    .sort((a, b) => new Date(b.doc.createdAt).getTime() - new Date(a.doc.createdAt).getTime())
    .slice(0, 10)
    .map(({ kind, doc }) => {
      const owner = typeof doc.owner === 'object' ? (doc.owner as User) : null
      return {
        kind,
        id: String(doc.id),
        name: doc.name,
        city: doc.city,
        is_active: doc.is_active,
        createdAt: doc.createdAt,
        ownerEmail: owner?.email,
      }
    })

  const cardBase = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl'

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Backstage</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Áttekintő</h1>
        <p className="text-zinc-500 dark:text-white/40 text-sm mt-1">Platform szintű statisztikák</p>
      </div>

      {/* MRR highlight */}
      <div className={`${cardBase} px-6 py-5 flex items-center justify-between gap-4`}>
        <div>
          <p className="text-zinc-400 dark:text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-1">MRR · havi visszatérő bevétel</p>
          <p className="text-zinc-900 dark:text-white font-black text-4xl tracking-tight leading-none">
            {mrr.toLocaleString('hu-HU')}<span className="text-lg font-semibold text-zinc-400 dark:text-zinc-500 ml-1">Ft</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{activeSubs.length} fizető ügyfél</p>
          {pastDueSubs.length > 0 && (
            <p className="text-red-500 text-xs mt-0.5">{pastDueSubs.length} lejárt fizetés</p>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(expiringTrials.length > 0 || pastDueSubs.length > 0) && (
        <div className="space-y-2">
          {pastDueSubs.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-red-400 text-sm font-medium">{pastDueSubs.length} előfizetés lejárt fizetéssel</p>
              <Link href="/backstage/subscriptions?status=past_due" className="ml-auto text-xs text-red-400 underline whitespace-nowrap">Megtekintés →</Link>
            </div>
          )}
          {expiringTrials.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-amber-400 text-sm font-medium">{expiringTrials.length} próbaidőszak jár le 14 napon belül</p>
              <Link href="/backstage/subscriptions?status=trialing" className="ml-auto text-xs text-amber-400 underline whitespace-nowrap">Megtekintés →</Link>
            </div>
          )}
        </div>
      )}

      {/* Primary stats — sparkline-os, kattintható KPI-kártyák (sheet nagy charttal) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {primaryStats.map(s => (
          <BackstageKpiCard
            key={s.label}
            label={s.label}
            value={s.value}
            sub={s.sub}
            trend={s.trend}
            title={s.title}
            description={s.description}
            color={s.color}
          />
        ))}
      </div>

      {/* Key metrics — konverzió, churn, ARR, ARPU */}
      <div>
        <h2 className="text-zinc-400 dark:text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-3">Üzleti mérőszámok</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricStats.map(s => (
            <div key={s.label} className={`${cardBase} p-5`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-2">{s.label}</p>
              <p className={`font-black text-3xl leading-none ${s.danger ? 'text-red-500 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{s.value}</p>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-2">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent signups — legutóbbi (időablak nélkül) */}
      <div className={`${cardBase} overflow-hidden`}>
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
          <h2 className="text-zinc-900 dark:text-white font-bold text-sm uppercase tracking-widest">
            Legutóbbi regisztrációk
          </h2>
          <Link href="/backstage/salons" className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            Összes →
          </Link>
        </div>
        {recentPlaces.length === 0 ? (
          <p className="px-6 py-8 text-zinc-400 dark:text-zinc-600 text-sm">Még nincs egyetlen regisztrált hely sem.</p>
        ) : (
          <RecentSalonsClient salons={recentPlaces} />
        )}
      </div>
    </div>
  )
}
