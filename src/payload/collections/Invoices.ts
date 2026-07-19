import type { CollectionConfig } from 'payload'

export const Invoices: CollectionConfig = {
  slug: 'invoices',
  labels: { singular: 'Számla', plural: 'Számlák' },
  admin: {
    useAsTitle: 'invoice_number',
    defaultColumns: ['invoice_number', 'amount_huf', 'issued_at', 'test'],
    group: 'Rendszer',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'subscription',
      type: 'relationship',
      relationTo: 'subscriptions',
      required: true,
      label: 'Előfizetés',
      admin: { position: 'sidebar' },
    },
    {
      name: 'invoice_number',
      type: 'text',
      required: true,
      label: 'Számlaszám',
    },
    {
      name: 'invoice_url',
      type: 'text',
      label: 'Letöltési link',
    },
    {
      name: 'amount_huf',
      type: 'number',
      label: 'Összeg (Ft)',
    },
    {
      name: 'stripe_invoice_id',
      type: 'text',
      label: 'Stripe Invoice ID',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'issued_at',
      type: 'date',
      label: 'Kiállítás dátuma',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'test',
      type: 'checkbox',
      defaultValue: false,
      label: 'Tesztszámla',
      admin: { position: 'sidebar' },
    },
  ],
  timestamps: true,
}
