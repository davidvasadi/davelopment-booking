import { getOwnedSalon } from '@/lib/salonContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import type { Service, ServiceCategory, StaffMember, Booking } from '@/payload/payload-types'
import ServicesManager from '@/components/dashboard/ServicesManager'

export default async function ServicesPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireCapability(capabilities, 'catalog.view', '/dashboard')
  const payload = await getPayloadClient()

  const yearStart = `${new Date().getFullYear()}-01-01`

  const [servicesResult, staffResult, categoriesResult, bookingsResult] = await Promise.all([
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
    // Idei (nem lemondott) foglalások a „Bevétel kategóriánként" csíkhoz — a szolgáltatás
    // aktuális árát összegezzük kategóriánként (a Booking nem tárol árat).
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salon.id } },
          { date: { greater_than_equal: yearStart } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      depth: 1, // service kifejtve (ár + kategória-ID)
      limit: 5000,
      overrideAccess: true,
    }),
  ])

  // Bevétel kategóriánként (kategória-ID → Ft; besorolatlan → '__none__').
  const revenueByCategory: Record<string, number> = {}
  for (const b of bookingsResult.docs as Booking[]) {
    const svc = b.service
    if (!svc || typeof svc !== 'object') continue
    const price = (svc as Service).price || 0
    const cat = (svc as Service).category
    const catId = cat == null ? '__none__' : typeof cat === 'object' ? String(cat.id) : String(cat)
    revenueByCategory[catId] = (revenueByCategory[catId] ?? 0) + price
  }

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <ServicesManager
        salonId={salon.id}
        initialServices={servicesResult.docs as Service[]}
        staffList={staffResult.docs as StaffMember[]}
        initialCategories={categoriesResult.docs as ServiceCategory[]}
        supportedLocales={salon.supported_locales ?? null}
        revenueByCategory={revenueByCategory}
      />
    </div>
  )
}
