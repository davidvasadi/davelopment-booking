import type { CollectionConfig } from 'payload'
import { isRestaurantOwnerOrAdmin } from '../access/restaurantAccess'

export const Rooms: CollectionConfig = {
  slug: 'rooms',
  labels: { singular: 'Terem', plural: 'Termek' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'restaurant', 'sort_order'],
    group: 'Étterem',
    hidden: true,
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: isRestaurantOwnerOrAdmin,
    delete: isRestaurantOwnerOrAdmin,
  },
  fields: [
    {
      name: 'restaurant',
      type: 'relationship',
      relationTo: 'restaurants',
      required: true,
      label: 'Étterem',
    },
    { name: 'name', type: 'text', required: true, label: 'Terem neve' },
    { name: 'is_active', type: 'checkbox', defaultValue: true, label: 'Aktív', admin: { position: 'sidebar' } },
    { name: 'sort_order', type: 'number', defaultValue: 0, label: 'Sorrend' },
  ],
  timestamps: true,
}
