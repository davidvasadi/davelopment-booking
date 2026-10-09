# Nyitott pontok — vizsgálati leírás

Állapot: 2026-10-09, ág: `claude/sharp-bardeen-k60h5e`.
Minden pont a kód mai állapotára épül (fájl:sor hivatkozásokkal). A cél: a rendszer (vagy aki
elvállalja) minden pontnál **először vizsgálja meg** a leírt helyeket, erősítse meg vagy cáfolja
a megállapításokat, és csak utána javítson. A „Döntés kell” sorok a tulaj (Dave) válaszát várják.

Alapelv itt is: **egységes módosítás** — ami a szalonnál változik, az az étteremnél is.

---

## 1. Ajándékutalvány: „cégként vásárolok” opció

**Mai állapot**
- Van kapcsoló a foglalón: „Cégként vásárolok (adószámos számla kell)” → „Adószám” mező
  (szalon: `src/components/booking/ProfileCard.tsx` ~1756–1762, étterem:
  `src/components/restaurant/RestaurantCard.tsx` ~627–633).
- Csak akkor látszik, ha a számlázás be van kötve (`invoice_provider ≠ none`) ÉS a
  `voucher_settings.allow_company` be van kapcsolva.
- **Nincs külön cégnév mező** — a „A te neved” mezőbe kell írni a cég nevét (csak a hint mondja).
- Nincs irányítószám (a Számlázz.hu XML üres `irsz`-t kap: `src/lib/szamlazz.ts:132`).
- Az adószám formátuma nincs ellenőrizve (csak hogy nem üres).
- **A vevő városa, címe, adószáma nem mentődik az utalványra** (`src/payload/collections/GiftVouchers.ts`
  nem tartalmazza) — csak a számlázásnak adódik át, utána elvész.

**Vizsgálandó / teendő**
- Külön mezők céges vásárlásnál: cégnév, adószám (formátum-ellenőrzés: `12345678-1-42`),
  irányítószám, település, cím.
- A vevő számlázási adatainak mentése a `gift-vouchers` kollekcióba (migráció kell).
- Szalon és étterem űrlap ugyanúgy (ma két majdnem azonos másolat — érdemes közös komponensbe
  kiemelni).
- Az admin `VoucherCreateWizard.tsx` ugyanezt kapja.

**Döntés kell:** magánszemélynél is kötelező legyen-e a cím, ha nincs számlázás bekötve?

---

## 2. Ajándékutalvány: adatmegadás egyértelműsítése

**Mai állapot** (`src/lib/i18n/hu.ts:139–164`, űrlap: ProfileCard ~1680–1820, RestaurantCard ~560–690)
- Sorrend: típus → „A te neved” → „A te emailed” → „Település” → „Cím” → (céges) → elválasztó →
  címzett neve / e-mailje / üzenet.
- Nincs szakaszcím, ami elválasztaná a **vevő** és a **megajándékozott** adatait — csak egy vonal.
- Számlázás nélkül is kötelező a település és a cím, pedig csak a számlához kell.
- A hibaüzenetek beégetett magyar szövegek, nem fordíthatók.

**Vizsgálandó / teendő**
- Két egyértelmű blokk: „Vásárló (számlázási adatok)” és „Megajándékozott (opcionális)”.
- Település / cím csak akkor kötelező, ha van számlázás.
- Hibaüzenetek i18n-be (6 nyelv).
- A foglalóoldal-szerkesztőben az Utalvány lépés mutassa ugyanezt.

---

## 3. Fizetési mód megjelenítése

**Mai állapot**
- Foglalásnál / asztalfoglalásnál **nincs általános fizetési mód mező** (helyszíni készpénz,
  kártya, online) — csak az előleg (`deposit_paid`, `payment_status`) van tárolva
  (`Bookings.ts:235–282`, `Reservations.ts:159–205`).
- Az utalványnak van `payment_method` mezője (online / fizetési link / készpénz / POS / utalás),
  ez az Utalványok listában látszik (`VouchersManager.tsx:37–45`).
- Foglalás szerkesztőben (szalon) látszik: „Előleg befizetve”, „Utalvánnyal fizetve”.
  **Étteremnél az utalványos fizetés nem látszik** (`ReservationEditSheet.tsx` nem olvassa a
  `voucher_code`-ot).
- Napi nézetben csak az előleg-jelvény van, az utalvány nincs; a vendéglistában semmi.

**Vizsgálandó / teendő**
- Étterem foglalás-szerkesztő: „Utalvánnyal fizetve” jelvény (egységesítés).
- Napi nézetekben utalvány-jelvény mindkét típusnál.

