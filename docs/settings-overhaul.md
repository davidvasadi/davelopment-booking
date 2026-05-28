# Beállítások átalakítás — terv (salon + restaurant)

## Cél

A beállítások oldal rendberakása **mindkét cégtípusra** (salon és restaurant),
közös elven. Négy nagy feladat, fázisokban, minden fázis után jóváhagyással.

> **Munkamódszer:** Minden fázis előtt engedélyt kérek a kódmódosításra.
> Egyszerre csak egy fázis. Cél: a rendszer ne omoljon össze.

---

## Jelenlegi állapot (felmérés)

- **Restaurant settings:** `src/app/(app)/restaurant/settings/page.tsx` →
  `src/components/restaurant/RestaurantSettingsForm.tsx` (504 sor, grid 2 oszlop,
  `Section` kártyák).
- **Salon settings:** `src/components/dashboard/SalonSettingsForm.tsx` (még felmérni).
- **Email:** `src/lib/email.ts` — jelenleg **salon-központú** (`sendBookingConfirmation`,
  `confirmationHtml`, ICS-csatolmány). A restaurant email-útját külön ellenőrizni kell.
- **Séma:** `Restaurants` és `Salons` collection — most nincs email-testreszabás
  és nincs ÁSZF mező.
- **Kapacitás mód:** `capacity_mode: 'tables' | 'flat'` — a `flat` a slot-logikában
  (`src/lib/restaurantBooking.ts`) is használt. Csak a **restaurant** érinti.

---

## Eldöntött döntések

| Téma | Döntés |
|------|--------|
| Flat mód | **Teljesen kivenni mindenhonnan** (UI + slot-logika). Séma-mező sorsa: lásd lent. |
| Email testreszabás | **Teljes HTML szerkesztő** — a cég a teljes törzset szerkeszti, változó-behelyettesítéssel + logó. |
| ÁSZF | **Feltöltött PDF**, link a foglaló oldalon + a visszaigazoló emailben. |
| Hatókör | **Mindkét cégtípus** (salon + restaurant), közös elven. |

---

## Fázisok

### 1. fázis — Flat mód kivétele + Settings layout UX
- A `capacity_mode` választó eltávolítása a restaurant settings UI-ból (mindig `tables`).
- A `flat` ág kivétele a slot-generálásból (`restaurantBooking.ts`) és minden
  egyéb helyről, ahol elágazik.
- A `max_pax` mező sorsának tisztázása (csak flat-nél volt látható).
- Settings layout UX: szekciók logikus csoportosítása, profibb elrendezés
  (restaurant + salon).
- **Séma:** a `capacity_mode`/`flat` enum értéket egyelőre a sémában hagyjuk
  (meglévő rekordok!), csak a UI/logika nem használja. Migráció külön.

### 2. fázis — „Foglalási feltételek" (strukturált, szakaszos)
- **Elnevezés:** a vendég felé **„Foglalási feltételek"** (nem ÁSZF).
- **Adatmodell (végleges):** `terms_sections: [{ title, body }]` **array mező**
  mindkét collectionbe (a korábbi `terms_text` egymezős verziót lecseréljük).
- **Szerkesztő (Dokumentumok fül):** szakaszonként cím + szöveg, hozzáad/töröl/
  átrendez, + **sablon-betöltés** (alap szakaszok: Lemondás, Késés, stb.).
- **Vendég oldal:** glass-**modal** a foglaló oldalon, szépen formázott
  szakaszokkal (cím + bekezdés). Üres esetén nem jelenik meg.
- **Email:** a visszaigazoló emailben hivatkozás/rövid utalás a feltételekre.

### 2/B fázis — Cégadatok (jogi) + auto „Szolgáltató adatai" blokk
- **Új mezők** mindkét collectionbe (egy `company` group, vagy lapos mezők):
  `legal_name` (hivatalos cégnév), `tax_number` (adószám),
  `company_reg_number` (cégjegyzékszám), `registered_seat` (székhely).
  (A meglévő email/telefon a kapcsolathoz használható.)
- A `TermsModal` és az email **automatikusan** egy „Szolgáltató adatai" blokkot
  jelenít meg a Foglalási feltételek **elején**, ezekből a mezőkből + a meglévő
  kapcsolatból. Üres mezők kimaradnak.
- Settings: a Dokumentumok fülön egy „Cégadatok" szekció a mezőkkel (a szakaszok
  fölött).

