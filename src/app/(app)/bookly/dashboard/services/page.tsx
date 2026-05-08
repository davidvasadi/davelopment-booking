import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Service, StaffMember } from '@/payload/payload-types'
import ServicesManager from '@/components/dashboard/ServicesManager'

export default async function ServicesPage() {
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon

  const [servicesResult, staffResult] = await Promise.all([
    payload.find({
      collection: 'services',
      where: { salon: { equals: salon.id } },
      sort: 'name',
      depth: 1,
      limit: 200,
    }),
    payload.find({
      collection: 'staff',
      where: { salon: { equals: salon.id } },
      sort: 'name',
      depth: 0,
      limit: 100,
    }),
  ])

  return (
    <div className="p-5 lg:p-8 max-w-3xl">
      <ServicesManager
        salonId={salon.id}
        initialServices={servicesResult.docs as Service[]}
        staffList={staffResult.docs as StaffMember[]}
      />
    </div>
  )
}
