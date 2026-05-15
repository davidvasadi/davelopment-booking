import type { CollectionConfig } from 'payload'

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  admin: {
    useAsTitle: 'salon',
    defaultColumns: ['salon', 'plan', 'status', 'current_period_end'],
    group: 'Billing',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      required: true,
      unique: true,
      label: 'Szalon',
    },
    {
      name: 'plan',
      type: 'select',
      required: true,
      defaultValue: 'free',
      label: 'Terv',
      options: [
        { label: 'Ingyenes', value: 'free' },
        { label: 'Starter (9 900 Ft/hó)', value: 'starter' },
        { label: 'Pro (19 900 Ft/hó)', value: 'pro' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'trialing',
      label: 'Státusz',
      options: [
        { label: 'Próbaidőszak', value: 'trialing' },
        { label: 'Aktív', value: 'active' },
        { label: 'Lejárt fizetés', value: 'past_due' },
        { label: 'Megszakítva', value: 'canceled' },
        { label: 'Szüneteltetett', value: 'paused' },
      ],
    },
    {
      name: 'trial_ends_at',
      type: 'date',
      label: 'Próbaidőszak vége',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'current_period_end',
      type: 'date',
      label: 'Jelenlegi időszak vége',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'amount_huf',
      type: 'number',
      defaultValue: 0,
      label: 'Havi díj (Ft)',
      admin: {
        description: 'Havi előfizetési díj forintban',
      },
    },
    {
      name: 'stripe_customer_id',
      type: 'text',
      label: 'Stripe Customer ID',
      admin: { position: 'sidebar' },
    },
    {
      name: 'stripe_subscription_id',
      type: 'text',
      label: 'Stripe Subscription ID',
      admin: { position: 'sidebar' },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Belső megjegyzés',
    },
  ],
  timestamps: true,
}
