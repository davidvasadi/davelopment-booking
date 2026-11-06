import {
  CalendarDays, Briefcase, Users, Clock, Settings, BarChart2, Armchair, LayoutDashboard, Printer, Bell, Lightbulb,
  MapPin, CalendarRange, CreditCard, Coins, Smartphone, Gift, Megaphone, Wallet, Star, ShieldCheck, Globe as Globe2, Mail, Receipt, Plug, Building2, KeyRound, type LucideIcon,
} from 'lucide-react'
import type { Capability } from '@/lib/permissions'

/**
 * A Súgó témái (design 15.x) — szalon és étterem: mit tud a rendszer, hol találod, mire figyelj. Új téma = egy új
 * objektum a `TIPS[variant]` tömbben (és ha joghoz kötött, a `TIP_REQUIRED_CAP`-ban). Az élő HelpView és a design oldal
 * HelpGroups blokkja is ebből rajzol.
 */

export type HelpVariant = 'restaurant' | 'salon'
type Variant = HelpVariant

export type HelpTopic = {
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

const TIPS: Record<Variant, HelpTopic[]> = {
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
      href: '/restaurant/settings?tab=tables',
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
    {
      id: 'reviews',
      icon: Star,
      title: 'Vendég-értékelések',
      body: 'A látogatás után a vendég egy gyors, saját csillagozó-oldalon értékel — jó értékelésnél egyenesen a Google-ra kerül.',
      details: 'A visszajelzés-emailben küldött link a saját, egy-koppintásos csillagozó-oldaladra visz — nem kell Google-fiók, nem kell regisztráció. Ha a vendég 4 vagy 5 csillagot ad, az oldal automatikusan átirányítja a Google-értékelő oldaladra (ha az be van kötve a Google fülön), így a jó véleményed valóban megjelenik a Google-találatokban is. Alacsonyabb értékelésnél a visszajelzés csak nálad marad — privát, nem kerül nyilvánosságra.',
      bullets: [
        'A Google fülön (Beállítások → Google) add meg az étterem Google-értékelő linkjét, hogy a 4-5★ vendégek oda kerüljenek.',
        'A vendég csillagozása és véleménye a Vendégek oldalon, az adott vendég profiljánál is megjelenik.',
        'A visszajelzés-kérő email időzítése (1 óra / 2 óra / másnap) a Google fülön állítható.',
      ],
      href: '/restaurant/settings?tab=google',
      linkLabel: 'Megnyitom a Google beállításokat',
    },
    {
      id: 'vouchers',
      icon: Gift,
      title: 'Ajándékutalvány',
      body: 'A vendégeid ajándékba is vehetnek nálad utalványt — extra bevétel, még szezonon kívül is.',
      details: 'Az ajándékutalvány önálló, beépített funkció: a vendég a publikus oldaladon választott összegben vásárolhat utalványt, amit aztán beváltás vagy asztalfoglaláskor tud felhasználni. Nincs hozzá külön integráció — csak be kell kapcsolni és beállítani az összeghatárokat és az érvényességi időt.',
      bullets: [
        'Kapcsold be a Beállítások → Foglalás fülön, és állítsd be a minimum/maximum összeget és az érvényességi időt (alapból 12 hónap).',
        'Az eladott és beváltott utalványok a Beállításokban követhetők.',
        'Kiváló ajándékötlet ünnepek előtt — érdemes a publikus oldaladon és a közösségi médiában is megosztani.',
      ],
      href: '/restaurant/settings?tab=booking',
      linkLabel: 'Megnyitom a Foglalás beállításokat',
    },
    {
      id: 'marketing',
      icon: Megaphone,
      title: 'Hírlevél / marketing-kampány',
      body: 'Küldj hírlevelet a vendégeidnek — ez benne van az előfizetésedben, nincs külön költsége.',
      details: 'A Marketing oldalon a vendéglistádból (akik hozzájárultak) egyszerű hírlevél-kampányt indíthatsz — pl. egy akció, egy szezonális ajánlat vagy egyszerűen egy emlékeztető, hogy visszavárod őket. A funkció a csomagodba épített, nincs küldésenkénti díj.',
      bullets: [
        'A vendégek csak akkor kerülnek a listára, ha ehhez hozzájárultak (feliratkozás/leiratkozás-kezelés automatikus).',
        'A leghasznosabb célcsoport a régen nem járt, korábban aktív vendég — a Vendégek oldalon szűrhetsz erre.',
        'A kampány állapota és a korábbi küldések a Marketing oldalon követhetők.',
      ],
      href: '/restaurant/marketing',
      linkLabel: 'Megnyitom a Marketinget',
    },
    {
      id: 'payments',
      icon: Wallet,
      title: 'Vendég-előleg és online fizetés',
      body: 'Kérj előleget a foglaláskor — kevesebb no-show, és lemondás esetén is marad bevétel.',
      details: 'A Stripe Connect bekötése után a foglaláskor előleget kérhetsz a vendégtől — fix összeget, százalékot vagy fejenkénti díjat. Ez az egyik leghatékonyabb eszköz a meg nem jelenés ellen: aki előre fizetett, jóval nagyobb eséllyel meg is jelenik, vagy időben lemondja a helyet.',
      bullets: [
        'A Fizetés fülön kötheted be a Stripe Connect fiókodat (ehhez valós bankszámla-adat kell).',
        'Az előleg típusa (fix / százalék / fejenként) és összege szabadon állítható.',
        'A beérkezett előlegek és a kifizetések a Fizetés fülön követhetők.',
      ],
      href: '/restaurant/settings?tab=payments',
      linkLabel: 'Megnyitom a Fizetés beállításokat',
    },
    {
      id: 'permissions',
      icon: ShieldCheck,
      title: 'Jogosultságok — ki mit láthat/kezelhet',
      body: 'A csapat & jogok rendszerrel pontosan szabályozod, ki mit lát és mit szerkeszthet — a tulajdonos mindig mindent.',
      details: 'Minden csapattag (a tulajdonos kivételével) egy egyedi szerephez van kötve, aminek te állítod be a jogait — nincs alapból "menedzser" vagy "dolgozó" jogkészlet. Egy szerep-definíció létrehozása és szerkesztése (a jog-lista maga) mindig kizárólag a tulajdonosnak elérhető — egy csapattag legfeljebb MEGLÉVŐ szerepeket oszthat ki másoknak, ha van hozzá "Csapat kezelése" joga, de új szerepet nem hozhat létre és meglévőt nem módosíthat.',
      bullets: [
        'Aki nem kap semmilyen szerepet, csak belép, de üres a felülete — a jogokat neked kell hozzárendelned.',
        '"Csapat megtekintése"/"Csapat kezelése" a csapat-listát és a meghívást szabályozza; "Jogosultságok megtekintése" külön jog ahhoz, hogy valaki lássa magukat a szerep-definíciókat.',
        '"Mások fizetésének megtekintése" külön jog — a saját fizetését mindenki látja jog nélkül is, de mások fizetését csak akinek ezt kifejezetten megadod.',
        'A "Veszélyzóna" (üzlet törlése) sosem adható ki — az mindig tulajdonos-jog marad.',
      ],
      href: '/restaurant/settings?tab=team',
      linkLabel: 'Megnyitom a Csapat & jogokat',
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
    {
      id: 'reviews',
      icon: Star,
      title: 'Vendég-értékelések',
      body: 'A látogatás után a vendég egy gyors, saját csillagozó-oldalon értékel — jó értékelésnél egyenesen a Google-ra kerül.',
      details: 'A visszajelzés-emailben küldött link a saját, egy-koppintásos csillagozó-oldaladra visz — nem kell Google-fiók, nem kell regisztráció. Ha a vendég 4 vagy 5 csillagot ad, az oldal automatikusan átirányítja a Google-értékelő oldaladra (ha az be van kötve a Google fülön), így a jó véleményed valóban megjelenik a Google-találatokban is. Alacsonyabb értékelésnél a visszajelzés csak nálad marad — privát, nem kerül nyilvánosságra.',
      bullets: [
        'A Google fülön (Beállítások → Google) add meg a szalon Google-értékelő linkjét, hogy a 4-5★ vendégek oda kerüljenek.',
        'A vendég csillagozása és véleménye a Vendégek oldalon, az adott vendég profiljánál is megjelenik.',
        'A visszajelzés-kérő email időzítése (1 óra / 2 óra / másnap) a Google fülön állítható.',
      ],
      href: '/dashboard/settings?tab=google',
      linkLabel: 'Megnyitom a Google beállításokat',
    },
    {
      id: 'vouchers',
      icon: Gift,
      title: 'Ajándékutalvány',
      body: 'A vendégeid ajándékba is vehetnek nálad utalványt — extra bevétel, még szezonon kívül is.',
      details: 'Az ajándékutalvány önálló, beépített funkció: a vendég a publikus oldaladon választott összegben vásárolhat utalványt, amit aztán beváltás vagy időpontfoglaláskor tud felhasználni. Nincs hozzá külön integráció — csak be kell kapcsolni és beállítani az összeghatárokat és az érvényességi időt.',
      bullets: [
        'Kapcsold be a Beállítások → Foglalás fülön, és állítsd be a minimum/maximum összeget és az érvényességi időt (alapból 12 hónap).',
        'Az eladott és beváltott utalványok a Beállításokban követhetők.',
        'Kiváló ajándékötlet ünnepek előtt — érdemes a publikus oldaladon és a közösségi médiában is megosztani.',
      ],
      href: '/dashboard/settings?tab=booking',
      linkLabel: 'Megnyitom a Foglalás beállításokat',
    },
    {
      id: 'marketing',
      icon: Megaphone,
      title: 'Hírlevél / marketing-kampány',
      body: 'Küldj hírlevelet a vendégeidnek — ez benne van az előfizetésedben, nincs külön költsége.',
      details: 'A Marketing oldalon a vendéglistádból (akik hozzájárultak) egyszerű hírlevél-kampányt indíthatsz — pl. egy akció, egy szezonális ajánlat vagy egyszerűen egy emlékeztető, hogy visszavárod őket. A funkció a csomagodba épített, nincs küldésenkénti díj.',
      bullets: [
        'A vendégek csak akkor kerülnek a listára, ha ehhez hozzájárultak (feliratkozás/leiratkozás-kezelés automatikus).',
        'A leghasznosabb célcsoport a régen nem járt, korábban aktív vendég — a Vendégek oldalon szűrhetsz erre.',
        'A kampány állapota és a korábbi küldések a Marketing oldalon követhetők.',
      ],
      href: '/dashboard/marketing',
      linkLabel: 'Megnyitom a Marketinget',
    },
    {
      id: 'payments',
      icon: Wallet,
      title: 'Vendég-előleg és online fizetés',
      body: 'Kérj előleget a foglaláskor — kevesebb no-show, és lemondás esetén is marad bevétel.',
      details: 'A Stripe Connect bekötése után a foglaláskor előleget kérhetsz a vendégtől — fix összeget, százalékot vagy fejenkénti díjat. Ez az egyik leghatékonyabb eszköz a meg nem jelenés ellen: aki előre fizetett, jóval nagyobb eséllyel meg is jelenik, vagy időben lemondja az időpontot.',
      bullets: [
        'A Fizetés fülön kötheted be a Stripe Connect fiókodat (ehhez valós bankszámla-adat kell).',
        'Az előleg típusa (fix / százalék / fejenként) és összege szabadon állítható.',
        'A beérkezett előlegek és a kifizetések a Fizetés fülön követhetők.',
      ],
      href: '/dashboard/settings?tab=payments',
      linkLabel: 'Megnyitom a Fizetés beállításokat',
    },
    {
      id: 'permissions',
      icon: ShieldCheck,
      title: 'Jogosultságok — ki mit láthat/kezelhet',
      body: 'A csapat & jogok rendszerrel pontosan szabályozod, ki mit lát és mit szerkeszthet — a tulajdonos mindig mindent.',
      details: 'Minden csapattag (a tulajdonos kivételével) egy egyedi szerephez van kötve, aminek te állítod be a jogait — nincs alapból "menedzser" vagy "dolgozó" jogkészlet. Egy szerep-definíció létrehozása és szerkesztése (a jog-lista maga) mindig kizárólag a tulajdonosnak elérhető — egy csapattag legfeljebb MEGLÉVŐ szerepeket oszthat ki másoknak, ha van hozzá "Csapat kezelése" joga, de új szerepet nem hozhat létre és meglévőt nem módosíthat.',
      bullets: [
        'Aki nem kap semmilyen szerepet, csak belép, de üres a felülete — a jogokat neked kell hozzárendelned.',
        '"Csapat megtekintése"/"Csapat kezelése" a csapat-listát és a meghívást szabályozza; "Jogosultságok megtekintése" külön jog ahhoz, hogy valaki lássa magukat a szerep-definíciókat.',
        '"Mások fizetésének megtekintése" külön jog — a saját fizetését mindenki látja jog nélkül is, de mások fizetését csak akinek ezt kifejezetten megadod.',
        'A "Veszélyzóna" (üzlet törlése) sosem adható ki — az mindig tulajdonos-jog marad.',
      ],
      href: '/dashboard/settings?tab=team',
      linkLabel: 'Megnyitom a Csapat & jogokat',
    },
  ],
}

/* ── Az utóbbi hetek funkciói (2026-11) — szalon és étterem közösen, a saját útvonalukkal ── */
function newerTopics(v: Variant): HelpTopic[] {
  const base = v === 'restaurant' ? '/restaurant' : '/dashboard'
  const r = v === 'restaurant'
  const t: HelpTopic[] = [
    {
      id: 'booking-page', icon: Globe2, title: 'Foglalóoldal és szerkesztője',
      body: 'Az oldal, ahol a vendégeid foglalnak — borítókép, színek, galéria, „Jó tudni”, gombok, élő előnézettel szerkesztve.',
      details: 'A Beállítások › Foglalóoldal a vendég-oldal teljes szerkesztője: bal oldalt a részek, középen az élő előnézet (desktop és telefon egyszerre), és rákattintva bármelyik elem szerkeszthető. Közzététel előtt semmi nem változik élesben; a változtatások visszavonhatók.',
      bullets: [
        'Megjelenés: márkaszín, kártya-stílus (sötét, fekete, üveg, fehér), a borítókép elsötétítése.',
        'Galéria és „Jó tudni” (parkolás, wifi, kártyás fizetés…) — a vendég egy kattintással látja a nyitvatartást is.',
        r ? 'A foglalás lépései (létszám, nap, idő, adatok) előnézetben végiglapozhatók.' : 'A foglalás lépései (szolgáltatás, munkatárs, nap, idő, adatok) előnézetben végiglapozhatók; a szolgáltatások sorrendje és a képek is itt állíthatók.',
        'Megosztás: a link, a QR-kód, az Instagram / Facebook „Foglalj” gomb és a saját weboldalba ágyazás a Beállítások › Integrációk lapon.',
      ],
      href: `${base}/settings?tab=site`, linkLabel: 'Megnyitom a Foglalóoldalt',
    },
    {
      id: 'guest-emails', icon: Mail, title: 'Vendég e-mailek',
      body: 'A visszaigazolás, az emlékeztető, a lemondás és a visszajelzés-kérés levele — sablonból, blokkokból, a saját szövegeddel.',
      details: 'A Beállítások › Vendég e-mailek lapon minden levél szerkeszthető, mint egy hírlevél: a „Sablon betöltése” kész szöveget, a foglalás adatait, gombokat (Naptárba, Útvonalterv) és a lemondás-sort teszi a levélbe — mind szerkeszthető blokk. A foglalás adatai blokk tartalmát a rendszer tölti, csak a stílusa állítható.',
      bullets: [
        'Beszúrható adatok: vendég, üzlet, nap, idő, ' + (r ? 'létszám' : 'szolgáltatás, munkatárs') + ' — a kiküldéskor a valódi adatra cserélődnek.',
        'A gombok linkje egy kattintással: Naptárba, Útvonalterv, Lemondás, Értékelés, Foglalóoldal, Feltételek.',
        'Emlékeztető: 2 nappal, 24 vagy 3 órával előtte (több is), e-mailben.',
        'Előnézet a levél jobb oldalán; minden nyelvre külön szöveg írható.',
      ],
      href: `${base}/settings?tab=email`, linkLabel: 'Megnyitom a Vendég e-maileket',
    },
    {
      id: 'invoicing', icon: Receipt, title: 'Automatikus számla',
      body: 'Minden online fizetésről (előleg, utalvány) magától számla készül a saját Számlázz.hu vagy Billingo fiókodból.',
      details: 'A Beállítások › Fizetés lapon kötöd össze a számlázót: Számlázz.hu-nál az Agent-kulcs, Billingónál az API-kulcs kell. A kulcsot nem mutatjuk vissza, csak hogy el van mentve — cserélhető és törölhető. A kiállított számlák a Számlák lapon láthatók és letölthetők.',
      bullets: [
        'Számlázz.hu: Beállítások › Számla Agent — a kulcsot onnan másold.',
        'Billingo: Beállítások › API kulcsok.',
        'A vendég a számlát e-mailben kapja; a hibásan kiállított számla a Számlák lapon látszik.',
      ],
      href: `${base}/settings?tab=payments`, linkLabel: 'Megnyitom a Fizetést',
    },
    {
      id: 'integrations', icon: Plug, title: 'Integrációk és import',
      body: 'Naptár-feliratkozás, Zapier / Make, Google Analytics / Meta Pixel, „Foglalj” gomb, beágyazás és adat-import.',
      details: 'A Beállítások › Integrációk lapon minden külső kapcsolat egy helyen van. A naptár-linkkel a foglalások a saját Google / Apple naptáradban is megjelennek; a webhook (Zapier / Make) minden új foglalásnál, lemondásnál, új vendégnél, számlánál, utalványnál és értékelésnél üzen.',
      bullets: [
        'Naptár: a link a telefonod / géped naptárába — magától frissül.',
        'Zapier / Make: illeszd be a webhook címét, a „Próba” gombbal küldhetsz egy minta-foglalást.',
        'Import: vendégek, foglalások, szolgáltatások CSV-ből vagy Excelből; a minta-fájl ugyanott letölthető.',
      ],
      href: `${base}/settings?tab=integrations`, linkLabel: 'Megnyitom az Integrációkat',
    },
    {
      id: 'google', icon: MapPin, title: 'Google-profil és „Foglalj most”',
      body: 'A Google Cégprofilod összekötése: a „Foglalj most” gomb a Keresőben és a Térképen, és a Google-értékelések a foglalóoldalon.',
      details: 'A Beállítások › Google lapon kötöd össze az üzleted a Google-profiloddal. Utána a foglalóoldalon a Google-átlag és -értékelések is látszanak, és a vendég a Google-ből egyenesen hozzád foglal.',
      bullets: [
        'Az értékelések naponta legfeljebb egyszer frissülnek.',
        'A látogatás utáni értékelés-kérés a jó értékelést a Google-re (vagy TripAdvisorra, Facebookra) küldi — Beállítások › Értékelések.',
      ],
      href: `${base}/settings?tab=google`, linkLabel: 'Megnyitom a Google-t',
    },
    {
      id: 'holidays', icon: CalendarRange, title: 'Ünnepnapok, kivételek, utolsó időpont',
      body: 'A heti nyitvatartástól eltérő napok (szabadság, ünnep, rövidített nap) és hogy zárás előtt meddig lehessen foglalni.',
      details: 'A Nyitvatartás lapon a „Kivételek” kártya jelzi a közelgő munkaszüneti napokat — a rendszer magától nem zár be, te döntöd el: rákattintva zárva, rövidített vagy nyitva marad. Az „Utolsó foglalható időpont” beállítással a zárás előtti utolsó 30–90 percre már nem lehet foglalni.',
      bullets: [
        'Kivétel: egy nap vagy időszak, zárva vagy eltérő nyitvatartással — a foglaló ehhez igazodik.',
        'Munkaszüneti nap: a kártyán „ünnepnap — mi legyen?” felirattal jelenik meg, amíg nem döntesz róla.',
        r ? 'Étteremnél az utolsó beültetés: zárás előtt ennyivel már nem foglalható asztal.' : 'Szalonnál az utolsó időpont: zárás előtt ennyivel már nem kezdődhet foglalás.',
      ],
      href: `${base}/availability`, linkLabel: 'Megnyitom a Nyitvatartást',
    },
    {
      id: 'sites', icon: Building2, title: 'Telephelyek — több üzlet',
      body: 'Több szalont vagy éttermet egy fiókból kezelhetsz — a fejlécben váltasz közöttük.',
      details: 'A Beállítások › Telephelyek lapon látod az összes üzletedet és egy újat is hozzáadhatsz. Minden üzletnek saját foglalóoldala, csapata, nyitvatartása és beállításai vannak; a fiókod (belépés, saját profil) közös.',
      bullets: [
        'Váltás: a fejlécben (desktopon a menüből, mobilon a Fiók gombról) az üzlet nevére kattintva.',
        'Új üzlet: Telephelyek › Üzlet hozzáadása — szalon és étterem is lehet.',
      ],
      href: `${base}/settings?tab=sites`, linkLabel: 'Megnyitom a Telephelyeket',
    },
    {
      id: 'login', icon: KeyRound, title: 'Belépés és eszközök',
      body: 'Jelszó nincs: e-mailes kóddal vagy Google-lel lépsz be, és 7 napig belépve maradsz az eszközön.',
      details: 'A belépésnél megadod az e-mail-címed, és kapsz egy 6 jegyű kódot (10 percig érvényes). A Saját profil › Aktív eszközök listában látod, hol vagy bejelentkezve — bármelyik eszközt kijelentkeztetheted, ha pl. elveszett a telefonod.',
      bullets: [
        'Nem jött meg a kód? Nézd meg a Spam mappát, vagy kérj újat 30 másodperc múlva.',
        '„Kijelentkezés mindenhol máshol”: minden más eszközről kilép, ezen bent maradsz.',
      ],
      href: `${base}/settings?tab=self`, linkLabel: 'Megnyitom a Saját profilt',
    },
  ]
  if (r) t.splice(6, 0, {
    id: 'capacity', icon: Armchair, title: 'Online kapacitás és foglalási szabályok',
    body: 'Mennyi férőhelyet adsz ki online, melyik terem foglalható online, és mekkora társaság foglalhat.',
    details: 'A Beállítások › Asztalok & termek lapon termenként eldöntöd, foglalható-e online (a többi csak telefonon), és hogy a férőhelyek hány százaléka menjen online — a többit a betérőknek tartod. A Foglalási szabályok lapon a legkisebb és legnagyobb online létszám és a maximum foglalási idő állítható.',
    bullets: [
      'Online kiadható férőhely: pl. 70% — a maradék a betérő vendégeké.',
      'Legnagyobb online létszám fölött a vendég üzenetet küld, nem foglal.',
      'Maximum foglalási idő: 30 perctől 3 óráig — ennyi ideig tartja egy foglalás az asztalt.',
    ],
    href: `${base}/settings?tab=tables`, linkLabel: 'Megnyitom az Asztalokat & termeket',
  })
  return t
}
TIPS.restaurant.push(...newerTopics('restaurant'))
TIPS.salon.push(...newerTopics('salon'))

/* Az Értesítések oldal (design 17.3) és a csengő panel mai működése. */
for (const v of ['restaurant', 'salon'] as const) {
  const n = TIPS[v].find((x) => x.id === 'notifications')
  if (n) Object.assign(n, {
    body: 'Új foglalásról, lemondásról, módosításról és a csapat változásairól a fejléc csengőjénél kapsz értesítést.',
    details: 'A csengő alatti panelen a legfrissebbek, a panel aljáról az Értesítések oldalon az összes — napokra bontva. A jóváhagyásra váró foglalást ott helyben elfogadhatod vagy elutasíthatod.',
    bullets: [
      'Szűrő: Mind / Olvasatlan / Jóváhagyás; az olvasatlant sárga pötty jelzi.',
      'Összes olvasott, Összes törlése — egy-egy értesítés a sor jobb oldalán törölhető.',
      'Hogy miről és hová (App / E-mail) kérsz értesítést, a Beállítások › Értesítések lapon állítod.',
    ],
    href: `${v === 'restaurant' ? '/restaurant' : '/dashboard'}/notifications`, linkLabel: 'Megnyitom az Értesítéseket',
  })
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
  settings:               'settings.profile',
  subscription:           'billing.manage',
  reviews:                'settings.profile',
  vouchers:               'settings.profile',
  marketing:              ['marketing.view', 'marketing.manage'],
  payments:               'payments.manage',
  permissions:            ['team.view', 'team.manage', 'roles.view'],
  'booking-page':         'settings.profile',
  'guest-emails':         'settings.profile',
  invoicing:              'payments.manage',
  integrations:           'settings.profile',
  google:                 'settings.profile',
  holidays:               ['availability.view', 'availability.manage'],
  sites:                  'settings.profile',
  capacity:               'settings.profile',
}

function tipVisible(id: string, caps: Capability[]): boolean {
  const req = TIP_REQUIRED_CAP[id]
  if (!req) return true
  if (Array.isArray(req)) return req.some((c) => caps.includes(c))
  return caps.includes(req)
}

/** Ékezet-érzéketlen, kisbetűs normalizálás a kereséshez. */
export function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/* ── Tematikus csoportok — a monoton rács helyett szekciók, csoportonként eltérő ikon-tile
 *    (sötét / gold / zöld accent). A hovatartozást a tip `id`-ja adja (variant-független). ── */
export type HelpGroupId = 'daily' | 'setup' | 'growth'
type GroupId = HelpGroupId

const GROUP_OF: Record<string, GroupId> = {
  overview: 'daily', bookings: 'daily', print: 'daily', guests: 'daily', 'schedule-own': 'daily',
  services: 'setup', tables: 'setup', schedule: 'setup', staff: 'setup', 'staff-manage': 'setup',
  availability: 'setup', notifications: 'setup', 'notifications-manage': 'setup', pwa: 'setup', settings: 'setup',
  tips: 'growth', analytics: 'growth', 'tips-money': 'growth', subscription: 'growth',
  vouchers: 'setup', payments: 'setup', permissions: 'setup', reviews: 'growth', marketing: 'growth',
  'booking-page': 'setup', 'guest-emails': 'setup', invoicing: 'setup', integrations: 'setup', google: 'growth', holidays: 'daily', sites: 'setup', capacity: 'setup', login: 'setup',
}


export const HELP_GROUPS: { id: HelpGroupId; label: string; tone: 'dark' | 'yellow' | 'ok' }[] = [
  { id: 'daily', label: 'Napi munka', tone: 'dark' },
  { id: 'setup', label: 'Beüzemelés & testreszabás', tone: 'yellow' },
  { id: 'growth', label: 'Növekedés & elemzés', tone: 'ok' },
]

/** A felhasználónak látható témák (jogosultság szerint), csoportokba rendezve; `query`: ékezet nélkül is, a részletekben is keres. */
export function helpGroups(variant: HelpVariant, caps?: Capability[] | null, query = '') {
  const q = normalize(query.trim())
  const topics = TIPS[variant].filter((t) => (!caps || tipVisible(t.id, caps)) && (!q || normalize([t.title, t.body, t.details, ...t.bullets].join(' ')).includes(q)))
  return HELP_GROUPS.map((g) => ({ ...g, topics: topics.filter((t) => (GROUP_OF[t.id] ?? 'setup') === g.id) })).filter((g) => g.topics.length)
}
