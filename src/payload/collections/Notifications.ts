import type { CollectionConfig } from 'payload'

// App-on belüli értesítések (e-mail nélkül). A tulajdonos a harang ikon alatt látja őket.
// A rekordokat a Reservations / Bookings afterChange hook hozza létre.
export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: { singular: 'Értesítés', plural: 'Értesítések' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'read', 'createdAt'],
    group: 'Rendszer',
    hidden: true,
  },
  access: {
    // Csak a saját helyhez (étterem/szalon) tartozó értesítések, kivéve admin.
    read: ({ req }) => {
      if (req.user?.role === 'admin') return true
      if (req.user?.role === 'restaurant_owner') {
        const restaurantId =
          req.user.restaurant && typeof req.user.restaurant === 'object'
            ? (req.user.restaurant as { id: number | string }).id
            : req.user.restaurant
        if (!restaurantId) return false
        return { restaurant: { equals: restaurantId } }
      }
      if (req.user?.role === 'salon_owner') {
        const salonId =
          req.user.salon && typeof req.user.salon === 'object'
            ? (req.user.salon as { id: number | string }).id
            : req.user.salon
        if (!salonId) return false
        return { salon: { equals: salonId } }
      }
      return false
    },
    // Hook hozza létre, overrideAccess-szel.
    create: ({ req }) => req.user?.role === 'admin',
    // A tulaj csak olvasottnak jelölheti (read mező); a hozzáférést a read where szűri.
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'restaurant',
      type: 'relationship',
      relationTo: 'restaurants',
      index: true,
      label: 'Étterem',
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      index: true,
      label: 'Szalon',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Típus',
      options: [
        { label: 'Új foglalás', value: 'new_booking' },
        { label: 'Lemondás', value: 'cancellation' },
      ],
    },
    { name: 'title', type: 'text', required: true, label: 'Cím' },
    { name: 'body', type: 'text', label: 'Szöveg' },
    {
      name: 'read',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      label: 'Olvasott',
    },
    {
      name: 'reservation',
      type: 'relationship',
      relationTo: 'reservations',
      label: 'Asztalfoglalás',
    },
    {
      name: 'booking',
      type: 'relationship',
      relationTo: 'bookings',
      label: 'Foglalás',
    },
  ],
  timestamps: true,
}
