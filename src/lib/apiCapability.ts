import type { Where } from 'payload'
import { getPayloadClient } from './payload'
import { can, effectiveCapabilities, ALL_CAPABILITIES, type Capability, type TeamRole } from './permissions'
import type { Membership, Role } from '@/payload/payload-types'

/**
 * API-oldali RBAC (C3). Feloldja a user HATÉKONY képesség-halmazát az adott üzletben és
 * a `can()`-nal dönt. A hatékony halmaz: owner → minden; tagság → a beépített szerep mátrixa,
 * VAGY (2. fázis) az egyedi szerep (`custom_role`) saját `capabilities`-e.
 */
export async function capabilitiesForBusiness(
  userId: string | number,
  type: 'salon' | 'restaurant',
  businessId: string | number,
): Promise<Capability[] | null> {
  const payload = await getPayloadClient()
  const collection = type === 'salon' ? 'salons' : 'restaurants'
  const biz = await payload
    .findByID({ collection, id: businessId as string, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!biz) return null

  const ownerId = typeof biz.owner === 'object' && biz.owner ? biz.owner.id : biz.owner
  if (String(ownerId) === String(userId)) return ALL_CAPABILITIES

  const mem = await payload.find({
    collection: 'memberships',
    where: {
      and: [{ user: { equals: userId } }, { status: { equals: 'active' } }, { [type]: { equals: businessId } }],
    } as Where,
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const m = mem.docs[0] as Membership | undefined
  if (!m) return null

  // Egyedi szerep (2. fázis): ha van, a saját képesség-listája dönt.
  const custom = m.custom_role && typeof m.custom_role === 'object' ? (m.custom_role as Role) : null
  const customCaps = (custom?.capabilities as Capability[] | undefined) ?? null
  return effectiveCapabilities((m.role ?? 'staff') as TeamRole, customCaps)
}

/** Igaz-e, hogy a user az üzlet TULAJDONOSA (nem csak egyedi szerepen át kapott "minden jogot")? */
export async function isBusinessOwner(
  userId: string | number,
  type: 'salon' | 'restaurant',
  businessId: string | number,
): Promise<boolean> {
  const payload = await getPayloadClient()
  const collection = type === 'salon' ? 'salons' : 'restaurants'
  const biz = await payload
    .findByID({ collection, id: businessId as string, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!biz) return false
  const ownerId = typeof biz.owner === 'object' && biz.owner ? biz.owner.id : biz.owner
  return String(ownerId) === String(userId)
}

/**
 * Mint `assertCapability`, de a TULAJDONOSHOZ köti (nem jogosultsághoz) — a szerep-DEFINÍCIÓK
 * létrehozása/szerkesztése/törlése szándékosan owner-only: egy `team.manage`-es, nem-tulaj tag
 * különben önmagának/másnak korlátlanul újabb `team.manage`-es (vagy bármilyen, saját maga
 * birtokolta) jogú szerepet gyárthatna — a meglévő anti-eszkalációs szűrő ezt nem zárja ki,
 * csak azt, hogy OLYAN jogot adjon, amivel ő maga nem rendelkezik.
 */
export async function assertOwner(
  userId: string | number,
  type: 'salon' | 'restaurant',
  businessId: string | number | null | undefined,
): Promise<{ error: string; status: number } | null> {
  if (!businessId) return { error: 'Hiányzó üzlet', status: 400 }
  const owner = await isBusinessOwner(userId, type, businessId)
  if (!owner) return { error: 'Csak a tulajdonos végezheti el ezt a műveletet', status: 403 }
  return null
}

/**
 * Teheti-e a user a képességet az adott üzletben? `{ error, status }` ha NEM, `null` ha szabad.
 */
export async function assertCapability(
  userId: string | number,
  type: 'salon' | 'restaurant',
  businessId: string | number | null | undefined,
  capability: Capability,
): Promise<{ error: string; status: number } | null> {
  if (!businessId) return { error: 'Hiányzó üzlet', status: 400 }
  const caps = await capabilitiesForBusiness(userId, type, businessId)
  if (!caps) return { error: 'Nincs jogosultság ehhez az üzlethez', status: 403 }
  if (!can(caps, capability)) return { error: 'Ehhez nincs jogosultságod', status: 403 }
  return null
}

/**
 * Mint `assertCapability`, de OR logikával — a lista ELEMEINEK bármelyike elég. Olyan
 * olvasó (GET) route-okhoz kell, ahol a `.manage` jog magában is elegendő kéne legyen (pl. aki
 * kampányt küldhet, az a feliratkozó-listát is lássa `.view` nélkül is) — a `.manage` NEM
 * implikálja automatikusan a `.view`-t a `can()`-ban, ezt itt, a hívási oldalon explicit kezeljük.
 */
export async function assertAnyCapability(
  userId: string | number,
  type: 'salon' | 'restaurant',
  businessId: string | number | null | undefined,
  capabilities: Capability[],
): Promise<{ error: string; status: number } | null> {
  if (!businessId) return { error: 'Hiányzó üzlet', status: 400 }
  const caps = await capabilitiesForBusiness(userId, type, businessId)
  if (!caps) return { error: 'Nincs jogosultság ehhez az üzlethez', status: 403 }
  if (!capabilities.some((c) => can(caps, c))) return { error: 'Ehhez nincs jogosultságod', status: 403 }
  return null
}
