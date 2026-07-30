'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Lightbulb, ChevronDown, Search, ArrowRight, Sparkles, type LucideIcon,
} from 'lucide-react'
import {
  CalendarDays, Briefcase, Users, Clock, Settings, BarChart2, Armchair, LayoutDashboard, Printer, Bell,
  MapPin, CalendarRange, CreditCard, Coins, Smartphone,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { popItem, expandHeight } from '@/lib/motion'
import type { Capability } from '@/lib/permissions'

/**
 * SÚGÓ / rendszer-tájékoztató — kereshető, akkordeonos tudásbázis a bejelentkezett
 * előfizetőnek (SOHA nem a Payload admin). A rendszer immár nagy, ezért a fő nézeteket
 * modulonként (szalon / étterem) fejezetekre bontja: mit tud, hol találja, mire figyeljen.
 * Bővíthető: új szekció = egy új `Tip` objektum a `TIPS[variant]` tömbben.
 */

type Variant = 'restaurant' | 'salon'

type Tip = {
  /** Mélylinkhez (#id) és accordion-állapothoz stabil azonosító. */
  id: string
  icon: LucideIcon
  title: string
  body: string
  /** Kattintásra kibomló bővebb magyarázat. */
  details: string
  /** Konkrét, lépésszerű tippek a részletekben. */
  bullets: string[]
  /** A kapcsolódó oldal útvonala — „Ugrás a … oldalra" gombhoz. */
  href: string
  /** A direkt link gomb felirata (pl. „Megnyitom a Foglalásokat"). */
  linkLabel: string
}

const TIPS: Record<Variant, Tip[]> = {
  restaurant: [
    {
      id: 'overview',
      icon: LayoutDashboard,
      title: 'Áttekintés',
      body: 'A kezdőképernyőn a mai foglalások, a kihasználtság és a legfontosabb számok láthatók egy pillantásra.',
      details: 'Az Áttekintés a napod irányítópultja: rögtön belépés után látod, mi vár rád ma, anélkül hogy bárhová kattintanod kellene.',
      bullets: [
        'A felső számkártyák a mai foglalások számát, a várható vendéglétszámot és a kihasználtságot mutatják.',
        'Bármelyik számkártyára kattintva részletes bontás nyílik meg az adott mutatóról.',
        'A „mai foglalások” listából egy kattintással a Foglalások oldalra ugrasz az adott naphoz.',
      ],
      href: '/restaurant',
      linkLabel: 'Megnyitom az Áttekintést',
    },
    {
      id: 'bookings',
      icon: CalendarDays,
      title: 'Foglalások kezelése',
      body: 'A nap vendégeit lista- és idővonal-nézetben látod. Beeső és telefonos foglalást is rögzíthetsz.',
      details: 'A Foglalások oldal a mindennapi munka középpontja. Válts a lista- és az idővonal-nézet között aszerint, hogy gyorsan átnéznéd a napot, vagy az asztalok időbeli elfoglaltságát terveznéd.',
      bullets: [
        'Az idővonal-nézetben a foglalásokat húzással (drag & drop) áthelyezheted másik időpontra vagy asztalra.',
        'Beeső és telefonos foglalást is felvehetsz — akár név nélkül, ha siettek; ilyenkor „Beeső” / „Telefon” alapnév kerül be.',
        'A státuszokkal (megerősítve, leültetve, távozott, lemondva) végigvezeted a vendéget az érkezéstől a távozásig.',
        'A felső dátumváltóval bármelyik napra előre-hátra lépdelhetsz.',
      ],
      href: '/restaurant/bookings',
      linkLabel: 'Megnyitom a Foglalásokat',
    },
    {
      id: 'print',
      icon: Printer,
      title: 'Napi lista nyomtatása',
      body: 'A Foglalások oldal tetején a nyomtató gombbal a kiválasztott nap foglalásait nyomtatható listában nyitod meg.',
      details: 'Ha a pultnál vagy a konyhában papíron is kéznél akarod tartani a nap vendégeit, a nyomtatható lista letisztult, fekete-fehér formátumban adja ki őket.',
      bullets: [
        'A lista a kiválasztott nap foglalásait tartalmazza idő szerint sorrendben.',
        'Minden sorban ott a vendég neve, létszáma, ideje és a megjegyzés.',
        'A böngésző nyomtatási párbeszédéből PDF-be is mentheted.',
      ],
      href: '/restaurant/bookings',
      linkLabel: 'Megnyitom a Foglalásokat',
    },
    {
      id: 'tables',
      icon: Armchair,
      title: 'Asztalok és kapacitás',
      body: 'Vedd fel az asztalaidat vagy adj meg egyszerű férőhely-számot. A rendszer ez alapján kezeli a kapacitást.',
      details: 'A kapacitás dönti el, hány vendég foglalhat online egy adott sávra. Kétféleképp állíthatod be — aszerint, mennyire szeretnéd részletesen kezelni az asztalaidat.',
      bullets: [
        'Egyszerű mód: csak egy összesített férőhely-számot adsz meg, a rendszer ez alapján számol.',
        'Asztalos mód: felveszed a konkrét asztalokat férőhellyel, így a foglalások asztalhoz rendelhetők.',
        'Nagyobb társasághoz több asztalt összevonhatsz, hogy elférjenek.',
        'Szezonális/időszakos asztalokat is felvehetsz, ha pl. teraszod csak nyáron üzemel.',
      ],
      href: '/restaurant/tables',
      linkLabel: 'Megnyitom az Asztalokat',
    },
    {
      id: 'schedule-own',
      icon: CalendarRange,
      title: 'Saját műszakaim',
      body: 'A Naptárban megtekintheted a saját beosztásodat — mikor van műszakod, szabadnapod, szabadságod.',
      details: 'Munkatársként a Naptár a személyes nézetedet mutatja: az adott hónapban melyik napokon vagy beosztva. A saját celláidra kattintva látod a pontos kezdési és zárási időt.',
      bullets: [
        'Havi nézetben látod, melyik napokon van műszakod.',
        'Zöld jelzés = beosztott műszak; szürke = szabad; piros = betegség/egyéb távollét.',
        'Ha hiányos vagy hibás a beosztásod, a felelős menedzseredet keresd.',
      ],
      href: '/restaurant/schedule',
      linkLabel: 'Megnyitom a Naptáramat',
    },
    {
      id: 'schedule',
      icon: CalendarRange,
      title: 'Naptár és beosztás',
      body: 'A Naptárban tervezed a munkatársak műszakjait, szabadságát, és itt adod meg a napi borravalót.',
      details: 'A Naptár a csapat havi rendjét mutatja. A műszakok mellett a szabadság/betegség is jelölhető, és minden naphoz megadhatod az aznap befolyt központi borravalót.',
      bullets: [
        'Havi nézetben látod, ki mikor dolgozik; egy napra kattintva szerkeszted a műszakokat.',
        'Szabadság, betegség és egyéb távollét külön jelölhető — ezek nem számítanak a borravaló-osztásba.',
        'A napi borravalót egy összegként adod meg; a rendszer elosztja az aznap dolgozó, jogosult munkatársak közt.',
      ],
      href: '/restaurant/schedule',
      linkLabel: 'Megnyitom a Naptárt',
    },
    {
      id: 'tips-money',
      icon: Coins,
      title: 'Borravaló',
      body: 'A napi központi borravalót a Naptárban adod meg; a profilon mindenki a havi összegét látja.',
      details: 'A borravaló-modell egyszerű: naponta egy központi összeget rögzítesz, amit a rendszer az aznap dolgozó, borravalóra jogosult munkatársak között egyenlően oszt el, és havi szinten összegez a profilon.',
      bullets: [
        'Egy munkatárs a Munkatársak → profilon jelölhető „borravalóra jogosult”-nak (csak a tulajdonos).',
        'A napi összeg az aznap dolgozó jogosultak közt oszlik el egyenlően.',
        'A munkatárs a saját profilján a havi borravaló-összegét látja, szerkeszteni nem tudja.',
      ],
      href: '/restaurant/schedule',
      linkLabel: 'Megnyitom a Naptárt',
    },
    {
      id: 'staff',
      icon: Users,
      title: 'Munkatársak megtekintése',
      body: 'A csapat tagjait, beosztásukat és teljesítményüket látod egy helyen.',
      details: 'A Munkatársak oldalon áttekinted, ki van a csapatban: neve, szerepköre, a következő műszakja és az elvégzett foglalások száma. Az egyéni profilra kattintva a részletes teljesítményt és a havi borravalót is látod.',
      bullets: [
        'Csapat-lista a szerepkörrel és az aktuális státusszal (aktív / felfüggesztett).',
        'A profilra kattintva látod az elvégzett foglalásokat, az értékeléseket és a borravalót.',
        'A beosztás és az elérhetőség a Naptár oldalon szerkeszthető.',
      ],
      href: '/restaurant/staff',
      linkLabel: 'Megnyitom a Munkatársakat',
    },
    {
      id: 'staff-manage',
      icon: Users,
      title: 'Munkatársak kezelése',
      body: 'Tagok meghívása, szerepkör és jogosultságok beállítása, profil szerkesztése.',
      details: 'A csapatkezelés — meghívás, jogosultság, borravaló-jogosultság — kizárólag tulajdonos/menedzser jogosultsággal érhető el. Minden egyes tag jogosultságát külön-külön szabhatod testre.',
      bullets: [
        'Tag meghívása e-mailben; a meghívó elfogadásakor automatikusan létrejön a profil.',
        'Szerepkör: a szerepkör alapértelmezett jogosultságot ad; ezenkívül egyéni képességeket is hozzárendelhetsz.',
        'A borravalóra jogosultságot csak a tulajdonos kapcsolhatja be/ki.',
        'Felfüggesztett tag nem tud belépni, de az adatai megmaradnak.',
      ],
      href: '/restaurant/staff',
      linkLabel: 'Megnyitom a Munkatársakat',
    },
    {
      id: 'guests',
      icon: MapPin,
      title: 'Vendégek',
      body: 'A visszatérő vendégek, a törzsvendég-pontszám és a vendégek érkezési térképe egy helyen.',
      details: 'A Vendégek oldal a foglalásaidból épülő címtár: kikeresed egy vendég korábbi foglalásait, és térképen látod, honnan érkeznek.',
      bullets: [
        'Vendég-profil a korábbi foglalásokkal és a törzsvendég-pontszámmal.',
        'Érkezési térkép (OpenStreetMap) a vendégek országa/városa alapján.',
        'Gyors keresés név, e-mail vagy telefonszám szerint.',
      ],
      href: '/restaurant/guests',
      linkLabel: 'Megnyitom a Vendégeket',
    },
    {
      id: 'availability',
      icon: Clock,
      title: 'Nyitvatartás',
      body: 'Az online foglalás csak a beállított nyitvatartáson belül lehetséges. Itt állítod be a napi sávokat és az ülésidőt.',
      details: 'A nyitvatartás határozza meg, mikor és milyen sűrűn vehetők fel online foglalások. Az ülésidő (mennyi ideig ül egy asztal) befolyásolja, hányszor fordulhat egy asztal egy este.',
      bullets: [
        'Naponként külön sávokat állíthatsz be (pl. ebéd és vacsora külön).',
        'Az ülésidővel szabályozod, mennyi időre foglal le egy vendég egy asztalt.',
        'Egyedi kivételeket adhatsz meg ünnepnapokra vagy zárva tartásra a szokásos nyitvatartás felülírásával.',
      ],
      href: '/restaurant/availability',
      linkLabel: 'Megnyitom a Nyitvatartást',
    },
    {
      id: 'analytics',
      icon: BarChart2,
      title: 'Statisztika és export',
      body: 'A Statisztikák oldalon követed a kihasználtságot, a lemondásokat és a beesők arányát.',
      details: 'A számok megmutatják, mely napok és sávok a legerősebbek, és hol van tartalék. Jó alap a nyitvatartás vagy a kapacitás finomhangolásához.',
      bullets: [
        'Kihasználtság, lemondási arány és a beesők aránya egy helyen.',
        'Az átlagos ülésidő (dwell) statisztika segít a kapacitástervezésben.',
        'Bármikor exportálhatsz CSV-be napi, heti vagy havi bontásban.',
      ],
      href: '/restaurant/analytics',
      linkLabel: 'Megnyitom a Statisztikákat',
    },
    {
      id: 'tips',
      icon: Lightbulb,
      title: 'Tippek — javaslatok',
      body: 'A Tippek oldal a foglalási adataidból és a beállításaidból ad testreszabott javaslatokat több foglaláshoz.',
      details: 'A Tippek oldal az étterem „egészségét” pontozza (mennyire kész a foglaló oldalad), és E heti tipp formájában kiemeli a legnagyobb hatású teendőt — valós adatból, nem általánosságból.',
      bullets: [
        'Egészség-score: a beüzemelés (borítókép, nyitvatartás, nyelvek, funkciók) teljessége 0–100 skálán.',
        'E heti tipp: a legterheltebb nap, a no-show arány vagy az online-arány alapján konkrét lépés.',
        'A javaslat-kártyák „Alkalmaz” gombja azonnal bekapcsol egy funkciót, vagy a megfelelő oldalra visz.',
      ],
      href: '/restaurant/tips',
      linkLabel: 'Megnyitom a Tippeket',
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'Értesítések fogadása',
      body: 'Új foglalásról és lemondásról a harang ikonnál kapsz értesítést.',
      details: 'Az értesítések gondoskodnak róla, hogy ne maradj le egy új foglalásról vagy lemondásról sem, akkor sem, ha épp nem a foglalási oldalt nézed. A fejléc csengő ikonja mutatja az olvasatlanokat.',
      bullets: [
        'A fejléc csengő ikonján piros jelzés mutatja az olvasatlan értesítéseket.',
        'Kattintásra az értesítési panel nyílik — olvasott/olvasatlan, törlés, részletek.',
        'A rendszer azonnal küld értesítést, amint új foglalás vagy lemondás érkezik.',
      ],
      href: '/restaurant/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
    {
      id: 'notifications-manage',
      icon: Bell,
      title: 'Értesítési beállítások',
      body: 'E-mail és push értesítések konfigurálása — ki kap értesítést és miről.',
      details: 'Az értesítési beállításokban szabályozod, milyen csatornán (push / e-mail) és miről (új foglalás, lemondás, emlékeztető) kapsz értesítést. Ezek egyénenként konfigurálhatók.',
      bullets: [
        'Push értesítés: böngészőből vagy mobilon is megérkezik, ha engedélyezed.',
        'E-mail értesítés: minden új foglalásról vagy lemondásról a beállított e-mail-re megy.',
        'A beállítások a Beállítások → Értesítések fülön érhetők el.',
      ],
      href: '/restaurant/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
    {
      id: 'pwa',
      icon: Smartphone,
      title: 'Alkalmazásként telepíthető',
      body: 'A rendszer telefonra és asztali gépre is felrakható appként — App Store nélkül, közvetlenül a böngészőből.',
      details: 'Nincs letöltés az App Store-ból vagy Google Play-ből. A böngészőből egyetlen lépéssel kerül ki az ikon a főképernyőre vagy az asztalra. Megnyitva úgy működik, mint egy natív app: nincs böngésző-sáv, teljes képernyős, gyorsabb. Asztali Chrome/Edge-en is ugyanígy telepíthető — saját ablakban nyílik meg.',
      bullets: [
        'iPhone / Safari: a képernyő alján a Megosztás (□↑) gombra koppints, majd válaszd a „Főképernyőhöz adás" lehetőséget.',
        'Android / Chrome: a jobb felső három pontos menüre koppints, majd „Alkalmazás telepítése" vagy „Főképernyőhöz adás".',
        'Asztali Chrome / Edge (Mac és Windows): a cím-sor jobb oldalán megjelenik egy telepítés-ikon — arra kattintva saját ablakban fut az app.',
        'Telepítés után a push értesítések is bekapcsolhatók a Beállítások → Értesítések fülön.',
      ],
      href: '/restaurant/settings?tab=notifications',
      linkLabel: 'Megnyitom az Értesítéseket',
    },
    {
      id: 'settings',
      icon: Settings,
      title: 'Beállítások és funkciók',
      body: 'Itt szabod testre az éttermed adatait, a foglalási szabályokat és a kapcsolható funkciókat.',
      details: 'A Beállítások a foglalási oldalad és a vendégélmény vezérlőpultja: a cégadatoktól a foglalási feltételekig és a kapcsolható funkciókig (emlékeztető, várólista, értékelés) minden innen állítható.',
      bullets: [
        'Étterem adatai: név, logó, elérhetőségek — ezek jelennek meg a foglalási oldalon és az e-mailekben.',
        'Foglalási funkciók: emlékeztető, várólista, értékeléskérés — be/ki és időzítés.',
        'Foglalási szabályok: meddig előre, hány főig, kell-e telefonszám.',
        'Csapat & jogok, dokumentumok, audit-napló és számlázás egy helyen.',
      ],
      href: '/restaurant/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
    {
      id: 'subscription',
      icon: CreditCard,
      title: 'Előfizetés és csomag',
      body: 'Fix havidíj, foglalásonkénti jutalék nélkül. Az előfizetésed állapotát itt követed.',
      details: 'A díjmodell lényege: fix havidíj, és NINCS foglalásonkénti jutalék — ez a fő előny a nemzetközi versenytársakhoz képest. Az előfizetés oldalon látod a csomagod és a számlázás állapotát.',
      bullets: [
        'Fix havidíj, jutalékmentes foglalás.',
        'A csomag és a számlázási előzmények a Beállítások → Számlázásnál is elérhetők.',
        'Több üzletet is kezelhetsz egy fiókból (üzletváltó a fejlécben).',
      ],
      href: '/restaurant/subscription',
      linkLabel: 'Megnyitom az Előfizetést',
    },
  ],
  salon: [
    {
      id: 'overview',
      icon: LayoutDashboard,
      title: 'Áttekintés',
      body: 'A kezdőképernyőn a mai időpontok, a bevétel és a legfontosabb számok láthatók egy pillantásra.',
      details: 'Az Áttekintés a napod irányítópultja: belépés után rögtön látod a mai időpontokat és a legfontosabb mutatókat.',
      bullets: [
        'A felső számkártyák a mai időpontok számát, a várható bevételt és a kihasználtságot mutatják.',
        'Bármelyik számkártyára kattintva részletes bontás nyílik meg.',
        'A mai időpontok listájából egy kattintással a foglalások részleteihez jutsz.',
      ],
      href: '/dashboard',
      linkLabel: 'Megnyitom az Áttekintést',
    },
    {
      id: 'bookings',
      icon: CalendarDays,
      title: 'Időpontok kezelése',
      body: 'A foglalásokat naptár- és listanézetben látod. Új időpontot kézzel is rögzíthetsz.',
      details: 'A foglalások oldalon tartod kézben a napod. Válts naptár- és listanézet között aszerint, hogy az időbeosztást terveznéd, vagy gyorsan átnéznéd a vendégeket.',
      bullets: [
        'Az online foglalások automatikusan megjelennek, amint a vendég lefoglal.',
        'Új időpontot kézzel is felvehetsz telefonos vagy beeső vendéghez.',
        'A naptárnézetben jól látod a szabad réseket és a munkatársak beosztását.',
      ],
      href: '/dashboard/bookings',
      linkLabel: 'Megnyitom a Foglalásokat',
    },
    {
      id: 'services',
      icon: Briefcase,
      title: 'Szolgáltatások',
      body: 'Vedd fel a szolgáltatásaidat árral és időtartammal — a vendégeid ezek alapján foglalnak online.',
      details: 'A szolgáltatások a foglalási oldalad gerince: a vendég ezek közül választ, és az időtartam alapján számolódik a szabad időpont.',
      bullets: [
        'Adj meg minden szolgáltatáshoz árat és időtartamot — utóbbi pontos időpontkiosztást ad.',
        'Csoportosíthatod a szolgáltatásokat kategóriákba az átláthatóságért.',
        'A pontos időtartam segít elkerülni a túl szoros vagy túl laza beosztást.',
      ],
      href: '/dashboard/services',
      linkLabel: 'Megnyitom a Szolgáltatásokat',
    },
    {
      id: 'staff',
      icon: Users,
      title: 'Munkatársak megtekintése',
      body: 'A csapat tagjait, beosztásukat és teljesítményüket látod egy helyen.',
      details: 'A Munkatársak oldalon látod, ki van a csapatban: neve, szerepköre, a következő műszakja és az elvégzett foglalások száma. Az egyéni profilra kattintva a részletes teljesítményt is megtekintheted.',
      bullets: [
        'Csapat-lista a szerepkörrel és az aktuális státusszal (aktív / felfüggesztett).',
        'A profilra kattintva látod az elvégzett foglalásokat, értékeléseket.',
        'A beosztás és az elérhetőség a Naptár oldalon szerkeszthető.',
      ],
      href: '/dashboard/staff',
      linkLabel: 'Megnyitom a Munkatársakat',
    },
    {
      id: 'staff-manage',
      icon: Users,
      title: 'Munkatársak kezelése',
      body: 'Tagok meghívása, szolgáltatás-hozzárendelés, szerepkör és jogosultságok beállítása.',
      details: 'A csapatkezelés — meghívás, jogosultság, szolgáltatás-hozzárendelés — kizárólag tulajdonos/menedzser jogosultsággal érhető el.',
      bullets: [
        'Tag meghívása e-mailben; a meghívó elfogadásakor automatikusan létrejön a profil.',
        'Szerepkör: a szerepkör alapértelmezett jogosultságot ad; egyéni képességek is hozzárendelhetők.',
        'Minden munkatárshoz hozzárendeled, mely szolgáltatásokat végzi — ezek foglaláskor választhatók.',
        'A foglalási oldalon a vendég kiválaszthatja a munkatársat, vagy rábízhatja a szalonra.',
      ],
      href: '/dashboard/staff',
      linkLabel: 'Megnyitom a Munkatársakat',
    },
    {
      id: 'schedule-own',
      icon: CalendarRange,
      title: 'Saját műszakaim',
      body: 'A Naptárban megtekintheted a saját beosztásodat — mikor van műszakod, szabadnapod, szabadságod.',
      details: 'Munkatársként a Naptár a személyes nézetedet mutatja: az adott hónapban melyik napokon vagy beosztva. A saját celláidra kattintva látod a pontos kezdési és zárási időt.',
      bullets: [
        'Havi nézetben látod, melyik napokon van műszakod.',
        'Zöld jelzés = beosztott műszak; szürke = szabad; piros = betegség/egyéb távollét.',
        'Ha hiányos vagy hibás a beosztásod, a felelős menedzseredet keresd.',
      ],
      href: '/dashboard/schedule',
      linkLabel: 'Megnyitom a Naptáramat',
    },
    {
      id: 'schedule',
      icon: CalendarRange,
      title: 'Naptár és beosztás',
      body: 'A Naptárban tervezed a munkatársak műszakjait és távolléteit egy havi nézetben.',
      details: 'A Naptár a csapat havi rendjét mutatja: ki mikor dolgozik, ki van szabadságon. Ez alapján szűrődnek a foglalható időpontok a munkatársakhoz.',
      bullets: [
        'Havi nézetben egy napra kattintva szerkeszted a műszakokat.',
        'Szabadság, betegség és egyéb távollét külön jelölhető.',
        'A beosztás összhangban van a foglalható időpontokkal.',
      ],
      href: '/dashboard/schedule',
      linkLabel: 'Megnyitom a Naptárt',
    },
    {
      id: 'guests',
      icon: MapPin,
      title: 'Vendégek',
      body: 'A visszatérő vendégek, a törzsvendég-pontszám és a vendégek érkezési térképe egy helyen.',
      details: 'A Vendégek oldal a foglalásaidból épülő címtár: kikeresed egy vendég korábbi foglalásait, és térképen látod, honnan érkeznek.',
      bullets: [
        'Vendég-profil a korábbi foglalásokkal és a törzsvendég-pontszámmal.',
        'Érkezési térkép (OpenStreetMap) a vendégek városa alapján.',
        'Gyors keresés név, e-mail vagy telefonszám szerint.',
      ],
      href: '/dashboard/guests',
      linkLabel: 'Megnyitom a Vendégeket',
    },
    {
      id: 'availability',
      icon: Clock,
      title: 'Nyitvatartás',
      body: 'Az online foglalás a beállított nyitvatartáson és a munkatársak elérhetőségén belül lehetséges.',
      details: 'A nyitvatartás és a munkatársak elérhetősége együtt határozza meg, milyen időpontok foglalhatók online.',
      bullets: [
        'Naponként külön sávokat állíthatsz be.',
        'A munkatársak egyéni elérhetősége tovább szűri a foglalható időpontokat.',
        'Egyedi kivételeket adhatsz meg ünnepnapokra vagy zárásra.',
      ],
      href: '/dashboard/availability',
      linkLabel: 'Megnyitom a Nyitvatartást',
    },
    {
      id: 'analytics',
      icon: BarChart2,
      title: 'Statisztika és export',
      body: 'A Statisztikák oldalon követed a bevételt és a kihasználtságot, és bármikor exportálhatsz CSV-be.',
      details: 'A számokból kiderül, mely szolgáltatások és munkatársak a legkeresettebbek, és hol van szabad kapacitás.',
      bullets: [
        'Bevétel és kihasználtság egy helyen, időszakra bontva.',
        'Lemondási arány és a legnépszerűbb szolgáltatások.',
        'Bármikor exportálhatsz CSV-be napi, heti vagy havi bontásban.',
      ],
      href: '/dashboard/analytics',
      linkLabel: 'Megnyitom a Statisztikákat',
    },
    {
      id: 'tips',
      icon: Lightbulb,
      title: 'Tippek — javaslatok',
      body: 'A Tippek oldal a foglalási adataidból és a beállításaidból ad testreszabott javaslatokat több foglaláshoz.',
      details: 'A Tippek oldal a szalon „egészségét” pontozza (mennyire kész a foglaló oldalad), és E heti tipp formájában kiemeli a legnagyobb hatású teendőt — valós adatból, nem általánosságból.',
      bullets: [
        'Egészség-score: a beüzemelés (borítókép, nyitvatartás, nyelvek, funkciók) teljessége 0–100 skálán.',
        'E heti tipp: a legerősebb nap, a teljesítési arány vagy a legnépszerűbb szolgáltatás alapján konkrét lépés.',
        'A javaslat-kártyák „Alkalmaz” gombja azonnal bekapcsol egy funkciót, vagy a megfelelő oldalra visz.',
      ],
      href: '/dashboard/tips',
      linkLabel: 'Megnyitom a Tippeket',
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'Értesítések fogadása',
      body: 'Új foglalásról és lemondásról a harang ikonnál kapsz értesítést.',
      details: 'Az értesítések gondoskodnak róla, hogy ne maradj le egy új foglalásról vagy lemondásról sem. A fejléc csengő ikonja mutatja az olvasatlanokat.',
      bullets: [
        'A fejléc csengő ikonján piros jelzés mutatja az olvasatlan értesítéseket.',
        'Kattintásra az értesítési panel nyílik — olvasott/olvasatlan, törlés, részletek.',
        'A rendszer azonnal küld értesítést, amint új foglalás vagy lemondás érkezik.',
      ],
      href: '/dashboard/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
    {
      id: 'notifications-manage',
      icon: Bell,
      title: 'Értesítési beállítások',
      body: 'E-mail és push értesítések konfigurálása — ki kap értesítést és miről.',
      details: 'Az értesítési beállításokban szabályozod, milyen csatornán (push / e-mail) és miről (új foglalás, lemondás, emlékeztető) kapsz értesítést. Ezek egyénenként konfigurálhatók.',
      bullets: [
        'Push értesítés: böngészőből vagy mobilon is megérkezik, ha engedélyezed.',
        'E-mail értesítés: minden új foglalásról vagy lemondásról a beállított e-mail-re megy.',
        'A beállítások a Beállítások → Értesítések fülön érhetők el.',
      ],
      href: '/dashboard/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
    {
      id: 'pwa',
      icon: Smartphone,
      title: 'Appként a telefonodra',
      body: 'A rendszer telepíthető a telefonod főképernyőjére — ikon kerül oda, és push értesítések is bekapcsolhatók.',
      details: 'Nincs letöltés az App Store-ból vagy Google Play-ből — a böngészőből egyetlen lépéssel kerül ki az ikon a főképernyőre. Megnyitva úgy működik, mint egy natív app: nincs böngésző-sáv, teljes képernyős, gyorsabb.',
      bullets: [
        'iPhone / Safari: a képernyő alján a Megosztás (□↑) gombra koppints, majd válaszd a „Főképernyőhöz adás" lehetőséget.',
        'Android / Chrome: a jobb felső három pontos menüre koppints, majd „Alkalmazás telepítése" vagy „Főképernyőhöz adás".',
        'Asztali Chrome / Edge: a cím-sor jobb oldalán megjelenik egy telepítés-ikon — arra kattintva felrakható.',
        'Telepítés után a push értesítések is bekapcsolhatók a Beállítások → Értesítések fülön.',
      ],
      href: '/dashboard/settings?tab=notifications',
      linkLabel: 'Megnyitom az Értesítéseket',
    },
    {
      id: 'settings',
      icon: Settings,
      title: 'Beállítások és funkciók',
      body: 'Itt szabod testre a szalonod adatait, a foglalási szabályokat és a kapcsolható funkciókat.',
      details: 'A Beállítások a foglalási oldalad és a vendégélmény vezérlőpultja: a cégadatoktól a foglalási feltételekig és a kapcsolható funkciókig (emlékeztető, várólista, értékelés) minden innen állítható.',
      bullets: [
        'Szalon adatai: név, logó, elérhetőségek — ezek jelennek meg a foglalási oldalon és az e-mailekben.',
        'Foglalási funkciók: emlékeztető, várólista, értékeléskérés — be/ki és időzítés.',
        'Foglalási szabályok: meddig előre, kell-e telefonszám.',
        'Csapat & jogok, dokumentumok, audit-napló és számlázás egy helyen.',
      ],
      href: '/dashboard/settings',
      linkLabel: 'Megnyitom a Beállításokat',
    },
    {
      id: 'subscription',
      icon: CreditCard,
      title: 'Előfizetés és csomag',
      body: 'Fix havidíj, foglalásonkénti jutalék nélkül. Az előfizetésed állapotát itt követed.',
      details: 'A díjmodell lényege: fix havidíj, és NINCS foglalásonkénti jutalék. Az előfizetés oldalon látod a csomagod és a számlázás állapotát.',
      bullets: [
        'Fix havidíj, jutalékmentes foglalás.',
        'A csomag és a számlázási előzmények a Beállítások → Számlázásnál is elérhetők.',
        'Több üzletet is kezelhetsz egy fiókból (üzletváltó a fejlécben).',
      ],
      href: '/dashboard/subscription',
      linkLabel: 'Megnyitom az Előfizetést',
    },
  ],
}

/**
 * Capability-térkép tip-id → szükséges jogosultság.
 * Ha egy id nincs itt, mindenki láthatja (pl. overview, notifications).
 */
const TIP_REQUIRED_CAP: Record<string, Capability | Capability[]> = {
  bookings:       ['bookings.view', 'bookings.manage'],
  print:          ['bookings.view', 'bookings.manage'],
  tables:         ['tables.view', 'tables.manage'],
  services:       ['catalog.view', 'catalog.manage'],
  'schedule-own': ['schedule.view.own', 'schedule.manage.own'],
  schedule:       'schedule.manage',
  'tips-money':   'schedule.manage',
  staff:                  ['staff.view', 'staff.manage'],
  'staff-manage':         'staff.manage',
  guests:                 ['guests.view', 'guests.manage'],
  availability:           'settings.profile',
  analytics:              'analytics.view',
  tips:                   'tips.view',
  notifications:          ['notifications.view', 'notifications.manage'],
  'notifications-manage': 'notifications.manage',
  settings:               'settings.profile',
  subscription:           'billing.manage',
}

function tipVisible(id: string, caps: Capability[]): boolean {
  const req = TIP_REQUIRED_CAP[id]
  if (!req) return true
  if (Array.isArray(req)) return req.some((c) => caps.includes(c))
  return caps.includes(req)
}

/** Ékezet-érzéketlen, kisbetűs normalizálás a kereséshez. */
function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/* ── Tematikus csoportok — a monoton rács helyett szekciók, csoportonként eltérő ikon-tile
 *    (sötét / gold / zöld accent). A hovatartozást a tip `id`-ja adja (variant-független). ── */
type GroupId = 'daily' | 'setup' | 'growth'

const GROUP_OF: Record<string, GroupId> = {
  overview: 'daily', bookings: 'daily', print: 'daily', guests: 'daily', 'schedule-own': 'daily',
  services: 'setup', tables: 'setup', schedule: 'setup', staff: 'setup', 'staff-manage': 'setup',
  availability: 'setup', notifications: 'setup', 'notifications-manage': 'setup', pwa: 'setup', settings: 'setup',
  tips: 'growth', analytics: 'growth', 'tips-money': 'growth', subscription: 'growth',
}

const GROUPS: { id: GroupId; label: string; tile: string; iconColor: string }[] = [
  { id: 'daily', label: 'Napi munka', tile: 'bg-ink-dark', iconColor: 'text-gold' },
  { id: 'setup', label: 'Beüzemelés & testreszabás', tile: 'bg-gold', iconColor: 'text-ink-dark' },
  { id: 'growth', label: 'Növekedés & elemzés', tile: 'bg-[#1D9D63]/10', iconColor: 'text-[#1D9D63]' },
]

export function TipsContent({ variant, capabilities }: { variant: Variant; capabilities?: Capability[] }) {
  const allTips = TIPS[variant]
  // Capability-szűrés: csak azok a témák láthatók, amelyekhez van joga a usernek.
  const tips = useMemo(
    () => capabilities ? allTips.filter((t) => tipVisible(t.id, capabilities)) : allTips,
    [allTips, capabilities],
  )
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const onSearch = (e: Event) => setQuery((e as CustomEvent<string>).detail ?? '')
    window.addEventListener('davelopment:help-search', onSearch)
    return () => window.removeEventListener('davelopment:help-search', onSearch)
  }, [])

  const toggle = useCallback((id: string) => {
    setOpenIds((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Szűrt lista: cím + body + details + bulletek között, ékezet-érzéketlenül.
  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return tips
    return tips.filter((t) => {
      const hay = normalize([t.title, t.body, t.details, ...t.bullets].join(' '))
      return hay.includes(q)
    })
  }, [tips, query])

  // Mélylink: a #id-ra mutató URL-nél nyisd meg és görgess az adott kártyához.
  useEffect(() => {
    const id = window.location.hash.replace('#', '')
    if (!id || !tips.some((t) => t.id === id)) return
    setOpenIds((cur) => new Set(cur).add(id))
    // A render után görgessünk oda (kis késleltetés a layout miatt).
    const t = setTimeout(() => {
      document.getElementById(`tip-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => clearTimeout(t)
  }, [tips])

  function restartTour() {
    window.dispatchEvent(new Event('davelopment:open-onboarding'))
  }

  return (
    <div className="space-y-6 p-5 lg:p-0 font-onest">
      {/* ── Fejléc — az etalon PageHeader; jobbra a (Crextio) bemutató-indító. ── */}
      <PageHeader
        eyebrow="Tudásbázis"
        title="Súgó"
        description="Minden a rendszerről egy helyen — nyiss ki egy témát a részletekért, vagy keress rá egy funkcióra."
        action={
          <button
            onClick={restartTour}
            className="inline-flex items-center gap-2 rounded-[18px] bg-ink-dark px-5 py-3 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.8} />
            Bevezető indítása
          </button>
        }
      />

      {filtered.length === 0 ? (
        <div className="rounded-[26px] border border-dashed border-line-strong bg-white/50 py-14 text-center">
          <Search className="mx-auto h-6 w-6 text-ink-soft" strokeWidth={1.6} />
          <p className="mt-3 text-sm font-medium text-ink-soft">
            Nincs találat a(z) „{query}” keresésre.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-2 text-sm font-semibold text-ink transition-opacity hover:opacity-70"
          >
            Keresés törlése
          </button>
        </div>
      ) : (
        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }}
          initial="hidden"
          animate="show"
          className="space-y-7"
        >
          {GROUPS.map((g) => {
            const items = filtered.filter((t) => (GROUP_OF[t.id] ?? 'setup') === g.id)
            if (items.length === 0) return null
            return (
              <motion.section key={g.id} variants={popItem} className="space-y-3">
                {/* Szekció-eyebrow — vékony elválasztóval, jobbra a darabszám. */}
                <div className="flex items-center gap-2.5 px-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A29B82]">{g.label}</span>
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[11px] font-semibold text-ink-soft2">{items.length}</span>
                </div>
                {/* iOS-szerű csoport-lista: egy üveg-konténer, benne hairline-elválasztott sorok. */}
                <div className="overflow-hidden rounded-[26px] dav-card-glass">
                  {items.map((tip, i) => (
                    <HelpRow
                      key={tip.id}
                      tip={tip}
                      tileClass={g.tile}
                      iconClass={g.iconColor}
                      first={i === 0}
                      open={openIds.has(tip.id)}
                      onToggle={() => toggle(tip.id)}
                    />
                  ))}
                </div>
              </motion.section>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

/**
 * Egy súgó-sor — iOS-szerű grouped-list elem (Apple × Crextio): bal ikon-tile (csoport-szín),
 * cím + egy soros preview, jobbra spring-forgó chevron. Kinyitva a részletek ease-in-out
 * height-tel bomlanak (motion.ts `expandHeight`), a cím alá igazítva. A kinyitott sor finoman
 * kiemelt (áttetsző fehér). A sor `<div>` (nem button), mert a kibomló részben link van.
 */
function HelpRow({
  tip, open, onToggle, tileClass, iconClass, first,
}: {
  tip: Tip; open: boolean; onToggle: () => void; tileClass: string; iconClass: string; first: boolean
}) {
  const { id, icon: Icon, title, body, details, bullets, href, linkLabel } = tip

  return (
    <div
      id={`tip-${id}`}
      className={`scroll-mt-24 transition-colors ${first ? '' : 'border-t border-line'} ${open ? 'bg-white/55' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`tip-panel-${id}`}
        className="flex w-full items-center gap-4 px-5 py-4 text-left lg:px-6 lg:py-[18px]"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${tileClass}`}>
          <Icon className={`h-[19px] w-[19px] ${iconClass}`} strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</span>
          <span className={`mt-0.5 block text-[12.5px] leading-snug text-ink-soft ${open ? '' : 'truncate'}`}>{body}</span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="shrink-0 text-ink-soft"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2} />
        </motion.span>
      </button>

      {/* Kibomló részletek — ease-in-out height (motion.ts expandHeight), a cím alá igazítva. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`tip-panel-${id}`} key="panel" {...expandHeight} className="overflow-hidden">
            <div className="px-5 pb-5 pl-[76px] lg:px-6 lg:pb-6 lg:pl-[80px]">
              <p className="text-[13px] leading-relaxed text-ink-soft2">{details}</p>
              <ul className="mt-3 space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-soft">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={href}
                className="group mt-4 inline-flex items-center gap-1.5 rounded-[16px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              >
                {linkLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.8} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
