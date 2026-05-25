'use client'

import { Lightbulb, type LucideIcon } from 'lucide-react'
import {
  CalendarDays, Briefcase, Users, Clock, Settings, BarChart2, Armchair, LayoutDashboard, Printer, Bell,
} from 'lucide-react'

type Variant = 'restaurant' | 'salon'

type Tip = { icon: LucideIcon; title: string; body: string }

const TIPS: Record<Variant, Tip[]> = {
  restaurant: [
    { icon: LayoutDashboard, title: 'Áttekintés', body: 'A kezdőképernyőn a mai foglalások, a kihasználtság és a legfontosabb számok láthatók egy pillantásra.' },
    { icon: CalendarDays, title: 'Foglalások kezelése', body: 'A nap vendégeit lista- és idővonal-nézetben látod. Beeső és telefonos foglalást is rögzíthetsz — akár név nélkül, ha siettek; ilyenkor „Beeső" / „Telefon" alapnév kerül be.' },
    { icon: Printer, title: 'Napi lista nyomtatása', body: 'A Foglalások oldal tetején a nyomtató gombbal a kiválasztott nap foglalásait nyomtatható listában nyitod meg — papíron is kéznél lehet.' },
    { icon: Armchair, title: 'Asztalok és kapacitás', body: 'Vedd fel az asztalaidat vagy adj meg egyszerű férőhely-számot. A rendszer ez alapján kezeli a kapacitást és az online foglalásokat. Nagyobb társasághoz asztalokat is összevonhatsz.' },
    { icon: Clock, title: 'Nyitvatartás', body: 'Az online foglalás csak a beállított nyitvatartáson belül lehetséges. Itt állítod be a napi sávokat és az ülésidőt.' },
    { icon: BarChart2, title: 'Statisztika és export', body: 'A Statisztikák oldalon követed a kihasználtságot, a lemondásokat és a beesők arányát. Bármikor exportálhatsz CSV-be napi/heti/havi bontásban.' },
    { icon: Bell, title: 'Értesítések', body: 'Új foglalásról és lemondásról a harang ikonnál kapsz értesítést. A Beállításoknál kapcsolhatod ki/be.' },
    { icon: Settings, title: 'Beállítások', body: 'Itt szabod testre az éttermed adatait, az értesítéseket és a foglalási szabályokat.' },
  ],
  salon: [
    { icon: LayoutDashboard, title: 'Áttekintés', body: 'A kezdőképernyőn a mai időpontok, a bevétel és a legfontosabb számok láthatók egy pillantásra.' },
    { icon: CalendarDays, title: 'Időpontok kezelése', body: 'A foglalásokat naptár- és listanézetben látod. Új időpontot kézzel is rögzíthetsz, az online foglalások automatikusan megjelennek.' },
    { icon: Briefcase, title: 'Szolgáltatások', body: 'Vedd fel a szolgáltatásaidat árral és időtartammal — a vendégeid ezek alapján foglalnak online.' },
    { icon: Users, title: 'Munkatársak', body: 'Add hozzá a munkatársaidat, és rendeld hozzájuk a szolgáltatásokat, hogy a foglaláskor választhatók legyenek.' },
    { icon: Clock, title: 'Nyitvatartás', body: 'Az online foglalás a beállított nyitvatartáson és a munkatársak elérhetőségén belül lehetséges.' },
    { icon: BarChart2, title: 'Statisztika és export', body: 'A Statisztikák oldalon követed a bevételt és a kihasználtságot, és bármikor exportálhatsz CSV-be.' },
    { icon: Bell, title: 'Értesítések', body: 'Új foglalásról és lemondásról a harang ikonnál kapsz értesítést. A Beállításoknál kapcsolhatod ki/be.' },
    { icon: Settings, title: 'Beállítások', body: 'Itt szabod testre a szalonod adatait, az értesítéseket és a foglalási szabályokat.' },
  ],
}

export function TipsContent({ variant }: { variant: Variant }) {
  const tips = TIPS[variant]

  function restartTour() {
    window.dispatchEvent(new Event('schedulio:open-onboarding'))
  }

  return (
    <div className="p-5 lg:p-8 space-y-6">
      {/* Hero fejléc — apple stílusú, letisztult, a menü ikonjával */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-100 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-6 lg:p-8">
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="flex items-center justify-center h-12 w-12 shrink-0 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-orange-500 dark:text-amber-400">
              <Lightbulb className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                Tippek és trükkök
              </h1>
              <p className="text-sm text-zinc-500 dark:text-white/50 mt-1 max-w-md">
                Minden, amit a rendszerről tudni érdemes — egy helyen. Bármikor újraindíthatod a vezetett bemutatót.
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
        {tips.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group rounded-2xl border border-zinc-100 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-5 hover:border-zinc-200 dark:hover:border-white/[0.16] hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 mb-2.5">
              <span className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-white/[0.08] dark:to-white/[0.02] text-zinc-600 dark:text-white/60 group-hover:from-amber-400/15 group-hover:to-orange-500/15 group-hover:text-orange-600 dark:group-hover:text-amber-300 transition-colors">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">{title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-white/50">{body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
