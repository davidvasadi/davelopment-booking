import { CollectionConfig } from 'payload'
import { capabilityScoped, capabilityCreate } from '../access/capabilityAccess'

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
    create: capabilityCreate('salon', 'salon', 'availability.manage'),
    update: capabilityScoped('salon', 'salon', 'availability.manage'),
    delete: capabilityScoped('salon', 'salon', 'availability.manage'),
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
