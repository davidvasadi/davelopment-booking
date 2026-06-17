import type { Access } from 'payload'

/**
 * Étterem-gyermek collectionökhöz (rooms, tables, opening-hours, reservations).
 * Csak az étterem tulajdonosa (vagy admin) írhatja a saját étterméhez tartozó rekordokat.
 * A rekordok `restaurant` relációval kötődnek az étteremhez; a szűrő a tulajdonos
 * éttermeire korlátoz.
 */
export const isRestaurantOwnerOrAdmin: Access = async ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true

  // A tulajdonos éttermeinek id-jai
  const owned = await req.payload.find({
    collection: 'restaurants',
    where: { owner: { equals: req.user.id } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const ids = owned.docs.map((r) => r.id)
  if (ids.length === 0) return false

  return { restaurant: { in: ids } }
}

/**
 * CREATE-access az étterem-gyermek collectionökhöz: a where-filter create-nél nem érvényesül,
 * ezért a beküldött `data.restaurant`-ot kell ellenőrizni — a user csak a SAJÁT étterméhez
 * hozhat létre rekordot (különben bárki más étterméhez írhatna: IDOR).
 */
export const canCreateForOwnRestaurant: Access = async ({ req, data }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  const rid = data?.restaurant && typeof data.restaurant === 'object' ? data.restaurant.id : data?.restaurant
  if (rid == null) return false
  const r = await req.payload.findByID({ collection: 'restaurants', id: rid, depth: 0, overrideAccess: true, req }).catch(() => null)
  const ownerId = r?.owner && typeof r.owner === 'object' ? (r.owner as { id: number | string }).id : r?.owner
  return String(ownerId) === String(req.user.id)
}
