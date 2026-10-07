import { getPublicRestaurant } from '@/lib/publicPlace'
import { getReviewSummary } from '@/lib/reviews'
import { storedGoogleReviews, refreshGoogleReviewsIfStale } from '@/lib/googleReviews'
import { getPayloadClient } from '@/lib/payload'
import { after } from 'next/server'
import { getMaxPax } from '@/lib/restaurantBooking'
import { DEFAULT_EVENT_TYPES } from '@/components/settings/eventTypeIcons'
import { MarketingTrackingScripts } from '@/components/booking/MarketingTrackingScripts'
import { PublicPlaceView, type PlaceViewData } from '@/components/booking/PublicPlaceView'
import { placeJsonLd, placeBreadcrumbJsonLd } from '@/lib/publicSeo'
import type { Media, Restaurant } from '@/payload/payload-types'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { hasActivePackage } from '@/lib/newsletterLimits'
import { reminderEnabled, reminderOffsets } from '@/lib/reminders'
import { canEditPlace } from '@/lib/canEditPlace'

/**
 * Renders an active restaurant's public landing page.
 * Returns null when no active restaurant matches the slug, so callers
 * (the shared [slug] route) can fall through to notFound().
 */
export async function RestaurantPublicView({ slug, requested = 'hu', embed = false, editorRequested = false }: { slug: string; requested?: Locale; embed?: boolean; editorRequested?: boolean }) {
  const base = await getPublicRestaurant(slug, 'hu')
  if (!base) return null

  const available = resolveAvailableLocales(base.restaurant.supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'
  const data = locale === 'hu' ? base : (await getPublicRestaurant(slug, locale)) ?? base
  const { restaurant, voucherTypes } = data

  const [reviews, maxPax] = await Promise.all([
    getReviewSummary('restaurant', restaurant.id),
    getMaxPax(restaurant.id),
  ])
  // Google-értékelések: kérésre frissül (24 óránál régebbi tárolt adatnál), a válasz elküldése után.
  after(async () => refreshGoogleReviewsIfStale(await getPayloadClient(), 'restaurant', restaurant))

  // Szerkesztő-előnézet (Beállítások → Foglalóoldal iframe-je): csak az étterem saját,
  // beállítás-joggal rendelkező tagja kapja meg; mindenki más a normál oldalt látja.
  const editor = editorRequested && await canEditPlace('restaurant', restaurant.id)

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

  // Ugyanaz a közös nézet, mint a szalonnál (PublicPlaceView) — csak a kártya más.
  const view: PlaceViewData = {
    kind: 'restaurant',
    slug, locale, available, embed,
    name: restaurant.name,
    address: restaurant.address ?? null,
    city: restaurant.city ?? null,
    description: restaurant.description ? restaurant.description.trim().slice(0, 160) || null : null,
    coverUrl,
    coverFocalX: restaurant.cover_focal_x ?? 50,
    coverFocalY: restaurant.cover_focal_y ?? 50,
    coverZoom: restaurant.cover_zoom ?? 1,
    coverFocalMobileX: restaurant.cover_focal_mobile_x ?? null,
    coverFocalMobileY: restaurant.cover_focal_mobile_y ?? null,
    logoUrl,
    // Étteremnél nincs szolgáltatás/munkatárs-katalógus → nincs számláló.
    showServiceCount: false,
    showStaffCount: false,
    serviceCount: 0,
    staffCount: 0,
    rating: reviews.count > 0
      ? { average: reviews.average, count: reviews.count }
      : restaurant.google_rating != null ? { average: restaurant.google_rating, count: restaurant.google_rating_count ?? null, source: 'Google-értékelés' } : null,
    card: {
      restaurantId: restaurant.id,
      phone: restaurant.phone,
      email: restaurant.email,
      website: restaurant.website,
      socialLinks: (restaurant.social_links ?? []).map((s) => s.url),
      openingHours,
      reviews,
      requirePhone: restaurant.require_phone ?? true,
      maxPax: maxPax || 20,
      bookingWindowDays: restaurant.booking_window_days ?? 60,
      eventTypes,
      termsSections: restaurant.terms_sections,
      company: {
        name: restaurant.name,
        legal_name: restaurant.legal_name,
        tax_number: restaurant.tax_number,
        company_reg_number: restaurant.company_reg_number,
        registered_seat: restaurant.registered_seat,
        email: restaurant.email,
        phone: restaurant.phone,
      },
      depositEnabled: !!restaurant.deposit_settings?.enabled && !!restaurant.stripe_connect_onboarded,
      invoicingEnabled: !!restaurant.invoice_settings?.invoice_provider && restaurant.invoice_settings.invoice_provider !== 'none',
      voucherCompanyEnabled: restaurant.voucher_settings?.allow_company !== false,
      google: restaurant.google_rating != null ? { rating: restaurant.google_rating, count: restaurant.google_rating_count ?? null, mapsUrl: restaurant.google_maps_url ?? null, reviews: storedGoogleReviews(restaurant.google_reviews) } : null,
      addressRequired: !!restaurant.booking_rules?.require_address,
      addressRequiredNote: restaurant.booking_rules?.require_address_note,
      voucherEnabled: !!restaurant.voucher_settings?.enabled && !!restaurant.stripe_connect_onboarded && voucherTypes.length > 0,
      voucherTypes,
      newsletterEnabled: hasActivePackage(restaurant.newsletter_settings?.package),
      consentEnabled: !!restaurant.consent_settings?.enabled && !!restaurant.consent_settings?.template_text?.trim(),
      consentTitle: restaurant.consent_settings?.title,
      consentText: restaurant.consent_settings?.template_text,
      customQuestions: restaurant.custom_questions,
      sectionOrder: restaurant.booking_rules?.public_section_order ?? null,
      hiddenSections: restaurant.booking_rules?.public_sections_hidden ?? null,
      fieldOrder: restaurant.booking_rules?.form_field_order ?? null,
      confirmEmailEnabled: restaurant.notification_prefs?.confirm_email !== false,
      reminderHours: reminderEnabled(restaurant) ? reminderOffsets(restaurant.feature_modules) : [],
    },
  }

  return (
    <>
      {/* SEO + marketing-követés — a szerkesztő-előnézetben nem kell. */}
      {!editor && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd(restaurant, 'restaurant', reviews, openingHours)) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(placeBreadcrumbJsonLd(restaurant)) }}
          />
          <MarketingTrackingScripts ga4Id={restaurant.marketing_tracking?.ga4_measurement_id} facebookPixelId={restaurant.marketing_tracking?.facebook_pixel_id} />
        </>
      )}
      <PublicPlaceView data={view} editor={editor} />
    </>
  )
}
