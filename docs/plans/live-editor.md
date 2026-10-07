# Foglalóoldal élő szerkesztő + Beállítások átszervezése

Jóváhagyott makett: https://claude.ai/artifact/YM5Wb2CFcukQJzWas2xUpK (v16, 2026-10-06)

## Cél

A Beállítások → „Üzlet profil” helyére egy **Framer-szerű élő szerkesztő** kerül („Foglalóoldal”):

- a vásznon a **valódi** külső foglalóoldal látszik (ugyanazok a komponensek, nem másolat);
- bármire kattintasz → kijelölődik (sárga keret) → **minden szerkesztés a jobb oldali panelben** történik, a vásznon nincs eszköz;
- a szakaszok és az űrlapmezők **húzással** átrendezhetők (vásznon és a panelben is);
- a foglalás **teljes folyamata** bejárható és szerkeszthető;
- mentés a meglévő alsó lebegő „Mentetlen változások · Elvetés · Mentés” sávval;
- mobilon is működik (kijelölés → alulról felcsúszó panel).

Közben a Beállítások menü átrendeződik; a többi aloldal **kinézete nem változik**, csak a helyük és néhány blokk.

Első kör: **szalon**. Az étterem (RestaurantPublicView) külön, későbbi fázis.

---

## 1. Új Beállítások menü

| Csoport | Menüpont | Honnan / mi változik |
|---|---|---|
| Üzlet | **Foglalóoldal** (ÚJ) | Üzlet profil + Foglalás fül + Nyelvek + egyedi kérdések + Jó tudni + nyilatkozat be/ki |
| | Nyitvatartás | változatlan (link) |
| | Dokumentumok & jogi | változatlan (ÁSZF, nyilatkozat-sablon) |
| Vendégek (ÚJ csoport) | **Vendég e-mailek** | a mostani Email-sablonok (Visszaigazolás, Lemondás, Emlékeztető, Visszajelzés) + a vendég-e-mailek be/ki kapcsolói (eddig Értesítések) + Kapcsolat & útvonal |
| | **Hírlevél** | a Fizetés oldal hírlevél-blokkja |
| Pénzügy | Fizetés & előleg | Stripe + Depozit (a hírlevél, utalvány, számlázó kikerül) |
| | **Ajándékutalvány** | a Fizetés oldal utalvány-része, saját menüpontként |
| | **Számlázás** | a Fizetés oldal számlázó-része, saját menüpontként |
| Kapcsolatok | Google | változatlan |
| | API & integrációk | változatlan |
| Csapat | Csapat & jogok | változatlan |
| | Telephelyek | Fiók alól ide |
| Fiók | Saját profil, Előfizetés, Audit-napló, Fiók törlése | változatlan |
| | Értesítések | + „Értesítés új foglalásokról” (`notify_new_bookings`, eddig Foglalás fül) + az „Értesítő” e-mail sablon (a tulajnak szól); − vendég-e-mail kapcsolók |

Megszűnő menüpontok: Üzlet profil, Foglalás, Nyelvek, Email-sablonok (→ Vendég e-mailek).
A régi `?tab=` / rail-azonosítókhoz átirányítási térkép kell (`profile|booking|languages → site`, `email → guest-email` stb.), hogy a meglévő linkek (onboarding, SetupNudge, súgó) ne törjenek.

**Érintett:** `SettingsHub.tsx` (`RailId`, `FORM_TABS`, `RAIL_LABELS`, rail-definíció), `PaymentsSettingsPanel` (`sections` prop már támogatja a szétbontást), `SalonSettingsForm` (fülek szétszedése), keresés: `grep -rn "tab=profile\|tab=booking\|tab=languages\|tab=email"`.

---

## 2. Hová kerülnek a foglalási beállítások (semmi nem vész el)

A szabály ott állítható, ahol a hatása látszik:

