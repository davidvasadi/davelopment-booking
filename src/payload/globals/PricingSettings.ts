import type { GlobalConfig } from 'payload'

/**
 * Globális árazás + próbaidő — EGY helyen szerkeszthető (a backstage `/backstage/settings`
 * oldaláról, vagy a Payload /admin-ból). Ez a központi forrás: az új előfizetések ezt az árat
 * fagyasztják be (`amount_huf`), a publikus árazás és a backstage KPI-k innen olvasnak.
 *
 * Modell: ár-emeléskor a MÁR FIZETŐ ügyfél a `current_period_end`-ig a befagyott árat tartja,
 * a ciklus megújulásakor (Subscriptions beforeChange) viszi fel a hook az új globális árra.
 */
export const PricingSettings: GlobalConfig = {
  slug: 'pricing-settings',
  label: 'Árazás & próbaidő',
  admin: { group: 'Rendszer' },
  access: {
    // Olvasni bárki (a publikus árazáshoz is kell), írni csak admin.
    read: () => true,
    update: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'salon_pro_huf',
      type: 'number',
      required: true,
      defaultValue: 2900,
      min: 0,
      label: 'Szalon Pro havidíj (Ft)',
      admin: { description: 'A szalon Pro csomag havi ára forintban.' },
    },
    {
      name: 'restaurant_pro_huf',
      type: 'number',
      required: true,
      defaultValue: 9900,
      min: 0,
      label: 'Étterem Pro havidíj (Ft)',
      admin: { description: 'Az étterem Pro csomag havi ára forintban.' },
    },
    {
      name: 'trial_days',
      type: 'number',
      required: true,
      defaultValue: 14,
      min: 0,
      label: 'Próbaidőszak (nap)',
      admin: { description: 'Az ingyenes próbaidőszak hossza napokban (új regisztrációknál).' },
    },
  ],
}
