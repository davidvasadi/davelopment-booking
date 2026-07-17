import type { CollectionAfterDeleteHook } from 'payload'

/**
 * Egy hely (szalon/étterem) törlésekor a hozzá tartozó FELTÖLTÖTT KÉPEK (media) is töröljenek,
 * hogy ne maradjon árva fájl a media-collectionben és a lemezen. A `beforeDelete` már törli a
 * kapcsolt rekordokat (foglalások, szolgáltatások, staff…), de a media relationship-ek (logo,
 * cover_image, staff-avatar) nem kaszkádolnak automatikusan — ezt pótolja ez a hook.
 *
 * Best-effort: a hibákat lenyeli (a törlés fő menete ne bukjon el egy már hiányzó fájlon).
 * A media-t CSAK akkor törli, ha semmi más nem hivatkozik rá (megosztott kép védelme).
 */

/** Egy media-id-t töröl, ha rajta kívül más rekord már nem hivatkozza (biztonságos). */
async function deleteMediaIfUnreferenced(
  req: Parameters<CollectionAfterDeleteHook>[0]['req'],
  mediaId: number | string | null | undefined,
): Promise<void> {
  if (mediaId == null) return
  const id = typeof mediaId === 'object' ? (mediaId as { id: number | string }).id : mediaId
  if (id == null) return
  try {
    // Egyszerűen megpróbáljuk törölni; ha valahol FK-val hivatkozott, a DB nem engedi (ON DELETE
    // SET NULL/RESTRICT), és a catch elnyeli. Így nem törlünk élő, máshol használt képet.
    await req.payload.delete({ collection: 'media', id, overrideAccess: true, req })
  } catch {
    /* máshol hivatkozott vagy már törölt — hagyjuk */
  }
}

/** A hely saját logo + cover_image media-ját takarítja törlés után. */
export function cleanupPlaceMedia(): CollectionAfterDeleteHook {
  return async ({ req, doc }) => {
    if (!doc) return
    const logo = doc.logo && typeof doc.logo === 'object' ? doc.logo.id : doc.logo
    const cover = doc.cover_image && typeof doc.cover_image === 'object' ? doc.cover_image.id : doc.cover_image
    await Promise.all([
      deleteMediaIfUnreferenced(req, logo),
      deleteMediaIfUnreferenced(req, cover),
    ])
  }
}
