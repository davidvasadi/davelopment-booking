import {
  Globe, LayoutTemplate, BellRing, CheckCheck, CalendarOff,
  IdCard, Ban, MapPinned, FileDown,
  HandCoins, Gift, ReceiptText, FolderOpen,
  Mail, Star, Building2, QrCode,
  CalendarClock, Users, ShieldCheck, BarChart3, Smartphone,
  Timer, UserSearch, WifiOff,
  type LucideIcon,
} from 'lucide-react'

/**
 * A landing „Funkciók” menüje és a /funkciok/<csoport> oldalak közös forrása. Csak valós, működő
 * funkció kerülhet ide. Egy csoport = egy oldal, a csoport funkciói az oldal szakaszai
 * (`/funkciok/penz#eloleg`). `ready` = elkészült-e már a csoport oldala; amíg nem, a menüpont a
 * főoldal funkció-szekciójára visz (ne legyen 404).
 */
export type FeatureGroupId = 'booking' | 'calendar' | 'guests' | 'money' | 'marketing' | 'team'

export type LandingFeature = {
  slug: string
  title: string
  desc: string
  icon: LucideIcon
  /** egy mondat a problémáról, amit a funkció megold (a funkció-oldal szakaszának elején) */
  pain: string
  /** 3 rövid pont a funkció-oldalon */
  points: [string, string, string]
  /** 2–3 mondatos magyarázat: hogyan működik a gyakorlatban */
  body?: string
  /** egy rövid, valószerű példa a használatra */
  example?: string
  /** a funkció-oldal fülén a gomb szövege (a regisztrációra visz) — funkcióhoz illő, hogy ne ismétlődjön a „Kipróbálom ingyen” */
  cta?: string
  /** a funkció képe (hero-diák, szakasz-kép) — public/landing/funkciok/<csoport>/<slug>.webp */
  image?: string
}

/** A csoport-oldal bővebb tartalma (eladás + SEO/AI-keresők). Csak valós, ellenőrzött állítás. */
export type FeatureGroupExtra = {
  /** „Miért fontos” bevezető (cím + 2–3 bekezdés) */
  intro: { title: string; paragraphs: string[] }
  /** ugyanaz a funkció két szemszögből */
  audience: { salon: string; restaurant: string }
  /** „Hogyan indul” — 3 lépés */
  steps: [string, string][]
  /** „Eddig vs. most” sorok */
  compare: [string, string][]
  /** GYIK (FAQPage strukturált adat is ebből) */
  faq: { q: string; a: string }[]
  /** belső linkek: élő tippek és iparági oldalak */
  related: { label: string; href: string }[]
}

