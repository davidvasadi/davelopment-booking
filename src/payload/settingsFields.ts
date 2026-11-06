import type { Field } from 'payload'

/**
 * Üzlet-csomag — PER ÜZLET. Három érték: `starter` (belépő szint, kisebb email-keret), `pro`
 * (a normál, önkiszolgáló csomag — minden funkció elérhető, nincs funkció-zár) és `egyedi`
 * (testreszabott, kapcsolatfelvétellel egyeztetett deal). A hírlevél-küldés BEÉPÍTVE jár minden
 * csomaghoz (a keret a csomag szerint dől el, lásd `monthlyEmailCapForTier` a `src/lib/tier.ts`-
 * ben). A fiók-díj az üzletek díjából áll össze (lásd src/lib/accountSubscription.ts).
 *
 * ⚠️ BIZTONSÁG: a tulaj NEM írhatja (field-szintű update = admin-only). Grandfathering: a régi
 * (null) csomag `pro`-ként olvasandó (lásd `resolveTier()` a `src/lib/tier.ts`-ben — ez a tényleges
 * biztonsági háló a régi rekordokhoz), tehát a meglévő ügyfelek NEM esnek vissza Starterre. Az
 * ÚJ regisztrációk alapértelmezése viszont Starter — a landing Pro-kártyájáról érkező regisztráció
 * explicit `?tier=pro`-val írja felül, a wizard/API ezt már ténylegesen felismeri.
 */
