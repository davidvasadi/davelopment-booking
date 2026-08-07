import { SITE_URL } from '@/lib/publicSeo'

export type TipSection = { title: string; body: string }

export type Tip = {
  slug: string
  category: string
  date: string
  title: string
  excerpt: string
  intro: string
  image: string
  sections: TipSection[]
  /** Záró bekezdés — a davelopment booking mint megoldás, a valódi tanácsok UTÁN. */
  closing: string
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
  'no-show-csokkentese': '/landing/tips/noshow-arany-javitas-tippek-davelopment-booking.png',
  'emlekeztetok-automatizalasa': '/landing/tips/emlekeztetok-amik-novelik-a-hatekonysagot-davelopment-booking.png',
  'mikor-eri-meg-online-foglalo': '/landing/tips/mikor-eri-meg-online-foglalot-bevezetni-davelopment-booking.png',
  'csapat-beosztas-hatekonyan': '/landing/tips/csapat-beosztas-hatekonyan-davelopment-booking.png',
  'torzsvendegek-megtartasa': '/landing/tips/hogyan-tartsd-meg-a-torzsvendegeidet-ne-csak-ujakat-szerezz.png',
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
    closing: 'Ha kettőnél többre igent mondtál, itt az idő — a davelopment booking 22 napig ingyen kipróbálható, kártya nélkül.',
  },
  {
    slug: 'csapat-beosztas-hatekonyan',
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
  },
  {
    slug: 'emlekeztetok-automatizalasa',
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
  },
]

export const TIPS: Tip[] = RAW_TIPS.map((t) => ({ ...t, image: TIP_IMAGES[t.slug] }))

export function getTip(slug: string): Tip | undefined {
  return TIPS.find((t) => t.slug === slug)
}
