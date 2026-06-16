import Link from 'next/link'
import { getPublicRestaurant } from '@/lib/publicPlace'
import { MapPin, Phone, Mail, Globe } from 'lucide-react'
import { GoodToKnowSection } from '@/components/booking/GoodToKnowSection'
import { BookCtaMorph } from '@/components/booking/BookCtaMorph'
import { BookCtaButton } from '@/components/booking/BookCtaButton'
import type { Media } from '@/payload/payload-types'
import OpeningHoursLive from '@/components/restaurant/OpeningHoursLive'
import NextAvailableSlots from '@/components/restaurant/NextAvailableSlots'

/**
 * Renders an active restaurant's public landing page.
 * Returns null when no active restaurant matches the slug, so callers
 * (the shared [slug] route) can fall through to notFound().
 */
export async function RestaurantPublicView({ slug }: { slug: string }) {
  const data = await getPublicRestaurant(slug)
  if (!data) return null
  const { restaurant } = data

  const openingHours = data.openingHours.map((h) => ({
    day_of_week: h.day_of_week,
    is_open: h.is_open,
    open_time: h.open_time,
    close_time: h.close_time,
  }))

  const coverUrl = restaurant.cover_image && typeof restaurant.cover_image === 'object'
    ? (restaurant.cover_image as Media).url ?? null
    : null
  const logoUrl = restaurant.logo && typeof restaurant.logo === 'object'
    ? (restaurant.logo as Media).url ?? null
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
          {logoUrl && (
            <img src={logoUrl} alt={restaurant.name} className="h-12 w-12 rounded-xl object-cover mb-4 ring-1 ring-white/10" />
          )}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Asztalfoglalás</p>
          <h1 className="text-4xl font-black tracking-tight text-white leading-tight">{restaurant.name}</h1>
          {(restaurant.address || restaurant.city) && (
            <p className="flex items-center gap-1.5 text-zinc-400 text-sm mt-3">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {[restaurant.address, restaurant.city].filter(Boolean).join(', ')}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-4">
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Phone className="h-3 w-3" />{restaurant.phone}
              </a>
            )}
            {restaurant.email && (
              <a href={`mailto:${restaurant.email}`} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Mail className="h-3 w-3" />{restaurant.email}
              </a>
            )}
            {restaurant.website && (
              <a href={restaurant.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <Globe className="h-3 w-3" />Weboldal
              </a>
            )}
          </div>
          <BookCtaMorph className="mt-6" href={`/${slug}/book`} label="Asztalfoglalás" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-10 space-y-10">

        {/* Rólunk */}
        {restaurant.description && (
          <section>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Az asztalunknál</p>
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-5">Rólunk</h2>
            <div className="rounded-2xl px-5 py-5 bg-white/70 backdrop-blur-md ring-1 ring-zinc-900/5 shadow-sm">
              <p className="text-zinc-600 leading-relaxed whitespace-pre-line">{restaurant.description}</p>
            </div>
          </section>
        )}

        {/* Legközelebbi szabad időpontok + nyitvatartás — a "Jó tudni" felett */}
        <div className="space-y-3">
          <NextAvailableSlots restaurantId={restaurant.id} slug={slug} />
          {openingHours.length > 0 && <OpeningHoursLive hours={openingHours} />}
        </div>

        {/* Jó tudni — közös komponens (szalon + étterem egységes). */}
        <GoodToKnowSection items={restaurant.good_to_know} />

        {/* Bottom CTA */}
        <div className="bg-zinc-950 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white font-black text-lg">{restaurant.name}</p>
            <p className="text-zinc-500 text-sm mt-0.5">Foglaljon asztalt online, pár kattintással</p>
          </div>
          <BookCtaButton href={`/${slug}/book`} label="Asztalfoglalás" variant="light" className="sm:w-auto sm:px-8 shrink-0" />
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-5 py-3">
        <Link
          href={`/${slug}/book`}
          className="flex items-center justify-center w-full h-12 rounded-full bg-zinc-950 text-white font-bold text-sm hover:bg-zinc-800 transition-colors"
        >
          Asztalfoglalás
        </Link>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  )
}