| Beállítás | Mező | Hely a szerkesztőben |
|---|---|---|
| Foglalható napok előre | `booking_window_days` | Időpont lépés → napok |
| Szünet a foglalások között | `booking_buffer_minutes` | Időpont lépés (a sávok élőben változnak) |
| Minimum idő előtte (alap) | új: `booking_rules.min_lead_hours` | Időpont lépés; munkatársanként felülírható (`staff.min_lead_hours` már létezik) |
| Automatikus megerősítés | `booking_rules.auto_confirm` | Visszaigazolás lépés (a vendég szövege vált) |
| Visszaigazoló e-mail | `notification_prefs.confirm_email` | Visszaigazolás lépés (+ Vendég e-mailek) |
| Emlékeztetők (időzítés, egyedi óra, csatorna) | `feature_modules.reminder_*` | Visszaigazolás lépés |
| Telefonszám kötelező | `require_phone` | Adatok lépés → Telefon mező |
| Cím kötelező + indoklás | `booking_rules.require_address(_note)` | Adatok lépés → Cím mező (előlegnél mindig kötelező) |
| Egyedi kérdések | `custom_questions` | Adatok lépés, + Egyedi kérdés |
| Előleg | `deposit_settings.*` | Előleg lépés (+ Fizetés & előleg oldal) |
| Nyilatkozat | `consent_settings.*` | Nyilatkozat lépés (+ Dokumentumok) |
| Hírlevél-jelölőnégyzet | `newsletter_settings` + új címke | Összegzés lépés |
| Ajándékutalvány | `voucher_settings.*` | Főoldal szakasz + Utalvány lépés (+ Ajándékutalvány oldal) |
| Értesítés új foglalásról (neked) | `notify_new_bookings` | **Fiók → Értesítések** |

A panelen mindig látszik egy **„Foglalási szabályok” összefoglaló** (érték + ugrás a helyére), hogy minden egy pillantással átlátható legyen.
Ahol egy érték két helyen is szerepel (előleg, utalvány, nyilatkozat), mindkét hely ugyanazt a mezőt írja.

---

## 3. A szerkesztő felépítése

```
SettingsHub (rail: 'site')
└─ BookingPageEditor                 (új, client)
   ├─ EditorHeader                    eszközváltó (telefon / desktop — csak lg+), nyelv-legördülő
   ├─ FlowBar                         Főoldal › Időpont › Adatok › [Előleg] › [Nyilatkozat] › Összegzés › Visszaigazolás › [Utalvány]
   │                                  (a kikapcsolt opcionális lépés nem jelenik meg)
   ├─ EditorCanvas                    a VALÓDI publikus nézet, fix szélességen renderelve, arányosan kicsinyítve
   │   └─ PublicSalonView (editorMode)
   ├─ PropertiesPanel                 kijelölés szerinti űrlap / áttekintés (desktop: jobb oldal, mobil: bottom sheet)
   └─ SaveBar (meglévő)               dirty-állapot a draftból
```

### 3.1 Valódi nézet újrahasznosítása (nem másolat)

- A `[slug]/page.tsx` renderelő részét (borító, navbar, számláló, hős-blokk, CTA) kiemeljük egy **`PublicSalonView`** client komponensbe, ami kész adatot kap (salon, services, staff, reviews, locale). A page.tsx ugyanezt használja → a szerkesztő és az éles oldal nem tud elcsúszni egymástól.
- A `ProfileCard` új, opcionális propokat kap (éles oldalon nincsenek megadva → viselkedés változatlan):
  - `editor?: { selected: string | null; onSelect(id): void; forcedView?: View; device: 'mobile' | 'desktop' }`
  - `forcedView` a FlowBar-ból vezérli a `view` állapotot (datetime, details, deposit, consent, summary, success, voucher), mintaadatokkal kitöltve (minta szolgáltatás / szakember / időpont).
  - Szerkesztő módban a beküldés, fizetés, navigáció le van tiltva.
