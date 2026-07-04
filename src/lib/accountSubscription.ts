import type { Payload, PayloadRequest } from 'payload'
import type { Subscription } from '@/payload/payload-types'
import type { Pricing } from './pricing'
import { businessMonthlyFee, applyCycle, resolveCycle } from './tier'

const MS_PER_DAY = 86_400_000

type Ctx = { payload: Payload; req?: PayloadRequest }

export interface AccountFee {
  salonCount: number
  restaurantCount: number
  /** A fiók havi LISTA-díja (üzletek tierje szerinti egységárak összege, ciklus-kedvezmény NÉLKÜL). */
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

// Az árazás kiolvasása a globalből (req-kontextusban, hookokhoz). NINCS fallback — az érték
// kizárólag a beállított `pricing-settings`-ből jön (required + defaultValue mezők).
async function readPricing(payload: Payload, req?: PayloadRequest): Promise<Pricing> {
  const g = (await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true, req })) as Pricing
  return {
    salon_pro_huf: g.salon_pro_huf,
    salon_extra_staff_huf: g.salon_extra_staff_huf,
    restaurant_pro_huf: g.restaurant_pro_huf,
    annual_discount_pct: g.annual_discount_pct,
    trial_days: g.trial_days,
  }
}

/**
 * Aktív munkatársak (naptárak) száma szalononként — a szalon per-fő díjához. Egy lekérdezés az
 * összes érintett szalonra, majd JS-oldali csoportosítás. Üres id-lista esetén üres map.
 */
export async function countActiveStaffBySalon(
  payload: Payload,
  salonIds: Array<string | number>,
  req?: PayloadRequest,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (salonIds.length === 0) return map
  const res = await payload.find({
    collection: 'staff',
    where: { and: [{ salon: { in: salonIds } }, { is_active: { equals: true } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const st of res.docs as Array<{ salon?: unknown }>) {
    const sid = st.salon && typeof st.salon === 'object' ? (st.salon as { id: unknown }).id : st.salon
    if (sid == null) continue
    const key = String(sid)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

/**
 * A fiók üzlet-összetétele + a számolt LISTA havidíj (üzletek tierje szerinti egységárak összege,
 * ciklus-kedvezmény nélkül). A ciklus (havi/éves) kedvezményét a `syncAccountSubscription` alkalmazza
 * az `amount_huf`-ra. Megj.: a limit 200 — efölött a Lánc (egyedi ár) tartomány kezeli az esetet.
 */
export async function computeAccountFee({ payload, req }: Ctx, userId: string | number): Promise<AccountFee> {
  const [salons, restaurants, pricing] = await Promise.all([
    payload.find({ collection: 'salons', where: { owner: { equals: userId } }, limit: 200, depth: 0, overrideAccess: true, req }),
    payload.find({ collection: 'restaurants', where: { owner: { equals: userId } }, limit: 200, depth: 0, overrideAccess: true, req }),
    readPricing(payload, req),
  ])
  const salonDocs = salons.docs as Array<{ id: string | number }>
  const salonCount = salons.totalDocs
  const restaurantCount = restaurants.totalDocs

  // Szalon per-fő: aktív munkatársak száma szalononként → díj = alap + (fő − benne foglalt) × extra.
  const staffBySalon = await countActiveStaffBySalon(payload, salonDocs.map((s) => s.id), req)
  const salonSum = salonDocs.reduce(
    (sum, s) => sum + businessMonthlyFee(pricing, 'salon', staffBySalon.get(String(s.id)) ?? 0), 0)
  const restaurantSum = restaurantCount * businessMonthlyFee(pricing, 'restaurant')
  const amountHuf = salonSum + restaurantSum

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

  // A tárolt amount_huf az EFFEKTÍV havidíj: a lista-díjra ráültetjük a számlázási ciklus
  // (havi/éves) kedvezményét, hogy a fiók díja azonnal kövesse az üzlet- és ciklus-változást.
  const pricing = await readPricing(payload, req)
  const cycle = resolveCycle(existing.billing_cycle)
  const effectiveAmount = applyCycle(fee.amountHuf, cycle, pricing.annual_discount_pct)

  await payload.update({
    collection: 'subscriptions',
    id: existing.id,
    overrideAccess: true,
    req,
    data: {
      salon_count: fee.salonCount,
      restaurant_count: fee.restaurantCount,
      amount_huf: effectiveAmount,
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
