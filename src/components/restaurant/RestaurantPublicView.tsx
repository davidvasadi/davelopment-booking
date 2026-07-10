import Link from 'next/link'
import { getPublicRestaurant } from '@/lib/publicPlace'
import { MapPin, Phone, Mail, Globe, Clock, Info } from 'lucide-react'
import { RatingStars } from '@/components/booking/RatingStars'
import { GoodToKnowSection } from '@/components/booking/GoodToKnowSection'
import { LangSwitcher } from '@/components/booking/LangSwitcher'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'
import { BookCtaButton } from '@/components/booking/BookCtaButton'
import { HeroNextSlot } from '@/components/booking/HeroNextSlot'
import { CoverCard } from '@/components/booking/CoverCard'
import { GlassCard, CrextioKpi } from '@/components/booking/crextio'
import type { Media } from '@/payload/payload-types'
import OpeningHoursLive from '@/components/restaurant/OpeningHoursLive'
import NextAvailableSlots from '@/components/restaurant/NextAvailableSlots'
import { t, resolveAvailableLocales, type Locale } from '@/lib/i18n'

/**
 * Renders an active restaurant's public landing page.
 * Returns null when no active restaurant matches the slug, so callers
 * (the shared [slug] route) can fall through to notFound().
 *
 * A `requested` a vendég kért nyelve (cookie); a tulaj `supported_locales`-éhez szűkítjük.
 */
