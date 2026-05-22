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
