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
    // Admin → admin-közönségű értesítések; user → saját üzlet owner-értesítései + user-célzott.
    read: (async ({ req }) => {
      if (req.user?.role === 'admin') return { audience: { equals: 'admin' } }
      if (!req.user) return false
      const or: Record<string, unknown>[] = [{ user: { equals: req.user.id } }]
      const [salons, restaurants] = await Promise.all([
        req.payload.find({ collection: 'salons', where: { owner: { equals: req.user.id } }, limit: 100, depth: 0, overrideAccess: true, req }),
        req.payload.find({ collection: 'restaurants', where: { owner: { equals: req.user.id } }, limit: 100, depth: 0, overrideAccess: true, req }),
      ])
      const salonIds = salons.docs.map((s) => s.id)
      const restaurantIds = restaurants.docs.map((r) => r.id)
      if (salonIds.length) or.push({ and: [{ salon: { in: salonIds } }, { audience: { equals: 'owner' } }] })
      if (restaurantIds.length) or.push({ and: [{ restaurant: { in: restaurantIds } }, { audience: { equals: 'owner' } }] })
      return { or }
    }) as Access,
    create: ({ req }) => req.user?.role === 'admin',
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
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: 'Felhasználó (alkalmazotti értesítéshez)',
    },
    {
      // Kinek szól: owner (a tulaj harangja), member (alkalmazott saját nézete), admin (backstage).
      name: 'audience',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      index: true,
      label: 'Közönség',
      options: [
        { label: 'Tulajdonos', value: 'owner' },
        { label: 'Alkalmazott', value: 'member' },
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
        { label: 'Módosítás', value: 'modification' },
        { label: 'Új regisztráció', value: 'new_signup' },
        { label: 'Új előfizető', value: 'new_subscriber' },
        { label: 'Reggeli összefoglaló', value: 'digest_morning' },
        { label: 'Esti összefoglaló', value: 'digest_evening' },
        { label: 'Beosztás változás', value: 'schedule_change' },
      ],
    },
    { name: 'title', type: 'text', required: true, label: 'Cím' },
    { name: 'body', type: 'text', label: 'Szöveg' },
    { name: 'metadata', type: 'json', label: 'Digest adatok (foglalások, fő, műszak vezető stb.)' },
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