export async function RestaurantPublicView({ slug, requested = 'hu' }: { slug: string; requested?: Locale }) {
  // Először HU-n töltünk a supported_locales megismeréséhez; ha a kért nyelv engedélyezett és nem HU,
  // a tartalmat azon a nyelven töltjük újra.
  const base = await getPublicRestaurant(slug, 'hu')
  if (!base) return null

  const available = resolveAvailableLocales(base.restaurant.supported_locales)
  const locale = available.includes(requested) ? requested : 'hu'
  const data = locale === 'hu' ? base : (await getPublicRestaurant(slug, locale)) ?? base
  const { restaurant } = data

  const openingHours = data.openingHours.map((h) => ({
    day_of_week: h.day_of_week,
    is_open: h.is_open,
    open_time: h.open_time,
    close_time: h.close_time,
  }))
  const openDaysPerWeek = openingHours.filter((h) => h.is_open).length

  const coverUrl = restaurant.cover_image && typeof restaurant.cover_image === 'object'
    ? (restaurant.cover_image as Media).url ?? null
    : null
  const logoUrl = restaurant.logo && typeof restaurant.logo === 'object'
    ? (restaurant.logo as Media).url ?? null
    : null

  return (
    <div className="font-onest min-h-screen bg-paper px-4 py-4 text-ink sm:px-6 sm:py-6">
      {/* Nagy krém-gradient konténer (34px) — 1:1 az Áttekintés wrapperével. A szekciók
          EZEN lebegnek külön krém-kártyákként. */}
      <div
        className="mx-auto max-w-5xl rounded-[34px] p-4 shadow-[0_34px_70px_-34px_rgba(80,70,30,.20),0_0_0_1px_rgba(120,110,70,.06)] sm:p-6"
        style={{ background: 'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%), linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)' }}
      >
        {/* HERO: bal = prominens borítókép-kártya, jobb = infó + CTA */}
        <div className="grid gap-[5px] lg:grid-cols-[340px_minmax(0,1fr)] lg:items-stretch">
          <div className="lg:aspect-auto" style={{ minHeight: 340 }}>
            <div className="h-full min-h-[340px]">
              <CoverCard
                imageUrl={coverUrl}
                fallbackInitials={(restaurant.name?.[0] ?? '·').toUpperCase()}
                title={restaurant.name}
                subtitle={[restaurant.address, restaurant.city].filter(Boolean).join(', ') || undefined}
              />
            </div>
          </div>

          <GlassCard padded={false} className="relative flex flex-col justify-between p-6 sm:p-8">
            <div className="absolute right-5 top-5"><LangSwitcher current={locale} available={available} /></div>
            <div>
              {logoUrl && (
                <img src={logoUrl} alt={restaurant.name} className="mb-4 h-12 w-12 rounded-[14px] object-cover ring-1 ring-black/5" />
              )}
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{t(locale, "public.bookTable")}</p>
              <h1 className="text-[34px] font-light leading-[1.03] tracking-[-0.02em] text-ink sm:text-[40px]">{restaurant.name}</h1>

              {/* Google-értékelés (jelenleg placeholder — a Places API bekötésekor valós adat) */}
              <RatingStars rating={4.8} count={213} className="mt-3" />

              {/* KPI-sor — valós adatból, a Crextio nagy vékony szám-tipográfiával */}
              <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
                {openDaysPerWeek > 0 && <CrextioKpi icon={Clock} value={openDaysPerWeek} label={t(locale, 'openingHours.title')} />}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {restaurant.address || restaurant.city ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[12px] font-medium text-ink-soft">
                    <MapPin className="h-3 w-3" />{[restaurant.address, restaurant.city].filter(Boolean).join(', ')}
                  </span>
                ) : null}
                {restaurant.phone && (
                  <a href={`tel:${restaurant.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
                    <Phone className="h-3 w-3" />{restaurant.phone}
                  </a>
                )}
                {restaurant.email && (
                  <a href={`mailto:${restaurant.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
                    <Mail className="h-3 w-3" />{restaurant.email}
                  </a>
                )}
                {restaurant.website && (
                  <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
                    <Globe className="h-3 w-3" />{t(locale, "public.website")}
                  </a>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-end gap-4">
              <BookCtaMorph href={`/${slug}/book`} label={t(locale, "public.bookTable")} />
              <HeroNextSlot slug={slug} locale={locale} source={{ kind: 'restaurant', id: restaurant.id, pax: 2 }} />
            </div>
          </GlassCard>
        </div>

        <div className="mt-[5px] space-y-[5px]">

          {/* Rólunk */}
          {restaurant.description && (
            <GlassCard>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gold/15">
                  <Info className="h-5 w-5 text-ink" strokeWidth={1.7} />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{t(locale, "public.aboutEyebrow")}</p>
                  <h2 className="text-[24px] font-light leading-tight tracking-[-0.01em] text-ink">{t(locale, "public.about")}</h2>
                </div>
              </div>
              <p className="whitespace-pre-line leading-relaxed text-ink-soft">{restaurant.description}</p>
            </GlassCard>
          )}

          {/* Legközelebbi szabad időpontok + nyitvatartás */}
          <GlassCard>
            <div className="space-y-3">
              <NextAvailableSlots restaurantId={restaurant.id} slug={slug} locale={locale} />
              {openingHours.length > 0 && <OpeningHoursLive hours={openingHours} locale={locale} />}
            </div>
          </GlassCard>

          {/* Jó tudni — közös komponens (szalon + étterem egységes). */}
          {(restaurant.good_to_know ?? []).some((p) => p?.title || p?.body) && (
            <GlassCard>
              <GoodToKnowSection items={restaurant.good_to_know} locale={locale} />
            </GlassCard>
          )}

          {/* Footer — ink lezáró kártya: logó + név + kapcsolat + CTA */}
          <div className="overflow-hidden rounded-[26px] bg-ink-dark p-8">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  {logoUrl && (
                    <img src={logoUrl} alt={restaurant.name} className="h-10 w-10 rounded-[12px] object-cover ring-1 ring-white/15" />
                  )}
                  <p className="text-[20px] font-light tracking-[-0.01em] text-white">{restaurant.name}</p>
                </div>
                <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-white/55">{t(locale, "public.bottomCtaRestaurant")}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-white/60">
                  {(restaurant.address || restaurant.city) && (
                    <span className="inline-flex items-center gap-1.5"><MapPin className="h-3 w-3" />{[restaurant.address, restaurant.city].filter(Boolean).join(', ')}</span>
                  )}
                  {restaurant.phone && <a href={`tel:${restaurant.phone}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white"><Phone className="h-3 w-3" />{restaurant.phone}</a>}
                  {restaurant.email && <a href={`mailto:${restaurant.email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white"><Mail className="h-3 w-3" />{restaurant.email}</a>}
                </div>
              </div>
              <BookCtaButton href={`/${slug}/book`} label={t(locale, "public.bookTable")} variant="light" className="shrink-0 sm:w-auto sm:px-8" />
            </div>
            <div className="mt-7 border-t border-white/10 pt-4 text-[11px] text-white/35">
              {restaurant.name}
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
          {t(locale, "public.bookTable")}
        </Link>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  )
}

