import { SITE_URL } from '@/lib/publicSeo'

export type TipSection = { title: string; body: string }

export type Tip = {
  /** tipp = a rendszer használata (hogyan csináld nálunk); cikk = általános blogcikk. Alapból cikk. */
  kind?: 'tipp' | 'cikk'
  slug: string
  category: string
  date: string
  title: string
  excerpt: string
  intro: string
  image: string
  /** A borítókép object-position igazítása a listakártyák "object-cover" vágásánál (a cikk-oldal
   *  fejlécén "object-contain" fut, ott ez a beállítás nem vág, csak finoman igazít) — alapból
   *  "top" (a régi, mindig-felülre-igazított viselkedés), de ha a kép fő eleme (pl. egy laptop)
   *  középen/lejjebb ül a képen és felülről vágva belelógna, itt "center"-re állítható. */
  imagePosition?: 'top' | 'center'
  /** Finomhangolt vízszintes vágási pont a lista-/teaser-kártyák "object-cover" borítóképén —
   *  felülírja az alap középre-igazítást. Szám esetén %-ban értendő (0-100, a kép bal szélétől;
   *  kisebb érték a bal oldalát tartja meg, nagyobb a jobbat), vagy közvetlen CSS-érték is adható
   *  (pl. "calc(30% + 10px)") egy már bevált %-ponthoz képesti apró px-es finomításhoz. Nem érinti
   *  a cikk-oldal fejléc-képét. */
  coverPositionX?: number | string
  /** A cikk-oldal fejléc-képének megjelenítési módja — alapból "contain" (nem vág, csak a
   *  keretbe illeszti, ha a kép aránya nem passzol pillérezést hagyhat), "cover"-rel kitölti a
   *  teljes keretet (vághat, ha a kép aránya nagyon eltér a konténerétől). */
  headerImageFit?: 'contain' | 'cover'
  /** Finomhangolt függőleges vágási pont (0-100, a kép tetejétől %-ban) a cikk-oldal fejléc-képén
   *  "cover" módban — felülírja az `imagePosition`-t erre a helyre. Pl. 20 = a kép tetejétől 20%-kal
   *  lejjebbről induljon a látható rész (kevesebb üres háttér, több a tényleges tartalomból). */
  headerImagePositionY?: number
  /** Finom nagyítás (CSS transform scale) a cikk-oldal fejléc-képén, ha a kép tartalma (pl. egy
   *  kis laptop-mockup sok üres hellyel körülötte) túl kicsinek tűnik a "contain" módban. 1 = nincs
   *  nagyítás. A keret `overflow-hidden`, a túllógó rész levágódik. */
  headerImageZoom?: number
  sections: TipSection[]
  /** Záró bekezdés — a davelopment booking mint megoldás, a valódi tanácsok UTÁN. */
  closing: string
  /** 2-3 iparág-landing slugja, amikhez a cikk témája leginkább kapcsolódik — belső linkelés a
   *  cikk alján, hogy a Google topikus klaszterként lássa a tartalmat, ne szigetként. */
  relatedIndustrySlugs?: string[]
}

// Minden tipp ugyanazon a napon publikálva — ha ez változik, itt kell tippenként szétbontani.
const PUBLISHED_ISO = '2026-08-01T09:00:00+02:00'

/** schema.org JSON-LD (BlogPosting) a cikk-oldal rich-resultjához. */
export function articleJsonLd(tip: Tip): Record<string, unknown> {
  const url = `${SITE_URL}/tips/${tip.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: tip.title,
    description: tip.excerpt,
    image: [`${SITE_URL}${tip.image}`],
    datePublished: PUBLISHED_ISO,
    dateModified: PUBLISHED_ISO,
    author: { '@type': 'Organization', name: 'davelopment booking', url: SITE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'davelopment booking',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/favico_dark.svg` },
    },
  }
}

const TIP_IMAGES: Record<string, string> = {
  // a rendszer valódi mobilnézete telefonkeretben (2026-11-09; a landing-tipcovers TipCover-jéből exportálva)
  'no-show-csokkentese': '/landing/tips/borito/no-show-csokkentese-davelopment-booking.webp',
  'emlekeztetok-automatizalasa': '/landing/tips/borito/emlekeztetok-automatizalasa-davelopment-booking.webp',
  'mikor-eri-meg-online-foglalo': '/landing/tips/borito/mikor-eri-meg-online-foglalo-davelopment-booking.webp',
  'csapat-beosztas-hatekonyan': '/landing/tips/borito/csapat-beosztas-hatekonyan-davelopment-booking.webp',
  'torzsvendegek-megtartasa': '/landing/tips/borito/torzsvendegek-megtartasa-davelopment-booking.webp',
  'hogyan-valassz-idopontfoglalo-rendszert': '/landing/tips/borito/hogyan-valassz-idopontfoglalo-rendszert-davelopment-booking.webp',
  'mennyibe-kerul-idopontfoglalo-szoftver': '/landing/tips/borito/mennyibe-kerul-idopontfoglalo-szoftver-davelopment-booking.webp',
  'ingyenes-idopontfoglalo-szoftver-mikor-eri-meg-fizetni': '/landing/tips/borito/ingyenes-idopontfoglalo-szoftver-mikor-eri-meg-fizetni-davelopment-booking.webp',
  'idopontfoglalo-szoftver-funkciok-amire-konnyu-nem-gondolni': '/landing/tips/borito/idopontfoglalo-szoftver-funkciok-amire-konnyu-nem-gondolni-davelopment-booking.webp',
  'ajandekutalvany-ertekesites-szepsegszalonban': '/landing/tips/borito/ajandekutalvany-ertekesites-szepsegszalonban-davelopment-booking.webp',
  'digitalis-beleegyezo-nyilatkozat-rendeloben': '/landing/tips/borito/digitalis-beleegyezo-nyilatkozat-rendeloben-davelopment-booking.webp',
  'asztalfoglalas-online-vs-telefonon': '/landing/tips/borito/asztalfoglalas-online-vs-telefonon-davelopment-booking.webp',
  'mikor-kell-jogosultsagkezeles-csapatnak': '/landing/tips/borito/mikor-kell-jogosultsagkezeles-csapatnak-davelopment-booking.webp',
  'elolegkeres-foglalaskor-csokkenti-noshowt': '/landing/tips/borito/elolegkeres-foglalaskor-csokkenti-noshowt-davelopment-booking.webp',
  'naptar-szinkron-idopontfoglalohoz': '/landing/tips/borito/naptar-szinkron-idopontfoglalohoz-davelopment-booking.webp',
  'audit-naplo-kisvallalkozasban': '/landing/tips/borito/audit-naplo-kisvallalkozasban-davelopment-booking.webp',
  'jelek-hogy-elavult-a-foglalasi-rendszered': '/landing/tips/borito/jelek-hogy-elavult-a-foglalasi-rendszered-davelopment-booking.webp',
  'nav-kompatibilis-szamlazas-foglalasi-rendszerbol': '/landing/tips/borito/nav-kompatibilis-szamlazas-foglalasi-rendszerbol-davelopment-booking.webp',
}

