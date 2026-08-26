import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'
import { cleanupMediaOnChange } from '../hooks/cleanupMediaOnChange'
import { capabilityScoped, capabilityCreate } from '../access/capabilityAccess'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

export const Services: CollectionConfig = {
  slug: 'services',
  hooks: {
    afterChange: [revalidateChildOnChange('salon', 'salon'), cleanupMediaOnChange(['image']), auditAfterChange('Szolgáltatás', 'salon')],
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
    create: capabilityCreate('salon', 'salon', 'catalog.manage'),
    update: capabilityScoped('salon', 'salon', 'catalog.manage'),
    delete: capabilityScoped('salon', 'salon', 'catalog.manage'),
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