### 3. fázis — Email testreszabás (BIZTONSÁGOS: szöveg + változók + logó)
- **Döntés (módosítva a teljes-HTML helyett):** NEM nyers HTML. A cég egy
  **üzenet-szöveget** ad meg (sima szöveg, nem HTML), ami a fix, biztonságos
  email-vázba kerül. Plusz a cég **logója** a fejlécben. **Változók**:
  `{{name}}`, `{{date}}`, `{{time}}`, `{{pax}}` stb. — szerver-oldali, kontrollált
  behelyettesítés (a user-szöveg HTML-escape-elve megy a sablonba → nincs XSS).
- Új mezők: `booking_email_intro` (textarea) + opcionálisan `booking_email_subject`
  (text) mindkét collectionbe.
- Két email-fájl érintett: `email.ts` (salon) + `restaurantEmail.ts` (restaurant).
- Email-fül a settingsben (mindkét form) változó-súgóval.
- **Itt jön be a 2. fázis feltétel-utalása is** a confirmation emailbe.

### 3. fázis — HTML email-szerkesztő (eredeti megfogalmazás, felülírva fent)
- Új mezők mindkét collectionbe: pl. `booking_email_html` (richText/textarea),
  esetleg `booking_email_subject`.
- Szerkesztő UI a settings formban, támogatott **változókkal**
  (pl. `{{customer_name}}`, `{{date}}`, `{{time}}`, `{{pax}}`, `{{cancel_url}}`).
- `email.ts` átírása: ha a cégnek van saját sablonja, azt használja (logóval,
  változó-behelyettesítéssel); különben a jelenlegi alapértelmezett.
- Biztonság: a változó-behelyettesítés szerv-oldalon, kontrollált helyettesítéssel
  (nem nyers user-HTML injektálás ellenőrzés nélkül).

---

## Flat / max_pax felmérés (1. fázis hatóköre)

A `flat` mód és a `max_pax` **mélyen beágyazott** — a teljes kivétel ezeket érinti:

**`capacity_mode === 'flat'` elágazások:**
- `src/lib/restaurantBooking.ts` — 6 helyen (slot-gen, getMaxPax, getMoveOptions,
  validateAndAllocate, validateManualReservation).
- `src/lib/restaurantStats.ts:153` — befogadóképesség számítás.
- `src/components/restaurant/DailyView.tsx:377,655` — Timeline és Floor flat-nézet.
- `src/app/(app)/restaurant/bookings/page.tsx:35`, `tables/page.tsx:31`.
- `src/lib/restaurantTemplates.ts:218` — egy sablon flat (átállítandó tables-re).
- `src/payload/collections/Restaurants.ts:113-120` — séma enum.

**`max_pax` használat:**
- Settings form (UI), RestaurantPublicView ("Max X fő"), RestaurantBookingWizard
  (pax felső korlát!), DailyView flat-nézet, restaurantStats, getMaxPax,
  validateManualReservation, seed-template, restaurantTemplates.

**FONTOS — a pax felső korlát:** a `RestaurantBookingWizard` a `maxPax`-ot a
foglalható létszám felső határaként használja. `tables` módban ezt a
`getMaxPax()` adja (a legnagyobb elérhető asztalkapacitás), **nem** a `max_pax`
mező. Tehát a `max_pax` mező eltávolítása után is kell a `getMaxPax()` tables-ág.

**Döntés (clean kód):** mivel a `max_pax` a flat módon kívül sehol nem hasznosul
értelmesen, a `flat` ággal együtt **teljesen eltávolítjuk** (UI + logika + séma).
A `getMaxPax()` tables-ága marad. A `restaurantStats` és a publikus "Max X fő"
infó a tables-összkapacitásra vált.

## Nyitott kérdések (fázisonként tisztázandó)

- **1. fázis:** ELDÖNTVE — flat + max_pax teljesen ki.
- **2. fázis:** Az ÁSZF kötelező elfogadás (checkbox) helyett most **csak link** —
  ez eldöntve. Kell-e a salonnak és restaurantnak külön ÁSZF, vagy közös?
- **3. fázis:** Milyen változókat támogassunk? Engedjünk-e nyers HTML-t, vagy
  korlátozott (sanitizált) markupot?

---

## Haladás napló

- [x] **1/A fázis — Flat + max_pax teljes kivétele** ✅
  - Séma: `Restaurants` collection `capacity_mode` + `max_pax` mező törölve.
  - `restaurantBooking.ts`: mind a flat-ág eltávolítva; `getMaxPax` mindig tables.
  - `restaurantStats.ts`: befogadóképesség mindig tables-összkapacitás.
  - `DailyView.tsx`: `capacityMode`/`maxPax` propok + flat Timeline/Floor nézet törölve.
  - `ReservationEditSheet.tsx`: `capacityMode` prop törölve, mindig tables.
  - `bookings/page`, `tables/page`, `restaurantTemplates`, `seed-template`,
    `RestaurantPublicView` ("Max X fő" kártya) takarítva.
  - `payload-types.ts` frissítve. Typecheck tiszta (a `maxPax` a getMaxPax-os
    létszám-korlát, az marad).
