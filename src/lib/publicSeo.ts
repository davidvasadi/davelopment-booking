import type { Metadata } from 'next'
import type { Salon, Restaurant, Media } from '@/payload/payload-types'
import type { Pricing } from '@/lib/pricing'

/**
 * SEO-segédek a publikus profil-oldalakhoz (/[slug]).
 *
 * Egy helyen gyártjuk a `generateMetadata` visszatérési értékét és a JSON-LD
 * structured datát a szalon/étterem közös mezőiből (name, description, city,
 * cover_image, phone, email). A description típusa eltér (Salon = Payload
 * richText, Restaurant = plain string), ezt a `descriptionText` normalizálja.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')

/** Egy Media (vagy id) URL-je abszolút formában, vagy null. */
export function mediaUrl(m: string | Media | null | undefined): string | null {
  if (!m || typeof m !== 'object') return null
  const url = (m as Media).url
  if (!url) return null
  return url.startsWith('http') ? url : `${SITE_URL}${url}`
}

/** Lexical richText → sík szöveg (első ~200 karakter), vagy plain string, vagy ''. */
export function descriptionText(desc: Salon['description'] | Restaurant['description']): string {
  if (!desc) return ''
  if (typeof desc === 'string') return desc.trim()
  // Payload lexical: bejárjuk a children-fát és összefűzzük a text-node-okat.
  const out: string[] = []
  const walk = (nodes: unknown[]) => {
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue
      const node = n as { text?: string; children?: unknown[] }
      if (typeof node.text === 'string') out.push(node.text)
      if (Array.isArray(node.children)) walk(node.children)
    }
  }
  const root = (desc as { root?: { children?: unknown[] } }).root
  if (root?.children) walk(root.children)
  return out.join(' ').replace(/\s+/g, ' ').trim()
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
  const title = place.city ? `${place.name} — ${place.city}` : place.name
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
export function placeJsonLd(place: PlaceLike, kind: 'salon' | 'restaurant'): Record<string, unknown> {
  const image = mediaUrl(place.cover_image) ?? mediaUrl(place.logo)
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
    potentialAction: {
      '@type': 'ReserveAction',
      target: `${SITE_URL}/${place.slug}/book`,
      name: kind === 'restaurant' ? 'Asztalfoglalás' : 'Időpontfoglalás',
    },
  }
}
