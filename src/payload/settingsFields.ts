import type { Field } from 'payload'

/**
 * Üzlet-csomag — PER ÜZLET. Két érték: `pro` (a normál, önkiszolgáló csomag — minden funkció
 * elérhető) és `egyedi` (testreszabott, kapcsolatfelvétellel egyeztetett deal). A fiók-díj az
 * üzletek díjából áll össze (lásd src/lib/accountSubscription.ts).
 *
 * ⚠️ BIZTONSÁG: a tulaj NEM írhatja (field-szintű update = admin-only). Az `egyedi`-t admin
 * állítja (a megrendelővel egyeztetve). Grandfathering: a régi (null) csomag `pro`-ként olvasandó.
 */
export const businessTierField: Field = {
  name: 'tier',
  type: 'select',
  required: true,
  defaultValue: 'pro',
  label: 'Csomag',
  options: [
    { label: 'Pro (normál)', value: 'pro' },
    { label: 'Egyedi', value: 'egyedi' },
  ],
  access: {
    update: ({ req }) => req.user?.role === 'admin',
  },
  admin: {
    description: 'Az üzlet csomagja. A normál a „Pro"; az „Egyedi" a testreszabott (admin állítja, a megrendelővel egyeztetve).',
  },
}

/**
 * Közös, valós beállítás-mezők a Salon ÉS Restaurant collectionhöz — a davelopment booking
 * Csomag roadmap „élővé" tett részei: értesítési preferenciák (esemény × csatorna),
 * foglalási-szabály kapcsolók, és a kapcsolható foglalási funkció-modulok.
 * Mentés a meglévő PATCH /api/salons|restaurants/:id úton (collection-mezők).
 */
export const settingsExtensionFields: Field[] = [
  {
    name: 'notification_prefs',
    type: 'group',
    label: 'Értesítési beállítások',
    fields: [
      { name: 'confirm_email', type: 'checkbox', defaultValue: true },
      { name: 'cancel_email', type: 'checkbox', defaultValue: true },
      // DEPRECATED (2026-07-08): az emlékeztető/visszajelzés gazdája a Funkciók oldal
      // (`feature_modules`). A mezők megmaradnak (adatvesztés/migráció nélkül), de az app
      // már NEM olvassa/írja őket — nincs dupla-gate. Törölni majd külön migrációval lehet.
      { name: 'reminder_email', type: 'checkbox', defaultValue: true },
      { name: 'feedback_email', type: 'checkbox', defaultValue: false },
    ],
  },
  {
    name: 'booking_rules',
    type: 'group',
    label: 'Foglalási szabály-kapcsolók',
    fields: [
      { name: 'auto_confirm', type: 'checkbox', defaultValue: true },
      // DEPRECATED (2026-07-08): a depozit/no-show fizetési integrációt igényel („Hamarosan"),
      // a várólista gazdája a Funkciók oldal (`feature_modules.waitlist_on`). Megmaradnak, de
      // az app már NEM olvassa/írja őket. Törlés külön migrációval.
      { name: 'deposit_enabled', type: 'checkbox', defaultValue: false },
      { name: 'waitlist_enabled', type: 'checkbox', defaultValue: false },
      { name: 'cancellation_protection', type: 'checkbox', defaultValue: false },
    ],
  },
  {
    name: 'feature_modules',
    type: 'group',
    label: 'Foglalási funkciók (kapcsolható modulok)',
    fields: [
      { name: 'reminders_on', type: 'checkbox', defaultValue: true },
      { name: 'reminder_ch_email', type: 'checkbox', defaultValue: true },
      { name: 'reminder_ch_push', type: 'checkbox', defaultValue: false },
      { name: 'reminder_t_24h', type: 'checkbox', defaultValue: true },
      { name: 'reminder_t_3h', type: 'checkbox', defaultValue: true },
      { name: 'reminder_t_1h', type: 'checkbox', defaultValue: false },
      { name: 'waitlist_on', type: 'checkbox', defaultValue: false },
      { name: 'waitlist_auto_promote', type: 'checkbox', defaultValue: false },
      { name: 'recurring_on', type: 'checkbox', defaultValue: false },
      { name: 'reviews_on', type: 'checkbox', defaultValue: false },
      // Ha ki van töltve, a visszajelzés-email a Google értékelő-oldalra visz (különben a belső /review).
      {
        name: 'google_review_url',
        type: 'text',
        label: 'Google értékelés link',
        admin: { description: 'A Google Cégprofil „Kérj értékeléseket" linkje (pl. https://g.page/r/…/review). Üresen a belső értékelés marad.' },
      },
    ],
  },
]

/**
 * Szerkeszthető email-tartalom (tárgy + bevezető) a tranzakciós vendég-emailekhez — a
 * `booking_email_*` (visszaigazoló) mintájára, localized (nyelvenként a dashboard nyelvváltóval).
 * A template üresen hagyva az alap tárgyat/bevezetőt használja. Bővíthető: új típus = új sor.
 */
const VARS_HINT = 'Változók: {{name}}, {{date}}, {{time}}, {{pax}}.'
const emailContentPair = (type: string, labelHu: string): Field[] => [
  {
    name: `${type}_email_subject`,
    type: 'text',
    localized: true,
    label: `${labelHu} email tárgya`,
    admin: { description: `Opcionális, nyelvenként. Üresen → alap tárgy. ${VARS_HINT}` },
  },
  {
    name: `${type}_email_intro`,
    type: 'textarea',
    localized: true,
    label: `${labelHu} email bevezető szövege`,
    admin: { description: `Sima szöveg, nyelvenként. Az email tetejére kerül. ${VARS_HINT}` },
  },
]

/** A visszaigazolón (`booking_email_*`) túli tranzakciós emailek szerkeszthető tartalma. */
export const emailTemplateFields: Field[] = [
  ...emailContentPair('cancel', 'Lemondó'),
  ...emailContentPair('reminder', 'Emlékeztető'),
  ...emailContentPair('feedback', 'Visszajelzés-kérő'),
]
