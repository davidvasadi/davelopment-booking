import { unstable_cache } from 'next/cache'
import { getPayloadClient } from '@/lib/payload'
import { fixMediaUrl } from '@/lib/utils'
import type { Locale } from '@/lib/i18n'
import type {
  Salon,
  Service,
  ServiceCategory,
  StaffMember,
  Restaurant,
  OpeningHour,
  Availability,
  GiftVoucherType,
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
  voucherTypes: GiftVoucherType[]
  /** Szalon-szintű (staff nélküli), rendszeres heti nyitvatartás — a JSON-LD
   *  `openingHoursSpecification`-höz. */
  availability: Availability[]
} | null

export type PublicRestaurantData = {
  restaurant: Restaurant
  openingHours: OpeningHour[]
  voucherTypes: GiftVoucherType[]
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

  const [servicesResult, staffResult, categoriesResult, voucherTypesResult, availabilityResult] = await Promise.all([
    payload.find({
      collection: 'services',
      // a foglalóoldalon csak az aktív ÉS online látható szolgáltatások (Beállítások › Foglalóoldal › Szolgáltatások)
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }, { online_visible: { not_equals: false } }] },
      sort: ['sort_order', 'name'],
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
    payload.find({
      collection: 'gift-voucher-types',
      where: { and: [{ salon: { equals: salon.id } }, { active: { equals: true } }] },
      sort: 'amount_huf',
      depth: 1,
      limit: 100,
      locale,
      fallbackLocale: 'hu',
    }),
    // Szalon-szintű (staff nélküli), rendszeres (nem kivétel) heti nyitvatartás.
    payload.find({
      collection: 'availability',
      where: { and: [{ salon: { equals: salon.id } }, { staff: { exists: false } }, { exception_date: { exists: false } }] },
      depth: 0,
      limit: 20,
      overrideAccess: true,
    }),
  ])

  // Fallback-avatar EMAIL alapján: ha a tulaj sosem töltött fel külön staff-avatart, de a
  // személy a SAJÁT profiljában igen (`Users.avatar_url`), a publikus oldalon is azt mutassuk —
  // ugyanaz a minta, mint a dashboard Munkatársak/Naptár oldalain.
  // Csak a foglalható munkatársak kerülnek a publikus foglalóba: akit egyetlen aktív
  // szolgáltatáshoz sem rendeltek (pl. asszisztens), az ne jelenjen meg választhatóként és a
  // létszámban sem — különben a vendég olyan személyt látott, akihez nem is lehet foglalni.
  const bookableStaffIds = new Set(
    (servicesResult.docs as Service[]).flatMap((svc) =>
      (svc.staff ?? []).map((m) => String(m && typeof m === 'object' ? m.id : m)),
    ),
  )
  const staffDocs = (staffResult.docs as StaffMember[]).filter((s) => bookableStaffIds.has(String(s.id)))
  const staffEmails = staffDocs.map((s) => s.email).filter((e): e is string => !!e)
  let staffWithFallback = staffDocs
  if (staffEmails.length > 0) {
    const usersRes = await payload.find({
      collection: 'users',
      where: { email: { in: staffEmails } },
      depth: 0, limit: 500, overrideAccess: true,
    })
    const avatarByEmail: Record<string, string> = {}
    for (const u of usersRes.docs as { email?: string | null; avatar_url?: string | null }[]) {
      const fixed = fixMediaUrl(u.avatar_url)
      if (u.email && fixed) avatarByEmail[u.email.toLowerCase()] = fixed
    }
    staffWithFallback = staffDocs.map((s) => {
      if (s.avatar && typeof s.avatar === 'object') return s
      const fallback = s.email ? avatarByEmail[s.email.toLowerCase()] : null
      return fallback ? { ...s, avatar: { url: fallback } as StaffMember['avatar'] } : s
    })
  }

  return {
    salon,
    services: servicesResult.docs as Service[],
    staff: staffWithFallback.map(publicStaff),
    serviceCategories: categoriesResult.docs as ServiceCategory[],
    voucherTypes: voucherTypesResult.docs as GiftVoucherType[],
    availability: availabilityResult.docs as Availability[],
  }
}

/**
 * A foglalóoldalnak (és így a vendég böngészőjének) csak a nyilvános munkatárs-mezők mennek ki. Korábban a teljes
 * adatlap ment (bér, adóazonosító, lakcím, születésnap, telefon, e-mail, dokumentumok) — most fehérlistás. A saját
 * Stripe-fiókból csak annyi, hogy tud-e online fizetést fogadni (szakemberenkénti számlázásnál az előleghez).
 */
function publicStaff(s: StaffMember): StaffMember {
  return {
    id: s.id, name: s.name, bio: s.bio, social_links: s.social_links, salon: typeof s.salon === 'object' && s.salon ? s.salon.id : s.salon,
    avatar: s.avatar, is_active: s.is_active, role_title: s.role_title, department: s.department,
    booking_buffer_minutes: s.booking_buffer_minutes, min_lead_hours: s.min_lead_hours, default_breaks: s.default_breaks,
    stripe_connect_onboarded: !!s.stripe_connect_onboarded && !!s.stripe_connect_account_id,
    updatedAt: s.updatedAt, createdAt: s.createdAt,
  } as StaffMember
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

  const [ohResult, voucherTypesResult] = await Promise.all([
    payload.find({
      collection: 'opening-hours',
      where: { restaurant: { equals: restaurant.id } },
      limit: 100,
    }),
    payload.find({
      collection: 'gift-voucher-types',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { active: { equals: true } }] },
      sort: 'amount_huf',
      depth: 1,
      limit: 100,
      locale,
      fallbackLocale: 'hu',
    }),
  ])

  return {
    restaurant,
    openingHours: ohResult.docs as OpeningHour[],
    voucherTypes: voucherTypesResult.docs as GiftVoucherType[],
  }
}

/**
 * A publikus szalon-profil cache-elt lekérdezése.
 * Korlátlanul cache-elt; csak a place:salon:{slug} tag revalidálásakor frissül.
 */
export function getPublicSalon(slug: string, locale: Locale = 'hu'): Promise<PublicSalonData> {
  // A cache-kulcs nyelvenként külön (a localizált mezők eltérnek); a tag közös, így egy módosítás
  // minden nyelv-variánst invalidál.
  // A 'v2' verzió-jelző szándékos: a PublicSalonData alakja bővült (availability, description
  // string-re egyszerűsítve) — a régi, TTL nélküli cache-bejegyzéseket ez a deploy pillanatában
  // automatikusan érvényteleníti, nem kell megvárni, amíg a tulaj szerkeszt valamit.
  return unstable_cache(() => fetchPublicSalon(slug, locale), ['public-salon', slug, locale, 'v2'], {
    tags: [salonTag(slug)],
  })()
}

/**
 * A publikus étterem-profil cache-elt lekérdezése.
 * Korlátlanul cache-elt; csak a place:restaurant:{slug} tag revalidálásakor frissül.
 */
export function getPublicRestaurant(slug: string, locale: Locale = 'hu'): Promise<PublicRestaurantData> {
  // Lásd getPublicSalon() fenti megjegyzését — a JSON-LD kimenet (aggregateRating,
  // breadcrumb) itt is bővült, ugyanazzal a 'v2' cache-bumppal frissül minden régi bejegyzés.
  return unstable_cache(() => fetchPublicRestaurant(slug, locale), ['public-restaurant', slug, locale, 'v2'], {
    tags: [restaurantTag(slug)],
  })()
}
