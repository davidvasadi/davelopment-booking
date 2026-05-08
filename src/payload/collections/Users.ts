import { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'salon'],
  },
  access: {
    create: () => true,
    read: ({ req }) => {
      if (req.user?.role === 'admin') return true
      return { id: { equals: req.user?.id } }
    },
    update: ({ req }) => {
      if (req.user?.role === 'admin') return true
      return { id: { equals: req.user?.id } }
    },
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Teljes név',
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Szalon tulajdonos', value: 'salon_owner' },
        { label: 'Admin', value: 'admin' },
      ],
      defaultValue: 'salon_owner',
      required: true,
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      admin: {
        condition: (data) => data?.role === 'salon_owner',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Aktív', value: 'active' },
        { label: 'Deaktivált', value: 'inactive' },
      ],
      defaultValue: 'active',
    },
  ],
}
