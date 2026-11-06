import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { getMyShiftStats } from '@/lib/myShiftStats'
import { StaffShiftStatsView } from '@/components/restaurant/StaffShiftStatsView'
import { StatsView } from '@/components/dashboard/StatsView'
import { getStatsVM, resolvePeriod } from '@/lib/statsView'
import { APP_URL } from '@/lib/brand'

const VALID_PERIODS = [1, 7, 30, 90, 180, 365]

export default async function RestaurantAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const { period: periodParam, from: fromParam, to: toParam } = await searchParams
  const { restaurant, capabilities, userId } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['analytics.view', 'analytics.view.own'], '/restaurant')

  let days = VALID_PERIODS.includes(Number(periodParam)) ? Number(periodParam) : 30
  let range: { dateFrom: string; dateTo: string } | undefined
  if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    const today = new Date().toISOString().slice(0, 10)
    range = { dateFrom: fromParam, dateTo: toParam > today ? today : toParam }
  }

  // `analytics.view` hiányában (csak `.own`) a foglalás nincs felszolgálóhoz rendelve az
  // étteremben, ezért a "saját nézet" a beosztás (ledolgozott órák) — SAJÁT, önálló
  // komponensben (`StaffShiftStatsView`), NEM a céges `AnalyticsOverview`-ban.
  //
  // Nincs Üzlet↔Saját munka váltó itt (a szalonnal ellentétben): a tulaj/üzletvezető
  // saját beosztása membership-rekordhoz kötődne, de a TULAJNAK nincs is membership-je a saját
  // éttermében (a Restaurant.owner relációval jogosult, nem meghívással) — a váltó náluk mindig
  // üres/nulla adatot mutatott volna, ezért inkább kikerült.
  if (!can(capabilities, 'analytics.view')) {
    const payload = await getPayloadClient()
    const mem = await payload.find({
      collection: 'memberships',
      where: { and: [{ user: { equals: userId } }, { restaurant: { equals: restaurant.id } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    const memberId = mem.docs[0]?.id
    const shiftStats = memberId
      ? await getMyShiftStats(restaurant.id, memberId, days, range)
      : {
          period: days, periodHours: 0, periodHoursDiff: 0, workedDays: 0, workedDaysDiff: 0,
          prevWorkedDays: 0, prevPeriodHours: 0,
          avgShiftHours: 0, sickDays: 0, leaveDays: 0, upcomingShiftsCount: 0, upcomingShifts: [], trend: [], byDayOfWeek: [],
          heatmap: { grid: [], dates: [], columnLabels: [] }, tipHuf: null, wageHuf: null, payLabel: null,
        }
    return <StaffShiftStatsView stats={shiftStats} />
  }

  const p = resolvePeriod(periodParam, fromParam, toParam)
  const vm = await getStatsVM('restaurant', restaurant.id, p)
  return <StatsView vm={vm} preset={p.preset} base="/restaurant" bizName={restaurant.name} bookingUrl={`${APP_URL}/${restaurant.slug}`} canGuests={can(capabilities, 'guests.manage')} />
}