- Kijelölhető elemek `data-edit-id="…"` attribútumot kapnak (`cover`, `logo`, `name`, `address`, `desc`, `counts`, `langs`, `sec:services`, `staff:<id>`, `gtk:<i>`, `field:<id>`, `rules`, `confirm`, `deposit`, `consent`, `newsletter`, `terms`, `redeem`, `voucher`).
- A vászon egy capture-fázisú kattintáskezelővel elkapja a kattintást, megkeresi a legközelebbi `[data-edit-id]`-t, és `preventDefault` + `stopPropagation`. A sárga keret egy külön overlay-réteg (a kijelölt elem `getBoundingClientRect`-je alapján, `ResizeObserver`-rel frissítve), így nem lóg ki és nem csúszik a telefonkeret mögé.

### 3.2 Méretezés

- Az előnézet a valódi szélességen renderel: desktop 1100–1280 px, telefon 390 px (tablet-nézet nincs: 1024 px alatt úgyis a mobil elrendezés jön). A vászon szélességéhez `transform: scale()`-lel kicsinyítünk; az arányt `ResizeObserver` számolja a vászon konténerén (CSS `tan(atan2())` trükk NEM megbízható Safariban — a makettben eltört).
- A `lg` (1024 px) töréspont dönti el a mobil/desktop elrendezést, ezért a vászonnak a valódi szélességen kell renderelnie. A Tailwind `lg:` osztályok a viewporthoz kötöttek, nem a konténerhez. Két lehetőség:
  1. **iframe** (`/[slug]?editor=1`) + `postMessage` a draft-adatokhoz és a kijelöléshez → a töréspontok pontosan működnek;
  2. a `PublicSalonView`-ban a `lg:` helyett egy `device` propból számolt osztálykészlet.
  **Döntés: iframe.** Ez a legpontosabb, a publikus oldalt alig kell módosítani, a draftot `postMessage`-dzsel küldjük (nincs mentés előnézethez). Az iframe `editor=1` módban csak bejelentkezett tulajnak/szerkesztőnek él (szerveroldali jogosultság-ellenőrzés), és `noindex`.

### 3.3 Draft-állapot és mentés

- Egyetlen `draft` objektum (useReducer) a betöltött salon-adatokból; minden panel-mező ezt írja → az iframe `postMessage`-en megkapja → azonnal látszik.
- Dirty = `draft` ≠ betöltött. Mentés: a meglévő `PATCH /api/salon/settings` (mezőnként, ahogy most is), a munkatárs-mezők a `PATCH /api/staff/[id]`-n.
- **Csoport-mezőknél** (booking_rules, feature_modules, deposit_settings…) a PATCH az egész csoportot cseréli → mindig a teljes csoportot küldjük (draft + eredeti merge).
- Lokalizált mezők (description, good_to_know, custom_questions, mezőcímkék, consent): a nyelv-legördülő a `useLocalizedFields` mintát követi; a fejlécben jelezzük, ha a kiválasztott nyelven hiányzik fordítás.
- Elvetés: `draft = loaded`. Navigáláskor mentetlen változásnál a meglévő megerősítő.

### 3.4 Drag & drop

- `framer-motion` `Reorder` (már függőség, érintőn is működik) a panel-listákhoz; a vásznon a szakaszok/mezők húzása az iframe-ben `pointer` eseményekkel, a sorrendet `postMessage`-dzsel küldi vissza.
- Átrendezhető: főoldali szakaszok, űrlapmezők (beépített + egyedi kérdések), Jó tudni pontok.

---

## 4. Adatmodell-változások (migrációk)

Mind a `salons` táblán (a `booking_rules` csoportban, ha nem jelölt másként). Kézzel írt SQL-migrációk a meglévő minta szerint, regisztrálva az `src/migrations/index.ts`-ben; `payload-types.ts` kézi frissítése.

