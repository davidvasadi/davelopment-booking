# Bookly — Online Időpontfoglaló SaaS

> Kis vállalkozóknak szánt, önálló időpontfoglaló rendszer.
> Nem kell hozzá weboldal — egy link és kész.

---

## 1. Termék koncepció

**Mi ez?**
Salonic / Alteg jellegű, de saját fejlesztésű, magyar SaaS időpontfoglaló platform.

**Kinek szól?**
- Fodrászok, kozmetikusok, masszőrök, körömszalonok
- Kis egyszemélyes / kis csapatos vállalkozások
- Akik nem akarnak teljes weboldalt venni, csak egy egyszerű foglalási linket

**Hogyan érik el az ügyfelek?**
Mindenki kap egy saját URL-t:
```
davelopment.hu/bookly/fodraszat-szabo-maria
davelopment.hu/bookly/kozmetika-anna
```
Ezt be lehet rakni Instagram bio-ba, Google Cégprofil-ba, névjegykártyára.

---

## 2. Architektúra

### Repo
- Külön GitHub repo: `bookly` (github.com/davelopment/bookly)
- Nem a davelopment repo-ba, önálló projekt
- Ágak: `main` (production), `dev` (development)
- Deploy: Git push → GitHub Actions → VPS (pm2 restart)
- Később SaaS-ként (domain, billing, stb.)

### Szerver
- Ugyanaz a VPS: `46.29.142.31` (deploy@)
- Egy PM2 process: `bookly` (Next.js fullstack, port 3000)
- Nginx proxy:
  - `davelopment.hu/bookly/*` → localhost:3000
  - `davelopment.hu/api/bookly/*` → localhost:3000/api
- Képfeltöltés: `/var/www/bookly/public/uploads/`
  - pm2: ecosystem.config.js-ben sync

### Stack
| Réteg | Technológia |
|---|---|
| Backend/CMS | Payload CMS v3 (Next.js alapú) |
| Frontend | Next.js 16 (App Router) |
| DB | PostgreSQL (külön adatbázis: `bookly`) |
| Email | Resend |
| Auth | Payload beépített auth + OAuth (Google, Facebook) |
| Image Processing | Sharp (webp konvertálás, resize) |
| Storage | `/public/uploads/` (VPS-en) |
| Styling | Tailwind CSS + Shadcn/ui (admin) |
| Deployment | PM2 + Nginx (meglévő szerveren) |

---

## 3. Adatmodell (Payload Collections)

### `salons` — Szalonok
```
id, name, slug (unique), description
owner (relationship → users)
logo (relationship → media)
cover_image (relationship → media)
address, city, phone, email, website
booking_buffer_minutes (pl. 15 perc szünet foglalások között)
is_active (boolean)
createdAt, updatedAt
```

### `staff` — Alkalmazottak / Fodrászok
```
id, name, bio
salon (relationship → salons)
avatar (relationship → media)
is_active (boolean)
```

### `services` — Szolgáltatások
```
id, name, description
salon (relationship → salons)
staff (relationship → staff, hasMany)
duration_minutes (number)
price (number)
currency (default: HUF)
is_active (boolean)
```

### `bookings` — Foglalások
```
id
salon (relationship → salons)
service (relationship → services)
staff (relationship → staff)
customer_name, customer_email, customer_phone
date (date)
start_time, end_time (text, pl. "10:00", "10:45")
status (enum: pending | confirmed | cancelled | completed)
notes (textarea)
createdAt, updatedAt
```

### `users` — Szalon tulajdonosok (Payload beépített)
```
email, password, name
role (enum: admin | salon_owner)
salon (relationship → salons)
```

### `availability` — Nyitvatartás / Elérhetőség
```
id
staff (relationship → staff, optional - ha nincs, szalon szintű)
day_of_week (0-6, 0=hétfő)
start_time, end_time (text, pl. "09:00", "18:00")
is_available (boolean)
recurring (boolean - rendszeres, vagy one-time exception)
exception_date (date, opcionális - ha egy konkrét nap más)
```

Példa:
- Szalon szinten: H-P 9:00-18:00
- Anna (staff) felülírás: Sze 9:00-14:00 (csak szerdán ilyen)
- Anna: szombat szabadság (exception: utolsó szombat)
- Péter: K-P 13:00-20:00 (később kezd)

---

## 4. Frontend útvonalak (Next.js)

