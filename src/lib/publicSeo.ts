import type { Metadata } from 'next'
import type { Salon, Restaurant, Media } from '@/payload/payload-types'
import type { Pricing } from '@/lib/pricing'

/**
 * SEO-segédek a publikus profil-oldalakhoz (/[slug]).
 *
 * Egy helyen gyártjuk a `generateMetadata` visszatérési értékét és a JSON-LD
 * structured datát a szalon/étterem közös mezőiből (name, description, city,
 * cover_image, phone, email).
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')

/** Egy Media (vagy id) URL-je abszolút formában, vagy null. */
export function mediaUrl(m: string | Media | null | undefined): string | null {
  if (!m || typeof m !== 'object') return null
  const url = (m as Media).url
  if (!url) return null
  return url.startsWith('http') ? url : `${SITE_URL}${url}`
}

/** A hely leírása, trimmelve — mindkét collectionnél sima szöveg. `typeof` védelem: a szalon
 *  `description`-je korábban richText-objektum volt, egy korlátlanul cache-elt, séma-váltás
 *  előtti bejegyzés még a régi alakot adhatja vissza. */
export function descriptionText(desc: Salon['description'] | Restaurant['description']): string {
  return typeof desc === 'string' ? desc.trim() : ''
}

/** Rövid, találati-listára szánt leírás: a saját leírás, vagy egy értelmes fallback. */
function metaDescription(name: string, city: string | null | undefined, desc: string, kind: 'salon' | 'restaurant'): string {
  if (desc) return desc.slice(0, 160)
  const where = city ? ` ${city}` : ''
  return kind === 'restaurant'
    ? `Foglalj asztalt online a(z) ${name} étteremben${where}. Gyors, egyszerű asztalfoglalás.`
    : `Foglalj időpontot online a(z) ${name} szolgáltatásaira${where}. Gyors, egyszerű online foglalás.`
}

type PlaceLike = {
  name: string
  slug: string
  city?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  cover_image?: string | Media | null
  logo?: string | Media | null
}

/** A publikus profil-oldal `generateMetadata` értéke (title/description/OG/canonical). */
export function placeMetadata(
  place: PlaceLike & { description?: Salon['description'] | Restaurant['description'] },
  kind: 'salon' | 'restaurant',
): Metadata {
  const desc = descriptionText(place.description)
  const description = metaDescription(place.name, place.city, desc, kind)
  // Ha a hely NEVE már tartalmazza a várost (pl. "Szalon Budapest"), ne fűzzük hozzá még
  // egyszer — "Szalon Budapest — Budapest" félrevezető, redundáns title-t adna.
  const cityAlreadyInName = place.city && place.name.toLowerCase().includes(place.city.toLowerCase())
  const title = place.city && !cityAlreadyInName ? `${place.name} — ${place.city}` : place.name
  const coverImage = mediaUrl(place.cover_image) ?? mediaUrl(place.logo)
  const url = `${SITE_URL}/${place.slug}`

  // Dinamikus OG kép: cover fotó + "davelopment booking" branding rárenderelve.
  const salonLogo = mediaUrl(place.logo)
  const ogParams = new URLSearchParams({ name: place.name, city: place.city ?? '' })
  if (coverImage) ogParams.set('image', coverImage)
  if (salonLogo)  ogParams.set('logo', salonLogo)
  const ogImage = `${SITE_URL}/api/og?${ogParams.toString()}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: 'davelopment booking',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

/** schema.org JSON-LD a főoldalhoz — Organization + SoftwareApplication (a legalacsonyabb aktuális árral). */
export function siteJsonLd(pricing: Pricing): Record<string, unknown> {
  const lowestPrice = Math.min(pricing.salon_pro_huf, pricing.restaurant_pro_huf)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'davelopment booking',
        url: SITE_URL,
        logo: `${SITE_URL}/icons/favico_dark.svg`,
      },
      {
        '@type': 'SoftwareApplication',
        name: 'davelopment booking',
        url: SITE_URL,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description:
          'Online időpont- és asztalfoglaló rendszer éttermeknek, fodrászatoknak és szépségszalonoknak.',
        offers: {
          '@type': 'Offer',
          price: lowestPrice,
          priceCurrency: 'HUF',
          priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
        },
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  }
}

/** schema.org JSON-LD a rich-resulthoz (LocalBusiness / Restaurant / HairSalon). */
/** Payload `day_of_week` ('monday'…) → schema.org napnév ('Monday'…). */
function capitalizeDay(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export type OpeningHourLike = { day_of_week: string; is_open?: boolean | null; open_time?: string | null; close_time?: string | null }

/** Heti nyitvatartás → schema.org `OpeningHoursSpecification` tömb (csak a valóban nyitott napok). */
function openingHoursSpec(hours: OpeningHourLike[]): Record<string, unknown>[] {
  return hours
    .filter((h) => h.is_open && h.open_time && h.close_time)
    .map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${capitalizeDay(h.day_of_week)}`,
      opens: h.open_time,
      closes: h.close_time,
    }))
}

export function placeJsonLd(
  place: PlaceLike,
  kind: 'salon' | 'restaurant',
  /** Csillag-értékelés a Google találati listájában megjelenő csillagokhoz (`AggregateRating`) —
   *  Google irányelve szerint csak akkor szabad kiírni, ha van legalább 1 valódi értékelés. */
  reviews?: { average: number; count: number },
  /** Heti nyitvatartás — ha van, a Google közvetlenül a találatban is megjelenítheti ("Nyitva"/
   *  "Zárva", nyitvatartási idő). */
  openingHours?: OpeningHourLike[],
): Record<string, unknown> {
  const image = mediaUrl(place.cover_image) ?? mediaUrl(place.logo)
  const spec = openingHours ? openingHoursSpec(openingHours) : []
  return {
    '@context': 'https://schema.org',
    '@type': kind === 'restaurant' ? 'Restaurant' : 'HealthAndBeautyBusiness',
    name: place.name,
    url: `${SITE_URL}/${place.slug}`,
    ...(image ? { image } : {}),
    ...(place.address || place.city
      ? { address: { '@type': 'PostalAddress', ...(place.address ? { streetAddress: place.address } : {}), ...(place.city ? { addressLocality: place.city } : {}) } }
      : {}),
    ...(place.phone ? { telephone: place.phone } : {}),
    ...(place.email ? { email: place.email } : {}),
    ...(reviews && reviews.count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: reviews.average, reviewCount: reviews.count, bestRating: 5, worstRating: 1 } }
      : {}),
    ...(spec.length > 0 ? { openingHoursSpecification: spec } : {}),
    potentialAction: {
      '@type': 'ReserveAction',
      target: `${SITE_URL}/${place.slug}/book`,
      name: kind === 'restaurant' ? 'Asztalfoglalás' : 'Időpontfoglalás',
    },
  }
}

/**
 * Breadcrumb JSON-LD a profil-oldalhoz (Főoldal > [Város] > [Hely neve]) — a `/[slug]/book`
 * foglaló wizard szándékosan `robots.txt`-tel le van tiltva a crawlolástól, ezért oda NEM kerül
 * strukturált adat (fölösleges lenne egy nem-indexelt oldalon), csak ide, az indexelt profilra.
 */
export function placeBreadcrumbJsonLd(place: PlaceLike): Record<string, unknown> {
  const items = [
    { name: 'Főoldal', item: SITE_URL },
    ...(place.city ? [{ name: place.city, item: `${SITE_URL}/?city=${encodeURIComponent(place.city)}` }] : []),
    { name: place.name, item: `${SITE_URL}/${place.slug}` },
  ]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  }
}
