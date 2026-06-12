import type { CollectionConfig } from 'payload'

const MS_PER_DAY = 86_400_000

/** Egy plan aktuális globális ára a `pricing-settings` globalből (fallback a régi fix árakra). */
async function currentPlanPrice(req: { payload: { findGlobal: (a: { slug: string; overrideAccess?: boolean }) => Promise<unknown> } }, plan: string): Promise<number> {
  if (plan !== 'pro' && plan !== 'restaurant_pro') return 0 // trial / ismeretlen
  try {
    const g = (await req.payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true })) as { salon_pro_huf?: number; restaurant_pro_huf?: number }
    if (plan === 'pro') return g?.salon_pro_huf ?? 2900
    return g?.restaurant_pro_huf ?? 9900
  } catch {
    return plan === 'pro' ? 2900 : 9900
  }
}

export const Subscriptions: CollectionConfig = {
  slug: 'subscriptions',
  labels: { singular: 'Előfizetés', plural: 'Előfizetések' },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation !== 'update' && operation !== 'create') return data
        // Fizetős planok: salon 'pro' ÉS étterem 'restaurant_pro' is. (Korábban csak a
        // 'pro'-t ismerte fel → restaurant_pro-nál a status trialing maradt = bug.)
        const PAID_PLANS = ['pro', 'restaurant_pro']
        const wasPlan = originalDoc?.plan
        const newPlan = data.plan ?? wasPlan
        const isPro = PAID_PLANS.includes(newPlan)
        const planChangedToPro = isPro && !PAID_PLANS.includes(wasPlan)

        // Az ár a GLOBÁLIS árazásból (backstage-ben szerkeszthető), a planhez igazítva.
        // Modell: a már fizető ügyfél a current_period_end-ig a befagyott árát tartja; az
        // árat csak akkor frissítjük, ha a plan változik VAGY a ciklus megújul (lentebb).
        if (data.plan && data.plan !== wasPlan) {
          data.amount_huf = await currentPlanPrice(req, newPlan)
        }

        // Újraaktiválás (past_due/canceled/paused → active) UGYANAZON a fizetős planon: új
        // ciklus indul, ezért a friss GLOBÁLIS árat fagyasztjuk be (ez a „ciklus végén új ár").
        const wasInactive = originalDoc && originalDoc.status !== 'active'
        const reactivating = isPro && !planChangedToPro && wasInactive && data.status === 'active'
        if (reactivating) {
          data.amount_huf = await currentPlanPrice(req, newPlan)
        }

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
    afterChange: [
      // Admin-értesítés, amikor egy előfizetés FIZETŐVÉ válik (status → active). Best-effort.
      async ({ req, doc, previousDoc, operation }) => {
        const becameActive = doc.status === 'active' && (operation === 'create' || previousDoc?.status !== 'active')
        if (!becameActive) return doc
        try {
          const salonId = doc.salon && typeof doc.salon === 'object' ? doc.salon.id : doc.salon
          const restaurantId = doc.restaurant && typeof doc.restaurant === 'object' ? doc.restaurant.id : doc.restaurant
          let name = '—'
          if (salonId) {
            const s = await req.payload.findByID({ collection: 'salons', id: salonId, depth: 0, overrideAccess: true, req }).catch(() => null)
            name = s?.name ? `Szalon: ${s.name}` : 'Szalon'
          } else if (restaurantId) {
            const r = await req.payload.findByID({ collection: 'restaurants', id: restaurantId, depth: 0, overrideAccess: true, req }).catch(() => null)
            name = r?.name ? `Étterem: ${r.name}` : 'Étterem'
          }
          await req.payload.create({
            collection: 'notifications',
            overrideAccess: true,
            req,
            data: {
              audience: 'admin',
              type: 'new_subscriber',
              title: `Új előfizető 🎉`,
              body: `${name} fizető előfizető lett`,
              ...(salonId ? { salon: salonId } : {}),
              ...(restaurantId ? { restaurant: restaurantId } : {}),
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
    // useAsTitle NEM lehet virtuális mező (Payload tiltja, ha nincs relationshiphez kötve)
    // → 'plan' marad a cím. Az 'owner' virtuális mező viszont LISTAOSZLOPKÉNT remek:
    // első oszlopként "Szalon: X" / "Étterem: Y", egyértelmű melyik helyhez tartozik.
    useAsTitle: 'plan',
    defaultColumns: ['owner', 'plan', 'status', 'current_period_end'],
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
      // Virtuális cím-oszlop: "Szalon: X" vagy "Étterem: Y" — egyértelmű melyik helyhez
      // tartozik az előfizetés, nem kell a salon/restaurant <No ...> jelöléseit nézni.
      // Nem tárolódik, csak olvasáskor töltődik (a Users.place mintájára).
      name: 'owner',
      type: 'text',
      virtual: true,
      label: 'Tulajdonos',
      admin: {
        readOnly: true,
        condition: () => false, // csak listaoszlop, a szerkesztőben rejtve (salon/restaurant ott van)
      },
      hooks: {
        afterRead: [
          async ({ data, req }) => {
            try {
              if (data?.salon) {
                const id = typeof data.salon === 'object' ? data.salon.id : data.salon
                const doc = await req.payload.findByID({ collection: 'salons', id, depth: 0, overrideAccess: true, req })
                return doc?.name ? `Szalon: ${doc.name}` : null
              }
              if (data?.restaurant) {
                const id = typeof data.restaurant === 'object' ? data.restaurant.id : data.restaurant
                const doc = await req.payload.findByID({ collection: 'restaurants', id, depth: 0, overrideAccess: true, req })
                return doc?.name ? `Étterem: ${doc.name}` : null
              }
            } catch {
              return null
            }
            return null
          },
        ],
      },
    },
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