- [x] **1/B fázis — Settings layout UX (fülezett)** ✅
  - Új `src/components/ui/settings-tabs.tsx` (`SettingsTabsNav`) — felső fül-sáv,
    mentetlen-pont jelzővel.
  - `ConfirmDialog` bővítve opcionális harmadik gombbal (`tertiaryLabel`/`onTertiary`).
  - **Restaurant + Salon form** átszervezve fülekre: **Általános / Foglalás /
    Veszélyzóna**. Fülenkénti mentés (`SaveBar`) + globális „Összes mentése".
  - Dirty-követés fülenként (restaurant: kézi state-diff; salon: rhf `dirtyFields`).
  - Mentetlen-védelem: fülváltáskor glass `ConfirmDialog` (Mentés / Elvetés / Mégse).
  - Salon törlés natív `confirm()` → glass `ConfirmDialog`.
  - Email + Dokumentumok fülek a 2-3. fázisban jönnek.

- [ ] 1/B fázis — Settings layout UX (régi sor, lásd fent)
  - **Döntés:** fülezett elrendezés — bal oldali (vagy felső) fül-menü + jobb
    tartalom. Indok: sok tartalom jön (email-szerkesztő, ÁSZF), a fülek
    skálázódnak, nem lesz végtelen scroll.
  - Fülek (tervezett): **Általános** (alap adatok, elérhetőség, borítókép,
    nyilvános oldal) · **Foglalás** (foglalási beállítások) · **Email** (3. fázis) ·
    **Dokumentumok/ÁSZF** (2. fázis) · **Veszélyzóna**.
  - Közös, újrahasználható fül-keret komponens, hogy salon + restaurant ugyanazt
    használja.
  - A meglévő `Section` kártyák a füleken belül maradnak.
  - **Mentés mechanika (eldöntve):**
    - **Fülenként külön mentés** (az adott fül mezőit menti) **és** egy
      **globális "Összes mentése"** is (minden fül egyszerre).
    - **Mentetlen-védelem:** a fülön kis "mentetlen" jelző (pont); másik fülre
      váltáskor a meglévő `ConfirmDialog`-ot (glass/blur) használjuk
      `destructive={false}` semleges variánssal — "Mented előbb a változásokat?"
      (Mentés / Elvetés / Mégse). Nem veszhet el módosítás.
    - Technikailag: egy közös `form` state, fülenként dirty-követés (mely mezők
      változtak az adott fülön), a fül-mentés csak az adott fül mezőit PATCH-eli.
- [x] **2. fázis — „Foglalási feltételek" (szakaszos)** ✅
  - Séma: `terms_sections` array (`{title, body}`) Restaurants + Salons + típusok.
  - Közös `TermsSectionsEditor` (add/töröl/átrendez + sablon) — Dokumentumok fül
    mindkét formban.
  - Közös `TermsModal` (glass) — a foglaló wizardokban „Foglalási feltételek"
    link, modalban formázott szakaszok. Restaurant + Salon wizard bekötve.
  - **Email-utalás:** a 3. fázisba összevonva (közös `email.ts` átírás).
- [ ] ~~2. fázis — ÁSZF feltöltés~~ (átnevezve/kész fent)
- [x] **2/B fázis — Cégadatok + auto „Szolgáltató adatai" + profi sablon** ✅
  - Séma: `legal_name`, `tax_number`, `company_reg_number`, `registered_seat`
    Restaurants + Salons + típusok.
  - Settings „Dokumentumok" fülön „Cégadatok" szekció (mindkét form).
  - `TermsModal` automatikusan „Szolgáltató adatai" blokkot épít a cégadatokból
    (üres mezők kimaradnak), a feltételek élére. Mindkét wizard átadja a `company`-t.
  - Bővített, profi `TERMS_TEMPLATE` (Ált. rendelkezések, foglalás menete,
    lemondás, késés, GDPR, felelősség, panaszkezelés) + **jogi figyelmeztetés**
    a szerkesztőben (a sablon csak váz, jogásszal ellenőriztetni ajánlott).
