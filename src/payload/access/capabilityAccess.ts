import type { Access, Where } from 'payload'
import { can, effectiveCapabilities, type Capability, type TeamRole } from '@/lib/permissions'
import { capabilitiesForBusiness } from '@/lib/apiCapability'
import type { Membership, Role } from '@/payload/payload-types'

/**
 * Kapacitás-tudatos Access-gyár üzlet-gyermek collectionökhöz (services, tables, opening-hours,
 * reservations stb.) — a régi, tisztán-tulajdonos ellenőrzések (`ownsThisSalon`/
 * `isRestaurantOwnerOrAdmin`) általánosítása: owner MINDIG mindent lát/szerkeszt (változatlan),
 * egy TAG viszont csak akkor, ha az adott üzletben ténylegesen megvan nála a kért capability
 * (a saját egyedi szerepéből) — enélkül a "Csapat & jogok"-ban kipipálható jogok egy része
 * (`catalog.manage`, `tables.manage` stb.) semmit nem csinált, mert ez a réteg fittyet hányt rá.
 *
 * `Where`-szűrőt ad vissza — a `restaurantAccess.ts` már bevált mintáját követve ugyanaz a
 * függvény használható `read`/`update`/`delete` access-ként is (nincs szükség külön, doc-onkénti
 * lekérdezésre). A `relationField` a rekord üzlet-relációjának mezőneve (pl. 'salon'/'restaurant').
 */
export function capabilityScoped(
  type: 'salon' | 'restaurant',
  relationField: string,
  capability: Capability | Capability[],
): Access {
  const capabilities = Array.isArray(capability) ? capability : [capability]
  return async ({ req }) => {
    if (!req.user) return false
    if (req.user.role === 'admin') return true

    const collection = type === 'salon' ? 'salons' : 'restaurants'
    const owned = await req.payload.find({
      collection,
      where: { owner: { equals: req.user.id } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const ownedIds: (string | number)[] = owned.docs.map((b) => b.id)

    const memberships = await req.payload.find({
      collection: 'memberships',
      where: { and: [{ user: { equals: req.user.id } }, { status: { equals: 'active' } }, { [type]: { exists: true } }] },
      limit: 200,
      depth: 1,
      overrideAccess: true,
      req,
    })
    const grantedIds: (string | number)[] = []
    for (const m of memberships.docs as Membership[]) {
      const biz = type === 'salon' ? m.salon : m.restaurant
      const bizId = biz && typeof biz === 'object' ? biz.id : biz
      if (bizId == null) continue
      const custom = m.custom_role && typeof m.custom_role === 'object' ? (m.custom_role as Role) : null
      const caps = effectiveCapabilities((m.role ?? 'staff') as TeamRole, (custom?.capabilities as Capability[] | undefined) ?? null)
      if (capabilities.some((c) => can(caps, c))) grantedIds.push(bizId)
    }

    const allowedIds = [...ownedIds, ...grantedIds]
    if (!allowedIds.length) return false
    return { [relationField]: { in: allowedIds } } as Where
  }
}

/**
 * CREATE-access: a Where-szűrő create-nél nem érvényesül, ezért a beküldött
 * `data[relationField]`-re pontszerű ellenőrzés kell (különben bárki más üzletéhez írhatna: IDOR).
 */
export function capabilityCreate(
  type: 'salon' | 'restaurant',
  relationField: string,
  capability: Capability,
): Access {
  return async ({ req, data }) => {
    if (!req.user) return false
    if (req.user.role === 'admin') return true
    const raw = data?.[relationField]
    const bizId = raw && typeof raw === 'object' ? (raw as { id: string | number }).id : (raw as string | number | undefined)
    if (bizId == null) return false
    const caps = await capabilitiesForBusiness(req.user.id, type, bizId)
    return !!caps && can(caps, capability)
  }
}
