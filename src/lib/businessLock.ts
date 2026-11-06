import type { Payload } from 'payload'
import { findAccountSubscription } from './accountSubscription'
import { expireOneTrial } from './subscriptionSync'

/**
 * Zárolt-e az üzlet (a FIÓK előfizetése szerint — ugyanaz a szabály, mint a dashboard zárja: `past_due` / `canceled` /
 * `paused`). Zárolt üzletnél a foglalóoldal nem fogad új online foglalást, várólistát, előleget és utalvány-vásárlást
 * (design 21.13) — különben a vendég foglalna, a tulaj pedig a zárolt dashboardon nem látná. A lejárt próbaidőt itt is
 * átbillenti (`expireOneTrial`), hogy ne kelljen a tulaj belépésére várni. Előfizetés-rekord nélkül: nem zárolt.
 */
export const LOCKED_STATUSES = new Set(['past_due', 'canceled', 'paused'])

export async function isBusinessLocked(payload: Payload, owner: unknown): Promise<boolean> {
  const ownerId = owner && typeof owner === 'object' ? (owner as { id?: string | number }).id : (owner as string | number | null | undefined)
  if (ownerId == null) return false
  const sub = await expireOneTrial(await findAccountSubscription({ payload }, ownerId).catch(() => null)).catch(() => null)
  return !!sub && LOCKED_STATUSES.has(sub.status)
}

/** A vendégnek adott válasz zárolt üzletnél (nem mondja meg, miért — az az üzlet dolga). */
export const LOCKED_ERROR = 'Az online foglalás most szünetel ennél a helynél. Kérjük, keresd őket telefonon.'
