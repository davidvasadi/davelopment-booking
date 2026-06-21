/**
 * A marketing landing TELJES tartalma — egy helyen, magyarul.
 *
 * Miért itt: a szekció-komponensek tartalom-mentesek (propból kapják a szöveget), így
 * a copy egy helyen szerkeszthető, a komponensek pedig máshol (kampány-oldal, étterem-
 * specifikus landing) is újrahasználhatók. A NYELV elsődlegesen magyar (nincs i18n a
 * landingen); külföldi terjeszkedéskor ez a fájl válik nyelv-kulcsossá.
 *
 * A dinamikus értékek (árak, próbaidő) NEM itt vannak — azok a `pricing` propból jönnek
 * (backstage-ben szerkeszthető globális árazás), és a komponens fűzi össze a szöveggel.
 */

export const NAV = {
  brand: 'schedulio',
  brandSuffix: 'by [davelopment]®',
  links: [
    { label: 'Rólunk', href: '#rolunk' },
    { label: 'Értékelések', href: '#ertekelesek' },
    { label: 'Kapcsolat', href: '#kapcsolat' },
  ],
  login: { label: 'Bejelentkezés', href: '/login' },
} as const

export const HERO = {
  badge: 'Próbáld ki 30 napig ingyen.',
  titleLines: ['Online', 'Időpontfoglaló.'],
  body: 'Hagyd, hogy az ügyfeleid maguk foglaljanak – te csak a munkádra figyelj. Éttermeknek, fodrászatoknak, kis vállalkozásoknak.',
  primaryCta: { label: 'Regisztrálj ingyen', href: '/register' },
  loginPrompt: 'Van már fiókod?',
  loginCta: { label: 'Bejelentkezés', href: '/login' },
  demoCta: { label: 'Demó megtekintése', href: '/davelopment' },
  scrollCue: 'GÖRGESS LEJJEBB',
  // A jobb oldali sárga blokk lebegő kártyája:
  floatCardTitle: 'Kezeld okosan a vállalkozásod',
  floatCardNote: 'tól', // a teljes szöveg a komponensben: `${ár} Ft-tól`
} as const

/** A sárga futószalag elemei (3 sorban, ismétlődve). */
export const MARQUEE_ITEMS = [
  'CSONTKOVÁCS',
  'ÉTTEREM',
  'FODRÁSZAT',
  'JÓGA',
  'FOGÁSZAT',
  'SZEMÉLYI EDZŐ',
  'KOZMETIKA',
  'MASSZÁZS',
] as const

export const DEMO = {
  label: '(Demo)',
  titleLines: ['Lásd működés', 'közben.'],
  intro: 'Gyakran felmerülő kérdések. Itt vagyunk, hogy segítsünk.',
  availableBadge: 'Elérhető',
  cardTitleLines: ['Nézd át mielőtt', 'regisztrálsz.'],
  cardBody: 'Kattints körbe egy élő demó-fiókban — pontosan azt látod, amit az ügyfeleid és te is látnátok.',
  cta: { label: 'Megnyitom a demót', href: '/davelopment' },
} as const

export const VISION = {
  label: '(Our Vision)',
  // NEM végleges copy — placeholder a Schedulio üzenetével (a template angol „Built Different…" helyett).
  lines: [
    'Foglalj egyszerűen',
    'Dolgozz nyugodtan',
    'Növekedj bátran',
    'Mi a háttérben',
    'Te a vendégeiddel',
  ],
  footnote: '(Görgess tovább)',
} as const

export const FEATURES = {
  label: '(Szolgáltatások)',
  cta: { label: 'Kipróbálom ingyen', href: '/register' },
  note: 'Válaszd ki, melyik passzol a vállalkozásodhoz. Mindkettő 14 napig ingyenes, kártya nélkül.',
  items: [
    { n: '001', title: 'Saját foglalási oldal' },
    { n: '002', title: 'Azonnali értesítések' },
    { n: '003', title: 'Bevétel & statisztikák' },
    { n: '004', title: 'Teljes dashboard' },
  ],
} as const

