# Timeline fókusz mód + összecsukható nav

## Cél

Az étterem **Foglalások** oldalán az idővonal (timeline) nézet lényege, hogy a
teljes nap egyszerre látsszon. Ehhez minél több vízszintes hely kell, ezért:

1. **Idővonal nézetben ne látsszanak a KPI kártyák** — csak a többi nézetben
   (lista, terem).
2. A bal oldali nav legyen **összecsukható / kibontható**.
3. Idővonal nézet megnyitásakor a menü **automatikusan összecsukódjon**, hogy
   teljesen csak a foglalások része látsszon.

## Eldöntött viselkedés

- **Fókusz mód** = összecsukott nav (ikon-only) + elrejtett KPI kártyák.
- **Timeline-ra váltás** → bekapcsol a fókusz mód (nav collapse + KPI rejt).
  Teljesen csak a foglalások idővonala látszik, teljes szélességben.
- **A menü kézi kinyitása** → kilép a fókusz módból: menü nyitva + KPI vissza,
  **DE a timeline nézet marad** (nem vált listára). Ekkor a timeline pont úgy
  néz ki, mint most.
- **Lista / Terem nézet** → mindig normál: menü nyitva, KPI látszik.
- Minden timeline-ra váltás újra bekapcsolja a fókusz módot. (Ha zavaró lesz a
  gyakorlatban, később finomítjuk.)

### Eldöntött részletek

- **Nav összecsukva**: ikon-only (`w-16`), nem teljes elrejtés. Címkék/widgetek
  eltűnnek, ikonok középen maradnak, tooltip a címkékhez.
- **Hatókör**: csak az **étterem** (`variant === 'restaurant'`) navnál. A salon
  nav változatlan.
- **Logó áthelyezés**: az étterem navban a saját logóm a **Kijelentkezés gomb
  alá** kerüljön (nem a tetejére). _(Pontosítandó: melyik logó — a salon/étterem
  saját brandje, vagy a Schedulio logó? A jelenlegi nav tetején a `SchedulioLogo`
  van, alatta a `salonName` + nyilvános oldal link.)_

## Jelenlegi állapot (kód)

- **KPI kártyák**: `src/app/(app)/restaurant/bookings/page.tsx:115-120`,
  **server komponensben**, a `DailyView` (kliens) felett. A server oldal nem
  tudja, melyik nézet aktív.
- **Bal oldali nav**: `DashboardNav` desktop sidebar fix `w-56`, a
  `restaurant/layout.tsx`-ben renderelve a `<main>` mellett. Nincs összecsukás.
- **Idővonal nézet**: `TimelineView` a `DailyView`-n belül, `view` state
  (`list`/`timeline`/`floor`) kliens oldalon, `localStorage`-ban perzisztálva
  (`STORAGE_KEY = 'restaurant-daily-view'`).

**Fő kihívás:** a `view` állapot a `DailyView`-ban (kliens) él, de a KPI kártyák
és a nav server komponensekben. Ezeket közös kliens-kontextus alá kell hozni.

## Terv

### 1. Új kontextus — `RestaurantUIContext` (kliens)

Új fájl: `src/components/restaurant/RestaurantUIContext.tsx`

- Állapot:
  - `focusMode: boolean` — timeline aktiválja, nav-nyitás kikapcsolja.
  - `navCollapsed: boolean` — a desktop sidebar állapota.
- A `focusMode` egyszerre vezérli a KPI rejtést és a nav collapse-ot.
- API:
  - `enterFocus()` → `focusMode = true`, `navCollapsed = true`.
  - `exitFocus()` → `focusMode = false`, `navCollapsed = false` (a `view` nem
    változik).
  - `toggleNav()` → kézi nyit/csuk; nyitáskor `exitFocus()` hatás.

### 2. `restaurant/layout.tsx`

- A gyökér `<div>`-et becsomagolom a `RestaurantUIProvider`-be (kliens wrapper a
  server layout köré).
- A `DashboardNav` a provider alól olvassa a collapse állapotot.

### 3. `DashboardNav.tsx` — összecsukható desktop sidebar (csak `restaurant`)

- `aside`: `w-56` → `w-16` ikon-only, ha `navCollapsed`. Címkék, widgetek
  (SubscriptionWidget, OfflineIndicator, ThemeToggle szövegei) elrejtve, ikonok
  középre.
- Toggle gomb (chevron) a logó mellett.
- Nav kézi kinyitása → provider `exitFocus()` (KPI visszajön).
- `localStorage` perzisztencia a kézi preferenciához.
- **Logó áthelyezés**: a saját logó a Kijelentkezés gomb **alá** kerül.

### 4. KPI kártyák — kliens wrapper a `bookings/page.tsx`-ben

- A 4 `StatCard`-ot új kliens komponensbe (`DayKpiBar`) teszem, ami a
  providerből olvassa a `focusMode`-ot, és `focusMode` esetén nem renderel. A
  server által számolt értékeket propként kapja.

### 5. `DailyView.tsx`

- `pick(v)` váltáskor: `v === 'timeline'` → `enterFocus()`; egyébként
  `exitFocus()`.
- A providerből olvas (`useRestaurantUI`).

## Érintett fájlok

- **új:** `src/components/restaurant/RestaurantUIContext.tsx`
- **új:** `src/components/restaurant/DayKpiBar.tsx`
- **mód:** `src/app/(app)/restaurant/layout.tsx`
- **mód:** `src/app/(app)/restaurant/bookings/page.tsx`
- **mód:** `src/components/dashboard/DashboardNav.tsx`
- **mód:** `src/components/restaurant/DailyView.tsx`

## Nyitott kérdés

- Melyik logó kerüljön a Kijelentkezés gomb alá? A jelenlegi nav tetején a
  `SchedulioLogo` áll. Ha a saját (étterem) brand logót akarjuk oda tenni, az hol
  érhető el (van-e `restaurant.logo` mező)?
