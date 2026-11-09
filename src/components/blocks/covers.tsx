import { PendingApproval } from './booking'
import { TipSplit, WeekSchedule, StaffProfile } from './calendar'
import { BookingPagePreview } from './editor'
import { ArrivalsCard, GuestTable } from './guests'
import { CampaignList, CampaignResults, SAMPLE_CAMPAIGNS } from './marketing'
import { Card } from '@/components/ui-kit'
import { IssuedInvoices, VoucherSalesCard } from './money'
import { StaffHoursCard, StaffPhoto, StaffSummary } from './team'
import { PermissionGroups, SettingsPage } from './settings'

/* A funkció-csoportok borítói (landing /funkciok és a nav „Funkciók” menüje): 800×474-es jelenet, a CoverStage
 * kicsinyíti. Krém dashboard-háttéren egy fő kártya és egy lebegő második — mind a /design VALÓDI kártyái
 * (src/components/blocks), a design 2.14 is ezeket mutatja. */

/** A jelenet: háttér + a fő kártya balra fent (alul túlnyúlhat), a lebegő jobbra. */
function Scene({ main, float, mainW = 520, floatW = 330, floatTop = false }: { main: React.ReactNode; float: React.ReactNode; mainW?: number; floatW?: number; floatTop?: boolean }) {
  return (
    <div className="absolute inset-0 bg-ui-page">
      <div className="absolute left-10 top-10" style={{ width: mainW }}>{main}</div>
      <div className={`absolute right-8 [&>*]:shadow-ui-float ${floatTop ? 'top-16' : 'bottom-8'}`} style={{ width: floatW }}>{float}</div>
    </div>
  )
}

/** A hat csoport borítójának két kártyája külön (a fő és a lebegő) — a borító (GROUP_COVERS) ebből áll össze, a
 *  landing funkció-fejezetei (landing-showcase) pedig külön mozgatják őket. */
export type GroupParts = { main: React.ReactNode; float: React.ReactNode; mainW?: number; floatW?: number; floatTop?: boolean }
const MKT_ROWS = [
  { key: 'a', name: 'Kovács Anna', meta: 'megnyitotta Okt. 14. 10:12', opened: true, booked: 'Okt. 18.' },
  { key: 'b', name: 'Tóth Bence', meta: 'megnyitotta Okt. 14. 18:40', opened: true },
  { key: 'c', name: 'Gál Zsófia', meta: 'még nem nyitotta meg', opened: false },
  { key: 'd', name: 'Lukas Gruber', meta: 'megnyitotta Okt. 15. 08:05', opened: true, booked: 'Okt. 21.' },
]
export const GROUP_PARTS: Record<string, GroupParts> = {
  // az élő foglalóoldal-szerkesztő (21.6.3): a valódi oldal, a kijelölt leírás fölött a gyors-sáv
  booking: { main: <BookingPagePreview />, mainW: 760, float: <PendingApproval className="w-full" />, floatW: 340, floatTop: true },
  calendar: { main: <WeekSchedule compact className="bg-white" />, mainW: 540, float: <TipSplit />, floatW: 290, floatTop: true },
  guests: { main: <GuestTable className="bg-white" />, mainW: 760, float: <ArrivalsCard />, floatW: 360 },
  // az utalvány az új sablonos jeggyel (szelvényes, éjfekete) — mint a vezérlőpulton és a levélben
  money: { main: <IssuedInvoices rows={5} className="bg-white" />, mainW: 760, float: <VoucherSalesCard />, floatW: 380 },
  // a kampány eredménye a foglalásokkal együtt (ki nyitotta meg, ki foglalt is belőle); mellette a kampányok
  // megnyitás / kattintás / foglalás számokkal
  marketing: { main: <CampaignResults mobile className="bg-white" booked={23} rows={MKT_ROWS} />, mainW: 460, float: <Card tone="white" pad="xs"><CampaignList items={SAMPLE_CAMPAIGNS.filter((c) => c.stats).slice(0, 2)} pages={1} /></Card>, floatW: 340 },
  // egy megnyitott munkatárs-profil (design 10.x), alacsonyabban: balra a fotó és az órák, jobbra az összefoglaló (bemutatkozás nélkül)
  team: { main: <div className="grid grid-cols-[210px_minmax(0,1fr)] gap-[5px]"><div className="flex flex-col gap-[5px]"><StaffPhoto src="/design/munkatars-viktoria.webp" /><StaffHoursCard className="flex-1" hours={52} prev={154} trend={[0, 6, 12, 17, 23, 28, 34, 40, 46, 52]} trendPrev={Array.from({ length: 30 }, (_, i) => Math.round(i * 5.3))} /></div><StaffSummary bio="" /></div>, mainW: 700, float: <SettingsPage group="Csapat & jogok" title="Recepció jogai" save={false}><PermissionGroups limit={2} cols={1} className="px-6 pt-4" /></SettingsPage>, floatW: 360, floatTop: true },
}
/** A hat csoport borítója, a FEATURE_GROUPS id-je szerint. */
export const GROUP_COVERS: Record<string, React.ReactNode> = Object.fromEntries(Object.entries(GROUP_PARTS).map(([k, p]) => [k, <Scene key={k} {...p} />]))
