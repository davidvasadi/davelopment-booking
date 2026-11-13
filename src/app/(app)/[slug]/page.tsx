import { reminderEnabled, reminderOffsets } from '@/lib/reminders'
import { safeHttpUrl } from '@/lib/safeUrl'
import { depositSummary } from '@/lib/depositSummary'
import type { Metadata } from 'next'
import { getCachedGoogleRating } from '@/lib/google-rating'
import { notFound } from 'next/navigation'
import { getPublicSalon, getPublicRestaurant } from '@/lib/publicPlace'
import { placeMetadata, placeJsonLd, placeBreadcrumbJsonLd, siteJsonLd, industryPageJsonLd, SITE_URL } from '@/lib/publicSeo'
import { getReviewSummary } from '@/lib/reviews'
import { storedGoogleReviews, refreshGoogleReviewsIfStale } from '@/lib/googleReviews'
import { getPayloadClient } from '@/lib/payload'
import { isBusinessLocked } from '@/lib/businessLock'
import { after } from 'next/server'
import { getPricing } from '@/lib/pricing'
import { INDUSTRY_LANDINGS } from '@/lib/industryLandings'
import { INDUSTRY_PAGES } from '@/lib/industryPages'
import { IndustryPageK2 } from '@/components/blocks/landing-industry'
import { CookieBanner } from '@/components/landing/CookieBanner'
import { LandingClickTracker } from '@/components/landing/LandingClickTracker'
import HomeClient from '../HomeClient'
import type { Media } from '@/payload/payload-types'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'
import { RestaurantPublicView } from '@/components/restaurant/RestaurantPublicView'
import { MarketingTrackingScripts } from '@/components/booking/MarketingTrackingScripts'
import { PublicPlaceView, type PlaceViewData } from '@/components/booking/PublicPlaceView'
import { galleryOf, ownLocaleTexts, pageStyleOf } from '@/lib/publicPageView'
import { canEditPlace } from '@/lib/canEditPlace'
import { getLocale } from '@/lib/i18n/server'
import { hasActivePackage } from '@/lib/newsletterLimits'
import { resolveAvailableLocales, LOCALES, type Locale } from '@/lib/i18n'
import { bookableDayCount } from '@/lib/bookingWindow'
import { brandImage, brandLogoSize, LOGO_HEIGHT, type BrandPlace } from '@/lib/brandImage'

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ editor?: string }> }): Promise<Metadata> {
  const { slug } = await params
  // A szerkesztő-előnézet soha ne kerüljön keresőbe.
  if ((await searchParams).editor === '1') return { robots: { index: false, follow: false } }

  // Iparág-specifikus SEO landing (pl. /fodrasz-idopontfoglalas) — a szűkebb, fenntartott
  // listával ellenőrizzük ELŐSZÖR, hogy ne fussunk le két felesleges DB-lekérdezést (szalon +
  // étterem keresés) minden landing-oldal-kérésnél.
  const np = INDUSTRY_PAGES[slug]
  const landing = np ? { ...INDUSTRY_LANDINGS[slug], seoTitle: np.seoTitle, seoDescription: np.seoDescription, heroTitle: np.h1 } : INDUSTRY_LANDINGS[slug]
  if (landing) {
    const url = `${SITE_URL}/${slug}`
    const ogImage = `${SITE_URL}/api/og/landing?title=${encodeURIComponent(landing.heroTitle)}`
    return {
      // `absolute`: a seoTitle már tartalmazza a márkanevet — a layout `%s — davelopment booking` sablonja különben
      // még egyszer hozzáfűzné („| davelopment booking — davelopment booking”, ~98 karakter)
      title: { absolute: landing.seoTitle },
      description: landing.seoDescription,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        title: landing.seoTitle,
        description: landing.seoDescription,
        url,
        siteName: 'davelopment booking',
        images: [{ url: ogImage, width: 1200, height: 630, alt: landing.heroTitle }],
      },
      twitter: {
        card: 'summary_large_image',
        title: landing.seoTitle,
        description: landing.seoDescription,
        images: [ogImage],
      },
    }
  }

  const salonData = await getPublicSalon(slug, 'hu')
  if (salonData) return placeMetadata(salonData.salon, 'salon')
  const restaurantData = await getPublicRestaurant(slug, 'hu')
  if (restaurantData) return placeMetadata(restaurantData.restaurant, 'restaurant')
  return {}
}

