import { unstable_cache } from 'next/cache'
import { getPayloadClient } from '@/lib/payload'
import type { Locale } from '@/lib/i18n'
import type {
  Salon,
  Service,
  ServiceCategory,
  StaffMember,
  Restaurant,
  OpeningHour,
} from '@/payload/payload-types'

/**
 * Cache-elt adat-réteg a PUBLIKUS profiloldalakhoz (/[slug]).
 *
 * Csak a marketing-jellegű profil-adat (név, leírás, szolgáltatások, munkatársak,
 * nyitvatartás) cache-elt — a szabad időpontok / asztalok és a foglalás-mentés
 * SOHA nem fut ezen keresztül, azok mindig élők.
 *
 * Az invalidáció tag-alapú: tényleges tulaj-módosításkor a megfelelő collection
 * afterChange/afterDelete hookja revalidateTag-et hív (lásd
 * src/payload/hooks/revalidatePublicPlace.ts). Felesleges újraépítés nincs.
 *
 * A find-ek plain (szerializálható) JSON-t adnak vissza; a Media URL-kibontás és
 * a JSX a hívó oldalon marad — így a cache-elt érték garantáltan szerializálható.
 */

export const salonTag = (slug: string) => `place:salon:${slug}`
export const restaurantTag = (slug: string) => `place:restaurant:${slug}`

export type PublicSalonData = {
  salon: Salon
  services: Service[]
  staff: StaffMember[]
  serviceCategories: ServiceCategory[]
} | null

export type PublicRestaurantData = {
  restaurant: Restaurant
  openingHours: OpeningHour[]
} | null

async function fetchPublicSalon(slug: string, locale: Locale): Promise<PublicSalonData> {
  const payload = await getPayloadClient()

  // A localizált tulaj-mezők a vendég nyelvén jönnek; üres nyelvnél HU fallback.
  const salonResult = await payload.find({
    collection: 'salons',
    where: { and: [{ slug: { equals: slug } }, { is_active: { equals: true } }] },
    depth: 2,
    limit: 1,
    locale,
    fallbackLocale: 'hu',
  })
  if (!salonResult.docs.length) return null
  const salon = salonResult.docs[0] as Salon

  const [servicesResult, staffResult, categoriesResult] = await Promise.all([
    payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 1,
      limit: 100,
      locale,
      fallbackLocale: 'hu',
    }),
    payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 1,
      limit: 100,
      locale,
      fallbackLocale: 'hu',
    }),
    payload.find({
      collection: 'service-categories',
      where: { salon: { equals: salon.id } },
      sort: 'sort_order',
      depth: 1,
      limit: 100,
      locale,
      fallbackLocale: 'hu',
    }),
  ])

  return {
    salon,
    services: servicesResult.docs as Service[],
    staff: staffResult.docs as StaffMember[],
    serviceCategories: categoriesResult.docs as ServiceCategory[],
  }
}

async function fetchPublicRestaurant(slug: string, locale: Locale): Promise<PublicRestaurantData> {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'restaurants',
    where: { and: [{ slug: { equals: slug } }, { is_active: { not_equals: false } }] },
    depth: 1,
    limit: 1,
    locale,
    fallbackLocale: 'hu',
  })
  if (!result.docs.length) return null
  const restaurant = result.docs[0] as Restaurant

  const ohResult = await payload.find({
    collection: 'opening-hours',
    where: { restaurant: { equals: restaurant.id } },
    limit: 100,
  })

  return {
    restaurant,
    openingHours: ohResult.docs as OpeningHour[],
  }
}

/**
 * A publikus szalon-profil cache-elt lekérdezése.
 * Korlátlanul cache-elt; csak a place:salon:{slug} tag revalidálásakor frissül.
 */
export function getPublicSalon(slug: string, locale: Locale = 'hu'): Promise<PublicSalonData> {
  // A cache-kulcs nyelvenként külön (a localizált mezők eltérnek); a tag közös, így egy módosítás
  // minden nyelv-variánst invalidál.
  return unstable_cache(() => fetchPublicSalon(slug, locale), ['public-salon', slug, locale], {
    tags: [salonTag(slug)],
  })()
}

/**
 * A publikus étterem-profil cache-elt lekérdezése.
 * Korlátlanul cache-elt; csak a place:restaurant:{slug} tag revalidálásakor frissül.
 */
export function getPublicRestaurant(slug: string, locale: Locale = 'hu'): Promise<PublicRestaurantData> {
  return unstable_cache(() => fetchPublicRestaurant(slug, locale), ['public-restaurant', slug, locale], {
    tags: [restaurantTag(slug)],
  })()
}
