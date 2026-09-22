import type { Metadata } from 'next'
import Image from 'next/image'
import Script from 'next/script'
import { notFound } from 'next/navigation'
import { getPublicSalon, getPublicRestaurant } from '@/lib/publicPlace'
import { placeMetadata, placeJsonLd, placeBreadcrumbJsonLd, siteJsonLd, SITE_URL } from '@/lib/publicSeo'
import { getReviewSummary } from '@/lib/reviews'
import { getPricing } from '@/lib/pricing'
import { INDUSTRY_LANDINGS } from '@/lib/industryLandings'
import HomeClient from '../HomeClient'
import type { Media } from '@/payload/payload-types'
import { MapPin, Tag, Users } from 'lucide-react'
import { RatingStars } from '@/components/booking/RatingStars'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'
import { RestaurantPublicView } from '@/components/restaurant/RestaurantPublicView'
import { LangSwitcher } from '@/components/booking/LangSwitcher'
import { BrandLogo } from '@/components/BrandLogo'
import { ProfileCard } from '@/components/booking/ProfileCard'
import { MarketingTrackingScripts } from '@/components/booking/MarketingTrackingScripts'
import { SalonCtaWrapper } from '@/components/booking/SalonCtaWrapper'
import { getLocale } from '@/lib/i18n/server'
import { hasActivePackage } from '@/lib/newsletterLimits'
import { t, resolveAvailableLocales } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params

  // Iparág-specifikus SEO landing (pl. /fodrasz-idopontfoglalas) — a szűkebb, fenntartott
  // listával ellenőrizzük ELŐSZÖR, hogy ne fussunk le két felesleges DB-lekérdezést (szalon +
  // étterem keresés) minden landing-oldal-kérésnél.
  const landing = INDUSTRY_LANDINGS[slug]
  if (landing) {
    const url = `${SITE_URL}/${slug}`
    return {
      title: landing.seoTitle,
      description: landing.seoDescription,
      alternates: { canonical: url },
      openGraph: {
        type: 'website',
        title: landing.seoTitle,
        description: landing.seoDescription,
        url,
        siteName: 'davelopment booking',
      },
      twitter: {
        card: 'summary_large_image',
        title: landing.seoTitle,
        description: landing.seoDescription,
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
  searchParams: Promise<{ embed?: string }>
}) {
  const { slug } = await params

  const landing = INDUSTRY_LANDINGS[slug]
  if (landing) {
    const pricing = await getPricing()
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(pricing, landing.faqItems)) }}
        />
        <HomeClient pricing={pricing} industry={landing} />
      </>
    )
  }

  const embed = (await searchParams).embed === '1'
  const requested = await getLocale()

  const base = await getPublicSalon(slug, 'hu')

  if (!base) {
    const restaurantView = await RestaurantPublicView({ slug, requested, embed })
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

  // `typeof === 'string'` védelem: a `description` mostanáig richText-objektum volt, egy
  // korlátlanul cache-elt (`getPublicSalon`), séma-váltás előtti bejegyzés még a régi alakot
  // adhatja vissza, amíg az adott szalonnál nem történik újabb módosítás (revalidál).
  const salonDescription = typeof salon.description === 'string' ? (salon.description.trim().slice(0, 160) || null) : null

  const coverUrl = salon.cover_image && typeof salon.cover_image === 'object'
    ? (salon.cover_image as Media).url ?? null
    : null
  // "Áthelyezés" (fókuszpont) a beállításokból — object-position-ként, hogy a kép lényegi
  // része mobilon/desktopon (nagyon eltérő képarányon) is a helyén maradjon.
  const coverFocal = `${salon.cover_focal_x ?? 50}% ${salon.cover_focal_y ?? 50}%`
  const coverZoom = salon.cover_zoom ?? 1
  const logoUrl = salon.logo && typeof salon.logo === 'object'
    ? (salon.logo as Media).url ?? null
    : null

  // HeroNextSlot renderelése server-oldalon, átadva a kliensbe ReactNode-ként
  const nextSlotNode = services.length > 0
    ? <HeroNextSlot slug={slug} locale={locale} source={{ kind: 'salon', id: salon.id, serviceId: services[0].id }} />
    : null

  const hasCover = !!coverUrl
  const heroText = hasCover ? 'text-white' : 'text-[#1D1C19]'
  const heroSub  = hasCover ? 'text-white/60' : 'text-[#86826F]'

  return (
    <div
      className={`font-onest relative overflow-hidden ${embed ? 'min-h-[640px]' : 'min-h-[100dvh]'}`}
      style={embed ? { background: 'transparent' } : hasCover ? { background: '#111' } : {
        background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)',
      }}
    >
      {/* A globals.css `html` elemnek van egy kemény krém háttérszíne — embed módban ez
          átütne az átlátszó oldal mögött, ezt írjuk itt felül. */}
      {embed && <style>{'html, body { background: transparent !important; }'}</style>}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd(salon, 'salon', reviews, openingHours)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeBreadcrumbJsonLd(salon)) }}
      />
      <MarketingTrackingScripts ga4Id={salon.marketing_tracking?.ga4_measurement_id} facebookPixelId={salon.marketing_tracking?.facebook_pixel_id} />

      {/* Cover image + overlay — embed módban nem jelenik meg (kevesebb navigáció/fejléc). */}
      {!embed && hasCover && (
        <>
          <Image
            src={coverUrl!}
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="z-0 object-cover"
            style={{ objectPosition: coverFocal, transform: `scale(${coverZoom})`, transformOrigin: coverFocal }}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.35) 100%)' }}
          />
          {/* Dedikált felső árnyék — a navbar (logó, jelvények, nyelvváltó) mindig olvasható
              maradjon, függetlenül attól, hogy a borítókép teteje éppen világos-e */}
          <div
            className="pointer-events-none absolute top-0 left-0 right-0 z-[2]"
            style={{ height: '22%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
          />
          {/* Erős alul-gradient — fehér/világos borítóképnél is olvasható marad a cím és a
              Google-értékelés (magasabb + sötétebb, hogy a csillagok/szám is mindig kiolvasható) */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-[2]"
            style={{ height: '70%', background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 100%)' }}
          />
        </>
      )}

      {!embed && (
        <>
          {/* Navbar — mobilon KÉT sor (logó+nyelvváltó felül, szolgáltatás/munkatárs-számláló
              alatta középre), mert az abszolút-középre-pozicionált számláló szűk kijelzőn
              rááfedett a logóra. Desktopon (lg+) marad az eredeti, egysoros elrendezés. */}
          <nav className="relative z-50 flex flex-col gap-3 px-5 py-5 lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BrandLogo variant={hasCover ? 'dark' : 'light'} className="h-6" />
                {logoUrl && <div className={`h-4 w-px ${hasCover ? 'bg-white/20' : 'bg-black/15'}`} />}
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={salon.name} className="h-7 w-auto max-w-[120px] rounded-[6px] object-contain" />
                )}
              </div>
              {available.length > 1 && <LangSwitcher current={locale} available={available} variant={hasCover ? 'dark' : 'light'} />}
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <Tag className={`h-3.5 w-3.5 ${hasCover ? 'text-white/50' : 'text-ink/60'}`} />
                <span className={`text-sm font-semibold ${hasCover ? 'text-white' : 'text-ink'}`}>{services.length}</span>
                <span className={`text-[11px] ${hasCover ? 'text-white/45' : 'text-ink/45'}`}>{t(locale, 'booking.step.service')}</span>
              </div>
              <div className={`h-4 w-px ${hasCover ? 'bg-white/15' : 'bg-ink/12'}`} />
              <div className="flex items-center gap-1.5">
                <Users className={`h-3.5 w-3.5 ${hasCover ? 'text-white/50' : 'text-ink/60'}`} />
                <span className={`text-sm font-semibold ${hasCover ? 'text-white' : 'text-ink'}`}>{staff.length}</span>
                <span className={`text-[11px] ${hasCover ? 'text-white/45' : 'text-ink/45'}`}>{t(locale, 'booking.step.staff')}</span>
              </div>
            </div>
          </nav>

          {/* Desktop navbar — eredeti egysoros elrendezés, abszolút-középre pozicionált számlálóval. */}
          <nav className="relative z-50 hidden items-center justify-between px-8 py-6 lg:flex">
            <div className="flex items-center gap-3">
              <BrandLogo variant={hasCover ? 'dark' : 'light'} className="h-7" />
              {logoUrl && <div className={`h-4 w-px ${hasCover ? 'bg-white/20' : 'bg-black/15'}`} />}
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={salon.name} className="h-7 w-auto max-w-[120px] rounded-[6px] object-contain" />
              )}
            </div>
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-5">
              <div className="flex items-center gap-2">
                <Tag className={`h-[15px] w-[15px] ${hasCover ? 'text-white/50' : 'text-ink/60'}`} />
                <span className={`text-base font-semibold ${hasCover ? 'text-white' : 'text-ink'}`}>{services.length}</span>
                <span className={`text-xs ${hasCover ? 'text-white/45' : 'text-ink/45'}`}>{t(locale, 'booking.step.service')}</span>
              </div>
              <div className={`h-4 w-px ${hasCover ? 'bg-white/15' : 'bg-ink/12'}`} />
              <div className="flex items-center gap-2">
                <Users className={`h-[15px] w-[15px] ${hasCover ? 'text-white/50' : 'text-ink/60'}`} />
                <span className={`text-base font-semibold ${hasCover ? 'text-white' : 'text-ink'}`}>{staff.length}</span>
                <span className={`text-xs ${hasCover ? 'text-white/45' : 'text-ink/45'}`}>{t(locale, 'booking.step.staff')}</span>
              </div>
            </div>
            {available.length > 1 && <LangSwitcher current={locale} available={available} variant={hasCover ? 'dark' : 'light'} />}
          </nav>

          {/* Szalon neve + cím — mobil hero (kártya megnyitása előtt) */}
          <div className="absolute bottom-[calc(max(2.5rem,env(safe-area-inset-bottom))+5rem)] left-0 right-0 z-10 px-6 lg:hidden">
            <h1 className={`text-[2.75rem] font-light leading-tight tracking-[-0.02em] ${heroText}`}>
              {salon.name}
            </h1>
            {(salon.address || salon.city) && (
              <p className={`mt-1 flex items-center gap-1.5 text-sm ${heroSub}`}>
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {[salon.address, salon.city].filter(Boolean).join(', ')}
              </p>
            )}
            {reviews.count > 0 && (
              <div className="mt-2">
                <RatingStars rating={reviews.average} count={reviews.count} dark={hasCover} />
              </div>
            )}
            {salonDescription && (
              <p className={`mt-2 line-clamp-2 text-[13px] leading-relaxed ${heroSub}`}>{salonDescription}</p>
            )}
          </div>

          {/* Szalon neve + CTA — desktop, bal alul */}
          <div className="absolute bottom-10 left-8 z-20 hidden lg:block">
            <h1 className={`text-[3rem] font-light leading-none tracking-[-0.02em] mb-2 ${heroText}`}>
              {salon.name}
            </h1>
            {(salon.address || salon.city) && (
              <p className={`flex items-center gap-1.5 text-sm mb-4 ${heroSub}`}>
                <MapPin className="h-3.5 w-3.5" />
                {[salon.address, salon.city].filter(Boolean).join(', ')}
              </p>
            )}
            {reviews.count > 0 && <RatingStars rating={reviews.average} count={reviews.count} className="mb-5" dark={hasCover} />}
            <div className="flex flex-wrap items-center gap-3">
              <SalonCtaWrapper>
                <BookCtaMorph href={`/${slug}/book`} label={t(locale, 'public.bookCta')} />
              </SalonCtaWrapper>
              {nextSlotNode && (
                <SalonCtaWrapper>
                  {nextSlotNode}
                </SalonCtaWrapper>
              )}
            </div>
          </div>
        </>
      )}

      {/* Interaktív profil kártya */}
      <ProfileCard
        slug={slug}
        salonId={String(salon.id)}
        locale={locale}
        salonName={salon.name}
        salonDescription={salonDescription}
        salonAddress={salon.address}
        salonCity={salon.city}
        services={services}
        staff={staff}
        serviceCategories={serviceCategories}
        phone={salon.phone}
        email={salon.email}
        website={salon.website}
        socialLinks={(salon.social_links ?? []).map((s) => s.url)}
        nextSlotNode={nextSlotNode}
        requirePhone={salon.require_phone ?? true}
        bookingWindowDays={salon.booking_window_days ?? 60}
        termsSections={salon.terms_sections}
        goodToKnow={salon.good_to_know}
        depositEnabled={!!salon.deposit_settings?.enabled && !!salon.stripe_connect_onboarded}
        invoicingEnabled={!!salon.invoice_settings?.invoice_provider && salon.invoice_settings.invoice_provider !== 'none'}
        addressRequired={!!salon.booking_rules?.require_address}
        addressRequiredNote={salon.booking_rules?.require_address_note}
        voucherEnabled={!!salon.voucher_settings?.enabled && !!salon.stripe_connect_onboarded && voucherTypes.length > 0}
        voucherTypes={voucherTypes}
        newsletterEnabled={hasActivePackage(salon.newsletter_settings?.package)}
        consentEnabled={!!salon.consent_settings?.enabled && !!salon.consent_settings?.template_text?.trim()}
        consentTitle={salon.consent_settings?.title}
        consentText={salon.consent_settings?.template_text}
        customQuestions={salon.custom_questions}
        embed={embed}
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
    </div>
  )
}
