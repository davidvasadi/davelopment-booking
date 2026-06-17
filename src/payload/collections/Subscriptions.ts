import type { CollectionConfig } from 'payload'

const MS_PER_DAY = 86_400_000

/**
 * FIÓK-SZINTŰ előfizetés (account-level subscription): EGY user = EGY előfizetés. A díj az
 * összes üzletének (szalon + étterem) összetételéből áll (`amount_huf`, dinamikusan a globális
 * `pricing-settings`-ből számolva — lásd src/lib/accountSubscription.ts). A `plan` itt csak a
 * jelleget jelzi: `trial` (próbaidő) vagy `paid` (fizető). A típus-specifikus pro/restaurant_pro
 * megszűnt — egy fiókban vegyesen lehet szalon ÉS étterem.
 */
export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  labels: { singular: 'Előfizetés', plural: 'Előfizetések' },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation }) => {
        if (operation !== 'update' && operation !== 'create') return data
        const wasPlan = originalDoc?.plan
        const newPlan = data.plan ?? wasPlan
        const isPaid = newPlan === 'paid'
        const planChangedToPaid = isPaid && wasPlan !== 'paid'

        // Trial → fizető váltás: status active, 30 napos ciklus indítása (a trial maradékát
        // megőrizve, ha még él). Az amount_huf-ot a számoló helper (syncAccountSubscription)
        // állítja az üzletek alapján — itt csak a státusz-átmenetet kezeljük.
        if (planChangedToPaid) {
          const trialEndMs = data.trial_ends_at
            ? new Date(data.trial_ends_at).getTime()
            : originalDoc?.trial_ends_at
              ? new Date(originalDoc.trial_ends_at).getTime()
              : 0
          const baseMs = Math.max(Date.now(), trialEndMs || 0)
          data.status = 'active'
          data.current_period_end = new Date(baseMs + 30 * MS_PER_DAY).toISOString()
          data.cancel_at_period_end = false
        } else if (isPaid && data.status === 'trialing') {
          // Fizető plan de trialing státusz inkonzisztens → javítjuk.
          data.status = 'active'
          if (!data.current_period_end && !originalDoc?.current_period_end) {
            const trialEndMs = originalDoc?.trial_ends_at ? new Date(originalDoc.trial_ends_at).getTime() : Date.now()
            data.current_period_end = new Date(Math.max(Date.now(), trialEndMs) + 30 * MS_PER_DAY).toISOString()
          }
        }
        return data
      },
    ],
    afterChange: [
      // Admin-értesítés, amikor egy fiók FIZETŐVÉ válik (status → active). Best-effort.
      async ({ req, doc, previousDoc, operation }) => {
        const becameActive = doc.status === 'active' && (operation === 'create' || previousDoc?.status !== 'active')
        if (!becameActive) return doc
        try {
          const ownerId = doc.owner && typeof doc.owner === 'object' ? doc.owner.id : doc.owner
          let label = 'Fiók'
          if (ownerId) {
            const u = await req.payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true, req }).catch(() => null)
            label = u?.email ? `Fiók: ${u.email}` : 'Fiók'
          }
          await req.payload.create({
            collection: 'notifications',
            overrideAccess: true,
            req,
            data: {
              audience: 'admin',
              type: 'new_subscriber',
              title: `Új előfizető 🎉`,
              body: `${label} fizető előfizető lett`,
              read: false,
            },
          })
        } catch (err) {
          req.payload.logger.error(`admin új-előfizető értesítés hiba: ${String(err)}`)
        }
        return doc
      },
    ],
  },
  admin: {
    // useAsTitle NEM lehet virtuális mező (Payload tiltja) → a valós 'breakdown'-t használjuk
    // címként; az owner_label virtuális mező első listaoszlopként mutatja a fiók emailjét.
    useAsTitle: 'breakdown',
    defaultColumns: ['owner_label', 'status', 'amount_huf', 'breakdown', 'current_period_end'],
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
      // Virtuális cím-oszlop: a tulajdonos (fiók) emailje — egyértelmű melyik fiókhoz tartozik.
      name: 'owner_label',
      type: 'text',
      virtual: true,
      label: 'Tulajdonos',
      admin: { readOnly: true, condition: () => false },
      hooks: {
        afterRead: [
          async ({ data, req }) => {
            try {
              const id = data?.owner && typeof data.owner === 'object' ? data.owner.id : data?.owner
              if (!id) return null
              const u = await req.payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, req })
              return u?.email ?? u?.name ?? null
            } catch {
              return null
            }
          },
        ],
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      label: 'Tulajdonos (fiók)',
      admin: { description: 'Egy fiók = egy előfizetés. A díj az összes üzletéből számolódik.' },
    },
    {
      name: 'plan',
      type: 'select',
      required: true,
      defaultValue: 'trial',
      label: 'Jelleg',
      options: [
        { label: 'Próbaidőszak', value: 'trial' },
        { label: 'Fizető', value: 'paid' },
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
      // Az üzlet-összetétel (a díj alapja) — read-only, a syncAccountSubscription állítja.
      name: 'salon_count',
      type: 'number',
      defaultValue: 0,
      label: 'Szalonok száma',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'restaurant_count',
      type: 'number',
      defaultValue: 0,
      label: 'Éttermek száma',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'breakdown',
      type: 'text',
      label: 'Összetétel',
      admin: { readOnly: true, description: 'Pl. „2 étterem + 1 szalon" — automatikus.' },
    },
    {
      name: 'trial_ends_at',
      type: 'date',
      label: 'Próbaidőszak vége',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'current_period_end',
      type: 'date',
      label: 'Jelenlegi időszak vége',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
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
      defaultValue: 0,
      label: 'Havi díj (Ft)',
      admin: {
        readOnly: true,
        description: 'A fiók teljes havidíja — az üzletek összetételéből, automatikusan számolva.',
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
