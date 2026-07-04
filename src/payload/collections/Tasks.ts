import type { Access, CollectionConfig, PayloadRequest } from 'payload'

/**
 * Napi teendők a hely csapatának. A tulajdonos a saját helye (étterem/szalon) áttekintő
 * oldalán vehet fel feladatot és pipálhatja ki. Minimális modell: cím + kész-flag +
 * opcionális határidő. A hozzáférést a hely tulajdonosa (owner) vagy admin kapja.
 */
async function ownedPlaceFilter(req: PayloadRequest) {
  const user = req.user as ({ id: string | number; role: string } | null | undefined)
  if (!user) return false
  if (user.role === 'admin') return true
  const [salons, restaurants] = await Promise.all([
    req.payload.find({ collection: 'salons', where: { owner: { equals: user.id } }, limit: 200, depth: 0, overrideAccess: true }),
    req.payload.find({ collection: 'restaurants', where: { owner: { equals: user.id } }, limit: 200, depth: 0, overrideAccess: true }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  const or: Record<string, unknown>[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  if (or.length === 0) return false
  return { or }
}

export const Tasks: CollectionConfig = {
  slug: 'tasks',
  labels: { singular: 'Feladat', plural: 'Feladatok' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'done', 'due_date', 'createdAt'],
    group: 'Rendszer',
    hidden: true,
  },
  access: {
    read: (async ({ req }) => ownedPlaceFilter(req)) as Access,
    create: (async ({ req }) => Boolean(req.user)) as Access,
    update: (async ({ req }) => ownedPlaceFilter(req)) as Access,
    delete: (async ({ req }) => ownedPlaceFilter(req)) as Access,
  },
  fields: [
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', index: true, label: 'Étterem' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', index: true, label: 'Szalon' },
    { name: 'title', type: 'text', required: true, label: 'Feladat' },
    { name: 'done', type: 'checkbox', defaultValue: false, index: true, label: 'Kész' },
    { name: 'due_date', type: 'date', label: 'Határidő' },
  ],
  timestamps: true,
}
