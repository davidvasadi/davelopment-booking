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
      { name: 'modification_email', type: 'checkbox', defaultValue: false, label: 'Módosítás email a vendégnek' },
      { name: 'digest_morning_email', type: 'checkbox', defaultValue: false, label: 'Reggeli összefoglaló (szalon)' },
      { name: 'digest_evening_email', type: 'checkbox', defaultValue: false, label: 'Esti összefoglaló (szalon)' },
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
      { name: 'reminder_t_24h', type: 'checkbox', defaultValue: false },
      { name: 'reminder_t_3h', type: 'checkbox', defaultValue: true },
      { name: 'reminder_t_1h', type: 'checkbox', defaultValue: false },
      { name: 'waitlist_on', type: 'checkbox', defaultValue: false },
      { name: 'waitlist_auto_promote', type: 'checkbox', defaultValue: false },
      { name: 'recurring_on', type: 'checkbox', defaultValue: false },
      { name: 'reviews_on', type: 'checkbox', defaultValue: false },
      {
        name: 'google_review_url',
        type: 'text',
        label: 'Google értékelés link',
        admin: { description: 'A Google Cégprofil „Kérj értékeléseket" linkje (pl. https://g.page/r/…/review).' },
      },
      {
        name: 'review_delay_hours',
        type: 'number',
        label: 'Értékelés-kérés késleltetése (óra)',
        defaultValue: 2,
        admin: { description: '1 = 1 órával kezelés után, 2 = 2 órával, 24 = másnap.' },
      },
    ],
  },
]

/**
 * Vendég-előleg beállítások — PER ÜZLET, owner-írható (nincs field-szintű access, a
 * collection-szintű owner-or-admin öröklődik). A `type` opciók listája szándékosan tartalmaz
 * olyat is (`percent` szalonnál, `per_pax` étteremnél), amit a Settings UI a saját oldalán
 * elrejt — a séma közös, csak a UI szűri, hogy melyik opció értelmes az adott üzlettípusnál
 * (a szalonnak van `service.price`, az étteremnek nincs ár-mezője a foglaláson, csak fejenkénti
 * összeg adható meg értelmesen).
 */