**Döntés (2026-10-09):** foglaláshoz **nem** kell fizetési módot rögzíteni. Marad az
előleg- és utalvány-jelvények egységesítése (étterem + napi nézetek).

---

## 4. Új foglalás lapon az utalvány státusza

**Mai állapot**
- A belső új foglalás űrlapon (`BookingEditSheet.tsx`, `ReservationEditSheet.tsx`) **nincs
  utalvány mező**, és a `manage-booking` / `manage-reservation` API sem fogad `voucher_code`-ot.
- Utalvány beváltás foglalással csak a nyilvános foglalón van (egyszeri, teljes beváltás —
  a maradék elvész: `src/app/api/bookings/route.ts:243–246`).
- `/api/vouchers/validate` csak `{valid, amount_huf}`-ot ad vissza — státuszt, lejáratot, fizetési
  infót nem.
- Az Utalványok oldali beváltás azonnal bevált, előnézet nélkül, és nem köti foglaláshoz.

**Vizsgálandó / teendő**
- Utalványkód mező az admin új foglalás űrlapon (szalon + étterem): beírás / QR után mutassa a
  státuszt (aktív / beváltva / lejárt / visszatérítve), az összeget, a lejáratot és hogy ki fizette
  és hogyan; mentéskor váltsa be és kösse a foglaláshoz.
- `validate` végpont bővítése ezekkel az adatokkal.
- Utalványok oldali beváltás: megerősítő előnézet beváltás előtt.

**Döntés (2026-10-09):** marad az egyszeri **teljes beváltás**, nincs maradék egyenleg.

---

## 5. Számlázás utalványról

**Mai állapot**
- Szolgáltató: Számlázz.hu vagy Billingo (`invoice_settings`, `src/lib/szamlazz.ts`,
  `src/lib/billingo.ts`). A Billingo-kód megjegyzése szerint a payloadot még a hivatalos API-val
  egyeztetni kell.
- Minden utalványeladásról készül számla (`src/lib/createGiftVoucher.ts:72–80`), best-effort.
- Beégetett értékek: ÁFA mindig `AAM` (alanyi mentes), fizetési mód mindig „bankkártya” —
  **akkor is, ha készpénzzel vagy átutalással fizettek** (`szamlazz.ts:123`, `billingo.ts` ~57).
- Sikertelen számlánál nincs újraküldés (és a vevő adatai nincsenek elmentve hozzá — lásd 1. pont).
- A számla száma / PDF-je nem látszik az Utalványok listában.
- Visszatérítésnél nincs sztornó számla.

**Vizsgálandó / teendő**
- A számla fizetési módja kövesse az utalvány `payment_method`-ját.
- Utalványok lista: számla státusz, szám, PDF link; „Számla újraküldése” gomb sikertelennél.
- Billingo payload ellenőrzése a hivatalos API ellen (teszt-fiókkal).

**Javaslat (a tulaj nem szakértő, könyvelővel egyeztetendő):** a Számlázás beállításban egy
„ÁFA” választó: *alanyi adómentes (AAM)* — ez marad az alap —, illetve *27%*, *18%*, *5%*.
Aki évi árbevétele miatt ÁFA-köteles, azt állítja be, amit a könyvelője mond; mindenki másnak
nem változik semmi. Az utalványok ÁFA-kezelése (eladáskor vagy beváltáskor) könyvelői kérdés —
a felület mellé egy rövid súgószöveg kerül erről. Sztornó visszatérítésnél: később.

---

## 6. Előre foglalás: napszám alapú automatikus ciklus

**Mai állapot**
- Egyetlen modell: gördülő ablak — ma + N nap (`booking_window_days`, alap 60; szalon és étterem).
  Minden nap egy nappal tovább nyílik.
- Nincs „havonta X-én nyílik a következő hónap” jellegű beállítás.
- Munkatárs-szintű ablak nincs (csak `min_lead_hours`).
- **Hiba:** az étterem szerver oldalon **egyáltalán nem ellenőrzi** az ablakot
  (`src/app/api/restaurant/reservations/route.ts` nem olvassa a `booking_window_days`-t) —
  közvetlen API-hívással bármilyen távoli napra lehet foglalni.
- A szalonnál csak a foglalás-mentés ellenőriz (`src/app/api/bookings/route.ts:151–156`), a
  slot-lekérdezés nem; egy napos eltérés van (kliens 0..N-1 nap, szerver ma+N), és a szerver UTC
  dátummal hasonlít, nem budapesti idővel.