const RAW_TIPS: Omit<Tip, 'image'>[] = [
  {
    slug: 'no-show-csokkentese',
    category: 'Foglalások',
    date: '2026. augusztus 1.',
    title: 'Hogyan csökkentsd a no-show-kat (nem csak emlékeztetővel)',
    excerpt: 'A no-show ritkán rosszindulat — inkább rossz időzítés és bonyolult lemondás. Ami tényleg csökkenti az arányt.',
    intro: 'A vendégek túlnyomó többsége nem szándékosan hagyja ki az időpontot — egyszerűen kicsúszik a fejéből, vagy túl nehéz lemondani. Az alábbi három dolog számszerűen is csökkenti a no-show arányt, bármilyen rendszert használsz.',
    sections: [
      { title: 'Időzítsd jól az emlékeztetőt', body: 'A 24 órával előtte kiküldött emlékeztető a leghatékonyabb — túl korán (egy héttel előbb) elfelejtik, túl későn (2 órával előtte) már nem tudnak újratervezni. Ha van rá módod, küldj kettőt: egyet 24, egyet 2 órával előtte.' },
      { title: 'Tedd egy kattintással lemondhatóvá', body: 'Ha a lemondáshoz telefonálni kell, a vendég inkább egyszerűen nem jön el. Egy önálló, egy kattintásos lemondó-link drasztikusan csökkenti a néma no-show-kat, mert nem kell kínos beszélgetést vállalnia.' },
      { title: 'Nézd meg, mikor a legmagasabb az arány', body: 'A legtöbb helyen van 1-2 visszatérő mintázat (pl. hétfő reggel, péntek késő délután) — ha ezt tudod, célzottan tudsz rájuk erősebb emlékeztetőt vagy előleget kérni.' },
    ],
    closing: 'A davelopment booking mindezt automatikusan kezeli: időzített emlékeztetőt küld, a lemondás egy kattintás, a mintázatokat pedig a statisztikák mutatják — nem kell külön odafigyelned rá.',
    relatedIndustrySlugs: ['fodrasz-idopontfoglalas', 'fogorvos-idopontfoglalas', 'csontkovacs-idopontfoglalas'],
  },
  {
    slug: 'mikor-eri-meg-online-foglalo',
    category: 'Döntés',
    date: '2026. augusztus 1.',
    title: 'Mikor éri meg saját online foglalót bevezetni: egy gyors teszt',
    excerpt: 'Ne akkor válts, amikor már késő. Három kérdés, amivel percek alatt eldöntheted, készen állsz-e.',
    intro: 'A legtöbb tulajdonos akkor kezd rendszert keresni, amikor már ütköznek az időpontok és fogynak az idegei. Az alábbi kérdésekkel előre felmérheted, hol tartasz.',
    sections: [
      { title: 'Számold meg a heti telefonhívásaidat', body: 'Ha hetente ötnél többször szakítod félbe a munkád időpont-egyeztetés miatt, az önmagában megéri a váltást — az elvesztegetett idő gyorsan meghaladja egy rendszer havi díját.' },
      { title: 'Mikor volt utoljára dupla foglalásod?', body: 'Ha ez már megtörtént (vagy fennáll a kockázata, mert több helyen is jegyzed az időpontokat), az azt jelenti, hogy a jelenlegi rendszered nem skálázódik tovább.' },
      { title: 'Tudod-e fejből a legforgalmasabb napszakodat?', body: 'Ha nem, akkor vakon tervezel — egy rendszer ezt automatikusan megmutatja, és ez alapján tudsz árazni vagy beosztani.' },
    ],
    closing: 'Ha kettőnél többre igent mondtál, itt az idő — a davelopment booking ingyen kipróbálható, kártya nélkül.',
    relatedIndustrySlugs: ['fodrasz-idopontfoglalas', 'etterem-asztalfoglalas', 'csapatkezeles-kisvallalkozasoknak'],
  },
  {
    slug: 'csapat-beosztas-hatekonyan',
    kind: 'tipp',
    category: 'Csapat',
    date: '2026. augusztus 1.',
    title: 'Hogyan oszd be a csapatot, hogy ne ütközzenek a foglalások',
    excerpt: 'A beosztást egy kézben érdemes tartani — de mindenkinek látnia kell a saját sávját.',
    intro: 'Két-három fős csapatnál még kézzel is kezelhető a beosztás. Ennél nagyobb csapatnál viszont a félreértések szinte elkerülhetetlenek — hacsak nincs egyértelmű, ki írja a beosztást, és mindenki látja-e a sajátját.',
    sections: [
      { title: 'Egy kéz írja, mindenki látja', body: 'Ha bárki szerkesztheti a beosztást, előbb-utóbb két ember két különböző verziót ír felül. Tartsd a vezetők/tulajdonos kezében az írást, de adj mindenkinek saját, jól látható sávot, hogy tudja, mikor dolgozik.' },
      { title: 'Rögzítsd a szabadnapokat előre, ne utólag', body: 'A legtöbb félreértés abból ered, hogy a szabadnapot csak a csoportchatben jelzik, nem a naptárban — ezt utólag nehéz visszakövetni.' },
      { title: 'A műszak-átfedést kézzel is nézd át', body: 'A vendég-foglalásoknál a legtöbb rendszer automatikusan blokkolja az ütközést — de azt, hogy két munkatárs beosztása nem csúszik-e egymásba, gyakran senki nem ellenőrzi automatikusan. Ez rajtad marad, néhány perc alatt átnézhető.' },
    ],
    closing: 'A davelopment bookingban a beosztást a tulajdonos és a vezetők (illetve akik erre jogosultságot kapnak) állítják össze — mindenki más csak a saját sávját látja. A vendég-foglalásoknál a rendszer automatikusan blokkolja az ütközést, a szabadnap pedig azonnal kizárja az adott napot a foglalható időpontok közül.',
    relatedIndustrySlugs: ['csapatkezeles-kisvallalkozasoknak', 'fodrasz-idopontfoglalas', 'etterem-asztalfoglalas'],
  },
  {
    slug: 'emlekeztetok-automatizalasa',
    kind: 'tipp',
    category: 'Csapat',
    date: '2026. augusztus 1.',
    title: 'Így ne csússzon el semmi a csapatodnál (torta-rendeléstől a beosztásig)',
    excerpt: 'A szóban vagy csoportchatben élő teendők előbb-utóbb elvesznek. Egy közös, látható lista sokat javít ezen.',
    intro: 'Minél többen dolgoztok együtt, annál könnyebben elveszik egy-egy apró, de fontos teendő — ki rendelte meg a tortát, ki csinálja meg a heti beosztást. A megoldás nem bonyolult: egy közös, mindenki számára látható napi lista.',
    sections: [
      { title: 'Legyen egy hely, nem tíz', body: 'Ha a teendők félig egy csoportchatben, félig egy papíron, félig valakinek a fejében élnek, előbb-utóbb valami kimarad. Egy közös listára van szükség, amit mindenki ugyanott lát.' },
      { title: 'Dátumhoz kötve tervezz, ne csak "majd"', body: 'A "majd megcsinálom" a leggyakoribb ok, amiért egy teendő elveszik. Ha van hozzá konkrét nap, sokkal nagyobb eséllyel készül el időben.' },
      { title: 'Bárki jelezhessen, ne csak egy ember', body: 'Ha csak a tulajdonos vezetheti a listát, ő lesz a szűk keresztmetszet. Hagyd, hogy a csapat bármely tagja felírjon és kipipáljon egy teendőt.' },
    ],
    closing: 'A davelopment bookingban minden csapattag (tulajdonos, vezető, munkatárs) ugyanazt a napi teendő-listát látja és szerkesztheti — a mai, holnapi és korábbi feladatok külön fülön, dátumhoz kötve. Nem kell hozzá külön alkalmazás vagy csoportchat.',
    relatedIndustrySlugs: ['csapatkezeles-kisvallalkozasoknak', 'maganrendelo-idopontfoglalas', 'etterem-asztalfoglalas'],
  },
  {
    slug: 'torzsvendegek-megtartasa',
    category: 'Vendégek',
    date: '2026. augusztus 1.',
    title: 'Hogyan tartsd meg a törzsvendégeidet (ne csak szerezz újakat)',
    excerpt: 'Az új vendég megszerzése jóval drágább, mint a meglévő megtartása — mégis a legtöbb büdzsé oda megy.',
    intro: 'Könnyű az új vendégekre koncentrálni, mert mérhető: hirdetés, kattintás, foglalás. A visszatérők megtartása kevésbé látványos, mégis ez a legolcsóbb bevétel, amit egy vállalkozás termelhet.',
    sections: [
      { title: 'Mérd a visszatérési arányodat, mielőtt bármit csinálnál', body: 'Ha nem tudod a számot, nem tudod, van-e egyáltalán probléma. Nézd meg, a vendégeid hány százaléka jön vissza 3 hónapon belül.' },
      { title: 'Csökkentsd az újrafoglalás súrlódását', body: 'Ha a vendégnek újra végig kell mennie a teljes foglalási folyamaton, sokan inkább a konkurenciát választják, mert az "egyszerűbbnek tűnik". Tartsd minél rövidebbre az utat az újrafoglalásig.' },
      { title: 'Célozz a csúcsidőszakod alapján', body: 'Ha tudod, mikor a legmagasabb a törzsvendég-arányod, azokban az idősávokban éri meg leginkább kedvezményt vagy prioritást adni nekik — nem vaktában.' },
    ],
    closing: 'A davelopment booking a vendégek dashboardján automatikusan méri a visszatérési arányt (új / visszatérő / törzsvendég bontásban) — ehhez nem kell külön eszköz vagy táblázat.',
    relatedIndustrySlugs: ['kozmetikus-idopontfoglalas', 'joga-idopontfoglalas', 'masszor-idopontfoglalas'],
  },
  {
    slug: 'hogyan-valassz-idopontfoglalo-rendszert',
    category: 'Döntés',
    date: '2026. augusztus 1.',
    title: 'Hogyan válassz időpontfoglaló rendszert: 5 szempont, amit tényleg érdemes nézni',
    excerpt: 'Papíron a legtöbb rendszer ugyanazt ígéri. Az öt szempont, ami a gyakorlatban tényleg számít, mire eldöntöd, melyiket választod.',
    intro: 'Egy gyors keresésre tucatnyi időpontfoglaló rendszer jön fel, és papíron szinte mindegyik ugyanazt ígéri: online foglalás, emlékeztető, naptár. A különbség ott derül ki, amikor a napi működésedhez illesztve nézed őket — ez az öt szempont segít objektíven összehasonlítani.',
    sections: [
      {
        title: 'Nézd meg, mennyire illik a TE iparágadhoz',
        body: 'Egy fodrászatnak más a valódi igénye, mint egy fogorvosi rendelőnek vagy egy étteremnek — az egyiknek csapat-jogosultság és ajándékutalvány kell, a másiknak digitális beleegyező nyilatkozat, a harmadiknak kapacitáskezelés asztalonként. Egy általános, "mindenkinek jó" rendszer gyakran épp azt a funkciót nem tudja, ami a te szakmádban ténylegesen számít — kérdezz rá konkrétan a próba előtt.',
      },
      {
        title: 'Számold ki a TÉNYLEGES havi költséget, ne csak a hirdetett árat',
        body: 'A kiírt havidíj gyakran csak a kiindulópont — sok rendszernél külön fizetsz minden extra munkatársért, SMS-emlékeztetőért vagy a kártyás fizetés jutalékáért. Kérdezz rá konkrétan, mennyi lenne a számlád a TE csapatod méretével és foglalás-számoddal, ne csak az alapcsomag árát nézd.',
      },
      {
        title: 'Próbáld ki éles foglalásokkal, ne csak a demóban kattintgass',
        body: 'Egy bemutató videó vagy demo-fiók mindig makulátlanul néz ki. A valódi teszt az, ha a próbaidő alatt tényleg élő vendégekkel, valós foglalásokkal használod — így kiderül, mennyire egyszerű a vendégnek, és mennyi manuális munka marad neked.',
      },
    ],
    closing: 'A davelopment booking pontosan ezért ad kártyaszám nélküli, teljes hozzáférésű próbaidőt — a saját szolgáltatásaiddal, saját csapatoddal tesztelheted, mielőtt döntenél.',
    relatedIndustrySlugs: ['kozmetikus-idopontfoglalas', 'fogorvos-idopontfoglalas', 'pilates-idopontfoglalas'],
  },
  {
    slug: 'mennyibe-kerul-idopontfoglalo-szoftver',
    category: 'Döntés',
    date: '2026. augusztus 1.',
    title: 'Mennyibe kerül egy időpontfoglaló szoftver? Amit az árazási oldalak nem írnak ki',
    excerpt: 'A havi alapdíj csak a történet fele. Mire figyelj, hogy ne érjen meglepetés a számládon 2-3 hónap után.',
    intro: 'Az árazási oldalak első pillantásra egyszerűnek tűnnek: egy szám, havonta. A valóságban a végösszeget gyakran 3-4 külön tényező adja — ezeket érdemes átlátni még a döntés előtt, nem az első számla megérkezésekor.',
    // A borítókép laptopja középen ül a keretben (nem felül) — object-top helyett center-rel a
    // lista-kártya vágása a fehér margóból eszik, nem magából a laptopból.
    // A kép sok üres margót tartalmaz a laptop körül — "contain" módban emiatt aprónak tűnne a
    // cikk-oldal fejlécén, ezért egy kis (30%-os) nagyítást kap.
    headerImageZoom: 1.3,
    // A lista-/teaser-kártyákon a vágási pontot a bal oldal felé toljuk, hogy a laptop bal fele
    // maradjon látható, a jobb oldali üres margó vágódjon le (alap 50% helyett) — a 30%-os
    // alapponthoz képest még +10px-es finomítással jobbra.
    sections: [
      {
        title: 'Fix díj vagy per-fő árazás — nézd meg, melyik skálázódik veled',
        body: 'A per-fő (munkatársankénti) árazás olcsónak tűnhet egyedül, de ha bővül a csapatod, a költség lineárisan nő vele — egy fix, csapatméret-független díj hosszabb távon kiszámíthatóbb lehet. Fordítva is igaz: ha egyedül dolgozol, egy szalonméretre árazott fix csomag felesleges plusz kiadás.',
      },
      {
        title: 'A tranzakciós díjak (SMS, kártyás előleg) gyakran külön sorban vannak',
        body: 'Az emlékeztető-SMS-ek és a bankkártyás előleg-fizetés jutaléka sok rendszernél NEM része az alapdíjnak — ezek forgalomarányosan nőnek. Kérdezz rá konkrétan ezekre a tételekre, különben a becsült havi költséged jóval a valóság alatt marad.',
      },
      {
        title: 'A próbaidő alatt derül ki, elég lesz-e az alap csomag',
        body: 'A legtöbb szolgáltató több csomagszintet kínál, és a felső szintek funkciói (pl. csapatkezelés, egyedi jogosultság, előleg-kérés) gyakran csak akkor derülnek ki hiányzónak, amikor már éles használatban vagy. Egy valódi, teljes hozzáférésű próbaidő alatt ezt előre látod, nem utólag váltasz csomagot.',
      },
    ],
    closing: 'A davelopment booking árazása átlátható és csomagfüggetlenül tartalmazza a hírlevél-küldést is — nincs elrejtett, csak apró betűvel jelzett extra tétel. A próbaidő alatt a teljes funkciókészletet használhatod, hogy pontosan lásd, melyik csomag lesz elég.',
    relatedIndustrySlugs: ['maganrendelo-idopontfoglalas', 'joga-idopontfoglalas', 'barber-idopontfoglalas'],
  },
  {
    slug: 'ingyenes-idopontfoglalo-szoftver-mikor-eri-meg-fizetni',
    category: 'Döntés',
    date: '2026. augusztus 1.',
    title: 'Ingyenes időpontfoglaló szoftverek: mikor éri meg mégis fizetni értük',
    excerpt: 'Az ingyenes csomagok jó kiindulópontok, de van egy pont, ahol a hiányzó funkciók többe kerülnek, mint egy fizetős előfizetés.',
    intro: 'Egy induló vállalkozásnak logikus lépés az ingyenes időpontfoglalóval kezdeni — de érdemes tudni előre, hol vannak a határai, hogy ne akkor derüljön ki, amikor már ráállt rá a működésed.',
    sections: [
      { title: 'Nézd meg, mi számít "korlátozottnak"', body: 'A legtöbb ingyenes csomag nem a funkciók számában korlátoz, hanem a mennyiségben: hány foglalás, hány munkatárs, hány emlékeztető fér bele havonta. Ha ezek a határok a jelenlegi forgalmaddal is szűkösek, az "ingyenes" gyorsan csak névleg az.' },
      { title: 'Az emlékeztető és az előleg nem luxus, hanem bevétel-védelem', body: 'Az automatikus emlékeztető és az előlegkérés funkciója ritkán szerepel az ingyenes csomagokban — pedig pont ezek csökkentik a no-show-t, ami közvetlen bevételkiesés. Ha rendszeresen van üresen maradt időpontod, ez a hiány gyorsan drágább, mint egy előfizetés.' },
      { title: 'Számold ki, mennyit ér a saját időd', body: 'Ha az ingyenes rendszer hiányzó funkciói miatt kézzel kell pótolnod (pl. külön emlékeztetőt írsz, manuálisan foglalsz be telefonon), az az idő is költség — csak nem számla formájában jelenik meg.' },
    ],
    closing: 'A davelopment booking kártyaszám nélküli, teljes hozzáférésű próbaidőt ad — így pontosan látod, mennyit ér neked azok a funkciók, amikért egyébként fizetnél.',
    relatedIndustrySlugs: ['fodrasz-idopontfoglalas', 'kozmetikus-idopontfoglalas', 'csapatkezeles-kisvallalkozasoknak'],
  },
  {
    slug: 'idopontfoglalo-szoftver-funkciok-amire-konnyu-nem-gondolni',
    category: 'Funkciók',
    date: '2026. augusztus 1.',
    title: 'Időpontfoglaló szoftver: 3 funkció, amire könnyű nem gondolni vásárlás előtt',
    excerpt: 'A legtöbb rendszer ígéri az alapokat — pár konkrét funkció hiánya viszont csak akkor derül ki, amikor már éles használatban vagy.',
    intro: 'Legyen szó fodrászatról, kozmetikáról, egy magánrendelőről vagy egy személyi edzőről — a felszínen a legtöbb időpontfoglaló ugyanazt ígéri. A különbség néhány konkrét, könnyen elsikkadó funkción múlik, amit érdemes kipipálni még a döntés előtt.',
    sections: [
      { title: 'Tudja-e kezelni a szolgáltatásonként eltérő időtartamot', body: 'Egy gyors kezelés 15-20 perc, egy komplexebb szolgáltatás akár 2-3 óra is lehet — ha a rendszer mindenkinek ugyanazt a fix időblokkot osztja, vagy alul-, vagy túlfoglalod magad. Nézd meg, hogy szolgáltatásonként külön időtartamot állíthatsz-e be.' },
      { title: 'Látja-e mindenki a saját sávját, anélkül hogy összezavarodna a többi', body: 'Több szakembernél a naptárnak külön, jól elkülönített sávot kell mutatnia mindenkinek — enélkül a csapat percek alatt elveszti az áttekintést, ki mikor dolgozik és kinél van szabad hely.' },
      { title: 'Van-e benne törzsvendég-felismerés és extra bevételi lehetőség', body: 'A legtöbb szolgáltató vállalkozás bevételének nagy része a visszatérő vendégekből jön — egy jó rendszer külön kezeli őket, és lehetőséget ad pl. ajándékutalvány értékesítésére is, ami plusz bevételi forrás ünnepek környékén.' },
    ],
    closing: 'A davelopment booking pontosan ezekre épül: szolgáltatásonként egyedi időtartam, külön munkatárs-sáv, és beépített ajándékutalvány-értékesítés — mindezt egy próbaidő alatt, saját szolgáltatásaiddal tesztelheted, bármelyik iparágban dolgozol is.',
    relatedIndustrySlugs: ['fodrasz-idopontfoglalas', 'kozmetikus-idopontfoglalas', 'szemelyi-edzo-idopontfoglalas'],
  },
  {
    slug: 'ajandekutalvany-ertekesites-szepsegszalonban',
    category: 'Bevétel',
    date: '2026. augusztus 1.',
    title: 'Ajándékutalvány-értékesítés szépségszalonban: plusz bevételi forrás, amit sokan kihagynak',
    excerpt: 'Karácsony, anyák napja, Valentin-nap — mind olyan időszak, amikor az ajándékutalvány szinte magától eladja magát, ha van hol megvenni.',
    intro: 'Sok szépségszalon és fodrászat kihagyja az ajándékutalványt, pedig ünnepek környékén ez az egyik legkönnyebben eladható termék — feltéve, hogy a vendégnek nem kell személyesen bejönnie érte.',
    sections: [
      { title: 'Az utalványt online is meg kell tudni venni', body: 'Ha az ajándékutalvány kizárólag helyben, nyitvatartási időben vásárolható meg, a legtöbb potenciális vevő lemarad róla — sokan este vagy hétvégén, otthonról döntenek úgy, hogy ajándékot vesznek.' },
      { title: 'Tedd egyértelművé, mire váltható be', body: 'A "bármire beváltható" utalvány kényelmesnek tűnik, de zavart okozhat a pénztárnál. Egy fix összegű vagy konkrét szolgáltatásra szóló utalvány egyszerűbben kezelhető mindkét oldalról.' },
      { title: 'Kösd össze az újrafoglalással', body: 'Az utalványt beváltó vendég egy vadonatúj vendég a rendszerednek — ha a beváltás után könnyen tud újra foglalni nálad, jó eséllyel törzsvendég lesz belőle, nem egyszeri alkalom.' },
    ],
    closing: 'A davelopment bookingban az ajándékutalvány beépített funkció: a vendég online megveheti, a rendszer automatikusan kezeli a beváltást a foglalásnál — nincs szükség külön nyilvántartásra vagy kézi levonásra.',
    relatedIndustrySlugs: ['kozmetikus-idopontfoglalas', 'mukormos-idopontfoglalas', 'fodrasz-idopontfoglalas'],
  },
  {
    slug: 'digitalis-beleegyezo-nyilatkozat-rendeloben',
    category: 'Jog',
    date: '2026. augusztus 1.',
    title: 'Digitális beleegyező nyilatkozat fogászati és egészségügyi rendelőben',
    excerpt: 'A papíralapú nyilatkozat könnyen elkeveredik, nehezen kereshető vissza — mire figyelj, ha digitálisra váltanál.',
    intro: 'Egészségügyi és fogászati rendelőkben a beleegyező nyilatkozat kötelező, de a papíralapú változat gyakran csak egy dossziéban él, amit sürgős esetben nehéz visszakeresni. A digitális váltás nem bonyolult, de van néhány jogi és gyakorlati buktató.',
    sections: [
      { title: 'A digitális aláírás jogilag is érvényes kell legyen', body: 'Nem minden "tableten aláírt" megoldás felel meg az egészségügyi adatkezelési előírásoknak — nézz utána, hogy az általad választott forma elegendő-e a te szakterületeden a jogszabályok szerint.' },
      { title: 'Az adatot biztonságosan, korlátozott hozzáféréssel kell tárolni', body: 'A beleegyező nyilatkozat egészségügyi adatot tartalmaz — a tárolásnak meg kell felelnie a GDPR és az egészségügyi adatvédelmi szabályoknak, ideértve, hogy csak az arra jogosult munkatársak férjenek hozzá.' },
      { title: 'Legyen visszakereshető páciensenként, ne csak dátum szerint', body: 'Sürgős helyzetben perceken belül elő kell tudni venni egy adott páciens aktuális nyilatkozatát — ha a rendszer csak dátum szerint rendezi a dokumentumokat, ez feleslegesen lassítja a munkát.' },
    ],
    closing: 'A davelopment booking önmagában nem helyettesíti a jogi tanácsadást a nyilatkozat tartalmában, de a páciensadatok és időpontok egy helyen, biztonságosan kezelhetők vele — így legalább a szervezési oldal nem okoz plusz fejfájást.',
    relatedIndustrySlugs: ['fogorvos-idopontfoglalas', 'maganrendelo-idopontfoglalas', 'csontkovacs-idopontfoglalas'],
  },
  {
    slug: 'asztalfoglalas-online-vs-telefonon',
    category: 'Vendégek',
    date: '2026. augusztus 1.',
    title: 'Asztalfoglalás online vs telefonon: mit veszítesz, ha csak telefonon lehet foglalni',
    excerpt: 'A telefonos foglalás kényelmesnek tűnik a tulajdonosnak — a vendégnek viszont gyakran ez az utolsó lökés, hogy inkább máshova menjen.',
    intro: 'Sok étterem még mindig kizárólag telefonon fogad foglalást — pedig a vendégek egyre nagyobb hányada eleve online keres asztalt, és ha nem találja, egyszerűen tovább görget a következő étteremhez.',
    sections: [
      { title: 'A telefonos foglalás csak nyitvatartási időben működik', body: 'Ha valaki este 11-kor dönt úgy, hogy pénteken asztalt akar foglalni nálad, a telefonos út azt jelenti, hogy másnapig várnia kell — közben lehet, hogy már le is foglalta a szomszéd éttermet.' },
      { title: 'A személyzet ideje asztalfoglalás-egyeztetéssel telik', body: 'Minden telefonhívás megszakítja a személyzet munkáját — csúcsidőben ez pont akkor történik, amikor a legkevésbé ráérnek. Az online foglalás ezt a terhet teljesen leveszi róluk.' },
      { title: 'Az online foglalásnál nincs félreértés az asztal méretében', body: 'Telefonon könnyen elsikkad egy részlet (hányan lesznek, kell-e gyerekülés, van-e allergia) — egy online űrlap ezeket eleve bekéri, így az asztal és a felkészülés is pontosan illeszkedik a vendéghez.' },
    ],
    closing: 'A davelopment bookingban a vendég percek alatt lefoglalja az asztalt bármikor, a rendszer pedig automatikusan figyeli a kapacitást asztalonként — a személyzetnek nem kell manuálisan egyeztetnie minden hívást.',
    relatedIndustrySlugs: ['etterem-asztalfoglalas', 'csapatkezeles-kisvallalkozasoknak'],
  },
  {
    slug: 'mikor-kell-jogosultsagkezeles-csapatnak',
    category: 'Csapat',
    date: '2026. augusztus 1.',
    title: 'Mikor van szükség jogosultságkezelésre a csapatodban',
    excerpt: 'Két fős csapatnál felesleges, öt fő fölött viszont hiánya biztonsági és szervezési kockázat.',
    intro: 'Amíg egyedül vagy páros vagy, mindenki lát és módosíthat mindent — ez rendben is van. De ahogy nő a csapat, egyre nagyobb a kockázata, hogy valaki (akár figyelmetlenségből) olyat módosít, amihez nem kellene hozzáférnie.',
    sections: [
      { title: 'Nézd meg, ki férhet hozzá az árazáshoz és a statisztikákhoz', body: 'Nem minden munkatársnak kell látnia a bevételi adatokat vagy módosíthatnia az árakat — ha a rendszer nem tesz különbséget, ez könnyen kínos helyzeteket szülhet, vagy akár hibás árazáshoz vezethet.' },
      { title: 'Legyen egyértelmű, ki törölhet foglalást', body: 'A foglalás-törlés visszafordíthatatlan döntés — ha bárki törölhet bárkinek a foglalását, egy elgépelés vagy félreértés komoly bevételkiesést okozhat. Ez egy tipikus eset, ahol a jogosultság-szűkítés véd, nem korlátoz.' },
      { title: 'Az audit-napló akkor válik fontossá, amikor már ketten-hárman módosítanak', body: 'Ha nem csak te nyúlsz a rendszerhez, előbb-utóbb felmerül a kérdés: ki módosított egy adott foglalást vagy árat. Enélkül ez csak találgatás marad.' },
    ],
    closing: 'A davelopment bookingban egyedi szerepeket hozhatsz létre testreszabott jogokkal (pl. csak-olvasás az árazáshoz, törlési jog nélkül) — a rendszer pedig minden módosítást naplóz, hogy visszakövethető legyen, ki mit csinált.',
    relatedIndustrySlugs: ['csapatkezeles-kisvallalkozasoknak', 'fodrasz-idopontfoglalas', 'etterem-asztalfoglalas'],
  },
  {
    slug: 'elolegkeres-foglalaskor-csokkenti-noshowt',
    category: 'Foglalások',
    date: '2026. augusztus 1.',
    title: 'Előleg kérése foglaláskor: hogyan csökkenti a no-show-t',
    excerpt: 'Ha a vendégnek van anyagi tétje a megjelenésnek, sokkal ritkábban marad el — a kérdés csak az, hogyan kérj előleget anélkül, hogy elriasztanád.',
    intro: 'Az előlegkérés az egyik leghatékonyabb, mégis kevesek által használt eszköz a no-show ellen — sok tulajdonos fél tőle, mert azt gondolja, elriasztja a vendéget. A gyakorlatban a jól bevezetett előleg inkább szűri a komolytalan foglalásokat.',
    sections: [
      { title: 'Ne minden foglalásnál kérj előleget, csak ahol indokolt', body: 'Hosszabb, drágább szolgáltatásoknál (pl. speciális kezelés, nagyobb csoportos asztalfoglalás) van igazán értelme — egy 15 perces időpontnál az előleg inkább felesleges súrlódás, mint védelem.' },
      { title: 'A kártyás előleg gyorsabb, mint a bankkártya-adatok utólagos bekérése', body: 'Ha a foglaláskor azonnal, a folyamat részeként kéred be az előleget, a vendég nem érzi külön lépésnek — utólag, egy külön emailben kérve viszont sokan egyszerűen nem reagálnak rá.' },
      { title: 'Legyen egyértelmű a lemondási szabály', body: 'Az előleg csak akkor működik bizalomvesztés nélkül, ha a vendég előre tudja, meddig mondhatja le ingyen, és mikor veszíti el az előleget — ezt írd ki egyértelműen a foglalás során.' },
    ],
    closing: 'A davelopment bookingban az előlegkérés szolgáltatásonként bekapcsolható, a kártyás fizetés pedig közvetlenül a foglalási folyamat része — a vendégnek nem kell külön lépést tennie, neked pedig nem kell utólag beszedned semmit.',
    relatedIndustrySlugs: ['kozmetikus-idopontfoglalas', 'etterem-asztalfoglalas', 'masszor-idopontfoglalas'],
  },
  {
    slug: 'naptar-szinkron-idopontfoglalohoz',
    category: 'Funkciók',
    date: '2026. augusztus 1.',
    title: 'Google/Apple naptár-szinkron időpontfoglalóhoz — miért számít, ha több helyszínen dolgozol',
    excerpt: 'Ha a saját és a munkahelyi naptárad külön él, előbb-utóbb ütközés lesz belőle — a szinkron ezt küszöböli ki automatikusan.',
    intro: 'Ha egy szakember több helyszínen dolgozik, vagy a foglalásai mellett saját magánprogramjai is vannak, könnyen előfordul, hogy két rendszerben él párhuzamosan a naptára — ez a fajta kettősség szinte garantáltan ütközéshez vezet előbb-utóbb.',
    sections: [
      { title: 'A foglalás azonnal megjelenjen a saját naptáradban is', body: 'Ha külön kell átmásolnod minden új foglalást a saját Google vagy Apple naptáradba, ez nemcsak időt vesz el, hanem hibalehetőség is — egy elfelejtett bejegyzés simán dupla foglaláshoz vezethet.' },
      { title: 'Ellenőrizd, hogy a szinkron valós idejű-e, nem csak napi frissítésű', body: 'Néhány rendszer csak naponta egyszer szinkronizál — ez azt jelenti, hogy egy aznap felvett foglalás csak másnap jelenik meg a másik naptáradban, ami éppen a legkritikusabb pillanatban hagy ki egy ütközést.' },
      { title: 'Egy szabványos naptár-feed bármelyik eszközön működik', body: 'Ha a rendszer egy szabványos (iCal/ICS) feedet ad, azt Google Calendarba, Apple Naptárba vagy szinte bármilyen más naptáralkalmazásba feliratkozhatsz — nem vagy egyetlen gyártóhoz kötve.' },
    ],
    closing: 'A davelopment booking automatikus naptár-feedet biztosít (iCal/ICS), amit Google Calendarba vagy Apple Naptárba feliratkozva a foglalásaid megjelennek a saját naptáradban — külön másolgatás nélkül.',
    relatedIndustrySlugs: ['maganrendelo-idopontfoglalas', 'szemelyi-edzo-idopontfoglalas', 'masszor-idopontfoglalas'],
  },
  {
    slug: 'audit-naplo-kisvallalkozasban',
    category: 'Biztonság',
    date: '2026. augusztus 1.',
    title: 'Audit-napló kisvállalkozásban: ki módosított mit, és miért fontos ezt tudni',
    excerpt: 'Nem a bizalmatlanságról szól — arról, hogy egy vitás helyzetben percek alatt kiderüljön, mi történt valójában.',
    intro: 'Amint egynél többen nyúlnak a rendszeredhez, előbb-utóbb felmerül egy kérdés: ki törölte azt a foglalást, ki módosította az árat. Az audit-napló nem a bizalmatlanság eszköze, hanem egy biztonsági háló, amit remélhetőleg sosem kell komolyan használnod — de ha mégis, percek alatt választ ad.',
    sections: [
      { title: 'Ne csak azt lásd, MI történt, hanem KI és MIKOR csinálta', body: 'Egy jó napló nem csak azt mutatja, hogy egy foglalás törölve lett, hanem azt is, melyik munkatárs törölte, és pontosan mikor — ez különbözteti meg a valódi audit-naplót egy egyszerű módosítás-időbélyegtől.' },
      { title: 'Legyen visszakereshető visszamenőleg, ne csak az elmúlt pár napra', body: 'Egy vitás helyzet gyakran csak hetekkel később derül ki — ha a napló csak pár napig őrzi az adatokat, éppen akkor nem lesz mit visszanézni, amikor a legjobban kellene.' },
      { title: 'Ne tegye lassabbá a napi munkát', body: 'Az audit-napló háttérben kell fusson, anélkül hogy bárkinek külön adminisztrációs terhet jelentene — ha valakinek külön be kell jegyeznie, mit csinált, azt előbb-utóbb el fogják hagyni.' },
    ],
    closing: 'A davelopment bookingban minden módosítás automatikusan, láthatóan naplózva van — ki, mit, mikor változtatott —, 90 napra visszamenőleg kereshető a Beállítások alatt, minden plusz adminisztráció nélkül.',
    relatedIndustrySlugs: ['csapatkezeles-kisvallalkozasoknak', 'fodrasz-idopontfoglalas', 'maganrendelo-idopontfoglalas'],
  },
  {
    slug: 'jelek-hogy-elavult-a-foglalasi-rendszered',
    category: 'Döntés',
    date: '2026. augusztus 1.',
    title: '5 jel, hogy elavult a foglalási rendszered',
    excerpt: 'Nem mindig egyértelmű, mikor kell váltani — ezek a jelek viszont szinte biztos mutatói annak, hogy ideje körülnézni.',
    intro: 'A legtöbben nem azért ragaszkodnak egy elavult rendszerhez, mert az jó, hanem mert a váltás ijesztőnek tűnik. Az alábbi jelek viszont elég egyértelmű mutatói annak, hogy a jelenlegi megoldás már inkább hátráltat, mint segít.',
    sections: [
      { title: 'Papíron vagy táblázatban vezeted a foglalásokat', body: 'Ha egy papírnaptár vagy Excel-tábla a "rendszered", minden új foglalás kézi munka — és egyetlen elgépelés vagy elveszett füzet komoly zavart okozhat. Ez az egyik legegyértelműbb jel, hogy ideje digitalizálni.' },
      { title: 'A vendégek csak telefonon vagy személyesen tudnak foglalni', body: 'Ha a vendégnek nyitvatartási időben kell hívnia ahhoz, hogy időpontot kapjon, elesel az esti és hétvégi döntésektől — ilyenkor sokan egyszerűen a következő, online is elérhető opciót választják.' },
      { title: 'Nem tudod fejből a legforgalmasabb napszakodat, és rendszeresen van dupla foglalásod', body: 'Ha ezekre nem tudsz azonnal válaszolni, az azt jelenti, hogy vakon vezeted a vállalkozásod — egy modern rendszer ezt automatikusan megmutatja, és az ütközéseket eleve kizárja.' },
    ],
    closing: 'Ha kettőnél többre ismersz magadra, valószínűleg többet veszítesz a régi rendszerrel, mint amennyibe egy váltás kerülne — a davelopment booking ingyen, kártya nélkül kipróbálható.',
    relatedIndustrySlugs: ['fodrasz-idopontfoglalas', 'etterem-asztalfoglalas', 'kozmetikus-idopontfoglalas'],
  },
  {
    slug: 'nav-kompatibilis-szamlazas-foglalasi-rendszerbol',
    category: 'Számlázás',
    date: '2026. augusztus 1.',
    title: 'NAV-kompatibilis számlázás foglalási rendszerből — amit tudnod kell',
    excerpt: 'A foglalás és a számlázás gyakran két külön rendszerben él — pedig összekötve rengeteg kézi munkát spórolhatsz meg.',
    intro: 'Sok vállalkozás a foglalást egy rendszerben, a számlázást egy másikban (vagy kézzel) vezeti — ez azt jelenti, hogy minden foglalás után külön át kell másolni az adatokat, ami nemcsak időigényes, hanem hibalehetőség is.',
    sections: [
      { title: 'Nézd meg, hogy a számlázás automatikusan, NAV-adatszolgáltatásra kész-e', body: 'A magyar szabályozás szerint a legtöbb számlát élesben, automatikusan jelenteni kell a NAV felé — ha a rendszered ezt nem intézi automatikusan, ez rajtad marad, számlánként külön adminisztrációval.' },
      { title: 'A foglalás adatai automatikusan kerüljenek át a számlára', body: 'Ha a vendég neve, a szolgáltatás és az ár már ott van a foglalásban, felesleges még egyszer begépelni a számlázáshoz — ez az egyik legegyszerűbben megspórolható lépés egy összekötött rendszerben.' },
      { title: 'Az előleg és a végösszeg számlázása külön kezelést igényel', body: 'Ha előleget kérsz a foglaláskor, arról külön előlegszámlát kell kiállítani, majd a végösszegről a végszámlát — ha ezt a rendszered nem automatizálja, két külön manuális lépés marad neked minden egyes foglalásnál.' },
    ],
    closing: 'A davelopment booking automatikusan, a foglalás adatai alapján állítja ki a NAV-kompatibilis számlát (előleg- és végszámlát egyaránt) — nincs külön adatbevitel, nincs elfelejtett számla.',
    relatedIndustrySlugs: ['maganrendelo-idopontfoglalas', 'joga-idopontfoglalas', 'csontkovacs-idopontfoglalas'],
  },
]

/** Élesben csak ezek a (már korábban is kint lévő) cikkek látszanak; a többi még nincs kész.
 *  Fejlesztés közben (npm run dev) mind látszik. Ha egy új cikk kész: a slugját ide. */
const PUBLISHED_TIP_SLUGS = new Set([
  'no-show-csokkentese',
  'mikor-eri-meg-online-foglalo',
  'csapat-beosztas-hatekonyan',
  'emlekeztetok-automatizalasa',
  'torzsvendegek-megtartasa',
  'hogyan-valassz-idopontfoglalo-rendszert',
  'mennyibe-kerul-idopontfoglalo-szoftver',
])

export const TIPS: Tip[] = RAW_TIPS
  .filter((t) => process.env.NODE_ENV === 'development' || PUBLISHED_TIP_SLUGS.has(t.slug))
  .map((t) => ({ ...t, image: TIP_IMAGES[t.slug] }))

export function getTip(slug: string): Tip | undefined {
  return TIPS.find((t) => t.slug === slug)
}