export default async function SalonPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ embed?: string; editor?: string; lang?: string }>
}) {
  const { slug } = await params

  // iparági oldal — új felépítés (lib/industryPages), ha a slug már át van állítva; különben a régi
  const industryPage = INDUSTRY_PAGES[slug]
  if (industryPage) {
    const pricing = await getPricing()
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(industryPageJsonLd(industryPage, pricing, await getCachedGoogleRating())) }} />
        <IndustryPageK2 page={industryPage} trialDays={pricing.trial_days} />
        <CookieBanner />
        <LandingClickTracker />
      </>
    )
  }
  const landing = INDUSTRY_LANDINGS[slug]
  if (landing) {
    const pricing = await getPricing()
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(pricing, landing.faqItems, await getCachedGoogleRating())) }}
        />
        <HomeClient pricing={pricing} industry={landing} />
      </>
    )
  }

  const sp = await searchParams
  const embed = sp.embed === '1'
  const editorRequested = sp.editor === '1' && !embed
  // A szerkesztő a szerkesztett nyelvet `?lang=`-gal kéri (a látogató nyelv-sütijét nem írjuk át).
  const requested = editorRequested && (LOCALES as string[]).includes(sp.lang ?? '') ? (sp.lang as Locale) : await getLocale()

  const base = await getPublicSalon(slug, 'hu')

  if (!base) {
    const restaurantView = await RestaurantPublicView({ slug, requested, embed, editorRequested })
    if (restaurantView) return restaurantView
    notFound()
  }

  const available = resolveAvailableLocales(base.salon.supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'
  const salonData = locale === 'hu' ? base : (await getPublicSalon(slug, locale)) ?? base
  // `availability = []` védekező alapérték: az `unstable_cache` (getPublicSalon) egy már
  // korábban gyorsítótárazott, RÉGEBBI válaszsémát adhat vissza (mielőtt ez a mező bekerült),
  // amíg a cache-bejegyzés nem frissül — enélkül ez éles összeomlást okozna a profil-oldalon.
  const { salon, services, staff, serviceCategories, voucherTypes, availability = [] } = salonData
  const openingHours = availability.map((a) => ({
    day_of_week: a.day_of_week,
    is_open: a.is_available !== false,
    open_time: a.start_time,
    close_time: a.end_time,
  }))

  const reviews = await getReviewSummary('salon', salon.id)
  // Google-értékelések: kérésre frissül (24 óránál régebbi tárolt adatnál), a válasz elküldése után.
  after(async () => refreshGoogleReviewsIfStale(await getPayloadClient(), 'salon', salon))

  // Szerkesztő-előnézet (Beállítások → Foglalóoldal iframe-je): csak az üzlet saját,
  // beállítás-joggal rendelkező tagja kapja meg; mindenki más a normál oldalt látja.
  const editor = editorRequested && await canEditPlace('salon', salon.id)

  // `typeof === 'string'` védelem: a `description` mostanáig richText-objektum volt, egy
  // korlátlanul cache-elt (`getPublicSalon`), séma-váltás előtti bejegyzés még a régi alakot
  // adhatja vissza, amíg az adott szalonnál nem történik újabb módosítás (revalidál).
  // teljes szöveg (a jelöléseket nem vághatjuk félbe) — a hős-blokk sorokra vágja, a meta-leírást a publicSeo tisztítja
  const salonDescription = typeof salon.description === 'string' ? (salon.description.trim() || null) : null

  const coverUrl = salon.cover_image && typeof salon.cover_image === 'object'
    ? (salon.cover_image as Media).url ?? null
    : null
  // a fejléc képe: logó / ikon (a tulaj választása, design 24.2) és a logó mérete
  const logoUrl = brandImage(salon as BrandPlace, 'page')
  const logoH = LOGO_HEIGHT[brandLogoSize(salon as BrandPlace)]

  // HeroNextSlot renderelése server-oldalon, átadva a kliensbe ReactNode-ként
  const nextSlotNode = services.length > 0
    ? <HeroNextSlot key="next-slot" slug={slug} locale={locale} source={{ kind: 'salon', id: salon.id, serviceId: services[0].id }} />
    : null

  // lejárt / szünetelő előfizetés: a foglalóoldal marad, csak online nem foglalható (design 21.13)
  const paused = await isBusinessLocked(await getPayloadClient(), salon.owner)
  const view: PlaceViewData = {
    paused,
    kind: 'salon',
    slug, locale, available, embed,
    name: salon.name,
    address: salon.address ?? null,
    city: salon.city ?? null,
    description: salonDescription,
    coverUrl,
    // "Áthelyezés" (fókuszpont) a beállításokból — object-position-ként, hogy a kép lényegi
    // része mobilon/desktopon (nagyon eltérő képarányon) is a helyén maradjon.
    coverFocalX: salon.cover_focal_x ?? 50,
    coverFocalY: salon.cover_focal_y ?? 50,
    coverZoom: salon.cover_zoom ?? 1,
    coverFocalMobileX: salon.cover_focal_mobile_x ?? null,
    coverFocalMobileY: salon.cover_focal_mobile_y ?? null,
    logoUrl,
    logoH,
    // a saját szövegek a vendég nyelvén — ami nincs lefordítva, ott az alap szöveg (nem a magyar)
    page: { ...pageStyleOf(salon), ...(await ownLocaleTexts(await getPayloadClient() as never, 'salons', salon.id, locale)) },
    gallery: galleryOf(salon),
    socialLinks: (salon.social_links ?? []).map((s) => s.url),
    goodToKnow: salon.good_to_know ?? [],
    phone: salon.phone ?? null,
    openingHours,
    // A két külön kapcsoló; ha még nincs kitöltve, a régi közös `show_catalog_counts_on_public`
    // dönt (alapértelmezett true — nincs érték = mutassuk).
    showServiceCount: salon.booking_rules?.show_service_count_on_public ?? salon.booking_rules?.show_catalog_counts_on_public !== false,
    showStaffCount: salon.booking_rules?.show_staff_count_on_public ?? salon.booking_rules?.show_catalog_counts_on_public !== false,
    serviceCount: services.length,
    staffCount: staff.length,
    rating: reviews.count > 0
      ? { average: reviews.average, count: reviews.count }
      : salon.google_rating != null ? { average: salon.google_rating, count: salon.google_rating_count ?? null, source: 'Google-értékelés' } : null,
    card: {
      salonId: String(salon.id),
      services,
      staff,
      serviceCategories,
      phone: salon.phone,
      email: salon.email,
      website: salon.website,
      socialLinks: (salon.social_links ?? []).map((s) => s.url),
      requirePhone: salon.require_phone ?? true,
      bookingWindowDays: bookableDayCount(salon),
      termsSections: salon.terms_sections,
      goodToKnow: salon.good_to_know,
      // szakemberenkénti számlázásnál (lib/payee) az előleg csak annál a szakembernél él, akinek kész a saját Stripe-ja
      depositEnabled: !!salon.deposit_settings?.enabled && (salon.invoice_settings?.issuer === 'staff' ? staff.some((m) => m.stripe_connect_onboarded) : !!salon.stripe_connect_onboarded),
      depositStaffIds: salon.invoice_settings?.issuer === 'staff' ? staff.filter((m) => m.stripe_connect_onboarded).map((m) => String(m.id)) : null,
      depositInfo: depositSummary(salon),
      invoicingEnabled: !!salon.invoice_settings?.invoice_provider && salon.invoice_settings.invoice_provider !== 'none',
      voucherCompanyEnabled: salon.voucher_settings?.allow_company !== false,
      google: salon.google_rating != null ? { rating: salon.google_rating, count: salon.google_rating_count ?? null, mapsUrl: salon.google_maps_url ?? null, reviews: storedGoogleReviews(salon.google_reviews) } : null,
      addressRequired: !!salon.booking_rules?.require_address,
      addressRequiredNote: salon.booking_rules?.require_address_note,
      hiddenFields: Array.isArray(salon.booking_rules?.hidden_booking_fields)
        ? salon.booking_rules.hidden_booking_fields.filter((f): f is 'phone' | 'notes' => f === 'phone' || f === 'notes')
        : [],
      addressDetailLevel: salon.booking_rules?.address_detail_level === 'off' || salon.booking_rules?.address_detail_level === 'city'
        ? salon.booking_rules.address_detail_level : 'full',
      voucherEnabled: !!salon.voucher_settings?.enabled && !!salon.stripe_connect_onboarded && voucherTypes.length > 0,
      voucherTypes,
      newsletterEnabled: hasActivePackage(salon.newsletter_settings?.package),
      showMarketingConsent: salon.booking_rules?.show_marketing_consent_field !== false,
      consentEnabled: !!salon.consent_settings?.enabled && !!salon.consent_settings?.template_text?.trim(),
      consentTitle: salon.consent_settings?.title,
      consentText: salon.consent_settings?.template_text,
      customQuestions: salon.custom_questions,
      servicesExpandedOnMain: !!salon.booking_rules?.services_expanded_on_main,
      sectionOrder: salon.booking_rules?.public_section_order ?? null,
      hiddenSections: salon.booking_rules?.public_sections_hidden ?? null,
      fieldOrder: salon.booking_rules?.form_field_order ?? null,
      confirmEmailEnabled: salon.notification_prefs?.confirm_email !== false,
      reminderHours: reminderEnabled(salon) ? reminderOffsets(salon.feature_modules) : [],
      company: {
        name: salon.name,
        legal_name: salon.legal_name,
        tax_number: salon.tax_number,
        company_reg_number: salon.company_reg_number,
        registered_seat: salon.registered_seat,
        email: salon.email,
        phone: salon.phone,
        privacy_url: safeHttpUrl(salon.privacy_url),
      },
    },
  }

  return (
    <>
      {/* SEO + marketing-követés — a szerkesztő-előnézetben nem kell (ne mérjük a tulaj kattintásait). */}
      {!editor && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd(salon, 'salon', reviews, openingHours)) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(placeBreadcrumbJsonLd(salon)) }}
          />
          <MarketingTrackingScripts locale={locale} business={salon.name} bizKey={`salon:${salon.id}`} privacyHref={safeHttpUrl(salon.privacy_url)} ga4Id={salon.marketing_tracking?.ga4_measurement_id} facebookPixelId={salon.marketing_tracking?.facebook_pixel_id} />
        </>
      )}
      <PublicPlaceView data={view} nextSlotNode={nextSlotNode} editor={editor} />
    </>
  )
}
