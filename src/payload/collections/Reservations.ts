import type { CollectionConfig } from 'payload'
import { isRestaurantOwnerOrAdmin } from '../access/restaurantAccess'
import { notifyOnBooking } from '../hooks/notifyOnBooking'
import { revalidateOnReservationChange, revalidateOnReservationDelete } from '../hooks/revalidateRestaurant'

export const Reservations: CollectionConfig = {
  slug: 'reservations',
  labels: { singular: 'Asztalfoglalás', plural: 'Asztalfoglalások' },
  admin: {
    useAsTitle: 'customer_name',
    defaultColumns: ['date', 'start_time', 'customer_name', 'pax', 'status', 'restaurant'],
    group: 'Étterem',
    hidden: true,
  },
  access: {
    read: () => true,
    create: () => true,
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
    { name: 'date', type: 'text', required: true, label: 'Dátum (YYYY-MM-DD)' },
    { name: 'start_time', type: 'text', required: true, label: 'Kezdés (HH:MM)' },
    { name: 'end_time', type: 'text', required: true, label: 'Vég (HH:MM)' },
    { name: 'pax', type: 'number', required: true, defaultValue: 2, label: 'Fő' },
    {
      name: 'tables',
      type: 'relationship',
      relationTo: 'tables',
      hasMany: true,
      label: 'Asztal(ok)',
      admin: {
        description:
          'Csak tables módban — az étterem rendeli hozzá vagy a foglalás automatikusan. Nagyobb társaságnál több összevont asztal is lehet.',
      },
    },
    { name: 'customer_name', type: 'text', required: true, label: 'Vendég neve' },
    { name: 'customer_email', type: 'email', label: 'Email' },
    { name: 'customer_phone', type: 'text', label: 'Telefon' },
    { name: 'notes', type: 'textarea', label: 'Megjegyzés (vendégtől)' },
    { name: 'internal_notes', type: 'textarea', label: 'Belső megjegyzés' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'confirmed',
      label: 'Státusz',
      options: [
        { label: 'Megerősítésre vár', value: 'pending' },
        { label: 'Megerősítve', value: 'confirmed' },
        { label: 'Leültetve', value: 'seated' },
        { label: 'Befejezett', value: 'completed' },
        { label: 'Nem jött meg', value: 'no_show' },
        { label: 'Lemondva', value: 'cancelled' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'online',
      label: 'Forrás',
      options: [
        { label: 'Online', value: 'online' },
        { label: 'Beeső (walk-in)', value: 'walk_in' },
        { label: 'Telefon', value: 'phone' },
      ],
    },
    {
      name: 'cancel_token',
      type: 'text',
      label: 'Lemondás token',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
  hooks: {
    afterChange: [notifyOnBooking('restaurant'), revalidateOnReservationChange],
    afterDelete: [revalidateOnReservationDelete],
  },
  timestamps: true,
}
