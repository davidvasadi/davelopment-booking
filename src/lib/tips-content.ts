import { SITE_URL } from '@/lib/publicSeo'

/** Kép a szakasz alján: a rendszer valódi képernyője telefonkeretben (`shot`, kép-útvonal), vagy a funkció-oldalak
 *  kártya-kompozíciója (`visual`: a landing-stepvisuals csoportja + sorszáma). */
export type TipFigure =
  | { kind: 'shot'; src: string; alt: string; caption?: string }
  | { kind: 'visual'; group: string; index: number; caption?: string }
/** Egy szakasz: cím, bekezdés, (kézikönyvnél) számozott lépések, kép és egy „Tipp” doboz. */
export type TipSection = { title: string; body: string; steps?: string[]; figure?: TipFigure; note?: string }

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
/** Kézikönyv-oldal (tipp, lépésekkel): HowTo strukturált adat a lépésekből — a Google lépésenkénti találatként is mutathatja. */
export function howToJsonLd(tip: Tip): Record<string, unknown> | null {
  const sections = tip.sections.filter((s) => s.steps?.length)
  if (tip.kind !== 'tipp' || !sections.length) return null
  const url = `${SITE_URL}/tippek-es-cikkek/${tip.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: tip.title,
    description: tip.excerpt,
    image: `${SITE_URL}${tip.image}`,
    step: sections.map((s, i) => ({
      '@type': 'HowToSection',
      name: s.title,
      position: i + 1,
      itemListElement: (s.steps ?? []).map((t, j) => ({ '@type': 'HowToStep', position: j + 1, text: t, url: `${url}#lepes-${i + 1}` })),
    })),
  }
}

export function articleJsonLd(tip: Tip): Record<string, unknown> {
  const url = `${SITE_URL}/tippek-es-cikkek/${tip.slug}`
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
  // kézikönyv-oldalak: a rendszer valódi telefonos képe
  'foglalasok-kezelese': '/landing/hero/foglalasok-idovonal-davelopment-booking.webp',
  'elso-lepesek': '/landing/funkciok/mobil/bemutatkozo-weboldal-davelopment-booking.webp',
  'attekintes': '/landing/funkciok/mobil/jovahagyas-davelopment-booking.webp',
  'vendegek-kezelese': '/landing/funkciok/mobil/vendegkartya-davelopment-booking.webp',
  'naptar-beosztas': '/landing/funkciok/mobil/beosztas-davelopment-booking.webp',
  'munkatarsak-es-jogok': '/landing/funkciok/mobil/munkatarsak-davelopment-booking.webp',
  'utalvanyok': '/landing/funkciok/mobil/ajandekutalvany-davelopment-booking.webp',
  'marketing-hirlevel-ertekeles': '/landing/funkciok/mobil/hirlevel-davelopment-booking.webp',
  'fizetes-eloleg-szamlazas': '/landing/funkciok/mobil/eloleg-davelopment-booking.webp',
  'foglalooldal-es-megosztas': '/landing/funkciok/mobil/google-cegprofil-davelopment-booking.webp',
  'statisztikak': '/landing/funkciok/mobil/statisztikak-davelopment-booking.webp',
  'nyitvatartas-es-kinalat': '/landing/funkciok/mobil/elo-asztalallapot-davelopment-booking.webp',
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
  'audit-naplo-vallalkozasban': '/landing/tips/borito/audit-naplo-vallalkozasban-davelopment-booking.webp',
  'jelek-hogy-elavult-a-foglalasi-rendszered': '/landing/tips/borito/jelek-hogy-elavult-a-foglalasi-rendszered-davelopment-booking.webp',
  'nav-kompatibilis-szamlazas-foglalasi-rendszerbol': '/landing/tips/borito/nav-kompatibilis-szamlazas-foglalasi-rendszerbol-davelopment-booking.webp',
}