### Publikus (ügyfél oldal)
```
/bookly/[slug]                    → Szalon főoldala (bemutatkozás + "Foglalj időpontot" gomb)
/bookly/[slug]/book               → Foglalási flow (szolgáltatás → munkatárs → nap → időpont → adatok)
/bookly/[slug]/book/confirm       → Foglalás megerősítése (email küldés)
/bookly/[slug]/book/success       → Sikeres foglalás visszaigazolás
```

### Szalon admin (tulajdonos)
```
/bookly/dashboard                 → Szalon dashboard (mai foglalások, heti nézet, statisztikák)
/bookly/dashboard/bookings        → Foglalások naptár + lista nézet
/bookly/dashboard/services        → Szolgáltatások kezelése (létrehozás, szerkesztés, törlés)
/bookly/dashboard/staff           → Munkatársak kezelése + egyedi elérhetőség
/bookly/dashboard/availability    → Nyitvatartás (szalon szint) + munkatárs override-ok
/bookly/dashboard/settings        → Szalon profil szerkesztés (logo, cover, cím, telefon, stb)
/bookly/dashboard/notifications   → Email értesítés beállítások
```

### Regisztráció / Auth
```
/bookly/register                  → Szalon regisztráció (5 lépés: adatok, logo, cover, munkatárs, nyitvatartás)
/bookly/register/welcome-tour     → Welcome tour az első login után (Guide: mit kell csinálni)
/bookly/login                     → Bejelentkezés (email/jelszó + Google/Facebook OAuth)
/bookly/forgot-password           → Jelszó visszaállítás
```

### Szuperadmin (neked)
```
/bookly/admin                     → Szuperadmin dashboard (összes szalon, bevételek, metrics)
/bookly/admin/salons              → Szalonok listája, státusz, módosítás lehetőség
/bookly/admin/users               → Szalon tulajdonosok listája
/bookly/admin/analytics           → Napi/heti/havi bevételek, foglalások trendje
/bookly/admin/settings            → Szuperadmin beállítások (commissions, rate limits)
```

---

## 5. Foglalási flow (UX)

```
1. Ügyfél megnyitja: davelopment.hu/bookly/fodraszat-anna
2. Látja a szalon profilját (logo, cover, leírás, munkatársak) → "Foglalj időpontot" gomb
3. Kiválaszt egy szolgáltatást (pl. Hajvágás — 45 perc — 4500 Ft)
4. Kiválaszt egy munkatársat (opcionális, ha több van)
5. Naptárban kiválaszt egy szabad NAPOT (szürke: szalon zárva; sötét: munkatárs foglalt; zöld: szabad)
6. Kiválaszt egy szabad IDŐPONTOT (csak az éppen kiválasztott munkatárs időelemei)
7. Megadja: neve, email, telefon (optional: megjegyzés)
8. Megerősítésre kattint
9. ✅ Email az ügyfélnek ÉS a szalon email-jére
10. Szalon dashboardon azonnal megjelenik az új foglalás
```

---

## 6. Email értesítések (Resend)

**Ügyfélnek:**
- 📧 Foglalás megerősítése (időpont, szolgáltatás, szalon neve, cím, térkép link)
- 📧 Emlékeztető (1 nappal előtte)
- 📧 Lemondás visszaigazolása

**Szalonnak:**
- 📧 Új foglalás értesítés (ügyfél neve, időpont, szolgáltatás)
- 📧 Lemondás értesítés

**Funkciók:**
- Minden email angol/magyar template-el
- Szalon logo-ja az emailben
- Unsubscribe link (GDPR compliance)
- UTM tracking (optional, analytics-hez)

---

## 8. MVP scope (1. verzió)

### ✅ KÖTELEZŐ
- Payload CMS setup (collections + relations)
- Email/jelszó auth (Payload beépített)
- OAuth login (Google + Facebook)
- Szalon regisztrációs flow (5 lépés: adatok, logo, cover, munkatárs, nyitvatartás)
- Welcome tour (első login után)
- Publikus szalon oldal (`/bookly/[slug]`)
- Foglalási flow (5 lépéses: szolgáltatás → munkatárs → nap → időpont → adatok)
- **Komplex szabad időpont logika** (szalon + munkatárs overlap)
- Email értesítők (Resend template-kal)
- Szalon dashboard:
  - Napi/heti nézet
  - Foglalások listája + naptár
  - Szolgáltatások szerkesztése
  - Munkatársak + egyedi elérhetőség
  - Szalon profil (logo, cover, adatok)
- Képfeltöltés + Sharp konvertálás
- Szuperadmin dashboard (neked):
  - Szalonok listája + státusz
  - Bevétel tracking
  - Analytics (mai, heti, havi)