**Vizsgálandó / teendő**
- Étterem: ablak-ellenőrzés a foglalás API-ban (azonnal javítandó hiba).
- Szalon + étterem: egységes, budapesti időzónás ablak-számítás közös helyen, a slot API-k is
  használják; az egy napos eltérés rendezése.

**Tulaj kérése (2026-10-09):** „ha lejár a 60 nap, újítsa meg automatikusan, és menjen értesítés,
hogy hamarosan lejár.” Megjegyzés: a mai gördülő ablak már naponta magától megújul, tehát nem
jár le. Tisztázandó, hogy a tulaj a mai működést szeretné-e megtartani (ekkor nincs teendő), vagy
időszakos megnyitást: 60 napos időszak → lejárat előtt (pl. 7 nappal) értesítés a tulajnak →
a lejáratkor automatikusan újabb 60 nap nyílik (kikapcsolható megújítással).

---

## 7. Értékelések: Google API

**Mai állapot**
- **Már van Google Places API (New) integráció** (`src/lib/googleReviews.ts`): hely-kereső a
  Beállítások → Google fülön, értékelés + max. 5 vélemény, 24 óránként frissül; a foglalóoldalon a
  „Google-értékelések” szakasz mutatja (`GoogleReviewsBlock.tsx`).
- Kell hozzá a `GOOGLE_PLACES_API_KEY` környezeti változó a szerveren — nélküle a funkció rejtve
  marad. Ez nincs dokumentálva.

**Vizsgálandó / teendő**
- Éles szerveren be van-e állítva a `GOOGLE_PLACES_API_KEY` (a tulaj ellenőrzi, a kulcsot nem
  kell elküldeni).
- Dokumentálni a README-ben / telepítési leírásban.
- Ha be van állítva és mégsem működik: a `/api/google/place` hívás naplóit megnézni.

---

## 8. Hiba: „Szalon neve keveredik az automatikus emailben”

**Mai állapot**
- A levél **törzsében** nem találtunk olyan utat, ahol rossz üzlet neve kerülne be: minden
  tranzakciós levél a foglaláshoz tartozó üzletből veszi a nevet.
- A 2026-10-06-i javítás (`aaba1f0`) óta minden üzlet saját feladócímről küld (`<slug>@domain`).
  Előtte mindenki ugyanarról a címről ment különböző nevekkel — a Gmail egy címhez egy nevet
  jegyez meg, ezért keveredtek a nevek.
- **Még mindig közös címről mennek (különböző nevekkel):**
  - hírlevél: `src/app/api/marketing/send/route.ts` (`"Üzletnév" <noreply@…>`),
  - csapatmeghívó és beosztás-értesítő: `src/lib/email.ts:522`, `:801`,
  - kapcsolatfelvétel: `src/app/api/contact/route.ts:84`.
- Ha éles szerveren `RESEND_PER_BUSINESS_FROM=0`, a javítás ki van kapcsolva.

**Vizsgálandó / teendő**
- Hírlevél: üzletenkénti feladócím, mint a tranzakciós leveleknél.
- Éles környezeti változók: `RESEND_PER_BUSINESS_FROM`, `RESEND_FROM_EMAIL`.
- A hibát jelentőtől: melyik levélben, mikor (10-06 előtt vagy után), milyen nevet látott.

**Mellékesen talált hibák**
- Foglalás-módosításnál a módosítás-értesítő **kétszer is kimehet** (a `notifyOnBooking` hook és
  a `manage-booking` / `manage-reservation` route is küldi) — a hook ráadásul logó nélkül.
- Az utalvány-levelek csak magyarul mennek, és a QR-kód `data:` képként van beágyazva, amit a
  Gmail gyakran letilt.
- Webhook versenyhelyzet: a nyilvános utalványvásárlás Stripe-metaadata ugyanazt a `kind:
  'gift-voucher'` jelölést kapja, mint a fizetési link. Ha a webhook ér be előbb, mint a kliens
  `/api/vouchers` hívása, a webhook vevő-adatok nélkül próbál utalványt létrehozni
  (`src/app/api/stripe/connect/webhook/route.ts:88–109`). Külön jelölés kell a két útnak.

---

## Javasolt sorrend

1. Azonnali hibák: étterem ablak-ellenőrzés (6), webhook versenyhelyzet (8), dupla
   módosítás-értesítő (8), hírlevél feladócím (8).
2. Utalvány adatmegadás + céges vásárlás + mentett számlázási adatok (1–2), számla fizetési módja
   és újraküldés (5).
3. Utalvány az admin új foglalásnál (4), fizetési mód megjelenítés (3).
4. Döntés után: automatikus foglalási ciklus (6), részleges beváltás (4), ÁFA-kulcs (5).
