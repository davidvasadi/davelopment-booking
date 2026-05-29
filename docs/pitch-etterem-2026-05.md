# Schedulio — Étterem-foglalási rendszer · Bemutató

> **Schedulio — by [davelopment]®**
> Készült: 2026-05-28 · Tárgyalási segédlet vendéglátós érdeklődőhöz
>
> Ez a doksi három részből áll:
> 1. **Pitch-vonal** — beszéljpontok, ahogy érdemes felvezetni
> 2. **Funkciók + USP-k** — mit tud, és mi az amit más nem
> 3. **Versenytárs-összehasonlítás** — táblázat „mivel jobb"

---

# 1. Pitch-vonal (beszéljpontok)

## A probléma (ezzel kezdj)

> „Egy étteremben a foglalás nem az időpont — hanem az **asztal és a vendégélmény**.
> A legtöbb foglalórendszer naptárt árul, pedig nektek **terem-logisztika** kell:
> melyik asztal szabad, fér-e be a 8 fős társaság, ki késik, ki ül még bent."

Konkrét fájdalompontok, amiket egy vendéglátós azonnal megért:
- A telefonos és a beeső (walk-in) vendég **kimarad** a legtöbb online rendszerből → dupla adminisztráció, papír + app.
- Nagy társaságnál **kézzel kell asztalt összetolni** — a rendszer nem tudja.
- Csúcsidőben a host **nem látja egy pillantásra** ki késik, ki ül még bent, melyik asztal szabadul.
- Ha **leesik a net** (pince, rendezvény), a foglalás megáll.
- A foglaló email **a konkurens rendszer arculatát** viszi, nem az étteremét.

## A megoldás (egy mondatban)

> „A Schedulio nem naptár — **terem-vezérelt foglalási rendszer**, ami úgy gondolkodik
> ahogy egy hostess: asztalokban, létszámban, valós időben — és offline is megy."

## A „miért most / miért mi" (záró érv)

> „Több időpontfoglaló létezik, de azok **fodrásznak, orvosnak** készültek és ráhúzták
> az étteremre. A Schedulio **étteremre** épült: asztaltérkép, összevonás, walk-in,
> élő idővonal. Plusz a teljes arculat a tiétek — a vendég a **ti** brandeteket látja,
> nem a miénket."

---

# 2. Funkciók + egyedi előnyök (USP)

## Asztal- és teremkezelés (a mag)
- **Asztaltérkép termenként** (beltér, terasz, külön termek), kapacitással.
- **Automatikus asztal-allokáció**: a rendszer a legkisebb megfelelő szabad asztalt választja.
- **Asztal-összevonás nagy társaságra** (`combinable_with`): ha egy asztal sem elég,
  automatikusan összevon több asztalt — és jelzi a hostnak.
- **Terasz/kültér kezelés**: jelzi, ha már csak kültéri asztal maradt egy időpontra.
  → **USP:** a legtöbb rendszer „időpontot" foglal; a Schedulio **konkrét asztalt** allokál.

## Három nézet a host munkájához
- **Lista nézet** — időrendi áttekintés, „most" vonal az aktuális időnél.
- **Idővonal (asztal × idő rács)** — ki mikor melyik asztalnál; vizuális foglaltság.
- **Terem nézet (floor plan)** — idő-csúszka: melyik asztal foglalt egy adott pillanatban.
  → **USP:** ugyanaz az adat háromféleképp — a host úgy nézi, ahogy neki kényelmes.

## Élő, idő-érzékeny figyelmeztetések
- A foglalás-kártya **színe a státuszt** mutatja (megerősítve / leültetve / befejezett / nem jött).
- **Sürgősség-jelzés valós időben**: „Késik 12 perce", „Túlfut", „Mindjárt lejár" — pulzáló badge.
  → **USP:** a host **egy pillantásra** látja hol kell beavatkozni, nem kell fejben számolnia.

## Beeső + telefonos foglalás (nem csak online!)
- A host **walk-in** és **telefonos** foglalást is rögzít, ugyanabban a rendszerben.
- Forrás-jelölés (Online / Beeső / Telefon) minden foglaláson.
  → **USP:** sok online rendszer csak a webes foglalást kezeli; itt **minden** foglalás egy helyen.

## Offline mód + PWA
- Ha leesik a net, az új foglalás **lokális vázlatként** mentődik, a net visszatértekor véglegesíthető.
- Telepíthető alkalmazás (PWA) — telefonon, tableten app-érzet.
  → **USP:** ritka funkció — a legtöbb konkurens **megáll**, ha nincs net.

