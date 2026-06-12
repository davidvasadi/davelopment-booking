import { revalidateTag } from 'next/cache'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  PayloadRequest,
} from 'payload'
import { salonTag, restaurantTag } from '@/lib/publicPlace'

/**
 * On-demand revalidáció a PUBLIKUS profiloldalakhoz (/[slug]).
 *
 * A cache-elt adat-réteget (src/lib/publicPlace.ts) tag-alapon invalidáljuk:
 * amikor a tulaj módosít egy szalont/éttermet vagy annak gyermek-rekordját
 * (szolgáltatás, munkatárs, kategória, nyitvatartás), a megfelelő
 * place:{kind}:{slug} taget revalidáljuk → a publikus oldal azonnal frissül,
 * felesleges újraépítés nélkül.
 */

type PlaceKind = 'salon' | 'restaurant'

const tagFor = (kind: PlaceKind, slug: string) =>
  kind === 'salon' ? salonTag(slug) : restaurantTag(slug)

function revalidatePlace(kind: PlaceKind, slug: string | null | undefined) {
  if (!slug) return
  // Next 16: a revalidateTag második argumentuma a cache-profil. A 'max' a
  // beépített „korlátlanul cache-elt, csak explicit invalidációkor frissül"
  // profil — pontosan az on-demand revalidáció szándéka.
  revalidateTag(tagFor(kind, slug), 'max')
}

/**
 * Hook a HELY-collectionökhöz (salons / restaurants), ahol a doc maga
 * tartalmazza a slug-ot. Slug-váltáskor a régi slug tag-jét is invalidáljuk,
 * különben a régi URL cache-e árván maradna.
 */
export function revalidatePlaceOnChange(kind: PlaceKind): CollectionAfterChangeHook {
  return ({ doc, previousDoc }) => {
    revalidatePlace(kind, doc?.slug)
    if (previousDoc?.slug && previousDoc.slug !== doc?.slug) {
      revalidatePlace(kind, previousDoc.slug)
    }
    return doc
  }
}

export function revalidatePlaceOnDelete(kind: PlaceKind): CollectionAfterDeleteHook {
  return ({ doc }) => {
    revalidatePlace(kind, doc?.slug)
    return doc
  }
}

/**
 * A reláció-mezőből (salon / restaurant) kioldja a kapcsolt hely slug-ját.
 * A mező lehet ID (depth 0) vagy már feloldott objektum (depth > 0).
 */
async function resolveParentSlug(
  req: PayloadRequest,
  parentCollection: 'salons' | 'restaurants',
  relation: unknown,
): Promise<string | null> {
  if (!relation) return null
  if (typeof relation === 'object') {
    const slug = (relation as { slug?: unknown }).slug
    return typeof slug === 'string' ? slug : null
  }
  try {
    const parent = await req.payload.findByID({
      collection: parentCollection,
      id: relation as string | number,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const slug = (parent as { slug?: unknown })?.slug
    return typeof slug === 'string' ? slug : null
  } catch {
    return null
  }
}

/**
 * Hook a GYERMEK-collectionökhöz (services / staff / service-categories /
 * opening-hours), ahol a slug a kapcsolt helyből oldódik fel.
 *
 * @param kind a szülő hely típusa (a tag prefixéhez)
 * @param relationField a doc reláció-mezőjének neve ('salon' | 'restaurant')
 */
export function revalidateChildOnChange(
  kind: PlaceKind,
  relationField: 'salon' | 'restaurant',
): CollectionAfterChangeHook {
  const parentCollection = kind === 'salon' ? 'salons' : 'restaurants'
  return async ({ doc, previousDoc, req }) => {
    const slug = await resolveParentSlug(req, parentCollection, doc?.[relationField])
    revalidatePlace(kind, slug)
    // Ha a gyermeket átkötötték másik helyhez, a régit is frissítjük.
    const prevRelation = previousDoc?.[relationField]
    if (prevRelation && prevRelation !== doc?.[relationField]) {
      const prevSlug = await resolveParentSlug(req, parentCollection, prevRelation)
      revalidatePlace(kind, prevSlug)
    }
    return doc
  }
}

export function revalidateChildOnDelete(
  kind: PlaceKind,
  relationField: 'salon' | 'restaurant',
): CollectionAfterDeleteHook {
  const parentCollection = kind === 'salon' ? 'salons' : 'restaurants'
  return async ({ doc, req }) => {
    const slug = await resolveParentSlug(req, parentCollection, doc?.[relationField])
    revalidatePlace(kind, slug)
    return doc
  }
}