| Mező | Típus | Alapérték | Megjegyzés |
|---|---|---|---|
| `booking_rules.public_section_order` | json | `null` → alapsorrend | `['services','staff','voucher','reviews','gtk','contact','hours']` |
| `booking_rules.public_sections_hidden` | json | `[]` | rejtett szakaszok |
| `booking_rules.show_service_count_on_public` | checkbox | true | a `show_catalog_counts_on_public` szétbontása; migráció átmásolja a régi értéket |
| `booking_rules.show_staff_count_on_public` | checkbox | true | ua. |
| `booking_rules.min_lead_hours` | number | 0 | üzlet-szintű alap; `availability.ts`: `staff.min_lead_hours ?? salon.min_lead_hours` |
| `booking_form` | json (localized címkék!) | `null` → mai viselkedés | `[{ id: 'name'|'email'|'phone'|'address'|'notes'|'q:<id>', visible, required, label?, placeholder? }]` sorrenddel |
| `newsletter_settings.optin_label` | text, localized | null | jelölőnégyzet szövege |
| `cover_focal_mobile_x/y` | number | null → `cover_focal_x/y` | külön mobil fókuszpont |
| `staff.show_on_public` | checkbox | true | ha nincs már erre `is_active`-tól független mező |

A `booking_form` egyesíti: `require_phone`, `booking_rules.require_address(_note)` és a `custom_questions` sorrendjét. Átmenet: ha `booking_form` null, a régi mezőkből számoljuk, így régi adatnál semmi nem változik; mentéskor a régi mezőket is szinkronban írjuk, amíg minden olvasó (`api/bookings`, `manage-booking`, e-mailek, `BookingEditSheet`) át nem áll.

---

## 5. A panel tartalma kijelölésenként

- **Semmi (Főoldal):** szakaszok sorrendje + láthatóság (szem), Fejléc, Számláló sáv, Foglalási szabályok összefoglaló.
- **Semmi (foglalási lépés):** lépéslista (Előleg / Nyilatkozat / Utalvány kapcsolóval), Adatok lépésnél a mezőlista, Foglalási szabályok összefoglaló.
- Borítókép (csere, fókusz — mobil nézetben a mobil fókusz, nagyítás) · Logó · Név (+ méret) · Cím · Leírás (nyelvenként, 300 kar.)
- Számláló sáv: szolgáltatás-szám / szakember-szám külön.
- Szolgáltatások: kibontva a főnézeten; link a Szolgáltatásokhoz.
- Munkatársak szakasz → egy munkatárs: fotó, név, titulus, bemutatkozás (nyelvenként), közösségi linkek (SocialLinksEditor), látható-e; link a munkaidőhöz / min. foglalási időhöz. A foglalási lépésekben a kiválasztott szakember csíkja kibontható.
- Ajándékutalvány: be/ki, céges vásárlás, min/max, érvényesség; link a típusokhoz/eladásokhoz.
- Google-értékelések: összekapcsolt profil, link a Google oldalhoz.
- Jó tudni: pontok (cím, szöveg, ikon), új pont, törlés, sorrend.
- Kapcsolat: telefon, e-mail, weboldal, közösségi linkek (SocialLinksEditor).
- Nyitvatartás: link.
- Nyelvek: kínált nyelvek (`supported_locales`).
- Időpont (napok / sávok): foglalható napok (+ gyorsgombok), szünet, minimum idő.
- Űrlapmező: felirat, helykitöltő (nyelvenként), látható, kötelező; Cím: indoklás; egyedi kérdés: típus/opciók, törlés.
- Előleg: be/ki, fix / %, összeg, visszatérítési idő, Stripe-állapot.
- Nyilatkozat: be/ki, cím, szöveg (nyelvenként).
- Összegzés: hírlevél-jelölőnégyzet (be/ki, szöveg), foglalási feltételek (link), utalvány beváltása (link).
- Visszaigazolás: automatikus megerősítés, visszaigazoló e-mail, emlékeztetők (időzítés-chipek, egyedi óra, csatorna), link a sablonhoz; megjegyzés, hogy a „neked szóló” értesítés az Értesítésekben van.

---

## 6. Mobil admin

