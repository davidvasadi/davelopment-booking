import { CollectionConfig } from 'payload'

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'salon', 'duration_minutes', 'price', 'is_active'],
    hidden: true,
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req, data }) => {
      if (req.user?.role === 'admin') return true
      const userSalonId = req.user?.salon && typeof req.user.salon === 'object'
        ? (req.user.salon as { id: number }).id
        : req.user?.salon
      return Number(userSalonId) === Number(data?.salon)
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Szolgáltatás neve',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Leírás',
    },
    {
      name: 'category',
      type: 'text',
      required: true,
      label: 'Fő kategória',
      admin: {
        placeholder: 'Pl. Fodrászat, Körmös, Fogászat',
      },
    },
    {
      name: 'subcategory',
      type: 'text',
      label: 'Alkategória',
      admin: {
        placeholder: 'Pl. Hajvágás, Balayage, Porcelán köröm',
      },
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
