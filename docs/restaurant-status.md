# Schedulio – következő nagy feladatok (státusz)

> Eldöntött terv és hatókör. Frissítve: 2026-05-24.
> Hátralévő sorrend: **KPI/analytics → export → onboarding**.

## Jelmagyarázat
- [ ] tervezett · [~] folyamatban · [x] kész

---

## 1. Beállítások – sliderek ✅
- [x] `require_phone` checkbox → toggle **slider** UI
- [x] Új `notify_new_bookings` slider (default: `true`) – „Kérek értesítést új foglalásokról"
- [x] Étterem **és** szalon: collection mező + settings form
- [x] Közös `ToggleSwitch` komponens (`src/components/ui/toggle-switch.tsx`)
- [x] Szalon foglaló oldal: telefon kötelezőség a `require_phone` szerint (`BookingWizard`)

**Érintett:** `Restaurants.ts`, `Salons.ts`, `RestaurantSettingsForm.tsx`, `SalonSettingsForm.tsx`

## 2. Értesítési központ (app-on belül, e-mail nélkül) ✅
- [x] `Notifications` collection: `restaurant`/`salon` reláció, `type` (new_booking/cancellation), `title`, `body`, `read`, foglalás-reláció
- [x] Közös `notifyOnBooking(kind)` `afterChange` hook gyár (`src/payload/hooks/notifyOnBooking.ts`) – create-kor és lemondáskor, **csak ha a tulajnál `notify_new_bookings` be van kapcsolva**
- [x] Rákötve: `Reservations.ts` (`restaurant`) **és** `Bookings.ts` (`salon`)
- [x] Harang ikon + dropdown a `DashboardNav`-ban (`NotificationBell.tsx`), olvasatlan számláló, „olvasottnak jelöl"
- [x] `/api/notifications` route

## 3. Walk-in (beeső) – csak étterem ✅
- [x] `Reservations.ts`: `source` select – `online` (default) / `walk_in` / `phone`
- [x] `duration_minutes` mező – kiválasztható ülésidő (60 / 90 / 120 perc), üresen alapértelmezett a `turn_duration_minutes`
- [x] **Név nem kötelező** beeső/telefonos foglalásnál: üres név → default érték (`walk_in` → „Beeső", `phone` → „Telefon"). A csere a `manage-reservation` route-ban történik (`route.ts`), nem `beforeChange` hookban. Online foglalásnál a név továbbra is kötelező.
- [x] Rögzítő felület: `ReservationEditSheet` – source + duration választó, opcionális név placeholderrel; `DailyView`-ból nyílik

## 4. KPI kártyák – mindkét helyen [~]
- [x] Napi gyorskártyák a **bookings oldal** tetején: aktív / befejezett / lemondva-nem jött / beeső (`bookings/page.tsx`)
- [ ] **Analytics** oldal kártyasorának bővítése státusz-bontással (lemondási arány, no-show, walk-in arány)
- [ ] `getRestaurantStats` bővítése napi státusz-bontással + walk-in számmal

**Érintett:** `analytics/page.tsx`, `lib/restaurantStats.ts`, `StatCard`

## 5. Export – napi / heti / havi
- [ ] `export-csv` route általánosítása **étteremre is** (jelenleg csak szalon: hardkódolt `bookings`/`salon`)
- [ ] Étteremnél `PeriodFilter csvExport` bekapcsolása
- [ ] A három gomb (napi/heti/havi) az exportált időszakot választja

## 6. Onboarding / Súgó (utolsó – polish)
- [ ] Regisztráció utáni bevezető overlay: glass/blur kártyák
- [ ] Egérkövető fény-effekt (radial gradient a kurzor körül)
- [ ] Újrahívható „Tippek és trükkök" panel; első bejelentkezéskor automatikus

---

## Meglévő alap (erre építünk, nem nullából)
- `analytics` oldal mindkét modulra
- `getRestaurantStats` (`lib/restaurantStats.ts`) – már számol `todayDocs`, `completionRate` stb.
- `StatCard`, `PeriodFilter` (van `csvExport` flag)
- `export-csv` route (jelenleg csak szalon)
