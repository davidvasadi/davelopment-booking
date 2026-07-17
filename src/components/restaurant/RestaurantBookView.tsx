import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPayloadClient } from '@/lib/payload'
import { RestaurantBookingWizard } from '@/components/restaurant/RestaurantBookingWizard'
import { getMaxPax } from '@/lib/restaurantBooking'
import { DEFAULT_EVENT_TYPES } from '@/components/settings/eventTypeIcons'
import type { Restaurant } from '@/payload/payload-types'
import { t, resolveAvailableLocales, type Locale } from '@/lib/i18n'

/**
 * Renders the booking wizard for an active restaurant.
 * Returns null when no active restaurant matches the slug, so the shared
 * [slug]/book route can fall through to notFound().
 *
 * A `requested` a vendég kért nyelve; a tulaj `supported_locales`-éhez szűkítjük.
 */
export async function RestaurantBookView({ slug, requested = 'hu' }: { slug: string; requested?: Locale }) {
  const payload = await getPayloadClient()

  // Előbb HU-n töltünk a supported_locales megismeréséhez, majd a kért nyelvre szűkítünk.
  const result = await payload.find({
    collection: 'restaurants',
    where: { and: [{ slug: { equals: slug } }, { is_active: { not_equals: false } }] },
    limit: 1,
    locale: 'hu',
    fallbackLocale: 'hu',
  })
  if (!result.docs.length) return null

  const available = resolveAvailableLocales((result.docs[0] as Restaurant).supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'
  const restaurant = (locale === 'hu'
    ? result.docs[0]
    : (await payload.findByID({ collection: 'restaurants', id: result.docs[0].id, locale, fallbackLocale: 'hu' }))) as Restaurant

  const maxPax = await getMaxPax(restaurant.id)

  // Esemény-típusok a foglalóhoz: a tulaj engedélyezett (enabled) típusai a foglaló nyelvén.
  // Ha még nincs beállítva egy sem (régi étterem / üres), az alapkészletet mutatjuk.
  const enabledEvents = (restaurant.event_types ?? [])
    .filter((e) => e?.enabled !== false && e?.label)
    .map((e) => ({ icon: e.icon ?? 'party', label: e.label as string }))
  const eventTypes = enabledEvents.length > 0
    ? enabledEvents
    : DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label }))

  return (
    // A szalon-foglalóval AZONOS keret: krém `bg-paper` + Onest tipográfia, és a tartalom
    // egy 34px-es davelopment konténer-gradienten ül (lásd BookingWizard gyökere).
    <div className="font-onest min-h-screen bg-paper px-4 py-4 text-ink sm:px-6 sm:py-6">
      <div
        className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl flex-col rounded-[34px] p-5 shadow-[0_34px_70px_-34px_rgba(80,70,30,.20),0_0_0_1px_rgba(120,110,70,.06)] sm:min-h-[calc(100vh-3rem)] sm:p-7"
        style={{ background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)' }}
      >
        <div className="mx-auto w-full max-w-lg">
          <Link
            href={`/${restaurant.slug}`}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink mb-6"
          >
            <ChevronLeft className="h-4 w-4" />{restaurant.name}
          </Link>
          <h1 className="text-[26px] font-light tracking-[-0.01em] text-ink mb-1">{t(locale, 'public.bookTable')}</h1>
          <p className="text-[13.5px] text-ink-soft mb-8">{t(locale, 'rbooking.viewSubtitle')}</p>

          <RestaurantBookingWizard
            restaurantId={restaurant.id}
            slug={restaurant.slug}
            requirePhone={restaurant.require_phone ?? true}
            maxPax={maxPax || 20}
            bookingWindowDays={restaurant.booking_window_days ?? 60}
            eventTypes={eventTypes}
            locale={locale}
            termsSections={restaurant.terms_sections}
            company={{
              name: restaurant.name,
              legal_name: restaurant.legal_name,
              tax_number: restaurant.tax_number,
              company_reg_number: restaurant.company_reg_number,
              registered_seat: restaurant.registered_seat,
              email: restaurant.email,
              phone: restaurant.phone,
            }}
          />
        </div>
      </div>
    </div>
  )
}
