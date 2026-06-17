import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'
import { userOwnsSalon, canCreateForOwnSalon } from '../lib/salonOwnerAccess'

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
    create: canCreateForOwnSalon,
    update: async ({ req, id, data }) => {
      if (req.user?.role === 'admin') return true
      if (id) {
        const doc = await req.payload.findByID({ collection: 'staff', id, depth: 0, overrideAccess: true, req }).catch(() => null)
        return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
      }
      return userOwnsSalon(req, data?.salon as number | string | undefined)
    },
    delete: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = await req.payload.findByID({ collection: 'staff', id, depth: 0, overrideAccess: true, req }).catch(() => null)
      return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
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