- [x] **3. fázis — Email testreszabás (biztonságos: szöveg + változók)** ✅
  - Séma: `booking_email_subject` (text) + `booking_email_intro` (textarea)
    Restaurants + Salons + típusok.
  - `email.ts` + `restaurantEmail.ts`: közös escape-elt `renderTemplate`/
    `renderSubject`. A user-szöveg HTML-escape-elve megy a sablonba (nincs XSS),
    `{{var}}` behelyettesítés trusted értékekkel. Salon: `{{name}}/{{date}}/
    {{time}}/{{service}}`, restaurant: `{{name}}/{{date}}/{{time}}/{{pax}}`.
  - Intro-blokk a confirmation email tetején (részletek elé), egyedi tárgy ha van.
  - **2. fázis feltétel-utalás:** `termsNote()` — ha van `terms_sections`,
    rövid utalás a feltételekre a confirmation emailben.
  - UI: új „Email" fül mindkét formban (változó-súgóval), fülenkénti mentés +
    dirty-követés. `settings/page.tsx` initial-mapping bővítve.
  - (Mellesleg javítva egy meglévő tsc-hiba: `notificationHtml` `customer_phone`
    null-kezelés.)
- [x] **3/B fázis — Arculatos email-sablon (teljes újratervezés)** ✅
  - Új közös `src/lib/emailLayout.ts`: egységes „dark header / light body /
    dark footer" váz, minden kliensben megbízható (nincs dark-mode media query).
    Helperek: `emailLayout`, `heroBlock`, `detailsCard`, `infoRow`, `introBlock`,
    `cancelBlock`, `termsBlock`, `bottomSpacer`, `renderTemplate`/`renderSubject`.
  - `email.ts` + `restaurantEmail.ts` teljesen erre épül (a duplikált wrapper/
    infoRow megszűnt).
  - **Fejléc = a VENDÉG cég brandingje** (nem Schedulio): a feltöltött
    `cover_image` banner felül, alatta a `logo` középen; ha nincs logó/borító,
    a cég neve igényes tipográfiával. A logó+borító a settings „Általános"
    fülön feltöltött mezőkből jön automatikusan (nincs külön email-kapcsoló).
    A route-ok default depth-tel töltik a Media relációt (`mediaUrl` fallback:
    ha string-ID jönne, a cég neve jelenik meg).
  - **Logók PNG-ben** (SVG-t a kliensek nem renderelnek): `public/email/`-be
    generálva sharp-pal (Schedulio + davelopment szóvédjegy). Abszolút URL.
  - **Footer:** csak a két kattintható logó (Schedulio → schedulio.hu,
    davelopment → davelopment.hu), külön cégnév-szöveg NÉLKÜL.
  - Étterem-emailből az **„Asztal" sor kivéve** (nem mutatjuk a vendégnek).
  - Fejléc: ha van borító+logó, a **logó ráül a borítóra** (lekerekített fehér
    kártya, negatív margós overlay). A borító a meglévő `cover_image` (ugyanaz,
    mint a foglaló landingen) — nincs külön email-kép. Feltöltés: settings
    „Általános" fül (logó + borító már bekötve).
  - **Feltétel-utalás kattintható**: a foglaló oldalra (`/[slug]` ill.
    `/[slug]/book`) mutató kék link.
  - Footer: a két logó **egymás mellett**, függőleges elválasztóval.
  - Olvashatóság: halvány szövegek kontrasztja emelve (textFaint #71717a).
  - Visszaigazolóban a **foglaló neve + email** a részletek tetején, plusz egy
    **kontakt-blokk** (`contactBlock`): „Módosítanád a foglalást? Keress minket"
    — kattintható telefon (tel:), email (mailto:), cím.
  - **A kontakt-blokk admin-vezérelt** (settings „Email" fül kapcsolók):
    `email_show_phone` / `email_show_email` / `email_show_address` +
    `email_show_directions` (Útvonaltervezés gomb → Google Maps) + külön
    `email_contact_phone` (módosítási tel.) és `email_directions_address`
    (cím/Maps-link; üresen a sima címre esik vissza). Séma + típusok +
    initial-mapping + rhf default mindkét collectionben.
  - **Email fül UX/UI újratervezve** (mindkét form): felül kiemelt előnézet-sáv
    (gradient kártya + „Előnézet" gomb), „Tartalom" kártya változó-chipekkel,
    „Kapcsolat & útvonal" kártya elválasztott kapcsoló-listával. Közös
    `emailPreviewUrl()` helper építi az előnézet-URL-t a (mentetlen) állapotból.
  - `/api/email-preview` route fogadja a `dir`/`dirAddr` paramétereket is.
  - **Email előnézet gomb** a settings „Email" fülén (mindkét form): új fülön a
    `/api/email-preview` route-ot nyitja az aktuálisan beírt bevezetővel
    (`?type=&intro=`). A route mintaadattal a valódi sablont rajzolja (élesben is
    elérhető, nincs benne érzékeny adat).
