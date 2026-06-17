import type { CollectionConfig } from 'payload'
import { isRestaurantOwnerOrAdmin, canCreateForOwnRestaurant } from '../access/restaurantAccess'

export const Tables: CollectionConfig = {
  slug: 'tables',
  labels: { singular: 'Asztal', plural: 'Asztalok' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'capacity', 'room', 'restaurant'],
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
    { name: 'name', type: 'text', required: true, label: 'Asztal neve / száma' },
    { name: 'capacity', type: 'number', required: true, defaultValue: 4, label: 'Kapacitás (fő)' },
    {
      name: 'room',
      type: 'relationship',
      relationTo: 'rooms',
      label: 'Terem',
      admin: { description: 'Melyik teremben / zónában van az asztal' },
    },
    {
      name: 'combinable_with',
      type: 'relationship',
      relationTo: 'tables',
      hasMany: true,
      label: 'Összevonható ezekkel',
      admin: {
        description: 'Fizikailag összetolható szomszédos asztalok. Nagyobb társaság esetén ezek vonhatók össze.',
      },
    },
    { name: 'is_active', type: 'checkbox', defaultValue: true, label: 'Aktív', admin: { position: 'sidebar' } },
    { name: 'sort_order', type: 'number', defaultValue: 0, label: 'Sorrend' },
  ],
  timestamps: true,
}
