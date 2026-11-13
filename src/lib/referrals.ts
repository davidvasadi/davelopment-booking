import type { Payload } from 'payload'
import { authQuery, sql } from './authDb'
import { getStripe, hufToStripeMinor } from './stripe'
import type { Subscription } from '@/payload/payload-types'

/**
 * Ajánló program (roadmap 54, design 16.16 „Ajánld egy ismerősnek” + a meghívott regisztrációja).
 *  - A fiók tulajdonosa kap egy kódot (a keresztnevéből + véletlen végződés, pl. ANNA-7K2), a linkje `/r/anna-7k2` — a megnyitás sütibe teszi a
 *    kódot (60 nap), a regisztráció átveszi (vagy kézzel beírható).
 *  - Ajánlás csak ÚJ fióknál jön létre: magát nem ajánlhatja, és aki már kapott valaha próbaidőt (`trial-ledger`), az
 *    nem számít újnak.
 *  - Jutalom: amikor a meghívott a próbaidő után ELŐSZÖR előfizet (Stripe checkout kész), az AJÁNLÓ kap 1 hónapnyi
 *    jóváírást a Stripe-egyenlegére (a saját havidíja összegében — a következő számlából vonódik le). A meghívott NEM
 *    kap automatikusan semmit a szokásos próbaidőn felül — ingyen hónapot ő is akkor kap, ha ő is ajánl valakit, aki
 *    előfizet (Dave döntése, 2026-11-05). Ha az ajánlónak még nincs Stripe-ügyfele (próbaidőn van), a jóváírás függőben
 *    marad, és az ő első előfizetésekor kerül rá. (A `referred_credited_at` oszlop megmaradt, de már nem használjuk.)
 */

export const REF_COOKIE = 'dav_ref'
export const REF_COOKIE_DAYS = 60
/** ennyi előfizetett ajánlásonként jelzünk egy „szintet” a kártyán (a csík) */
export const REF_TIER = 3

const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const normalizeCode = (s: string | null | undefined) => clean(String(s ?? '')).slice(0, 24)

// Az új kódok: a keresztnév + egy rövid véletlen végződés (szám-betű-szám, pl. ANNA7K2 → megjelenítve ANNA-7K2), hogy a
// kódot ne lehessen kitalálni, és két „Anna” ne keveredjen. Kötőjel nélkül tároljuk (a beírt kódból a `clean` úgyis
// kiveszi), a végződés összetéveszthető karakterek (0/O, 1/I) nélkül. A régi kódok (ANNA, ANNA2) változatlanul működnek.
const DIGITS = '23456789', LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
const suffix = () => `${pick(DIGITS)}${pick(LETTERS)}${pick(DIGITS)}`
export { displayCode } from './referralCode'

/** A tulaj ajánló kódja (ha még nincs, most készül: keresztnév + véletlen végződés, pl. ANNA-7K2). */
export async function getOrCreateCode(userId: number | string, name: string | null | undefined): Promise<string> {
  const id = Number(userId)
  const found = await authQuery<{ code: string }>(sql`SELECT code FROM referral_codes WHERE user_id = ${id}`)
  if (found[0]) return found[0].code
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  // magyar sorrend: a keresztnév a végén
  const base = (clean(parts[parts.length - 1] ?? '') || 'PARTNER').slice(0, 12)
  for (let i = 0; i < 50; i++) {
    const code = `${base.slice(0, 9)}${suffix()}`
    const rows = await authQuery<{ code: string }>(sql`INSERT INTO referral_codes (user_id, code) VALUES (${id}, ${code}) ON CONFLICT DO NOTHING RETURNING code`)
    if (rows[0]) return rows[0].code
    const again = await authQuery<{ code: string }>(sql`SELECT code FROM referral_codes WHERE user_id = ${id}`)
    if (again[0]) return again[0].code
  }
  throw new Error('referral code exhausted')
}

/** Kié a kód (a regisztráció „X ajánlott” sávjához). */
export async function resolveCode(payload: Payload, raw: string | null | undefined): Promise<{ userId: number; code: string; by: string } | null> {
  const code = normalizeCode(raw)
  if (!code) return null
  const rows = await authQuery<{ user_id: number }>(sql`SELECT user_id FROM referral_codes WHERE code = ${code}`)
  if (!rows[0]) return null
  const u = await payload.findByID({ collection: 'users', id: rows[0].user_id, depth: 1, overrideAccess: true }).catch(() => null) as { name?: string | null; salon?: unknown; restaurant?: unknown } | null
  if (!u) return null
  const place = [u.salon, u.restaurant].find((p) => p && typeof p === 'object') as { name?: string } | undefined
  return { userId: rows[0].user_id, code, by: place?.name || u.name || 'Egy partnerünk' }
}

