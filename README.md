# davelopment booking

> SaaS foglalási platform szalonoknak és éttermeknek — egyedi publikus oldal, online foglalás, dashboard, csapatkezelés.

![Áttekintés](public/readme-overview.png)

---

## Stack

| Réteg | Technológia |
|---|---|
| Framework | Next.js 15 (App Router) |
| CMS / Backend | Payload CMS v3 |
| Adatbázis | PostgreSQL |
| Styling | Tailwind CSS + shadcn/ui |
| Animáció | Framer Motion + Lenis |
| Email | Resend |
| Auth | JWT + Google OAuth |
| Előfizetés | Stripe |
| Tesztek | Playwright (E2E) |

---

## Funkciók

**Publikus oldal**
- Egyedi slug-alapú foglalási oldal (`/[slug]`)
- Szalon: szolgáltatás → munkatárs → időpont wizard
- Étterem: asztalfoglalás vendégszámmal, megjegyzéssel
- SEO: Open Graph, JSON-LD, sitemap, robots
- PWA-kész (manifest, service worker)

**Dashboard (szalon / étterem)**
- Analytics: foglalások, bevétel, vendégek, trendek (Recharts)
- Naptár: napi/heti nézet, drag & drop, szakember-sávok
- Foglalások kezelése: elfogad, elutasít, módosít, mozgat
- Vendégek: lista, térkép (OSM geocoding), CSV export, iCal
- Csapat: meghívó emailes flow, szerepkörök, státuszkezelés
- Beosztás: műszak-tervező naptár
- Nyitvatartás: alapértelmezett + egyedi kivételek
- Értesítések: email-sablonok szerkesztése, digest beállítások
- Audit napló: ki mit változtatott, 90 napos ablak
- Előfizetés: Stripe-alapú SaaS csomag kezelés
- Borravaló: napi összeg elosztása a csapat között
- Tippek oldal: valós adatból generált javaslatok

**Platform (Backstage)**
- Fiók- és üzletkezelés
- Email forgalom mérése
- Metrikák, rendszer-áttekintés

---

![Bejelentkezés](public/readme-login.png)

---

## Lokális fejlesztés

### Előfeltételek
- Node.js >= 22
- PostgreSQL >= 14

### Setup

```bash
git clone https://github.com/davidvasadi/davelopment-booking.git
cd davelopment-booking
npm install
cp .env.example .env.local
```

`.env.local` kötelező mezők:
```env
DATABASE_URI=postgresql://user:pass@localhost:5432/davelopment_booking
PAYLOAD_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3001
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
```

```bash
npm run dev
```

### Migráció

```bash
# Új collection/mező hozzáadása után:
npm run migrate:create -- <leiro_nev>

# Migráció futtatása:
npx tsx scripts/migrate.ts
```

### Tesztek

```bash
npx playwright test --reporter=list
```

---

## Deploy

A részletes VPS deploy folyamat: [docs/deploy-howto.md](docs/deploy-howto.md)

---

## Hasznos parancsok

```bash
npm run dev          # fejlesztői szerver
npm run build        # production build
npm start            # production szerver
npm run lint         # ESLint
```

---

## Licenc

MIT — David Vasadi · [davelopment.hu](https://davelopment.hu)