export type FeatureGroup = {
  id: FeatureGroupId
  /** URL: /funkciok/<slug> */
  slug: string
  label: string
  tagline: string
  icon: LucideIcon
  /** a csoport-oldal SEO-címe és leírása */
  seoTitle: string
  seoDescription: string
  /** a csoport-oldal H1-je és alcíme */
  h1: string
  lead: string
  /** csoport-borító (public/…); amíg nincs, sötét helyettesítő kártya látszik */
  cover?: string
  /** a funkció-oldal hero képei (public/landing/funkciok/<slug>/…): fő 16:10, telefon álló, részlet 4:3 */
  heroImages?: { main?: string; phone?: string; detail?: string }
  ready?: boolean
  /** az oldal alji (selymes) CTA: a csoport problémájára szabott szöveg */
  cta?: { label: string; title: string; lead: string }
  /** a GYIK melletti CTA-kártya címe és szövege */
  faqCta?: { title: string; body: string }
  extra?: FeatureGroupExtra
  items: LandingFeature[]
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'booking',
    slug: 'foglalas',
    heroImages: { main: '/landing/funkciok/foglalas/attekintes-davelopment-booking.webp' },
    label: 'Foglalás',
    tagline: 'Saját weboldal foglalással — a vendég bármikor foglal, te csak jóváhagyod.',
    cta: { label: 'Foglalás', title: 'Ne vesszen el több foglalás a telefonnál.', lead: 'Saját foglalóoldal, amin a vendég akkor is foglal, amikor te dolgozol vagy már zártál — te csak jóváhagyod.' },
    faqCta: { title: 'Nézd meg a saját foglalóoldaladat.', body: 'Töltsd ki az oldalad, és foglalj magadnál egy próbaidőpontot — a legtöbb kérdésre ez válaszol.' },
    icon: Globe,
    seoTitle: 'Online foglalás saját weboldallal',
    seoDescription: 'Bemutatkozó weboldal online foglalással, élő szerkesztővel, emlékeztetőkkel és automatikus vagy kézi jóváhagyással — szakembereknek és éttermeknek.',
    h1: 'Saját weboldal, amin a vendég azonnal foglal',
    lead: 'Bemutatkozó oldal, online foglalás és emlékeztetők egy helyen — te pedig eldöntöd, hogy a foglalás magától megerősítődik, vagy te hagyod jóvá.',
    ready: true,
    extra: {
      intro: {
        title: 'Miért kell saját foglalóoldal?',
        paragraphs: [
          'A vendégek ma már nem akarnak telefonálni: este, zárás után, a kanapéról foglalnának, és ha nálad nem tudnak, egy kattintással máshol foglalnak. Egy saját foglalóoldal a nap 24 órájában veszi fel a foglalásokat helyetted, miközben te dolgozol.',
          'A legtöbb foglalórendszer csak egy űrlapot ad. A davelopment booking egy teljes bemutatkozó weboldalt: szolgáltatások, árak, csapat, értékelések és foglalás egy helyen — így külön weboldalra sincs szükséged. A kinézetét is te szabod meg, kódolás nélkül.',
          'A foglalás után sem marad magára a vendég: visszaigazolást és emlékeztetőt kap, te pedig eldöntöd, hogy a foglalás magától megerősítődik, vagy te hagyod jóvá.',
        ],
      },
      audience: {
        salon: 'Szalonnál, rendelőben, stúdióban a vendég szolgáltatást és szakembert választ, és csak azokat az időpontokat látja, amikor az adott szakember valóban ráér. A szolgáltatások hossza és a köztük lévő szünet alapján a rendszer magától számolja a szabad időpontokat, így nincs átfedés és nincs üresjárat.',
        restaurant: 'Étteremben a vendég létszámot, napot és időpontot választ, a rendszer pedig a termek és asztalok alapján dönti el, hol fér el a társaság. Megadhatja az alkalmat is — születésnap, évforduló, céges vacsora —, és a foglalási naptárban asztalonként látod az egész estét.',
      },
      steps: [
        ['Kitöltöd az oldalad', 'Borítókép, bemutatkozás, szolgáltatások vagy asztalok — az élő szerkesztőben.'],
        ['Beállítod a foglalás szabályait', 'Nyitvatartás, foglalási időköz, automatikus vagy kézi jóváhagyás.'],
        ['Megosztod a linket', 'Google Cégprofil, Instagram, Facebook, névjegy — és jönnek a foglalások.'],
      ],
      compare: [
        ['A telefon egész nap cseng', 'A vendég online foglal, éjjel-nappal'],
        ['Külön weboldal és külön foglalórendszer', 'Bemutatkozó oldal és foglalás egy helyen'],
        ['Füzetben vezetett időpontok, áthúzásokkal', 'Napi idővonal, áthúzható foglalásokkal'],
        ['A vendég elfelejti az időpontot', 'Automatikus visszaigazolás és emlékeztető'],
        ['Minden foglalást telefonon egyeztetsz', 'Automatikus vagy egy koppintásos jóváhagyás'],
      ],
      faq: [
        { q: 'Kell-e saját weboldal a foglalóoldalhoz?', a: 'Nem. A foglalóoldal maga egy teljes bemutatkozó oldal, saját linkkel. Ha már van weboldalad, oda is kiteheted a foglalás gombot vagy linket.' },
        { q: 'Milyen nyelveken érhető el a foglalóoldal?', a: 'Magyarul, angolul, németül, spanyolul, olaszul és franciául. Te választod ki, mely nyelvek legyenek bekapcsolva, és a szövegeidet nyelvenként is megadhatod.' },
        { q: 'Lefoglalhatja-e két vendég ugyanazt az időpontot?', a: 'Nem. A rendszer csak a valóban szabad időpontokat kínálja fel, és foglaláskor még egyszer ellenőrzi, hogy közben nem foglalta-e le valaki.' },
        { q: 'Hogyan működik a kézi jóváhagyás?', a: 'Ha kikapcsolod az automatikus megerősítést, az online foglalás jóváhagyásra vár. Értesítést kapsz, és egy koppintással elfogadod vagy elutasítod. A vendég mindkét esetben automatikusan e-mailt kap.' },
        { q: 'Kapnak-e emlékeztetőt a vendégek?', a: 'Igen. Foglaláskor visszaigazoló e-mailt kapnak, a foglalás előtt pedig emlékeztetőt — te állítod be, hány órával előtte. A levelek szövegét is testre szabhatod.' },
        { q: 'Lemondhatja-e a vendég a foglalását?', a: 'Igen, a visszaigazoló e-mailben kapott linkkel, egy kattintással. Az időpont ilyenkor azonnal felszabadul, te pedig értesítést kapsz.' },
        { q: 'Kérdezhetek-e valamit a vendégtől foglaláskor?', a: 'Igen. Saját kérdéseket adhatsz a foglaláshoz (pl. hajhossz, allergia, alkalom), és beállíthatod, melyik legyen kötelező.' },
        { q: 'Szükség van-e programozói tudásra a szerkesztéshez?', a: 'Nem. Az élő szerkesztőben úgy szerkeszted az oldalt, ahogy a vendég látja: rákattintasz, átírod, és mented.' },
      ],
      related: [
        { label: 'Mikor éri meg online foglalóra váltani?', href: '/tips/mikor-eri-meg-online-foglalo' },
        { label: 'Hogyan válassz időpontfoglaló rendszert?', href: '/tips/hogyan-valassz-idopontfoglalo-rendszert' },
        { label: 'Emlékeztetők automatizálása', href: '/tips/emlekeztetok-automatizalasa' },
        { label: 'Fodrászoknak', href: '/fodrasz-idopontfoglalas' },
        { label: 'Éttermeknek', href: '/etterem-asztalfoglalas' },
      ],
    },
    items: [
      {
        slug: 'elo-asztalallapot', title: 'Élő asztal-állapot és asztal-összetolás', icon: Timer,
        desc: 'Asztalonként látod, mennyi van még hátra — és nagy társaságnál asztalt tol össze.',
        pain: 'Péntek este tele a terem, a pultnál senki nem tudja, melyik asztal mikor szabadul, és hová fér le egy hatfős társaság.',
        points: ['Egy pillantással látod, melyik asztal szabadul hamarosan', 'Nem ültetsz le senkit foglalt asztalhoz', 'A foglalást áthúzod másik asztalhoz, a vendég automatikusan értesül'],
        body: 'Az élő terem-nézetben minden asztalon látod, szabad-e, ülnek-e rajta és meddig, vagy késik-e a vendég. Ha egy társaság nem fér el, a rendszer felajánlja az összetolható asztalokat.',
        cta: 'Nézd meg a termedet élőben',
        example: 'Szombat este beesik egy hatfős társaság. A pultos ránéz a teremre: a 4-es és az 5-ös asztal szabad, a rendszer összevonja őket, és a következő foglalás csak egy óra múlva jön — leülteti őket, telefon és találgatás nélkül.',
      },
      {
        slug: 'gyors-felvetel', title: 'Korábbi vendég kitöltése', icon: UserSearch,
        desc: 'A visszatérő vendéget a nevéből felismeri, és kitölti az adatait.',
        pain: 'Telefonon foglal a törzsvendég, te pedig közben a telefonszámát és az e-mailjét gépeled.',
        points: ['Gyorsabban végzel a telefonnal, kevesebbet gépelsz', 'Nem lesz egy vendégből két külön kártya', 'Azt is rögzíted, honnan jött a foglalás: online, telefon vagy beeső'],
        body: 'Telefonos foglalásnál elég elkezdeni gépelni a vendég nevét: a rendszer felajánlja a korábbi vendégeid közül, és egy kattintással kitölti az adatait.',
        cta: 'Vegyél fel foglalást pár mozdulattal',
        example: 'Csörög a telefon, Kovács Anna jövő keddre kér időpontot. Beírod, hogy „Kov”, rákattintasz a javaslatra, kiválasztod az időpontot — tíz másodperc, és a foglalás kész.',
      },
      {
        slug: 'offline-mod', title: 'Net nélkül is működik', icon: WifiOff,
        desc: 'Elment a net? Vázlatként rögzíted, és később véglegesíted.',
        pain: 'Akadozik a wifi a pultnál, a vendég pedig ott áll előtted és foglalni szeretne.',
        points: ['Akkor sem vész el foglalás, ha akadozik a wifi', 'Nem kell papírra írni, aztán utólag bepötyögni', 'Nem kell megvárnod, hogy visszajöjjön a net, a pultnál folyamatosan dolgozhatsz'],
        body: 'Ha elmegy az internet, a rendszer vázlat módba vált, és ugyanúgy veszed fel a foglalásokat. Amint visszajön a net, a rendszer rögtön jelzi, ha közben online valaki ugyanarra az időpontra foglalt, a többit pedig egy gombbal véglegesíted.',
        cta: 'Rögzíts foglalást net nélkül is',
        example: 'Délután két órára elmegy az internet a szalonban. A recepciós közben két telefonos foglalást rögzít vázlatként, és amikor visszajön a net, egy gombbal mindkettőt véglegesíti.',
      },
      {
        slug: 'bemutatkozo-weboldal', title: 'Saját bemutatkozó weboldal, élő szerkesztéssel', icon: LayoutTemplate,
        image: '/landing/funkciok/foglalas/elo-szerkeszto.webp',
        desc: 'Saját oldal foglalással, 6 nyelven, kész sablonokkal — nem kell nulláról fordítanod.',
        pain: 'Weboldal nélkül a vendég nem talál meg, egy külön weboldal viszont drága és lassan készül el.',
        points: ['Nem kell külön weboldalt csináltatnod', 'Saját rövid linket kapsz az Instagramra és a Google Cégprofilba', 'A külföldi vendég a saját nyelvén foglal, kész sablonokkal'],
        body: 'Teljes bemutatkozó weboldalt kapsz foglalással: szolgáltatások árakkal, csapat, nyitvatartás, térkép és értékelések. Rákattintasz egy szövegre, átírod, és azonnal látod az eredményt, hat nyelven.',
        cta: 'Készítsd el a foglalóoldalad',
        example: 'Este fél tizenegykor egy vendég az Instagramon rákattint a linkre, megnézi az árakat és a véleményeket, és lefoglalja a csütörtöki időpontot. Reggel már ott van a naptárban, telefonálás nélkül.',
      },
      {
        slug: 'emlekeztetok', title: 'Emlékeztetők és értesítések', icon: BellRing,
        desc: 'E-mail és push — kevesebb elmaradó vendég.',
        pain: 'A vendég elfelejti az időpontot, a helye pedig üresen marad.',
        points: ['Kevesebb vendég felejti el az időpontját', 'Ha mégsem jön, időben lemondja, és a hely felszabadul', 'Nem kell egyesével felhívnod senkit'],
        body: 'A vendég foglaláskor visszaigazolást, előtte pedig automatikus emlékeztetőt kap, benne a lemondás linkjével. Te minden új foglalásról és lemondásról azonnal értesülsz.',
        cta: 'Kapcsold be az emlékeztetőket',
        example: 'A vendég 24 órával a foglalás előtt emlékeztetőt kap. Rájön, hogy nem ér rá, és a levélben lévő linkkel lemondja — a hely felszabadul, és másnap reggel már más foglalja le.',
      },
      {
        slug: 'jovahagyas', title: 'Automatikus vagy kézi jóváhagyás', icon: CheckCheck,
        image: '/landing/funkciok/foglalas/jovahagyas.webp',
        desc: 'Elfogadás egy koppintással, az értesítésből.',
        pain: 'Van, akit azonnal fogadnál, és van, akit előbb megnéznél.',
        points: ['Te szabod meg, kit és mikor fogadsz', 'Elutasításkor a vendég udvarias e-mailt kap, hogy válasszon másik időpontot', 'Nem kell külön üzenetet írnod, a vendég minden esetben értesül'],
        body: 'Te döntöd el, hogy a foglalások maguktól megerősítődnek, vagy mindegyiket te hagyod jóvá. Jóváhagyásnál az értesítésből egy koppintással elfogadod vagy elutasítod.',
        cta: 'Állítsd be, hogyan foglalnak',
        example: 'Egy magánrendelő minden új vendéget előbb átnéz. Az értesítésben látja, ki és mire foglalt, egy koppintással elfogadja, a vendég pedig azonnal megkapja a visszaigazolást.',
      },
    ],
  },
  {
    id: 'calendar',
    slug: 'naptar',
    label: 'Naptár',
    tagline: 'Beosztás, munkaidő és bér — a csapatod teljes adminisztrációja.',
    cta: { label: 'Naptár', title: 'Nincs több beosztás Excelben.', lead: 'Beosztás, szabadság, ledolgozott órák, bér és borravaló egy naptárban — a hónap végén nem kell utólag összeszámolni.' },
    faqCta: { title: 'Rakd össze a jövő heti beosztást.', body: 'Vedd fel a csapatot, és próbáld ki a beosztást és a szabadságkezelést a saját heteden.' },
    icon: CalendarClock,
    seoTitle: 'Beosztás-naptár, munkaidő-nyilvántartás és bérszámítás',
    seoDescription: 'Beosztás-naptár műszakokkal és fedetlen napokkal, szabadság- és hiányzás-nyilvántartás, ledolgozott órák, valamint automatikus bér- és borravaló-számítás.',
    h1: 'A csapatod teljes adminisztrációja egy naptárban',
    lead: 'Ki dolgozik, ki hiányzik, hány órát dolgozott és mennyi bér jár neki — mind egy helyen, táblázatok és papírok nélkül.',
    ready: true,
    extra: {
      intro: {
        title: 'Miért kell a csapatnak is naptár?',
        paragraphs: [
          'Egy csapat igazgatása a foglalásokon túl rengeteg apró feladat: ki mikor dolgozik, ki van szabadságon, ki beteg, ki hány órát dolgozott, és mennyi bér meg borravaló jár neki. Ha ez papíron, csoportchatben és táblázatokban van, sok idő megy el rá, és könnyű hibázni.',
          'A davelopment booking naptára ezt az egészet egy helyre hozza. A beosztásból és a hiányzásokból magától összeáll a ledolgozott idő, abból pedig a bér — így hónap végén nem számolsz, csak ellenőrzöl.',
          'A munkatársak a saját beosztásukat és összesítésüket a telefonjukon látják, így kevesebb a kérdés, a félreértés és a vita.',
          'Mindez ugyanabban a rendszerben van, mint a foglalások: ha egy szakember szabadságra megy, a vendégek nem tudnak hozzá foglalni, ha egy napra eltérő nyitvatartást állítasz be, a foglalóoldal is ehhez igazodik. Nem kell két helyen vezetned ugyanazt.',
        ],
      },
      audience: {
        salon: 'Szalonnál minden szakembernek saját naptára és saját nyitvatartása van: a szabadsága vagy a betegsége automatikusan lezárja a foglalható időpontjait, így a vendég nem tud olyan napra foglalni hozzá, amikor nincs bent. A ledolgozott órákból és a szolgáltatásokból egy pillantással látod, ki mennyit dolgozott.',
        restaurant: 'Étteremben a beosztás a műszakokról szól: ki dolgozik a pultban, a konyhában, a teremben, és melyik napon kevés az ember. A napi borravaló automatikusan elosztódik az aznap dolgozók között, a bér pedig napidíj vagy órabér alapján számolódik.',
      },
      steps: [
        ['Felveszed a munkatársakat', 'Profil, pozíció, napidíj vagy órabér — és meghívod őket.'],
        ['Beosztod a műszakokat', 'Hónap vagy hét szerint; a fedetlen napok azonnal látszanak.'],
        ['Rögzíted a hiányzásokat', 'Szabadság, betegség, korai távozás — a bér magától számolódik.'],
      ],
      compare: [
        ['Beosztás papíron vagy csoportchatben', 'Beosztás-naptár, amit mindenki a telefonján lát'],
        ['Hónap végén kézzel számolt órák', 'Ledolgozott napok és órák automatikusan összesítve'],
        ['Bér és borravaló táblázatban', 'Bér napidíj vagy órabér alapján, borravaló automatikusan elosztva'],
        ['Szabadságot füzetben vezetsz', 'Szabadság, betegség és korai távozás munkatársanként rögzítve'],
        ['Ünnepnapon is jönnek a foglalások', 'Eltérő nyitvatartás, ilyenkor a vendég nem foglalhat'],
      ],
      faq: [
        { q: 'Látják-e a munkatársak a saját beosztásukat?', a: 'Igen. Mindenki saját belépéssel a telefonján is látja a beosztását, és értesítést kap, ha változik.' },
        { q: 'Hogyan számolja a rendszer a bért?', a: 'Munkatársanként beállítod, hogy napidíjat vagy órabért kap. A rendszer a ledolgozott napok vagy órák és a fizetett szabadság alapján kiszámolja a járó bért.' },
        { q: 'Hogyan oszlik el a borravaló?', a: 'A napi borravalót egy összegként adod meg, és az automatikusan elosztódik az aznap dolgozó munkatársak között. Mindenki látja a saját részét.' },
        { q: 'Mi történik a foglalásokkal, ha egy szakember szabadságon van?', a: 'Szalonnál a szabadság vagy a betegszabadság lezárja az adott szakember foglalható időpontjait, így a vendég nem tud hozzá foglalni.' },
        { q: 'Beállíthatok-e eltérő nyitvatartást ünnepnapra?', a: 'Igen. Egy-egy napra vagy időszakra eltérő nyitvatartást vagy zárva tartást adhatsz meg, és ilyenkor a vendégek nem tudnak foglalni.' },
        { q: 'Látom-e, melyik napon nincs elég ember?', a: 'Igen. A beosztás-naptár kiemeli a fedetlen napokat, és szűrhetsz is rájuk, így még időben be tudsz osztani valakit.' },
        { q: 'Rögzíthető-e a korai távozás?', a: 'Igen. A munkatárs napjánál jelölheted a korai távozást, és ez a ledolgozott idő összesítésében is megjelenik.' },
        { q: 'Kiválthatja-e ez a bérszámfejtést?', a: 'Nem helyettesíti a könyvelőt, de előkészíti neki a számokat: ki hány napot és órát dolgozott, mennyi szabadságot vett ki, és mennyi bér meg borravaló jár neki.' },
        { q: 'Kell-e hozzá külön bérszámfejtő program?', a: 'Nem kötelező. A rendszer kiszámolja a ledolgozott időt és a járó bért, a hivatalos bérszámfejtést pedig a könyvelőd ezek alapján elvégzi.' },
      ],
      related: [
        { label: 'Csapatbeosztás hatékonyan', href: '/tips/csapat-beosztas-hatekonyan' },
        { label: 'Csapatkezelés kisvállalkozásoknak', href: '/csapatkezeles-kisvallalkozasoknak' },
        { label: 'Éttermeknek', href: '/etterem-asztalfoglalas' },
      ],
    },
    items: [
      {
        slug: 'beosztas', title: 'Beosztás-naptár', icon: CalendarClock,
        image: '/landing/funkciok/naptar/beosztas.webp',
        desc: 'Műszakok és fedetlen napok egy nézetben.',
        pain: 'Nem látszik előre, melyik napon nincs elég ember.',
        points: ['Időben kiderül, melyik napra nincs elég ember', 'Nem kell csoportba írni vagy papírt kitenni', 'Ha változik a beosztás, a munkatárs értesítést kap'],
        body: 'A beosztás-naptárban hétre vagy hónapra látod, ki mikor dolgozik, és egy kattintással osztasz be műszakot. A munkatárs a saját beosztását a telefonján látja.',
        cta: 'Készítsd el a heti beosztást',
        example: 'Egy étteremvezető péntek délután látja, hogy a jövő szombat este fedetlen. Beoszt még egy pincért, aki a telefonján azonnal értesítést kap a műszakról.',
      },
      {
        slug: 'szabadsag', title: 'Szabadság és hiányzás', icon: CalendarOff,
        image: '/landing/funkciok/naptar/szabadsag.webp',
        desc: 'Szabadság, betegség, korai távozás nyomon követve.',
        pain: 'Év végén senki sem tudja pontosan, ki mennyi szabadságot vett ki és hányszor hiányzott.',
        points: ['Látod, kinek mennyi szabadsága maradt az évből', 'A vendég nem foglal olyan időre, amikor zárva vagy', 'Nem kell utólag lemondanod senkit'],
        body: 'Minden munkatársnál rögzíted a szabadságot, a betegszabadságot és a szabadnapot, akár több napra egyszerre. Ünnepnapra vagy rövidített napra eltérő nyitvatartást állíthatsz be.',
        cta: 'Rögzítsd a szabadságokat',
        example: 'Egy fodrász két hét szabadságot rögzít augusztusra. Arra az időre a vendégek nem tudnak hozzá foglalni, a szabadság pedig a havi összesítésben is megjelenik.',
      },
      {
        slug: 'munkaido', title: 'Ledolgozott órák', icon: BarChart3,
        image: '/landing/funkciok/naptar/munkaido.webp',
        desc: 'Napok, órák és hiányzások havonta összesítve.',
        pain: 'A ledolgozott órákat hónap végén kézzel számolod össze.',
        points: ['Hónap végén nem kell táblázatból számolni', 'Egy pillantásra látod a hiányzást és a szabadságot', 'Összevetheted az előző hónappal'],
        body: 'A rendszer a beosztásból és a hiányzásokból magától összesíti, ki hány napot és órát dolgozott a hónapban.',
        cta: 'Nézd meg a ledolgozott órákat',
        example: 'Hónap végén az üzletvezető megnyitja az összesítést: ki hány napot és órát dolgozott, ki hányszor hiányzott — és egy kattintással továbbküldi a számokat a könyvelőnek.',
      },
      {
        slug: 'berezes', title: 'Bér és borravaló', icon: HandCoins,
        desc: 'Napidíj vagy órabér alapján, automatikusan.',
        pain: 'A bért és a borravalót táblázatban, kézzel számolod — és mindig kérdés, kinek mennyi jár.',
        points: ['Nem kell kézzel számolni a fizetést', 'A borravaló igazságosan oszlik el', 'Mindenki látja a saját összesítését, kevesebb a kérdés'],
        body: 'Munkatársanként beállítod a napidíjat vagy az órabért, a rendszer pedig a ledolgozott idő alapján kiszámolja a bért. A napi borravaló automatikusan elosztódik az aznap dolgozók között.',
        cta: 'Számold ki a béreket',
        example: 'Egy pincér órabérben dolgozik, a hónapban 142 órát. A rendszer kiszámolja a bérét, és hozzáadja az aznapi borravalókból rá eső részt — ő pedig a telefonján látja a saját összesítését.',
      },
    ],
  },
  {
    id: 'guests',
    slug: 'vendegek',
    label: 'Vendégek',
    tagline: 'Minden vendéged története egy helyen.',
    cta: { label: 'Vendégek', title: 'Ismerd meg minden vendéged.', lead: 'Minden foglalás, megjegyzés és elmaradás egy vendégkártyán — a törzsvendéget felismered, a problémás foglalót kiszűröd.' },
    faqCta: { title: 'Nézd meg a saját vendéglistádat.', body: 'A foglalásokból magától épül — pár nap után látod, kik a visszatérő vendégeid.' },
    icon: IdCard,
    seoTitle: 'Vendégnyilvántartás és vendégkártya',
    seoDescription: 'Vendégkártya előzményekkel, feketelista, vendég-térkép és CSV-export — minden vendégadat egy helyen, GDPR-barát módon.',
    h1: 'Ismerd meg a vendégeidet',
    lead: 'Minden vendég előzménye, megjegyzései és látogatásai egy helyen — és azok is, akik rendszeresen nem jönnek el.',
    ready: true,
    extra: {
      intro: {
        title: 'Miért érdemes ismerni a vendégeidet?',
        paragraphs: [
          'Új vendéget szerezni sokszor többe kerül, mint egy meglévőt visszahozni. Ha tudod, ki jár hozzád rendszeresen, mit szeret, mikor járt utoljára, és ki az, aki rendszeresen nem jön el, sokkal jobb döntéseket hozol.',
          'A davelopment bookingban a vendégkártyák maguktól épülnek a foglalásokból — nem kell külön adatbázist vezetned. Minden látogatás, lemondás és költés automatikusan rákerül.',
          'Az adatok a tieid: bármikor exportálhatod őket, és a vendégek csak akkor kapnak tőled hírlevelet, ha feliratkoztak.',
          'Mindez a vendégek beleegyezésével és biztonságosan történik: a vendég maga dönti el, kér-e hírlevelet, az adatai csak a te üzleted számára láthatók, és kérésére törölhetők. Így a vendégkör ismerete nem jár kockázattal.',
        ],
      },
      audience: {
        salon: 'Szalonnál a vendégkártyán látod a korábbi kezeléseket, a kedvenc szakembert és a saját megjegyzéseidet (pl. hajfesték receptje, bőrtípus, allergia). Így a vendég minden alkalommal azt érzi, hogy emlékeznek rá — ez a törzsvendégek titka.',
        restaurant: 'Étteremben a vendégkártyán látod, hányszor járt nálad és mennyit költött, a megjegyzésben pedig azt, amit tudni érdemes róla (pl. allergia, kedvenc asztal, gyakori alkalom). A nagy társasággal rendszeresen el nem jövő vendéget feketelistára teheted.',
      },
      steps: [
        ['Jönnek a foglalások', 'A vendégkártyák maguktól létrejönnek.'],
        ['Kiegészíted, amit tudsz', 'Megjegyzés, születésnap, csoport — vagy tiltólista, ha kell.'],
        ['Használod az adatokat', 'Keresés, térkép, export és hírlevél a feliratkozottaknak.'],
      ],
      compare: [
        ['Nem emlékszel, mit kért a vendég legutóbb', 'Minden foglalás és megjegyzés a vendégkártyán'],
        ['Ugyanaz a vendég többször, más-más néven', 'A rendszer foglaláskor felajánlja a meglévő vendéget'],
        ['A visszatérő no-show vendég újra foglal', 'Feketelista, a tiltott vendég nem foglalhat online'],
        ['Nem tudod, honnan jönnek a vendégeid', 'Vendég-térkép településenként'],
        ['Az adataid nem vihetők ki a rendszerből', 'Export CSV-be egy kattintással'],
      ],
      faq: [
        { q: 'Mi kerül a vendégkártyára?', a: 'Az elérhetőségek, a születésnap, a látogatások és lemondások száma, az el nem jött alkalmak, az összes költés és a saját megjegyzéseid. A kártya a foglalásokból magától épül.' },
        { q: 'Hogyan működik a feketelista?', a: 'A vendéget egy kattintással tiltólistára teszed, indoklással. Ezután e-mail-cím és telefonszám alapján sem tud online foglalni, és egy általános üzenetet lát.' },
        { q: 'Megtudja-e a vendég, hogy tiltólistán van?', a: 'Nem. A rendszer egy általános hibaüzenetet mutat neki, a tiltást nem árulja el.' },
        { q: 'Honnan tudja a térkép, honnan jönnek a vendégek?', a: 'A vendégek által foglaláskor megadott településből. Külön helyadatot nem gyűjtünk.' },
        { q: 'Kivihetem-e a vendéglistát a rendszerből?', a: 'Igen. A vendéglistát, a foglalásokat és a munkatársakat CSV-fájlba exportálhatod, amely Excelben és Google Táblázatban is megnyílik.' },
        { q: 'Importálhatom-e a meglévő vendéglistámat?', a: 'Igen, táblázatból. Importáláskor a rendszer nem küld a vendégeknek semmilyen e-mailt vagy értesítést.' },
        { q: 'Kaphat-e minden vendég hírlevelet?', a: 'Nem, csak az, aki foglaláskor feliratkozott. Minden levélben ott a leiratkozás lehetősége.' },
        { q: 'Kerülhetnek-e duplán a vendégek a listába?', a: 'A rendszer foglaláskor név, e-mail és telefonszám alapján felajánlja a meglévő vendéget, így a duplikátumok nagy része meg sem születik.' },
        { q: 'Hol tárolódnak a vendégek adatai?', a: 'A rendszerben, titkosított kapcsolaton keresztül, és csak a te üzleted fér hozzájuk. A vendég kérésére az adatai törölhetők.' },
        { q: 'Látom-e, ki mondta le a legtöbbször?', a: 'Igen. A vendégkártyán a lemondások és az el nem jött alkalmak száma is látszik, így a problémás vendégek könnyen kiszűrhetők.' },
      ],
      related: [
        { label: 'Hogyan tartsd meg a törzsvendégeidet', href: '/tips/torzsvendegek-megtartasa' },
        { label: 'Elmaradó vendégek csökkentése', href: '/tips/no-show-csokkentese' },
        { label: 'Kozmetikusoknak', href: '/kozmetikus-idopontfoglalas' },
      ],
    },
    items: [
      {
        slug: 'vendegkartya', title: 'Vendégkártya', icon: IdCard,
        image: '/landing/funkciok/vendegek/vendegkartya.webp',
        desc: 'Előzmények, megjegyzések, látogatások.',
        pain: 'Nem emlékszel, mit kért a vendég legutóbb, és hányszor járt már nálad.',
        points: ['Minden vendégről tudod, mit szeret és hányszor járt nálad', 'A törzsvendégeket egy pillantással felismered', 'Nem jönnek létre duplikált vendégek'],
        body: 'Minden vendégnek saját kártyája van, amely magától épül a foglalásokból: elérhetőség, látogatások, lemondások és költés. Saját megjegyzést is írhatsz hozzá, például allergiát vagy kedvenc szakembert.',
        cta: 'Ismerd meg a vendégeidet',
        example: 'A vendég felhív, hogy jönne a szokásos kezelésre. Beírod a nevét, és rögtön látod, hogy legutóbb mit kért, ki volt a szakembere, és hogy allergiás egy anyagra.',
      },
      {
        slug: 'feketelista', title: 'Feketelista', icon: Ban,
        image: '/landing/funkciok/vendegek/feketelista.webp',
        desc: 'Aki rendszeresen nem jön el, nem foglalhat újra.',
        pain: 'Ugyanaz a vendég újra és újra lefoglal, aztán nem jön el.',
        points: ['Nem foglal le újra feleslegesen egy időpontot', 'A vendég nem tudja meg, hogy le van tiltva, csak egy általános üzenetet lát', 'A tiltást bármikor feloldhatod'],
        body: 'Ha egy vendég rendszeresen nem jön el, egy kattintással tiltólistára teszed, indoklással. A rendszer e-mail-cím és telefonszám alapján is felismeri, és nem engedi online foglalni.',
        cta: 'Védd meg az időpontjaidat',
        example: 'Egy vendég harmadszor foglal 6 főre, és harmadszor sem jön el. Tiltólistára kerül, és a következő online foglalási kísérletnél egy általános üzenetet lát.',
      },
      {
        slug: 'vendeg-terkep', title: 'Vendég-térkép', icon: MapPinned,
        image: '/landing/funkciok/vendegek/vendeg-terkep.webp',
        desc: 'Lásd, honnan érkeznek a vendégeid.',
        pain: 'Nem tudod, melyik környékre érdemes hirdetni.',
        points: ['Tudod, hol érdemes hirdetni vagy szórólapozni', 'Kiderül, mennyire vagy helyi kedvenc', 'Nem kell semmit külön beállítanod'],
        body: 'A vendég-térkép megmutatja, mely településekről érkeznek a vendégeid, és honnan jön a legtöbb. A vendégek által megadott településből készül, külön adatgyűjtés nélkül.',
        cta: 'Nézd meg, honnan jönnek a vendégeid',
        example: 'Egy pilates stúdió a térképen látja, hogy a vendégek negyede a szomszéd kerületből jön. A következő szórólapos kampányt oda célozza.',
      },
      {
        slug: 'export', title: 'Export', icon: FileDown,
        desc: 'Foglalások és vendégek egy kattintással, CSV-ben.',
        pain: 'Az adataid be vannak zárva a rendszerbe, nem tudod könyvelőnek vagy táblázatba átadni.',
        points: ['Gyorsan átadhatod a könyvelőnek', 'Saját kimutatást készíthetsz belőle', 'Az adataid a tieid, nem vagy bezárva a rendszerbe'],
        body: 'A foglalásokat, a vendéglistát és a munkatársakat egy kattintással letöltöd CSV-ben, ami Excelben és Google Táblázatban is megnyílik.',
        cta: 'Töltsd le az adataidat',
        example: 'Év végén a könyvelő kéri a foglalások listáját. Egy kattintással letöltöd CSV-ben, és Excelben már szűrheti is.',
      },
    ],
  },
  {
    id: 'money',
    slug: 'penz',
    label: 'Pénz',
    tagline: 'Előleg, utalvány és számla — magától.',
    cta: { label: 'Pénz', title: 'Ne fizess rá az elmaradt foglalásokra.', lead: 'Kártyás előleg, online ajándékutalvány és automatikus számla — a pénz egyenesen a te fiókodba érkezik.' },
    faqCta: { title: 'Kérj előleget a következő foglalásnál.', body: 'Kapcsold be az előleget, és nézd meg, hogyan fizet a vendég foglaláskor.' },
    icon: HandCoins,
    seoTitle: 'Előleg, ajándékutalvány és automatikus számla',
    seoDescription: 'Kártyás előleg automatikus visszatérítéssel, online ajándékutalvány QR-kóddal és automatikus Számlázz.hu vagy Billingo számla — közvetlenül a saját Stripe-fiókodba.',
    h1: 'Előleg, utalvány és számla — automatikusan',
    lead: 'A vendég kártyával fizet előleget vagy ajándékutalványt, a számla magától elkészül, a pénz pedig egyenesen a te fiókodba érkezik.',
    ready: true,
    extra: {
      intro: {
        title: 'Miért fontos, hogy a pénz is a foglalóban legyen?',
        paragraphs: [
          'Egy szolgáltató vállalkozásnál a legnagyobb rejtett veszteség az el nem jött vendég: lefoglalja az időpontot vagy az asztalt, más már nem kaphatja meg, és a bevétel elmarad. Az előleg ezt a kockázatot a vendéghez teszi át — aki fizetett, sokkal nagyobb eséllyel meg is érkezik, aki pedig mégsem tud jönni, időben lemondja.',
          'A második nagy időrabló az adminisztráció: átutalások ellenőrzése, papír-utalványok vezetése, számlák kézi kiállítása. Ha a fizetés, az utalvány és a számla egy rendszerben fut, ezek a lépések maguktól történnek meg, és mindenről pontos nyilvántartásod van.',
          'Fontos, hogy a pénz végig a tiéd marad: a vendég fizetése a saját Stripe-fiókodba érkezik, a számla a saját számlázódból készül, mi pedig semmilyen jutalékot nem vonunk le.',
        ],
      },
      audience: {
        salon: 'Fodrásznál, kozmetikusnál, masszőrnél egy elmaradt időpont egy elveszett óra, amit már nem tudsz eladni. A fix vagy százalékos előleg miatt a vendég komolyabban veszi a foglalást, a hosszú, drága kezeléseknél pedig különösen sokat számít. Az ajándékutalvány karácsony, Valentin-nap vagy anyák napja előtt plusz bevételt hoz, és új vendégeket is behoz — a megajándékozott gyakran visszatérő vendég lesz.',
        restaurant: 'Étteremben egy 8 fős asztal, ami nem jön el, egy egész estét ronthat el — a beszerzett alapanyag és a beosztott személyzet már ott van. A fejenkénti előleg nagyobb társaságnál, ünnepnapokon, szilveszterkor és rendezvényeken véd. Az ajándékutalványt vacsorára vagy egy konkrét menüre is kiadhatod, céges ajándékként pedig adószámos számlával együtt.',
      },
      steps: [
        ['Összekötöd a Stripe-fiókodat', 'Pár perc az egész, és a vendégek pénze ezután egyenesen hozzád érkezik.'],
        ['Beállítod az előleget és az utalványokat', 'Összeg, visszatérítési határidő, utalvány-típusok és érvényesség.'],
        ['Bekötöd a számlázót (nem kötelező)', 'Számlázz.hu vagy Billingo — innentől a számla magától elkészül.'],
      ],
      compare: [
        ['A vendég nem jön el, a kiesett bevétel a tiéd', 'Az előleg nálad marad, ha későn mond le vagy nem jön el'],
        ['Előleget átutalással kérsz, és ellenőrzöd, megjött-e', 'A vendég foglaláskor kártyával fizet, azonnal'],
        ['Visszatérítést kézzel indítasz', 'Időben lemondott foglalásnál az előleg magától visszajár'],
        ['Papír-utalvány, füzetben vezetve', 'Online utalvány QR-kóddal, a beváltás nyomon követve'],
        ['Minden fizetésről kézzel állítasz ki számlát', 'A számla magától elkészül, és a vendég e-mailben megkapja'],
      ],
      faq: [
        { q: 'Mi történik az előleggel, ha a vendég lemondja a foglalást?', a: 'Ha a beállított határidő előtt mond le (alapból 24 órával a foglalás előtt), az előleg automatikusan visszamegy a kártyájára. Ha később mond le vagy nem jön el, az előleg nálad marad.' },
        { q: 'Hova érkezik a vendég által fizetett pénz?', a: 'Egyenesen a saját Stripe-fiókodba. A davelopment booking nem kezeli a pénzedet és nem von le belőle jutalékot — csak a Stripe szokásos tranzakciós díja érvényes.' },
        { q: 'Kell-e saját Számlázz.hu vagy Billingo fiók?', a: 'Az automatikus számlához igen: a számla a te számlázódból, a te nevedre készül. Az előleg és az ajándékutalvány számlázó nélkül is működik — ilyenkor a számlát te állítod ki.' },
        { q: 'Kérhetek-e előleget csak bizonyos foglalásokra?', a: 'Az előleg-szabály az egész üzletre vonatkozik: fix összeg, a szolgáltatás árának százaléka, vagy étteremben fejenkénti díj. A bekapcsolásához ki kell tölteni a foglalási feltételeket, hogy a vendég lássa a visszatérítés szabályait.' },
        { q: 'Meddig érvényes az ajándékutalvány?', a: 'Te állítod be: 3, 6, 12 vagy 24 hónap, vagy egyedi időtartam. A lejárat az utalványon és a kezelőfelületen is látszik.' },
        { q: 'Milyen díjjal jár a kártyás fizetés?', a: 'Csak a Stripe szokásos tranzakciós díja érvényes, amit a Stripe von le a fizetésből. A davelopment booking nem számol fel jutalékot a vendégek fizetései után.' },
        { q: 'Látom, melyik előlegről készült már számla?', a: 'Igen. A kiállított számlák listájában típus és állapot szerint szűrhetsz, és minden számlánál látszik, melyik fizetéshez tartozik. Számlázz.hu-nál a PDF egy kattintással megnyílik.' },
        { q: 'Kiállíthatok ajándékutalványt helyben, a pultnál is?', a: 'Igen. Küldhetsz fizetési linket a vásárlónak, vagy rögzítheted, hogy már kifizette (készpénzzel vagy terminálon). A vásárló ugyanúgy e-mailben kapja meg az utalványt QR-kóddal.' },
      ],
      related: [
        { label: 'Hogyan csökkentsd az elmaradó vendégek számát', href: '/tips/no-show-csokkentese' },
        { label: 'Mennyibe kerül egy időpontfoglaló szoftver?', href: '/tips/mennyibe-kerul-idopontfoglalo-szoftver' },
        { label: 'Fodrászoknak', href: '/fodrasz-idopontfoglalas' },
        { label: 'Éttermeknek', href: '/etterem-asztalfoglalas' },
      ],
    },
    items: [
      {
        slug: 'eloleg', title: 'Előleg', icon: HandCoins,
        desc: 'Kártyás előleg, automatikus visszatérítéssel.',
        pain: 'Lefoglalják az időpontot, aztán nem jönnek el — és a kiesett bevételt te fizeted meg.',
        points: ['Kevesebb vendég marad el szó nélkül', 'Ha mégis elmarad, az előleg kompenzálja a kiesést', 'A pénz egyenesen a te Stripe-fiókodba érkezik'],
        body: 'Fix összeget, százalékot vagy étteremben fejenkénti díjat kérhetsz előlegként, amit a vendég foglaláskor kártyával fizet. Időben lemondott foglalásnál magától visszajár.',
        cta: 'Kérj előleget foglaláskor',
        example: 'Egy masszázsszalon 30%-os előleget kér a 90 perces kezelésekre. A vendég két nappal előtte lemondja — az előleg magától visszamegy a kártyájára, a szalonnak nincs teendője.',
      },
      {
        slug: 'ajandekutalvany', title: 'Ajándékutalvány', icon: Gift,
        image: '/landing/funkciok/penz/ajandekutalvany.webp',
        desc: 'Online vásárlás, QR-kódos beváltás.',
        pain: 'Az ajándékutalványt papíron állítod ki, és nehéz követni, mi lett beváltva.',
        points: ['Plusz bevétel akkor is, amikor épp nincs foglalás', 'Beváltáskor a QR-kód beolvasása után azonnal látod, érvényes-e', 'Minden utalvány lejárata és állapota egy helyen'],
        body: 'A vendég a foglalóoldaladon kártyával vesz ajándékutalványt, és e-mailben kapja meg saját kóddal és QR-kóddal. Helyben is kiállíthatsz utalványt, fizetési linkkel vagy készpénzes fizetéssel.',
        cta: 'Árulj ajándékutalványt online',
        example: 'December közepén egy vendég online vesz egy 20 000 Ft-os utalványt az édesanyjának. Mindketten megkapják e-mailben, januárban pedig a pultnál egy QR-kód beolvasásával beváltják.',
      },
      {
        slug: 'automatikus-szamla', title: 'Automatikus számla', icon: ReceiptText,
        desc: 'Számlázz.hu vagy Billingo, magától kiállítva.',
        pain: 'Minden előlegről és utalványról kézzel kell számlát kiállítani.',
        points: ['Nem kell egyesével számlát kiállítanod', 'Cégként vásárló vendég adószámos számlát kap', 'Ha a kapcsolat hibás, a beállításokban azonnal látod'],
        body: 'Összekötöd a Számlázz.hu vagy Billingo fiókodat, és minden kártyás fizetés után a számla magától elkészül a nevedre. A vendég e-mailben kapja meg.',
        cta: 'Kösd be a számlázódat',
        example: 'Egy cég ajándékutalványt vásárol a munkatársainak. Megadja az adószámát, és a fizetés után néhány perccel megkapja az adószámos számlát a Számlázz.hu-ból.',
      },
      {
        slug: 'szamlak', title: 'Számlák egy helyen', icon: FolderOpen,
        image: '/landing/funkciok/penz/szamlak.webp',
        desc: 'Kiállított számlák, PDF-előnézet, letöltés.',
        pain: 'A kiállított számlák a számlázóban vannak, külön kell keresgélni őket.',
        points: ['Egy pillantással látod, melyik fizetésről készült már számla', 'A hibás számla azonnal kiderül', 'Számlázz.hu-nál a PDF egy kattintással megnyílik, nem kell külön belépned'],
        body: 'Az összes kiállított számla egy listában látszik típus, vevő, összeg és állapot szerint, kereséssel és szűrőkkel.',
        cta: 'Nézd meg a számláidat',
        example: 'A könyvelő kéri a múlt havi előleg-számlákat. Típusra és hónapra szűrsz, megnyitod a PDF-eket, és letöltöd őket — a számlázóba be sem kell lépned.',
      },
    ],
  },
  {
    id: 'marketing',
    slug: 'marketing',
    label: 'Marketing',
    tagline: 'Hozd vissza a vendégeidet, és gyűjts értékeléseket.',
    cta: { label: 'Marketing', title: 'Hozd vissza, aki egyszer már nálad volt.', lead: 'Hírlevél a feliratkozott vendégeknek, automatikus értékeléskérés és QR-kód az üzletbe — a visszatérés nem a véletlenen múlik.' },
    faqCta: { title: 'Küldd ki az első kampányod.', body: 'Szerkeszd meg az első hírleveled, vagy kapcsold be az automatikus értékeléskérést — pár perc az egész.' },
    icon: Mail,
    seoTitle: 'Hírlevél és Google-értékelés gyűjtés',
    seoDescription: 'Hírlevél-szerkesztő kampányokkal és megnyitás-méréssel, automatikus Google-értékelés kérés, Google-értékelések a foglalóoldalon és QR-kód az üzletnek.',
    h1: 'Hozd vissza a vendégeidet',
    lead: 'Hírlevél a feliratkozott vendégeknek, automatikus értékeléskérés minden látogatás után, és QR-kód, hogy az utcáról is foglaljanak.',
    ready: true,
    extra: {
      intro: {
        title: 'Miért kell marketing egy foglalórendszerbe?',
        paragraphs: [
          'A legolcsóbb vendég az, aki már járt nálad. Egy jól időzített hírlevél egy új szolgáltatásról vagy egy ünnepi ajánlatról sokszor többet hoz, mint egy hirdetés — feltéve, hogy egyszerűen el tudod küldeni.',
          'Az új vendégek a Google-értékelések alapján döntenek. Az elégedett vendégek viszont ritkán írnak értékelést maguktól. Ha a látogatás után automatikusan megkérdezed őket, az értékeléseid száma és átlaga is nő.',
          'A davelopment bookingban ezek a foglalásokhoz kötve, automatikusan történnek: a feliratkozók a foglalásból jönnek, az értékeléskérés a látogatás után megy ki, a QR-kód pedig az utcáról is foglalóvá teszi a járókelőket.',
          'Nem kell hozzá marketinges vagy külön program: a hírlevelet pár perc alatt megírod, az értékeléskérés magától megy ki, a QR-kódot pedig egyszer kinyomtatod. A marketing így a napi munka mellett, szinte észrevétlenül működik.',
        ],
      },
      audience: {
        salon: 'Szalonnál a hírlevél jó alkalom új kezelések, szezonális ajánlatok és szabad időpontok bemutatására, az értékeléskérés pedig minden kezelés után automatikusan megy ki. A QR-kód a kirakatban vagy a recepción azonnali foglalást ad.',
        restaurant: 'Étteremben a hírlevél új menüről, rendezvényről, ünnepi foglalásokról szólhat. Az értékeléskérés a vacsora után megy ki, a QR-kód pedig az asztalon vagy a bejáratnál a következő foglalásra hív.',
      },
      steps: [
        ['Bekapcsolod a feliratkozást', 'A vendég foglaláskor jelezheti, hogy kér hírlevelet.'],
        ['Beállítod az értékeléskérést', 'Google-link és az időzítés: egy, két órával később vagy másnap.'],
        ['Kiteszed a QR-kódot', 'Kirakatba, asztalra, névjegyre — és írod az első hírleveled.'],
      ],
      compare: [
        ['Nincs egyszerű módod elérni a régi vendégeket', 'Hírlevél a feliratkozott vendégeknek, szerkesztővel'],
        ['Nem tudod, elolvasták-e a leveled', 'Látod, ki nyitotta meg'],
        ['Az elégedett vendégek nem írnak értékelést', 'Automatikus értékeléskérés a látogatás után'],
        ['A jó értékeléseid csak a Google-ön látszanak', 'Csillagok a saját foglalóoldaladon is'],
        ['Aki elsétál az üzleted előtt, nem tud foglalni', 'QR-kód a kirakatban, azonnali foglalással'],
      ],
      faq: [
        { q: 'Kiknek küldhetek hírlevelet?', a: 'Csak azoknak a vendégeknek, akik foglaláskor feliratkoztak. Minden levélben ott a leiratkozás lehetősége.' },
        { q: 'Látom-e, ki nyitotta meg a hírlevelet?', a: 'Igen. Kiküldés után a kampánynál látod a megnyitásokat, és a korábbi kampányaid egy listában visszakereshetők.' },
        { q: 'Mikor megy ki az értékeléskérés?', a: 'Te állítod be: egy vagy két órával a látogatás után, vagy másnap. A levél egy kattintással a Google-értékelésedhez viszi a vendéget.' },
        { q: 'Kell-e Google Cégprofil?', a: 'Az értékeléskéréshez és az értékelések megjelenítéséhez igen. A foglalás nélküle is működik.' },
        { q: 'Hogyan jelennek meg a Google-értékeléseim a foglalóoldalon?', a: 'Összekötöd a foglalóoldalt a Google Cégprofiloddal, és az értékelésed meg a csillagaid megjelennek az oldalon.' },
        { q: 'Hova tehetem ki a QR-kódot?', a: 'Bárhova: kirakat, pult, asztal, névjegykártya, szórólap. Letöltöd és kinyomtatod, aki beolvassa, a foglalóoldaladra jut.' },
        { q: 'Szerkeszthetem-e a levelek szövegét?', a: 'Igen. A hírlevelet élő előnézettel szerkeszted, és a vendégeknek küldött automatikus levelek szövegét is testre szabhatod.' },
        { q: 'Szűrhetem-e a hírlevél címzettjeit?', a: 'Igen, például ország szerint. Mindig csak a feliratkozott vendégek közül választasz.' },
        { q: 'Mennyibe kerül a hírlevél-küldés?', a: 'A hírlevél-küldéshez hírlevél-csomag kell (Alap vagy Prémium), a kiküldhető levelek száma ettől függ. A részleteket az Árak oldalon találod.' },
        { q: 'Küldhetek-e hírlevelet telefonról is?', a: 'Igen. A szerkesztő telefonon is működik, így bárhonnan megírhatod és elküldheted.' },
      ],
      related: [
        { label: 'Hogyan tartsd meg a törzsvendégeidet', href: '/tips/torzsvendegek-megtartasa' },
        { label: 'Mikor éri meg online foglalóra váltani?', href: '/tips/mikor-eri-meg-online-foglalo' },
        { label: 'Masszőröknek', href: '/masszor-idopontfoglalas' },
      ],
    },
    items: [
      {
        slug: 'hirlevel', title: 'Hírlevél', icon: Mail,
        image: '/landing/funkciok/marketing/hirlevel.webp',
        desc: 'Szerkesztő, kampányok, megnyitás-mérés.',
        pain: 'A visszatérő vendég a legolcsóbb vendég, de nincs egyszerű módod elérni őket.',
        points: ['Visszahozod a rég nem látott vendégeket', 'Megfelel a szabályoknak, minden levélben ott a leiratkozás', 'Ország szerint is szűrheted a címzetteket'],
        body: 'A hírlevél-szerkesztőben élő előnézettel írod meg a levelet, és csak a feliratkozott vendégeknek küldöd ki. Kiküldés után látod, kik nyitották meg.',
        cta: 'Írd meg az első hírleveled',
        example: 'Egy szalon új arckezelést vezet be. Ír egy rövid hírlevelet a feliratkozott vendégeknek, és másnap látja, hányan nyitották meg — az első foglalások aznap be is jönnek.',
      },
      {
        slug: 'google-ertekeles', title: 'Google-értékelés gyűjtése', icon: Star,
        desc: 'Értékeléskérés automatikusan, a látogatás után.',
        pain: 'Az elégedett vendégek ritkán írnak értékelést maguktól.',
        points: ['Az elégedett vendégek is értékelnek, nem csak az elégedetlenek', 'Folyamatosan nő az értékeléseid száma', 'Nem kell senkit külön megkérned'],
        body: 'A látogatás után a vendég automatikusan kap egy rövid e-mailt, amely egy kattintással a Google-értékelésedhez viszi. Te döntöd el, mennyi idő múlva menjen ki.',
        cta: 'Gyűjts több Google-értékelést',
        example: 'Egy étteremben a vacsora után két órával a vendég rövid e-mailt kap. Egy kattintással a Google-re jut, és ír egy ötcsillagos értékelést.',
      },
      {
        slug: 'google-cegprofil', title: 'Google Cégprofil', icon: Building2,
        desc: 'Google-értékelések a foglalóoldaladon.',
        pain: 'A jó értékeléseid a Google-ön vannak, a foglalóoldaladon nem látszanak.',
        points: ['Az új vendég foglalás előtt látja, mit mondanak rólad', 'A jó értékelések a saját oldaladon is dolgoznak neked', 'A vendég egy kattintással a Google-profilodra jut'],
        body: 'Összekötöd a foglalóoldaladat a Google Cégprofiloddal, és az értékelésed meg a csillagaid megjelennek a foglalóoldalon.',
        cta: 'Kösd össze a Google-profiloddal',
        example: 'Egy új vendég a foglalóoldalon látja a 4,9-es Google-értékelést és a véleményeket, így bizalommal foglal.',
      },
      {
        slug: 'qr-kod', title: 'QR-kód az üzletnek', icon: QrCode,
        desc: 'Kirakatba, asztalra, névjegyre.',
        pain: 'Aki az üzleted előtt sétál el, nem tud azonnal foglalni.',
        points: ['Az is foglal, aki épp az üzleted előtt sétál el', 'Zárás után is jönnek a foglalások', 'Kirakatba, asztalra vagy névjegykártyára is kiteheted'],
        body: 'A rendszer kész QR-kódot készít a foglalóoldaladhoz, amit letöltesz és kinyomtatsz. Aki beolvassa, azonnal a foglalóoldaladon van.',
        cta: 'Töltsd le a QR-kódod',
        example: 'Egy barber szalon a kirakatba tesz egy QR-kódot. Egy járókelő zárás után beolvassa, és másnapra foglal időpontot.',
      },
    ],
  },
  {
    id: 'team',
    slug: 'csapat',
    label: 'Csapat',
    tagline: 'Munkatársak, jogok és a számok — átláthatóan.',
    cta: { label: 'Csapat', title: 'Mindenki a sajátját lássa — és csak azt.', lead: 'Saját belépés minden munkatársnak, pontosan beállított jogok, és statisztikák, amikből látod, mi működik.' },
    faqCta: { title: 'Hívd meg az első munkatársad.', body: 'E-mailben kap meghívót és saját belépést — te döntöd el, mit lát és mit módosíthat.' },
    icon: Users,
    seoTitle: 'Munkatársak, jogosultságok és statisztikák',
    seoDescription: 'Munkatárs-profilok heti óraszámmal és saját naptárral, szerepkör alapú jogosultságok, statisztikák és telefonra telepíthető mobil app.',
    h1: 'A csapatod, átláthatóan',
    lead: 'Munkatársak saját naptárral, jogosultságok szerepek szerint, statisztikák a döntésekhez — és minden telefonon is.',
    ready: true,
    extra: {
      intro: {
        title: 'Miért fontos, hogy a csapat is a rendszerben legyen?',
        paragraphs: [
          'Amíg egyedül dolgozol, minden a fejedben van. Amint egy munkatárs is jön, el kell döntened, ki mit lát, ki mit módosíthat, és hogyan követed, ki mit csinált. Ha mindenki ugyanazzal a belépéssel dolgozik, ez követhetetlen.',
          'A davelopment bookingban mindenki saját belépést kap, saját jogokkal. A munkatárs csak azt látja, ami a munkájához kell, te pedig az audit-naplóban mindent visszakövethetsz.',
          'A statisztikák és a mobil app pedig abban segítenek, hogy a számok alapján dönts, és bárhonnan kézben tartsd az üzletet.',
          'Mindez egy fiókban működik, akár több üzlettel is: ha szalonod és éttermed is van, vagy több telephelyed, egy belépéssel váltasz köztük, és mindenhol ugyanazok a szabályok érvényesek.',
        ],
      },
      audience: {
        salon: 'Szalonnál minden szakembernek saját profilja, saját szolgáltatásai és saját naptára van, így a vendég azt a szakembert választhatja, akihez járni szeretne. A recepciós kezelheti a foglalásokat anélkül, hogy a bevételt látná.',
        restaurant: 'Étteremben a pincérek, a pultosok és az üzletvezető más-más jogokat kapnak: van, aki csak a napi foglalásokat látja és ülteti le a vendégeket, és van, aki a statisztikát és a beállításokat is kezeli.',
      },
      steps: [
        ['Meghívod a munkatársakat', 'E-mailben, saját belépéssel.'],
        ['Kiosztod a szerepeket', 'Beépített vagy saját szerepek, pontos jogokkal.'],
        ['Követed a számokat', 'Statisztikák, audit-napló — gépen és telefonon.'],
      ],
      compare: [
        ['Mindenki ugyanazzal a jelszóval lép be', 'Saját belépés mindenkinek'],
        ['Mindenki mindent lát, a bevételt is', 'Szerepek, pontosan beállított jogokkal'],
        ['Nem tudod, ki módosította a foglalást', 'Audit-napló: ki, mikor, mit'],
        ['Érzésre döntesz', 'Statisztikák időszakonként, összevetéssel'],
        ['Csak gépről éred el a rendszert', 'Telefonra telepíthető app, értesítésekkel'],
      ],
      faq: [
        { q: 'Hány munkatársat vehetek fel?', a: 'A csomagodtól függ — az árakat az Árak oldalon találod. Minden munkatárs saját belépést kap.' },
        { q: 'Beállíthatom-e, hogy ki mit lát?', a: 'Igen. Saját szerepeket hozhatsz létre, és pontosan megadhatod, ki láthatja a statisztikát és a bevételt, ki kezelheti a foglalásokat és ki módosíthatja a beállításokat.' },
        { q: 'Mi az audit-napló?', a: 'Egy lista arról, ki mikor mit módosított a rendszerben — foglalást, beállítást, munkatársat. A változásoknál a régi és az új érték is látszik.' },
        { q: 'Milyen statisztikákat látok?', a: 'Foglalások száma, kihasználtság, bevétel, foglalás-források (online, telefon, beeső), összevetve az előző időszakkal.' },
        { q: 'Kell-e alkalmazást letölteni az app store-ból?', a: 'Nem. A rendszert a böngészőből telepítheted a telefonod kezdőképernyőjére, és ugyanúgy működik, mint egy app.' },
        { q: 'Működik-e gyenge térerőnél?', a: 'Igen. Amit offline rögzítesz, vázlatként elmentődik, és amint újra van internet, szinkronizálódik.' },
        { q: 'Kapok-e értesítést a telefonomra?', a: 'Igen. Új foglalásról, lemondásról és jóváhagyásra váró foglalásról értesítést kapsz, ha engedélyezed.' },
        { q: 'Felfüggeszthetem-e egy munkatárs hozzáférését?', a: 'Igen. A munkatársat bármikor felfüggesztheted vagy eltávolíthatod, a korábbi foglalásai és adatai megmaradnak.' },
        { q: 'Láthatja-e a munkatárs a saját statisztikáját?', a: 'Igen, ha a szerepe ezt megengedi. Beállíthatod, hogy mindenki csak a saját számait lássa, vagy az egész üzletét.' },
        { q: 'Átkerülnek-e a foglalások, ha egy munkatárs távozik?', a: 'A korábbi foglalásai és adatai megmaradnak, a jövőbeli foglalásait pedig áthúzással átteheted egy kollégához.' },
      ],
      related: [
        { label: 'Csapatbeosztás hatékonyan', href: '/tips/csapat-beosztas-hatekonyan' },
        { label: 'Csapatkezelés kisvállalkozásoknak', href: '/csapatkezeles-kisvallalkozasoknak' },
        { label: 'Barber szalonoknak', href: '/barber-idopontfoglalas' },
      ],
    },
    items: [
      {
        slug: 'munkatarsak', title: 'Munkatársak', icon: Users,
        desc: 'Profil, heti óraszám, saját naptár.',
        pain: 'Nem látszik, ki mikor dolgozik, és melyik szolgáltatást ki végzi.',
        points: ['A vendég csak akkor foglal, amikor az adott szakember ráér', 'Az új munkatársat e-mailben hívod meg, saját belépéssel', 'Mindenki a saját telefonján látja a napját'],
        body: 'Minden munkatársnak profilja van fotóval, pozícióval és a szolgáltatásaival. Szalonban mindenkinek saját naptára és nyitvatartása lehet.',
        cta: 'Hívd meg a csapatodat',
        example: 'Egy új kolléga érkezik a szalonba. Meghívod e-mailben, beállítod a szolgáltatásait és a heti óraszámát, és a vendégek másnap már foglalhatnak hozzá.',
      },
      {
        slug: 'jogosultsagok', title: 'Jogosultságok', icon: ShieldCheck,
        desc: 'Szerepek: ki mit lát és mit módosíthat.',
        pain: 'Nem szeretnéd, hogy mindenki lássa a bevételt vagy módosíthassa a beállításokat.',
        points: ['A bevételt csak az látja, akinek kell', 'Senki nem állít át véletlenül egy fontos beállítást', 'Ha kérdés van, kiderül, ki mit csinált'],
        body: 'Saját szerepeket hozol létre, és beállítod, ki mit lát és mit módosíthat. Az audit-naplóban visszakövethető, ki mikor mit változtatott.',
        cta: 'Állítsd be a jogosultságokat',
        example: 'A recepciós kezeli a foglalásokat és a vendégeket, de a bevételt és a beállításokat nem látja. Ha valaki módosít egy foglalást, az audit-naplóban visszakereshető.',
      },
      {
        slug: 'statisztikak', title: 'Statisztikák', icon: BarChart3,
        image: '/landing/funkciok/csapat/statisztikak.webp',
        desc: 'Bevétel, kihasználtság, foglalás-források.',
        pain: 'Érzésre döntesz, mert nem látod a számokat.',
        points: ['Kiderül, melyik nap és óra a legerősebb', 'Látod, honnan jönnek a foglalások: online, telefon vagy beeső', 'Érzés helyett számok alapján döntesz árakról és nyitvatartásról'],
        body: 'Látod a foglalások számát, a kihasználtságot és a bevételt napra, hétre vagy hónapra, az előző időszakkal összevetve.',
        cta: 'Nézd meg a számaidat',
        example: 'Egy étterem a statisztikában látja, hogy kedden alig van foglalás, péntek este viszont teltház. Keddre akciós menüt indít, péntekre még egy pincért oszt be.',
      },
      {
        slug: 'mobil-app', title: 'Mobil app', icon: Smartphone,
        desc: 'Telefonra telepíthető, offline is működik.',
        pain: 'Nem mindig ülsz gép előtt, de a foglalásokat mindig látnod kell.',
        points: ['A pultnál, úton vagy otthonról is kezeled a foglalásokat', 'Gyenge térerőnél is működik, a változások később szinkronizálódnak', 'Nem kell semmit letöltened az app store-ból'],
        body: 'A rendszert app store nélkül telepíted a telefonodra, és értesítést kapsz minden új foglalásról.',
        cta: 'Telepítsd a telefonodra',
        example: 'Az üzletvezető vasárnap otthonról nézi a hétfői foglalásokat a telefonján, és értesítést kap, amikor beesik egy új foglalás.',
      },
    ],
  },
]

export function featureGroupBySlug(slug: string): FeatureGroup | undefined {
  return FEATURE_GROUPS.find((g) => g.slug === slug)
}

/** A csoport-oldal címe (ha a csoport még nincs kész, a főoldal funkció-szekciója). */
export function groupHref(g: FeatureGroup): string {
  return g.ready ? `/funkciok/${g.slug}` : '/#funkciok'
}

/** Hova visz egy funkció menüpontja: a csoport-oldal megfelelő szakaszára. */
export function featureHref(f: LandingFeature): string {
  const g = FEATURE_GROUPS.find((gr) => gr.items.some((i) => i.slug === f.slug))
  return g?.ready ? `/funkciok/${g.slug}#${f.slug}` : '/#funkciok'
}

/** A csoport borítóképe: a külön borító (mockup), amíg nincs — az első funkcióképe. Ezt használja
 *  a menü, a /funkciok kártya és a csoportoldal hero-ablaka (egy szabály, mindenhol ugyanaz). */
export function groupCoverImage(g: FeatureGroup): string | undefined {
  return g.cover ?? g.items.find((f) => f.image)?.image
}
