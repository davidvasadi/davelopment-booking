import type { Payload, PayloadRequest, Where } from 'payload'

const MS_PER_DAY = 86_400_000
const PAID_PLANS = ['pro', 'restaurant_pro']

type Ctx = { payload: Payload; req?: PayloadRequest }

/**
 * Eldönti, hogy egy ÚJ üzlet (szalon/étterem) milyen előfizetéssel induljon, a több-üzlet
 * (multi-tenant) szabály szerint:
 *
 *   Ha a tulajdonosnak MÁR VAN legalább egy aktív, FIZETŐS előfizetése (status=active +
 *   plan ∈ {pro, restaurant_pro}) BÁRMELY üzletén → az új üzlet EGYBŐL fizetős lesz
 *   (nincs újabb próbaidő). Egyébként a szokásos próbaidőt kapja.
 *
 * Az árazás minden esetben a GLOBÁLIS `pricing-settings`-ből jön (backstage-ben
 * szerkeszthető), a plan típusához igazítva — sehol nincs beégetett ár.
 *
 * @param ownerId  az új üzlet tulajdonosa (user id)
 * @param kind     'salon' | 'restaurant' — meghatározza a fizetős plan-t és az árat
 * @returns        a `subscriptions.create` data-mezője (a salon/restaurant id-t a hívó teszi rá)
 */
export async function buildNewPlaceSubscription(
  { payload, req }: Ctx,
  ownerId: string | number | { id: string | number } | null | undefined,
  kind: 'salon' | 'restaurant',
): Promise<{
  plan: string
  status: string
  amount_huf: number
  trial_ends_at?: string
  current_period_end?: string
  cancel_at_period_end?: boolean
}> {
  const pricing = (await payload.findGlobal({
    slug: 'pricing-settings',
    overrideAccess: true,
    req,
  })) as { trial_days?: number; salon_pro_huf?: number; restaurant_pro_huf?: number }

  const paidPlan = kind === 'salon' ? 'pro' : 'restaurant_pro'
  const price = kind === 'salon' ? (pricing?.salon_pro_huf ?? 2900) : (pricing?.restaurant_pro_huf ?? 9900)

  // Van-e a tulajdonosnak MÁR aktív fizető előfizetése bármely üzletén?
  // A subscription közvetlenül az üzlethez kötött (salon/restaurant mező), ezért előbb a
  // user üzleteit szedjük össze, majd azokra keresünk aktív fizető subscription-t.
  const hasActivePaid = await ownerHasActivePaidSubscription({ payload, req }, ownerId)

  if (hasActivePaid) {
    // Már fizető fiók → az új üzlet egyből fizetős, próbaidő nélkül. Új 30 napos ciklus.
    return {
      plan: paidPlan,
      status: 'active',
      amount_huf: price,
      current_period_end: new Date(Date.now() + 30 * MS_PER_DAY).toISOString(),
      cancel_at_period_end: false,
    }
  }

  // Próbaidő: ha a fióknak MÁR van futó (trialing) próbaideje egy másik üzletén, az ÚJ üzlet
  // ahhoz IGAZODIK — egy közös, párhuzamos próbaidő a fiók szintjén (nem indul külön 14 nap).
  // Ha nincs még futó trial (ez az első üzlet), a szokásos trial_days.
  const existingTrialEnd = await earliestActiveTrialEnd({ payload, req }, ownerId)
  let trialEndIso: string
  if (existingTrialEnd) {
    trialEndIso = existingTrialEnd
  } else {
    const trialDays = pricing?.trial_days ?? 14
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + trialDays)
    trialEndIso = trialEnd.toISOString()
  }
  return {
    plan: 'trial',
    status: 'trialing',
    amount_huf: price,
    trial_ends_at: trialEndIso,
  }
}

/**
 * A fiók (owner) jelenleg FUTÓ (status=trialing, jövőbeli lejárat) próbaidői közül a
 * legkorábbi `trial_ends_at`-jét adja vissza ISO-stringként, vagy null-t ha nincs ilyen.
 * Erre igazodik egy újonnan hozzáadott üzlet próbaideje (közös fiók-szintű trial).
 */
async function earliestActiveTrialEnd(
  { payload, req }: Ctx,
  ownerId: string | number | { id: string | number } | null | undefined,
): Promise<string | null> {
  const rawId = ownerId && typeof ownerId === 'object' ? ownerId.id : ownerId
  const oid = typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : rawId
  if (oid == null || (typeof oid === 'number' && Number.isNaN(oid))) return null

  const [salons, restaurants] = await Promise.all([
    payload.find({ collection: 'salons', where: { owner: { equals: oid } }, limit: 100, depth: 0, overrideAccess: true, req }),
    payload.find({ collection: 'restaurants', where: { owner: { equals: oid } }, limit: 100, depth: 0, overrideAccess: true, req }),
  ])
  const salonIds = salons.docs.map((d) => d.id)
  const restaurantIds = restaurants.docs.map((d) => d.id)
  if (salonIds.length === 0 && restaurantIds.length === 0) return null

  const orClauses: Where[] = []
  if (salonIds.length) orClauses.push({ salon: { in: salonIds } })
  if (restaurantIds.length) orClauses.push({ restaurant: { in: restaurantIds } })

  const now = new Date().toISOString()
  const subs = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        { status: { equals: 'trialing' } },
        { trial_ends_at: { greater_than: now } },
        { or: orClauses },
      ],
    },
    sort: 'trial_ends_at', // növekvő → az első a legkorábbi lejárat
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const first = subs.docs[0] as { trial_ends_at?: string | null } | undefined
  return first?.trial_ends_at ?? null
}

/** Van-e a usernek legalább egy aktív + fizetős előfizetése (bármely üzletén)? */
export async function ownerHasActivePaidSubscription(
  { payload, req }: Ctx,
  ownerId: string | number | { id: string | number } | null | undefined,
): Promise<boolean> {
  // Az owner lehet relationship-objektum ({ id }) vagy nyers id; normalizáljuk skalárra,
  // különben a `where equals` NaN-t kap és a Postgres int-oszlopon elhasal (22P02).
  const rawId = ownerId && typeof ownerId === 'object' ? ownerId.id : ownerId
  const oid = typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : rawId
  if (oid == null || (typeof oid === 'number' && Number.isNaN(oid))) return false

  const [salons, restaurants] = await Promise.all([
    payload.find({ collection: 'salons', where: { owner: { equals: oid } }, limit: 100, depth: 0, overrideAccess: true, req }),
    payload.find({ collection: 'restaurants', where: { owner: { equals: oid } }, limit: 100, depth: 0, overrideAccess: true, req }),
  ])

  const salonIds = salons.docs.map((d) => d.id)
  const restaurantIds = restaurants.docs.map((d) => d.id)
  if (salonIds.length === 0 && restaurantIds.length === 0) return false

  const orClauses: Where[] = []
  if (salonIds.length) orClauses.push({ salon: { in: salonIds } })
  if (restaurantIds.length) orClauses.push({ restaurant: { in: restaurantIds } })

  const subs = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        { status: { equals: 'active' } },
        { plan: { in: PAID_PLANS } },
        { or: orClauses },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return subs.docs.length > 0
}
