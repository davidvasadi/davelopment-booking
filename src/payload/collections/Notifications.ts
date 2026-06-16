import type { Access, CollectionConfig } from 'payload'

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
    // Admin csak az admin-közönségű (audience: 'admin') értesítéseket látja a harangban;
    // a tulajok a saját helyük owner-értesítéseit. (Admin a /admin-ban mindent lát overrideAccess-szel.)
    read: (async ({ req }) => {
      if (req.user?.role === 'admin') return { audience: { equals: 'admin' } }
      if (!req.user) return false
      // Több-üzlet: a user az ÖSSZES SAJÁT helye (szalon + étterem) owner-értesítéseit látja.
      const [salons, restaurants] = await Promise.all([
        req.payload.find({ collection: 'salons', where: { owner: { equals: req.user.id } }, limit: 100, depth: 0, overrideAccess: true, req }),
        req.payload.find({ collection: 'restaurants', where: { owner: { equals: req.user.id } }, limit: 100, depth: 0, overrideAccess: true, req }),
      ])
      const salonIds = salons.docs.map((s) => s.id)
      const restaurantIds = restaurants.docs.map((r) => r.id)
      const or: Record<string, unknown>[] = []
      if (salonIds.length) or.push({ salon: { in: salonIds } })
      if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
      if (or.length === 0) return false
      return { or }
    }) as Access,
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
      // Kinek szól: owner (a tulaj harangja) vagy admin (a backstage harangja). Az új admin-
      // értesítések (regisztráció, előfizető) 'admin', a foglalás-értesítések 'owner'.
      name: 'audience',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      index: true,
      label: 'Közönség',
      options: [
        { label: 'Tulajdonos', value: 'owner' },
        { label: 'Admin (backstage)', value: 'admin' },
      ],
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Típus',
      options: [
        { label: 'Új foglalás', value: 'new_booking' },
        { label: 'Lemondás', value: 'cancellation' },
        { label: 'Új regisztráció', value: 'new_signup' },
        { label: 'Új előfizető', value: 'new_subscriber' },
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
