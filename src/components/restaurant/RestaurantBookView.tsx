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
    <main className="min-h-screen bg-zinc-50">
      <div className="max-w-lg mx-auto px-6 py-8">
        <Link
          href={`/${restaurant.slug}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-700 transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />{restaurant.name}
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 mb-1">{t(locale, 'public.bookTable')}</h1>
        <p className="text-zinc-500 text-sm mb-8">{t(locale, 'rbooking.viewSubtitle')}</p>

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
    </main>
  )
}
