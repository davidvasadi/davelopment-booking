import type { GlobalConfig } from 'payload'
import { revalidatePath } from 'next/cache'

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
  hooks: {
    // A landing oldal (`/`) build-időben statikusan sül be (`getPricing()` a page.tsx-ben,
    // nincs tag-alapú cache mögötte, mint a publikus szalon/étterem-oldalaknak) — enélkül egy
    // ár-módosítás csak a KÖVETKEZŐ deploy-nál jelenne meg élesben (dev módban ez nem tűnik fel,
    // mert ott minden kérés élesen renderel). `revalidatePath` best-effort, mint a többi
    // revalidáció — ha itt hibázik, a mentés akkor se bukjon el emiatt.
    afterChange: [
      () => {
        try {
          // az EGÉSZ oldal-fát frissíti (nem csak a főoldalt): a próbaidő / ár a funkció-, ár-, kapcsolat-, tipp- és iparági
          // oldalakon is megjelenik, amik buildkor előre elkészülnek
          revalidatePath('/', 'layout')
        } catch {
          // no-op — lásd fenti megjegyzés
        }
      },
    ],
  },
  fields: [
    {
      // Starter — a legalacsonyabb, valódi (nem "kapcsolható extra") csomag-szint. Külön ár
      // szalonra/étteremre, ahogy a Pro is. A hírlevél-küldési keret MOSTANTÓL BEÉPÍTVE jár
      // minden csomaghoz (nincs többé önálló, külön fizetendő hírlevél-csomag) — lásd
      // `starter_email_cap`/`pro_email_cap`/`egyedi_email_cap` lentebb.
      name: 'salon_starter_huf',
      type: 'number',
      required: true,
      defaultValue: 1900,
      min: 0,
      label: 'Szalon — Starter havidíj (Ft)',
      admin: { description: 'A Starter csomagos szalon havi alapdíja (1 naptár, alap funkciók + a Starter email-keret).' },
    },
    {
      name: 'restaurant_starter_huf',
      type: 'number',
      required: true,
      defaultValue: 12900,
      min: 0,
      label: 'Étterem — Starter havidíj (Ft)',
      admin: { description: 'A Starter csomagos étterem havi fix ára.' },
    },
    {
      // A szalon EGY alapdíja (Start = ennyi flat; Pro = ennyi + per-fő). A korábbi modellből
      // örökölt érték — a mező-slug maradt `salon_pro_huf`, hogy a beállított érték ne vesszen el.
      name: 'salon_pro_huf',
      type: 'number',
      required: true,
      defaultValue: 6800,
      min: 0,
      label: 'Szalon — Pro havidíj (Ft)',
      admin: { description: 'A Pro szalon havi alapdíja (1 naptár + a Pro email-keret) + minden extra munkatárs/naptár.' },
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
      defaultValue: 23800,
      min: 0,
      label: 'Étterem — Pro havidíj (Ft)',
      admin: { description: 'Az étterem havi fix ára forintban (a Pro csomag, a Pro email-kerettel együtt).' },
    },
    {
      // Az "Egyedi" (Enterprise) csomagnak NINCS fix ára — kapcsolatfelvétellel egyeztetik —,
      // de az email-keretét is dinamikusan, itt állítjuk (nem kódba égetve), hogy egy hely
      // maradjon minden árazási/keret-döntésre.
      name: 'starter_email_cap',
      type: 'number',
      required: true,
      defaultValue: 500,
      min: 0,
      label: 'Starter — email-keret (email/hó)',
      admin: { description: 'A Starter csomaghoz beépítve járó havi hírlevél-küldési keret — kemény plafon, naptári hónaponta nullázódik.' },
    },
    {
      name: 'pro_email_cap',
      type: 'number',
      required: true,
      defaultValue: 5000,
      min: 0,
      label: 'Pro — email-keret (email/hó)',
      admin: { description: 'A Pro csomaghoz beépítve járó havi hírlevél-küldési keret.' },
    },
    {
      name: 'egyedi_email_cap',
      type: 'number',
      required: true,
      defaultValue: 50000,
      min: 0,
      label: 'Egyedi — email-keret (email/hó)',
      admin: { description: 'Az Egyedi (Enterprise) csomaghoz járó havi hírlevél-küldési keret — magas, gyakorlatilag nem korlátozó plafon.' },
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
