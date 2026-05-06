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
- Külön GitHub repo: `bookly`
- Nem a davelopment repo-ba, önálló projekt
- Később SaaS-ként skálázható

### Szerver
- Ugyanaz a VPS: `46.29.142.31` (deploy@)
- Új PM2 process: `bookly-backend` (port 3001) + `bookly-frontend` (port 3002)
- Nginx proxy:
  - `davelopment.hu/bookly/*` → frontend
  - `davelopment.hu/api/bookly/*` → backend API

### Stack
| Réteg | Technológia |
|---|---|
| Backend/CMS | Payload CMS v3 (Next.js alapú) |
| Frontend | Next.js 15 (App Router) |
| DB | PostgreSQL (külön adatbázis: `bookly`) |
| Email | Resend / Nodemailer |
| Auth | Payload beépített auth (szalonoknak) |
| Styling | Tailwind CSS |
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
staff (relationship → staff)
day_of_week (0-6, 0=hétfő)
start_time, end_time (text)
is_available (boolean)
```

---

## 4. Frontend útvonalak (Next.js)

### Publikus (ügyfél oldal)
```
/bookly/[slug]                    → Szalon főoldala (bemutatkozás + "Foglalj időpontot" gomb)
/bookly/[slug]/book               → Foglalási flow (szolgáltatás → munkatárs → időpont → adatok)
/bookly/[slug]/book/confirm       → Foglalás megerősítése (email küldés)
/bookly/[slug]/book/success       → Sikeres foglalás visszaigazolás
```

### Szalon admin (tulajdonos)
```
/bookly/dashboard                 → Szalon dashboard (mai foglalások, statisztikák)
/bookly/dashboard/bookings        → Foglalások naptár nézet
/bookly/dashboard/services        → Szolgáltatások kezelése
/bookly/dashboard/staff           → Munkatársak kezelése
/bookly/dashboard/availability    → Nyitvatartás / elérhetőség beállítása
/bookly/dashboard/settings        → Szalon profil beállítások
```

### Regisztráció / Auth
```
/bookly/register                  → Szalon regisztráció
/bookly/login                     → Bejelentkezés
```

---

## 5. Foglalási flow (UX)

```
1. Ügyfél megnyitja: davelopment.hu/bookly/fodraszat-anna
2. Látja a szalon profilját → "Foglalj időpontot" gomb
3. Kiválaszt egy szolgáltatást (pl. Hajvágás — 45 perc — 4500 Ft)
4. Kiválaszt egy munkatársat (opcionális, ha több van)
5. Naptárban kiválaszt egy szabad napot
6. Kiválaszt egy szabad időpontot (csak azok jelennek meg, amik szabadok)
7. Megadja: neve, email, telefon
8. Visszaigazolás → Email megy az ügyfélnek ÉS a szalon emailjére
9. Szalon dashboardon látható az új foglalás
```

---

## 6. Email értesítések

**Ügyfélnek:**
- Foglalás visszaigazolása (időpont, szolgáltatás, cím)
- Emlékeztető (1 nappal előtte)
- Lemondás visszaigazolása

**Szalonnak:**
- Új foglalás értesítés
- Lemondás értesítés

---

## 7. MVP scope (1. verzió)

Ami mindenképp kell az induláshoz:

- [x] Payload CMS setup (salons, staff, services, bookings, availability)
- [x] Szalon regisztrációs flow
- [x] Publikus szalon oldal (`/bookly/[slug]`)
- [x] Foglalási flow (4 lépéses wizard)
- [x] Szabad időpont logika (availability + existing bookings alapján)
- [x] Email értesítők (Resend)
- [x] Szalon dashboard (foglalások listája)
- [x] Szolgáltatások kezelése
- [x] Nyitvatartás beállítása

Ami később jön (v2):
- Fizetés (Stripe)
- SMS értesítők
- Google Calendar szinkron
- Értékelések / vélemények
- Saját domain (pl. foglalj.fodraszat-anna.hu)
- Több szalon / franchise kezelés

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
