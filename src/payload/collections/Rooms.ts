import type { CollectionConfig } from 'payload'
import { isRestaurantOwnerOrAdmin, canCreateForOwnRestaurant } from '../access/restaurantAccess'

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
    create: canCreateForOwnRestaurant,
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
    {
      name: 'is_outdoor',
      type: 'checkbox',
      defaultValue: false,
      label: 'Kültéri (terasz/kert)',
      admin: { description: 'Ha be van pipálva, ez egy kültéri terem (pl. terasz).' },
    },
    { name: 'is_active', type: 'checkbox', defaultValue: true, label: 'Aktív', admin: { position: 'sidebar' } },
    {
      name: 'seasonal',
      type: 'checkbox',
      defaultValue: false,
      label: 'Szezonális (csak adott időszakban foglalható)',
      admin: { description: 'Pl. terasz: csak a megadott dátum-tartományban foglalható (azon kívül kiesik a kapacitásból).' },
    },
    { name: 'season_start', type: 'text', label: 'Szezon kezdete (YYYY-MM-DD)', admin: { condition: (_, sib) => !!sib?.seasonal } },
    { name: 'season_end', type: 'text', label: 'Szezon vége (YYYY-MM-DD)', admin: { condition: (_, sib) => !!sib?.seasonal } },
    { name: 'sort_order', type: 'number', defaultValue: 0, label: 'Sorrend' },
  ],
  timestamps: true,
}
