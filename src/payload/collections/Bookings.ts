import { CollectionConfig } from 'payload'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'customer_name',
    defaultColumns: ['customer_name', 'salon', 'service', 'date', 'start_time', 'status'],
    hidden: true,
  },
  access: {
    read: ({ req, data }) => {
      if (req.user?.role === 'admin') return true
      return req.user?.salon?.id === data?.salon?.id
    },
    create: () => true, // Publikus: ügyfél hozza létre
    update: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!req.user || !id) return false
      const booking = await req.payload.findByID({
        collection: 'bookings',
        id: String(id),
        depth: 0,
        overrideAccess: true,
      })
      if (!booking) return false
      const userSalonId = req.user.salon && typeof req.user.salon === 'object'
        ? (req.user.salon as { id: number | string }).id
        : req.user.salon
      return String(userSalonId) === String(booking.salon)
    },
  },
  fields: [
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      required: true,
    },
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      hasMany: false,
      required: true,
    },
    {
      name: 'staff',
      type: 'relationship',
      relationTo: 'staff',
      hasMany: false,
      required: true,
    },
    {
      name: 'customer_name',
      type: 'text',
      required: true,
      label: 'Ügyfél neve',
    },
    {
      name: 'customer_email',
      type: 'email',
      required: true,
      label: 'Ügyfél email',
    },
    {
      name: 'customer_phone',
      type: 'text',
      required: true,
      label: 'Ügyfél telefon',
    },
    {
      name: 'date',
      type: 'text',
      required: true,
      label: 'Foglalás dátuma',
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Formátum: ÉÉÉÉ-HH-NN'
        return true
      },
    },
    {
      name: 'start_time',
      type: 'text',
      required: true,
      label: 'Kezdési idő (HH:MM)',
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
      label: 'Befejezési idő (HH:MM)',
      validate: (value: string | string[] | null | undefined) => {
        if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
          return 'Formátum: HH:MM'
        }
        return true
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Függőben', value: 'pending' },
        { label: 'Megerősített', value: 'confirmed' },
        { label: 'Lemondott', value: 'cancelled' },
        { label: 'Befejezett', value: 'completed' },
      ],
      defaultValue: 'pending',
      required: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Megjegyzések',
    },
  ],
  timestamps: true,
}
