import type { CollectionConfig } from 'payload'
import { isRestaurantOwnerOrAdmin } from '../access/restaurantAccess'

export const OpeningHours: CollectionConfig = {
  slug: 'opening-hours',
  labels: { singular: 'Nyitvatartás', plural: 'Nyitvatartás' },
  admin: {
    useAsTitle: 'day_of_week',
    defaultColumns: ['day_of_week', 'open_time', 'close_time', 'restaurant'],
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
    {
      name: 'day_of_week',
      type: 'select',
      required: true,
      label: 'Nap',
      options: [
        { label: 'Hétfő', value: 'monday' },
        { label: 'Kedd', value: 'tuesday' },
        { label: 'Szerda', value: 'wednesday' },
        { label: 'Csütörtök', value: 'thursday' },
        { label: 'Péntek', value: 'friday' },
        { label: 'Szombat', value: 'saturday' },
        { label: 'Vasárnap', value: 'sunday' },
      ],
    },
    { name: 'is_open', type: 'checkbox', defaultValue: true, label: 'Nyitva', admin: { position: 'sidebar' } },
    { name: 'open_time', type: 'text', label: 'Nyitás (HH:MM)' },
    { name: 'close_time', type: 'text', label: 'Zárás (HH:MM)' },
  ],
  timestamps: true,
}