export const depositSettingsFields: Field[] = [
  {
    name: 'deposit_settings',
    type: 'group',
    label: 'Előleg-beállítások',
    fields: [
      { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Előleg bekapcsolva' },
      {
        name: 'type',
        type: 'select',
        defaultValue: 'fixed',
        label: 'Előleg típusa',
        options: [
          { label: 'Fix összeg (Ft)', value: 'fixed' },
          { label: 'Százalék', value: 'percent' },
          { label: 'Fejenként (Ft)', value: 'per_pax' },
        ],
      },
      { name: 'fixed_amount_huf', type: 'number', min: 0, label: 'Fix előleg (Ft)' },
      { name: 'percent_value', type: 'number', min: 1, max: 100, label: 'Előleg (%)' },
      { name: 'per_pax_amount_huf', type: 'number', min: 0, label: 'Előleg / fő (Ft)' },
      {
        name: 'refund_hours_before',
        type: 'number',
        defaultValue: 24,
        label: 'Ingyenes lemondás határideje (óra)',
        admin: { description: 'Ennyi órával a foglalás előtt még teljes visszatérítés jár. Ezután nem jár vissza.' },
      },
      {
        name: 'payment_gateway',
        type: 'select',
        defaultValue: 'none',
        label: 'Fizetési szolgáltató',
        options: [
          { label: 'Stripe', value: 'stripe' },
          { label: 'SimplePay (hamarosan)', value: 'simplepay' },
          { label: 'Nincs', value: 'none' },
        ],
        admin: { description: 'Jelenleg csak a Stripe aktív — a SimplePay a jövőbeli integráció helye.' },
      },
    ],
  },
]

/**
 * Ajándékutalvány beállítások — PER ÜZLET. Ugyanazt a Stripe Connect-fiókot használja, mint az
 * előleg (`stripeConnectFields` lent) — nincs második Connect-integráció. A vásárló szabadon
 * beírt összeggel vásárol (nincs preset-lista), a min/max csak visszaélés elleni szerver-oldali
 * korlát.
 */
export const voucherSettingsFields: Field[] = [
  {
    name: 'voucher_settings',
    type: 'group',
    label: 'Ajándékutalvány-beállítások',
    fields: [
      { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Ajándékutalvány bekapcsolva' },
      { name: 'min_amount_huf', type: 'number', min: 0, defaultValue: 2000, label: 'Minimum összeg (Ft)' },
      { name: 'max_amount_huf', type: 'number', min: 0, defaultValue: 100000, label: 'Maximum összeg (Ft)' },
      {
        name: 'validity_months',
        type: 'number',
        min: 1,
        defaultValue: 12,
        label: 'Érvényesség (hónap)',
        admin: { description: 'A vásárlástól számítva ennyi hónapig váltható be az utalvány.' },
      },
    ],
  },
]

/**
 * Stripe Connect állapot-mezők — ROOT-SZINTEN (nem a `deposit_settings` group-ban) és
 * admin-only `access.update`-tel, mert a Salon/Restaurant Settings PATCH route
 * (`src/app/api/salon|restaurant/settings/route.ts`) `overrideAccess: true`-val ment, ami a
 * mező-szintű `access`-t megkerülné — a route SAJÁT `FORBIDDEN_KEYS` listája védi ezt a két
 * mezőt ténylegesen (a `field.access` itt csak a nyers Payload admin/API felől ad védelmet).
 * Az értéküket KIZÁRÓLAG szerver-oldali kód írhatja (Connect onboarding callback / webhook) —
 * sosem a tulaj felőli settings-form.
 */
export const stripeConnectFields: Field[] = [
  {
    name: 'stripe_connect_account_id',
    type: 'text',
    label: 'Stripe Connect fiók azonosító',
    access: { update: ({ req }) => req.user?.role === 'admin' },
    admin: { position: 'sidebar', readOnly: true, description: 'A Stripe onboarding állítja — nem szerkeszthető.' },
  },
  {
    name: 'stripe_connect_onboarded',
    type: 'checkbox',
    defaultValue: false,
    label: 'Stripe onboarding kész',
    access: { update: ({ req }) => req.user?.role === 'admin' },
    admin: { position: 'sidebar', readOnly: true },
  },
]

/**
 * Számlázás-beállítások az előleg-fizetés után kiállított bizonylathoz — az üzlet SAJÁT
 * Számlázz.hu/Billingo fiókjával, nem a platforméval. A kulcs-mezők (`*_key_enc`) TITKOSÍTVA
 * tárolódnak (`src/lib/encryption.ts`), és `access.read: () => false`-szal ki vannak zárva
 * minden API-válaszból — a kliens sosem kapja vissza a nyers értéket, csak azt tudja, hogy be
 * van-e állítva (a Settings UI ezt maszkolt placeholderként jeleníti meg).
 */
export const invoiceSettingsFields: Field[] = [
  {
    name: 'invoice_settings',
    type: 'group',
    label: 'Számlázási beállítások',
    fields: [
      {
        name: 'invoice_provider',
        type: 'select',
        defaultValue: 'none',
        label: 'Számlázó',
        options: [
          { label: 'Számlázz.hu', value: 'szamlazz' },
          { label: 'Billingo', value: 'billingo' },
          { label: 'Nincs (csak fizetés, bizonylat nélkül)', value: 'none' },
        ],
      },
      {
        name: 'szamlazz_agent_key_enc',
        type: 'text',
        label: 'Számlázz.hu Agent kulcs',
        access: { read: () => false },
        admin: { position: 'sidebar', description: 'Titkosítva tárolva — a mentés után nem jelenik meg újra.' },
      },
      {
        name: 'billingo_api_key_enc',
        type: 'text',
        label: 'Billingo API kulcs',
        access: { read: () => false },
        admin: { position: 'sidebar', description: 'Titkosítva tárolva — a mentés után nem jelenik meg újra.' },
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
  ...emailContentPair('notify', 'Értesítő (tulajdonosnak)'),
]
