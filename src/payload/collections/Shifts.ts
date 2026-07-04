import { CollectionConfig, PayloadRequest, Access, Where } from 'payload'
import { userOwnsSalon } from '../lib/salonOwnerAccess'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

/**
 * Birtokolja-e a user a rekord ÉTTERMÉT? (Az étterem-műszakok `member`+`restaurant`
 * párost használnak; a tulaj-hozzáférés az `restaurant.owner`-en át.)
 */
async function userOwnsRestaurant(
  req: PayloadRequest,
  restaurantId: number | string | { id: number | string } | null | undefined,
): Promise<boolean> {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  const rid = restaurantId && typeof restaurantId === 'object' ? restaurantId.id : restaurantId
  if (rid == null) return false
  try {
    const r = await req.payload.findByID({ collection: 'restaurants', id: rid, depth: 0, overrideAccess: true, req })
    const ownerId = r?.owner && typeof r.owner === 'object' ? (r.owner as { id: number | string }).id : r?.owner
    return String(ownerId) === String(req.user.id)
  } catch {
    return false
  }
}

/**
 * BEOSZTÁS / HR — egy dolgozó egy naphoz kötött bejegyzése: műszak, szabadság,
 * betegszabadság vagy fizetett szabadság. A SZALON dashboard „Beosztás" moduljának
 * adatforrása (staff+salon), ÉS az ÉTTEREM „Beosztás" moduljáé (member+restaurant).
 * Egy műszak vagy (salon+staff) VAGY (restaurant+member).
 * Access: a tulaj/admin a SAJÁT szalonjaira/éttermeire; kívülálló semmit.
 */
export const Shifts: CollectionConfig = {
  slug: 'shifts',
  labels: { singular: 'Beosztás', plural: 'Beosztások' },
  hooks: {
    afterChange: [auditAfterChange('Beosztás', 'auto')],
    afterDelete: [auditAfterDelete('Beosztás', 'auto')],
  },
  admin: {
    group: 'Közös',
    useAsTitle: 'date',
    defaultColumns: ['staff', 'member', 'salon', 'restaurant', 'date', 'type', 'start_time', 'end_time'],
    hidden: true,
  },
  access: {
    read: (async ({ req }) => {
      if (req.user?.role === 'admin') return true
      if (!req.user) return false
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
    }) as Access,
    create: async ({ req, data }) => {
      if (req.user?.role === 'admin') return true
      if (!req.user) return false
      if (data?.restaurant) return userOwnsRestaurant(req, data.restaurant as number | string)
      return userOwnsSalon(req, data?.salon as number | string | undefined)
    },
    update: async ({ req, id, data }) => {
      if (req.user?.role === 'admin') return true
      if (!req.user) return false
      const doc = id
        ? ((await req.payload.findByID({ collection: 'shifts', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as { salon?: number | string; restaurant?: number | string } | null)
        : null
      const salon = doc?.salon ?? (data?.salon as number | string | undefined)
      const restaurant = doc?.restaurant ?? (data?.restaurant as number | string | undefined)
      if (restaurant) return userOwnsRestaurant(req, restaurant)
      return userOwnsSalon(req, salon)
    },
    delete: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = (await req.payload.findByID({ collection: 'shifts', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as { salon?: number | string; restaurant?: number | string } | null
      if (doc?.restaurant) return userOwnsRestaurant(req, doc.restaurant)
      return userOwnsSalon(req, doc?.salon)
    },
  },
  fields: [
    {
      name: 'staff',
      type: 'relationship',
      relationTo: 'staff',
      hasMany: false,
      label: 'Dolgozó (szalon)',
      admin: { description: 'Szalon-műszakhoz kötelező; étterem-műszaknál üres.' },
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      label: 'Szalon',
    },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'memberships',
      hasMany: false,
      label: 'Csapattag (étterem)',
      admin: { description: 'Étterem-műszakhoz kötelező; szalon-műszaknál üres.' },
    },
    {
      name: 'restaurant',
      type: 'relationship',
      relationTo: 'restaurants',
      hasMany: false,
      label: 'Étterem',
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      label: 'Nap',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy. MM. dd.' } },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'shift',
      label: 'Típus',
      options: [
        { label: 'Műszak', value: 'shift' },
        { label: 'Szabadság', value: 'leave' },
        { label: 'Betegszabadság', value: 'sick' },
        { label: 'Fizetett szabadság', value: 'vacation' },
      ],
    },
    {
      name: 'start_time',
      type: 'text',
      label: 'Kezdés (ÓÓ:PP)',
      admin: { placeholder: '09:00' },
    },
    {
      name: 'end_time',
      type: 'text',
      label: 'Vége (ÓÓ:PP)',
      admin: { placeholder: '17:00' },
    },
    {
      name: 'hours',
      type: 'number',
      label: 'Óraszám',
    },
    {
      name: 'note',
      type: 'text',
      label: 'Megjegyzés',
    },
  ],
  timestamps: true,
}
