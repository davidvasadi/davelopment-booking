import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'

export const Staff: CollectionConfig = {
  slug: 'staff',
  hooks: {
    afterChange: [revalidateChildOnChange('salon', 'salon')],
    afterDelete: [revalidateChildOnDelete('salon', 'salon')],
  },
  labels: { singular: 'Munkatárs', plural: 'Munkatársak' },
  admin: {
    group: 'Szalon',
    useAsTitle: 'name',
    defaultColumns: ['name', 'salon', 'is_active'],
    hidden: true,
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req, data }) => {
      if (req.user?.role === 'admin') return true
      const userSalonId = req.user?.salon && typeof req.user.salon === 'object'
        ? (req.user.salon as { id: number | string }).id
        : req.user?.salon
      return Number(userSalonId) === Number(data?.salon)
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Név',
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Bemutatkozás',
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      required: true,
    },
    {
      name: 'avatar',
      type: 'relationship',
      relationTo: 'media',
      hasMany: false,
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
