# 📅 Bookly — Online Időpontfoglaló SaaS

> Kis vállalkozóknak szánt, önálló időpontfoglaló rendszer.  
> Nem kell hozzá weboldal — egy link és kész.

## 🚀 Gyors Start

### Előfeltételek
- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm vagy yarn

### 1. Repository klónozása
```bash
git clone https://github.com/davidvasadi/bookly.git
cd bookly
```

### 2. Függőségek telepítése
```bash
npm install
```

### 3. Environment setup
```bash
cp .env.example .env.local
```

**Szerkeszd a `.env.local`-t, ne feledkezz el:**
- `DATABASE_URI` — PostgreSQL connection string
- `PAYLOAD_SECRET` — Biztonságos titkos kulcs
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth (Google)
- `RESEND_API_KEY` — Email szolgáltatás

### 4. Adatbázis setup
```bash
npm run migrate  # Payload migrations futtatása
```

### 5. Development server indítása
```bash
npm run dev
```

Server elérhető: http://localhost:3000

---

## 📁 Mappastruktúra

```
bookly/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/             # API routes
│   │   ├── bookly/          # Köttő frontend (publikus + admin)
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page
│   │   └── globals.css      # Globális stílok
│   ├── components/          # React komponensek
│   │   └── ui/              # Shadcn/ui komponensek
│   ├── lib/                 # Utility fúnkciók
│   ├── payload/             # Payload CMS config
│   │   └── collections/     # Collections (salons, staff, stb)
├── public/
│   └── uploads/             # Feltöltött képek
├── payload.config.ts        # Payload CMS konfig
├── next.config.ts           # Next.js konfig
├── tailwind.config.ts       # Tailwind CSS konfig
├── tsconfig.json            # TypeScript konfig
└── package.json
```

---

## 🏗️ Technikai Stack

| Réteg | Technológia |
|---|---|
| **Frontend** | Next.js 16 (App Router) |
| **Backend/CMS** | Payload CMS v3 |
| **Database** | PostgreSQL |
| **Styling** | Tailwind CSS + Shadcn/ui |
| **Email** | Resend |
| **Auth** | JWT + OAuth (Google, Facebook) |
| **Image Processing** | Sharp (WebP, resize) |

---

## 📖 Fontosabb funkciók

### Szalonok számára
- ✅ Egyedi szalon profil (logo, cover, leírás)
- ✅ Munkatársak kezelése
- ✅ Szolgáltatások beállítása
- ✅ Nyitvatartás + egyedi elérhetőség
- ✅ Foglalások nézete (naptár + lista)
- ✅ Email értesítések

### Ügyfelek számára
- ✅ Szalon keresése (URL által)
- ✅ Foglalási flow (szolgáltatás → munkatárs → időpont)
- ✅ Email megerősítés
- ✅ Emlékeztetők (1 nap előtte)

### Admin (te)
- ✅ Szalon overview
- ✅ Felhasználó kezelés
- ✅ Analytics (foglalások, bevételek)
- ✅ Szuperadmin dashboard

---

## 🔧 Parancsok

```bash
# Development
npm run dev

# Build production
npm run build

# Indítás prodban
npm start

# TypeScript types generálása (Payload)
npm run generate:types

# Linting
npm run lint
```

---

## 🔐 Security

- JWT autentikáció
- CORS beállítások
- Rate limiting (API)
- GDPR data export/delete support
- HTTPS (production)

---

## 📧 Email Setup (Resend)

1. **Resend account**: https://resend.com
2. **API Key**: Másolj be a `.env.local`-ba
3. **From email**: Állítsd be a `RESEND_FROM_EMAIL`-t

---

## 🚢 Deployment (VPS)

### Prereqs
- VPS: Ubuntu 22.04+
- PM2: `npm install -g pm2`
- Nginx: `sudo apt install nginx`
- PostgreSQL: `sudo apt install postgresql`

### Steps
1. Clone repo a szerverre
2. `npm install`
3. `.env` setup (database, secrets)
4. Migrations: `npm run migrate`
5. PM2: `pm2 start ecosystem.config.js`
6. Nginx proxy (lásd: `nginx-template.conf`)

---

## 💡 Next Steps

1. **Dashboard skeleton** — Szalon admin felület
2. **Körben booking flow** — Frontend booking UI
3. **Email templates** — Resend template-ek
4. **OAuth integration** — Google/Facebook login
5. **Image upload handler** — Sharp processing

---

## 📝 License

MIT

---

## 👤 Author

David Vasadi — https://github.com/davidvasadi

---

## 🤝 Contributing

Ez egy private projekt. Kérdések/issues: david@davelopment.hu
