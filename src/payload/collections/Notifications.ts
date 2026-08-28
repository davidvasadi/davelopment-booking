import type { Access, CollectionConfig } from 'payload'
import { emitNotificationCreated } from '../../lib/sseEmitter'

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
  hooks: {
    afterChange: [
      ({ doc, operation, req }) => {
        // Új értesítés → a harang azonnal frissüljön SSE-n, ne kelljen a 60mp-es pollingra várni.
        // Best-effort: ez SOSE buktathatja el a tényleges értesítés-létrehozást (ami mögött pl.
        // egy foglalás visszaigazolása áll) — az EventEmitter.emit() szinkron újradobja a
        // listener hibáját a hívóig, ha nincs elkapva.
        if (operation !== 'create') return
        try {
          emitNotificationCreated({
            audience: doc.audience,
            userId: typeof doc.user === 'object' ? doc.user?.id : doc.user,
            salonId: typeof doc.salon === 'object' ? doc.salon?.id : doc.salon,
            restaurantId: typeof doc.restaurant === 'object' ? doc.restaurant?.id : doc.restaurant,
          })
        } catch (err) {
          req.payload.logger.error(`notification SSE emit hiba: ${String(err)}`)
        }
      },
    ],
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
        { label: 'Meg nem nyitott visszaigazoló email', value: 'email_not_opened' },
        { label: 'Ajándékutalvány vásárlás', value: 'voucher_purchase' },
        { label: 'Kapcsolatfelvétel', value: 'contact_message' },
        { label: 'Admin körüzenet', value: 'admin_broadcast' },
        { label: 'Heti tipp', value: 'weekly_tip' },
        { label: 'Próbaidőszak hamarosan lejár', value: 'trial_ending' },
        { label: 'Visszaterhelés (chargeback)', value: 'dispute_created' },
        { label: 'Korai csalás-gyanú', value: 'fraud_warning' },
      ],
    },
    { name: 'title', type: 'text', required: true, label: 'Cím' },
    { name: 'body', type: 'text', label: 'Szöveg' },
    { name: 'metadata', type: 'json', label: 'Digest adatok (foglalások, fő, műszak vezető stb.)' },
    {
      name: 'campaign_id',
      type: 'number',
      index: true,
      label: 'Kampány (broadcast-log id)',
      admin: { description: 'Csak admin_broadcast típusnál — a broadcast-log rekordra mutat, ebből számol a backstage olvasottsági arányt.' },
    },
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
    {
      name: 'voucher',
      type: 'relationship',
      relationTo: 'gift-vouchers',
      label: 'Ajándékutalvány',
    },
  ],
  timestamps: true,
}
