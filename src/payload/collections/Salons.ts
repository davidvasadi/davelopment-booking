import type { CollectionConfig } from 'payload'

export const Salons: CollectionConfig = {
  slug: 'salons',
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        await Promise.all([
          req.payload.delete({ collection: 'bookings', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'availability', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'services', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'service-categories', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'staff', where: { salon: { equals: id } }, overrideAccess: true }),
        ])
      },
    ],
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'owner', 'city', 'is_active'],
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      const userSalonId = req.user?.salon && typeof req.user.salon === 'object'
        ? (req.user.salon as { id: number | string }).id
        : req.user?.salon
      return String(userSalonId) === String(id)
    },
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Alap adatok',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              label: 'Szalon neve',
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              unique: true,
              label: 'URL slug',
              admin: {
                position: 'sidebar',
                description: 'davelopment.hu/bookly/[slug]',
              },
            },
            {
              name: 'owner',
              type: 'relationship',
              relationTo: 'users',
              hasMany: false,
              required: true,
            },
            {
              name: 'description',
              type: 'richText',
              label: 'Szalon leírása',
            },
            {
              name: 'logo',
              type: 'relationship',
              relationTo: 'media',
              hasMany: false,
            },
            {
              name: 'cover_image',
              type: 'relationship',
              relationTo: 'media',
              hasMany: false,
            },
            {
              name: 'address',
              type: 'text',
              label: 'Cím',
            },
            {
              name: 'city',
              type: 'text',
              label: 'Város',
            },
            {
              name: 'postal_code',
              type: 'text',
              label: 'Irányítószám',
            },
            {
              name: 'phone',
              type: 'text',
              label: 'Telefon',
            },
            {
              name: 'email',
              type: 'email',
              label: 'Email',
            },
            {
              name: 'website',
              type: 'text',
              label: 'Weboldal',
            },
            {
              name: 'booking_buffer_minutes',
              type: 'number',
              defaultValue: 15,
              label: 'Foglalások közti szünet (perc)',
            },
            {
              name: 'is_active',
              type: 'checkbox',
              defaultValue: true,
              label: 'Aktív',
            },
          ],
        },
        {
          label: 'Munkatársak',
          fields: [
            {
              name: 'staffMembers',
              type: 'join',
              collection: 'staff',
              on: 'salon',
            },
          ],
        },
        {
          label: 'Szolgáltatások',
          fields: [
            {
              name: 'servicesList',
              type: 'join',
              collection: 'services',
              on: 'salon',
            },
          ],
        },
        {
          label: 'Foglalások',
          fields: [
            {
              name: 'bookingsList',
              type: 'join',
              collection: 'bookings',
              on: 'salon',
              admin: {
                defaultColumns: ['customer_name', 'date', 'start_time', 'status'],
              },
            },
          ],
        },
        {
          label: 'Elérhetőség',
          fields: [
            {
              name: 'availabilityList',
              type: 'join',
              collection: 'availability',
              on: 'salon',
              admin: {
                defaultColumns: ['staff', 'day_of_week', 'start_time', 'end_time', 'is_available'],
              },
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
