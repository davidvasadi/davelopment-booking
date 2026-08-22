import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'
import { capabilityScoped, capabilityCreate } from '../access/capabilityAccess'

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
    // Több-üzlet: csak a kategória szalonjához a `catalog.manage` capability-vel rendelkező
    // (owner vagy egyedi szerepű tag) módosíthat/törölhet — különben bármely bejelentkezett
    // user más szalon kategóriáihoz nyúlhatna (IDOR).
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
