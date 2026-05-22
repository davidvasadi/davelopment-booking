# Schedulio — Éttermi modul állapot (2026.05.22)

Az éttermi asztalfoglaló modul külön státusz-dokumentuma. A fő projekt-állapot: [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Jelenlegi állapot

**Collections + regisztráció + dashboard (alap CRUD) + dashboard-felzárkóztatás a szalon szintjére (áttekintő KPI-k, statisztikák oldal, előfizetés oldal, settings logó/borító + veszélyzóna) KÉSZ. Foglalási logika (slot-számítás, asztal-allokáció, nyilvános foglaló oldal) HÁTRAVAN.**

A build TypeScript-tiszta (`npx tsc --noEmit` átmegy).

> **2026.05.22 — dashboard-felzárkóztatás:** Az éttermi `/restaurant` dashboard mostantól a szalon-`/dashboard` szintjén van vizuálisan/funkcionálisan. Új: KPI-kártyák (mai foglalás, mai vendégszám, kihasználtság %, 30 napos trend) + foglalás-trend grafikon + mai program lista; külön **Statisztikák** oldal (`/restaurant/analytics`) period-szűrővel; **Előfizetés** oldal (`/restaurant/subscription` — eddig 404-es link volt); a settingsben logó/borítókép feltöltés + veszélyzóna (fiók törlés). A foglalási logika (slot/allokáció/nyilvános oldal) továbbra is hátravan.

---

## Architektúra

3 rétegű, a szalon-modullal párhuzamos:

| Réteg | Útvonal | Funkció |
|-------|---------|---------|
| Operátor | `/admin` | Payload CMS (Étterem csoport: Restaurants + rejtett gyermek-collectionök) |
| Tulajdonos | `/restaurant` | Étterem dashboard (lent részletezve) |
| Vendég | `/r/[slug]` | **Nyilvános foglaló — még nem létezik** |

A `restaurant_owner` role login/regisztráció után a `/restaurant`-ra kerül (a szalon-`/dashboard` átirányít ide).

---

## Payload Collections

| Collection | Mezők | Állapot |
|------------|-------|---------|
| Restaurants | name, slug, owner, description, city, address, phone, email, cover_image, logo, **capacity_mode** (tables/flat), max_pax, turn_duration_minutes, slot_step_minutes, lead_time_hours, require_phone, is_active; join: rooms/tables/opening_hours/reservations | Kész. `afterChange` → trial subscription (`req` átadással!). `beforeDelete` → kaszkád. |
| Rooms | restaurant, name, is_active, sort_order | Kész — az asztalok teremhez tartoznak |
| Tables | restaurant, room, name, capacity, is_active, sort_order | Kész |
| OpeningHours | restaurant, day_of_week, is_open, open_time, close_time (HH:MM text) | Kész — a `Turns` collectiont váltotta le |
| Reservations | restaurant, date (YYYY-MM-DD text), start_time, end_time, pax, table, customer_*, notes, internal_notes, status (pending/confirmed/seated/completed/no_show/cancelled), cancel_token | Alap kész. **Foglalási logika hátravan.** |

**Hozzáférés-vezérlés:** a gyermek-collectionök (rooms, tables, opening-hours, reservations) `update`/`delete` access-e `isRestaurantOwnerOrAdmin` ([src/payload/access/restaurantAccess.ts](src/payload/access/restaurantAccess.ts)) — a tulajdonos csak a SAJÁT étterméhez tartozó rekordokat módosíthatja (async lookup, `restaurant in [owned ids]` szűrő). A `create` egyelőre `!!req.user` (a body adja a `restaurant`-ot; a seed + dashboard owner-ként hív). Reservations `create`/`read` nyitva marad a jövőbeli nyilvános foglalóhoz.

---

## Routes

| Route | Funkció |
|-------|---------|
| `/register-restaurant` | 3 lépéses éttermi reg (sablon → user+étterem → siker); seed-template háttérben |
| `/restaurant` | Áttekintő dashboard — KPI-kártyák (mai foglalás/vendég/kihasználtság/30 nap), insight bar, foglalás-trend grafikon, mai program lista státusz-váltással |
| `/restaurant/analytics` | **ÚJ** — Statisztikák: period-szűrő, KPI-k (foglalás/vendég/átl. társaság/teljesítési arány), trend + óránkénti + heti grafikonok |
| `/restaurant/bookings` | Foglalások napi nézet (dátum-navigátor) + státusz-váltás dropdown |
| `/restaurant/tables` | Termek + asztalok CRUD (flat módban placeholder) |
| `/restaurant/availability` | Nyitvatartás-szerkesztő (7 nap, nyitva/zárva + idő, mentés) |
| `/restaurant/settings` | Étterem profil + foglalási beállítások + subscription kártya + **logó/borítókép feltöltés** + **veszélyzóna (fiók törlés)** |
| `/restaurant/subscription` | **ÚJ** — előfizetés oldal a szalon `/dashboard/subscription` mintájára (KPI-k, státusz, Pro funkciók, fizetés/lemondás, lock notice) |
| `/api/restaurant/seed-template` | Sablon-betöltő (capacity/turn/slot/lead beállítás + termek+asztalok+nyitvatartás) |
| `/api/restaurant/delete-account` | **ÚJ** — étterem-tulajdonos fiók + étterem (kaszkád) + user törlése |

A dashboard a Payload REST-et használja CRUD-hoz (`/api/restaurants`, `/api/rooms`, `/api/tables`, `/api/opening-hours`, `/api/reservations`) `credentials: include` cookie-auth-tal.

---

## Komponensek

| Komponens | Szerep |
|-----------|--------|
| `DashboardNav` | **Közös** szalon+étterem sidebar — paraméterezett (`navItems`, `publicUrlPrefix`, `settingsHref`, `subscriptionHref`); az étterem a saját nav-itemekkel hívja. Nincs külön éttermi nav-komponens. |
| `MobileBottomNav` | **Közös** mobil bottom nav (lebegő sziget + „Több” sheet) — szintén `navItems`/`settingsHref` propokkal |
| `SubscriptionBanner` | **Közös** — `basePath` proppal (szalon `/dashboard`, étterem `/restaurant`) |
| `SubscriptionCard` | **Közös** szalon+étterem előfizetés-kártya (settings tetején) |
| `DashboardLockModal` | **Közös** — whitelist + dinamikus settings-href szalonra és étteremre |
| `ReservationActions` | Foglalás státusz-váltás dropdown (pending→confirmed→seated→completed / no_show / cancelled) |
| `ReservationDateFilter` | Napi navigátor (lokális YYYY-MM-DD, nincs UTC-csúszás) |
| `TablesManager` | Termek + asztalok inline szerkesztés/törlés/hozzáadás |
| `OpeningHoursEditor` | 7 napos nyitvatartás-szerkesztő, batch mentés (upsert) |
| `RestaurantSettingsForm` | Profil + kapacitás-beállítások form + **logó/borítókép feltöltés** (`/api/media`) + **veszélyzóna** (`Section`/`Input`/`Label` szalon-minta) |
| `StatCard` | **Közös, ÚJ** — egyszerű KPI-kártya (a `KpiCardWithDetails` vizuális stílusa, de sheet/drill-down nélkül; étterem-modulhoz, ahol nincs revenue-alapú részletezés) |
| `ReservationTrendChart` | **ÚJ** a `DashboardCharts`-ban — foglalás-szám / vendégszám (pax) area chart (a `TrendChart` mintája, HUF-formázás nélkül). A pax a `DayData.revenue` mezőben utazik. |
| `PeriodFilter` | **Közös** — most `basePath` + `csvExport` propokkal (szalon: CSV-vel, étterem: anélkül) |
| `getOwnedRestaurant()` | Közös szerver-helper: auth + étterem-lekérés + redirect; visszaad `{ userId, restaurant }` ([src/lib/restaurantContext.ts](src/lib/restaurantContext.ts)) |
| `getRestaurantStats()` | **ÚJ** szerver-helper ([src/lib/restaurantStats.ts](src/lib/restaurantStats.ts)) — mai/havi/időszaki foglalás + pax, kihasználtság %, 30 napos trend, heti/óránkénti eloszlás. Kihasználtság = napi pax / (nyitvatartásba férő turnusok × férőhely). |

**UI — a szalon-dashboard teljes szerkezetét újrahasználja, nem másolja:**
- A layout `flex flex-col lg:flex-row` + a **közös `DashboardNav` sidebar** és **`MobileBottomNav`** (ugyanaz a komponens, eltérő `navItems`/útvonalak propokkal) — egy helyen karbantartva.
- Oldalakon belül: eyebrow + `text-3xl font-black` fejléc, `p-5 lg:p-8` padding, `Section` kártyák, `Input`/`Label` komponensek, `rounded-full` mentés gomb, `bg-white ... dark:bg-white/[0.04]` kártyák.

---

## Sablonok (`src/lib/restaurantTemplates.ts`)

4 bővített sablon (asztal-generátorral, eltérő nyitvatartással):

| Sablon | Mód | Termek / asztalok | Nyitvatartás |
|--------|-----|-------------------|--------------|
| **Klasszikus étterem** | tables | Belső terem (11) + Terasz (6) | hétfő zárva, kedd–csüt 11:30–22, péntek-szombat –23:30, vas –21 |
| **Nagy étterem** | tables | Földszint + Emelet + Terasz + Rendezvényterem (~40 asztal, 2–12 fős) | minden nap 10–23:30 |
| **Kávézó / Bisztró** | tables | Belső tér + bárpult (egyfős helyek), 90 perc / 15 perc lépték | minden nap 8–20 |
| **Egyszerű (flat)** | flat | nincs asztal, max 50 fő / időablak | hétfő zárva, hét 12–22, hétvége –23:59 |

Helperek: `everyDay`, `weekHours`, `customDays`, `tablesOf`. `DAY_LABELS_HU` a magyar napnevekhez.

---

## Hátravan (foglalási logika — a lényeg)

- **Slot/időablak-számítás**: nyitvatartás + `turn_duration_minutes` + `slot_step_minutes` + `lead_time_hours` alapján szabad időpontok
- **Asztal-allokáció (tables mód)**: pax → megfelelő kapacitású szabad asztal adott időablakban; ütközés-ellenőrzés a meglévő foglalásokkal
- **Flat kapacitás mód**: időablakonkénti összesített pax-limit (`max_pax`) ellenőrzése
- **Nyilvános foglaló oldal** `/r/[slug]` + `/r/[slug]/book` + `/r/[slug]/book/success`
- **Reservations API** (létrehozás slot-validációval, lemondás token-nel, visszaigazoló email Resend-del + ICS)
- **Étterem dashboard finomítás**: asztaltérkép-vizualizáció, foglalások lista-nézet (nem csak napi)
- **Payload admin**: Restaurants-tab szerkezet (mint a Salons-nál) a rejtett gyermek-collectionökhöz
- **`/register` belépőpont**: az "Étterem" kártya kösse át `/register-restaurant`-ra

## Kész (2026.05.22 — dashboard-felzárkóztatás)

- ✅ Áttekintő KPI-k + foglalás-trend + mai program lista
- ✅ `/restaurant/analytics` Statisztikák oldal + nav-elem
- ✅ `/restaurant/subscription` oldal (a 404-es link megszűnt)
- ✅ Logó/borítókép feltöltés + veszélyzóna (fiók törlés) a settingsben

---

*Frissítve: 2026.05.22 — Claude (dashboard-felzárkóztatás a szalon szintjére: KPI-k, statisztikák, előfizetés oldal, settings logó/borító + veszélyzóna)*
