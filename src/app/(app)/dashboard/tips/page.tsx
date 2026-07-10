import { getOwnedSalon } from '@/lib/salonContext'
import { getDashboardStats } from '@/lib/dashboardStats'
import { getPayloadClient } from '@/lib/payload'
import { buildSalonAdvisor, type SetupFlags } from '@/lib/tipsAdvisor'
import { TipsAdvisorView } from '@/components/dashboard/TipsAdvisorView'

export const metadata = { title: 'Tippek' }

export default async function SalonTipsPage() {
  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

  const [stats, availRes, servicesRes] = await Promise.all([
    getDashboardStats(salon.id, 30),
    payload.find({
      collection: 'availability',
      where: {
        and: [
          { salon: { equals: salon.id } },
          { staff: { exists: false } },
          { exception_date: { exists: false } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'services',
      where: { salon: { equals: salon.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const setup: SetupFlags = { openingHours: availRes.totalDocs > 0, catalog: servicesRes.totalDocs > 0 }
  const data = buildSalonAdvisor(salon, setup, stats)

  return <TipsAdvisorView variant="salon" data={data} apiBase={`/api/salons/${salon.id}`} />
}
