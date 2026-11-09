/**
 * Iparág-specifikus SEO landing oldalak tartalma — a `/[slug]` route szolgálja ki (nem lehet
 * külön `[industry]` dinamikus mappa a `[slug]` mellett, a Next.js egy mappaszinten csak EGY
 * dinamikus szegmens-nevet enged). A route az induláskor megnézi, szerepel-e a kért slug ebben
 * a listában — ha igen, ezt a landinget rendereli üzlet-keresés helyett.
 *
 * A landing a homepage TELJES összeállítását újrahasznosítja (`HomeClient`), csak a szöveg-vezérelt
 * szekciók (hero, "Hogyan működik", "Csapat", CTA-banner, GYIK) cserélődnek iparáganként, az
 * Árazás szegmens-váltója pedig fixre áll — a Marquee és a "Látod mi történik" (SegmentToggle)
 * szekció csak a főoldalon jelenik meg.
 *
 * FONTOS tartalmi elv: minden oldal a rendszer VALÓS, ellenőrzött funkcióira épül (RBAC/csapat-
 * jogosultság, Stripe-előleg, automata számlázás Számlázz.hu/Billingo-ból, ajándékutalvány, napi
 * borravaló-elosztás, vendég-térkép/analitika, tiltólista, digitális beleegyező nyilatkozat,
 * Google/Apple naptár-szinkron) — szakmánként MÁST kiemelve, ami arra a szakmára ténylegesen
 * releváns, nem egy generikus, egymással felcserélhető szöveg-sablon.
 *
 * FONTOS a slugokról: ezek a szalon/étterem regisztráció és slug-módosítás során FENNTARTOTTNAK
 * számítanak (lásd `RESERVED_INDUSTRY_SLUGS` export) — egy üzlet nem választhatja ezeket
 * sajátjának, különben elfedné ezt a landinget.
 */
export type IndustryLanding = {
  slug: string
  /** Az Árazás szekció szegmens-váltója ezen a landingen fix erre — nincs "Szakember/Étterem" toggle. */
  segment: 'salon' | 'restaurant'
  heroTitle: string
  heroSubtitle: string
  howItWorksTitle: string
  howItWorksSubtitle: string
  /** A "Hogyan működik" 3 lépésének cím/szövege, szakmára szabva (a képek megosztottak maradnak). */
  howItWorksSteps: { title: string; body: string }[]
  /** A "Látod mi történik" (SegmentToggle) fejléce. */
  segmentToggleTitle: string
  segmentToggleSubtitle: string
  /** A "Naptár" szekció fejléce. */
  calendarTitle: string
  calendarSubtitle: string
  teamTitle: string
  teamSubtitle: string
  ctaTitle: string
  /** A "Vélemények" szekció "Csatlakozz..." sora. */
  testimonialsJoinLine: string
  /** Az adott szakmának szóló GYIK-pontok — a lista ELEJÉRE kerülnek (a globális GYIK elé), hogy a landing rögtön szakma-specifikus tartalommal nyisson. */
  faqItems: { q: string; a: string }[]
  seoTitle: string
  seoDescription: string
  /** 2-3 rokon iparág slugja — belső linkelés a landing alján ("Kapcsolódó iparágak"), hogy a
   *  Google topikus klaszterként lássa a 13 oldalt, ne 13 elszigetelt lapként. */
  relatedSlugs: string[]
  /** Egyedi szakmai blokk (400–500 szó): a szakma konkrét helyzete és hogy a rendszer mit old
   *  meg benne — ettől lesz az oldal valóban egyedi, nem cserélt szavas sablon (SEO: nem doorway). */
  deepDive?: { label: string; title: string; intro: string; scenes: { time: string; title: string; body: string }[] }
}