## Nyitvatartás intelligencia
- Heti rend + **kivételes nyitvatartás** (ünnepnap, rendezvény, korábbi zárás).
- A rendszer **kemény korlátként** kezeli: nem lehet zárás utánra foglalni.
- A turnus **a záráshoz vágódik** (pl. 21:00 + 2 óra, de 22:00-kor zár → 22:00-ig).
  → **USP:** nem enged irreális foglalást — véd a túlfoglalás és a félreértés ellen.

## Vendég-élmény (a foglaló oldalon)
- Igényes, **az étterem arculatára szabott** nyilvános foglaló oldal (borító, logó).
- **Foglalási feltételek** strukturált, szép modálban; cégadatok (jogi) automatikusan.
- **Szülinap-jelölés**: a host bejelölheti, a foglalási nézetben kiemelten látszik
  → személyre szabott vendégélmény, plusz upsell lehetőség (torta, meglepetés).

## Arculatos, biztonságos email
- Visszaigazoló email **az étterem brandjével** (logó, borító), nem a Schedulio-éval.
- A vendég **nem látja** a belső asztal-infót.
- Admin-vezérelt kontakt-blokk (telefon, útvonalterv) — a host dönti el mi jelenik meg.
  → **USP:** a kommunikáció a **ti** márkátokat építi, minden emailben.

## Statisztika, ami döntést segít
- **Létszám (fő) alapú** mérés — nem csak foglalás-darab: hány vendég, walk-in, telefonos, online.
- Óránkénti / napi / heti forgalom, csúcsidő, legerősebb nap.
- Kattintható napi bontás, szűrhető időszak, **napi átlagolt** óránkénti forgalom.
  → **USP:** a vendéglátósnak a **fejszám** számít (kapacitás, alapanyag) — itt azt méri.

## Beüzemelés
- **Onboarding tour** — végigvezet az első beállításon.
- **Sablonok** étterem-típusra (gyors indulás).
- Beállítások fülezve, mentetlen-védelemmel.

---

# 3. Versenytárs-összehasonlítás

> Általános pozicionálás (a konkrét konkurens nevek/árak helyét tölts ki a tárgyalás
> előtt — itt a *funkció-kategóriák* alapján mutatjuk a különbséget).

| Funkció | Általános online foglaló | Schedulio |
|---|---|---|
| Konkrét **asztal**-allokáció | ❌ csak időpont | ✅ asztal + terem szerint |
| **Asztal-összevonás** nagy társaságra | ❌ kézi | ✅ automatikus |
| **Terem / floor plan** nézet | ❌ ritka | ✅ idő-csúszkával |
| **Walk-in + telefonos** foglalás | ⚠️ részleges | ✅ teljes, egy helyen |
| **Élő késés/túlfutás** jelzés | ❌ | ✅ valós idejű badge |
| **Offline mód** (net nélkül) | ❌ | ✅ vázlat + PWA |
| **Nyitvatartás-kivétel** kemény korlát | ⚠️ alap | ✅ + turnus-vágás záráshoz |
| Email **az étterem arculatával** | ❌ a platform brandje | ✅ teljes branding |
| **Létszám-alapú** statisztika | ⚠️ darab | ✅ fő (pax) szerint |
| **Szülinap / vendég-jelölés** | ❌ | ✅ kiemelt jelölés |
| Magyar nyelv + HU vendéglátás-fókusz | ⚠️ fordított | ✅ natívan erre épült |

## A három legerősebb érv (ezt vidd haza)

1. **„Asztalban gondolkodik, nem időpontban."** — ez a vendéglátós valódi problémája.
2. **„Minden foglalás egy helyen — online, telefon, beeső, offline is."** — nincs papír.
3. **„A vendég a ti márkátokat látja, nem a miénket."** — a rendszer titeket épít.

---

# Demo-forgatókönyv (ha élőben mutatod)

1. **Foglaló oldal** — mutasd az étterem-arculatos publikus oldalt, foglalj egy időpontot.
2. **Idővonal** — nyisd meg a host nézetet, mutasd a színes kártyákat + „most" vonalat.
3. **Nagy társaság** — foglalj 8 főt → a rendszer összevon asztalokat automatikusan.
4. **Walk-in** — rögzíts egy beeső vendéget pár kattintással.
5. **Szülinap** — kapcsold be a szülinap jelölést, mutasd a kiemelést.
6. **Statisztika** — váltsd az időszakot, mutasd hogy fő szerint mér.
7. **Offline** — (ha mered) kapcsold le a netet, foglalj → vázlatként menti.

---

# Nyitott pontok a tárgyalás előtt (töltsd ki)

- Konkrét **konkurens nevek** + áraik (a táblázat finomításához).
- **Árazás**: Free / Plan / Pro szintek — mit tartalmaznak (ez még döntés alatt).
- **Fizetés**: Stripe / Barion — HU piacra a Barion ismerős lehet a partnernek.
- Van-e a partnernek **több egysége** (lánc)? → multi-restaurant érv.
