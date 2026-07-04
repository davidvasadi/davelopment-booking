import { cookies } from 'next/headers'
import { getPayloadClient } from './payload'
import { resolveTier, type Tier } from './tier'
import type { User, Salon, Restaurant, Media, Membership } from '@/payload/payload-types'

/**
 * Több-üzlet (multi-tenant) aktív-üzlet feloldás.
 *
 * Egy felhasználónak tetszőleges számú étterme ÉS szalonja lehet (a `Salon.owner` /
 * `Restaurant.owner` → users reláció már 1:N). Ezt egységes "business" absztrakcióként
 * kezeljük: `{ type, id, name, slug, logoUrl }`.
 *
 * Az AKTÍV üzlet feloldási sorrendje (lásd docs/multi-business-plan.md):
 *   1. `schedulio_active_business` cookie  ("<type>:<id>")
 *   2. `User.last_active_business` DB-mező (cookie törlését túléli)
 *   3. az első üzlet (createdAt szerint)
 * Ha a tárolt érték már nem a useré (eladott/törölt üzlet), a következő forrásra esünk.
 */

export const ACTIVE_BUSINESS_COOKIE = 'schedulio_active_business'

export type BusinessType = 'restaurant' | 'salon'

export interface Business {
  type: BusinessType
  id: string
  name: string
  slug: string
  logoUrl: string | null
  createdAt: string
  /** Az üzlet csomagja (Start/Pro), feloldva — a régi null tier Pro-ként jön. */
  tier: Tier
}

const logoUrlOf = (logo: string | Media | null | undefined): string | null =>
  typeof logo === 'object' && logo?.url ? logo.url : null

/** A felhasználó összes üzlete (étterem + szalon), createdAt szerint növekvőn. */
export async function getUserBusinesses(userId: string | number): Promise<Business[]> {
  const payload = await getPayloadClient()

  const [salons, restaurants, memberships] = await Promise.all([
    payload.find({
      collection: 'salons',
      where: { owner: { equals: userId } },
      limit: 100,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'restaurants',
      where: { owner: { equals: userId } },
      limit: 100,
      depth: 1,
      overrideAccess: true,
    }),
    // Tagként (membership) elért üzletek — hogy a MEGHÍVOTT+elfogadott tag is lássa a dashboardot,
    // ne csak a tulaj. Csak az AKTÍV tagságok számítanak.
    payload.find({
      collection: 'memberships',
      where: { and: [{ user: { equals: userId } }, { status: { equals: 'active' } }] },
      limit: 100,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  const list: Business[] = [
    ...(salons.docs as Salon[]).map((s) => ({
      type: 'salon' as const,
      id: String(s.id),
      name: s.name,
      slug: s.slug,
      logoUrl: logoUrlOf(s.logo),
      createdAt: s.createdAt,
      tier: resolveTier(s.tier),
    })),
    ...(restaurants.docs as Restaurant[]).map((r) => ({
      type: 'restaurant' as const,
      id: String(r.id),
      name: r.name,
      slug: r.slug,
      logoUrl: logoUrlOf(r.logo),
      createdAt: r.createdAt,
      tier: resolveTier(r.tier),
    })),
  ]

  // Membershipek hozzáfűzése (duplikátum nélkül — ha a user egyben tulaj is).
  const seen = new Set(list.map((b) => `${b.type}:${b.id}`))
  for (const m of memberships.docs as Membership[]) {
    const s = m.salon && typeof m.salon === 'object' ? (m.salon as Salon) : null
    const r = m.restaurant && typeof m.restaurant === 'object' ? (m.restaurant as Restaurant) : null
    if (s && !seen.has(`salon:${s.id}`)) {
      seen.add(`salon:${s.id}`)
      list.push({ type: 'salon', id: String(s.id), name: s.name, slug: s.slug, logoUrl: logoUrlOf(s.logo), createdAt: s.createdAt, tier: resolveTier(s.tier) })
    }
    if (r && !seen.has(`restaurant:${r.id}`)) {
      seen.add(`restaurant:${r.id}`)
      list.push({ type: 'restaurant', id: String(r.id), name: r.name, slug: r.slug, logoUrl: logoUrlOf(r.logo), createdAt: r.createdAt, tier: resolveTier(r.tier) })
    }
  }

  return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** "<type>:<id>" kulcsból megkeresi az üzletet a listában (vagy null). */
function resolveKey(key: string | null | undefined, list: Business[]): Business | null {
  if (!key) return null
  const [type, id] = key.split(':')
  if (type !== 'restaurant' && type !== 'salon') return null
  return list.find((b) => b.type === type && b.id === id) ?? null
}

export const businessKey = (b: Pick<Business, 'type' | 'id'>) => `${b.type}:${b.id}`

export interface ActiveBusinessResult {
  /** A feloldott aktív üzlet, vagy null ha a usernek egy üzlete sincs. */
  active: Business | null
  /** A felhasználó összes üzlete (a switcherhez). */
  businesses: Business[]
}

/**
 * Az aktív üzlet + a teljes lista feloldása a fenti sorrend szerint.
 * Csak olvas (nem ír cookie-t/DB-t) — szerver-komponensekben biztonságosan hívható.
 */
export async function getActiveBusiness(user: User): Promise<ActiveBusinessResult> {
  const businesses = await getUserBusinesses(user.id)
  if (businesses.length === 0) return { active: null, businesses }

  const cookieStore = await cookies()
  const cookieVal = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value

  const active =
    resolveKey(cookieVal, businesses) ??
    resolveKey(user.last_active_business, businesses) ??
    businesses[0]

  return { active, businesses }
}