const RAW_TIPS: Omit<Tip, 'image'>[] = [
  // ══ Kézikönyv (a menü szerint) ══
  {
    slug: 'elso-lepesek',
    kind: 'tipp',
    category: 'Első lépések',
    date: '2026. november 11.',
    title: 'Első lépések: így indulsz el a davelopment bookinggal',
    excerpt: 'Regisztráció, üzlettípus, foglalóoldal, és az app a telefonodon — az első pár perc lépésről lépésre.',
    intro: 'Az indulás pár perc: kiválasztod az üzleted típusát, a rendszer betölt egy kész sablont, kitöltöd a foglalóoldalad, és megosztod a linket. Ez az útmutató sorra veszi a lépéseket, és megmutatja, hogyan teszed fel az appot a telefonodra.',
    sections: [
      {
        title: 'Regisztráció és üzlettípus',
        body: 'A regisztrációnál megadod az üzleted nevét, és kiválasztod a típusát: szalon (időpontfoglalás) vagy étterem (asztalfoglalás). A típus alapján a rendszer betölt egy kész sablont — kategóriákat és minta szolgáltatásokat —, amit utána a saját képedre szabsz.',
        steps: [
          'Regisztrálj az e-mail-címeddel vagy a Google-fiókoddal.',
          'Add meg az üzleted nevét, és válaszd ki a típusát.',
          'Válaszd ki, mivel foglalkozol (például fodrászat, körömszalon, masszázs) — ehhez töltjük be a mintákat.',
        ],
        figure: { kind: 'visual', group: 'home', index: 0, caption: 'Szalon vagy étterem — a kész sablon a típushoz igazodik.' },
      },
      {
        title: 'A bevezető túra',
        body: 'Az első belépéskor egy rövid bevezető túra mutatja meg a rendszer fő részeit: az időpontokat, a vendégeket, a számokat és az appot. A túrát bármikor kihagyhatod, és a Súgóból újraindíthatod.',
      },
      {
        title: 'A foglalóoldal kitöltése',
        body: 'A foglalóoldal az a weboldal, ahol a vendégeid foglalnak. Az élő szerkesztőben közvetlenül az oldalon írsz és cserélsz képet — ahogy szerkesztesz, úgy fog kinézni.',
        steps: [
          'Nyisd meg a Beállítások › Foglalóoldal menüt.',
          'Tölts fel borítóképet, írd meg a bemutatkozást, add meg az elérhetőségeidet.',
          'Ellenőrizd a szolgáltatásokat (szalon) vagy az asztalokat (étterem).',
          'Tedd közzé az oldalt.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/bemutatkozo-weboldal-davelopment-booking.webp', alt: 'A foglalóoldal élő szerkesztője — davelopment booking', caption: 'Az élő szerkesztőben közvetlenül az oldalon írsz.' },
      },
      {
        title: 'A link megosztása',
        body: 'A foglalóoldalad linkjét tedd ki mindenhova, ahol a vendégeid keresnek: a Google Cégprofilodra, az Instagram- és Facebook-oldaladra, a névjegyedre. A Beállítások › Foglalóoldal alatt QR-kódot is letölthetsz a kirakatra vagy a pultra.',
        figure: { kind: 'visual', group: 'home', index: 1, caption: 'Megosztod a linket — és jönnek a foglalások.' },
      },
      {
        title: 'Az app a telefonodra',
        body: 'A rendszer app store nélkül, egy lépésben telepíthető a telefonodra: ikon kerül a főképernyőre, és úgy működik, mint egy alkalmazás — teljes képernyőn, böngészősáv nélkül.',
        steps: [
          'iPhone (Safari): koppints a képernyő alján a Megosztás gombra, majd válaszd a „Főképernyőhöz adás” lehetőséget.',
          'Android (Chrome): koppints a jobb felső három pontra, majd az „Alkalmazás telepítése” vagy a „Főképernyőhöz adás” lehetőségre.',
          'Gépen (Chrome, Edge): a címsor jobb oldalán megjelenő telepítés-ikonra kattints.',
          'Telepítés után a Beállítások › Értesítések alatt kapcsold be a push-értesítéseket.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/mobil-app-davelopment-booking.webp', alt: 'Az értesítések beállítása az appban — davelopment booking', caption: 'Az appban bekapcsolod, miről kérsz értesítést.' },
        note: 'iPhone-on a push-értesítések csak a főképernyőre telepített appból működnek, a sima böngészőfülről nem.',
      },
      {
        title: 'Csapat meghívása',
        body: 'Ha nem egyedül dolgozol, hívd meg a munkatársaidat e-mailben — mindenki a saját belépésével, a saját naptárával dolgozik. Ha most egyedül indulsz, bármikor később is bővítheted a csapatot.',
        figure: { kind: 'visual', group: 'home', index: 2, caption: 'A meghívott munkatárs elfogadja a meghívót, és már dolgozhat is.' },
      },
    ],
    closing: 'Ha elakadsz, az app Súgó menüpontjában minden oldalhoz találsz rövid magyarázatot, és ebben a kézikönyvben menüpontonként részletes útmutatót.',
  },
  {
    slug: 'attekintes',
    kind: 'tipp',
    category: 'Áttekintés',
    date: '2026. november 11.',
    title: 'Áttekintés: a napod egy pillantásra',
    excerpt: 'Belépés után az Áttekintés mutatja, mi vár rád ma: a foglalások állapota, a várható bevétel, a következő vendég, a közelgő foglalások és a teendők.',
    intro: 'Az Áttekintés a kezdőképernyőd. Belépés után rögtön látod a mai napot, anélkül hogy bárhová kattintanod kellene — és innen egy koppintással ugrasz oda, ahol dolgod van.',
    sections: [
      {
        title: 'A nap állapota',
        body: 'Felül egy sávban látod a mai foglalásokat állapot szerint: megerősített, függő (jóváhagyásra vár), szabad (mennyi hely vagy idő maradt még) és lemondott. Alatta a legfontosabb számok: a mai foglalások száma, a várható bevétel, a ma beérkezett előleg és a következő foglalás ideje.',
      },
      {
        title: 'Közelgő foglalások',
        body: 'A Közelgő foglalások kártya a következő órák foglalásait mutatja idővonalon, munkatársakkal. Ha egy órában több foglalás is van, a sárga szám jelzi, hányan vannak még — koppintásra kinyílik. A kártya sarkában lévő nyíllal a Foglalások oldalra ugrasz.',
        figure: { kind: 'visual', group: 'booking', index: 2, caption: 'Új foglalásról azonnal értesülsz — az Áttekintésen is megjelenik.' },
      },
      {
        title: 'Jóváhagyásra váró foglalások',
        body: 'Ha kézi jóváhagyást használsz, a függő foglalások száma az Áttekintésen is látszik, és az oldal alján egy sáv jelzi, hány foglalás vár rád. A Megnézem gombbal sorban átnézed őket, és egy koppintással jóváhagyod vagy elutasítod.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/jovahagyas-davelopment-booking.webp', alt: 'Jóváhagyásra váró foglalás az Áttekintésen — davelopment booking', caption: 'A függő foglalásokat sorban, lapozva nézed át.' },
      },
      {
        title: 'Teendők',
        body: 'A Teendők a csapat közös feladatlistája: mai, holnapi és korábbi teendők külön lapon, mindegyiknél a felelős munkatárs és a határidő. A kész feladatot egy koppintással kipipálod — így semmi nem csúszik el szóban vagy csoportchatben.',
      },
      {
        title: 'Napi összefoglaló',
        body: 'A Pro csomagban reggel és este rövid összefoglalót kaphatsz: reggel a mai napról, este a holnapiról — hány foglalás vár, és hány vár jóváhagyásra. Hogy kérsz-e ilyet, a Beállítások › Értesítések alatt állítod be.',
      },
    ],
    closing: 'Az Áttekintés minden számára koppintva a részletekhez jutsz — a foglalásokhoz, a statisztikához vagy a teendőkhöz.',
  },
  {
    slug: 'vendegek-kezelese',
    kind: 'tipp',
    category: 'Vendégek',
    date: '2026. november 11.',
    title: 'Vendégek: vendégkártya, tiltólista, térkép és export',
    excerpt: 'A Vendégek oldal a foglalásaidból épül: minden vendégnek saját kártyája van az előzményekkel, és itt kezeled a tiltólistát, a térképet és az exportot is.',
    intro: 'Nem kell kézzel vendéglistát vezetned: minden foglalásból automatikusan vendégkártya lesz. Ez az útmutató megmutatja, mit látsz egy vendégről, hogyan egészíted ki az adatait, és hogyan használod a vendéglistát.',
    sections: [
      {
        title: 'A vendégkártya',
        body: 'Egy vendégre koppintva megnyílik a kártyája: elérhetőségek, hányszor járt nálad, hányszor nem jött el, a következő foglalása, és a korábbi foglalások listája. Ha értékelést is adott, az is itt jelenik meg.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/vendegkartya-davelopment-booking.webp', alt: 'Vendégkártya a látogatásokkal és a következő foglalással — davelopment booking', caption: 'A vendégkártya mindent mutat egy vendégről.' },
      },
      {
        title: 'Kiegészíted, amit tudsz',
        body: 'A vendégkártyán megjegyzést írhatsz (például „kávét kér, cukor nélkül”), megadhatod a születésnapját, és csoportba sorolhatod (például törzsvendég). Ezek legközelebb a foglalásnál is látszanak.',
        figure: { kind: 'visual', group: 'guests', index: 1, caption: 'Születésnap, csoport, megjegyzés — a vendégkártyán.' },
      },
      {
        title: 'Tiltólista',
        body: 'Ha egy vendég többször nem jött el, vagy más okból nem szeretnéd, hogy online foglaljon, tiltólistára teheted, indoklással. A tiltott vendég nem tud online foglalást leadni.',
        steps: [
          'Nyisd meg a vendég kártyáját.',
          'Válaszd a tiltást, és írd be az okát.',
          'Erősítsd meg — a tiltás bármikor visszavonható.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/feketelista-davelopment-booking.webp', alt: 'Vendég tiltólistára tétele indoklással — davelopment booking', caption: 'A tiltásnál az indoklást is rögzíted.' },
      },
      {
        title: 'Honnan jönnek a vendégeid',
        body: 'A térképen a vendégeid városa és országa alapján látod, honnan érkeznek. Ez segít eldönteni, hol érdemes hirdetni, és hogy kell-e idegen nyelvű foglalóoldal.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/vendeg-terkep-davelopment-booking.webp', alt: 'Vendég-térkép a visszatérő vendégek arányával — davelopment booking', caption: 'A térkép a vendégeid városa alapján készül.' },
      },
      {
        title: 'Keresés és export',
        body: 'A vendéglistában név, e-mail vagy telefonszám szerint keresel. Az exporttal a vendégeidet vagy a foglalásaidat CSV-fájlba mented, amit Excelben vagy Google Táblázatban megnyithatsz.',
        steps: [
          'Koppints az export gombra.',
          'Válaszd ki, mit exportálsz: vendégeket vagy foglalásokat.',
          'Add meg az időszakot (például 30 nap, egy év vagy egyedi), és jelöld be a szükséges mezőket.',
          'Töltsd le a CSV-fájlt.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/export-davelopment-booking.webp', alt: 'Vendégek exportálása CSV-be — davelopment booking', caption: 'Az export Excelben is megnyitható.' },
        note: 'A tiltott vendégek az exportban is jelölve vannak.',
      },
    ],
    closing: 'A vendégkártyák a foglalásokból maguktól épülnek — minél tovább használod a rendszert, annál többet tudsz a vendégeidről.',
  },
  {
    slug: 'naptar-beosztas',
    kind: 'tipp',
    category: 'Naptár',
    date: '2026. november 11.',
    title: 'Naptár: beosztás, szabadság, munkaidő és bérezés',
    excerpt: 'A Naptárban tervezed a csapat műszakjait, rögzíted a szabadságot és a betegséget, és itt követed a munkaidőt és a bérköltséget is.',
    intro: 'A Naptár a csapat havi és heti rendje: ki mikor dolgozik, ki van szabadságon, és mennyi a ledolgozott idő. A beosztás összhangban van a foglalásokkal — aki nem dolgozik, arra az időre nem foglalható.',
    sections: [
      {
        title: 'Heti beosztás készítése',
        body: 'A beosztást hétre vagy hónapra készíted. A fedetlen napok azonnal látszanak, így nem marad nap munkatárs nélkül.',
        steps: [
          'Nyisd meg a Naptárat, és koppints a + gombra (Beosztás).',
          'Ha a múlt hét jó volt, az Előző hét másolása gombbal egy lépésben átveheted.',
          'Állítsd be a napokat munkatársanként, majd mentsd el.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/beosztas-davelopment-booking.webp', alt: 'Új heti beosztás munkatársanként — davelopment booking', caption: 'A heti rácsban egy pillantásra látod, ki mikor dolgozik.' },
      },
      {
        title: 'Szabadság, betegség, szabadnap',
        body: 'A távolléteket külön jelölöd: műszak, szabadság, beteg vagy szabadnap. Szabadságnál a rendszer az éves keretet is számolja — látod, mennyi nap maradt.',
        steps: [
          'Koppints a munkatárs napjára a Naptárban.',
          'Válaszd a távollét típusát, és add meg a kezdetét és a végét.',
          'Mentsd el — a foglalóoldalon arra az időre a munkatárs nem lesz foglalható.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/szabadsag-davelopment-booking.webp', alt: 'Szabadság rögzítése éves kerettel — davelopment booking', caption: 'Szabadságnál az éves keret is látszik.' },
      },
      {
        title: 'Munkaidő és ledolgozott órák',
        body: 'Munkatársanként havi bontásban látod a ledolgozott órákat, a műszakokat, a betegnapokat és a szabadságot. A számok a beosztásból és a távollétekből maguktól adódnak.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/munkaido-davelopment-booking.webp', alt: 'Havi munkaidő munkatársanként — davelopment booking', caption: 'Havi munkaidő munkatársanként.' },
      },
      {
        title: 'Bérezés',
        body: 'A bérköltség havi összesítője megmutatja a bért, a borravalót és a túlórát, munkatársanként is. A bérlistát le is töltheted a könyvelőnek.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/berezes-davelopment-booking.webp', alt: 'Havi bérköltség munkatársanként — davelopment booking', caption: 'A bérlista egy kattintással letölthető.' },
      },
      {
        title: 'Borravaló (étterem)',
        body: 'Étteremben minden naphoz egy összegben megadod az aznap befolyt borravalót, a rendszer pedig elosztja az aznap dolgozó, borravalóra jogosult munkatársak között. Ki jogosult, azt a tulajdonos állítja be a munkatárs profilján; mindenki a saját havi összegét látja.',
        note: 'A szabadságon vagy betegszabadságon lévők nem kapnak részt az aznapi borravalóból.',
      },
      {
        title: 'Munkatársként: a saját beosztásod',
        body: 'Munkatársként a Naptár a saját beosztásodat mutatja: melyik napokon dolgozol, mikor van szabadnapod. A napodra koppintva látod a pontos kezdést és zárást. Ha hibás a beosztásod, a vezetődnek szólj.',
        figure: { kind: 'visual', group: 'calendar', index: 1, caption: 'A kész beosztásról mindenki értesül.' },
      },
    ],
    closing: 'A beosztást a tulajdonos és azok szerkesztik, akik erre jogot kaptak — mindenki más csak a saját sávját látja.',
  },
  {
    slug: 'munkatarsak-es-jogok',
    kind: 'tipp',
    category: 'Munkatársak',
    date: '2026. november 11.',
    title: 'Munkatársak és jogok: meghívás, szerepek, profil',
    excerpt: 'Hogyan hívod meg a munkatársaidat, hogyan adsz nekik szerepet, és hogyan döntöd el pontosan, ki mit lát és mit módosíthat.',
    intro: 'Minden munkatárs saját belépéssel dolgozik, és csak azt látja, amire jogot kapott. A tulajdonos mindig mindent lát. Ez az útmutató végigveszi a meghívást, a szerepeket és a munkatárs-profilt.',
    sections: [
      {
        title: 'Munkatárs meghívása',
        body: 'A munkatársat e-mailben hívod meg. Amikor elfogadja a meghívót, a profilja automatikusan létrejön, és a saját belépésével dolgozhat.',
        steps: [
          'Nyisd meg a Munkatársak oldalt, és koppints a Meghívás gombra.',
          'Add meg a munkatárs e-mail-címét, és válassz neki szerepet.',
          'Küldd el a meghívót. Amíg nem fogadja el, a listában Meghívott állapotban látod.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/munkatarsak-davelopment-booking.webp', alt: 'A Munkatársak oldal aktív, meghívott és felfüggesztett tagokkal — davelopment booking', caption: 'Aktív, meghívott és felfüggesztett munkatársak egy listában.' },
      },
      {
        title: 'Szerepek és jogok',
        body: 'Minden munkatárs (a tulajdonoson kívül) egy szerephez tartozik, amelynek te állítod be a jogait — területenként (foglalás, naptár, vendégek és a többi): mit láthat és mit módosíthat. Szerepet kész sablonból is indíthatsz.',
        steps: [
          'Nyisd meg a Beállítások › Csapat & jogok menüt, és válaszd a Szerepek fület.',
          'Koppints az Új szerep gombra, vagy indulj egy sablonból (például Üzletvezető, Recepcionista, Stylist / Szakember, Asszisztens).',
          'Kapcsold be területenként a jogokat, majd mentsd el.',
          'A munkatárs profilján rendeld hozzá a szerepet.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/jogosultsagok-davelopment-booking.webp', alt: 'Szerepek és jogok szerkesztése — davelopment booking', caption: 'A szerepeket sablonból is indíthatod.' },
        note: 'Aki nem kap szerepet, be tud lépni, de üres a felülete. Az üzlet törlése sosem adható ki — az mindig a tulajdonosé.',
      },
      {
        title: 'Ki láthatja a fizetéseket',
        body: 'A saját fizetését mindenki látja, mások fizetését viszont csak az, akinek ezt külön jogként megadod. Így a bérek nem kerülnek véletlenül szem elé.',
      },
      {
        title: 'A munkatárs profilja',
        body: 'A munkatársra koppintva látod az alapadatait (belépés dátuma, telefon, heti óraszám) és a statisztikáját: ledolgozott órák, betegnapok, szabadság. Szalonban itt rendeled hozzá, milyen szolgáltatásokat végez — ezek közül választhat a vendég foglaláskor.',
        figure: { kind: 'visual', group: 'team', index: 0, caption: 'A meghívott munkatárs elfogad, és már aktív.' },
      },
      {
        title: 'Felfüggesztés',
        body: 'Ha valaki egy időre nem dolgozik nálad, felfüggesztheted: nem tud belépni, de minden adata megmarad, és bármikor visszaállíthatod.',
      },
      {
        title: 'Ki mit módosított',
        body: 'A Beállítások › Audit-napló alatt visszakövetheted, ki mikor mit változtatott a rendszerben — például egy árat vagy egy foglalást.',
      },
    ],
    closing: 'A jogokkal pontosan szabályozod, ki mit lát — a csapat így biztonságosan dolgozhat ugyanabban a rendszerben.',
  },
  {
    slug: 'utalvanyok',
    kind: 'tipp',
    category: 'Utalványok',
    date: '2026. november 11.',
    title: 'Ajándékutalványok: típus, eladás, beváltás',
    excerpt: 'A vendégeid ajándékutalványt vehetnek a foglalóoldaladon — te pedig a pultnál is eladhatod és be is válthatod. Így állítod be.',
    intro: 'Az ajándékutalvány extra bevétel, szezonon kívül is. A vendég a foglalóoldaladon vásárol, de a pultnál is kiállíthatsz utalványt. Ez az útmutató a beállítástól a beváltásig végigvezet.',
    sections: [
      {
        title: 'Az utalványok bekapcsolása',
        body: 'Az utalványokat a beállításokban kapcsolod be. Online fizetéshez a Stripe-fiókod összekötése kell — a pénz egyenesen hozzád érkezik.',
        steps: [
          'Nyisd meg a Beállítások › Ajándékutalvány menüt, és kapcsold be.',
          'Ha még nem tetted, kösd össze a Stripe-fiókodat a Fizetés & számlázás alatt.',
        ],
      },
      {
        title: 'Utalvány-típus létrehozása',
        body: 'Egy típus az utalvány összege, neve és kinézete. A kinézetet sablonból választod (forma és szín), a jegyen pedig rögtön látod az eredményt.',
        steps: [
          'Az Utalványok oldalon koppints az Új típus gombra.',
          'Add meg a nevet és az összeget.',
          'Válassz sablont és színt — saját képet is tehetsz rá.',
          'Mentsd el. A típus megjelenik a foglalóoldaladon.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/ajandekutalvany-davelopment-booking.webp', alt: 'Ajándékutalvány-típusok és kiállítás — davelopment booking', caption: 'Az utalványok az Utalványok oldalon.' },
      },
      {
        title: 'Eladás a pultnál',
        body: 'Ha a vendég személyesen veszi meg az utalványt, a varázslóban pár lépésben kiállítod: kiválasztod a típust, megadod a megajándékozott nevét, és rögzíted a fizetés módját.',
      },
      {
        title: 'Beváltás',
        body: 'Beváltáskor beolvasod az utalvány QR-kódját a telefonod kamerájával, vagy beírod a kódját. A rendszer ellenőrzi, érvényes-e, és mennyi van még rajta.',
      },
      {
        title: 'ÁFA és számla',
        body: 'Az utalvány eladásakor az ÁFA még nem keletkezik: eladáskor áfa nélküli bizonylat megy, és beváltáskor (a látogatáskor) a teljes összeget számlázod — az utalvány ott fizetési mód. Ha összekötötted a számlázódat, a rendszer ezt követi.',
      },
    ],
    closing: 'Ünnepek előtt érdemes az utalványt a közösségi oldalaidon és a hírleveledben is megemlíteni.',
  },
  {
    slug: 'marketing-hirlevel-ertekeles',
    kind: 'tipp',
    category: 'Marketing',
    date: '2026. november 11.',
    title: 'Marketing: hírlevél, Google-értékelés és QR-kód',
    excerpt: 'Hírlevél a feliratkozóknak, automatikus értékeléskérés a látogatás után, és QR-kód a kirakatra — így hozod vissza a vendégeidet.',
    intro: 'A Marketing oldalon hírlevelet küldesz azoknak a vendégeknek, akik ehhez hozzájárultak, a beállításokban pedig bekapcsolod az automatikus Google-értékeléskérést. A hírlevél a csomagodba épített, nincs küldésenkénti díj.',
    sections: [
      {
        title: 'Feliratkozók',
        body: 'A vendég foglaláskor jelezheti, hogy kér hírlevelet — csak ők kerülnek a listádra. A Feliratkozók fülön kereshetsz és szűrhetsz; aki leiratkozik, automatikusan kikerül.',
        figure: { kind: 'visual', group: 'marketing', index: 0, caption: 'Új feliratkozó érkezik a foglalásból.' },
      },
      {
        title: 'Hírlevél küldése',
        body: 'A hírlevelet blokkokból rakod össze: szöveg, cím, kép, gomb, elválasztó. Az előnézetben látod, hogyan fog kinézni.',
        steps: [
          'A Marketing oldalon nyisd meg a Kampányok fület, és indíts új kampányt.',
          'Add meg a tárgyat, és válaszd ki a címzetteket (mindenki vagy egy szűrt kör).',
          'Rakd össze a levelet blokkokból — sablonból is indulhatsz.',
          'Küldd el, vagy mentsd piszkozatként.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/hirlevel-davelopment-booking.webp', alt: 'Kiküldött hírlevél megnyitási aránnyal — davelopment booking', caption: 'A kampány után látod, hányan nyitották meg.' },
        note: 'A legjobb célcsoport a régen nem járt, korábban aktív vendég.',
      },
      {
        title: 'Eredmények',
        body: 'Minden kiküldött kampánynál látod, hányan nyitották meg, és a címzettek listáját is: ki mikor nyitotta meg. A kiküldött levelet nem módosíthatod, de másolatként új kampányt indíthatsz belőle.',
      },
      {
        title: 'Google-értékelés kérése',
        body: 'A látogatás után a vendég automatikusan rövid e-mailt kap egy csillagozó-oldallal. Ha 4 vagy 5 csillagot ad, az oldal továbbviszi a Google-értékelésedhez; alacsonyabb értékelésnél a visszajelzés csak nálad marad.',
        steps: [
          'Nyisd meg a Beállítások › Értékelések menüt.',
          'Add meg a Google-profilodat — a rendszer ehhez viszi a jó értékeléseket.',
          'Kapcsold be az értékeléskérést e-mailben.',
          'Válaszd ki, mikor menjen ki: 1 órával, 2 órával a foglalás vége után, vagy másnap.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/google-ertekeles-davelopment-booking.webp', alt: 'Az értékeléskérés beállításai — davelopment booking', caption: 'Az időzítést te választod meg.' },
      },
      {
        title: 'QR-kód a kirakatra',
        body: 'A foglalóoldaladhoz QR-kódot kapsz: plakátra, kirakatra, asztalra, névjegyre. Beolvasva rögtön a foglalóoldalad nyílik meg. A lapra a nyitvatartást és a közösségi oldalaidat is rárakhatod.',
        steps: [
          'Nyisd meg a Beállítások › Foglalóoldal menüt, és válaszd a QR-kódot.',
          'Kapcsold be, mi kerüljön a lapra (nyitvatartás, közösségi oldalak).',
          'Töltsd le PNG-ként, vagy nyomtasd ki.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/qr-kod-davelopment-booking.webp', alt: 'QR-kód a foglalóoldalhoz letöltés és nyomtatás gombbal — davelopment booking', caption: 'A QR-kód letölthető és nyomtatható.' },
      },
    ],
    closing: 'A hírlevél, az értékelés és a QR-kód együtt hozza vissza a vendégeket — mindhárom a csomagod része.',
  },
  {
    slug: 'fizetes-eloleg-szamlazas',
    kind: 'tipp',
    category: 'Pénz',
    date: '2026. november 11.',
    title: 'Fizetés, előleg és számlázás: így állítsd be',
    excerpt: 'Stripe összekötése, előleg foglaláskor, automatikus számla a Számlázz.hu vagy Billingo fiókodból, és a számlák egy helyen.',
    intro: 'A vendégek kártyás fizetése a saját Stripe-fiókodba érkezik — a rendszer nem kezeli a pénzedet. Ez az útmutató megmutatja, hogyan kötöd össze a fizetést, hogyan kérsz előleget, és hogyan készül magától a számla.',
    sections: [
      {
        title: 'A Stripe összekötése',
        body: 'Az online fizetéshez (előleg, utalvány) a saját Stripe-fiókodat kötöd össze. Pár perc az egész, és a vendégek pénze ezután egyenesen hozzád érkezik.',
        steps: [
          'Nyisd meg a Beállítások › Fizetés & számlázás menüt.',
          'Koppints a Stripe összekötésére, és kövesd a Stripe lépéseit (ehhez a cég- és bankszámla-adataid kellenek).',
          'Ha kész, a Stripe mellett az Összekötve felirat jelenik meg.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/automatikus-szamla-davelopment-booking.webp', alt: 'Stripe és Számlázz.hu összekötve — davelopment booking', caption: 'A Stripe és a számlázó összekötve.' },
      },
      {
        title: 'Előleg kérése foglaláskor',
        body: 'Az előleg csökkenti a meg nem jelenést: aki előre fizet, jóval nagyobb eséllyel eljön, vagy időben lemond. Előleget csak automatikus megerősítésnél kérhetsz — ha kézi jóváhagyást használsz, a beállításnál egy gombbal átkapcsolhatsz.',
        steps: [
          'Nyisd meg a Beállítások › Előleg menüt, és kapcsold be az előleg kérését.',
          'Válaszd ki, mely foglalásoknál: mindig, egy ár felett, vagy kiemelt napokon.',
          'Add meg az összeget: fix összeg, vagy az ár bizonyos százaléka.',
          'Állítsd be a díjmentes lemondás határidejét: 12 vagy 24 óra.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/eloleg-davelopment-booking.webp', alt: 'Az előleg beállításai — davelopment booking', caption: 'Mikor, mennyit, és meddig mondható le díjmentesen.' },
        note: 'Ha a vendég a határidőn belül lemond, az előleget automatikusan visszakapja.',
      },
      {
        title: 'Automatikus számla',
        body: 'Összekötöd a Számlázz.hu vagy Billingo fiókodat, és minden kártyás fizetés után a számla magától elkészül a nevedre, a vendég pedig e-mailben kapja meg. Beállíthatod, hogy az üzlet számlázzon, vagy szakemberenként külön.',
        steps: [
          'A Fizetés & számlázás alatt válaszd a számlázó összekötését.',
          'Add meg a Számlázz.hu vagy Billingo fiókod kulcsát.',
          'Válaszd ki, ki számláz: az üzlet vagy a szakemberek külön.',
        ],
        figure: { kind: 'visual', group: 'money', index: 2, caption: 'A számla magától elkészül, és a vendég megkapja.' },
      },
      {
        title: 'Számlák egy helyen',
        body: 'A Beállítások › Számlák alatt minden vendég-fizetést és bizonylatot látsz: előleget, ajándékutalványt és a helyszíni fizetést. Ami a számlázódból ment, letölthető. A foglalásnál vagy utalványnál a számlaszámra koppintva is ide jutsz, és rögtön megnyílik az a számla.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/szamlak-davelopment-booking.webp', alt: 'A Számlák lista kiállított számlákkal — davelopment booking', caption: 'Minden számla és bizonylat egy listában.' },
      },
      {
        title: 'ÁFA az utalványnál és az előlegnél',
        body: 'Az utalvány és az előleg befizetésekor az ÁFA még nem keletkezik: ilyenkor áfa nélküli bizonylat megy. A beváltáskor vagy a látogatáskor a teljes összeget számlázod, és az utalvány vagy az előleg ott fizetési mód.',
      },
    ],
    closing: 'Foglalásonkénti jutalék nincs: csak a havidíjat fizeted, a kártyás fizetéseknél pedig a Stripe saját tranzakciós díja érvényes.',
  },
  {
    slug: 'foglalooldal-es-megosztas',
    kind: 'tipp',
    category: 'Foglalóoldal',
    date: '2026. november 11.',
    title: 'Foglalóoldal és megosztás: weboldal, Google Cégprofil, QR',
    excerpt: 'A saját foglalóoldalad szerkesztése, a „Időpont foglalása” gomb a Google Cégprofilon, és a foglalási szabályok.',
    intro: 'A foglalóoldal a saját weboldalad, ahol a vendégek foglalnak. Ez az útmutató megmutatja, hogyan szerkeszted, hogyan kötöd a Google Cégprofilodhoz, és milyen szabályok szerint foglalhatnak rajta.',
    sections: [
      {
        title: 'Szerkesztés az élő szerkesztőben',
        body: 'A foglalóoldalt közvetlenül az oldalon szerkeszted: a borítóképet, a bemutatkozást, az elérhetőségeket és a nyitvatartást. Több nyelven is megadhatod a szövegeket.',
        steps: [
          'Nyisd meg a Beállítások › Foglalóoldal menüt.',
          'Koppints arra a részre, amit módosítanál — szöveget írhatsz, képet cserélhetsz.',
          'Ha kész, koppints a Közzététel gombra.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/bemutatkozo-weboldal-davelopment-booking.webp', alt: 'A foglalóoldal élő szerkesztője közzététel gombbal — davelopment booking', caption: 'Ahogy szerkeszted, úgy fog kinézni.' },
      },
      {
        title: 'Foglalási szabályok',
        body: 'A szabályokkal döntöd el, hogyan foglalhatnak: meddig előre, milyen időközzel, kell-e telefonszám, és hogy a foglalás azonnal megerősített legyen-e, vagy jóváhagyásra várjon.',
        figure: { kind: 'visual', group: 'booking', index: 1, caption: 'Nyitvatartás, jóváhagyás, időköz — egy helyen.' },
      },
      {
        title: '„Időpont foglalása” gomb a Google Cégprofilon',
        body: 'Ha a Google Cégprofilodra kiteszed a foglalóoldalad linkjét, a Google-keresésben és a térképen is megjelenik a foglalás gomb.',
        steps: [
          'Nyisd meg a Beállítások › Google Cégprofil menüt, és másold ki a foglalási linket.',
          'Nyisd meg a business.google.com oldalt a céges fiókoddal, és válaszd ki a vállalkozásod.',
          'A Foglalások › Foglalási link résznél illeszd be a linket.',
          'A rendszerben kapcsold be a „Beállítottam a Google-nél” jelölést.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/google-cegprofil-davelopment-booking.webp', alt: 'A Google Cégprofil foglalási linkjének beállítása — davelopment booking', caption: 'Három lépés a Google-nél.' },
      },
      {
        title: 'Értékelés a foglalóoldalon',
        body: 'Ha összekötötted a Google-profilodat, az értékelésed és a csillagaid a foglalóoldalon is megjelennek — ez bizalmat ad az új vendégeknek.',
      },
      {
        title: 'QR-kód és megosztás',
        body: 'A foglalóoldal linkjét tedd ki az Instagram- és Facebook-oldaladra, a névjegyedre, és QR-kóddal a kirakatra. A QR-kódot a Beállítások › Foglalóoldal alatt töltöd le vagy nyomtatod ki.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/qr-kod-davelopment-booking.webp', alt: 'QR-kód a foglalóoldalhoz — davelopment booking', caption: 'Beolvasva a foglalóoldalad nyílik meg.' },
      },
    ],
    closing: 'Minél több helyen ott a link, annál több vendég foglal magától — telefon nélkül.',
  },
  {
    slug: 'statisztikak',
    kind: 'tipp',
    category: 'Statisztikák',
    date: '2026. november 11.',
    title: 'Statisztikák: foglalások, bevétel, visszatérő vendégek',
    excerpt: 'A Statisztikák oldal megmutatja, hogyan teljesít az üzleted: a foglalások aránya, a bevétel, a visszatérő vendégek és a legerősebb napok.',
    intro: 'A Statisztikák a foglalásaidból számolnak, nincs mit beírnod. A számokból kiderül, mely napok és időszakok a legerősebbek, és hol van még szabad kapacitás.',
    sections: [
      {
        title: 'Az időszak kiválasztása',
        body: 'Felül választod ki az időszakot (például a hét, a hónap vagy egyedi). A rendszer minden számot az előző, azonos hosszú időszakhoz is hasonlítja.',
      },
      {
        title: 'Teljesített, függő, lemondott',
        body: 'A sáv megmutatja, a foglalások hány százaléka teljesült, hány függő és hány lett lemondva. Alatta a foglalások száma, a bevétel és a visszatérő vendégek aránya.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/statisztikak-davelopment-booking.webp', alt: 'A Statisztikák oldal heti eloszlással és bevétellel — davelopment booking', caption: 'A legfontosabb számok egy képernyőn.' },
      },
      {
        title: 'Heti eloszlás és bevétel alakulása',
        body: 'A heti eloszlás megmutatja, melyik nap a legerősebb — a csúcsnap sárgával kiemelve. A bevétel alakulásán az aktuális és az előző időszak görbéje együtt látszik.',
        figure: { kind: 'visual', group: 'team', index: 2, caption: 'Heti bevétel és foglalásszám.' },
      },
      {
        title: 'Részletek és export',
        body: 'Bármelyik kártyát kinyithatod a részletekért. Az adatokat CSV-be is exportálhatod napi, heti vagy havi bontásban.',
      },
      {
        title: 'Munkatársként',
        body: 'Munkatársként — a jogaidtól függően — a saját foglalásaid statisztikáját látod, nem az egész üzletét.',
      },
    ],
    closing: 'A számok alapján érdemes finomhangolni a nyitvatartást és a kapacitást — például a gyenge napokra akciót hirdetni a hírlevélben.',
  },
  {
    slug: 'nyitvatartas-es-kinalat',
    kind: 'tipp',
    category: 'Nyitvatartás',
    date: '2026. november 11.',
    title: 'Nyitvatartás, szolgáltatások és asztalok',
    excerpt: 'Mikor lehet foglalni, mit lehet foglalni: a nyitvatartás és a kivételek, a szolgáltatások (szalon), és a termek és asztalok (étterem).',
    intro: 'Az online foglalás csak a nyitvatartáson belül lehetséges, és csak arra, amit kínálsz: szalonban a szolgáltatásokra, étteremben a szabad asztalokra. Ez az útmutató megmutatja, hogyan állítod be őket.',
    sections: [
      {
        title: 'Nyitvatartás',
        body: 'Naponként külön sávokat adsz meg — például ebéd és vacsora külön. A foglalható időpontok ezekből számolódnak.',
        steps: [
          'Nyisd meg a Nyitvatartás oldalt.',
          'Add meg naponként a nyitás és a zárás idejét, akár több sávban.',
          'Mentsd el.',
        ],
        figure: { kind: 'visual', group: 'booking', index: 1, caption: 'A nyitvatartás a foglalási szabályokkal együtt dönt.' },
      },
      {
        title: 'Kivételek: ünnepnap, zárva tartás',
        body: 'Egy-egy napra eltérő nyitvatartást vagy zárást adhatsz meg — például ünnepnapra vagy szabadságra. Ezeken a napokon a foglalóoldal is ennek megfelelően kínál időpontot.',
      },
      {
        title: 'Szalon: szolgáltatások',
        body: 'Minden szolgáltatáshoz árat és időtartamot adsz meg — az időtartamból és a köztük lévő szünetből számolódnak a szabad időpontok. A szolgáltatásokat kategóriákba rendezheted, és a sorrendjüket húzással állítod be.',
        steps: [
          'Nyisd meg a Szolgáltatások oldalt, és adj hozzá új szolgáltatást.',
          'Add meg a nevét, az árát és az időtartamát.',
          'A munkatárs profilján rendeld hozzá, ki végzi.',
        ],
      },
      {
        title: 'Szalon: munkatársanként eltérő idő',
        body: 'A szalon nyitvatartása az alap minden munkatársnak. Ha valaki egy napon máskor dolgozik vagy szabadnapos, azt a Naptárban rögzíted — a foglalóoldalon arra az időre csak a valóban ráérő munkatárs választható.',
      },
      {
        title: 'Étterem: termek és asztalok',
        body: 'Felveszed a termeidet (zónáidat) és az asztalokat férőhellyel. Nagyobb társaságnak asztalokat vonhatsz össze, és szezonális teremet (például nyári teraszt) is megadhatsz. A rendszer a létszám alapján dönti el, hol fér el a társaság.',
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/elo-asztalallapot-davelopment-booking.webp', alt: 'Asztalok termenként, élő foglaltsággal — davelopment booking', caption: 'Termek és asztalok, élő állapottal.' },
      },
      {
        title: 'Étterem: ülésidő',
        body: 'Az ülésidővel szabályozod, mennyi időre foglal le egy társaság egy asztalt — ez dönti el, hányszor fordulhat egy asztal egy este.',
      },
    ],
    closing: 'Ha a nyitvatartás és a kínálat pontos, a foglalóoldal mindig csak valóban szabad időpontot kínál — nincs átfedés, nincs üresjárat.',
  },
  {
    slug: 'foglalasok-kezelese',
    kind: 'tipp',
    category: 'Foglalások',
    date: '2026. november 11.',
    title: 'Foglalások: így kezeld a napodat lépésről lépésre',
    excerpt: 'A Foglalások oldal a mindennapi munka közepe: itt látod a napot, itt veszel fel új foglalást, hagysz jóvá, és itt követed a vendéget az érkezéstől a távozásig.',
    intro: 'A Foglalások oldalon egy helyen látod a nap minden foglalását — az online érkezőket és a telefonon vagy személyesen felvetteket is. Ez az útmutató végigvezet mindenen, amit itt meg tudsz csinálni, szalonban és étteremben is.',
    sections: [
      {
        title: 'Mit látsz a Foglalások oldalon',
        body: 'Felül a nap számai: hány foglalás megerősített, hány függő (jóváhagyásra vár), mennyi a szabad hely, és hány lett lemondva. Alatta a napváltó (Ma és a hét napjai), majd a nap idővonala óránként — a mostani óra sárgával kiemelve. Szalonban munkatársanként, étteremben asztalonként és termenként látod, ki mikor érkezik.',
        figure: { kind: 'shot', src: '/landing/hero/foglalasok-idovonal-davelopment-booking.webp', alt: 'A Foglalások oldal napi idővonala telefonon — davelopment booking', caption: 'A nap idővonala: felül a számok, alatta a napváltó és a foglalások óránként.' },
      },
      {
        title: 'Nap, hét vagy hónap',
        body: 'A napot óráról órára, a hetet és a hónapot rácsban is átnézheted. A heti és havi nézetben a zárt napok szürkén jelennek meg, így rögtön látod, hol van még hely.',
        steps: [
          'Koppints a fejlécben a Nézet és szűrők gombra (a csúszkák ikon).',
          'Válaszd a napi, heti vagy havi nézetet.',
          'A napváltón lapozz előre-hátra, vagy koppints egy napra, hogy annak a foglalásait lásd.',
        ],
      },
      {
        title: 'Az online foglalások maguktól megjelennek',
        body: 'Amikor a vendég a foglalóoldaladon foglal, a foglalás azonnal megjelenik az idővonalon, és értesítést kapsz a csengőnél — telefonon is, ha az appot telepítetted. Nem kell semmit átírnod vagy felvinned.',
        figure: { kind: 'visual', group: 'home', index: 1, caption: 'Új online foglalás érkezik — értesítést kapsz róla.' },
      },
      {
        title: 'Új foglalás felvétele telefonos vagy beeső vendégnek',
        body: 'Ha a vendég telefonon hív vagy személyesen érkezik, pár koppintással rögzíted a foglalást — ugyanúgy megjelenik az idővonalon, mint az online foglalások.',
        steps: [
          'Koppints a fejléc + gombjára.',
          'Kezdd el írni a vendég nevét vagy telefonszámát. Ha járt már nálad, a rendszer felajánlja, és egy koppintással kitölti az adatait.',
          'Szalonban válassz szolgáltatást, munkatársat és időpontot. Étteremben add meg a létszámot, a napot és az időpontot — az asztalt a rendszer ajánlja a termek és asztalok alapján.',
          'Mentsd el a foglalást.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/gyors-felvetel-davelopment-booking.webp', alt: 'Új foglalás felvétele, korábbi vendég adataival kitöltve — davelopment booking', caption: 'Korábbi vendégnél a rendszer kitölti az adatokat.' },
        note: 'Étteremben, ha sietsz, név nélkül is rögzítheted a foglalást: ilyenkor „Beeső” vagy „Telefon” alapnév kerül rá.',
      },
      {
        title: 'Jóváhagyásra váró foglalások',
        body: 'Ha kézi jóváhagyást állítottál be, az online foglalások függő állapotban érkeznek. Az oldal alján egy sötét sáv jelzi, hány foglalás vár rád — a legrégebbi elöl.',
        steps: [
          'Koppints a sáv Megnézem gombjára.',
          'Nézd át a foglalást: a vendéget, az időpontot és — ha kérsz — az előleget.',
          'Döntsd el: Jóváhagyom vagy Elutasítom. Jóváhagyáskor a vendég megkapja a visszaigazolást.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/jovahagyas-davelopment-booking.webp', alt: 'Jóváhagyásra váró foglalás a Jóváhagyom és Elutasítom gombokkal — davelopment booking', caption: 'Egy koppintás a jóváhagyás.' },
        note: 'A beállításokban automatikus jóváhagyásra is válthatsz: ekkor minden szabad időpontra érkező foglalás azonnal megerősített lesz.',
      },
      {
        title: 'A vendég érkezése: megérkezett, nem jött el',
        body: 'A foglalásra koppintva alulról felcsúszik a részletes lap: a vendég adatai, a foglalás ideje, a megjegyzés, és az ide tartozó gombok. Ha a vendég késik, a lap ezt is jelzi.',
        steps: [
          'Koppints a foglalásra az idővonalon vagy a listában.',
          'Érkezéskor nyomd meg a Megérkezett gombot.',
          'Ha a vendég nem jön el, a Nem jött el gombot — ez bekerül a vendég előzményeibe, így legközelebb is látod.',
          'A Hívás gombbal közvetlenül felhívhatod a vendéget.',
        ],
      },
      {
        title: 'Áthelyezés másik időpontra, munkatárshoz vagy asztalhoz',
        body: 'Az idővonalon a foglalást egyszerűen áthúzhatod másik időpontra — szalonban másik munkatárshoz, étteremben másik asztalhoz is. Ha az új hely ütközne egy másik foglalással, a rendszer jelzi, mielőtt elmentenéd. A részletes lap Áthelyezés gombjával ugyanezt húzás nélkül is megteheted.',
      },
      {
        title: 'Net nélkül is működik',
        body: 'Ha megszakad az internet, nem áll meg a munka: a foglalásokat ugyanúgy felveheted, a rendszer az eszközön tartja őket.',
        steps: [
          'Netkiesésnél felül narancssárga sáv jelzi: vázlat módban dolgozol.',
          'Az új foglalásokat ugyanúgy felveszed — az eszközön maradnak.',
          'Amint visszajön a net, a rendszer ellenőrzi, nem foglalta-e le közben valaki online ugyanazt az időpontot. Az ütközőket külön jelzi, a többit egy gombbal véglegesíted.',
        ],
        figure: { kind: 'shot', src: '/landing/funkciok/mobil/offline-mod-davelopment-booking.webp', alt: 'Vázlat mód netkiesésnél a Foglalások oldalon — davelopment booking', caption: 'Netkiesésnél vázlat módban dolgozol tovább.' },
      },
      {
        title: 'A nap listája papíron',
        body: 'Ha a pultnál vagy a konyhában papíron is kéznél akarod tartani a nap vendégeit, a Foglalások oldal tetején a nyomtató gombbal nyomtatható listában nyitod meg a kiválasztott napot: idő szerint sorban, a vendég nevével, létszámával, idejével és a megjegyzéssel.',
        note: 'A böngésző nyomtatási ablakából PDF-be is mentheted, és elküldheted a csapatnak.',
      },
    ],
    closing: 'Ha még nincs fiókod, a davelopment booking ingyen kipróbálható, bankkártya nélkül — a Foglalások oldalt az első perctől használhatod.',
    relatedIndustrySlugs: ['fodrasz-idopontfoglalas', 'etterem-asztalfoglalas'],
  },
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
    relatedIndustrySlugs: ['fodrasz-idopontfoglalas', 'etterem-asztalfoglalas', 'csapatkezeles-vallalkozasoknak'],
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
    relatedIndustrySlugs: ['csapatkezeles-vallalkozasoknak', 'fodrasz-idopontfoglalas', 'etterem-asztalfoglalas'],
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
    relatedIndustrySlugs: ['csapatkezeles-vallalkozasoknak', 'maganrendelo-idopontfoglalas', 'etterem-asztalfoglalas'],
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
    relatedIndustrySlugs: ['fodrasz-idopontfoglalas', 'kozmetikus-idopontfoglalas', 'csapatkezeles-vallalkozasoknak'],
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
    relatedIndustrySlugs: ['etterem-asztalfoglalas', 'csapatkezeles-vallalkozasoknak'],
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
    relatedIndustrySlugs: ['csapatkezeles-vallalkozasoknak', 'fodrasz-idopontfoglalas', 'etterem-asztalfoglalas'],
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
    slug: 'audit-naplo-vallalkozasban',
    category: 'Biztonság',
    date: '2026. augusztus 1.',
    title: 'Audit-napló a vállalkozásban: ki módosított mit, és miért fontos ezt tudni',
    excerpt: 'Nem a bizalmatlanságról szól — arról, hogy egy vitás helyzetben percek alatt kiderüljön, mi történt valójában.',
    intro: 'Amint egynél többen nyúlnak a rendszeredhez, előbb-utóbb felmerül egy kérdés: ki törölte azt a foglalást, ki módosította az árat. Az audit-napló nem a bizalmatlanság eszköze, hanem egy biztonsági háló, amit remélhetőleg sosem kell komolyan használnod — de ha mégis, percek alatt választ ad.',
    sections: [
      { title: 'Ne csak azt lásd, MI történt, hanem KI és MIKOR csinálta', body: 'Egy jó napló nem csak azt mutatja, hogy egy foglalás törölve lett, hanem azt is, melyik munkatárs törölte, és pontosan mikor — ez különbözteti meg a valódi audit-naplót egy egyszerű módosítás-időbélyegtől.' },
      { title: 'Legyen visszakereshető visszamenőleg, ne csak az elmúlt pár napra', body: 'Egy vitás helyzet gyakran csak hetekkel később derül ki — ha a napló csak pár napig őrzi az adatokat, éppen akkor nem lesz mit visszanézni, amikor a legjobban kellene.' },
      { title: 'Ne tegye lassabbá a napi munkát', body: 'Az audit-napló háttérben kell fusson, anélkül hogy bárkinek külön adminisztrációs terhet jelentene — ha valakinek külön be kell jegyeznie, mit csinált, azt előbb-utóbb el fogják hagyni.' },
    ],
    closing: 'A davelopment bookingban minden módosítás automatikusan, láthatóan naplózva van — ki, mit, mikor változtatott —, 90 napra visszamenőleg kereshető a Beállítások alatt, minden plusz adminisztráció nélkül.',
    relatedIndustrySlugs: ['csapatkezeles-vallalkozasoknak', 'fodrasz-idopontfoglalas', 'maganrendelo-idopontfoglalas'],
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