export const PRICING = {
  label: '(Árazás)',
  titleLines: ['Egyszerű', 'tiszta árazás.'],
  note: 'Válaszd ki, melyik passzol a vállalkozásodhoz. Mindkettő 14 napig ingyenes, kártya nélkül.',
  plans: {
    starter: {
      tag: '(Starter)',
      body: 'Időpontfoglalás szalonoknak, fodrászoknak, masszőröknek, kozmetikusoknak.',
      cta: { label: 'Kipróbálom ingyen', href: '/register' },
    },
    pro: {
      tag: '(Pro)',
      body: 'Asztalfoglalás éttermeknek — kapacitás, asztaltérkép, csoportok, előleg.',
      cta: { label: 'Kipróbálom ingyen', href: '/register-restaurant' },
    },
  },
} as const

export const TESTIMONIALS = {
  label: '(Értékelések)',
  title: 'Most 30 napig ingyen.',
  body: 'Próbáld ki minden funkcióval, kötöttség nélkül.',
  primaryCta: { label: 'Regisztráció', href: '/register' },
  socialTitle: 'Több mint 1000 vállalkozás használja már — csatlakozz te is!',
  socialCount: '+1K',
  rateCta: { label: 'Értékelj minket', href: '#ertekelesek' },
} as const

export const FAQ = {
  label: '(FAQ)',
  titleLines: ['Gyakran', 'kérdezik.'],
  intro: 'Gyakran felmerülő kérdések. Itt vagyunk, hogy segítsünk.',
  items: [
    {
      q: 'Mennyibe kerül a Schedulio?',
      a: 'A Starter csomag 2 900 Ft/hó (időpontfoglalás), a Pro 9 900 Ft/hó (asztalfoglalás étteremnek). Mindkettő 14 napig ingyenes, kártya nélkül.',
    },
    {
      q: 'Kell bankkártyaadatokat megadni a próbaidőhöz?',
      a: 'Nem. A 14 napos próbaidőhöz csak egy email cím és jelszó szükséges. Kártyaadatokat csak akkor kérünk, ha az ingyenes időszak után is folytatnád.',
    },
    {
      q: 'Mennyi ideig tart beállítani?',
      a: 'Pár perc. Regisztrálsz, felveszed a szolgáltatásaidat (vagy asztalaidat) és a nyitvatartást — a foglalási oldalad azonnal él.',
    },
    {
      q: 'Hány munkatársat és szolgáltatást adhatok hozzá?',
      a: 'Korlátlanul. A szolgáltatások és a nyitvatartás szabadon bővíthető; szalonnál az első munkatárs ingyenes.',
    },
    {
      q: 'Kapnak visszaigazolást az ügyfeleim?',
      a: 'Igen. Minden foglalásról automatikus, márkázott email megy az ügyfélnek (naptár-meghívóval), és neked is értesítés érkezik.',
    },
  ],
} as const

export const FOOTER = {
  brand: 'schedulio',
  titleLines: ['Online', 'Időpontfoglaló.'],
  body: 'Hagyd, hogy az ügyfeleid maguk foglaljanak – te csak a munkára figyelj. Éttermeknek, fodrászatoknak, kis vállalkozásoknak. Próbáld ki 30 napig ingyen.',
  copyright: '©2026 Schedulio * hello@davelopment.hu',
  linksTitle: 'Gyors linkek',
  links: [
    { label: 'Kezdőlap', href: '#' },
    { label: 'Árak', href: '#arazas' },
    { label: 'Kapcsolat', href: '#kapcsolat' },
    { label: 'Értékelések', href: '#ertekelesek' },
  ],
  cta: { label: 'Ingyenes Regisztráció', href: '/register' },
  poweredBy: 'Powered by',
  poweredByBrand: '[davelopment]®',
  bigWord: 'Csatlakozz',
} as const