- Telefonon **nincs eszközváltó**: csak a mobil előnézet látszik. Mivel a tartalom közös, minden szerkesztés a desktop oldalra is hat; csak a desktop borító-fókusz állítható kizárólag gépen.
- Kijelölés → a panel alulról felcsúszó lapként jön fel (a meglévő sheet-minta), húzható fogantyúval; a FlowBar vízszintesen görgethető.
- A vászonban a mobil oldal „Időpontfoglalás” gombja a valódi módon nyitja a foglaló lapot.

---

## 6b. A külső foglaló igazítása a maketthez

A makett Összegzés és Visszaigazolás képernyője lesz a minta az éles foglalón is (ez külön, a szerkesztőtől független fejlesztés, előre vehető):

- **Összegzés:** egy kártyában kulcs–érték sorok (szolgáltatás, szakember, időpont, név, ár, most fizetendő előleg), alatta utalvány-beváltás, hírlevél- és feltétel-jelölőnégyzet, sárga „Foglalás véglegesítése” gomb.
- **Visszaigazolás:** kerek ikon (✓ megerősítve / … jóváhagyásra vár), cím az automatikus megerősítés szerint („Foglalásod megerősítve” / „Foglalásod beérkezett”), rövid szöveg arról, ment-e e-mail, a foglalás egy sorban, az emlékeztető időzítése és csatornája, két egyforma gomb: „Naptárhoz adás” (.ics) és „Kész”. A szövegek törnek, semmi nem lóg ki 320 px-en sem.

## 7. Fázisok

0. **Külső foglaló Összegzés + Visszaigazolás** a makett szerint (§6b).
1. **Alapok:** `PublicSalonView` kiemelése a `[slug]/page.tsx`-ből (viselkedés változatlan); `?editor=1` iframe-mód jogosultság-ellenőrzéssel; postMessage-protokoll (draft → iframe, select/reorder → szülő).
2. **Szerkesztő váz:** `BookingPageEditor`, vászon méretezés, kijelölés-overlay, panel-keret, draft + SaveBar, nyelvváltó.
3. **Főoldal:** fejléc-elemek, számláló, szakaszok sorrend/láthatóság, munkatársak (bio + social), kapcsolat (social), Jó tudni, utalvány, Google.
4. **Folyamat:** `ProfileCard` `forcedView` + mintaadatok; Időpont szabályok, Adatok mezők (`booking_form`), Előleg, Nyilatkozat, Összegzés, Visszaigazolás (emlékeztetők), Utalvány.
5. **Migrációk + olvasók átállítása:** az új mezők (§4) és az `availability.ts`, `api/bookings`, e-mailek átállítása a `booking_form`-ra.
6. **Menü-átszervezés:** új rail, Vendégek csoport, szétbontott Fizetés oldal, Értesítések bővítése, átirányítási térkép a régi tab-azonosítókhoz.
7. **Mobil admin:** bottom-sheet panel, FlowBar görgetés, érintéses húzás.
8. **Takarítás:** a régi Üzlet profil / Foglalás fül kódjának törlése, ha már semmi nem hivatkozik rájuk; utána étterem-változat külön tervvel.

Minden fázis után: `npx tsc --noEmit -p .`, kézi próba a `npm run dev` alatt (szalon + nyelvváltás + mobil nézet), és az éles foglalóoldal változatlanságának ellenőrzése.

## 8. Kockázatok

- **Eltérő szerkesztő/éles nézet** → ezért iframe + közös `PublicSalonView`, nem másolat.
- **Csoport-PATCH felülírás** (Payload egész csoportot cserél) → mindig teljes csoport küldése.
- **`booking_form` átállás** → kettős írás az átmeneti időszakban, olvasók fokozatos átállítása.
- **Régi linkek** a megszűnő tabokra → átirányítási térkép.
- **Sok migráció egyszerre** a deploynál → fázisonként külön migráció, mindegyik visszafelé kompatibilis (null = régi viselkedés).

## Nyitott kérdések

