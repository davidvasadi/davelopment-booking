# Schedulio — Feladatlista & egyeztetési doksi

> **Schedulio — by [davelopment]®**
> Készült: 2026-05-28. Ez a teljes nyitott feladatlista, témánként csoportosítva.
> Munkamódszer: pontról pontra átbeszéljük, egyszerre egy témán dolgozunk,
> kódmódosítás előtt jóváhagyással.

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

- **Google-értékelés auto-email CTA**: foglalás után **1 nappal**, vagy **közvetlenül a foglalást követően**? *(eldöntendő)*

---

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
