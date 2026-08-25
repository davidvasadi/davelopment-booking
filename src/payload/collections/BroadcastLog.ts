import type { CollectionConfig } from 'payload'

/**
 * Admin körüzenetek naplója — MINDEN küldött kampányról egy sor (nem recipiensenként), hogy a
 * backstage-en visszakereshető legyen, mi ment ki, mikor, kinek és hányszor lett elolvasva.
 * A tényleges kézbesítés a `notifications` collectionben történik (egy sor helyenként),
 * a `notifications.campaign_id` mutat vissza erre a rekordra a "hányan olvasták el" számoláshoz.
 */
export const BroadcastLog: CollectionConfig = {
  slug: 'broadcast-log',
  labels: { singular: 'Körüzenet-napló', plural: 'Körüzenet-napló' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'target', 'sent_count', 'createdAt'],
    group: 'Rendszer',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: () => false, // csak szerver-oldal (overrideAccess), lásd /api/backstage/broadcast
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Cím' },
    { name: 'body', type: 'textarea', required: true, label: 'Üzenet' },
    {
      name: 'target',
      type: 'select',
      required: true,
      label: 'Célcsoport',
      options: [
        { label: 'Mindenki', value: 'all' },
        { label: 'Csak fizetők', value: 'paying' },
        { label: 'Csak próbaidősök', value: 'trial' },
        { label: 'Egyedi kiválasztás', value: 'custom' },
      ],
    },
    { name: 'sent_count', type: 'number', required: true, defaultValue: 0, label: 'Elküldve (hely)' },
    { name: 'sent_by', type: 'relationship', relationTo: 'users', label: 'Küldte' },
  ],
  timestamps: true,
}
