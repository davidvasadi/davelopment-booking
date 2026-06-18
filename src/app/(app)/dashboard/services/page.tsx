import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import type { Service, ServiceCategory, StaffMember } from '@/payload/payload-types'
import ServicesManager from '@/components/dashboard/ServicesManager'

export default async function ServicesPage() {
  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

  const [servicesResult, staffResult, categoriesResult] = await Promise.all([
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
    payload.find({
      collection: 'service-categories',
      where: { salon: { equals: salon.id } },
      sort: 'sort_order',
      depth: 1,
      limit: 100,
    }),
  ])

  return (
    <div className="p-5 lg:p-8">
      <ServicesManager
        salonId={salon.id}
        initialServices={servicesResult.docs as Service[]}
        staffList={staffResult.docs as StaffMember[]}
        initialCategories={categoriesResult.docs as ServiceCategory[]}
        supportedLocales={salon.supported_locales ?? null}
      />
    </div>
  )
}
