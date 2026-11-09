import { DayEditor, MonthHours, Payroll, StaffHoursList, StaffProfile, TipSplit, WeekSchedule } from '@/components/blocks/calendar'
import { ArrivalsCard, BlockGuestModal, ExportModal, GuestEditModal, GuestMapCard, GuestProfilePanel, ReturningCard } from '@/components/blocks/guests'
import { BillingDataCard, ConnectionCard, DepositSettingsCard, IssuedInvoices, VoucherCard, VoucherSalesCard } from '@/components/blocks/money'
import { BusinessQr, QrPrintSheet } from '@/components/blocks/qr'
import { CampaignEmailCard, CampaignResults, OpenRateCard } from '@/components/blocks/marketing'
import { GoogleSettings, NewsletterSettings, PermissionGroups, SettingsPage } from '@/components/blocks/settings'
import { StatRevenueCard } from '@/components/blocks/stats'
import { MobileOverviewTop } from '@/components/blocks/overview'
import { PhoneFrame } from '@/components/blocks/phone'
import { InviteModal } from '@/components/blocks/team'
import { FloorPlan, GuestLookupDemo, OfflineQueue, PendingApproval, SelectedTableStrip } from '@/components/blocks/booking'
import { DescQuickBar, MobileEditorFrame, SALON_EDITOR_STEPS } from '@/components/blocks/editor'
import { LiveStage } from '@/components/blocks/public'
import { ReminderSettingsCard } from '@/components/blocks/settings'
import { ShareChannels, TodayTasks, UpcomingCard } from '@/components/blocks/overview'
import { StatGuestsCard, StatHoursCard, StatUtilCard, StatWeekCard } from '@/components/blocks/stats'
import { NotificationsPanel } from '@/components/blocks/notify'
import { BusinessTypeStep, ReadyCard } from '@/components/blocks/onboarding'
import { Avatar, Card } from '@/components/ui-kit'
import type { SegmentVisuals } from '@/components/landing/sections/SegmentToggle'

/* A landing funkció-oldalainak képei: a /design konkrét KÁRTYÁI (src/components/blocks), eredeti méretben —
 * ugyanúgy, mint a Foglalás oldalon. Szakasz → design-kártya: lásd a megjegyzéseket. */

const W = 'w-full max-w-[560px]'

/** 16.3: egy szerep jogai a Beállítás-lap keretében (a landing szűkebb helyére: az első csoportok, egy hasábban). */
const RolePermissions = ({ limit = 5 }: { limit?: number }) => (
  <div className={W}><SettingsPage group="Csapat & jogok" title="Recepció jogai" save={false}><PermissionGroups limit={limit} cols={1} className="px-6 pt-4" /></SettingsPage></div>
)
/** 4.4: a mobil Áttekintés a telefon-keretben. */
const MobileApp = () => <PhoneFrame><MobileOverviewTop /></PhoneFrame>

const SECTIONS: Record<string, () => React.ReactNode> = {
  // Foglalás
  'elo-asztalallapot': () => <div className={`${W} space-y-[5px]`}><FloorPlan /><SelectedTableStrip /></div>, // 6.15 / 9.1
  'gyors-felvetel': () => <GuestLookupDemo />,                                  // 6.9 vendég-lépés
  'offline-mod': () => <OfflineQueue />,                                        // 2.13 net nélkül
  // az élő szerkesztő mobilon (21.6.3 mobil): a valódi oldal, a kijelölt leírás fölött a gyors-sáv, alul a közzététel
  // a valódi mobilos szerkesztő (21.6.4): fent a lépés-váltó, középen az élő oldal a gyors-sávval, alul a közzététel
  'bemutatkozo-weboldal': () => <MobileEditorFrame step={0} steps={SALON_EDITOR_STEPS} changes={1}><LiveStage mobile sel="desc" quick={<DescQuickBar settings />} /></MobileEditorFrame>,
  emlekeztetok: () => <ReminderSettingsCard className="w-full max-w-[460px] bg-white" />, // 16.6
  jovahagyas: () => <PendingApproval />,                                        // 6.8
  // Naptár
  beosztas: () => <WeekSchedule compact className={`${W} bg-white`} />,       // 11.2
  szabadsag: () => <DayEditor type={1} />,                                     // 11.5 (Szabadság)
  munkaido: () => <MonthHours className={`${W} bg-white`} />,                  // 11.1 közép
  berezes: () => <Payroll className={`${W} bg-white`} />,                      // 11.3
  // Vendégek
  vendegkartya: () => <GuestProfilePanel className="w-full max-w-[420px]" />, // 7.2 adatlap
  feketelista: () => <BlockGuestModal />,                                      // 7.5 tiltás
  'vendeg-terkep': () => <GuestMapCard className={W} />,                       // 7.1 térkép
  export: () => <ExportModal />,                                               // 7.6
  // Pénz
  eloleg: () => <DepositSettingsCard className={W} />,                         // 16.1
  ajandekutalvany: () => <div className={W}><VoucherCard to="Lili" side="single" design={{ layout: 'stub', color: 'midnight' }} /></div>, // 12.x — az új sablonos jegy
  'automatikus-szamla': () => <BillingDataCard className={W} />,               // 16.7 számlázási adatok
  szamlak: () => <IssuedInvoices compact rows={4} className={W} />,            // 16.7.1
  // Marketing
  hirlevel: () => <CampaignEmailCard className={W} />,                         // 13.2 levél
  'google-ertekeles': () => <div className={W}><GoogleSettings part="reviews" /></div>, // 16.15
  'google-cegprofil': () => <div className={W}><GoogleSettings part="profile" /></div>, // 16.15
  'qr-kod': () => <BusinessQr className={W} />,                                // 16.11
  // Csapat
  munkatarsak: () => <StaffHoursList className="w-full max-w-[420px] bg-white" />, // 11.1 bal
  jogosultsagok: () => <RolePermissions />,                                    // 16.3
  statisztikak: () => <StatRevenueCard className={`${W} bg-white`} />,         // 5.1 bevétel
  'mobil-app': () => <MobileApp />,                                            // 4.4
}

