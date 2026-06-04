'use client'

import { useState } from 'react'
import { Lightbulb, ChevronDown, type LucideIcon } from 'lucide-react'
import {
  CalendarDays, Briefcase, Users, Clock, Settings, BarChart2, Armchair, LayoutDashboard, Printer, Bell,
} from 'lucide-react'

type Variant = 'restaurant' | 'salon'

type Tip = {
  icon: LucideIcon
  title: string
  body: string
  /** Kattintásra kibomló bővebb magyarázat. */
  details: string
  /** Konkrét, lépésszerű tippek a részletekben. */
  bullets: string[]
}

const TIPS: Record<Variant, Tip[]> = {
  restaurant: [
    {
      icon: LayoutDashboard,
      title: 'Áttekintés',
      body: 'A kezdőképernyőn a mai foglalások, a kihasználtság és a legfontosabb számok láthatók egy pillantásra.',
      details: 'Az Áttekintés a napod irányítópultja: rögtön belépés után látod, mi vár rád ma, anélkül hogy bárhová kattintanod kellene.',
      bullets: [
        'A felső számkártyák a mai foglalások számát, a várható vendéglétszámot és a kihasználtságot mutatják.',
        'Bármelyik számkártyára kattintva részletes bontás nyílik meg az adott mutatóról.',
        'A „mai foglalások” listából egy kattintással a Foglalások oldalra ugrasz az adott naphoz.',
      ],
    },
    {
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
    },
    {
      icon: Printer,
      title: 'Napi lista nyomtatása',
      body: 'A Foglalások oldal tetején a nyomtató gombbal a kiválasztott nap foglalásait nyomtatható listában nyitod meg.',
      details: 'Ha a pultnál vagy a konyhában papíron is kéznél akarod tartani a nap vendégeit, a nyomtatható lista letisztult, fekete-fehér formátumban adja ki őket.',
      bullets: [
        'A lista a kiválasztott nap foglalásait tartalmazza idő szerint sorrendben.',
        'Minden sorban ott a vendég neve, létszáma, ideje és a megjegyzés.',
        'A böngésző nyomtatási párbeszédéből PDF-be is mentheted.',
      ],
    },
    {
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
    },
    {
      icon: Clock,
      title: 'Nyitvatartás',
      body: 'Az online foglalás csak a beállított nyitvatartáson belül lehetséges. Itt állítod be a napi sávokat és az ülésidőt.',
      details: 'A nyitvatartás határozza meg, mikor és milyen sűrűn vehetők fel online foglalások. Az ülésidő (mennyi ideig ül egy asztal) befolyásolja, hányszor fordulhat egy asztal egy este.',
      bullets: [
        'Naponként külön sávokat állíthatsz be (pl. ebéd és vacsora külön).',
        'Az ülésidővel szabályozod, mennyi időre foglal le egy vendég egy asztalt.',
        'Egyedi kivételeket adhatsz meg ünnepnapokra vagy zárva tartásra a szokásos nyitvatartás felülírásával.',
      ],
    },
    {
      icon: BarChart2,
      title: 'Statisztika és export',
      body: 'A Statisztikák oldalon követed a kihasználtságot, a lemondásokat és a beesők arányát.',
      details: 'A számok megmutatják, mely napok és sávok a legerősebbek, és hol van tartalék. Jó alap a nyitvatartás vagy a kapacitás finomhangolásához.',
      bullets: [
        'Kihasználtság, lemondási arány és a beesők aránya egy helyen.',
        'Az átlagos ülésidő (dwell) statisztika segít a kapacitástervezésben.',
        'Bármikor exportálhatsz CSV-be napi, heti vagy havi bontásban.',
      ],
    },
    {
      icon: Bell,
      title: 'Értesítések',
      body: 'Új foglalásról és lemondásról a harang ikonnál kapsz értesítést. A Beállításoknál kapcsolhatod ki/be.',
      details: 'Az értesítések gondoskodnak róla, hogy ne maradj le egy új foglalásról vagy lemondásról sem, akkor sem, ha épp nem a foglalási oldalt nézed.',
      bullets: [
        'A fejléc harang ikonján piros jelzés mutatja az olvasatlanokat.',
        'E-mail értesítést is kérhetsz az új foglalásokról.',
        'A Beállításokban szabályozhatod, miről és hogyan kérsz értesítést.',
      ],
    },
    {
      icon: Settings,
      title: 'Beállítások',
      body: 'Itt szabod testre az éttermed adatait, az értesítéseket és a foglalási szabályokat.',
      details: 'A Beállítások a foglalási oldalad és a vendégélmény vezérlőpultja: a cégadatoktól a foglalási feltételekig minden innen állítható.',
      bullets: [
        'Étterem adatai: név, logó, elérhetőségek — ezek jelennek meg a foglalási oldalon és az e-mailekben.',
        'Foglalási szabályok: meddig előre, hány főig, kell-e telefonszám.',
        'Cég- és jogi adatok, valamint a foglalási feltételek a vendégeknek.',
        'A márkázott visszaigazoló e-mailek megjelenése.',
      ],
    },
  ],
  salon: [
    {
      icon: LayoutDashboard,
      title: 'Áttekintés',
      body: 'A kezdőképernyőn a mai időpontok, a bevétel és a legfontosabb számok láthatók egy pillantásra.',
      details: 'Az Áttekintés a napod irányítópultja: belépés után rögtön látod a mai időpontokat és a legfontosabb mutatókat.',
      bullets: [
        'A felső számkártyák a mai időpontok számát, a várható bevételt és a kihasználtságot mutatják.',
        'Bármelyik számkártyára kattintva részletes bontás nyílik meg.',
        'A mai időpontok listájából egy kattintással a foglalások részleteihez jutsz.',
      ],
    },
    {
      icon: CalendarDays,
      title: 'Időpontok kezelése',
      body: 'A foglalásokat naptár- és listanézetben látod. Új időpontot kézzel is rögzíthetsz.',
      details: 'A foglalások oldalon tartod kézben a napod. Válts naptár- és listanézet között aszerint, hogy az időbeosztást terveznéd, vagy gyorsan átnéznéd a vendégeket.',
      bullets: [
        'Az online foglalások automatikusan megjelennek, amint a vendég lefoglal.',
        'Új időpontot kézzel is felvehetsz telefonos vagy beeső vendéghez.',
        'A naptárnézetben jól látod a szabad réseket és a munkatársak beosztását.',
      ],
    },
    {
      icon: Briefcase,
      title: 'Szolgáltatások',
      body: 'Vedd fel a szolgáltatásaidat árral és időtartammal — a vendégeid ezek alapján foglalnak online.',
      details: 'A szolgáltatások a foglalási oldalad gerince: a vendég ezek közül választ, és az időtartam alapján számolódik a szabad időpont.',
      bullets: [
        'Adj meg minden szolgáltatáshoz árat és időtartamot — utóbbi pontos időpontkiosztást ad.',
        'Csoportosíthatod a szolgáltatásokat kategóriákba az átláthatóságért.',
        'A pontos időtartam segít elkerülni a túl szoros vagy túl laza beosztást.',
      ],
    },
    {
      icon: Users,
      title: 'Munkatársak',
      body: 'Add hozzá a munkatársaidat, és rendeld hozzájuk a szolgáltatásokat, hogy foglaláskor választhatók legyenek.',
      details: 'Ha többen dolgoztok, a munkatársakhoz rendelt szolgáltatások alapján a vendég kiválaszthatja, kihez szeretne menni.',
      bullets: [
        'Minden munkatárshoz hozzárendeled, mely szolgáltatásokat végzi.',
        'A foglalási oldalon a vendég választhat munkatársat, vagy rábízhatja a szalonra.',
        'A beosztás és az elérhetőség munkatársanként külön kezelhető.',
      ],
    },
    {
      icon: Clock,
      title: 'Nyitvatartás',
      body: 'Az online foglalás a beállított nyitvatartáson és a munkatársak elérhetőségén belül lehetséges.',
      details: 'A nyitvatartás és a munkatársak elérhetősége együtt határozza meg, milyen időpontok foglalhatók online.',
      bullets: [
        'Naponként külön sávokat állíthatsz be.',
        'A munkatársak egyéni elérhetősége tovább szűri a foglalható időpontokat.',
        'Egyedi kivételeket adhatsz meg ünnepnapokra vagy zárásra.',
      ],
    },
    {
      icon: BarChart2,
      title: 'Statisztika és export',
      body: 'A Statisztikák oldalon követed a bevételt és a kihasználtságot, és bármikor exportálhatsz CSV-be.',
      details: 'A számokból kiderül, mely szolgáltatások és munkatársak a legkeresettebbek, és hol van szabad kapacitás.',
      bullets: [
        'Bevétel és kihasználtság egy helyen, időszakra bontva.',
        'Lemondási arány és a legnépszerűbb szolgáltatások.',
        'Bármikor exportálhatsz CSV-be napi, heti vagy havi bontásban.',
      ],
    },
    {
      icon: Bell,
      title: 'Értesítések',
      body: 'Új foglalásról és lemondásról a harang ikonnál kapsz értesítést. A Beállításoknál kapcsolhatod ki/be.',
      details: 'Az értesítések gondoskodnak róla, hogy ne maradj le egy új foglalásról vagy lemondásról sem.',
      bullets: [
        'A fejléc harang ikonján piros jelzés mutatja az olvasatlanokat.',
        'E-mail értesítést is kérhetsz az új foglalásokról.',
        'A Beállításokban szabályozhatod, miről és hogyan kérsz értesítést.',
      ],
    },
    {
      icon: Settings,
      title: 'Beállítások',
      body: 'Itt szabod testre a szalonod adatait, az értesítéseket és a foglalási szabályokat.',
      details: 'A Beállítások a foglalási oldalad és a vendégélmény vezérlőpultja: a cégadatoktól a foglalási feltételekig minden innen állítható.',
      bullets: [
        'Szalon adatai: név, logó, elérhetőségek — ezek jelennek meg a foglalási oldalon és az e-mailekben.',
        'Foglalási szabályok: meddig előre, kell-e telefonszám.',
        'Cég- és jogi adatok, valamint a foglalási feltételek a vendégeknek.',
        'A márkázott visszaigazoló e-mailek megjelenése.',
      ],
    },
  ],
}

