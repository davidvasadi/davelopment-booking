import { ftFmt, type LandingPricing } from '@/components/landing/types'

/**
 * A GYIK kérdés-listája — az árazás-függő válaszok a propból épülnek. Nem 'use client' fájl,
 * mert a landing FAQ-accordion (kliens) ÉS a FAQPage JSON-LD (szerver, `page.tsx`) is ugyanezt
 * az egy forrást olvassa — így a látható szöveg és a strukturált adat sosem csúszhat szét.
 * A kérdések célzottan keresés-releváns, természetes megfogalmazásúak (SEO), és mindegyik
 * mindkét üzlettípusra (szakember + étterem) választ ad, ahol releváns — nincs típus-specifikus
 * duplikáció. Szándékosan "szakember"-t mondunk "szalon" helyett a felhasználó felé — a termék
 * egyéni szolgáltatóknak (fodrász, kozmetikus, masszőr stb.) is szól, nem csak szalon-cégeknek.
 */
export function buildFaqItems(
  pricing: LandingPricing,
  /** Iparági landingeknél az elejére fűzött, az adott szakmának szóló extra kérdések — a landing
   *  így RÖGTÖN a szakmára szabott kérdésekkel nyit, nem egy generikus listával a végén elrejtve. */
  extraItems: { q: string; a: string }[] = [],
) {
  return [
    ...extraItems,
    {
      q: 'Mi az a davelopment booking?',
      a: 'Online időpont- és asztalfoglaló rendszer szakembereknek és éttermeknek — fodrászoknak, kozmetikusoknak, masszőröknek, edzőknek és hasonló szolgáltatóknak, illetve vendéglátóhelyeknek. A vendégeid a saját, egyedi foglalási oldaladon keresztül maguk foglalhatnak időpontot vagy asztalt, te pedig egy helyen kezeled a naptárat, a munkatársakat, az értesítéseket és a fizetéseket.',
    },
    {
      q: 'Mennyibe kerül a davelopment booking?',
      a: `Szakembereknek Starter csomag ${ftFmt(pricing.salon_starter_huf)}/hó-tól, Pro csomag ${ftFmt(pricing.salon_pro_huf)}/hó. Éttermeknek Starter ${ftFmt(pricing.restaurant_starter_huf)}/hó-tól, Pro ${ftFmt(pricing.restaurant_pro_huf)}/hó (asztalfoglalással). Nagyobb vagy egyedi igényekhez Egyedi csomagot is kínálunk, egyeztetett árral. Minden csomag ${pricing.trial_days} napig ingyenesen kipróbálható, bankkártya nélkül.`,
    },
    {
      q: 'Kell bankkártyaadatokat megadni a próbaidőhöz?',
      a: `Nem. A ${pricing.trial_days} napos próbaidőhöz csak egy email cím és jelszó szükséges. Kártyaadatokat csak akkor kérünk, ha az ingyenes időszak után is folytatnád az előfizetést.`,
    },
    {
      q: 'Mennyi ideig tart beállítani az online foglalási rendszert?',
      a: 'Az első profil — névvel, szolgáltatásokkal és nyitvatartással — kb. 5 perc alatt elkészíthető. Utána máris megosztható a saját foglalási link a vendégeiddel, akár a Google Cégem-profilodon vagy a közösségi médiában is.',
    },
    {
      q: 'Hány munkatársat és szolgáltatást adhatok hozzá?',
      a: `Korlátlan számú szolgáltatást és munkatársat hozzáadhatsz, mindegyiknek saját elérhetőségi naptárral. Szakembereknél az alapdíj az első főt tartalmazza, minden további +${ftFmt(pricing.salon_extra_staff_huf)}/hó — pontosan annyit fizetsz, amekkora a csapatod. Éttermeknél a havidíj fix, függetlenül a személyzet létszámától.`,
    },
    {
      q: 'Kapnak visszaigazolást az ügyfeleim a foglalásról?',
      a: 'Igen. Minden foglalásnál automatikusan küldünk visszaigazoló emailt a vendégnek a foglalás részleteivel, és emlékeztetőt is az időpont előtt — ez csökkenti a nem-megjelenéseket.',
    },
    {
      q: 'Éttermeknek és szakembereknek is megfelel?',
      a: 'Igen. A szakember-csomagok időpontfoglalásra optimalizáltak — fodrászoknak, körömtechnikusoknak, kozmetikusoknak, masszőröknek és edzőknek egyaránt, akár egyéni vállalkozóként, akár szalon-csapatban dolgozol. Az étterem-csomagok asztalfoglalásos logikával dolgoznak: kapacitáskezelés, asztaltérkép, csoportfoglalás és opcionális előleg-kérés.',
    },
    {
      q: 'Be lehet kérni előleget a vendégektől foglaláskor?',
      a: 'Igen. Bekapcsolhatod, hogy bizonyos foglalásoknál a vendég bankkártyával előre fizessen egy előleget — ez jelentősen csökkenti a nem-megjelenéseket. A pénz közvetlenül a saját Stripe-fiókodba érkezik, a platform sosem fér hozzá a vendég kártyaadataihoz.',
    },
    {
      q: 'Lehet ajándékutalványt árulni az oldalamon keresztül?',
      a: 'Igen, ez is bekapcsolható funkció: a vendégeid közvetlenül a saját foglalási oldaladon vásárolhatnak ajándékutalványt, amit később bármelyik szolgáltatásodra beválthatnak.',
    },
    {
      q: 'Van beépített hírlevél-küldés a vendégeimnek?',
      a: 'Igen, minden csomag tartalmaz havi hírlevél-küldési keretet — nincs hozzá külön, önállóan fizetendő szolgáltatás. A keret mérete a választott csomagtól függ.',
    },
  ]
}