export const INDUSTRY_LANDINGS: Record<string, IndustryLanding> = {
  // ── Fodrász — csapatos szalonok jellemzőek, a jogosultságkezelés + a hosszabb (festés,
  // dauer) kezelések előleg-védelme a legerősebb, ténylegesen releváns érv.
  'fodrasz-idopontfoglalas': {
    slug: 'fodrasz-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és csapatkezelés fodrászoknak.',
    heroSubtitle:
      'Minden fodrásznak saját naptára és egyedi jogköre van — te átlátod az egész szalont, ők csak a sajátjukat, foglalás közben pedig a vendégeid maguk választanak szabad időpontot.',
    howItWorksTitle: 'Indulj el fodrászként 3 lépésben.',
    howItWorksSubtitle: 'Add hozzá a csapatod, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá a szolgáltatásaid', body: 'Vedd fel a hajvágást, festést, dauert — mindegyiknek saját időtartammal és árral.' },
      { title: 'Oszd meg a foglalási linket', body: 'A vendégeid megnyitják, kiválasztják a fodrászt és az időpontot — app nélkül.' },
      { title: 'Hívd meg a csapatod', body: 'Minden fodrász saját naptárral és jogosultsággal dolgozik — ha most egyedül indulsz, bármikor bővítheted.' },
    ],
    segmentToggleTitle: 'Látod mi történik a fodrászatodban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a szalonod',
    calendarTitle: 'Minden fodrász naptára, egy képernyőn.',
    calendarSubtitle: 'Valós idejű foglalások, munkatárs-sávok, szabadnapok — húzd át, kattints, kész.',
    teamTitle: 'Ki mit lát, ki mit módosíthat — te döntöd el.',
    teamSubtitle: 'Egyedi jogosultsági szintek munkatársanként: van, aki csak a saját naptárát, van, aki mindent kezelhet.',
    ctaTitle: 'Vezesd a fodrászatod egy helyről.',
    testimonialsJoinLine: 'Csatlakozz a fodrászatokhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Több fodrász dolgozik nálunk — mindenkinek külön jogosultsága lehet?',
        a: 'Igen. A beépített jogosultságkezelővel munkatársanként állítható, ki láthatja/módosíthatja csak a saját naptárát, és ki férhet hozzá a szalon egészéhez (bevétel, csapat, beállítások) — nem mindenki lát mindent alapból.',
      },
      {
        q: 'Egy festés/dauer lemondása nagyobb bevételkiesés — hogyan véded ezt?',
        a: 'Bekapcsolhatod, hogy a hosszabb, drágább kezeléseknél a vendég bankkártyával előleget fizessen a foglaláskor — ez a saját Stripe-fiókodba érkezik, és jelentősen csökkenti a késői lemondást.',
      },
      {
        q: 'Lehet ajándék hajvágást/festést árulni utalvány formájában?',
        a: 'Igen, az ajándékutalvány-értékesítés beépített funkció — a vendégeid közvetlenül a foglalási oldaladon vásárolhatnak utalványt, amit bármelyik szolgáltatásodra beválthatnak.',
      },
    ],
    seoTitle: 'Fodrász Időpontfoglaló Rendszer Egyénileg és Csapatban | davelopment booking',
    seoDescription:
      'Fodrász időpontfoglaló rendszer egyénileg és csapatban is — jogosultságkezeléssel, előleg-védelemmel, ajándékutalvánnyal. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['barber-idopontfoglalas', 'kozmetikus-idopontfoglalas', 'mukormos-idopontfoglalas'],
  },

  // ── Kozmetikus — az ajándékutalvány (szépségápolási kezelés mint ajándék) és a
  // vendég-eredet-elemzés a legerősebb, valóban ide illő érv.
  'kozmetikus-idopontfoglalas': {
    slug: 'kozmetikus-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és ajándékutalvány-értékesítés kozmetikusoknak.',
    heroSubtitle:
      'A vendégeid maguktól foglalnak kezelést a neten, ajándékba pedig utalványt is vásárolhatnak közvetlenül a saját oldaladon — nem kell külön rendszer hozzá.',
    howItWorksTitle: 'Indulj el kozmetikusként 3 lépésben.',
    howItWorksSubtitle: 'Add fel a kezeléseid, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá a kezeléseid', body: 'Arckezelés, smink, körömépítés — mindegyik saját időtartammal és árral.' },
      { title: 'Oszd meg a foglalási linket', body: 'A vendégeid megnyitják, kiválasztják a kezelést és az időpontot — app nélkül.' },
      { title: 'Kapcsold be az ajándékutalványt', body: 'Egy kattintással már ajándékutalványt is árulhatsz a foglalási oldaladon.' },
    ],
    segmentToggleTitle: 'Látod mi történik a szalonodban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a szalonod',
    calendarTitle: 'Minden kezelés, egy naptárban.',
    calendarSubtitle: 'Valós idejű foglalások, munkatárs-sávok, szabadnapok — húzd át, kattints, kész.',
    teamTitle: 'Lásd, honnan jönnek a vendégeid.',
    teamSubtitle: 'Élő analitika és vendég-térkép mutatja, mely környékről érkezik a legtöbb foglalás.',
    ctaTitle: 'Tartsd kézben a szalonod minden percét.',
    testimonialsJoinLine: 'Csatlakozz a szépségszalonokhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Lehet ajándékutalványt árulni a szalonom oldalán?',
        a: 'Igen, ez beépített funkció: a vendégeid közvetlenül a foglalási oldaladon vásárolhatnak ajándékutalványt, amit később bármelyik kezelésedre beválthatnak — kezelés nélküli, önálló bevételi forrás.',
      },
      {
        q: 'Kezelhetek több különböző kezeléstípust (arckezelés, smink, körömépítés) egy naptárban?',
        a: 'Igen, korlátlan számú szolgáltatást vehetsz fel saját időtartammal és árral — a vendég a foglaláskor pontosan azt választja ki, amire szüksége van.',
      },
      {
        q: 'Honnan tudom, melyik környékről érkeznek a vendégeim?',
        a: 'A beépített vendég-térkép és élő analitika a foglalási adatokból mutatja, mely városrészekből jön a legtöbb vendég — ez segít eldönteni, hol érdemes hirdetni.',
      },
    ],
    seoTitle: 'Kozmetikus Időpontfoglaló Rendszer Ajándékutalvánnyal | davelopment booking',
    seoDescription:
      'Kozmetikus időpontfoglaló rendszer ajándékutalvány-értékesítéssel, vendég-térképpel és élő analitikával — lásd, honnan jönnek a vendégeid. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['mukormos-idopontfoglalas', 'fodrasz-idopontfoglalas', 'joga-idopontfoglalas'],
  },

  // ── Műkörmös — az ajándékutalvány (körömépítés mint ajándék) és a kezelések közti
  // pihenőidő (a zselé/porcelán szárad) a legerősebb, valóban ide illő érv.
  'mukormos-idopontfoglalas': {
    slug: 'mukormos-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és ajándékutalvány-értékesítés műkörmösöknek.',
    heroSubtitle:
      'A vendégeid maguktól foglalnak időpontot a neten, ajándékutalványt is vásárolhatnak, a kezelések közé pedig beállíthatsz pihenőidőt, hogy sose csússzon egymásra két vendég.',
    howItWorksTitle: 'Indulj el műkörmösként 3 lépésben.',
    howItWorksSubtitle: 'Add fel a szolgáltatásaid, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá a szolgáltatásaid', body: 'Zselé, porcelán, manikűr — mindegyiknek saját időtartammal, árral és pihenőidővel.' },
      { title: 'Oszd meg a foglalási linket', body: 'A vendégeid megnyitják, kiválasztják a szolgáltatást és az időpontot — app nélkül.' },
      { title: 'Indulj el — egyedül vagy csapatban', body: 'Ha most egyedül dolgozol, bármikor bővítheted csapattal, mindenki saját naptárral.' },
    ],
    segmentToggleTitle: 'Látod mi történik a szalonodban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a szalonod',
    calendarTitle: 'Minden foglalás, egy naptárban.',
    calendarSubtitle: 'Valós idejű foglalások, pihenőidők, szabadnapok — húzd át, kattints, kész.',
    teamTitle: 'Egyedül is, csapatban is ugyanolyan egyszerű.',
    teamSubtitle: 'Egy fő esetén csak az alapdíjat fizeted — több körmössel pedig mindenki a saját naptárával dolgozik.',
    ctaTitle: 'Tartsd kézben a szalonod minden percét.',
    testimonialsJoinLine: 'Csatlakozz a körmösszalonokhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Lehet ajándékutalványt árulni a szalonom oldalán?',
        a: 'Igen, ez beépített funkció: a vendégeid közvetlenül a foglalási oldaladon vásárolhatnak ajándékutalványt, amit később bármelyik szolgáltatásodra beválthatnak.',
      },
      {
        q: 'Be tudok állítani pihenőidőt a kezelések közé?',
        a: 'Igen, minden szolgáltatásnál beállíthatsz puffer-időt a kezelés után, hogy legyen időd felkészülni a következő vendégre, és sose csússzon egymásra két foglalás.',
      },
      {
        q: 'Mi van, ha egy vendég lemondja az utolsó pillanatban az időpontot?',
        a: 'Automatikus emlékeztető megy ki minden foglalás előtt, ami csökkenti a lemondásokat — igény esetén előleg-kérést is bekapcsolhatsz a nem-megjelenések ellen.',
      },
    ],
    seoTitle: 'Műkörmös Időpontfoglaló Rendszer Ajándékutalvánnyal | davelopment booking',
    seoDescription:
      'Műkörmös időpontfoglaló rendszer ajándékutalvány-értékesítéssel és beépített pihenőidő-kezeléssel a kezelések között. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['kozmetikus-idopontfoglalas', 'fodrasz-idopontfoglalas', 'masszor-idopontfoglalas'],
  },

  // ── Masszőr — jellemzően egyéni/kis praxis, a kezelések közti pihenő-idő (puffer) és a
  // szóló-vállalkozói árazás a legvalóságosabb érv, nem a "csapatkezelés".
  'masszor-idopontfoglalas': {
    slug: 'masszor-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló masszőröknek — egyénileg is, csapatban is.',
    heroSubtitle:
      'Állíts be pihenőidőt minden kezelés után, hogy sose csússzon egymásra két vendég — a naptárad eközben a neten magától telik meg.',
    howItWorksTitle: 'Indulj el masszőrként 3 lépésben.',
    howItWorksSubtitle: 'Add fel a kezeléseid a pihenőidővel együtt, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá a kezeléseid', body: 'Svéd, sportmasszázs, reflexológia — mindegyiknek saját időtartammal, árral és pihenőidővel.' },
      { title: 'Oszd meg a foglalási linket', body: 'A vendégeid megnyitják, kiválasztják a kezelést és az időpontot — app nélkül.' },
      { title: 'Indulj el — egyedül vagy csapatban', body: 'Egy fő esetén csak az alapdíjat fizeted, bármikor bővítheted.' },
    ],
    segmentToggleTitle: 'Látod mi történik a praxisodban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a praxisod',
    calendarTitle: 'Minden kezelés, egy naptárban.',
    calendarSubtitle: 'Valós idejű foglalások, pihenőidők — húzd át, kattints, kész.',
    teamTitle: 'Egyedül is, csapatban is ugyanolyan egyszerű.',
    teamSubtitle: 'Egy fő esetén csak az alapdíjat fizeted — a rendszer nem kényszerít rád szalon méretű csomagot.',
    ctaTitle: 'Tartsd kézben a praxisod minden percét.',
    testimonialsJoinLine: 'Csatlakozz a masszőrökhöz és terapeutákhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Be tudom állítani, hogy két masszázs között legyen pihenőidő a naptáramban?',
        a: 'Igen, minden szolgáltatásnál beállíthatsz puffer-időt a kezelés után, hogy sose csússzon egymásra két vendég, és legyen időd felkészülni a következőre.',
      },
      {
        q: 'Egyéni terapeutaként, saját praxisban is megéri, nem csak wellness-központoknak?',
        a: 'Természetesen — egyéni vállalkozóként ugyanúgy használható, mint egy több terapeutás stúdióban. Egy fő esetén csak az alapdíjat fizeted, nincs rákényszerítve fölösleges csapat-funkció.',
      },
      {
        q: 'Kérhetek előleget a vendégtől foglaláskor?',
        a: 'Bekapcsolhatod, hogy bizonyos foglalásoknál a vendég bankkártyával előre fizessen egy előleget a saját Stripe-fiókodba — ez jelentősen csökkenti a nem-megjelenéseket.',
      },
    ],
    seoTitle: 'Masszőr Időpontfoglaló Rendszer Pihenőidő-kezeléssel | davelopment booking',
    seoDescription:
      'Masszőr és terapeuta időpontfoglaló rendszer beépített pihenőidő-kezeléssel — egyénileg is, csapatban is, előleg-védelemmel. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['csontkovacs-idopontfoglalas', 'szemelyi-edzo-idopontfoglalas', 'mukormos-idopontfoglalas'],
  },

  // ── Csontkovács — bizalmi, egészségügyi jellegű kezelés: a digitális beleegyező
  // nyilatkozat és az emlékeztető (drága kimaradt alkalom) a legvalóságosabb érv.
  'csontkovacs-idopontfoglalas': {
    slug: 'csontkovacs-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és digitális beleegyező nyilatkozat csontkovácsoknak.',
    heroSubtitle:
      'A páciensek maguktól foglalnak időpontot a neten, digitálisan fogadják el a beleegyező nyilatkozatot, te pedig automatikus emlékeztetővel csökkented a kihagyott alkalmakat.',
    howItWorksTitle: 'Indulj el csontkovácsként 3 lépésben.',
    howItWorksSubtitle: 'Add fel a kezeléseid, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá a kezeléseid', body: 'Vedd fel a kezeléstípusaid saját időtartammal és a hozzájuk tartozó beleegyező nyilatkozattal.' },
      { title: 'Oszd meg a foglalási linket', body: 'A páciensek megnyitják, kiválasztják az időpontot és digitálisan elfogadják a nyilatkozatot.' },
      { title: 'Indulj el — egyedül vagy csapatban', body: 'Ha most egyedül dolgozol, bármikor bővítheted csapattal, mindenki saját naptárral.' },
    ],
    segmentToggleTitle: 'Látod mi történik a praxisodban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a praxisod',
    calendarTitle: 'Minden páciens-foglalás, egy naptárban.',
    calendarSubtitle: 'Valós idejű foglalások, emlékeztetők, szabadnapok — húzd át, kattints, kész.',
    teamTitle: 'Egyedül is, csapatban is ugyanolyan egyszerű.',
    teamSubtitle: 'Ha többen dolgoztok egy rendelőben, mindenki a saját naptárával és jogosultsági szintjével.',
    ctaTitle: 'Tartsd kézben a praxisod minden percét.',
    testimonialsJoinLine: 'Csatlakozz a csontkovácsokhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Kérhetek digitális beleegyező nyilatkozatot a kezelés előtt?',
        a: 'Igen, beépített funkció: a páciens a foglalás során (vagy helyszínen, tableten) fogadja el a nyilatkozatot — az elfogadás dátummal, IP-vel és a pontos szöveg-verzióval mentődik a foglaláshoz.',
      },
      {
        q: 'Egy kihagyott alkalom nagy bevételkiesés — hogyan csökkented ezt?',
        a: 'Automatikus emlékeztető megy ki minden foglalás előtt, és igény esetén bekapcsolhatod az előleg-kérést is a saját Stripe-fiókodba — ez érdemben csökkenti a nem-megjelenéseket.',
      },
      {
        q: 'Egyéni praxisban, nem csak rendelőintézetben is megéri?',
        a: 'Igen — egyéni vállalkozóként ugyanúgy használható, mint egy több szakemberes rendelőben. Egy fő esetén csak az alapdíjat fizeted.',
      },
    ],
    seoTitle: 'Csontkovács Időpontfoglaló Digitális Beleegyezéssel | davelopment booking',
    seoDescription:
      'Csontkovács időpontfoglaló rendszer digitális beleegyező nyilatkozattal, automatikus emlékeztetővel és előleg-védelemmel. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['fogorvos-idopontfoglalas', 'maganrendelo-idopontfoglalas', 'masszor-idopontfoglalas'],
  },

  // ── Fogorvos — a kezelési beleegyező nyilatkozat és a drága, kihagyott időpontok elleni
  // emlékeztető+előleg a legvalóságosabb, ide illő érv.
  'fogorvos-idopontfoglalas': {
    slug: 'fogorvos-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és előleg-védelem fogorvosi rendelőknek.',
    heroSubtitle:
      'A páciensek maguktól foglalnak időpontot a neten, digitálisan fogadják el a kezelési nyilatkozatot, te pedig automatikus emlékeztetővel és előleg-kéréssel védekezel a kihagyott alkalmak ellen.',
    howItWorksTitle: 'Indulj el fogorvosként 3 lépésben.',
    howItWorksSubtitle: 'Add fel a kezeléseid, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá a kezeléseid', body: 'Vedd fel a kezeléstípusaid saját időtartammal és a hozzájuk tartozó beleegyező nyilatkozattal.' },
      { title: 'Oszd meg a foglalási linket', body: 'A páciensek megnyitják, kiválasztják az időpontot és digitálisan elfogadják a nyilatkozatot.' },
      { title: 'Hívd meg a csapatod', body: 'Fogorvosok, asszisztensek, recepció — mindenki saját naptárral és jogosultsággal.' },
    ],
    segmentToggleTitle: 'Látod mi történik a rendelődben.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a rendelőd',
    calendarTitle: 'Minden fogorvos naptára, egy képernyőn.',
    calendarSubtitle: 'Valós idejű foglalások, munkatárs-sávok, szabadnapok — húzd át, kattints, kész.',
    teamTitle: 'A teljes rendelő, egy képernyőn.',
    teamSubtitle: 'Fogorvosok, asszisztensek, recepció — mindenki a saját jogosultsági szintjével dolgozik egy rendszerben.',
    ctaTitle: 'Tartsd kézben a rendelőd minden percét.',
    testimonialsJoinLine: 'Csatlakozz a fogorvosi rendelőkhöz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Kérhetek digitális beleegyező nyilatkozatot a kezelés előtt?',
        a: 'Igen, beépített funkció: a páciens a foglalás során (vagy helyszínen, tableten) fogadja el a nyilatkozatot — az elfogadás dátummal, IP-vel és a pontos szöveg-verzióval mentődik a foglaláshoz.',
      },
      {
        q: 'Egy kihagyott fogorvosi időpont drága kiesés — hogyan véded ezt?',
        a: 'Bekapcsolhatod, hogy a páciens bankkártyával előleget fizessen a foglaláskor a saját Stripe-fiókodba — ez a legerősebb védelem a nem-megjelenés ellen, az automatikus emlékeztető mellett.',
      },
      {
        q: 'Több fogorvos/asszisztens dolgozik nálunk — mindenkinek külön naptára lesz?',
        a: 'Igen, minden munkatársnak saját naptára van, és a jogosultságkezelővel szabályozod, ki láthatja/módosíthatja csak a sajátját, és ki fér hozzá a rendelő egészéhez.',
      },
    ],
    seoTitle: 'Fogorvosi Időpontfoglaló Rendszer Előleg-védelemmel | davelopment booking',
    seoDescription:
      'Fogorvosi időpontfoglaló rendszer digitális beleegyező nyilatkozattal és előleg-védelemmel a kihagyott időpontok ellen. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['csontkovacs-idopontfoglalas', 'maganrendelo-idopontfoglalas', 'kozmetikus-idopontfoglalas'],
  },

  // ── Magánrendelő — általános magánrendelő/szakrendelés (nem kifejezetten fogászat): a
  // jogosultságkezelés (több szakember egy rendelőben) és a beleegyező nyilatkozat a fő érv.
  'maganrendelo-idopontfoglalas': {
    slug: 'maganrendelo-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és jogosultságkezelés magánrendelőknek.',
    heroSubtitle:
      'A páciensek maguktól foglalnak időpontot a neten, minden szakembernek saját naptára és jogosultsági szintje van, a kezelés előtt pedig digitális nyilatkozatot fogadtathatsz el velük.',
    howItWorksTitle: 'Indulj el magánrendelőként 3 lépésben.',
    howItWorksSubtitle: 'Add fel a szakrendeléseid, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá a szakrendeléseid', body: 'Vedd fel a rendelés-típusaid saját időtartammal és a hozzájuk tartozó beleegyező nyilatkozattal.' },
      { title: 'Oszd meg a foglalási linket', body: 'A páciensek megnyitják, kiválasztják a szakembert és az időpontot — app nélkül.' },
      { title: 'Hívd meg a csapatod', body: 'Több szakember, egy rendszer — mindenki saját naptárral és jogosultsággal.' },
    ],
    segmentToggleTitle: 'Látod mi történik a rendelődben.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a rendelőd',
    calendarTitle: 'Minden szakember naptára, egy képernyőn.',
    calendarSubtitle: 'Valós idejű foglalások, munkatárs-sávok, szabadnapok — húzd át, kattints, kész.',
    teamTitle: 'A teljes rendelő, egy képernyőn.',
    teamSubtitle: 'Több szakember, egy rendszer — mindenki a saját naptárával és jogosultsági szintjével.',
    ctaTitle: 'Tartsd kézben a rendelőd minden percét.',
    testimonialsJoinLine: 'Csatlakozz a magánrendelőkhöz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Több szakember/szakrendelés fut nálunk egy helyen — mindegyiknek külön naptára lesz?',
        a: 'Igen, minden szakembernek külön naptára van a saját elérhetőségével, és a jogosultságkezelővel szabályozod, ki láthatja/módosíthatja csak a sajátját, és ki fér hozzá a rendelő egészéhez.',
      },
      {
        q: 'Kérhetek digitális beleegyező nyilatkozatot a kezelés előtt?',
        a: 'Igen, beépített funkció: a páciens a foglalás során (vagy helyszínen, tableten) fogadja el a nyilatkozatot — az elfogadás dátummal, IP-vel és a pontos szöveg-verzióval mentődik a foglaláshoz.',
      },
      {
        q: 'Mi van, ha egy páciens lemondja az utolsó pillanatban az időpontot?',
        a: 'Automatikus emlékeztető megy ki minden foglalás előtt, ami csökkenti a lemondásokat — igény esetén előleg-kérést is bekapcsolhatsz a kihagyott alkalmak ellen.',
      },
    ],
    seoTitle: 'Magánrendelői Időpontfoglaló Jogosultságkezeléssel | davelopment booking',
    seoDescription:
      'Magánrendelői és szakrendelési időpontfoglaló rendszer jogosultságkezeléssel, digitális beleegyező nyilatkozattal és emlékeztetővel. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['fogorvos-idopontfoglalas', 'csontkovacs-idopontfoglalas', 'csapatkezeles-kisvallalkozasoknak'],
  },

  // ── Barber — jellemzően több borbélyos, közösségi-média-erős szakma: a csapat-naptár és a
  // foglalási link megosztása (Instagram bio-link) a valódi, ide illő érv.
  'barber-idopontfoglalas': {
    slug: 'barber-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és csapat-naptár barber szalonoknak.',
    heroSubtitle:
      'Minden borbélynak külön naptára van a saját elérhetőségével, a foglalási linket pedig egy kattintással megoszthatod Instagramon vagy a bio-linkedben.',
    howItWorksTitle: 'Indulj el barberként 3 lépésben.',
    howItWorksSubtitle: 'Add hozzá a csapatod, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá a szolgáltatásaid', body: 'Hajvágás, szakállformázás — mindegyiknek saját időtartammal és árral.' },
      { title: 'Oszd meg a foglalási linket', body: 'Tedd ki Instagramra vagy a bio-linkedbe — a vendég egy kattintással foglal.' },
      { title: 'Hívd meg a csapatod', body: 'Minden borbély saját naptárral dolgozik — ha most egyedül indulsz, bármikor bővítheted.' },
    ],
    segmentToggleTitle: 'Látod mi történik a barbershopodban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a barbershopod',
    calendarTitle: 'Minden borbély naptára, egy képernyőn.',
    calendarSubtitle: 'Valós idejű foglalások, munkatárs-sávok, szabadnapok — húzd át, kattints, kész.',
    teamTitle: 'A teljes barbershop, egy képernyőn.',
    teamSubtitle: 'Minden borbély a saját naptárát látja — te az egész csapatot egyben, jogosultsági szintekkel szabályozva.',
    ctaTitle: 'Tartsd kézben a barbershopod minden percét.',
    testimonialsJoinLine: 'Csatlakozz a barber szalonokhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Több borbély dolgozik nálunk — mindenkinek külön naptára lesz?',
        a: 'Igen, minden munkatársnak külön naptára van a saját elérhetőségével — a vendég a foglaláskor kiválaszthatja, kihez szeretne menni, és te szabályozod, ki mit láthat/módosíthat a jogosultságkezelővel.',
      },
      {
        q: 'Meg lehet osztani a foglalási linket Instagramon vagy a bio-linkben?',
        a: 'Igen, a saját foglalási oldaladat bármelyik közösségi platformon megoszthatod, akár a bio-linkedbe is beteheted — a vendég egy kattintással foglal, app letöltése nélkül.',
      },
      {
        q: 'Mi van, ha valaki lemondja az időpontot az utolsó pillanatban?',
        a: 'Automatikus emlékeztető megy ki minden foglalás előtt, ami csökkenti a lemondásokat — igény esetén előleg-kérést is bekapcsolhatsz a nem-megjelenések ellen.',
      },
    ],
    seoTitle: 'Barber Szalon Időpontfoglaló Csapat-naptárral | davelopment booking',
    seoDescription:
      'Barber szalon időpontfoglaló rendszer csapat-naptárral és Instagram/bio-linkről megosztható foglalási oldallal. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['fodrasz-idopontfoglalas', 'szemelyi-edzo-idopontfoglalas', 'csapatkezeles-kisvallalkozasoknak'],
  },

  // ── Személyi edző — gyakran több helyszínen (terem, szabadtér) dolgozik, a Google/Apple
  // naptár-szinkron és az előleg-védelem a legvalóságosabb, ide illő érv.
  'szemelyi-edzo-idopontfoglalas': {
    slug: 'szemelyi-edzo-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és naptár-szinkron személyi edzőknek.',
    heroSubtitle:
      'A foglalásaid automatikusan szinkronizálódnak a Google/Apple naptáradba is, így akkor is átlátod a napod, ha teremben és szabadtéren is edzel.',
    howItWorksTitle: 'Indulj el személyi edzőként 3 lépésben.',
    howItWorksSubtitle: 'Add fel az edzéstípusaid, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá az edzéstípusaid', body: 'Személyi, páros, csoportos — mindegyiknek saját időtartammal és árral.' },
      { title: 'Oszd meg a foglalási linket', body: 'A tanítványaid megnyitják, kiválasztják az edzéstípust és az időpontot — app nélkül.' },
      { title: 'Kapcsold be a naptár-szinkront', body: 'A foglalásaid automatikusan megjelennek a saját Google/Apple naptáradban is.' },
    ],
    segmentToggleTitle: 'Látod mi történik az edzőtermedben.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá az edzésszervezésed',
    calendarTitle: 'Minden edzés, egy naptárban.',
    calendarSubtitle: 'Valós idejű foglalások, naptár-szinkron — húzd át, kattints, kész.',
    teamTitle: 'Egyedül is, csapatban is ugyanolyan egyszerű.',
    teamSubtitle: 'Ha többen edzetek egy teremben, mindenki a saját beosztásával látja a foglalásait.',
    ctaTitle: 'Tartsd kézben az edzőtermed minden percét.',
    testimonialsJoinLine: 'Csatlakozz a személyi edzőkhöz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Szinkronizálódik a foglalási naptáram a saját Google/Apple naptáramba?',
        a: 'Igen, egy naptár-feeddel a foglalásaid automatikusan megjelennek a saját Google vagy Apple naptáradban is — nem kell két helyen vezetned a beosztásod.',
      },
      {
        q: 'Egyéni személyi edzőként is megéri, nem csak edzőtermeknek?',
        a: 'Természetesen — egyéni vállalkozóként, teremben bérelt idősávval vagy több edzős stúdióban is használható. Egy fő esetén csak az alapdíjat fizeted.',
      },
      {
        q: 'Kérhetek előleget egy edzésre, hogy ne maradjon üresen a naptáram?',
        a: 'Bekapcsolhatod, hogy a vendég bankkártyával előre fizessen egy előleget a saját Stripe-fiókodba — ez jelentősen csökkenti a kihagyott alkalmakat.',
      },
    ],
    seoTitle: 'Személyi Edző Időpontfoglaló Naptár-szinkronnal | davelopment booking',
    seoDescription:
      'Személyi edző és fitneszoktató időpontfoglaló rendszer Google/Apple naptár-szinkronnal és előleg-védelemmel. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['pilates-idopontfoglalas', 'joga-idopontfoglalas', 'masszor-idopontfoglalas'],
  },

  // ── Pilates — jellemzően több oktatós stúdió: a csapat-naptár/jogosultság és az
  // előleg-védelem (drága óra, drága kihagyás) a legvalóságosabb érv.
  'pilates-idopontfoglalas': {
    slug: 'pilates-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és csapat-naptár pilates stúdióknak.',
    heroSubtitle:
      'A tanítványaid maguktól foglalnak órát a neten, minden oktatónak saját naptára van, a foglalásaid pedig szinkronizálódnak a Google/Apple naptáradba is.',
    howItWorksTitle: 'Indulj el pilates oktatóként 3 lépésben.',
    howItWorksSubtitle: 'Add fel az óratípusaid, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá az óratípusaid', body: 'Csoportos, személyi — mindegyiknek saját időtartammal és árral.' },
      { title: 'Oszd meg a foglalási linket', body: 'A tanítványaid megnyitják, kiválasztják az órát és az időpontot — app nélkül.' },
      { title: 'Hívd meg a csapatod', body: 'Ha többen oktattok egy stúdióban, mindenki saját naptárral és jogosultsággal dolgozik.' },
    ],
    segmentToggleTitle: 'Látod mi történik a stúdiódban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a stúdiód',
    calendarTitle: 'Minden oktató naptára, egy képernyőn.',
    calendarSubtitle: 'Valós idejű foglalások, oktató-sávok — húzd át, kattints, kész.',
    teamTitle: 'Egyedül is, csapatban is ugyanolyan egyszerű.',
    teamSubtitle: 'Ha többen oktattok egy stúdióban, mindenki a saját naptárával és jogosultsági szintjével.',
    ctaTitle: 'Tartsd kézben a stúdiód minden percét.',
    testimonialsJoinLine: 'Csatlakozz a pilates stúdiókhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Több oktató dolgozik nálunk — mindenkinek külön naptára lesz?',
        a: 'Igen, minden oktatónak külön naptára van a saját elérhetőségével, és a jogosultságkezelővel szabályozod, ki láthatja/módosíthatja csak a sajátját, és ki fér hozzá a stúdió egészéhez.',
      },
      {
        q: 'Kérhetek előleget egy órára, hogy ne maradjon üresen a naptárunk?',
        a: 'Bekapcsolhatod, hogy a tanítvány bankkártyával előre fizessen egy előleget a saját Stripe-fiókodba — ez jelentősen csökkenti a kihagyott alkalmakat.',
      },
      {
        q: 'Szinkronizálódik a foglalási naptáram a saját Google/Apple naptáramba?',
        a: 'Egy naptár-feeddel a foglalásaid automatikusan megjelennek a saját naptáradban is — nem kell két helyen vezetned a beosztásod.',
      },
    ],
    seoTitle: 'Pilates Stúdió Időpontfoglaló Csapat-naptárral | davelopment booking',
    seoDescription:
      'Pilates stúdió időpontfoglaló rendszer csapat-naptárral, naptár-szinkronnal és előleg-védelemmel a kihagyott órák ellen. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['joga-idopontfoglalas', 'szemelyi-edzo-idopontfoglalas', 'mukormos-idopontfoglalas'],
  },

  // ── Jóga — hasonlóan a pilateszhez: több oktatós stúdiók, a naptár-szinkron (gyakran
  // több helyszínen tanítanak) és a csapat-jogosultság a fő érv.
  'joga-idopontfoglalas': {
    slug: 'joga-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló és ajándékutalvány-értékesítés jóga oktatóknak.',
    heroSubtitle:
      'A tanítványaid maguktól foglalnak órát a neten, a foglalásaid pedig automatikusan szinkronizálódnak a saját Google/Apple naptáradba is, ha több helyszínen is tanítasz.',
    howItWorksTitle: 'Indulj el jóga oktatóként 3 lépésben.',
    howItWorksSubtitle: 'Add fel az óratípusaid, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Add hozzá az óratípusaid', body: 'Csoportos, személyi — mindegyiknek saját időtartammal és árral.' },
      { title: 'Oszd meg a foglalási linket', body: 'A tanítványaid megnyitják, kiválasztják az órát és az időpontot — app nélkül.' },
      { title: 'Kapcsold be a naptár-szinkront', body: 'A foglalásaid automatikusan megjelennek a saját naptáradban is, ha több helyszínen tanítasz.' },
    ],
    segmentToggleTitle: 'Látod mi történik a stúdiódban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a stúdiód',
    calendarTitle: 'Minden óra, egy naptárban.',
    calendarSubtitle: 'Valós idejű foglalások, oktató-sávok — húzd át, kattints, kész.',
    teamTitle: 'Egyedül is, csapatban is ugyanolyan egyszerű.',
    teamSubtitle: 'Ha többen oktattok egy stúdióban, mindenki a saját naptárával és jogosultsági szintjével.',
    ctaTitle: 'Tartsd kézben a stúdiód minden percét.',
    testimonialsJoinLine: 'Csatlakozz a jóga stúdiókhoz és oktatókhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Szinkronizálódik a foglalási naptáram a saját Google/Apple naptáramba?',
        a: 'Igen, egy naptár-feeddel a foglalásaid automatikusan megjelennek a saját naptáradban is — nem kell két helyen vezetned a beosztásod, akkor sem, ha több helyszínen tanítasz.',
      },
      {
        q: 'Egyéni oktatóként, nem csak stúdióban is megéri?',
        a: 'Természetesen — egyéni vállalkozóként, bérelt teremben vagy több oktatós stúdióban is használható. Egy fő esetén csak az alapdíjat fizeted.',
      },
      {
        q: 'Lehet ajándékbérletet/utalványt árulni az oldalamon?',
        a: 'Az ajándékutalvány-értékesítés beépített funkció — a tanítványaid közvetlenül a foglalási oldaladon vásárolhatnak utalványt, amit később beválthatnak.',
      },
    ],
    seoTitle: 'Jóga Stúdió Időpontfoglaló Ajándékutalvánnyal | davelopment booking',
    seoDescription:
      'Jóga stúdió és oktató időpontfoglaló rendszer naptár-szinkronnal és ajándékutalvány-értékesítéssel, akár több helyszínen is. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['pilates-idopontfoglalas', 'szemelyi-edzo-idopontfoglalas', 'kozmetikus-idopontfoglalas'],
  },

  // ── Étterem — a csoportos foglalás+előleg, a valós idejű kapacitáskezelés és a napi
  // borravaló-elosztás a legerősebb, kifejezetten éttermi érv (nem az időpontfoglalós váz).
  'etterem-asztalfoglalas': {
    slug: 'etterem-asztalfoglalas',
    segment: 'restaurant',
    heroTitle: 'Online asztalfoglalás és csapatkezelés éttermeknek.',
    heroSubtitle:
      'Valós idejű kapacitáskezeléssel mindig pontosan látod, mennyi szabad hely maradt egy adott időpontra — a nagyobb, csoportos foglalásokat pedig opcionális előleggel védheted.',
    howItWorksTitle: 'Indulj el étteremként 3 lépésben.',
    howItWorksSubtitle: 'Add fel az asztalaid és a kapacitást, publikálj, és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Állítsd be az éttermed', body: 'Állítsd be a kapacitást termenként/asztalonként — a rendszer valós időben kezeli a foglaltságot.' },
      { title: 'Oszd meg a foglalási linket', body: 'A vendégeid megnyitják, kiválasztják a létszámot és az időpontot — app nélkül.' },
      { title: 'Hívd meg a csapatod', body: 'Beosztás, jogosultság, napi borravaló-elosztás — mindenki a sajátját látja.' },
    ],
    segmentToggleTitle: 'Látod mi történik az éttermedben.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá az éttermed',
    calendarTitle: 'Minden asztalfoglalás, egy naptárban.',
    calendarSubtitle: 'Valós idejű foglalások, kapacitás, csoportok — húzd át, kattints, kész.',
    teamTitle: 'A teljes csapat, egy képernyőn.',
    teamSubtitle: 'Beosztások, jogosultságok, napi borravaló-elosztás — mindenki látja, ami rá tartozik.',
    ctaTitle: 'Tartsd kézben az éttermed minden percét.',
    testimonialsJoinLine: 'Csatlakozz az éttermekhez, akik már minket használnak.',
    faqItems: [
      {
        q: 'Kezelni tudom a nagyobb, csoportos foglalásokat is?',
        a: 'Igen, a rendszer csoportos foglalásokat is kezel, opcionális előleg-kéréssel — ez különösen fontos ünnepekre, rendezvényekre, hogy ne veszíts bevételt egy le nem mondott nagy asztal miatt.',
      },
      {
        q: 'Látom, hány asztal/férőhely van lefoglalva egy adott időpontra?',
        a: 'Igen, valós idejű kapacitáskezeléssel dolgozik: mindig pontosan látod, mennyi szabad hely maradt egy adott időpontra, így nem foglalhatnak túl.',
      },
      {
        q: 'Hogyan osztjuk el a borravalót a csapat között?',
        a: 'A rendszer napi központi borravaló-összeget kezel, amit automatikusan eloszt a csapat között — mindenki látja a saját részét, nem kell külön Excel-ben vezetni.',
      },
    ],
    seoTitle: 'Éttermi Asztalfoglaló Rendszer Valós Idejű Kapacitással | davelopment booking',
    seoDescription:
      'Éttermi online asztalfoglaló rendszer valós idejű kapacitáskezeléssel, csoportos foglalással és napi borravaló-elosztással. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['kavezo-asztalfoglalas', 'pizzeria-asztalfoglalas', 'fine-dining-asztalfoglalas'],
    deepDive: {
      label: 'Éttermeknek',
      title: 'Egy péntek este, foglalásokkal.',
      intro:
        'Hétköznap egy étterem elboldogul egy füzettel. Péntek este nem. Így néz ki ugyanez az este, amikor a foglalások maguktól érkeznek, és a terem minden asztala egy képernyőn van.',
      scenes: [
        { time: '14:20', title: 'Megtelik a nagyterem, mire kinyitsz', body: 'Délután fél háromra a 18 asztalból 13 foglalt. A vendégek este, a kanapéról foglaltak, a rendszer pedig csak oda engedte őket, ahol tényleg elférnek.' },
        { time: '17:05', title: 'Egy 12 fős céges vacsora előleggel', body: 'Egy cég 12 főre foglal hétfőre. Foglaláskor előleget fizetnek, ami a te Stripe-fiókodba érkezik. Ha mégsem jönnek, nem te maradsz egy üres hosszú asztallal.' },
        { time: '19:40', title: 'Telefonon kérnek egy kétfős asztalt', body: 'A napi idősávon látod, hogy a 7-es asztal 20:30-ig szabad. Rákattintasz, beírod a nevet, kész. A következő online foglaló már nem kapja meg ugyanazt.' },
        { time: '20:15', title: 'A 4-es asztal évfordulót ünnepel', body: 'Foglaláskor jelezték, ezért a napi nézetben ott a kis ikon a nevük mellett. A felszolgáló tudja, mielőtt leülnek, a desszert gyertyával érkezik.' },
      ],
    },
  },

  // ── Kávézó / brunch — reggeli és hétvégi csúcs, sok kis asztal, gyors forgás; a
  // napi idősáv, az emlékeztető és a hétvégi előleg a legerősebb, valós érv.
  'kavezo-asztalfoglalas': {
    slug: 'kavezo-asztalfoglalas',
    segment: 'restaurant',
    heroTitle: 'Online asztalfoglalás kávézóknak és brunch-helyeknek.',
    heroSubtitle:
      'A hétvégi brunch-csúcs ne a telefon mellett teljen: a vendégek maguk foglalnak asztalt, te pedig egy idősávon látod, mikor telik meg a hely.',
    howItWorksTitle: 'Indulj el kávézóként 3 lépésben.',
    howItWorksSubtitle: 'Asztalok, nyitvatartás, link — és már foglalhatnak is',
    howItWorksSteps: [
      { title: 'Vedd fel az asztalaid', body: 'Add meg a termeket és az asztalokat a férőhelyekkel — a rendszer ebből számolja a szabad helyeket.' },
      { title: 'Tedd ki a foglalási linket', body: 'Instagramra, Google-profilra, a kirakatba QR-kóddal — a vendég pár koppintással foglal.' },
      { title: 'Kezeld a csúcsot', body: 'A hétvégi reggeleken egy idősávon látod, ki mikor érkezik és melyik asztal szabadul fel.' },
    ],
    segmentToggleTitle: 'Látod mi történik a kávézódban.',
    segmentToggleSubtitle: 'Tedd nyugodtabbá a hétvégi csúcsot',
    calendarTitle: 'Minden asztal, egy idősávon.',
    calendarSubtitle: 'Érkezések, létszám, felszabaduló asztalok — húzd át, kattints, kész.',
    teamTitle: 'A pult és a felszolgálók, egy képernyőn.',
    teamSubtitle: 'Beosztás, jogosultságok, napi borravaló-elosztás — mindenki látja, ami rá tartozik.',
    ctaTitle: 'Legyen telt ház a hétvégi brunch-on is.',
    testimonialsJoinLine: 'Csatlakozz a kávézókhoz és brunch-helyekhez, akik már minket használnak.',
    faqItems: [
      {
        q: 'Érdemes foglalást bevezetni egy kávézóban?',
        a: 'Hétköznap sokszor nem kell, de a hétvégi brunch-idősávban igen: a foglalással előre látod a forgalmat, nem kell embereket elküldeni, és a sétálóvendégeknek is pontosan tudod mondani, mikor szabadul fel asztal.',
      },
      {
        q: 'Kérhetek előleget csak a hétvégi foglalásokra?',
        a: 'Az előleg bekapcsolható, és a pénz a saját Stripe-fiókodba érkezik. Így a csúcsidős foglalásoknál is van biztosítékod arra, hogy a vendég valóban megjelenik.',
      },
      {
        q: 'Mi van, ha valaki késik vagy nem jön?',
        a: 'A vendég automatikus emlékeztetőt kap a foglalás előtt, ami csökkenti az elmaradásokat. A napi idősávon az asztalt egy mozdulattal áthelyezed vagy felszabadítod.',
      },
    ],
    seoTitle: 'Online Asztalfoglalás Kávézóknak és Brunch-helyeknek | davelopment booking',
    seoDescription:
      'Asztalfoglaló rendszer kávézóknak és brunch-helyeknek: hétvégi csúcs kezelése, napi idősáv, előleg és emlékeztetők. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['etterem-asztalfoglalas', 'pizzeria-asztalfoglalas', 'fine-dining-asztalfoglalas'],
    deepDive: {
      label: 'Kávézóknak',
      title: 'Egy szombat délelőtt a pult mögül.',
      intro:
        'Hétköznap reggel a kávézó csendes. Szombaton tíz és egy között mindenki egyszerre akar leülni. Ez a három óra dönti el a hetet, és nem a telefon mellett kellene eltelnie.',
      scenes: [
        { time: '08:30', title: 'Nyitás előtt már látod a délelőttöt', body: 'Kinyitod a telefont: 10 és 12 között a 14 asztalból 11 foglalt, a legtöbb kétfős. Tudod, hány ember kell a pultba, és mennyi croissant-t érdemes kisütni.' },
        { time: '10:15', title: 'Sor áll az ajtóban', body: 'Egy pár megkérdezi, mikor lesz hely. Ránézel az idősávra: a 3-as asztal 10:45-kor szabadul. Nem tippelsz, pontos időt mondasz nekik.' },
        { time: '11:00', title: 'Valaki nem jön el', body: 'A hétvégi brunch-foglalásokhoz előleget kérsz, ezért ez ritka. Ha mégis előfordul, az asztalt egy mozdulattal felszabadítod, és jöhet a következő vendég az ajtóból.' },
        { time: '12:30', title: 'Egy utalvány, ami magát adja el', body: 'Két vendég a foglalóoldalon ajándékutalványt vesz a barátjuknak. Te közben a pult mögött vagy, a fizetés és a kód magától megy.' },
      ],
    },
  },

  // ── Pizzéria — családi és csoportos foglalások, születésnapok; az alkalmak, a csoportos
  // előleg és a hétvégi esti kapacitás a legerősebb, valós érv.
  'pizzeria-asztalfoglalas': {
    slug: 'pizzeria-asztalfoglalas',
    segment: 'restaurant',
    heroTitle: 'Online asztalfoglalás pizzériáknak.',
    heroSubtitle:
      'Családi vacsorák, szülinapok, baráti társaságok — a vendégek maguk foglalnak, a nagy asztalokat pedig előleggel véded.',
    howItWorksTitle: 'Indulj el pizzériaként 3 lépésben.',
    howItWorksSubtitle: 'Asztalok, link, csapat — és jöhetnek a foglalások',
    howItWorksSteps: [
      { title: 'Vedd fel a termeket és asztalokat', body: 'A nagy, összetolható asztalokat is — a rendszer a férőhelyek alapján kínál időpontot.' },
      { title: 'Oszd meg a foglalási linket', body: 'Google-profil, Facebook, weboldal — a vendég létszámot és időpontot választ, app nélkül.' },
      { title: 'Készülj a nagy társaságokra', body: 'Látod az alkalmat (pl. születésnap) és a létszámot, a nagy asztalnál előleget kérhetsz.' },
    ],
    segmentToggleTitle: 'Látod mi történik a pizzériádban.',
    segmentToggleSubtitle: 'Tedd nyugodtabbá a pénteki estét',
    calendarTitle: 'Minden asztal és társaság, egy idősávon.',
    calendarSubtitle: 'Létszám, alkalom, érkezés — húzd át, kattints, kész.',
    teamTitle: 'A konyha és a terem, egy képernyőn.',
    teamSubtitle: 'Beosztás, jogosultságok, napi borravaló-elosztás — mindenki látja, ami rá tartozik.',
    ctaTitle: 'Legyen tele a pizzéria — üres foglalások nélkül.',
    testimonialsJoinLine: 'Csatlakozz a pizzériákhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Hogyan kezelem a szülinapi és csoportos foglalásokat?',
        a: 'A vendég foglaláskor megadhatja a létszámot és az alkalmat (például születésnap), így előre látod és felkészülhetsz rá. A nagyobb társaságoknál előleget is kérhetsz.',
      },
      {
        q: 'Mi történik, ha egy nagy társaság nem jön el?',
        a: 'Ezt előzi meg az előleg: foglaláskor kártyával fizetik, a pénz a saját Stripe-fiókodba érkezik. Az automatikus emlékeztető pedig a foglalás előtt figyelmeztet.',
      },
      {
        q: 'Felvehetem a telefonos foglalásokat is ugyanide?',
        a: 'Igen. A napi idősávon a szabad helyre kattintva felveszed a telefonos foglalást, így minden foglalás egy helyen van, és nem fordulhat elő dupla foglalás.',
      },
    ],
    seoTitle: 'Online Asztalfoglalás Pizzériáknak Előleggel | davelopment booking',
    seoDescription:
      'Asztalfoglaló rendszer pizzériáknak: csoportos és szülinapi foglalások, alkalmak, előleg a nagy asztalokra, napi idősáv. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['etterem-asztalfoglalas', 'kavezo-asztalfoglalas', 'fine-dining-asztalfoglalas'],
    deepDive: {
      label: 'Pizzériáknak',
      title: 'Egy szülinap péntek este hétkor.',
      intro:
        'Egy pizzéria estéit a nagy társaságok viszik: családok, osztálytalálkozók, gyerekszülinapok. Egy ilyen asztal egész estére foglalt, ezért ha nem jönnek el, az a legdrágább üres hely a teremben.',
      scenes: [
        { time: 'Kedd', title: 'Bejön a foglalás: 14 fő, szülinap', body: 'Egy anyuka online foglal péntek hétre, 14 főre, és bejelöli, hogy születésnap. Foglaláskor előleget fizet. Te már kedden tudod, hogy két asztalt kell összetolni.' },
        { time: 'Csütörtök', title: 'Emlékeztető megy ki', body: 'Péntek előtt a vendég automatikus emlékeztetőt kap. Ha valami változott, most szól, nem pénteken fél hétkor.' },
        { time: 'Péntek 18:40', title: 'A konyha is látja', body: 'A napi nézetben a társaság mellett ott a szülinapi ikon. A konyha tudja, hogy hétkor tizennégy pizza indul egyszerre, és lesz egy torta is.' },
        { time: 'Péntek 21:10', title: 'Visszajönnek-e?', body: 'A vendégkártyán látod, hogy ez a család már harmadszor ünnepel nálatok. Legközelebb a hírlevél viszi el nekik az új menüt.' },
      ],
    },
  },

  // ── Fine dining — magas átlagár, kevés asztal: a no-show itt a legdrágább; az előleg, a
  // kézi jóváhagyás, az alkalmak és a vendégkártya a legerősebb, valós érv.
  'fine-dining-asztalfoglalas': {
    slug: 'fine-dining-asztalfoglalas',
    segment: 'restaurant',
    heroTitle: 'Online asztalfoglalás fine dining éttermeknek.',
    heroSubtitle:
      'Kevés asztal, magas átlagár — itt minden elmaradt foglalás számít. Előleg vagy kézi jóváhagyás, alkalmak és vendégkártya egy rendszerben.',
    howItWorksTitle: 'Indulj el 3 lépésben.',
    howItWorksSubtitle: 'Asztalok, szabályok, link — a foglalások a te feltételeiddel érkeznek',
    howItWorksSteps: [
      { title: 'Állítsd be a termet és az asztalokat', body: 'A férőhelyekkel együtt — a rendszer csak valóban szabad időpontot kínál fel.' },
      { title: 'Határozd meg a szabályokat', body: 'Kérj előleget foglaláskor — vagy előleg nélkül hagyd jóvá te magad minden foglalást.' },
      { title: 'Ismerd meg a vendégeidet', body: 'A vendégkártyán látod a korábbi látogatásokat, az alkalmat és a megjegyzéseidet.' },
    ],
    segmentToggleTitle: 'Látod mi történik az éttermedben.',
    segmentToggleSubtitle: 'Minden asztal, minden vendég — átláthatóan',
    calendarTitle: 'Az egész este, asztalonként.',
    calendarSubtitle: 'Érkezések, alkalmak, létszám — egy idősávon, asztalonként.',
    teamTitle: 'A teljes személyzet, egy képernyőn.',
    teamSubtitle: 'Beosztás, jogosultságok, napi borravaló-elosztás — mindenki látja, ami rá tartozik.',
    ctaTitle: 'Minden asztal, a te feltételeiddel.',
    testimonialsJoinLine: 'Csatlakozz az éttermekhez, akik már minket használnak.',
    faqItems: [
      {
        q: 'Kérhetek előleget minden foglalásnál?',
        a: 'Igen. Bekapcsolhatod, hogy a vendég foglaláskor kártyával előleget fizessen — a pénz a saját Stripe-fiókodba érkezik, a platform sosem fér hozzá a kártyaadatokhoz.',
      },
      {
        q: 'Jóváhagyhatom a foglalásokat, mielőtt véglegesek lesznek?',
        a: 'Igen, előleg nélküli foglalásnál beállíthatod, hogy a foglalások jóváhagyásra várjanak: egy koppintással elfogadod őket az értesítésből, és a vendég automatikusan megkapja a visszaigazolást. Ha előleget kérsz, a foglalás a sikeres fizetéssel magától megerősítődik.',
      },
      {
        q: 'Látom, ha egy vendég különleges alkalomra érkezik?',
        a: 'Igen, a vendég megadhatja az alkalmat (például évforduló vagy születésnap), ez a napi nézetben jelölve látszik, a vendégkártyán pedig a korábbi látogatásait és a megjegyzéseidet is látod.',
      },
    ],
    seoTitle: 'Asztalfoglaló Rendszer Fine Dining Éttermeknek Előleggel | davelopment booking',
    seoDescription:
      'Online asztalfoglalás fine dining éttermeknek: előleg vagy kézi jóváhagyás, alkalmak és vendégkártya — kevesebb no-show. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['etterem-asztalfoglalas', 'pizzeria-asztalfoglalas', 'kavezo-asztalfoglalas'],
    deepDive: {
      label: 'Fine dining',
      title: 'Két hely, kilenc fogás, egy foglalás.',
      intro:
        'Egy fine dining étteremben a konyha napokkal előre dolgozik, minden tányér számolva van. Egy meg nem jelenő kétfős foglalás itt nem üres szék, hanem kidobott alapanyag és egy egész este bevétele.',
      scenes: [
        { time: 'Hétfő', title: 'Foglalás előleggel', body: 'Egy pár szombatra foglal két helyet a kóstolómenüre, és foglaláskor előleget fizet. A pénz a te fiókodba megy. A konyha szombatra már velük számol.' },
        { time: 'Szerda', title: 'Kiderül, hogy évforduló', body: 'A foglalásnál jelezték az alkalmat. A napi nézetben ez látszik, a sommelier és a felszolgáló is tud róla, mielőtt a vendég szólna.' },
        { time: 'Szombat 19:30', title: 'Ismerős vendég érkezik', body: 'A vendégkártyán látod, hogy tavaly is itt voltak, és hogy a hölgy nem eszik kagylót. Ezt nem kell újra megkérdezni.' },
        { time: 'Előleg nélkül?', title: 'Akkor te döntesz', body: 'Ha egy estére nem kérsz előleget, a foglalások jóváhagyásra várnak, és az értesítésből egy koppintással fogadod el őket. A vendég csak ezután kap visszaigazolást.' },
      ],
    },
  },

  // ── Csapatkezelés — nem egy konkrét szakma, hanem egy funkció-szög: azoknak szól, akik
  // elsősorban a munkatársak/beosztás/jogosultság kezelésére keresnek rendszert, nem csak
  // időpontfoglalóra. A jogosultságkezelés, a beosztás/szünet-kezelés és az audit-napló a fő érv.
  'csapatkezeles-kisvallalkozasoknak': {
    slug: 'csapatkezeles-kisvallalkozasoknak',
    segment: 'salon',
    heroTitle: 'Csapatkezelő rendszer kisvállalkozásoknak — időpontfoglalással együtt.',
    heroSubtitle:
      'Egyedi jogosultsági szintek munkatársanként, beosztás- és szünetkezelés, és egy audit-napló, ami mindig mutatja, ki mit módosított — mindezt egy rendszerben az online foglalással.',
    howItWorksTitle: 'Vezesd be a csapatod 3 lépésben.',
    howItWorksSubtitle: 'Hívd meg a munkatársaid, oszd ki a jogköröket, és már látjátok az egészet egyben',
    howItWorksSteps: [
      { title: 'Hívd meg a munkatársaid', body: 'Add hozzá őket névvel, pozícióval — a rendszer betölt egy kész sablont az induláshoz.' },
      { title: 'Oszd ki a jogosultságokat', body: 'Állítsd be munkatársanként, ki lát/módosíthat mit — owner-only jogok + egyedi szerepek.' },
      { title: 'Kövesd nyomon az egészet', body: 'Beosztás, szünetek, audit-napló — egy helyen látod, mi történik a csapatban.' },
    ],
    segmentToggleTitle: 'Látod mi történik a csapatodban.',
    segmentToggleSubtitle: 'Tedd hatékonyabbá a csapatod',
    calendarTitle: 'Minden munkatárs naptára, egy képernyőn.',
    calendarSubtitle: 'Beosztás, szabadnapok, szünetek — húzd át, kattints, kész.',
    teamTitle: 'Ki mit lát, ki mit módosíthat — te döntöd el.',
    teamSubtitle: 'Owner-jogok + egyedi szerepek munkatársanként — nem kell mindenkinek mindenhez hozzáférnie.',
    ctaTitle: 'Vezesd a csapatod egy helyről.',
    testimonialsJoinLine: 'Csatlakozz a kisvállalkozásokhoz, akik már minket használnak.',
    faqItems: [
      {
        q: 'Be tudom állítani, hogy egy munkatárs csak a saját naptárát lássa, ne az egész üzletet?',
        a: 'Igen, a beépített jogosultságkezelővel munkatársanként testre szabható, ki férhet hozzá csak a sajátjához, és ki lát/módosíthat mindent (bevétel, csapat, beállítások) — owner-only jogok mellett egyedi szerepek is kioszthatók.',
      },
      {
        q: 'Nyomon tudom követni, ki módosított mit a rendszerben?',
        a: 'A beépített audit-napló minden érdemi módosítást rögzít (ki, mikor, mit változtatott) — nem kell találgatnod, ha valami eltér a vártól.',
      },
      {
        q: 'Kezelhetem a munkatársak beosztását és szüneteit egy helyen?',
        a: 'Minden munkatársnak saját naptára és beosztása van, napi több szünettel is (pl. ebéd + délutáni pihenő) — te látod át az egész csapat elfoglaltságát egyben.',
      },
    ],
    seoTitle: 'Csapatkezelő Rendszer Kisvállalkozásoknak Audit-naplóval | davelopment booking',
    seoDescription:
      'Munkatárs-jogosultságkezelés, beosztás- és szünetkezelés, audit-napló egy rendszerben az online időpontfoglalással kisvállalkozásoknak. Próbáld ki ingyen, bankkártya nélkül.',
    relatedSlugs: ['fodrasz-idopontfoglalas', 'etterem-asztalfoglalas', 'maganrendelo-idopontfoglalas'],
  },
}

