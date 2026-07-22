import { getPublicRestaurant } from '@/lib/publicPlace'
import { getReviewSummary } from '@/lib/reviews'
import { getMaxPax } from '@/lib/restaurantBooking'
import { DEFAULT_EVENT_TYPES } from '@/components/settings/eventTypeIcons'
import { MapPin } from 'lucide-react'
import { RatingStars } from '@/components/booking/RatingStars'
import { LangSwitcher } from '@/components/booking/LangSwitcher'
import { BrandLogo } from '@/components/BrandLogo'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'
import { RestaurantCard } from '@/components/restaurant/RestaurantCard'
import { placeJsonLd } from '@/lib/publicSeo'
import type { Media, Restaurant } from '@/payload/payload-types'
import { t, resolveAvailableLocales, type Locale } from '@/lib/i18n'

/**
 * Renders an active restaurant's public landing page.
 * Returns null when no active restaurant matches the slug, so callers
 * (the shared [slug] route) can fall through to notFound().
 */
export async function RestaurantPublicView({ slug, requested = 'hu' }: { slug: string; requested?: Locale }) {
  const base = await getPublicRestaurant(slug, 'hu')
  if (!base) return null

  const available = resolveAvailableLocales(base.restaurant.supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'
  const data = locale === 'hu' ? base : (await getPublicRestaurant(slug, locale)) ?? base
  const { restaurant } = data

  const [reviews, maxPax] = await Promise.all([
    getReviewSummary('restaurant', restaurant.id),
    getMaxPax(restaurant.id),
  ])

  const openingHours = data.openingHours.map((h) => ({
    day_of_week: h.day_of_week,
    is_open: h.is_open ?? false,
    open_time: h.open_time,
    close_time: h.close_time,
  }))

  const coverUrl = restaurant.cover_image && typeof restaurant.cover_image === 'object'
    ? (restaurant.cover_image as Media).url ?? null
    : null
  const logoUrl = restaurant.logo && typeof restaurant.logo === 'object'
    ? (restaurant.logo as Media).url ?? null
    : null

  const enabledEvents = ((restaurant as Restaurant).event_types ?? [])
    .filter((e) => e?.enabled !== false && e?.label)
    .map((e) => ({ icon: e.icon ?? 'party', label: e.label as string }))
  const eventTypes = enabledEvents.length > 0
    ? enabledEvents
    : DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label }))

  const hasCover = !!coverUrl
  const heroText = hasCover ? 'text-white' : 'text-[#1D1C19]'
  const heroSub  = hasCover ? 'text-white/60' : 'text-[#86826F]'

  return (
    <div
      className="font-onest min-h-[100dvh] relative overflow-hidden"
      style={hasCover ? { background: '#111' } : {
        background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)',
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd(restaurant, 'restaurant')) }}
      />

      {/* Borítókép + overlay rétegek */}
      {hasCover && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 z-0 h-full w-full object-cover" />
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.35) 100%)' }}
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2]"
            style={{ height: '55%', background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.72) 100%)' }}
          />
        </>
      )}

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-5 py-5 lg:px-8 lg:py-6">
        <div className="flex items-center gap-3">
          <BrandLogo variant={hasCover ? 'dark' : 'light'} className="h-6 lg:h-7" />
          {logoUrl && <div className={`h-4 w-px ${hasCover ? 'bg-white/20' : 'bg-black/15'}`} />}
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={restaurant.name} className="h-7 w-auto max-w-[120px] rounded-[6px] object-contain" />
          )}
        </div>
        {available.length > 1 && <LangSwitcher current={locale} available={available} variant={hasCover ? 'dark' : 'light'} />}
      </nav>

      {/* Étterem neve + cím — mobil hero */}
      <div className="absolute bottom-[calc(max(2.5rem,env(safe-area-inset-bottom))+5rem)] left-0 right-0 z-10 px-6 lg:hidden">
        <h1 className={`text-[2.75rem] font-light leading-tight tracking-[-0.02em] ${heroText}`}>
          {restaurant.name}
        </h1>
        {(restaurant.address || restaurant.city) && (
          <p className={`mt-1 flex items-center gap-1.5 text-sm ${heroSub}`}>
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {[restaurant.address, restaurant.city].filter(Boolean).join(', ')}
          </p>
        )}
        {reviews.count > 0 && (
          <div className="mt-2">
            <RatingStars rating={reviews.average} count={reviews.count} />
          </div>
        )}
      </div>

      {/* Étterem neve + cím — desktop bal alul */}
      <div className="absolute bottom-10 left-8 z-20 hidden lg:block">
        <h1 className={`text-[3rem] font-light leading-none tracking-[-0.02em] mb-2 ${heroText}`}>
          {restaurant.name}
        </h1>
        {(restaurant.address || restaurant.city) && (
          <p className={`flex items-center gap-1.5 text-sm mb-4 ${heroSub}`}>
            <MapPin className="h-3.5 w-3.5" />
            {[restaurant.address, restaurant.city].filter(Boolean).join(', ')}
          </p>
        )}
        {reviews.count > 0 && <RatingStars rating={reviews.average} count={reviews.count} className="mb-4" />}
        <BookCtaMorph href={`/${slug}/book`} label={t(locale, 'public.bookTable')} />
      </div>

      {/* Interaktív étterem-kártya */}
      <RestaurantCard
        slug={slug}
        restaurantId={restaurant.id}
        locale={locale}
        restaurantName={restaurant.name}
        restaurantDescription={restaurant.description}
        restaurantAddress={restaurant.address}
        restaurantCity={restaurant.city}
        phone={restaurant.phone}
        email={restaurant.email}
        website={restaurant.website}
        openingHours={openingHours}
        reviews={reviews}
        requirePhone={restaurant.require_phone ?? true}
        maxPax={maxPax || 20}
        bookingWindowDays={restaurant.booking_window_days ?? 60}
        eventTypes={eventTypes}
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
  )
}