export const businessTierField: Field = {
  name: 'tier',
  type: 'select',
  required: true,
  defaultValue: 'starter',
  label: 'Csomag',
  options: [
    { label: 'Starter', value: 'starter' },
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
 * Az „Egyedi" (Enterprise) csomag TÉNYLEGES, megegyezés szerinti havidíja — mivel az Egyedi
 * csomagnak nincs fix listaára, ez a mező adja a valódi számlázási alapot, amíg `tier ===
 * 'egyedi'`. `null` esetén (még nincs megegyezés) a díjszámítás a Pro-árra esik vissza
 * (lásd `businessMonthlyFee` a `src/lib/tier.ts`-ben) — ez csak egy ideiglenes becslés-alap,
 * NEM tényleges ajánlat. Admin-only, mint a `tier` mező.
 */
export const customMonthlyFeeField: Field = {
  name: 'custom_monthly_fee_huf',
  type: 'number',
  min: 0,
  label: 'Egyedi havidíj (Ft)',
  access: {
    update: ({ req }) => req.user?.role === 'admin',
  },
  admin: {
    description: 'Csak Egyedi csomagnál számít: a megrendelővel egyeztetett tényleges havidíj. Üresen a Pro-ár a becslés-alap.',
    condition: (data) => data?.tier === 'egyedi',
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
      // Cím-mező kötelezővé tétele FÜGGETLENÜL az előlegtől (pl. saját nyilvántartáshoz,
      // számlázáshoz kell, deposit nélkül is) — lásd ProfileCard/RestaurantCard `addressRequired`.
      { name: 'require_address', type: 'checkbox', defaultValue: false, label: 'Cím megadása mindig kötelező' },
      {
        name: 'require_address_note',
        type: 'text',
        label: 'Cím-kérés indoklása a vendégnek',
        admin: { description: 'Ez a szöveg jelenik meg a vendégnek a cím-mező alatt, hogy értse, miért kérjük. Üresen hagyva egy általános szöveg jelenik meg.' },
      },
      // Csak a szalon-oldalon van UI-ja (dashboard Szolgáltatások oldal, fejléc-ikon) — a
      // szalonnak és az étteremnek közös `booking_rules` csoport miatt a mező az étterem
      // rekordon is létezik, de ott sosem olvasódik/íródik (nincs saját katalógus-nézete,
      // lásd RestaurantCard).
      { name: 'services_expanded_on_main', type: 'checkbox', defaultValue: false, label: 'Szolgáltatások kibontva a főnézeten' },
      // RÉGI, közös kapcsoló — a két külön kapcsoló (alább) váltja; a migráció átmásolta az
      // értékét, olvasni már csak akkor olvassuk, ha az újak még nincsenek kitöltve.
      { name: 'show_catalog_counts_on_public', type: 'checkbox', defaultValue: true, label: 'Szolgáltatás/munkatárs-szám a publikus fejlécen' },
      { name: 'show_service_count_on_public', type: 'checkbox', label: 'Szolgáltatás-szám a publikus fejlécen' },
      { name: 'show_staff_count_on_public', type: 'checkbox', label: 'Munkatárs-szám a publikus fejlécen' },
      // Üzlet-szintű alapértelmezett minimum foglalási idő (óra); munkatársanként felülírható
      // (`staff.min_lead_hours`). Üres = nincs korlát.
      { name: 'min_lead_hours', type: 'number', min: 0, max: 720, label: 'Minimum idő a foglalás előtt (óra)' },
      // A foglaló kártya főnézetének szakasz-sorrendje és rejtett szakaszai (Foglalóoldal-szerkesztő).
      // Üres = alapsorrend, minden látható. Azonosítók: services | voucher | staff | reviews.
      { name: 'public_section_order', type: 'json', label: 'Foglalóoldal szakasz-sorrend' },
      { name: 'public_sections_hidden', type: 'json', label: 'Foglalóoldal rejtett szakaszai' },
      // Az Adatok lépés mező-blokkjainak sorrendje (name | email | phone | address | questions | notes).
      { name: 'form_field_order', type: 'json', label: 'Foglalási űrlap mezőinek sorrendje' },
      // Melyik Adatok-lépés mezőket rejtette el a tulaj TELJESEN (nem csak opcionálissá tette) —
      // csak 'phone'|'notes' lehet benne (a cím-mezőt a saját, finomabb `address_detail_level`
      // vezérli, a név/email sosem rejthető).
      { name: 'hidden_booking_fields', type: 'json', label: 'Teljesen elrejtett foglalási mezők' },
      // A cím-mező RÉSZLETESSÉGE — nem csak be/ki, hanem "csak várost kérek" fokozat is van
      // (pl. egy tanácsadónak elég a város, a pontos utca/házszám felesleges). Előleg aktív
      // esetén ettől FÜGGETLENÜL mindig 'full' érvényesül (számlázáshoz teljes cím kell) — ld.
      // ProfileCard/RestaurantBookingWizard `addressGateOn`/`effectiveAddressLevel`.
      {
        name: 'address_detail_level',
        type: 'select',
        defaultValue: 'full',
        label: 'Cím-mező részletessége',
        options: [
          { label: 'Kikapcsolva', value: 'off' },
          { label: 'Csak város', value: 'city' },
          { label: 'Város + pontos cím', value: 'full' },
        ],
      },
      // A "Szeretnék marketing-ajánlatokat..." checkbox a foglaló űrlapon — függetlenül attól,
      // hogy a hírlevél-küldés maga (ami minden csomagba beépítve jár) be van-e kapcsolva: ez
      // csak azt dönti el, hogy MAGÁN AZ ŰRLAPON megjelenjen-e a feliratkozó-kérdés.
      { name: 'show_marketing_consent_field', type: 'checkbox', defaultValue: true, label: 'Marketing-elfogadó checkbox a foglaláson' },
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
      { name: 'reminder_t_48h', type: 'checkbox', defaultValue: false },
      { name: 'reminder_t_24h', type: 'checkbox', defaultValue: false },
      { name: 'reminder_t_3h', type: 'checkbox', defaultValue: true },
      { name: 'reminder_t_1h', type: 'checkbox', defaultValue: false },
      // Egyedi időzítés órában (pl. 72 = 3 nappal előtte). Üres/0 = nincs.
      { name: 'reminder_custom_hours', type: 'number', min: 0, max: 336 },
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
        defaultValue: 1,
        admin: { description: '1 = 1 órával kezelés után, 2 = 2 órával, 24 = másnap.' },
      },
      // Hova küldjük az elégedett (4–5 csillagos) vendéget a saját értékelő-oldalról (design 16.15): nem mindenkinek a
      // Google a fő hely — étteremnél gyakran a TripAdvisor. Ha a választott link üres, a Google-link a tartalék.
      {
        name: 'review_target',
        type: 'select',
        defaultValue: 'google',
        label: 'Hol értékeljen még',
        options: [
          { label: 'Google', value: 'google' },
          { label: 'TripAdvisor', value: 'tripadvisor' },
          { label: 'Facebook', value: 'facebook' },
        ],
      },
      { name: 'tripadvisor_review_url', type: 'text', label: 'TripAdvisor értékelés link' },
      { name: 'facebook_review_url', type: 'text', label: 'Facebook értékelés link' },
      // A „Foglalj most” gomb beállítása a tulaj saját Google Cégem fiókjában történik, teljesen
      // a mi API-nkon KÍVÜL — ezt sosem tudjuk ténylegesen ellenőrizni/lekérdezni (nincs
      // webhook/API, amin keresztül a Google visszajelezné). Ez a mező ÖNBEVALLÁS: a tulaj maga
      // pipálja ki, miután elvégezte a lépéseket — a UI ezt a tényt is kiírja, hogy ne tűnjön
      // automatikus állapot-ellenőrzésnek.
      { name: 'google_booking_confirmed', type: 'checkbox', defaultValue: false, label: '„Foglalj most” gomb beállítva (önbevallás)' },
      // Ugyanaz a buktató, mint a Google-nél: a Facebook/Instagram "Foglalj" gomb beállítása a
      // tulaj saját Meta Business fiókjában történik, API-n kívül — önbevallás.
      { name: 'facebook_booking_confirmed', type: 'checkbox', defaultValue: false, label: 'Facebook/Instagram „Foglalj” gomb beállítva (önbevallás)' },
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
      // Mikor kérjünk előleget (design 16.1): mindig / X Ft feletti szolgáltatásnál (szalon) / X fő felett (étterem) /
      // kiemelt napokon — a hét kiválasztott napjai és konkrét dátumok (`special_days`: { weekdays: 0–6 (0 = vasárnap), dates: 'YYYY-MM-DD'[] }).
      // A döntés egy helyen van: `depositApplies` (src/lib/depositCalc.ts) — a foglalóoldal és a szerver is azt hívja.
      {
        name: 'apply_when',
        type: 'select',
        defaultValue: 'always',
        label: 'Mely foglalásoknál',
        options: [
          { label: 'Mindig', value: 'always' },
          { label: 'X Ft feletti szolgáltatásnál (szalon)', value: 'min_price' },
          { label: 'X fő felett (étterem)', value: 'min_pax' },
          { label: 'Kiemelt napokon', value: 'special_days' },
        ],
      },
      { name: 'min_price_huf', type: 'number', min: 0, label: 'Ennyi Ft feletti szolgáltatásnál' },
      { name: 'min_pax', type: 'number', min: 1, label: 'Ennyi fő felett' },
      { name: 'special_days', type: 'json', label: 'Kiemelt napok' },
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
      // „Cégként vásárolok (adószámos számla)” opció a vásárlásnál — a tulaj kikapcsolhatja.
      // Csak beállított számlázó (Billingo/Számlázz.hu) mellett jelenik meg.
      { name: 'allow_company', type: 'checkbox', defaultValue: true, label: 'Céges vásárlás engedélyezése' },
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
 * Hírlevél/marketing-kampány beállítások — PER ÜZLET. Fizetős kiegészítő (nem sima be/ki
 * kapcsoló, mint a deposit/voucher) — a `package` a fiók havidíjába (`accountSubscription.ts`
 * → `computeAccountFee`) is beleszámít. A csomagválasztás a dashboard "Marketing" oldaláról
 * történik (nem itt, a Beállításokban — ott csak a mező LÉTEZIK, a UI máshol van).
 */
export const newsletterSettingsFields: Field[] = [
  {
    name: 'newsletter_settings',
    type: 'group',
    label: 'Hírlevél-beállítások',
    fields: [
      {
        // FONTOS: a `defaultValue` itt csak ÚJ szalonokra hat — meglévőknél a mentett DB-érték
        // számít. A hírlevél az árazás-átálláskor (start-tier-plan) minden csomagba BEÉPÍTVE
        // került, nincs önálló hírlevél-fizetés/választás többé — a mezőt csak visszafelé-
        // kompatibilitásból (`!== 'none'` = "engedélyezve" kapcsoló, ld. AppShell nav-rejtés)
        // tartjuk meg, a UI-n (PaymentsSettingsPanel) nincs is választó hozzá, csak infó-kártya.
        name: 'package',
        type: 'select',
        defaultValue: 'ingyenes',
        label: 'Hírlevél-csomag',
        options: [
          { label: 'Kikapcsolva', value: 'none' },
          { label: 'Ingyenes', value: 'ingyenes' },
          { label: 'Alap', value: 'alap' },
          { label: 'Prémium', value: 'premium' },
        ],
      },
      {
        // Belső "küldés folyamatban" zár — a `/api/marketing/send` route ATOMIKUSAN próbálja
        // false→true-ra állítani (egyetlen SQL UPDATE...WHERE), mielőtt a havi email-plafont
        // ellenőrizné. Ha a where nem talál (mert már true), a route elutasítja a kérést —
        // ez zárja be a versenyhelyzetet, amikor ugyanaz az üzlet két kampányt indítana szinte
        // egyszerre, és mindkettő a plafon alatti "már elküldve" számot látná ellenőrzéskor
        // (enélkül összesen túlléphetnék a Resend-keretet). NEM admin-szerkeszthető mező.
        name: 'sending',
        type: 'checkbox',
        defaultValue: false,
        label: 'Kampány-küldés folyamatban (belső zár)',
        admin: { hidden: true },
      },
    ],
  },
]

/**
 * Digitális beleegyező nyilatkozat — kezelés/szolgáltatás előtti hozzájárulás (pl. allergia-
 * vagy egészségügyi nyilatkozat). Egyszerű be/ki kapcsoló + egy sablon-szöveg (sima textarea,
 * nincs rich-text a projektben, ld. `TermsSectionsEditor.tsx`). A tényleges elfogadás
 * per-foglalás történik és a `Bookings`/`Reservations` rekordon tárolódik (ld. ott), NEM itt —
 * ez a group csak a sablont és a be/ki kapcsolót tartja.
 */
export const consentSettingsFields: Field[] = [
  {
    name: 'consent_settings',
    type: 'group',
    label: 'Beleegyező nyilatkozat',
    fields: [
      { name: 'enabled', type: 'checkbox', defaultValue: false, label: 'Beleegyező nyilatkozat bekapcsolva' },
      {
        name: 'title',
        type: 'text',
        localized: true,
        label: 'Nyilatkozat címe',
        admin: { description: 'A vendég ezt a címet látja a lépés/oldal tetején (üresen hagyva: „Beleegyező nyilatkozat").' },
      },
      {
        name: 'template_text',
        type: 'textarea',
        localized: true,
        label: 'Nyilatkozat szövege',
        admin: { description: 'Ezt a szöveget látja a vendég elfogadásra a foglalás során, vagy helyszíni check-inkor.' },
      },
    ],
  },
]

/**
 * Marketing-követés a publikus foglaló oldalon — csak konkrét, névvel felsorolt szolgáltatás
 * (Google Analytics 4 + Facebook Pixel), NEM teljes Google Tag Manager, mert a GTM utólag
 * tetszőleges más szkriptet is engedélyezne a saját felületén keresztül, ami a szigorú CSP-t
 * (`next.config.ts`) érdemben tágra nyitná. A sikeres foglaláskor kimenő esemény mindig anonim
 * (nincs név/telefon/email), ld. `ProfileCard.tsx`/`RestaurantBookingWizard.tsx`.
 */
export const marketingTrackingFields: Field[] = [
  {
    name: 'marketing_tracking',
    type: 'group',
    label: 'Marketing-követés',
    fields: [
      {
        name: 'ga4_measurement_id',
        type: 'text',
        label: 'Google Analytics 4 mérési azonosító',
        admin: { description: 'Pl. G-XXXXXXXXXX' },
      },
      {
        name: 'facebook_pixel_id',
        type: 'text',
        label: 'Facebook (Meta) Pixel ID',
        admin: { description: 'Csak számjegyek, a Meta Események Kezelőjéből.' },
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
        // ki számláz (design 16.7): az üzlet (a csapat alkalmazott) vagy szakemberenként (vállalkozók — mindenki a saját
        // számlázójával, adószámával és Stripe-fiókjával; a munkatárs mezői a Staff kollekcióban)
        name: 'issuer',
        type: 'select',
        defaultValue: 'business',
        label: 'Ki számláz',
        options: [{ label: 'Az üzlet', value: 'business' }, { label: 'Szakemberenként', value: 'staff' }],
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
    // Blokk-alapú tartalom (JSON, `ComposerBlock[]` — lásd lib/emailBlocks.ts), UGYANAZ a
    // szerkesztő-motor, mint a marketing hírlevélé. Az email fix, márkás váza (foglalás-adatok
    // kártyája, lábléc) NEM ide tartozik — az mindig megmarad, ez csak a bevezető rész.
    name: `${type}_email_intro`,
    type: 'json',
    localized: true,
    label: `${labelHu} email bevezető tartalma`,
    admin: { description: `Blokk-szerkesztős tartalom, nyelvenként. Az email tetejére kerül. ${VARS_HINT}` },
  },
]

/** A visszaigazolón (`booking_email_*`) túli tranzakciós emailek szerkeszthető tartalma. */
export const emailTemplateFields: Field[] = [
  ...emailContentPair('cancel', 'Lemondó'),
  ...emailContentPair('reminder', 'Emlékeztető'),
  ...emailContentPair('feedback', 'Visszajelzés-kérő'),
  ...emailContentPair('notify', 'Értesítő (tulajdonosnak)'),
]

/**
 * Google-értékelések (Places API). A tulaj a Beállítások → Google fülön kiválasztja a saját
 * Google-profilját (`google_place_id`); a többi mezőt a napi frissítés tölti (lib/googleReviews.ts)
 * — a publikus oldal ezt a tárolt másolatot mutatja, nem hívja a Google-t látogatásonként.
 * A gyorsítótár-mezőket a beállítás-route-ok nem engedik a kliensnek írni (FORBIDDEN_KEYS).
 */
export const googlePlaceFields: Field[] = [
  { name: 'google_place_id', type: 'text', label: 'Google-profil (Place ID)', admin: { position: 'sidebar' } },
  { name: 'google_place_name', type: 'text', label: 'Google-profil neve', admin: { position: 'sidebar', readOnly: true } },
  { name: 'google_maps_url', type: 'text', label: 'Google Térkép link', admin: { position: 'sidebar', readOnly: true } },
  { name: 'google_rating', type: 'number', label: 'Google-értékelés átlaga', admin: { position: 'sidebar', readOnly: true } },
  { name: 'google_rating_count', type: 'number', label: 'Google-értékelések száma', admin: { position: 'sidebar', readOnly: true } },
  { name: 'google_reviews', type: 'json', label: 'Google-értékelések (gyorsítótár)', admin: { readOnly: true } },
  { name: 'google_reviews_updated_at', type: 'date', label: 'Google-értékelések frissítve', admin: { position: 'sidebar', readOnly: true } },
]

/**
 * A foglalóoldal megjelenése (design 21.x, szerkesztő 21.6 / 16.9) — szalon és étterem közös:
 *  - Arculat: márkaszín (minden kiemelés: fő gomb, kiválasztott sor, időpont), a foglaló kártya stílusa, a betűszín a
 *    kártyán és a márkaszínű gombokon;
 *  - Borítókép: sötétítés (a fókuszpont a meglévő `cover_focal_*` mezőkben);
 *  - Galéria (`gallery`, külön mező): legfeljebb 12 kép felirattal — az első 3 a borítón;
 *  - Értékelések, Közösségi: megjelenjenek-e a borítón;
 *  - Foglalás gomb: saját felirat (nyelvenként), „Legközelebb szabad”, előleg-jelzés;
 *  - Szolgáltatások (szalon): kategória-szűrő, képek, ár · időtartam, sorrend (melyik látszik: `services.online_visible`).
 * Üresen / alapértéken az oldal ugyanúgy néz ki, mint eddig (sötét üveg kártya, a mi sárgánk).
 */
export const publicPageFields: Field[] = [
  {
    name: 'public_page',
    type: 'group',
    label: 'Foglalóoldal megjelenése',
    fields: [
      { name: 'accent_color', type: 'text', label: 'Márkaszín (hex)', admin: { description: 'Pl. #FFD85F — üresen a davelopment sárgája.' } },
      { name: 'card_style', type: 'select', defaultValue: 'dark', label: 'Foglaló kártya', options: [{ label: 'Sötét üveg', value: 'dark' }, { label: 'Fekete', value: 'black' }, { label: 'Világos üveg', value: 'glass' }, { label: 'Fehér', value: 'white' }] },
      { name: 'card_text', type: 'select', defaultValue: 'auto', label: 'Betűszín a kártyán', options: [{ label: 'A kártyához igazodik', value: 'auto' }, { label: 'Fehér', value: 'light' }, { label: 'Sötét', value: 'dark' }] },
      { name: 'button_text', type: 'select', defaultValue: 'auto', label: 'Betűszín a gombokon', options: [{ label: 'A márkaszínhez igazodik', value: 'auto' }, { label: 'Fehér', value: 'light' }, { label: 'Sötét', value: 'dark' }] },
      { name: 'cover_dim', type: 'select', defaultValue: 'soft', label: 'Borító sötétítése', options: [{ label: 'Nincs', value: 'none' }, { label: 'Enyhe', value: 'soft' }, { label: 'Erős', value: 'strong' }] },
      { name: 'show_rating', type: 'checkbox', defaultValue: true, label: 'Értékelés a borítón' },
      { name: 'rating_opens', type: 'checkbox', defaultValue: true, label: 'Az értékelésre kattintva megnyílnak a vélemények' },
      { name: 'show_social', type: 'checkbox', defaultValue: true, label: 'Közösségi linkek a borítón' },
      { name: 'cta_label', type: 'text', localized: true, maxLength: 24, label: 'Foglalás gomb felirata', admin: { description: 'Üresen: „Időpontot foglalok” / „Asztalt foglalok”.' } },
      { name: 'cta_next_free', type: 'checkbox', defaultValue: true, label: '„Legközelebb szabad” a gomb mellett' },
      { name: 'cta_deposit_badge', type: 'checkbox', defaultValue: false, label: 'Előleg jelzése a gombon' },
      { name: 'services_filter', type: 'checkbox', defaultValue: true, label: 'Kategória-szűrő' },
      { name: 'services_images', type: 'checkbox', defaultValue: true, label: 'Szolgáltatás-képek' },
      { name: 'services_price', type: 'checkbox', defaultValue: true, label: 'Ár és időtartam' },
      { name: 'services_order', type: 'select', defaultValue: 'manual', label: 'Szolgáltatások sorrendje', options: [{ label: 'Kézi', value: 'manual' }, { label: 'Népszerű elöl', value: 'popular' }] },
    ],
  },
  {
    name: 'gallery',
    type: 'array',
    maxRows: 12,
    label: 'Galéria',
    admin: { description: 'Legfeljebb 12 kép — az első 3 a borítón látszik. A felirat a kép alatt és az alt-szöveg is.' },
    fields: [
      { name: 'image', type: 'upload', relationTo: 'media', required: true, label: 'Kép' },
      { name: 'caption', type: 'text', localized: true, maxLength: 120, label: 'Felirat' },
    ],
  },
]