const STEPS: Record<string, () => React.ReactNode[]> = {
  calendar: () => [<InviteModal key="1" stacked />, <WeekSchedule key="2" compact className="bg-white" />, <DayEditor key="3" type={1} />], // 16.4 → 11.2 → 11.5
  guests: () => [<ArrivalsCard key="1" />, <GuestEditModal key="2" stacked />, <GuestMapCard key="3" />],                                  // 7.1 → 7.4 → 7.1
  money: () => [<ConnectionCard key="1" kind="stripe" />, <DepositSettingsCard key="2" />, <ConnectionCard key="3" kind="szamlazz" />],      // 16.7 → 16.1 → 16.7
  marketing: () => [<NewsletterSettings key="1" aside={false} />, <GoogleSettings key="2" part="reviews" />, <QrPrintSheet key="3" />],     // 16.13 → 16.15 → 16.11
  team: () => [<InviteModal key="1" stacked />, <RolePermissions key="2" limit={4} />, <StatRevenueCard key="3" className="bg-white" />], // 16.4 → 16.3 → 5.1
}

const HERO: Record<string, () => { left: React.ReactNode; right: React.ReactNode }> = {
  booking: () => ({
    left: <div className="w-[480px] origin-bottom-left scale-[0.8] [&>*]:shadow-ui-float"><SalonUpcoming /></div>, // 4.1
    right: <div className="w-[300px]"><TodayTasks className="shadow-ui-float" /></div>,             // 4.1 mai teendők
  }),
  calendar: () => ({
    left: <div className="w-[560px] origin-bottom-left scale-[0.8]"><WeekSchedule compact className="bg-white shadow-ui-float" /></div>,
    right: <div className="w-[300px]"><TipSplit className="shadow-ui-float" /></div>,
  }),
  guests: () => ({
    left: <div className="w-[480px] origin-bottom-left scale-[0.8]"><ArrivalsCard className="shadow-ui-float" /></div>,
    right: <div className="w-[340px]"><ReturningCard className="bg-white shadow-ui-float" /></div>,
  }),
  money: () => ({
    left: <div className="w-[560px] origin-bottom-left scale-[0.8]"><IssuedInvoices compact rows={3} className="shadow-ui-float" /></div>,
    right: <div className="w-[300px]"><VoucherSalesCard className="shadow-ui-float" /></div>,
  }),
  marketing: () => ({
    left: <div className="w-[560px] origin-bottom-left scale-[0.8]"><CampaignResults mobile className="bg-white shadow-ui-float" /></div>,
    right: <div className="w-[300px]"><OpenRateCard className="shadow-ui-float" /></div>,
  }),
  team: () => ({
    left: <div className="w-[520px] origin-bottom-left scale-[0.8] [&>*]:shadow-ui-float"><RolePermissions limit={3} /></div>,
    right: <div className="w-[280px]"><StaffProfile className="shadow-ui-float" /></div>,
  }),
}

/** A funkció-szakasz képe, ha van hozzá design-kártya. */
export function sectionShot(slug: string) {
  const V = SECTIONS[slug]
  return V ? <V /> : undefined
}
/** „Így indulsz el” — a 3 lépés képe. */
export function stepShots(groupId: string) {
  return STEPS[groupId]?.()
}
/** Hero: a két lebegő kártya. Nem kattintható, a képernyőolvasó elől rejtve. */
export function heroShots(groupId: string) {
  const h = HERO[groupId]?.()
  if (!h) return undefined
  return {
    left: <div className="pointer-events-none select-none" aria-hidden>{h.left}</div>,
    right: <div className="pointer-events-none select-none" aria-hidden>{h.right}</div>,
  }
}

/* ── Főoldal ─────────────────────────────────────────────────────────────── */

