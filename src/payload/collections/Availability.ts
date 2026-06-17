import { CollectionConfig } from 'payload'
import { userOwnsSalon, canCreateForOwnSalon } from '../lib/salonOwnerAccess'

export const Availability: CollectionConfig = {
  slug: 'availability',
  labels: { singular: 'Elérhetőség', plural: 'Elérhetőségek' },
  admin: {
    group: 'Szalon',
    useAsTitle: 'salon',
    defaultColumns: ['salon', 'staff', 'day_of_week', 'start_time', 'end_time'],
    hidden: true,
  },
  access: {
    read: () => true,
    create: canCreateForOwnSalon,
    update: async ({ req, id, data }) => {
      if (req.user?.role === 'admin') return true
      if (id) {
        const doc = await req.payload.findByID({ collection: 'availability', id, depth: 0, overrideAccess: true, req }).catch(() => null)
        return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
      }
      return userOwnsSalon(req, data?.salon as number | string | undefined)
    },
    delete: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = await req.payload.findByID({ collection: 'availability', id, depth: 0, overrideAccess: true, req }).catch(() => null)
      return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
    },
  },
  fields: [
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      required: true,
      label: 'Szalon',
    },
    {
      name: 'staff',
      type: 'relationship',
      relationTo: 'staff',
      hasMany: false,
      label: 'Munkatárs (ha nincs, szalon szintű)',
    },
    {
      name: 'day_of_week',
      type: 'select',
      options: [
        { label: 'Hétfő', value: 'monday' },
        { label: 'Kedd', value: 'tuesday' },
        { label: 'Szerda', value: 'wednesday' },
        { label: 'Csütörtök', value: 'thursday' },
        { label: 'Péntek', value: 'friday' },
        { label: 'Szombat', value: 'saturday' },
        { label: 'Vasárnap', value: 'sunday' },
      ],
      required: true,
      label: 'Nap',
    },
    {
      name: 'start_time',
      type: 'text',
      required: true,
      label: 'Nyitás (HH:MM)',
      validate: (value: string | string[] | null | undefined) => {
        if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
          return 'Formátum: HH:MM'
        }
        return true
      },
    },
    {
      name: 'end_time',
      type: 'text',
      required: true,
      label: 'Zárás (HH:MM)',
      validate: (value: string | string[] | null | undefined) => {
        if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
          return 'Formátum: HH:MM'
        }
        return true
      },
    },
    {
      name: 'is_available',
      type: 'checkbox',
      defaultValue: true,
      label: 'Elérhető',
    },
    {
      name: 'recurring',
      type: 'checkbox',
      defaultValue: true,
      label: 'Rendszeres (minden héten)',
    },
    {
      name: 'exception_date',
      type: 'text',
      label: 'Kivétel dátuma (ÉÉÉÉ-HH-NN)',
      admin: {
        condition: (data) => !data?.recurring,
      },
      validate: (value: unknown) => {
        if (value === null || value === undefined || value === '') return true
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Formátum: ÉÉÉÉ-HH-NN'
        return true
      },
    },
  ],
  timestamps: true,
}
