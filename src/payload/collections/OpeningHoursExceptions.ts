import type { CollectionConfig } from 'payload'
import { isRestaurantOwnerOrAdmin, canCreateForOwnRestaurant } from '../access/restaurantAccess'

const isYmd = (v: unknown) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export const OpeningHoursExceptions: CollectionConfig = {
  slug: 'opening-hours-exceptions',
  labels: { singular: 'Nyitvatartási kivétel', plural: 'Nyitvatartási kivételek' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'start_date', 'end_date', 'is_closed', 'restaurant'],
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
    {
      name: 'label',
      type: 'text',
      label: 'Megnevezés (pl. Karácsony)',
    },
    {
      name: 'start_date',
      type: 'text',
      required: true,
      label: 'Kezdő dátum (ÉÉÉÉ-HH-NN)',
      validate: (value: unknown) => (isYmd(value) ? true : 'Formátum: ÉÉÉÉ-HH-NN'),
    },
    {
      name: 'end_date',
      type: 'text',
      required: true,
      label: 'Záró dátum (ÉÉÉÉ-HH-NN)',
      validate: (value: unknown, { siblingData }: { siblingData: Partial<{ start_date: string }> }) => {
        if (!isYmd(value)) return 'Formátum: ÉÉÉÉ-HH-NN'
        const start = siblingData?.start_date
        if (isYmd(start) && (value as string) < start!) return 'A záró dátum nem lehet a kezdő dátum előtt'
        return true
      },
    },
    {
      name: 'is_closed',
      type: 'checkbox',
      defaultValue: true,
      label: 'Zárva (ezen a napon nincs foglalás)',
      admin: { position: 'sidebar' },
    },
    {
      name: 'open_time',
      type: 'text',
      label: 'Nyitás (HH:MM)',
      admin: { condition: (data) => !data?.is_closed },
    },
    {
      name: 'close_time',
      type: 'text',
      label: 'Zárás (HH:MM)',
      admin: { condition: (data) => !data?.is_closed },
    },
  ],
  timestamps: true,
}
