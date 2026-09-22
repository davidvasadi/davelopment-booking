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
    seoTitle: 'Online időpontfoglaló fodrászoknak | davelopment booking',
    seoDescription:
      'Csapatkezeléssel, előleg-védelemmel és ajándékutalvánnyal — online időpontfoglaló fodrászatoknak. Próbáld ki ingyen, bankkártya nélkül.',
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
    seoTitle: 'Online időpontfoglaló kozmetikusoknak | davelopment booking',
    seoDescription:
      'Szépségszalonoknak, kozmetikáknak készült online időpontfoglaló, ajándékutalvány-értékesítéssel és vendég-analitikával. Próbáld ki ingyen, bankkártya nélkül.',
  },

  // ── Műkörmös — az ajándékutalvány (körömépítés mint ajándék) és a kezelések közti
  // pihenőidő (a zselé/porcelán szárad) a legerősebb, valóban ide illő érv.
  'mukormos-idopontfoglalas': {
    slug: 'mukormos-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló műkörmösöknek.',
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
    seoTitle: 'Online időpontfoglaló műkörmösöknek | davelopment booking',
    seoDescription:
      'Műkörmösöknek készült online időpontfoglaló, ajándékutalvány-értékesítéssel és beépített pihenőidő-kezeléssel. Próbáld ki ingyen, bankkártya nélkül.',
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
    seoTitle: 'Online időpontfoglaló masszőröknek | davelopment booking',
    seoDescription:
      'Masszőröknek és terapeutáknak készült online időpontfoglaló, beépített pihenőidő-kezeléssel — egyénileg is, csapatban is. Próbáld ki ingyen, bankkártya nélkül.',
  },

  // ── Csontkovács — bizalmi, egészségügyi jellegű kezelés: a digitális beleegyező
  // nyilatkozat és az emlékeztető (drága kimaradt alkalom) a legvalóságosabb érv.
  'csontkovacs-idopontfoglalas': {
    slug: 'csontkovacs-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló csontkovácsoknak.',
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
    seoTitle: 'Online időpontfoglaló csontkovácsoknak | davelopment booking',
    seoDescription:
      'Csontkovácsoknak készült online időpontfoglaló, digitális beleegyező nyilatkozattal és automatikus emlékeztetővel. Próbáld ki ingyen, bankkártya nélkül.',
  },

  // ── Fogorvos — a kezelési beleegyező nyilatkozat és a drága, kihagyott időpontok elleni
  // emlékeztető+előleg a legvalóságosabb, ide illő érv.
  'fogorvos-idopontfoglalas': {
    slug: 'fogorvos-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló fogorvosoknak.',
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
    seoTitle: 'Online időpontfoglaló fogorvosoknak | davelopment booking',
    seoDescription:
      'Fogorvosi rendelőknek készült online időpontfoglaló, digitális beleegyező nyilatkozattal és előleg-védelemmel. Próbáld ki ingyen, bankkártya nélkül.',
  },

  // ── Magánrendelő — általános magánrendelő/szakrendelés (nem kifejezetten fogászat): a
  // jogosultságkezelés (több szakember egy rendelőben) és a beleegyező nyilatkozat a fő érv.
  'maganrendelo-idopontfoglalas': {
    slug: 'maganrendelo-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló magánrendelőknek.',
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
    seoTitle: 'Online időpontfoglaló magánrendelőknek | davelopment booking',
    seoDescription:
      'Magánrendelőknek, szakrendeléseknek készült online időpontfoglaló, jogosultságkezeléssel és digitális beleegyező nyilatkozattal. Próbáld ki ingyen, bankkártya nélkül.',
  },

  // ── Barber — jellemzően több borbélyos, közösségi-média-erős szakma: a csapat-naptár és a
  // foglalási link megosztása (Instagram bio-link) a valódi, ide illő érv.
  'barber-idopontfoglalas': {
    slug: 'barber-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló barber szalonoknak.',
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
    seoTitle: 'Online időpontfoglaló barber szalonoknak | davelopment booking',
    seoDescription:
      'Barber szalonoknak készült online időpontfoglaló, csapat-naptárral és közösségi-média-megosztható foglalási linkkel. Próbáld ki ingyen, bankkártya nélkül.',
  },

  // ── Személyi edző — gyakran több helyszínen (terem, szabadtér) dolgozik, a Google/Apple
  // naptár-szinkron és az előleg-védelem a legvalóságosabb, ide illő érv.
  'szemelyi-edzo-idopontfoglalas': {
    slug: 'szemelyi-edzo-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló személyi edzőknek.',
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
    seoTitle: 'Online időpontfoglaló személyi edzőknek | davelopment booking',
    seoDescription:
      'Személyi edzőknek és fitneszoktatóknak készült online időpontfoglaló, Google/Apple naptár-szinkronnal. Próbáld ki ingyen, bankkártya nélkül.',
  },

  // ── Pilates — jellemzően több oktatós stúdió: a csapat-naptár/jogosultság és az
  // előleg-védelem (drága óra, drága kihagyás) a legvalóságosabb érv.
  'pilates-idopontfoglalas': {
    slug: 'pilates-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló pilates stúdióknak.',
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
    seoTitle: 'Online időpontfoglaló pilates stúdióknak | davelopment booking',
    seoDescription:
      'Pilates stúdióknak és oktatóknak készült online időpontfoglaló, csapat-naptárral és naptár-szinkronnal. Próbáld ki ingyen, bankkártya nélkül.',
  },

  // ── Jóga — hasonlóan a pilateszhez: több oktatós stúdiók, a naptár-szinkron (gyakran
  // több helyszínen tanítanak) és a csapat-jogosultság a fő érv.
  'joga-idopontfoglalas': {
    slug: 'joga-idopontfoglalas',
    segment: 'salon',
    heroTitle: 'Online időpontfoglaló jóga oktatóknak.',
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
    seoTitle: 'Online időpontfoglaló jóga oktatóknak | davelopment booking',
    seoDescription:
      'Jóga stúdióknak és oktatóknak készült online időpontfoglaló, naptár-szinkronnal és ajándékutalvány-értékesítéssel. Próbáld ki ingyen, bankkártya nélkül.',
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
    seoTitle: 'Online asztalfoglalás éttermeknek | davelopment booking',
    seoDescription:
      'Éttermeknek készült online asztalfoglaló rendszer, valós idejű kapacitáskezeléssel és borravaló-elosztással. Próbáld ki ingyen, bankkártya nélkül.',
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
    seoTitle: 'Csapatkezelő rendszer kisvállalkozásoknak | davelopment booking',
    seoDescription:
      'Munkatárs-jogosultságkezelés, beosztás- és szünetkezelés, audit-napló — mindez online időpontfoglalással egy rendszerben. Próbáld ki ingyen, bankkártya nélkül.',
  },
}

/** Fenntartott slugok — regisztrációnál/slug-módosításnál ezekkel nem foglalhat el egy üzlet. */
export const RESERVED_INDUSTRY_SLUGS: string[] = Object.keys(INDUSTRY_LANDINGS)
