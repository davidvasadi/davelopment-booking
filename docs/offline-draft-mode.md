# Offline vázlat mód — fejlesztési leírás

> Étterem foglalás-oldal (`/restaurant/bookings`) működése netkiesés alatt.
> Állapot: **implementálva, prod build-validálás még hátra** (lásd lent).

## Cél

Ha az étteremben 1-2 órára elmegy az internet, a személyzet:
- továbbra is **lássa** az aznapi foglalásokat (offline is),
- fel tudjon venni **új foglalást vázlatként** (az eszközön marad, oldalfrissítés után is),
- a vázlatot **megnézze / törölje**,
- a vázlat **foglaljon** a nézetben (kapacitás/asztal-foglaltság), hogy ne foglaljanak fölé,
- a net visszatértekor **kézzel véglegesítse** a vázlatokat (A út), a meglévő szerveroldali
  validáció (túlfoglalás-ellenőrzés) futtatásával.

Az **adat sosem vész el**: a szerver+DB a kiesésen kívül van, az online foglalások közben
is beérkeznek. A kockázat csak a kiesés alatti helyi használhatóság és a dupla foglalás.

## Eldöntött tervezési döntések

| Kérdés | Döntés |
|---|---|
| Szint | Teljes vázlat mód (A út) + PWA |
| Offline-érzékelés | Automatikus (`navigator.onLine` + bukott fetch) |
| Szinkron net visszatértekor | Kézi véglegesítés, a meglévő `manage-reservation` POST validál |
| Tárolás | `localStorage`, restaurant-id szerint szűrve; túléli a frissítést |
| Vázlat a kapacitásban | **Számít** (foglal), de végig "VÁZLAT"-ként jelölve |
| Vázlat élettartama | Amíg kézzel nem rendezik (nincs auto-lejárat) |

Kulcs-elv: a vázlat mód lényegében **"elhalasztott POST"** — nincs új szerveroldali
ütközés-logika, a meglévő `manage-reservation` a validátor.

## Mit csinál a kód (fájlonként)

### Új fájlok
- **`src/lib/offlineDrafts.ts`** — lokális vázlat-tár (`localStorage`).
  CRUD: `getDrafts`, `listDraftsForDate`, `addDraft`, `removeDraft` + `subscribeDrafts`
  (saját fül `CustomEvent` + más fül `storage` esemény → élő frissülés).
  Egy vázlat = a `manage-reservation` POST payload + `draftId`, `restaurantId`, `createdAt`,
  plusz megjelenítési segédmezők (`tableNames`, `end_time`).
- **`src/lib/useOnline.ts`** — `useOnline()` hook, élő online/offline állapot.
- **`src/components/restaurant/OfflineBanner.tsx`** — állapotsáv a lap tetején:
  offline figyelmeztetés; online + függő vázlatok esetén kinyitható lista soronkénti
  **Véglegesít** / **Töröl** gombbal és **Összes véglegesítése** gombbal.
  A véglegesítés a `/api/restaurant/manage-reservation` POST-ot futtatja (siker → vázlat
  törlődik; 409 ütközés → hibát mutat, ember dönt).
- **`src/components/ServiceWorkerRegister.tsx`** — a `/sw.js` regisztrációja, **csak prod
  build-ben** (dev/Turbopack HMR ne ütközzön a cache-sel).
- **`public/sw.js`** — service worker. Navigáció: network-first, offline fallback a
  cache-elt oldalra. Statikus assetek: stale-while-revalidate. **Az `/api/*` SOSEM
  cache-elt** (a foglalás-adat változékony).
- **`src/app/(app)/manifest.ts`** — PWA manifest (`start_url: /restaurant/bookings`,
  `display: standalone`).

### Módosított fájlok
- **`src/app/(app)/restaurant/bookings/page.tsx`** — átadja a `restaurantId`-t a `DailyView`-nak.
- **`src/app/(app)/layout.tsx`** — beköti a `<ServiceWorkerRegister />`-t.
- **`src/components/restaurant/DailyView.tsx`**
  - betölti és élőben követi a lokális vázlatokat,
  - a napi vázlatokat "ál-foglalásként" (`__draft` jelölő) **beolvasztja** a foglalás-listába,
    így automatikusan számítanak a kapacitásba/foglaltságba,
  - lista- és idővonal-nézetben a vázlat **szaggatott kerettel + "VÁZLAT" címkével** látszik,
  - a `<OfflineBanner />` a lap tetejére kerül,
  - belső nézetek típusa `ViewProps`-ra váltott (a `restaurantId` csak a top-level prop).
- **`src/components/restaurant/ReservationEditSheet.tsx`**
  - offline (vagy hálózati hiba) esetén **új** foglalásnál a `save()` lokális vázlatot ment
    a szerver-POST helyett (`saveDraft`),
  - **szerkesztést offline nem engedünk** (ahhoz szerver kell) — a gomb letiltva,
  - a gomb felirata offline állapotban jelzi a vázlat-mentést.

## Felhasználói folyamat (példa: "19:00, 4 fő, 5-ös asztal")

1. 18:30 — elmegy a net. Az app vázlat módba vált (sárga sáv).
2. A pincér felveszi a foglalást → **vázlatként** mentődik, az idővonalon szaggatott
   blokként látszik a 5-ös asztalon (tehát foglal, nem foglalnak fölé).
3. Oldalfrissítés / tablet-újraindítás → a vázlat **megmarad** (localStorage).
4. 20:00 — net visszajön. A sávban: "1 mentésre váró vázlat — Átnézés".
5. **Véglegesít** → a szerver újraellenőrzi (látja a közben beérkezett online foglalásokat is):
   - szabad → bementődik, a vázlat törlődik,
   - foglalt (409) → hibát mutat, a személyzet módosít vagy elvet.

## Ismert korlátok

- **Offline ütközés-ellenőrzés közelítő**: az eszköz csak a kiesés előtt letöltött adatot
  látja. A kiesés alatt beérkező online foglalást vagy másik eszköz vázlatát nem ismeri —
  a biztos választ a véglegesítéskori szerver-validáció adja.
- **PWA ikon**: jelenleg az SVG favicont használja; dedikált PNG ikonok (192/512) később.

## Hátralévő / validálás

- [ ] **Prod build** lefuttatása (`npm run build`), hogy a `manifest.ts` route és a
      service worker a Next 16 + Turbopack build-del is rendben legyen. (Eddig csak
      `tsc --noEmit` futott le — az offline-mód fájljaiban nincs hiba; a `src/lib/email.ts:234`
      hiba **régi, nem ehhez a munkához tartozik**.)
- [ ] Kézi teszt: DevTools → Network → Offline, foglalás-felvétel, frissítés, majd vissza
      online + véglegesítés.
- [ ] Dedikált PWA PNG ikonok (opcionális).
- [ ] Még **nincs commitolva**.
