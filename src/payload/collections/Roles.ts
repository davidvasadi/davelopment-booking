import type { Access, CollectionConfig, Where } from 'payload'
import { CAPABILITY_META } from '../../lib/permissions'

/**
 * EGYEDI SZEREPEK (2. fázis) — üzletenként (szalon VAGY étterem) definiált jogosultság-szerep,
 * saját `capabilities` listával (pl. „Supervisor"). A membership `custom_role`-ra mutathat; ha van,
 * annak képességei döntenek a beépített owner/manager/staff helyett. A tulaj-hozzáférés nem változik.
 *
 * Access: a tulaj a SAJÁT üzletei szerepeit kezeli (a route-ok overrideAccess-szel + capability-guarddal).
 */
async function ownedBusinessWhere(req: Parameters<Access>[0]['req']): Promise<Where | boolean> {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  const [salons, restaurants] = await Promise.all([
    req.payload.find({ collection: 'salons', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
    req.payload.find({ collection: 'restaurants', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
  ])
  const or: Where[] = []
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  if (or.length === 0) return false
  return { or }
}

const ownerScoped: Access = ({ req }) => ownedBusinessWhere(req)

export const Roles: CollectionConfig = {
  slug: 'roles',
  labels: { singular: 'Szerep', plural: 'Szerepek' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'salon', 'restaurant'],
    group: 'Közös',
    hidden: true,
  },
  access: {
    read: ownerScoped,
    create: ({ req }) => !!req.user,
    update: ownerScoped,
    delete: ownerScoped,
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Szerep neve' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', hasMany: false, label: 'Szalon' },
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', hasMany: false, label: 'Étterem' },
    {
      name: 'capabilities',
      type: 'select',
      hasMany: true,
      label: 'Jogosultságok',
      options: CAPABILITY_META.map((c) => ({ label: c.label, value: c.value })),
      admin: { description: 'Amit ez a szerep tehet. Az „Áttekintés" mindig alap.' },
    },
  ],
  timestamps: true,
}
