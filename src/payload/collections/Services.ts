import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'
import { userOwnsSalon, canCreateForOwnSalon } from '../lib/salonOwnerAccess'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

export const Services: CollectionConfig = {
  slug: 'services',
  hooks: {
    afterChange: [revalidateChildOnChange('salon', 'salon'), auditAfterChange('Szolgáltatás', 'salon')],
    afterDelete: [revalidateChildOnDelete('salon', 'salon'), auditAfterDelete('Szolgáltatás', 'salon')],
  },
  labels: { singular: 'Szolgáltatás', plural: 'Szolgáltatások' },
  admin: {
    group: 'Szalon',
    useAsTitle: 'name',
    defaultColumns: ['name', 'salon', 'duration_minutes', 'price', 'is_active'],
    hidden: true,
  },
  access: {
    read: () => true,
    create: canCreateForOwnSalon,
    update: async ({ req, id, data }) => {
      if (req.user?.role === 'admin') return true
      // Több-üzlet: a rekord szalonjának tulajdonosa lehet a user. Update-nél a meglévő
      // rekord salonját ellenőrizzük (a body nem feltétlenül tartalmazza a salon mezőt);
      // create-validáláskor a data.salon-t.
      if (id) {
        const doc = await req.payload.findByID({ collection: 'services', id, depth: 0, overrideAccess: true, req }).catch(() => null)
        return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
      }
      return userOwnsSalon(req, data?.salon as number | string | undefined)
    },
    delete: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = await req.payload.findByID({ collection: 'services', id, depth: 0, overrideAccess: true, req }).catch(() => null)
      return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
      label: 'Szolgáltatás neve',
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
      label: 'Leírás',
    },
    {
      // A kategória mostantól relationship a service-categories rekordra (a kategória neve
      // lokalizálható, ezért nem lehet szabad-szöveges kulcs). A foglaló a kategória ID-ja
      // szerint csoportosít, a megjelenített nevet a (localizáltan betöltött) kategória adja.
      name: 'category',
      type: 'relationship',
      relationTo: 'service-categories',
      hasMany: false,
      required: true,
      label: 'Fő kategória',
    },
    {
      name: 'subcategory',
      type: 'relationship',
      relationTo: 'service-categories',
      hasMany: false,
      label: 'Alkategória',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Kép',
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      required: true,
    },
    {
      name: 'staff',
      type: 'relationship',
      relationTo: 'staff',
      hasMany: true,
      label: 'Elérhető munkatársak',
    },
    {
      name: 'duration_minutes',
      type: 'number',
      required: true,
      label: 'Időtartam (perc)',
      defaultValue: 60,
      min: 5,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      label: 'Ár',
      min: 0,
    },
    {
      name: 'currency',
      type: 'select',
      options: [
        { label: 'HUF', value: 'HUF' },
        { label: 'EUR', value: 'EUR' },
      ],
      defaultValue: 'HUF',
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Aktív',
    },
  ],
  timestamps: true,
}
