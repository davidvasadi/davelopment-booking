import type { Payload, PayloadRequest } from 'payload'
import type { Subscription, TrialLedgerEntry } from '@/payload/payload-types'
import type { Pricing } from './pricing'
import { businessMonthlyFee, applyCycle, resolveCycle, resolveTier } from './tier'
import { getStripe, hufToStripeMinor } from './stripe'

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
    salon_starter_huf: g.salon_starter_huf,
    salon_pro_huf: g.salon_pro_huf,
    salon_extra_staff_huf: g.salon_extra_staff_huf,
    restaurant_starter_huf: g.restaurant_starter_huf,
    restaurant_pro_huf: g.restaurant_pro_huf,
    starter_email_cap: g.starter_email_cap,
    pro_email_cap: g.pro_email_cap,
    egyedi_email_cap: g.egyedi_email_cap,
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
  const salonDocs = salons.docs as Array<{ id: string | number; tier?: string | null; custom_monthly_fee_huf?: number | null }>
  const restaurantDocs = restaurants.docs as Array<{ tier?: string | null; custom_monthly_fee_huf?: number | null }>
  const salonCount = salons.totalDocs
  const restaurantCount = restaurants.totalDocs

  // Szalon per-fő: aktív munkatársak száma szalononként → díj = alap (csomag szerint) +
  // (fő − benne foglalt) × extra. A hírlevél-keret BEÉPÍTVE jár a csomagba, nincs külön felár.
  // Egyedi csomagnál a `custom_monthly_fee_huf` (ha be van állítva) felülírja a teljes díjat.
  const staffBySalon = await countActiveStaffBySalon(payload, salonDocs.map((s) => s.id), req)
  const salonSum = salonDocs.reduce(
    (sum, s) => sum + businessMonthlyFee(pricing, 'salon', staffBySalon.get(String(s.id)) ?? 0, resolveTier(s.tier), s.custom_monthly_fee_huf), 0)
  const restaurantSum = restaurantDocs.reduce(
    (sum, r) => sum + businessMonthlyFee(pricing, 'restaurant', 0, resolveTier(r.tier), r.custom_monthly_fee_huf), 0)
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
 * Az email trial-ledger bejegyzése, ha valaha kapott már próbaidőt — a `trial-ledger`
 * FÜGGETLEN a `Users`/`Subscriptions` törlésétől (lásd a collection dokumentációját), tehát
 * törölt-majd-újraregisztrált fiókoknál is megtalálja az EREDETI kezdő időpontot.
 */
