import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicSalon, getPublicRestaurant } from '@/lib/publicPlace'
import { placeMetadata, placeJsonLd } from '@/lib/publicSeo'
import { getReviewSummary } from '@/lib/reviews'
import type { Media } from '@/payload/payload-types'
import { MapPin, Phone, Mail, Globe, Scissors, Users } from 'lucide-react'
import { RatingStars } from '@/components/booking/RatingStars'
import { GlassCard, CrextioKpi, RoundIconButton } from '@/components/booking/crextio'
import Link from 'next/link'
import PublicServicesSection from '@/components/PublicServicesSection'
import PublicStaffSection from '@/components/PublicStaffSection'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'
import { BookCtaButton } from '@/components/booking/BookCtaButton'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'
import { CoverCard } from '@/components/booking/CoverCard'
import { GoodToKnowSection } from '@/components/booking/GoodToKnowSection'
import { RestaurantPublicView } from '@/components/restaurant/RestaurantPublicView'
import { LangSwitcher } from '@/components/booking/LangSwitcher'
import { getLocale } from '@/lib/i18n/server'
import { t, resolveAvailableLocales } from '@/lib/i18n'

/**
 * Dinamikus SEO-metaadat az üzlet valós adataiból (title/description/OG/canonical).
 * Ugyanaz a salon→restaurant fallback, mint a page-en; a cache-elt getterek miatt
 * ez NEM jelent plusz DB-hívást (a page ugyanezt a cache-t olvassa).
 */
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

  // Valós értékelés-összegzés (belső Reviews); üresen (0 vélemény) nem jelenítünk meg csillagot.
  const reviews = await getReviewSummary('salon', salon.id)

  const coverUrl = salon.cover_image && typeof salon.cover_image === 'object'
    ? (salon.cover_image as Media).url ?? null
    : null
  const logoUrl = salon.logo && typeof salon.logo === 'object'
    ? (salon.logo as Media).url ?? null
    : null

  return (
    <div className="font-onest min-h-screen bg-paper px-4 py-4 text-ink sm:px-6 sm:py-6">
      {/* schema.org structured data (rich-result: név, cím, telefon, foglalás-akció). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd(salon, 'salon')) }}
      />
      {/* Nagy krém-gradient konténer (34px) — 1:1 az Áttekintés wrapperével. A szekciók
          EZEN lebegnek külön krém-kártyákként. */}
      <div
        className="relative mx-auto max-w-5xl rounded-[34px] p-4 shadow-[0_34px_70px_-34px_rgba(80,70,30,.20),0_0_0_1px_rgba(120,110,70,.06)] sm:p-6"
        style={{ background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)' }}
      >
        {/* ── FELSŐ SÁV: eyebrow + üzletnév balra, nagy KPI-blokk jobbra (Crextio „78 / 56 / 203") ── */}
        <div className="flex flex-col gap-6 px-2 pb-6 pt-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2.5">
              {logoUrl && <img src={logoUrl} alt={salon.name} className="h-9 w-9 rounded-[11px] object-cover ring-1 ring-black/5" />}
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{t(locale, "public.eyebrow")}</p>
            </div>
            <h1 className="text-[40px] font-light leading-[1.0] tracking-[-0.03em] text-ink sm:text-[52px]">{salon.name}</h1>
            {reviews.count > 0 && <RatingStars rating={reviews.average} count={reviews.count} className="mt-3.5" />}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-4">
            {available.length > 1 && <LangSwitcher current={locale} available={available} />}
            <div className="flex items-start gap-8 sm:gap-10">
              {services.length > 0 && <CrextioKpi icon={Scissors} value={services.length} label={t(locale, 'public.services')} />}
              {staff.length > 0 && <CrextioKpi icon={Users} value={staff.length} label={t(locale, 'public.staff')} />}
            </div>
          </div>
        </div>

        {/* ── HERO BENTO: bal = borítókép-kártya, jobb = két üveg-kártya (CTA + kapcsolat) ── */}
        <div className="grid gap-[5px] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-stretch">
          <div className="min-h-[300px] lg:min-h-[380px]">
            <CoverCard
              imageUrl={coverUrl}
              fallbackInitials={(salon.name?.[0] ?? '·').toUpperCase()}
              title={salon.name}
              subtitle={[salon.address, salon.city].filter(Boolean).join(', ') || undefined}
            />
          </div>

          <div className="flex flex-col gap-[5px]">
            {/* CTA-kártya — a foglalás fő hívása, nagy és üveges */}
            <GlassCard className="flex flex-1 flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{t(locale, 'public.eyebrow')}</p>
                  <p className="mt-2 text-[22px] font-light leading-tight tracking-[-0.01em] text-ink">{t(locale, 'public.bottomCta')}</p>
                </div>
                <RoundIconButton />
              </div>
              <div className="mt-6 flex flex-wrap items-end gap-4">
                <BookCtaMorph href={`/${slug}/book`} label={t(locale, 'public.bookCta')} />
                {services.length > 0 && (
                  <HeroNextSlot slug={slug} locale={locale} source={{ kind: 'salon', id: salon.id, serviceId: services[0].id }} />
                )}
              </div>
            </GlassCard>

            {/* Kapcsolat-kártya (üveg) — cím + telefon + e-mail chipekben */}
            {(salon.address || salon.city || salon.phone || salon.email || salon.website) && (
              <GlassCard className="flex flex-wrap gap-2">
                {salon.address || salon.city ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[12px] font-medium text-ink-soft">
                    <MapPin className="h-3 w-3" />{[salon.address, salon.city].filter(Boolean).join(', ')}
                  </span>
                ) : null}
                {salon.phone && (
                  <a href={`tel:${salon.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
                    <Phone className="h-3 w-3" />{salon.phone}
                  </a>
                )}
                {salon.email && (
                  <a href={`mailto:${salon.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
                    <Mail className="h-3 w-3" />{salon.email}
                  </a>
                )}
                {salon.website && (
                  <a href={salon.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
                    <Globe className="h-3 w-3" />{t(locale, "public.website")}
                  </a>
                )}
              </GlassCard>
            )}
          </div>
        </div>

        <div className="mt-[5px] space-y-[5px]">

          {/* Services with category tabs */}
          {services.length > 0 && (
            <GlassCard>
              <PublicServicesSection
                services={services}
                serviceCategories={serviceCategories}
                slug={slug}
                locale={locale}
              />
            </GlassCard>
          )}

          {/* Staff */}
          {staff.length > 0 && (
            <GlassCard>
              <PublicStaffSection staff={staff} slug={slug} locale={locale} />
            </GlassCard>
          )}

          {/* Jó tudni — közös komponens (szalon + étterem egységes). */}
          {(salon.good_to_know ?? []).some((p) => p?.title || p?.body) && (
            <GlassCard>
              <GoodToKnowSection items={salon.good_to_know} locale={locale} />
            </GlassCard>
          )}

          {/* Footer — ink lezáró kártya: logó + név + kapcsolat + CTA */}
          <div className="overflow-hidden rounded-[26px] bg-ink-dark p-8">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  {logoUrl && (
                    <img src={logoUrl} alt={salon.name} className="h-10 w-10 rounded-[12px] object-cover ring-1 ring-white/15" />
                  )}
                  <p className="text-[20px] font-light tracking-[-0.01em] text-white">{salon.name}</p>
                </div>
                <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-white/55">{t(locale, "public.bottomCta")}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-white/60">
                  {(salon.address || salon.city) && (
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3" />{[salon.address, salon.city].filter(Boolean).join(', ')}</span>
                  )}
                  {salon.phone && <a href={`tel:${salon.phone}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white"><Phone className="h-3 w-3" />{salon.phone}</a>}
                  {salon.email && <a href={`mailto:${salon.email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white"><Mail className="h-3 w-3" />{salon.email}</a>}
                </div>
              </div>
              <BookCtaButton href={`/${slug}/book`} label={t(locale, 'public.bookCta')} variant="light" className="shrink-0 sm:w-auto sm:px-8" />
            </div>
            <div className="mt-7 border-t border-white/10 pt-4 text-[11px] text-white/35">
              {salon.name}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-line bg-white/85 px-5 py-3 backdrop-blur-[10px]">
        <Link
          href={`/${slug}/book`}
          className="flex h-12 w-full items-center justify-center rounded-full bg-ink-dark text-[14px] font-semibold text-white transition-colors hover:opacity-90"
        >
          {t(locale, 'public.book')}
        </Link>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  )
}
