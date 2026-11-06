import { PendingApproval } from './booking'
import { TipSplit, WeekSchedule, StaffProfile } from './calendar'
import { BookingPagePreview } from './editor'
import { GuestProfilePanel, ReturningCard } from './guests'
import { CampaignResults, OpenRateCard } from './marketing'
import { DepositSettingsCard, VoucherCard } from './money'
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

/** A hat csoport borítója, a FEATURE_GROUPS id-je szerint. */
export const GROUP_COVERS: Record<string, React.ReactNode> = {
  booking: <Scene main={<BookingPagePreview />} float={<PendingApproval className="w-full" />} floatW={340} floatTop />,
  calendar: <Scene main={<WeekSchedule compact className="bg-white" />} mainW={540} float={<TipSplit />} floatW={290} floatTop />,
  guests: <Scene main={<GuestProfilePanel />} mainW={400} float={<ReturningCard className="bg-white" />} floatW={340} />,
  money: <Scene main={<DepositSettingsCard />} float={<VoucherCard to="Lili" />} floatW={330} />,
  marketing: <Scene main={<CampaignResults mobile className="bg-white" />} float={<OpenRateCard />} floatW={280} />,
  team: <Scene main={<SettingsPage group="Csapat & jogok" title="Recepció jogai" save={false}><PermissionGroups limit={4} cols={1} className="px-6 pt-4" /></SettingsPage>} mainW={440} float={<StaffProfile />} floatW={280} floatTop />,
}