async function findTrialLedgerEntry(payload: Payload, email: string): Promise<TrialLedgerEntry | null> {
  const res = await payload.find({
    collection: 'trial-ledger',
    where: { email: { equals: email.trim().toLowerCase() } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs[0] as TrialLedgerEntry | undefined) ?? null
}

/** Az email felvétele a próbaidő-nyilvántartásba — csak ÚJ trial indításakor hívjuk, egyszer. */
async function recordTrialEmail(payload: Payload, email: string): Promise<void> {
  await payload.create({
    collection: 'trial-ledger',
    overrideAccess: true,
    data: { email: email.trim().toLowerCase(), first_seen_at: new Date().toISOString() },
    // Ha valamiért versenyhelyzetben duplán próbálná felvenni (egyedi index ütközés), nem
    // fatális — a lényeg, hogy a sor létezzen utána, nem hogy ez a hívás dobjon-e hibát.
  }).catch(() => null)
}

/**
 * A user fiók-előfizetését adja vissza; ha még nincs, létrehozza próbaidővel. A díjat és a
 * count-okat az aktuális üzletek alapján állítja be.
 *
 * Csalás-védelem + méltányosság: a próbaidő vége mindig az EREDETI, `trial-ledger`-ben tárolt
 * kezdő időponthoz (`first_seen_at`) van kötve, nem egy új, nulláról induló időablakhoz — ha az
 * email még sosem szerepelt a ledgerben, most kezdődik (és felkerül rá); ha már szerepel (akár
 * egy azóta törölt/anonymizált fiókon), a próbaidő onnantól számít, ahonnan eredetileg elindult.
 * Így aki a próbaidő KÖZEPÉN törli magát és újraregisztrál, a MARADÉK napjait kapja vissza
 * (nem nulla, de nem is egy friss teljes próbaidőt) — aki már valóban túl van a teljes
 * próbaidő-hosszon, azonnal `past_due`-ban landol, lejárt `trial_ends_at`-tal.
 */
export async function getOrCreateAccountSubscription({ payload, req }: Ctx, userId: string | number): Promise<Subscription> {
  const existing = await findAccountSubscription({ payload, req }, userId)
  if (existing) return existing

  const fee = await computeAccountFee({ payload, req }, userId)
  const pricing = await readPricing(payload, req)

  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true, req }).catch(() => null) as { email?: string } | null
  const email = user?.email
  const ledgerEntry = email ? await findTrialLedgerEntry(payload, email) : null

  const now = new Date()
  const firstSeen = ledgerEntry ? new Date(ledgerEntry.first_seen_at) : now
  const trialEnd = new Date(firstSeen.getTime() + pricing.trial_days * MS_PER_DAY)
  const stillTrialing = trialEnd.getTime() > now.getTime()
  if (!ledgerEntry && email) await recordTrialEmail(payload, email)

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
      status: stillTrialing ? 'trialing' : 'past_due',
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
 * Újraszámolja a fiók-előfizetés üzlet-összetételét és díját (üzlet hozzáadás/törlés, vagy
 * bármi más díj-befolyásoló változás — pl. hírlevél-csomag váltás — után hívandó). Ha nincs még
 * fiók-sub, létrehozza (trial). A státuszt NEM bántja — csak a count/díj/breakdown frissül.
 *
 * Ha a fiók már FIZETŐ (élő Stripe-előfizetéssel), az új összeget a Stripe-nál is érvényesíti
 * (`stripe.subscriptions.update` price_data-val, azonnali arányos számlával) — különben a
 * DB-ben számolt díj elszakadna a ténylegesen terhelt összegtől. A Stripe-hívás best-effort:
 * hibája NEM dobja tovább (a hívók egy része, pl. a Salons afterChange hook, catch nélkül
 * awaitolja ezt a függvényt — egy Stripe-hiba nem törheti el az üzlet létrehozását).
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
  const previousAmount = existing.amount_huf ?? 0

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

  if (existing.status === 'active' && existing.stripe_subscription_id && effectiveAmount !== previousAmount) {
    const stripe = getStripe()
    if (stripe) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(existing.stripe_subscription_id)
        const item = stripeSub.items.data[0]
        if (item) {
          const unitForint = cycle === 'annual' ? effectiveAmount * 12 : effectiveAmount
          const interval: 'month' | 'year' = cycle === 'annual' ? 'year' : 'month'
          const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product.id
          await stripe.subscriptions.update(existing.stripe_subscription_id, {
            proration_behavior: 'always_invoice',
            items: [{
              id: item.id,
              price_data: {
                currency: 'huf',
                unit_amount: hufToStripeMinor(unitForint),
                recurring: { interval },
                product: productId,
              },
            }],
          })
        }
      } catch (err) {
        payload.logger.error(`[accountSubscription] Stripe ár-szinkron hiba: ${String(err)}`)
      }
    }
  }
}

/** Aktívan FUTÓ a próbaidő? (trialing + jövőbeli lejárat) */
export function isOnTrial(sub: Subscription | null): boolean {
  if (!sub || sub.status !== 'trialing') return false
  if (!sub.trial_ends_at) return true
  return new Date(sub.trial_ends_at).getTime() > Date.now()
}

export { MS_PER_DAY }
