import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Service, StaffMember } from '@/payload/payload-types'
import BookingWizard from '@/components/booking/BookingWizard'
import { RestaurantBookView } from '@/components/restaurant/RestaurantBookView'
import { getLocale } from '@/lib/i18n/server'
import { resolveAvailableLocales } from '@/lib/i18n'

// A foglaló wizard interaktív, tartalmatlan a botnak — a canonical a profil-oldal (/[slug]),
// ezt ne indexeljük (duplikált/üres tartalom elkerülése).
export const metadata: Metadata = { robots: { index: false, follow: true } }

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ serviceId?: string; staffId?: string }>
}) {
  const { slug } = await params
  const { serviceId, staffId } = await searchParams
  const requested = await getLocale()
  const payload = await getPayloadClient()

  // A salont előbb HU-n töltjük a supported_locales megismeréséhez, majd a kért nyelvre szűkítünk.
  const salonResult = await payload.find({
    collection: 'salons',
    where: { and: [{ slug: { equals: slug } }, { is_active: { equals: true } }] },
    limit: 1,
    locale: 'hu',
    fallbackLocale: 'hu',
  })
  // No active salon for this slug — fall through to a restaurant, then 404.
  if (!salonResult.docs.length) {
    const restaurantView = await RestaurantBookView({ slug, requested })
    if (restaurantView) return restaurantView
    notFound()
  }
  const available = resolveAvailableLocales((salonResult.docs[0] as Salon).supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'

  // A localizált tulaj-szöveg (terms, salon-mezők) a kért nyelven; üresnél HU fallback.
  const salon = (locale === 'hu'
    ? salonResult.docs[0]
    : (await payload.findByID({ collection: 'salons', id: salonResult.docs[0].id, locale, fallbackLocale: 'hu' }))) as Salon

  const [servicesResult, staffResult] = await Promise.all([
    payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 1,
      limit: 100,
      locale,
      fallbackLocale: 'hu',
    }),
    payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 1,
      limit: 100,
      locale,
      fallbackLocale: 'hu',
    }),
  ])

  return (
    <BookingWizard
      salonId={salon.id}
      salonSlug={slug}
      salonName={salon.name}
      requirePhone={salon.require_phone ?? true}
      bookingWindowDays={salon.booking_window_days ?? 60}
      services={servicesResult.docs as Service[]}
      staff={staffResult.docs as StaffMember[]}
      preselectedServiceId={serviceId ?? null}
      preselectedStaffId={staffId ?? null}
      locale={locale}
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
