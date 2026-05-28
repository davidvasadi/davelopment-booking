import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Service, StaffMember } from '@/payload/payload-types'
import BookingWizard from '@/components/booking/BookingWizard'
import { RestaurantBookView } from '@/components/restaurant/RestaurantBookView'

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ serviceId?: string; staffId?: string }>
}) {
  const { slug } = await params
  const { serviceId, staffId } = await searchParams
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { and: [{ slug: { equals: slug } }, { is_active: { equals: true } }] },
    limit: 1,
  })
  // No active salon for this slug — fall through to a restaurant, then 404.
  if (!salonResult.docs.length) {
    const restaurantView = await RestaurantBookView({ slug })
    if (restaurantView) return restaurantView
    notFound()
  }
  const salon = salonResult.docs[0] as Salon

  const [servicesResult, staffResult] = await Promise.all([
    payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 0,
      limit: 100,
    }),
    payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 1,
      limit: 100,
    }),
  ])

  return (
    <BookingWizard
      salonId={salon.id}
      salonSlug={slug}
      salonName={salon.name}
      requirePhone={salon.require_phone ?? true}
      services={servicesResult.docs as Service[]}
      staff={staffResult.docs as StaffMember[]}
      preselectedServiceId={serviceId ?? null}
      preselectedStaffId={staffId ?? null}
      termsSections={salon.terms_sections}
      company={{
        name: salon.name,
        legal_name: salon.legal_name,
        tax_number: salon.tax_number,
        company_reg_number: salon.company_reg_number,
        registered_seat: salon.registered_seat,
        email: salon.email,
        phone: salon.phone,
      }}
    />
  )
}
