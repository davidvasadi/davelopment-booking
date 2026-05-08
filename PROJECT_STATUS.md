# Bookly Projekt Állapot — 2026.05.07

## Jelenlegi állapot: MVP KÉSZ + ANALYTICS DASHBOARD + FIÓKKEZELÉS

A build tiszta, TypeScript hibák nélkül.

### UI stílus (Dribbble-inspired)
- **Design language:** `#F5F4F2` meleg szürke háttér, fehér `shadow-sm` kártyák, bold fekete/fehér, grotesque tipográfia
- **Gombok:** `rounded-full` pill shape, zinc-950 fill
- **Inputok:** `rounded-xl`, zinc-50 background
- **Dashboard sidebar:** `bg-zinc-950`, fehér aktív state, Bookly brand
- **Dashboard tartalom:** `bg-[#F5F4F2]` háttér, fehér `rounded-2xl shadow-sm` kártyák, uppercase section fejlécek
- **Nyilvános szalon oldal:** zinc-950 hero + cover image support, services lista kártya, staff `aspect-[4/5]` fotókártya rács gradient overlay-el, mobil sticky CTA
- **Foglalási varázsló:** 4 lépéses (Szolgáltatás → Munkatárs → Időpont → Adatok), horizontálisan scrollozható `DateStrip`, staff photo cards gradient placeholder, sticky pill CTA
- **Kész:** Login ✓, Register (3-lépéses wizard) ✓, Forgot password ✓
- **Kész:** Dashboard áttekintés ✓, Foglalások ✓, Szolgáltatások ✓, Munkatársak ✓, Nyitvatartás ✓, Beállítások ✓

---

## Routes

| Route | Típus | Funkció |
|-------|-------|---------|
| `/` | Statikus | Landing oldal |
| `/admin` | Dinamikus | Payload CMS admin (fejlesztői eszköz) |
| `/bookly/login` | Statikus | Szalontulajdonos bejelentkezés |
| `/bookly/register` | Statikus | 3 lépéses regisztráció (user + szalon + staff) |
| `/bookly/forgot-password` | Statikus | Jelszó visszaállítás |
| `/bookly/verify-email` | Statikus | Email megerősítés |
| `/bookly/dashboard` | Dinamikus | Áttekintő (mai foglalások + havi statisztika) |
| `/bookly/dashboard/bookings` | Dinamikus | Foglalások nézet (napi szűrő + státusz változtatás) |
| `/bookly/dashboard/services` | Dinamikus | Szolgáltatások CRUD |
| `/bookly/dashboard/staff` | Dinamikus | Munkatársak CRUD + avatar feltöltés (object-top) + elérhetőség naptár |
| `/bookly/dashboard/availability` | Dinamikus | Nyitvatartás (7 napos rács, szalon szintű) |
| `/bookly/dashboard/settings` | Dinamikus | Szalon profil szerkesztés + logó + borítókép feltöltés + fiók törlése (veszélyzóna) |
| `/bookly/[slug]` | Dinamikus | Nyilvános szalon oldal |
| `/bookly/[slug]/book` | Dinamikus | 4 lépéses foglalási varázsló |
| `/bookly/[slug]/book/success` | Dinamikus | Foglalás visszaigazolás |
| `/api/bookly/slots` | API | Szabad időpontok lekérdezése |
| `/api/bookly/bookings` | API | Foglalás létrehozása |
| `/api/bookly/me` | API | Bejelentkezett user adatai |
| `/api/bookly/delete-account` | API | Teljes fiók + szalon + összes adat törlése |

---

## Payload Collections

