# Schedulio — Feladatlista & egyeztetési doksi

> **Schedulio — by [davelopment]®**
> Készült: 2026-05-28. Ez a teljes nyitott feladatlista, témánként csoportosítva.
> Munkamódszer: pontról pontra átbeszéljük, egyszerre egy témán dolgozunk,
> kódmódosítás előtt jóváhagyással.

---

## ⚠️ Ismert környezeti probléma — `payload generate:types` nem fut

A `npm run generate:types` (payload CLI) ezen a gépen elhasal:
`TypeError: Illegal constructor` az undici `CacheStorage`-nál (undici/node verzió-ütközés).
**Következmény:** új/módosított Payload-mező után a `payload-types.ts` NEM generálódik automatikusan.

**Workaround (amíg a CLI nem javul):** a típust **kézzel** kell felvenni a
`src/payload/payload-types.ts`-be, a séma-módosítással egy időben. Pl. új `Restaurant`/
`Room`/`Reservation` mező → kézzel a megfelelő interface-be ugyanazzal a típussal.
**Tartós javítás (külön feladat):** node-verzió igazítása vagy undici-pin, hogy a CLI fusson.

---

## 🥇 PRIORITÁS #1 — Foglalási kártyák (idővonal): színek + gap

Ez az **első** feladat, mielőtt bármi máshoz nyúlunk.

