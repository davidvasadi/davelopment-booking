import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import type { Availability } from '@/payload/payload-types'
import AvailabilityGrid from '@/components/dashboard/AvailabilityGrid'
import { PageHeader } from '@/components/ui/page-header'

export default async function AvailabilityPage() {
  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

  const availResult = await payload.find({
    collection: 'availability',
    where: {
      and: [
        { salon: { equals: salon.id } },
        { staff: { exists: false } },
        { exception_date: { exists: false } },
      ],
    },
    limit: 100,
  })

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <PageHeader eyebrow="Időbeosztás" title="Nyitvatartás" description="Heti rend és elérhetőség" />
      <AvailabilityGrid salonId={salon.id} initialRecords={availResult.docs as Availability[]} />
    </div>
  )
}
