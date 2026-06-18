import { notFound } from 'next/navigation'
import { getPublicSalon } from '@/lib/publicPlace'
import type { Media } from '@/payload/payload-types'
import { MapPin, Phone, Mail, Globe } from 'lucide-react'
import Link from 'next/link'
import PublicServicesSection from '@/components/PublicServicesSection'
import PublicStaffSection from '@/components/PublicStaffSection'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'
import { BookCtaButton } from '@/components/booking/BookCtaButton'
import { GoodToKnowSection } from '@/components/booking/GoodToKnowSection'
import { RestaurantPublicView } from '@/components/restaurant/RestaurantPublicView'
import { LangSwitcher } from '@/components/booking/LangSwitcher'
import { getLocale } from '@/lib/i18n/server'
import { t, resolveAvailableLocales } from '@/lib/i18n'

export default async function SalonPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const requested = await getLocale()

  // Először HU-n töltünk, hogy megismerjük a tulaj által engedélyezett nyelveket; ha a kért nyelv
  // nincs engedélyezve, marad HU. Ha igen és nem HU, a tartalmat a kért nyelven töltjük újra.
  const base = await getPublicSalon(slug, 'hu')

  // No active salon for this slug — fall through to a restaurant, then 404.
  if (!base) {
    const restaurantView = await RestaurantPublicView({ slug, requested })
    if (restaurantView) return restaurantView
    notFound()
  }

  const available = resolveAvailableLocales(base.salon.supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'
  const salonData = locale === 'hu' ? base : (await getPublicSalon(slug, locale)) ?? base
  const { salon, services, staff, serviceCategories } = salonData

  const coverUrl = salon.cover_image && typeof salon.cover_image === 'object'
    ? (salon.cover_image as Media).url ?? null
    : null
  const logoUrl = salon.logo && typeof salon.logo === 'object'
    ? (salon.logo as Media).url ?? null
    : null

  return (
    <div className="min-h-screen bg-[#F5F4F2]">
      {/* Hero */}
      <div className="relative bg-zinc-950 overflow-hidden">
        {coverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}
        <div className="relative max-w-3xl mx-auto px-5 pt-12 pb-10">
          <div className="absolute top-5 right-5"><LangSwitcher current={locale} available={available} /></div>
          {logoUrl && (
            <img src={logoUrl} alt={salon.name} className="h-12 w-12 rounded-xl object-cover mb-4 ring-1 ring-white/10" />
          )}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">{t(locale, "public.eyebrow")}</p>
          <h1 className="text-4xl font-black tracking-tight text-white leading-tight">{salon.name}</h1>
          {(salon.address || salon.city) && (
            <p className="flex items-center gap-1.5 text-zinc-400 text-sm mt-3">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {[salon.address, salon.city].filter(Boolean).join(', ')}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-4">
            {salon.phone && (
              <a href={`tel:${salon.phone}`} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Phone className="h-3 w-3" />{salon.phone}
              </a>
            )}
            {salon.email && (
              <a href={`mailto:${salon.email}`} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Mail className="h-3 w-3" />{salon.email}
              </a>
            )}
            {salon.website && (
              <a href={salon.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Globe className="h-3 w-3" />{t(locale, "public.website")}
              </a>
            )}
          </div>
          <BookCtaMorph className="mt-6" href={`/${slug}/book`} label={t(locale, 'public.bookCta')} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-10 space-y-10">

        {/* Services with category tabs */}
        {services.length > 0 && (
          <PublicServicesSection
            services={services}
            serviceCategories={serviceCategories}
            slug={slug}
            locale={locale}
          />
        )}

        {/* Staff */}
        {staff.length > 0 && <PublicStaffSection staff={staff} slug={slug} locale={locale} />}

        {/* Jó tudni — közös komponens (szalon + étterem egységes). */}
        <GoodToKnowSection items={salon.good_to_know} locale={locale} />

        {/* Bottom CTA */}
        <div className="bg-zinc-950 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white font-black text-lg">{salon.name}</p>
            <p className="text-zinc-500 text-sm mt-0.5">{t(locale, "public.bottomCta")}</p>
          </div>
          <BookCtaButton href={`/${slug}/book`} label={t(locale, 'public.bookCta')} variant="light" className="sm:w-auto sm:px-8 shrink-0" />
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-5 py-3">
        <Link
          href={`/${slug}/book`}
          className="flex items-center justify-center w-full h-12 rounded-full bg-zinc-950 text-white font-bold text-sm hover:bg-zinc-800 transition-colors"
        >
          {t(locale, 'public.book')}
        </Link>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  )
}
