import type { CollectionConfig, Access, Where } from 'payload'

/**
 * Értékelések (reviews). A vendég a foglalás után egy publikus, token-alapú oldalon
 * ad 1–5 csillagot + szöveget. A CREATE nyilvános (a token azonosítja a foglalást,
 * a beküldő route validál — nem ezen az access-en át), a READ csak a tulaj/admin.
 *
 * Szalon (bookings) ÉS étterem (reservations) is használja: a `salon`/`restaurant`
 * reláció opcionális, a token oldja fel melyik.
 */
const isOwnerOrAdmin: Access = async ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true

  // A tulaj szalonjai + éttermei
  const [salons, restaurants] = await Promise.all([
    req.payload.find({ collection: 'salons', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
    req.payload.find({ collection: 'restaurants', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  const or: Where[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  if (or.length === 0) return false
  return { or }
}

import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  hooks: {
    afterChange: [auditAfterChange('Értékelés', 'auto')],
    afterDelete: [auditAfterDelete('Értékelés', 'auto')],
  },
  labels: { singular: 'Értékelés', plural: 'Értékelések' },
  admin: {
    useAsTitle: 'customer_name',
    defaultColumns: ['rating', 'customer_name', 'comment', 'createdAt'],
    group: 'Közös',
    hidden: true,
  },
  access: {
    // A beküldő route overrideAccess-szel hoz létre; a nyilvános create marad true,
    // de a route validálja a tokent (nem lehet tetszőleges beküldés).
    create: () => true,
    read: isOwnerOrAdmin,
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  fields: [
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', label: 'Étterem' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', label: 'Szalon' },
    { name: 'reservation', type: 'relationship', relationTo: 'reservations', label: 'Asztalfoglalás' },
    { name: 'booking', type: 'relationship', relationTo: 'bookings', label: 'Foglalás' },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      label: 'Csillag (1–5)',
    },
    { name: 'comment', type: 'textarea', label: 'Vélemény' },
    { name: 'customer_name', type: 'text', label: 'Vendég neve' },
  ],
  timestamps: true,
}
