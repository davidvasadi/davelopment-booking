import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Availability } from '@/payload/payload-types'
import AvailabilityGrid from '@/components/dashboard/AvailabilityGrid'

export default async function AvailabilityPage() {
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon

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
    <div className="p-5 lg:p-8 max-w-2xl">
      <div className="mb-8">
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Időbeosztás</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Nyitvatartás</h1>
      </div>
      <AvailabilityGrid salonId={salon.id} initialRecords={availResult.docs as Availability[]} />
    </div>
  )
}