export async function countClick(raw: string): Promise<boolean> {
  const code = normalizeCode(raw)
  if (!code) return false
  const rows = await authQuery<{ code: string }>(sql`UPDATE referral_codes SET clicks = clicks + 1 WHERE code = ${code} RETURNING code`)
  return !!rows[0]
}

/** Új fióknál: az ajánlás rögzítése (ha a kód érvényes, nem saját, és a meghívott tényleg új). `wasKnown`: az e-mail
 *  már szerepelt a próbaidő-nyilvántartásban a regisztráció ELŐTT. */
export async function recordReferral(payload: Payload, opts: { code: string | null | undefined; referredUserId: number | string; referredName: string; wasKnown: boolean }): Promise<void> {
  try {
    if (opts.wasKnown) return
    const ref = await resolveCode(payload, opts.code)
    if (!ref || ref.userId === Number(opts.referredUserId)) return
    await authQuery(sql`INSERT INTO referrals (referrer_user_id, referred_user_id, referred_name, code)
      VALUES (${ref.userId}, ${Number(opts.referredUserId)}, ${opts.referredName.slice(0, 120)}, ${ref.code}) ON CONFLICT DO NOTHING`)
  } catch (e) { console.error('[referrals] record failed:', e) }
}

/** Járt-e már ez az e-mail nálunk (próbaidő-nyilvántartás) — a regisztráció ELŐTT kell megnézni. */
export async function emailWasKnown(payload: Payload, email: string): Promise<boolean> {
  const r = await payload.find({ collection: 'trial-ledger', where: { email: { equals: email.toLowerCase().trim() } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => null)
  return !!r?.docs.length
}

/** 1 hónapnyi jóváírás a fiók Stripe-egyenlegére (a saját havidíja). false: nincs még Stripe-ügyfele / díja. */
async function creditOneMonth(payload: Payload, userId: number, reason: string): Promise<boolean> {
  const stripe = getStripe()
  if (!stripe) return false
  const res = await payload.find({ collection: 'subscriptions', where: { owner: { equals: userId } }, limit: 1, depth: 0, overrideAccess: true })
  const sub = res.docs[0] as Subscription | undefined
  const amount = Math.round(Number(sub?.amount_huf ?? 0))
  if (!sub?.stripe_customer_id || amount <= 0) return false
  await stripe.customers.createBalanceTransaction(sub.stripe_customer_id, { amount: -hufToStripeMinor(amount), currency: 'huf', description: reason })
  return true
}

/**
 * A Stripe checkout kész (webhook): ha a fiók egy ajánlás meghívottja és most fizet ELŐSZÖR, az ajánlás „előfizetett”,
 * és az AJÁNLÓ kap 1 hónapot (a meghívott nem); közben a fiók (ajánlóként) függőben lévő jóváírásai is most kerülnek rá. Idempotens
 * (a jóváírás időpontja jelzi, mi ment már ki); a hibája nem buktatja a webhookot.
 */
/** Egy jóváírás „lefoglalása” atomikusan (ugyanaz az esemény kétszer se írjon jóvá kétszer), hiba / nincs még
 *  Stripe-ügyfél esetén visszaengedve. */
async function claimCredit(payload: Payload, id: number, col: 'referred_credited_at' | 'referrer_credited_at', who: number, reason: string): Promise<boolean> {
  const got = col === 'referred_credited_at'
    ? await authQuery(sql`UPDATE referrals SET referred_credited_at = now() WHERE id = ${id} AND referred_credited_at IS NULL RETURNING id`)
    : await authQuery(sql`UPDATE referrals SET referrer_credited_at = now() WHERE id = ${id} AND referrer_credited_at IS NULL RETURNING id`)
  if (!got.length) return true
  const ok = await creditOneMonth(payload, who, reason).catch((e) => { console.error('[referrals] credit failed:', e); return false })
  if (!ok) {
    if (col === 'referred_credited_at') await authQuery(sql`UPDATE referrals SET referred_credited_at = NULL WHERE id = ${id}`)
    else await authQuery(sql`UPDATE referrals SET referrer_credited_at = NULL WHERE id = ${id}`)
  }
  return ok
}

export async function rewardReferralsOnCheckout(payload: Payload, ourSubId: string | number): Promise<void> {
  try {
    const sub = await payload.findByID({ collection: 'subscriptions', id: ourSubId, depth: 0, overrideAccess: true }) as Subscription
    const userId = Number(typeof sub.owner === 'object' ? sub.owner?.id : sub.owner)
    if (!userId) return
    const claim = (id: number, col: 'referred_credited_at' | 'referrer_credited_at', who: number, reason: string) => claimCredit(payload, id, col, who, reason)

    // a fiók mint meghívott
    const mine = await authQuery<{ id: number; referrer_user_id: number }>(sql`SELECT id, referrer_user_id FROM referrals WHERE referred_user_id = ${userId}`)
    const r = mine[0]
    if (r) {
      await authQuery(sql`UPDATE referrals SET status = 'subscribed', subscribed_at = COALESCE(subscribed_at, now()) WHERE id = ${r.id}`)
      await claim(r.id, 'referrer_credited_at', r.referrer_user_id, 'Ajánló program — 1 hónap ajándék (ajánló)')
    }

    // a fiók mint ajánló: a korábban (próbaidő alatt) függőben maradt jóváírások
    const pending = await authQuery<{ id: number }>(sql`SELECT id FROM referrals WHERE referrer_user_id = ${userId} AND status = 'subscribed' AND referrer_credited_at IS NULL`)
    for (const p of pending) if (!(await claim(p.id, 'referrer_credited_at', userId, 'Ajánló program — 1 hónap ajándék (ajánló)'))) break
  } catch (e) { console.error('[referrals] reward failed:', e) }
}

export type ReferralSummary = {
  code: string; clicks: number; registered: number; subscribed: number; months: number
  rows: { id: number; name: string; date: string; status: 'credited' | 'subscribed' | 'trial' | 'registered' }[]
}

/** A kártya adatai (Beállítások › Telephelyek). */
export async function referralSummary(payload: Payload, userId: number | string, name: string | null | undefined): Promise<ReferralSummary> {
  const code = await getOrCreateCode(userId, name)
  const [c] = await authQuery<{ clicks: number }>(sql`SELECT clicks FROM referral_codes WHERE user_id = ${Number(userId)}`)
  const rows = await authQuery<{ id: number; referred_user_id: number | null; referred_name: string | null; status: string; created_at: string; referrer_credited_at: string | null }>(
    sql`SELECT id, referred_user_id, referred_name, status, created_at, referrer_credited_at FROM referrals WHERE referrer_user_id = ${Number(userId)} ORDER BY created_at DESC LIMIT 50`)
  // próbaidőn van-e a meghívott (a még nem előfizetetteknél)
  const ids = rows.filter((r) => r.status !== 'subscribed' && r.referred_user_id).map((r) => r.referred_user_id as number)
  const trial = new Set<number>()
  if (ids.length) {
    const subs = await payload.find({ collection: 'subscriptions', where: { and: [{ owner: { in: ids } }, { status: { equals: 'trialing' } }] }, limit: ids.length, depth: 0, overrideAccess: true }).catch(() => null)
    for (const s of (subs?.docs ?? []) as Subscription[]) trial.add(Number(typeof s.owner === 'object' ? s.owner?.id : s.owner))
  }
  const subscribed = rows.filter((r) => r.status === 'subscribed').length
  return {
    code,
    clicks: Math.max(Number(c?.clicks ?? 0), rows.length),
    registered: rows.length,
    subscribed,
    months: subscribed,
    rows: rows.map((r) => ({
      id: r.id, name: r.referred_name || 'Új vállalkozás', date: String(r.created_at),
      status: r.status === 'subscribed' ? (r.referrer_credited_at ? 'credited' : 'subscribed') : r.referred_user_id && trial.has(r.referred_user_id) ? 'trial' : 'registered',
    })),
  }
}

/* ── Backstage (admin) ── */

export type ReferralAdminRow = {
  id: number; referrerId: number; referrer: string; invitedId: number | null; invited: string; code: string
  createdAt: string; status: 'registered' | 'trial' | 'subscribed'; creditedAt: string | null
}

/** Az összes ajánlás az admin listához (legfrissebb elöl) + a link-megnyitások összesen. */
export async function referralAdminList(payload: Payload): Promise<{ rows: ReferralAdminRow[]; clicks: number }> {
  const rows = await authQuery<{ id: number; referrer_user_id: number; referred_user_id: number | null; referred_name: string | null; code: string; status: string; created_at: string; referrer_credited_at: string | null }>(
    sql`SELECT id, referrer_user_id, referred_user_id, referred_name, code, status, created_at, referrer_credited_at FROM referrals ORDER BY created_at DESC LIMIT 200`)
  const [c] = await authQuery<{ n: number }>(sql`SELECT COALESCE(SUM(clicks), 0)::int AS n FROM referral_codes`)
  const userIds = [...new Set(rows.flatMap((r) => [r.referrer_user_id, r.referred_user_id ?? 0]).filter(Boolean))]
  const names = new Map<number, string>()
  const trial = new Set<number>()
  if (userIds.length) {
    const [users, subs] = await Promise.all([
      payload.find({ collection: 'users', where: { id: { in: userIds } }, limit: userIds.length, depth: 1, overrideAccess: true }).catch(() => null),
      payload.find({ collection: 'subscriptions', where: { and: [{ owner: { in: userIds } }, { status: { equals: 'trialing' } }] }, limit: userIds.length, depth: 0, overrideAccess: true }).catch(() => null),
    ])
    for (const u of (users?.docs ?? []) as { id: number; name?: string | null; email?: string | null; salon?: unknown; restaurant?: unknown }[]) {
      const place = [u.salon, u.restaurant].find((p) => p && typeof p === 'object') as { name?: string } | undefined
      names.set(Number(u.id), place?.name || u.name || u.email || '—')
    }
    for (const s of (subs?.docs ?? []) as Subscription[]) trial.add(Number(typeof s.owner === 'object' ? s.owner?.id : s.owner))
  }
  return {
    clicks: Number(c?.n ?? 0),
    rows: rows.map((r) => ({
      id: r.id, referrerId: r.referrer_user_id, referrer: names.get(r.referrer_user_id) ?? '—',
      invitedId: r.referred_user_id, invited: (r.referred_user_id && names.get(r.referred_user_id)) || r.referred_name || '—',
      code: r.code, createdAt: r.created_at, creditedAt: r.referrer_credited_at,
      status: r.status === 'subscribed' ? 'subscribed' : r.referred_user_id && trial.has(r.referred_user_id) ? 'trial' : 'registered',
    })),
  }
}

/** Elakadt ajánlói jóváírás kézi pótlása (az ajánló +1 hónapja). false: még most sem sikerült (nincs Stripe-ügyfele / díja). */
export async function retryReferrerCredit(payload: Payload, referralId: number): Promise<boolean> {
  const [r] = await authQuery<{ id: number; referrer_user_id: number; status: string }>(sql`SELECT id, referrer_user_id, status FROM referrals WHERE id = ${referralId}`)
  if (!r || r.status !== 'subscribed') return false
  return claimCredit(payload, r.id, 'referrer_credited_at', r.referrer_user_id, 'Ajánló program — 1 hónap ajándék (ajánló)')
}

/** Egy fiók ajánlásai a Backstage-profilhoz: ki hozta (ha ajánlással jött), kiket hozott, hány +1 hónapot kapott. */
export async function referralFactsFor(payload: Payload, userId: number | string): Promise<{ by: { id: number; name: string } | null; invited: { id: number | null; name: string; subscribed: boolean }[]; credited: number }> {
  const uid = Number(userId)
  const rows = await authQuery<{ referrer_user_id: number; referred_user_id: number | null; referred_name: string | null; status: string; referrer_credited_at: string | null }>(
    sql`SELECT referrer_user_id, referred_user_id, referred_name, status, referrer_credited_at FROM referrals WHERE referrer_user_id = ${uid} OR referred_user_id = ${uid} ORDER BY created_at DESC LIMIT 50`)
  const byRow = rows.find((r) => r.referred_user_id === uid)
  let by: { id: number; name: string } | null = null
  if (byRow) {
    const u = await payload.findByID({ collection: 'users', id: byRow.referrer_user_id, depth: 1, overrideAccess: true }).catch(() => null) as { name?: string | null; email?: string | null; salon?: unknown; restaurant?: unknown } | null
    const place = u && ([u.salon, u.restaurant].find((p) => p && typeof p === 'object') as { name?: string } | undefined)
    by = { id: byRow.referrer_user_id, name: place?.name || u?.name || u?.email || '—' }
  }
  const mine = rows.filter((r) => r.referrer_user_id === uid)
  return {
    by,
    invited: mine.map((r) => ({ id: r.referred_user_id, name: r.referred_name || '—', subscribed: r.status === 'subscribed' })),
    credited: mine.filter((r) => r.referrer_credited_at).length,
  }
}
