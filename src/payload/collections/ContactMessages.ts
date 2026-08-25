import type { CollectionConfig } from 'payload'

/**
 * Publikus kapcsolatfelvételi űrlap beérkező üzenetei. A `/api/contact` route hozza létre
 * (nincs public create-access — a szerver `overrideAccess`-szel ír), az admin a backstage-ből
 * (vagy a Payload adminból) olvassa/kezeli a `status`-t.
 */
export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  labels: { singular: 'Kapcsolatfelvétel', plural: 'Kapcsolatfelvételek' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'status', 'createdAt'],
    group: 'Rendszer',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: () => false, // csak szerver-oldal (overrideAccess), lásd /api/contact
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Név' },
    { name: 'email', type: 'email', required: true, label: 'Email' },
    { name: 'phone', type: 'text', label: 'Telefonszám' },
    { name: 'message', type: 'textarea', required: true, label: 'Üzenet' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      index: true,
      label: 'Állapot',
      options: [
        { label: 'Új', value: 'new' },
        { label: 'Megválaszolva', value: 'answered' },
      ],
    },
  ],
  timestamps: true,
}