export function TipsContent({ variant }: { variant: Variant }) {
  const tips = TIPS[variant]
  const [openTip, setOpenTip] = useState<string | null>(null)

  function restartTour() {
    window.dispatchEvent(new Event('schedulio:open-onboarding'))
  }

  return (
    <div className="p-5 lg:p-8 space-y-6">
      {/* Hero fejléc — apple stílusú, letisztult, a menü ikonjával */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-100 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-6 lg:p-8">
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="flex items-center justify-center h-12 w-12 shrink-0 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-white/70">
              <Lightbulb className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                Tippek és trükkök
              </h1>
              <p className="text-sm text-zinc-500 dark:text-white/50 mt-1 max-w-md">
                Minden, amit a rendszerről tudni érdemes — egy helyen. Kattints egy kártyára a részletekért, vagy indítsd újra a vezetett bemutatót.
              </p>
            </div>
          </div>
          <button
            onClick={restartTour}
            className="flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all shrink-0 self-start sm:self-auto"
          >
            <Lightbulb className="h-4 w-4" />
            Bevezető újraindítása
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        {tips.map((tip) => (
          <TipCard
            key={tip.title}
            tip={tip}
            open={openTip === tip.title}
            onToggle={() => setOpenTip((cur) => (cur === tip.title ? null : tip.title))}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Egy tipp-kártya: kattintásra accordionként kibomlik a részletes leírás és a
 * konkrét tippek. A chevron jelzi a nyitott állapotot.
 */
function TipCard({ tip, open, onToggle }: { tip: Tip; open: boolean; onToggle: () => void }) {
  const { icon: Icon, title, body, details, bullets } = tip

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="group rounded-2xl border border-zinc-100 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-5 text-left hover:border-zinc-200 dark:hover:border-white/[0.16] hover:shadow-sm transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-white/[0.08] dark:to-white/[0.02] text-zinc-600 dark:text-white/60 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="flex-1 text-base font-bold text-zinc-900 dark:text-white">{title}</h2>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-zinc-500 dark:text-white/50">{body}</p>

      {/* Kibomló részletek — grid-rows trükk a sima magasság-animációhoz */}
      <div
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-white/60">{details}</p>
          <ul className="mt-3 space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-zinc-500 dark:text-white/50">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-white/30" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </button>
  )
}