### 1/A — Kártyaszínek (státusz szerint)
Jelenleg ([DailyView.tsx:21-32](../src/components/restaurant/DailyView.tsx#L21-L32)):

| Státusz | Jelenlegi szín | Megbeszélendő |
|---------|----------------|---------------|
| `pending` (megerősítésre vár / kezeletlen) | sárga (amber) | **sárga? — kérdés** |
| `confirmed` (megerősítve) | zöld (emerald) | ok? |
| `seated` (leültetve) | kék (blue) | ? |
| `completed` (sikeres befejezés) | szürke (zinc) | **zöld legyen?** |
| `no_show` (nem jött) | piros | ? |
| `cancelled` (lemondva) | halvány szürke, áthúzott | ? |

**Eldöntendő színkérdések (a felhasználó kérdései):**
- Sikeres befejezés → **zöld**? (most a `confirmed` a zöld, a `completed` szürke)
- Kezeletlen (`pending`) → **sárga**? (most az)
- **Beeső** (walk-in) → milyen szín? (most a státusz színe megy, a forrás csak badge)
- **Telefonos** (phone) → milyen szín?

> Megjegyzés: a **beeső/telefonos** jelenleg *forrás* (`source`), nem *státusz* —
> külön badge jelzi ([DailyView.tsx:36](../src/components/restaurant/DailyView.tsx#L36)).
>
> **DÖNTÉS (2026-05-28):** a kártya alapszínét a **státusz** adja, a beeső/telefonos
> **badge marad** (nem színezi át a kártyát). A konkrét státusz-paletta még finomítandó
> (befejezett zöld? kezeletlen sárga?), de a logika státusz-alapú.

### 1/B — Túl nagy gap + túl nagy cellák
- A foglalás bal oldalán **túl nagy a gap**, a **cellák túl nagyok**.
- Lista nézet sorai: `py-3.5 sm:py-4` + `gap-3 sm:gap-4`, idő-oszlop `w-12 sm:w-16`
  ([DailyView.tsx:301-315](../src/components/restaurant/DailyView.tsx#L301-L315)).
- Idővonal sorok: `min-h-[4.5rem]` ([DailyView.tsx:481](../src/components/restaurant/DailyView.tsx#L481)).
- **Teendő:** kompaktabb sorok / kisebb térközök, sűrűbb információ.

---

## KPI kártyák (Foglalások oldal)

- A statisztika **létszám szerint** menjen, **ne asztalok szerint**.
  - Érintett: [DayKpiBar.tsx](../src/components/restaurant/DayKpiBar.tsx),
    [restaurantStats.ts](../src/lib/restaurantStats.ts).
- A **napi sidebaros bontásokban a grafikon nem változik** szűrőváltáskor —
  csak az óránkénti forgalom frissül. **Bug:** a grafikonnak is követnie kell a szűrőt.

---

## Statisztikák

- A **napi foglalás exportból** ne kerüljön bele az **asztal** és a **foglalási hely**.
  (CSV/export oszlopok szűkítése.)

---

## Súgó / Tippek

- **Szépíteni, pontosítani** a tartalmat.
- Stílus: **glass / blur, egérkövető** — de **a téglalapot még nem vágja jól** (clip bug).
- **Részletesebb info kell minden aloldalról** (minden nézethez célzott tipp).

---

## Login / Auth

- **Google login** kell.
- **Apple login** kell.
- **Teszt:** több helyről, ugyanazzal a fiókkal működik-e a bejelentkezés (multi-session)?

---

## Email

- **Teljesen új layout** (az arculatos layout már épült — felülvizsgálni).
- Az **asztal** (ahova a rendszer foglalt) **NE menjen ki** a vendégnek.
  *(Megj.: a confirmation emailből az „Asztal" sor már kivéve — ellenőrizni az autoreply-t is.)*
- Az **autoreply a kiválasztott nyelv szerint** menjen.

---

## Megjegyzés (foglalás forrása)

- Foglalás-megjegyzésnél jelölés: **beeső** / **foglalás (online)**.

---

## Asztalok

- **Drag & Drop nem működik / nincs** — asztalok elrendezése/áthelyezése drag&drop-pal.
  Érintett: [TablesManager.tsx](../src/components/restaurant/TablesManager.tsx).

---

## „Jó tudni" rész (vendég-oldal)

Szövegek, amiket a foglalónak meg kell jeleníteni:
- A megadott napon **csak telefonon** tudod módosítani a foglalást.
- Ha **korábban** szeretnél jönni, telefonon kell módosítani.

---

## Nyitvatartás-változás megjelenítése az adminban

- Ha egy adott napon a **nyitvatartás módosult** (kivételes nyitvatartás), akkor az
  **admin foglalási nézetben** is látszódjon az alkalmazottnak.
- Az érintett **idősávokat** valahogy ki lehessen színezni / jelölni („itt nincs nyitva").
- Profi UI-szintű kezelés (pl. szürkített / vonalkázott tartomány az idővonalon).
- Érintett: [OpeningHoursExceptions.tsx](../src/components/restaurant/OpeningHoursExceptions.tsx),
  idővonal nézet.

---

## Fizetés

- **Stripe / Barion** integráció, biztonságos fizetés.
- **Anthropic-szerű számla-részletek** (igényes, részletes számla/invoice UI).

---

## Értesítések

- Ha **megnyitunk egy értesítést**, az **kerüljön le a listáról** (read → eltűnik / olvasott).

---

## Előfizetés

- **Csomagok bővebb infóval.**
- Legyen **Free / Plan / Pro** szint?
- **Előfizetés aloldal → kerüljön a Beállításokba** mint „A csomagom" fül.
- Az előfizetés-oldal jelenleg **nem reszponzív** — javítani.

---

## UI / Reszponzivitás (átfogó)

- **Tablet-first** nézet és **teljes responsive** mindenhol.
- **[davelopment]® és Schedulio CTA-utalások mindenhol**, forgalomnövekedési céllal.

---

## Foglalások (marketing / növekedés)

- **Google-értékelés auto-email CTA** — ⏳ NYITOTT, később bekötni (salon + restaurant).
  - **Időzítés (ELDÖNTVE):** azonnal a foglalás **„Befejezett"-re állításakor** (nincs cron).
  - **Kapcsoló (ELDÖNTVE):** az adott cég admin be/ki kapcsolhatja a saját helyén.
    Csak akkor megy, ha **be van kapcsolva ÉS van értékelő-link**.
  - **Spec / teendők:**
    - Séma (Restaurants + **Salons** is!): `review_email_enabled` (checkbox) + `review_url` (text).
      Reservations: `review_email_sent` (checkbox, readOnly) — hogy ne menjen kétszer.
    - Email-sablon: `sendReviewRequest()` az `emailLayout`-ra építve, CTA gomb a `review_url`-re.
      Két helyre: `email.ts` (salon) + `restaurantEmail.ts` (restaurant).
    - Trigger: a státusz `completed`-re váltásakor (manage-reservation route / reservations PATCH)
      → ha enabled + van url + még nem ment → küld + `review_email_sent=true`.
    - Settings UI: a kapcsoló + link mező az **Email** fülre (mindkét form) + initial-mapping.
    - Típusokat **kézzel** a payload-types.ts-be (lásd a CLI-figyelmeztetést fent).
  - **Becslés:** ~30–45 perc (restaurant) + ~15 perc (salon). Resend már be van kötve.
  - **2026-05-29: elkezdtem, majd visszavontam** (prezentáció előtt nem fejeztük be). Tiszta állapot.

---

## Haladás napló

- [x] **PRIO #1 — Foglalási kártyák színe + gap** ✅ (2026-05-28)
  - Szín-kiosztás (telt színek): confirmed=sárga (alap), seated=zöld (élő vendég),
    completed=szürke (lezárt), no_show=piros, pending=ugyanaz mint confirmed, cancelled=fakó.
    Forrás (beeső/telefon) marad badge. `DailyView` `statusBlock`/`statusDot`.
  - Gap/sűrűség: lista sorok `py-2.5`, idő-oszlop szűkítve; idővonal sor `min-h-3.5rem`.
- [x] **Sidebar (ReservationEditSheet) badge-ek + idő** ✅ (2026-05-28)
  - Fejléc badge-ek: státusz + forrás + urgency (késik/túlfut/lejár), státuszváltásra élő.
  - Új foglalás kezdő-idő = aktuális óra (nyitvatartásra szorítva).
- [x] **Nyitvatartás kemény korlát + turnus-vágás** ✅ (2026-05-28)
  - `getOpeningWindow()` helper (heti rend + kivétel), egy forrás az igazságra.
  - `TimeSelect` wheel a nyitvatartásra szűkül (`minTime`/`maxTime`).
  - Szerveroldal: nyitvatartáson kívüli manuális foglalás elutasítva.
  - Turnus a záráshoz vágódik (21:00+2ó, 22:00 zárás → 22:00) — online + manuális.
  - Sidebar piros figyelmeztető sáv, ha a választott ülésidő túllógna a záráson.
  - ⚠️ Ezek a változások (DailyView, ReservationEditSheet, time-select, restaurantBooking)
    **még nincsenek commitolva**.

- [x] **KPI / Statisztika** ✅ (2026-05-28)
  - **Cél 1 — létszám (pax) szerinti mérés:** a Statisztika oldal státusz-/forrás-kártyái
    (Lemondva / No-show / Walk-in / Telefonos) + az Online kártya mostantól **főt (pax)**
    mutatnak, nem foglalás-darabot. A %-arányok az időszak összes pax-ához viszonyítanak.
    `restaurantStats.ts` (`sumPax`, `periodTotalPax`, `onlineReservations` pax),
    `analytics/page.tsx` kártya-feliratok „… fő".
  - **Cél 2 — óránkénti sheet szűr + átlagol:** új `hourlyByDate` (dátum→24 órás darab)
    a szerverről; a `KpiDetailsSheet` (hour) ebből a `filteredDays` dátumaira összegez
    óránként és **napi átlagot** számol → az óránkénti diagram mostantól reagál az
    `innerPeriod`/`dayFilter` szűrőre. Cím dinamikus (időszak · nap-szűrő · N nap átlaga),
    tooltip „X foglalás / nap". Fallback a régi (összeg) adatra, ha nincs hourlyByDate.
  - ⚠️ Még nincs commitolva (restaurantStats, analytics/page, KpiDetailsSheet, DashboardCharts).

- [x] **Napi export: asztal oszlop kivéve** ✅ (2026-05-28)
  - `PrintDayButton.tsx`: Asztal oszlop (fejléc + cella) törölve, colspan 8→7,
    `tableNames` helper + `Table` import eltávolítva.
- [x] **Szülinapos foglalás (kapcsoló + jelölés)** ✅ (2026-05-28)
  - Séma: `is_birthday` checkbox (Reservations) + típus (kézzel a payload-types-ba,
    mert a `generate:types` CLI undici/node hibára fut — külön rendezni).
  - Sidebar: szép toggle gomb `Cake` (lucide) ikonnal, rózsaszín aktív állapot.
  - Szerver: `manage-reservation` route fogadja/menti `is_birthday`.
  - Jelölés: idővonal kártyán az időpont (HH:MM–HH:MM) helyén szülinap-ikon,
    lista nézetben rózsaszín „Szülinap" badge.
  - Idővonal kártyán az időpont MARAD, a 🎂 ikon mellé kerül (nem helyette).
  - Vázlatmód (offline draft) is támogatja: `ReservationDraft.is_birthday`,
    `draftFields`, `draftToReservation` bekötve; jelölés vázlatnál is látszik.
  - Idővonal sűrűbb: asztalsor `min-h` 3.5rem → 2.75rem.

- [x] **Értesítés: megnyitott eltűnik a listáról** ✅ (2026-05-28)
  - `NotificationBell.tsx`: bármely értesítésre kattintva azonnal lekerül (remove),
    nem csak a foglaláshoz kötöttek; clickable-nél navigál is. `disabled` korlát ki.

- [x] **„Jó tudni" szerkeszthető (foglaló landing)** ✅ (2026-05-29)
  - Séma: `good_to_know` array (cím + szöveg) Restaurants + Salons + típusok (kézzel).
  - Settings „Dokumentumok" fül: `TermsSectionsEditor` újrahasználva a pontokhoz.
  - Landing: az auto-kártyák (turnus, lead-time) maradnak, a saját pontok alattuk.
  - Init-mapping + mentés (TAB_FIELDS `documents`-be) bekötve.
- [x] **Landing logó levágás javítva** ✅ (2026-05-29)
  - `RestaurantPublicView`: `h-12 w-12 object-cover` → fehér kártya + `object-contain`
    `h-full w-auto max-w-[200px]`. A logó teljes egészében látszik, nem vágódik.

## Összegzés — javasolt sorrend

1. **Foglalási kártyák: színek + gap** (PRIO #1) ← itt kezdünk
2. KPI létszám szerint + grafikon-szűrő bug
3. Statisztika export oszlopok
4. Értesítés olvasott→eltűnik (gyors)
5. Asztalok drag & drop
6. Nyitvatartás-változás az adminban
7. Email: asztal kivétel autoreply + nyelv szerinti autoreply
8. „Jó tudni" + Súgó/Tippek tartalom + blur-clip fix
9. Login: Google + Apple
10. Előfizetés → Beállítások fül + reszponzív + csomagszintek
11. Fizetés: Stripe/Barion + számla UI
12. Tablet-first + full responsive + CTA-utalások
13. Google-értékelés auto-email CTA

---

## Nyitott kérdések, amiket át kell beszélnünk

1. **Kártyaszínek** — pontos paletta a 4 kérdéses esetre (befejezett, kezeletlen, beeső, telefonos).
2. **Beeső/telefonos** — szín vagy badge maradjon?
3. **Csomagszintek** — Free/Plan/Pro pontos tartalma és árazása.
4. **Fizetés** — Stripe vagy Barion (vagy mindkettő)? HU piacra Barion gyakori.
5. **Google-értékelés email** — időzítés (azonnal vs. +1 nap).
6. **Auth** — csak Google+Apple, vagy email/jelszó is marad?
