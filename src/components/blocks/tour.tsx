import { BarChart3, CalendarDays, Smartphone, UserRound } from 'lucide-react'
import { Card, IconCircle, Meta, Pill } from '@/components/ui-kit'
import { FitCard } from '@/components/landing/FitCard'
import { BIZ_LOGO } from './brand'
import { FloorPlan, TablePanel } from './booking'
import { MonthHours, StaffProfile } from './calendar'
import { MobileDayTimeline, MobileOverviewTop, type DayRow } from './overview'
import { PhoneFrame } from './phone'
import { ReadyCard } from './onboarding'
import { ServiceCard } from './services'
import { GoogleSettings, OpeningHoursCard } from './settings'
import { StatUtilCard, StatWeekCard } from './stats'
import { WeeklyTipCard } from './tips'
import { ReturningCard } from './guests'
import { VoucherCard } from './money'
import { LiveStage } from './public'

/* A lépések és az előnézetek szerveren is futnak (a design oldal így hívja); az animált kártya a tour-card.tsx-ben (kliens).
 * A regisztráció utáni bevezető (élesben: onboarding/OnboardingTour) a design kit nyelvén — a /design 19.x.
 * Középen egy fehér kártya elmosott oldal fölött: fent az előnézet (a design VALÓDI kártyái keret nélkül, a szélességet kitöltve,
 * mint a landing képei), alatta a lépés-számláló, cím, szöveg, „Megnézem”, a pötty-haladás és a vezérlők. */

/** Előnézet: a kártya keret nélkül, olvasható méretben — a FitCard a természetes `width`-ben rajzolja és a szélességre
 *  igazítja; a magas kártyánál (`tall`) a felső 300px látszik, az alja finoman elhalványul (nem éles vágás). */
export function TourPreview({ children, width = 420, tall = false }: { children: React.ReactNode; width?: number; tall?: boolean }) {
  if (!tall) return <FitCard w={width}>{children}</FitCard>
  return (
    <div className="max-h-[300px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_78%,transparent)]" /* ui-allow: elhalványuló alj */>
      <FitCard w={width}>{children}</FitCard>
    </div>
  )
}

/** Egy lépés: cím, szöveg, előnézet; `to`: a „Megnézem” célja a dashboard tövéhez képest ('' = Áttekintés), nélküle nincs gomb. */
export type TourStep = { title: string; body: string; to?: string; preview: React.ReactNode }

/** Akit üdvözlünk: élesben a valódi név és üzlet, a design oldalon a minta. */
export type TourWho = { name?: string | null; business?: string }

const DAY: DayRow[] = [
  { t: '10:00', st: 'past', ev: { n: 'Gál Zsófia', s: '10:00–11:00 · Hajvágás', tone: 'dark', dot: 'bg-ui-yellow' } },
  { t: '11:00', st: 'now', ev: { n: 'Kiss Réka', s: '11:00–12:00 · Géllakk', tone: 'light', dot: 'bg-ui-dark' } },
  { t: '12:00' },
]

/** A bevezető lépései — egy forrás a design oldalnak és az élő bevezetőnek. `restaurant`: az étterem sora
 *  (Foglalások terem-nézettel, Asztalok a Szolgáltatások helyett). */
