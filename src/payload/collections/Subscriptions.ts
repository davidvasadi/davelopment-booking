import type { CollectionConfig } from 'payload'

const MS_PER_DAY = 86_400_000

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation !== 'update' && operation !== 'create') return data
        const wasPlan = originalDoc?.plan
        const newPlan = data.plan ?? wasPlan
        const planChangedToPro = newPlan === 'pro' && wasPlan !== 'pro'
        const isPro = newPlan === 'pro'

        if (planChangedToPro) {
          // Pro váltás: status active, period_end indítás
          const trialEndMs = data.trial_ends_at
            ? new Date(data.trial_ends_at).getTime()
            : originalDoc?.trial_ends_at
              ? new Date(originalDoc.trial_ends_at).getTime()
              : 0
          const now = Date.now()
          // Ha még él a trial, megőrizzük a maradékot; egyébként most indul új ciklus
          const baseMs = Math.max(now, trialEndMs || 0)
          const periodEndMs = baseMs + 30 * MS_PER_DAY
          data.status = 'active'
          data.current_period_end = new Date(periodEndMs).toISOString()
          data.cancel_at_period_end = false
        } else if (isPro && data.status === 'trialing') {
          // Pro plan de trialing státusz inkonzisztens → javítjuk
          data.status = 'active'
          if (!data.current_period_end && !originalDoc?.current_period_end) {
            const trialEndMs = originalDoc?.trial_ends_at
              ? new Date(originalDoc.trial_ends_at).getTime()
              : Date.now()
            data.current_period_end = new Date(Math.max(Date.now(), trialEndMs) + 30 * MS_PER_DAY).toISOString()
          }
        }
        return data
      },
    ],
  },
  admin: {
    useAsTitle: 'plan',
    defaultColumns: ['salon', 'restaurant', 'plan', 'status', 'current_period_end'],
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
      unique: true,
      label: 'Szalon',
      admin: { description: 'Salon-előfizetésekhez (a restaurant mezővel kizárólagos)' },
    },
    {
      name: 'restaurant',
      type: 'relationship',
      relationTo: 'restaurants',
      unique: true,
      label: 'Étterem',
      admin: { description: 'Étterem-előfizetésekhez (a salon mezővel kizárólagos)' },
    },
    {
      name: 'plan',
      type: 'select',
      required: true,
      defaultValue: 'trial',
      label: 'Terv',
      options: [
        { label: 'Próbaidőszak (14 nap)', value: 'trial' },
        { label: 'Szalon Pro (2 900 Ft/hó)', value: 'pro' },
        { label: 'Étterem Pro (9 900 Ft/hó)', value: 'restaurant_pro' },
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
      name: 'cancel_at_period_end',
      type: 'checkbox',
      defaultValue: false,
      label: 'Időszak végén lemond',
      admin: {
        description: 'Ha be van pipálva, a következő számlázási dátumkor automatikusan canceled státuszba kerül.',
      },
    },
    {
      name: 'amount_huf',
      type: 'number',
      defaultValue: 2900,
      label: 'Havi díj (Ft)',
      admin: {
        description: 'Havi előfizetési díj forintban (Pro: 2 900 Ft)',
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
