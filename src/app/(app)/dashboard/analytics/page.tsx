import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { findMyStaffId } from '@/lib/myStaffLink'
import { getStatsVM, resolvePeriod } from '@/lib/statsView'
import { APP_URL } from '@/lib/brand'
import { StatsView } from '@/components/dashboard/StatsView'

/** Statisztikák — szalon (design 5.1–5.3). */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; scope?: string }> }) {
  const { period, from, to, scope } = await searchParams
  const { salon, capabilities, userId, userEmail } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['analytics.view', 'analytics.view.own'], '/dashboard')

  // `analytics.view` hiányában (csak `.own`) MINDIG a saját foglalások; teljes joggal a `?scope=own` vált a saját munkára.
  // Saját munkatárs-profil nélkül a sosem-egyező 0 — így sosem a teljes üzlet adata jelenik meg a saját nézetben.
  const full = can(capabilities, 'analytics.view')
  const myStaff = await findMyStaffId(salon.id, userId, userEmail)
  const own = !full || scope === 'own'
  const p = resolvePeriod(period, from, to)
  const vm = await getStatsVM('salon', salon.id, p, own ? { staffId: myStaff ?? 0 } : {})

  return (
    <StatsView vm={vm} preset={p.preset} base="/dashboard" bizName={salon.name} bookingUrl={`${APP_URL}/${salon.slug}`}
      scope={{ own, canSwitch: full && myStaff != null }} canGuests={can(capabilities, 'guests.manage')} />
  )
}
