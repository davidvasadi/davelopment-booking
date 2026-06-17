import type { Payload, PayloadRequest } from 'payload'
import type { Subscription } from '@/payload/payload-types'

const MS_PER_DAY = 86_400_000
const PRICING_FALLBACK = { salon_pro_huf: 2900, restaurant_pro_huf: 9900, trial_days: 14 }

type Ctx = { payload: Payload; req?: PayloadRequest }

export interface AccountFee {
  salonCount: number
  restaurantCount: number
  amountHuf: number
  /** Olvasható összetétel, pl. „2 étterem + 1 szalon". */
  breakdown: string
}

/**
 * FIÓK-SZINTŰ előfizetés (account-level subscription). EGY user = EGY `subscriptions` rekord
 * (`owner` relationnel). A díj az összes üzletéből (szalon + étterem) dinamikusan számolódik a
 * globális `pricing-settings` egységáraiból:  Σ (szalonok × salon_pro) + (éttermek × restaurant_pro).
 *
 * Ez a KÖZPONTI forrás az árhoz — az app és a backstage is innen olvas, és az üzlet hozzáadás/
 * törlés hookja a `syncAccountSubscription`-t hívja.
 *
 * Jövő: a `computeAccountFee` bővíthető per-üzlet extrákkal (pl. szalon munkatárs-felár) — most
 * csak a tiszta üzlet×egységár.
 */

async function readPricing(payload: Payload, req?: PayloadRequest) {
  try {
    const g = (await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true, req })) as {
      salon_pro_huf?: number; restaurant_pro_huf?: number; trial_days?: number
    }
    return {
      salon_pro_huf: g?.salon_pro_huf ?? PRICING_FALLBACK.salon_pro_huf,
      restaurant_pro_huf: g?.restaurant_pro_huf ?? PRICING_FALLBACK.restaurant_pro_huf,
      trial_days: g?.trial_days ?? PRICING_FALLBACK.trial_days,
    }
  } catch {
    return { ...PRICING_FALLBACK }
  }
}

/** A fiók üzlet-összetétele + a számolt teljes havidíj. */
export async function computeAccountFee({ payload, req }: Ctx, userId: string | number): Promise<AccountFee> {
  const [salons, restaurants, pricing] = await Promise.all([
    payload.find({ collection: 'salons', where: { owner: { equals: userId } }, limit: 200, depth: 0, overrideAccess: true, req }),
    payload.find({ collection: 'restaurants', where: { owner: { equals: userId } }, limit: 200, depth: 0, overrideAccess: true, req }),
    readPricing(payload, req),
  ])
  const salonCount = salons.totalDocs
  const restaurantCount = restaurants.totalDocs
  const amountHuf = salonCount * pricing.salon_pro_huf + restaurantCount * pricing.restaurant_pro_huf

  const parts: string[] = []
  if (restaurantCount) parts.push(`${restaurantCount} étterem`)
  if (salonCount) parts.push(`${salonCount} szalon`)
  const breakdown = parts.join(' + ') || '— nincs üzlet —'

  return { salonCount, restaurantCount, amountHuf, breakdown }
}

/** A user fiók-előfizetése (vagy null). */
export async function findAccountSubscription({ payload, req }: Ctx, userId: string | number): Promise<Subscription | null> {
  const res = await payload.find({
    collection: 'subscriptions',
    where: { owner: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return (res.docs[0] as Subscription) ?? null
}

/**
 * A user fiók-előfizetését adja vissza; ha még nincs, létrehozza próbaidővel. A díjat és a
 * count-okat az aktuális üzletek alapján állítja be.
 */
export async function getOrCreateAccountSubscription({ payload, req }: Ctx, userId: string | number): Promise<Subscription> {
  const existing = await findAccountSubscription({ payload, req }, userId)
  if (existing) return existing

  const fee = await computeAccountFee({ payload, req }, userId)
  const pricing = await readPricing(payload, req)
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + pricing.trial_days)

  // Az owner reláció a DB-ben int FK — numerikus stringet számmá alakítunk, hogy a Payload
  // reláció-validáció megtalálja a usert (különben „Tulajdonos érvénytelen").
  const ownerVal = typeof userId === 'string' && /^\d+$/.test(userId) ? Number(userId) : userId

  const created = await payload.create({
    collection: 'subscriptions',
    overrideAccess: true,
    req,
    data: {
      owner: ownerVal,
      plan: 'trial',
      status: 'trialing',
      trial_ends_at: trialEnd.toISOString(),
      salon_count: fee.salonCount,
      restaurant_count: fee.restaurantCount,
      amount_huf: fee.amountHuf,
      breakdown: fee.breakdown,
    },
  })
  return created as Subscription
}

/**
 * Újraszámolja a fiók-előfizetés üzlet-összetételét és díját (üzlet hozzáadás/törlés után hívandó).
 * Ha nincs még fiók-sub, létrehozza (trial). A státuszt NEM bántja — csak a count/díj/breakdown
 * frissül, így a fizető fiók díja azonnal nő/csökken az üzletek számával.
 */
export async function syncAccountSubscription({ payload, req }: Ctx, userId: string | number): Promise<void> {
  const fee = await computeAccountFee({ payload, req }, userId)
  const existing = await findAccountSubscription({ payload, req }, userId)

  if (!existing) {
    // Nincs még fiók-sub (első üzlet) → létrehozzuk trial-lal.
    await getOrCreateAccountSubscription({ payload, req }, userId)
    return
  }

  await payload.update({
    collection: 'subscriptions',
    id: existing.id,
    overrideAccess: true,
    req,
    data: {
      salon_count: fee.salonCount,
      restaurant_count: fee.restaurantCount,
      amount_huf: fee.amountHuf,
      breakdown: fee.breakdown,
    },
  })
}

/** Aktívan FUTÓ a próbaidő? (trialing + jövőbeli lejárat) */
export function isOnTrial(sub: Subscription | null): boolean {
  if (!sub || sub.status !== 'trialing') return false
  if (!sub.trial_ends_at) return true
  return new Date(sub.trial_ends_at).getTime() > Date.now()
}

export { MS_PER_DAY }