| Collection | Állapot |
|------------|---------|
| Users | Kész — auth, role, email verify |
| Salons | Kész — slug, owner, cím, kontakt; **5 tab** (Alap adatok, Munkatársak, Szolgáltatások, Foglalások, Elérhetőség) join fieldekkel |
| Staff | Kész — bio, avatar (Media relation); admin-ban rejtett (`hidden: true`), Salons tabon keresztül érhető el |
| Services | Kész — ár, időtartam, pénznem, kép; admin-ban rejtett, Salons tabon keresztül érhető el |
| Bookings | Kész — ügyfél adatok, státusz, időpont; admin-ban rejtett, Salons tabon keresztül érhető el |
| Availability | Kész — ismétlődő + kivételek, delete access; admin-ban rejtett, Salons tabon keresztül érhető el |
| Media | Kész — képfeltöltés (JPEG/PNG/WEBP/GIF/SVG), `public/uploads/` mappa |

---

## Infrastruktúra

| Elem | Állapot |
|------|---------|
| Next.js 16 | Fut — `proxy.ts` (middleware helyett) |
| Payload CMS v3 | Működik |
| PostgreSQL (bookly DB) | Kapcsolódva |
| TypeScript | 0 hiba |
| Build | Tiszta |
| PostCSS + Tailwind | Működik (postcss.config.mjs) |

---

## 3 rétegű SaaS architektúra

```
Operátor  → /admin              (Payload CMS — fejlesztői eszköz)
Tulajdonos → /bookly/dashboard  (saját szalon kezelése)
Ügyfél    → /bookly/[slug]      (foglalás leadása)
```

---

## Hol lehet belépni?

**Első belépés (admin):**
`http://localhost:3000/admin/create-first-user`

**Szalontulajdonos regisztráció:**
`http://localhost:3000/bookly/register`

**Szalontulajdonos bejelentkezés:**
`http://localhost:3000/bookly/login`

---

## Környezeti változók (.env.local)

```
DATABASE_URI=postgresql://dave@localhost:5432/bookly
PAYLOAD_SECRET=bookly-dev-secret-2026-change-in-production
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=your-resend-api-key-here   ← Email értesítéshez szükséges
```

---

## Ismert bugok és javítások

| Bug | Javítás |
|-----|---------|
| Regisztrációnál email uniqueness hiba angol szöveggel | Magyar hibaüzenetre cserélve |
| Login után hiányzott az `!loginRes.ok` ellenőrzés | Hozzáadva |
| Félbemaradt regisztráció (user létrejött, szalon nem) | Recovery flow: bejelentkeztet és folytatja szalon létrehozásával |
| Slug ütközés azonos szalonnévnél | Automatikus suffix (`-[id]`) retry |
| **Dashboard 0 mai foglalást mutatott** | `date` mező `timestamptz` → `text` (`YYYY-MM-DD`), SQL migráció futtatva, timezone-csúszás megszűnt |
| **Múltbeli időpontra lehetett foglalni** | `getAvailableSlots` kiszűri az elmúlt slotokat; booking API elutasítja a múltbeli dátum/időpontokat |
| **Silent 403 minden PATCH kérésre** | Access control type mismatch (`number !== string`): `Salons` → `id` URL-paraméter, `Services`/`Availability` → `Number()` konverzió, `Bookings` → aszinkron lookup |
| **DateFilter csúnya natív date input** | Pill gomb formázott magyar dátummal + rejtett native input |
| **middleware.ts deprecation warning** | `proxy.ts`-re váltva (Next.js 16 előírás); `atob()` az Edge Runtime kompatibilis base64 dekódhoz |
| **BookingWizard crash `?serviceId=` URL paraméterrel** | `services.find(s => s.id === state.serviceId)` strict int vs. string mismatch → `String()` konverzióra javítva |
| **Dátum timezone-csúszás a wizardban** | `toISOString().split('T')[0]` UTC-be konvertált → Budapest UTC+2-ben egy napot csúszott. Fix: `format(d, 'yyyy-MM-dd')` date-fns-ből |
| **Staff exception típus mismatch** | `staffRef` integer, `staffId` string → `===` mindig false → egyéni időpont soha nem érvényesült. Fix: `String()` konverzió |
| **Slot lépés fix 15 perc volt** | `cursor += 15` → `cursor += durationMinutes` — most a szolgáltatás hossza határozza meg a lépést |
| **Képfeltöltés `ENOENT /public`** | `staticDir: '/public/uploads'` abszolút gyökér path volt → `path.join(process.cwd(), 'public/uploads')` |
| **proxy.ts `middleware` export névvel** | A függvény neve `middleware` volt → `proxy`-ra javítva (Next.js 16 elvárás) |
| **Foglalási wizard szűrő ikon** | `SlidersHorizontal` ikon kattintható volt de nem csinált semmit → eltávolítva |
| **Staff avatar object-cover** | Dashboard lista nézetben `object-top` lett hogy az arcok látszódjanak |
| **Képek X gomb nem törölt az adatbázisból** | `removeImage`/`removeAvatar` mostantól `DELETE /api/media/{id}` hívással törli a Media rekordot is |
| **Admin sidebar flat lista minden collectionnek** | Staff/Services/Bookings/Availability `hidden: true` — csak Salons tabokon keresztül érhetők el; sidebar: Users · Salons · Media |