- Számla automatikus kiállítása utalvány-vásárláskor / előlegnél (a makettben csak javaslat).
- A munkatárs „látható a foglalóoldalon” kapcsoló: elég-e a meglévő `is_active`, vagy kell külön mező.
- Étterem-változat: ugyanez a szerkesztő a `RestaurantPublicView`-ra (asztalfoglalás-specifikus lépésekkel) — külön terv.

---

## Állapot (2026-10-06)

Minden fázis külön commitban, a `claude/sharp-bardeen-k60h5e` ágon:

| Fázis | Commit | Tartalom |
|---|---|---|
| Terv | `a4e1364` | ez a dokumentum |
| 0 | `50acb15`, `5329100` | emlékeztető-logika `lib/reminders.ts`-be; új Összegzés + Visszaigazolás képernyő |
| 1 | `1cb512e` | közös `SalonPublicView`, `?editor=1` előnézet-mód (jogosultság, postMessage, kijelölés-keret) |
| 2–3 | `4ec21de` | Beállítások → Foglalóoldal szerkesztő: vászon, panel, draft + mentés, főoldal elemei, nyelvenkénti szövegek |
| 4 | `0ebf6f5` | folyamat-sáv és lépések mintaadatokkal; szabályok a helyükön (időpont, adatok, visszaigazolás, nyilatkozat) |
| 5 | `f969d05` | migráció `20261006_130000`: két számláló-kapcsoló, üzlet-szintű min. idő, szakasz-sorrend/rejtés, mobil fókusz |
| 6 | `b7f8928` | új menü (szalon), Vendég e-mailek, külön Hírlevél / Ajándékutalvány / Számlázás, link & QR a szerkesztőben |
| 7 | `84ac36e` | telefonos szerkesztés: mindig mobil előnézet, alulról felcsúszó panel |
| 5b | `ca97a2c` | migráció `20261006_140000`: űrlapmezők sorrendje húzással |

Deploykor 2 új migráció fut (`20261006_130000_booking_page_editor`, `20261006_140000_form_field_order`), az ág korábbi 7 migrációja mellett.

### Nyitva maradt

- Az „Értesítő” e-mail sablon (a tulajnak szóló levél) még a Vendég e-mailek sablonjai között van — a tervben az Értesítésekhez kerülne.
- A régi Üzlet profil / Foglalás / Nyelvek fül kódja még bent van (szalonnál már nem érhető el) — takarítás a 8. fázisban.
- A szerkesztő előnézetében a hős-blokk „Időpontfoglalás” gombja a borítót jelöli ki, nem indítja a folyamatot (a folyamat-sávból indítható).

---

## Étterem (egységesítés)

Ugyanaz a szerkesztő, menü és képernyő-terv az éttermekre is — közös kóddal, nem másolattal.

| Fázis | Tartalom |
|---|---|
| R0 | Étterem Összegzés + Visszaigazolás a szalonnal azonos módon (megerősítve / beérkezett, e-mail, emlékeztető, naptár + kész); a foglalás-API visszaadja a státuszt |
| R1 | A `SalonPublicView` általánosítása `PublicPlaceView`-vá (szalon: `ProfileCard`, étterem: `RestaurantCard`); `RestaurantPublicView` csak adatot épít; `?editor=1` az étterem tagjainak is |
| R2–4 | `BookingPageEditor` étterem-módban: főoldal elemei, folyamat (Időpont + létszám + alkalom, Adatok, Előleg, Nyilatkozat, Összegzés, Visszaigazolás, Utalvány); étterem-specifikus panelek: alkalmak (event types), asztalfoglalás hossza és lépésköze, asztalok / nyitvatartás link |
| R5 | Migráció: `restaurants.cover_focal_mobile_x/y`; az étterem olvasói: szakasz-sorrend/rejtés, űrlapmező-sorrend, üzlet-szintű min. foglalási idő a slot-számításban |
| R6 | Étterem Beállítások: ugyanaz az új menü (Üzlet / Vendégek / Pénzügy / Kapcsolatok / Csapat / Fiók) |
| R7 | Telefonos szerkesztés — közös a szalonnal, csak ellenőrzés |