/** Fenntartott slugok — regisztrációnál/slug-módosításnál ezekkel nem foglalhat el egy üzlet. */
export const RESERVED_INDUSTRY_SLUGS: string[] = Object.keys(INDUSTRY_LANDINGS)

/** Rövid, kártyára/chipre illő megnevezés a slughoz — nem a teljes (kulcsszó-optimalizált)
 *  heroTitle, ami mondat-hosszú lenne belső linkeknél. Közös hely, hogy a landing-oldali
 *  "Kapcsolódó iparágak" és a tippek-cikkek alján lévő linkek ne térjenek el egymástól. */
export const INDUSTRY_SHORT_LABEL: Record<string, string> = {
  'fodrasz-idopontfoglalas': 'Fodrász',
  'kozmetikus-idopontfoglalas': 'Kozmetikus',
  'mukormos-idopontfoglalas': 'Műkörmös',
  'masszor-idopontfoglalas': 'Masszőr',
  'csontkovacs-idopontfoglalas': 'Csontkovács',
  'fogorvos-idopontfoglalas': 'Fogorvos',
  'maganrendelo-idopontfoglalas': 'Magánrendelő',
  'barber-idopontfoglalas': 'Barber szalon',
  'szemelyi-edzo-idopontfoglalas': 'Személyi edző',
  'pilates-idopontfoglalas': 'Pilates stúdió',
  'joga-idopontfoglalas': 'Jóga stúdió',
  'etterem-asztalfoglalas': 'Étterem',
  'kavezo-asztalfoglalas': 'Kávézó / brunch',
  'pizzeria-asztalfoglalas': 'Pizzéria',
  'fine-dining-asztalfoglalas': 'Fine dining',
  'csapatkezeles-kisvallalkozasoknak': 'Csapatkezelés',
}