---

## Architektúra döntések

- `date` és `exception_date` mezők `text` típusú `YYYY-MM-DD` stringek — **ne** Payload `date` típus (timestamptz), timezone-konverzió mellékhatásainak elkerülése miatt
- Payload access control async függvényt használhat (`req.payload.findByID` + `overrideAccess: true`) ha a request body nem tartalmazza a szükséges mezőket
- Staff elérhetőség két réteg: `recurring: true` + `day_of_week` (heti alap) + `recurring: false` + `exception_date` (napi felülírás, per-staff)
- Ha staffnak van bármilyen recurring rekordja, a hiányzó napok = zárva (nem esik vissza szalon-szintre)
- Avatar feltöltés: multipart/form-data `POST /api/media` → Payload Media collection → staff/salon `avatar`/`logo`/`cover_image` relation
- Slot lépés = `service.duration_minutes` (nem fix 15 perc); buffer csak existing foglalások utáni blokkoláshoz
- `autoCompleteBookings` fut minden dashboard layout render-kor (háttérben, nem blokkoló) — elmúlt foglalásokat `completed`-re zárja
- Foglalási wizard flow: staffból jött → service kiválasztása után skip staff lépés, egyből dátum
- Dashboard analytics: `getDashboardStats` egyetlen lekérdezéssel aggregálja az utolsó 60 nap adatait — KPI kártyák %-os diff-fel, TrendChart (recharts AreaChart), DowChart (BarChart), ServiceChart + StaffChart (custom progress bars)
- Fiók törlés sorrend: foglalások → elérhetőség → szolgáltatások → munkatársak → szalon → user → cookie törlés
- Payload admin szalon-centrikus: `join` field típus (`collection + on`) virtuális reverse-relation — szalononként böngészhető az összes kapcsolódó adat
- Admin `/admin` útvonal: Payload saját login oldala; proxy.ts csak a `payload-token` cookie role-ját ellenőrzi (admin vs salon_owner)

---

## Következő lépések (prioritás sorrendben)

### Közel (core funkciók)
- **Visszaigazoló email** — ügyfélnek foglalás után (Resend), szalontulajdonosnak új foglaláskor
- **Landing page** (`/`) — teljes újratervezés, értékesítési oldal
- **Foglalás lemondás** — ügyfél saját foglalást lemondhatja (token alapú link emailben)

### Közép
- Operátori szuperadmin felület (regisztrált szalonok, statisztikák)
- Havi előfizetés kezelés (Stripe)
- SMS értesítés (Twilio) — emlékeztető 24h előtte
- Naptár export (iCal / Google Calendar)

### Távolabbi
- Push értesítések (PWA)
- Több szalon kezelése egy felhasználóval
- Online fizetés (Stripe checkout)

---

*Frissítve: 2026.05.07 (hajnal) — Claude*