const AVR = (img: string, n: string) => <span className="flex items-center gap-2 text-ui-meta text-ui-text"><Avatar size="xs" src={`/landing/funkciok/csapat/avatar/${img}.webp`} />{n}</span>
/** 4.1: közelgő foglalások munkatársanként (a főoldal szalon-nézete). */
const SalonUpcoming = () => (
  <UpcomingCard className="bg-white" hours={['11:00', '12:00', '13:00', '14:00', '15:00']} now={0.3} rows={[
    { key: 'Viktória', label: AVR('viktoria', 'Viktória'), blocks: [{ s: 0, e: 1, t: 'Gál Zsófia', st: 'done' }, { s: 2.5, e: 4, t: 'Juhász Hanna', st: 'pending' }] },
    { key: 'Csaba', label: AVR('csaba', 'Csaba'), blocks: [{ s: 0.5, e: 1.5, t: 'Tóth Bence', st: 'ok' }, { s: 3, e: 4, t: 'Marco Rossi', st: 'ok' }] },
    { key: 'Dávid', label: AVR('dave', 'Dávid'), blocks: [{ s: 1.5, e: 2.5, t: 'Kiss Réka', st: 'ok' }, { s: 2.75, e: 3.5, t: 'Nagy Dóra', st: 'soon' }] },
  ]} />
)
/** 4.6: közelgő foglalások asztalonként (étterem). */
export const RestoUpcoming = () => (
  <UpcomingCard className="bg-white" hours={['18:00', '19:00', '20:00', '21:00', '22:00']} now={0.4} rows={[
    { key: 'T1', label: <span className="text-ui-meta text-ui-text">T1 · 2 fő</span>, blocks: [{ s: 0, e: 1, t: 'Kiss Réka', n: '2 fő', st: 'done' }, { s: 1.5, e: 3, t: 'Nagy Dóra', n: '2 fő', st: 'ok' }] },
    { key: 'T3', label: <span className="text-ui-meta text-ui-text">T3 · 4 fő</span>, blocks: [{ s: 0, e: 2, t: 'Varga Péter', n: '4 fő', st: 'ok' }, { s: 2.5, e: 4, t: 'Tóth család', n: '4 fő', st: 'pending' }] },
    { key: 'T5', label: <span className="text-ui-meta text-ui-text">T5 · 6 fő</span>, blocks: [{ s: 1, e: 3.5, t: 'Szülinap · Gál', n: '6 fő', st: 'soon' }] },
  ]} />
)

/** A főoldal (és az iparági landingek) kártyái — a HomeClient (szerver) adja át a kliens-szakaszoknak. */
export function homeVisuals() {
  const feature = (slugs: string[]) => Object.fromEntries(slugs.map((s) => [s, sectionShot(s)]).filter(([, v]) => v)) as Record<string, React.ReactNode>
  const segment: SegmentVisuals = {
    salonCalendar: <SalonUpcoming />,                                  // 4.1 közelgő foglalások
    salonDayOff: <DayEditor type={1} />,                               // 11.5 szabadság
    salonNotify: <NotificationsPanel />,                               // 17.2 értesítések
    salonApp: <OfflineQueue />,                                        // 2.13 net nélkül (webalkalmazás)
    salonOverview: <TodayTasks add />,                                 // 4.1 mai teendők
    restoNotify: <NotificationsPanel />,
    restoTimeline: <RestoUpcoming />,                                  // 4.6 asztalonként
    restoApp: <OfflineQueue />,
    restoGuests: <ArrivalsCard />,                                     // 7.1 érkezések
    restoOverview: <TodayTasks add />,
  }
  return {
    heroPairs: [
      // a Vendégek-kártya sötét (fehér háttérrel a fehér címe / száma eltűnt); a landingen animálva
      [<StatHoursCard key="a" animate />, <StatRevenueCard key="d" className="bg-white" animate />],
      [<StatWeekCard key="c" className="bg-white" />, <StatGuestsCard key="b" animate />],
    ] as [React.ReactNode, React.ReactNode][],
    segment,
    steps: [<BusinessTypeStep key="1" card />, <Card key="2" tone="white"><ShareChannels /></Card>, <ReadyCard key="3" />], // 3.3 → 4.2 → 3.3
    calendar: { main: <WeekSchedule className="bg-white" />, top: <StatUtilCard className="bg-white" />, bottom: <StatWeekCard className="bg-white" /> }, // 11.2, 5.1
    features: {
      booking: feature(['elo-asztalallapot', 'gyors-felvetel', 'offline-mod', 'bemutatkozo-weboldal', 'emlekeztetok', 'jovahagyas']),
      guests: feature(['vendegkartya', 'feketelista', 'vendeg-terkep', 'export']),
      money: feature(['eloleg', 'ajandekutalvany', 'automatikus-szamla', 'szamlak']),
      marketing: feature(['hirlevel', 'google-ertekeles', 'google-cegprofil', 'qr-kod']),
    },
  }
}
