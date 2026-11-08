import { getPublicRestaurant } from '@/lib/publicPlace'
import { safeHttpUrl } from '@/lib/safeUrl'
import { depositSummary } from '@/lib/depositSummary'
import { getReviewSummary } from '@/lib/reviews'
import { storedGoogleReviews, refreshGoogleReviewsIfStale } from '@/lib/googleReviews'
import { getPayloadClient } from '@/lib/payload'
import { isBusinessLocked } from '@/lib/businessLock'
import { after } from 'next/server'
import { getMaxPax } from '@/lib/restaurantBooking'
import { DEFAULT_EVENT_TYPES } from '@/components/settings/eventTypeIcons'
import { MarketingTrackingScripts } from '@/components/booking/MarketingTrackingScripts'
import { PublicPlaceView, type PlaceViewData } from '@/components/booking/PublicPlaceView'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'
import { galleryOf, ownLocaleTexts, pageStyleOf } from '@/lib/publicPageView'
import { placeJsonLd, placeBreadcrumbJsonLd } from '@/lib/publicSeo'
import type { Media, Restaurant } from '@/payload/payload-types'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { hasActivePackage } from '@/lib/newsletterLimits'
import { reminderEnabled, reminderOffsets } from '@/lib/reminders'
import { canEditPlace } from '@/lib/canEditPlace'
import { bookableDayCount } from '@/lib/bookingWindow'
import { brandImage, brandLogoSize, LOGO_HEIGHT, type BrandPlace } from '@/lib/brandImage'

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
    getMaxPax(restaurant.id, { online: true }),
  ])
  // Google-értékelések: kérésre frissül (24 óránál régebbi tárolt adatnál), a válasz elküldése után.
  after(async () => refreshGoogleReviewsIfStale(await getPayloadClient(), 'restaurant', restaurant))
  // a fejléc számlálói: aktív asztalok és férőhely
  const tableDocs = (await (await getPayloadClient()).find({ collection: 'tables', where: { and: [{ restaurant: { equals: restaurant.id } }, { is_active: { not_equals: false } }] }, limit: 500, depth: 0, overrideAccess: true, select: { capacity: true } as never })).docs as { capacity?: number | null }[]
  const tableStats = { tables: tableDocs.length, seats: tableDocs.reduce((n, x) => n + (x.capacity ?? 0), 0) }

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
  // a fejléc képe: logó / ikon (a tulaj választása, design 24.2) és a logó mérete
  const logoUrl = brandImage(restaurant as BrandPlace, 'page')
  const logoH = LOGO_HEIGHT[brandLogoSize(restaurant as BrandPlace)]

  const enabledEvents = ((restaurant as Restaurant).event_types ?? [])
    .filter((e) => e?.enabled !== false && e?.label)
    .map((e) => ({ icon: e.icon ?? 'party', label: e.label as string }))
  const eventTypes = enabledEvents.length > 0
    ? enabledEvents
    : DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label }))

  // Ugyanaz a közös nézet, mint a szalonnál (PublicPlaceView) — csak a kártya más.
  // lejárt / szünetelő előfizetés: a foglalóoldal marad, csak online nem foglalható (design 21.13)
  const paused = await isBusinessLocked(await getPayloadClient(), restaurant.owner)
  const view: PlaceViewData = {
    paused,
    kind: 'restaurant',
    slug, locale, available, embed,
    name: restaurant.name,
    address: restaurant.address ?? null,
    city: restaurant.city ?? null,
    description: restaurant.description ? restaurant.description.trim() || null : null,
    coverUrl,
    coverFocalX: restaurant.cover_focal_x ?? 50,
    coverFocalY: restaurant.cover_focal_y ?? 50,
    coverZoom: restaurant.cover_zoom ?? 1,
    coverFocalMobileX: restaurant.cover_focal_mobile_x ?? null,
    coverFocalMobileY: restaurant.cover_focal_mobile_y ?? null,
    logoUrl,
    logoH,
    // a saját szövegek a vendég nyelvén — ami nincs lefordítva, ott az alap szöveg (nem a magyar)
    page: { ...pageStyleOf(restaurant), ...(await ownLocaleTexts(await getPayloadClient() as never, 'restaurants', restaurant.id, locale)) },
    gallery: galleryOf(restaurant),
    socialLinks: (restaurant.social_links ?? []).map((s) => s.url),
    goodToKnow: restaurant.good_to_know ?? [],
    phone: restaurant.phone ?? null,
    openingHours,
    // Étteremnél a fejléc számlálói (design 21.10): asztalok és férőhely — ugyanazok a kapcsolók, mint a szalonnál
    showServiceCount: restaurant.booking_rules?.show_service_count_on_public ?? restaurant.booking_rules?.show_catalog_counts_on_public !== false,
    showStaffCount: restaurant.booking_rules?.show_staff_count_on_public ?? restaurant.booking_rules?.show_catalog_counts_on_public !== false,
    serviceCount: tableStats.tables,
    staffCount: tableStats.seats,
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
      minPax: restaurant.min_online_pax ?? 1,
      largePartyNote: restaurant.max_online_pax != null,
      bookingWindowDays: bookableDayCount(restaurant),
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
        privacy_url: safeHttpUrl(restaurant.privacy_url),
      },
      depositEnabled: !!restaurant.deposit_settings?.enabled && !!restaurant.stripe_connect_onboarded,
      depositInfo: depositSummary(restaurant),
      invoicingEnabled: !!restaurant.invoice_settings?.invoice_provider && restaurant.invoice_settings.invoice_provider !== 'none',
      voucherCompanyEnabled: restaurant.voucher_settings?.allow_company !== false,
      google: restaurant.google_rating != null ? { rating: restaurant.google_rating, count: restaurant.google_rating_count ?? null, mapsUrl: restaurant.google_maps_url ?? null, reviews: storedGoogleReviews(restaurant.google_reviews) } : null,
      addressRequired: !!restaurant.booking_rules?.require_address,
      addressRequiredNote: restaurant.booking_rules?.require_address_note,
      hiddenFields: Array.isArray(restaurant.booking_rules?.hidden_booking_fields)
        ? restaurant.booking_rules.hidden_booking_fields.filter((f): f is 'phone' | 'notes' => f === 'phone' || f === 'notes')
        : [],
      addressDetailLevel: restaurant.booking_rules?.address_detail_level === 'off' || restaurant.booking_rules?.address_detail_level === 'city'
        ? restaurant.booking_rules.address_detail_level : 'full',
      voucherEnabled: !!restaurant.voucher_settings?.enabled && !!restaurant.stripe_connect_onboarded && voucherTypes.length > 0,
      voucherTypes,
      newsletterEnabled: hasActivePackage(restaurant.newsletter_settings?.package),
      showMarketingConsent: restaurant.booking_rules?.show_marketing_consent_field !== false,
      consentEnabled: !!restaurant.consent_settings?.enabled && !!restaurant.consent_settings?.template_text?.trim(),
      consentTitle: restaurant.consent_settings?.title,
      consentText: restaurant.consent_settings?.template_text,
      customQuestions: restaurant.custom_questions,
      goodToKnow: restaurant.good_to_know,
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
          <MarketingTrackingScripts business={restaurant.name} bizKey={`restaurant:${restaurant.id}`} privacyHref={safeHttpUrl(restaurant.privacy_url)} ga4Id={restaurant.marketing_tracking?.ga4_measurement_id} facebookPixelId={restaurant.marketing_tracking?.facebook_pixel_id} />
        </>
      )}
      <PublicPlaceView data={view} editor={editor} nextSlotNode={view.page.ctaNextFree ? <HeroNextSlot key="next-slot" slug={slug} locale={locale} source={{ kind: 'restaurant', id: restaurant.id, pax: 2 }} /> : undefined} />
    </>
  )
}