/** A kézikönyv-oldalak sorrendje = az app menüjének sorrendje (a Tippek fülön így jelennek meg); a többi utána. */
const MANUAL_ORDER = ['elso-lepesek', 'attekintes', 'foglalasok-kezelese', 'statisztikak', 'vendegek-kezelese', 'nyitvatartas-es-kinalat', 'munkatarsak-es-jogok', 'naptar-beosztas', 'utalvanyok', 'marketing-hirlevel-ertekeles', 'fizetes-eloleg-szamlazas', 'foglalooldal-es-megosztas']
const manualRank = (slug: string) => { const i = MANUAL_ORDER.indexOf(slug); return i < 0 ? MANUAL_ORDER.length : i }

export const TIPS: Tip[] = [...RAW_TIPS].sort((a, b) => manualRank(a.slug) - manualRank(b.slug))
  // élesben: a kézikönyv-útmutatók (kind 'tipp') mind + a kiadott cikkek; a többi cikk csak fejlesztésben látszik
  // (2026-11-14, Dave: az útmutatók mehetnek, az új cikkeket még át kell gondolni)
  .filter((t) => process.env.NODE_ENV === 'development' || t.kind === 'tipp' || PUBLISHED_TIP_SLUGS.has(t.slug))
  .map((t) => ({ ...t, image: TIP_IMAGES[t.slug] }))

export function getTip(slug: string): Tip | undefined {
  return TIPS.find((t) => t.slug === slug)
}