### 📅 V2 (Később)
- Stripe fizetés integráció
- SMS értesítések (Twilio)
- Google Calendar szinkrom
- Ügyfél értékelések
- Saját domain support
- Franchise / multi-salon kezelés
- Advanced reporting

---

## 9. Képfeltöltés & Media Handling

**Backend API route: `/api/upload`**

```
BEFOGADÁS: jpg, jpeg, png, gif, webp, svg, tiff (max 10MB)
┌─────────────────────────────────┐
│ 1. Szerver: Sharp feldolgozás   │
│    - Konvertál webp-re          │
│    - Resize: tiny (100px),      │
│            small (300px),       │
│            medium (600px),      │
│            large (1200px)       │
│    - EXIF tisztítás (privát)    │
├─────────────────────────────────┤
│ 2. Validáció                    │
│    - Malware scan (optional)    │
│    - File magic szignó          │
├─────────────────────────────────┤
│ 3. Menti: /public/uploads/      │
│   salons/[salon-id]/[uuid].webp │
└─────────────────────────────────┘

Info ablak: "Ajánlott: JPG vagy PNG, min. 800x600px. 
             Átkonvertálunk WebP-re gyorsabb betöltésért."
```

**Frontend:** Drag-drop + preview, progress bar

---

## 10. Technikai Megjegyzések

### Adatbázis stratégia
- PostgreSQL `bookly` DB
- Payload CMS kezeli az migrations-t
- Seed data: 1 demo szalon (teszteléshez)

### Szuperadmin hozzáférés (KRITIKUS)
- Payload Admin UI (technikainak jó)
- + Custom szuperadmin dashboard (neked, profitorientált)
- Jogok szétválasztása: szalon owner csak SAJÁT adatait lássa!

### Performance
- Image lazy loading
- Egy naptár lekérdezés max. 200 foglalás (virtualization)
- Redis caching (optional, később)

### Security
- JWT token (Payload beépített)
- CORS (bookly domain)
- Rate limiting (API endpoints)
- GDPR: user data export, delete (opcionális MVP-ből, de gondolni rá!)

---

## 8. Szerver setup (deploy)

```bash
# Új DB
sudo -u postgres createdb bookly
sudo -u postgres psql -c "GRANT ALL ON DATABASE bookly TO davelopment;"

# Nginx config kiegészítés
# /etc/nginx/sites-available/davelopment

location /bookly {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

location /api/bookly {
    proxy_pass http://localhost:3001;
    ...
}

# PM2
pm2 start "pnpm start" --name bookly-backend --cwd /var/www/bookly/backend
pm2 start "pnpm start" --name bookly-frontend --cwd /var/www/bookly/frontend
```

---

## 9. Könyvtárstruktúra

```
bookly/
├── backend/               # Payload CMS v3
│   ├── src/
│   │   ├── collections/
│   │   │   ├── Salons.ts
│   │   │   ├── Staff.ts
│   │   │   ├── Services.ts
│   │   │   ├── Bookings.ts
│   │   │   ├── Availability.ts
│   │   │   └── Users.ts
│   │   ├── payload.config.ts
│   │   └── server.ts
│   └── package.json
├── frontend/              # Next.js 15
│   ├── app/
│   │   └── bookly/
│   │       ├── [slug]/
│   │       │   ├── page.tsx          # Szalon főoldal
│   │       │   └── book/
│   │       │       ├── page.tsx      # Foglalási flow
│   │       │       └── success/
│   │       ├── dashboard/
│   │       │   ├── page.tsx
│   │       │   ├── bookings/
│   │       │   ├── services/
│   │       │   ├── staff/
│   │       │   └── settings/
│   │       ├── register/
│   │       └── login/
│   └── package.json
└── docs/
    └── bookly.md          # Ez a fájl
```

---

## 10. Fejlesztési sorrend

1. **Backend alapok** — Payload config, collections, auth
2. **Szabad időpont logika** — availability + bookings collision detection
3. **Publikus oldal** — `/bookly/[slug]` + foglalási wizard
4. **Email értesítők** — Resend integráció
5. **Dashboard** — szalon admin UI
6. **Deploy** — szerverre feltétel, nginx, PM2
7. **Teszt szalon** — saját vagy ismerős szalonnal próba
8. **Marketing** — landing page, árazás, regisztrációs folyamat

---

*Referencia: salonic.hu, alteg.hu, fresha.com*
