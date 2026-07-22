import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicSalon, getPublicRestaurant } from '@/lib/publicPlace'
import { placeMetadata, placeJsonLd } from '@/lib/publicSeo'
import { getReviewSummary } from '@/lib/reviews'
import type { Media } from '@/payload/payload-types'
import { MapPin } from 'lucide-react'
import { RatingStars } from '@/components/booking/RatingStars'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'
import { RestaurantPublicView } from '@/components/restaurant/RestaurantPublicView'
import { LangSwitcher } from '@/components/booking/LangSwitcher'
import { BrandLogo } from '@/components/BrandLogo'
import { ProfileCard } from '@/components/booking/ProfileCard'
import { SalonCtaWrapper } from '@/components/booking/SalonCtaWrapper'
import { getLocale } from '@/lib/i18n/server'
import { t, resolveAvailableLocales } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const salonData = await getPublicSalon(slug, 'hu')
  if (salonData) return placeMetadata(salonData.salon, 'salon')
  const restaurantData = await getPublicRestaurant(slug, 'hu')
  if (restaurantData) return placeMetadata(restaurantData.restaurant, 'restaurant')
  return {}
}

export default async function SalonPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const requested = await getLocale()

  const base = await getPublicSalon(slug, 'hu')

  if (!base) {
    const restaurantView = await RestaurantPublicView({ slug, requested })
    if (restaurantView) return restaurantView
    notFound()
  }

  const available = resolveAvailableLocales(base.salon.supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'
  const salonData = locale === 'hu' ? base : (await getPublicSalon(slug, locale)) ?? base
  const { salon, services, staff, serviceCategories } = salonData

  const reviews = await getReviewSummary('salon', salon.id)

  // Slate richText → plain text (első ~160 karakter a kártya headerébe)
  function slateToText(nodes: unknown): string {
    if (!Array.isArray(nodes)) return ''
    return nodes.map((n: unknown) => {
      if (!n || typeof n !== 'object') return ''
      const node = n as Record<string, unknown>
      if (typeof node.text === 'string') return node.text
      if (Array.isArray(node.children)) return slateToText(node.children)
      return ''
    }).join(' ').replace(/\s+/g, ' ').trim()
  }
  const salonDescription = slateToText(salon.description).slice(0, 160) || null

  const coverUrl = salon.cover_image && typeof salon.cover_image === 'object'
    ? (salon.cover_image as Media).url ?? null
    : null
  const logoUrl = salon.logo && typeof salon.logo === 'object'
    ? (salon.logo as Media).url ?? null
    : null

  // HeroNextSlot renderelése server-oldalon, átadva a kliensbe ReactNode-ként
  const nextSlotNode = services.length > 0
    ? <HeroNextSlot slug={slug} locale={locale} source={{ kind: 'salon', id: salon.id, serviceId: services[0].id }} />
    : null

  return (
    <div className="font-onest min-h-[100dvh] relative overflow-hidden" style={{ background: '#111' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd(salon, 'salon')) }}
      />

      {/* Cover image + overlay */}
      {coverUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 z-0 h-full w-full object-cover" />
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0.42) 100%)' }}
          />
        </>
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#3a2f12] via-[#9A7B1E] to-[#F1CE45]" />
      )}

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-5 py-5 lg:px-8 lg:py-6">
        <div className="flex items-center gap-3">
          <BrandLogo variant="dark" className="h-6 lg:h-7" />
          {logoUrl && <div className="h-4 w-px bg-white/20" />}
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={salon.name} className="h-7 w-7 rounded-[8px] object-cover ring-1 ring-white/20" />
          )}
        </div>
        {available.length > 1 && <LangSwitcher current={locale} available={available} />}
      </nav>

      {/* Szalon neve + CTA — desktop, bal alul */}
      <div className="absolute bottom-10 left-8 z-20 hidden lg:block">
        <h1
          className="text-[3rem] font-light leading-none tracking-[-0.02em] text-white mb-2"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
        >
          {salon.name}
        </h1>
        {(salon.address || salon.city) && (
          <p className="flex items-center gap-1.5 text-sm text-white/55 mb-4">
            <MapPin className="h-3.5 w-3.5" />
            {[salon.address, salon.city].filter(Boolean).join(', ')}
          </p>
        )}
        {reviews.count > 0 && <RatingStars rating={reviews.average} count={reviews.count} className="mb-5" />}
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
        nextSlotNode={nextSlotNode}
      />
    </div>
  )
}
