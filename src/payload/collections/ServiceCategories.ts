import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'
import { userOwnsSalon, canCreateForOwnSalon } from '../lib/salonOwnerAccess'

export const ServiceCategories: CollectionConfig = {
  slug: 'service-categories',
  hooks: {
    afterChange: [revalidateChildOnChange('salon', 'salon')],
    afterDelete: [revalidateChildOnDelete('salon', 'salon')],
  },
  labels: { singular: 'Szolgáltatás kategória', plural: 'Szolgáltatás kategóriák' },
  admin: {
    group: 'Szalon',
    useAsTitle: 'name',
    defaultColumns: ['name', 'salon', 'duration_label'],
    hidden: true,
  },
  access: {
    read: () => true,
    create: canCreateForOwnSalon,
    // Több-üzlet: csak a kategória szalonjának TULAJDONOSA (vagy admin) módosíthat/törölhet —
    // különben bármely bejelentkezett user más szalon kategóriáihoz nyúlhatna (IDOR).
    update: async ({ req, id, data }) => {
      if (req.user?.role === 'admin') return true
      if (id) {
        const doc = await req.payload.findByID({ collection: 'service-categories', id, depth: 0, overrideAccess: true, req }).catch(() => null)
        return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
      }
      return userOwnsSalon(req, data?.salon as number | string | undefined)
    },
    delete: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = await req.payload.findByID({ collection: 'service-categories', id, depth: 0, overrideAccess: true, req }).catch(() => null)
      return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
      label: 'Kategória neve',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Borítókép',
    },
    {
      name: 'duration_label',
      type: 'text',
      localized: true,
      label: 'Időtartam felirat',
      admin: {
        placeholder: 'Pl. 30-90 perc',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      label: 'Leírás',
    },
    {
      name: 'sort_order',
      type: 'number',
      label: 'Sorrend',
      defaultValue: 0,
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      required: true,
    },
  ],
  timestamps: true,
}