export function tourSteps(restaurant = false, who: TourWho = {}): TourStep[] {
  return [
    { title: 'Üdv a rendszeredben', body: 'Pár képernyőn átvezetünk, hogy percek alatt kihozd belőle a legtöbbet. Bármikor kihagyhatod, és a Súgóból újraindíthatod.', preview: <TourPreview width={420}><WelcomeCard restaurant={restaurant} {...who} /></TourPreview> },
    { title: 'Telepíthető alkalmazás', body: 'Telefonra és gépre is felrakható appként, App Store nélkül — push értesítéssel minden új foglalásról.', to: 'settings?tab=notifications', preview: <TourPreview tall width={360}><PhoneFrame nav={0}><MobileOverviewTop /></PhoneFrame></TourPreview> },
    { title: 'Áttekintés', body: 'A kezdőképernyőd: a mai foglalások, a kihasználtság és a legfontosabb számok egy pillantásra.', to: '', preview: <TourPreview width={460}><StatWeekCard className="bg-white" /></TourPreview> },
    restaurant
      ? { title: 'Foglalások', body: 'A nap vendégei listában, idővonalon és az élő teremtérképen — egy pillantás, melyik asztal foglalt.', to: 'bookings', preview: <TourPreview width={640}><FloorPlan compact /></TourPreview> }
      : { title: 'Foglalások', body: 'A foglalások idővonalon és listában; az online foglalások maguktól megjelennek, kézzel is rögzíthetsz.', to: 'bookings', preview: <TourPreview width={360}><Card className="bg-white"><MobileDayTimeline rows={DAY} more={false} /></Card></TourPreview> },
    { title: 'Vendégek', body: 'Minden vendég egy helyen: elérhetőség, korábbi foglalások, visszatérők — és ki iratkozott fel a hírlevélre.', to: 'guests', preview: <TourPreview width={320}><ReturningCard className="bg-white" /></TourPreview> },
    { title: 'Naptár', body: restaurant ? 'A csapat beosztása havi nézetben — ki dolgozik, ki szabadságon, és a napi borravaló.' : 'A csapat beosztása havi nézetben — ki mikor dolgozik, ki van szabadságon.', to: 'schedule', preview: <TourPreview tall width={460}><MonthHours compact className="bg-white" /></TourPreview> },
    restaurant
      ? { title: 'Asztalok', body: 'Vedd fel az asztalaidat vagy egy férőhely-számot — ebből kezeli a rendszer a kapacitást és az online foglalást.', to: 'settings?tab=tables', preview: <TourPreview tall width={340}><TablePanel /></TourPreview> }
      : { title: 'Szolgáltatások', body: 'Árral és időtartammal — a vendégek ezekből foglalnak online. Egy teljes lista önmagában több foglalást hoz.', to: 'services', preview: <TourPreview width={300}><ServiceCard /></TourPreview> },
    { title: 'Munkatársak', body: 'Minél több szakember érhető el, annál több foglalást fogadhatsz egyszerre — add hozzá a csapatot.', to: 'staff', preview: <TourPreview tall width={300}><StaffProfile /></TourPreview> },
    { title: 'Nyitvatartás', body: 'Online foglalni csak nyitvatartáson belül lehet — egy pontos beállítással nem veszítesz foglalható időpontot.', to: 'availability', preview: <TourPreview tall width={460}><OpeningHoursCard className="bg-white" /></TourPreview> },
    { title: 'Foglalóoldal', body: 'Itt foglalnak a vendégeid. Beállítások › Foglalóoldal: borítókép, színek, galéria, „Jó tudni” — élő előnézettel szerkeszted, és egy linkkel megosztod (Instagram, Facebook, Google).', to: 'settings?tab=site', preview: <TourPreview width={1100}><LiveStage restaurant={restaurant} /></TourPreview> },
    { title: 'Statisztikák', body: 'Kihasználtság, bevétel, lemondások — itt látod, mi hozza a pénzt, és hol veszítesz vendéget.', to: 'analytics', preview: <TourPreview width={320}><StatUtilCard className="bg-white" /></TourPreview> },
    { title: 'Utalványok és marketing', body: 'Ajándékutalványt online is árulhatsz, és hírlevéllel hozod vissza a vendégeket — a feliratkozók automatikusan gyűlnek a foglalásokból.', to: 'vouchers', preview: <TourPreview width={360}><VoucherCard restaurant={restaurant} /></TourPreview> },
    { title: 'Tippek', body: 'A valós adataidból frissülő javaslatok több foglaláshoz és jobb vendégélményhez.', to: 'tips', preview: <TourPreview width={480}><WeeklyTipCard restaurant={restaurant} /></TourPreview> },
    { title: 'Beállítások', body: 'Profil, e-mailek, számlázás, jogosultságok — és itt kötöd be a Google-t: „Foglalj most” gomb a keresőben és a Térképen.', to: 'settings', preview: <TourPreview tall width={560}><GoogleSettings part="profile" /></TourPreview> },
    { title: 'Készen állsz', body: restaurant ? 'Jó munkát! A bevezetőt bármikor újraindíthatod a Súgóból.' : 'Sok sikert! A bevezetőt bármikor újraindíthatod a Súgóból.', preview: <TourPreview width={420}><ReadyCard /></TourPreview> },
  ]
}


/** Az első lépés előnézete: üdvözlés — a márka-jel, a név és az üzlet, alatta négy dolog, amit a bevezető bemutat. */
export function WelcomeCard({ restaurant = false, name = 'Anna', business }: { restaurant?: boolean } & TourWho) {
  const first = name?.trim().split(/\s+/).pop()
  return (
    <Card tone="dark" pad="lg">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BIZ_LOGO} alt="" className="h-12 w-auto shrink-0" />
        <span><span className="block text-ui-sub font-light leading-tight">{first ? `Üdv, ${first}!` : 'Üdv!'}</span><Meta dark>{business ?? (restaurant ? 'Bistro Andrássy' : 'Fodrászat Budapest')} · a fiókod kész</Meta></span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-1.5">
        {([[CalendarDays, restaurant ? 'Foglalások, terem' : 'Időpontok'], [UserRound, 'Vendégek'], [BarChart3, 'Számok, tippek'], [Smartphone, 'App a telefonon']] as const).map(([I, t]) => (
          <span key={t} className="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-1.5 pr-3 text-ui-meta"><IconCircle tone="yellow" size="sm" icon={I} />{t}</span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between"><Meta dark>12 rövid lépés · kb. 2 perc</Meta><Pill tone="yellow" size="sm">Kezdjük</Pill></div>
    </Card>
  )
}
