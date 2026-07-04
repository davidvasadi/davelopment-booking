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
      // A szalon EGY alapdíja (Start = ennyi flat; Pro = ennyi + per-fő). A korábbi modellből
      // örökölt érték — a mező-slug maradt `salon_pro_huf`, hogy a beállított érték ne vesszen el.
      name: 'salon_pro_huf',
      type: 'number',
      required: true,
      defaultValue: 2900,
      min: 0,
      label: 'Szalon alapdíj (Ft)',
      admin: { description: 'A szalon havi alapdíja. Start = ennyi (1 naptár); Pro = ennyi + minden extra munkatárs/naptár.' },
    },
    {
      name: 'salon_extra_staff_huf',
      type: 'number',
      required: true,
      defaultValue: 1900,
      min: 0,
      label: 'Szalon — extra munkatárs / naptár (Ft)',
      admin: { description: 'A Pro szalon havidíjához az elsőn felüli minden munkatárs/naptár ennyivel járul hozzá.' },
    },
    {
      // Az étterem EGY fix havidíja (a „Pro" / normál csomag). Egyedi igény = külön alku.
      name: 'restaurant_pro_huf',
      type: 'number',
      required: true,
      defaultValue: 19900,
      min: 0,
      label: 'Étterem havidíj (Ft)',
      admin: { description: 'Az étterem havi fix ára forintban (a normál csomag).' },
    },
    {
      name: 'annual_discount_pct',
      type: 'number',
      required: true,
      defaultValue: 20,
      min: 0,
      max: 100,
      label: 'Éves fizetés kedvezménye (%)',
      admin: { description: 'Éves számlázásnál ennyi %-kal olcsóbb az effektív havidíj (alap 20%).' },
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
