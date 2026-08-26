import type { Payload, PayloadRequest } from 'payload'

/**
 * Minden collection+mező, ami `media`-ra hivatkozhat — a "még használt-e" ellenőrzés ezeket
 * nézi végig. A staff/membership `documents[]` tömb-mezőket SZÁNDÉKOSAN nem tartalmazza: egy
 * tömb elem-diffelése (hozzáadás/törlés) túl kockázatos lenne automatikus törléshez, ott a
 * fájl inkább megmarad árván, mint hogy tévesen töröljön egy még hivatkozott dokumentumot.
 */
const MEDIA_FIELDS: { collection: string; field: string }[] = [
  { collection: 'salons', field: 'logo' },
  { collection: 'salons', field: 'cover_image' },
  { collection: 'restaurants', field: 'logo' },
  { collection: 'restaurants', field: 'cover_image' },
  { collection: 'services', field: 'image' },
  { collection: 'service-categories', field: 'image' },
  { collection: 'gift-voucher-types', field: 'image' },
  { collection: 'gift-vouchers', field: 'image' },
  { collection: 'staff', field: 'avatar' },
  { collection: 'memberships', field: 'avatar' },
]

async function isMediaUsed(payload: Payload, mediaId: string | number): Promise<boolean> {
  for (const { collection, field } of MEDIA_FIELDS) {
    const res = await payload.find({
      collection: collection as Parameters<Payload['find']>[0]['collection'],
      where: { [field]: { equals: mediaId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (res.totalDocs > 0) return true
  }
  return false
}

/**
 * Kép-CSERE vagy -törlés után hívandó a RÉGI media-id-vel: ha már sehol nem használt,
 * véglegesen törli — a Payload upload-mező cseréje magától NEM törli az előző fájlt, az
 * addig csendben árván maradt volna (ezt takarította korábban a backstage "Adattisztítás"
 * gomb kézzel; ez most automatikus, közvetlenül a mentés pillanatában).
 * Best-effort: sosem dob tovább hibát, a hívó collection mentése ettől nem bukhat el.
 */
export async function deleteMediaIfOrphan(
  payload: Payload,
  mediaId: string | number | null | undefined,
  req?: PayloadRequest,
): Promise<void> {
  if (!mediaId) return
  try {
    if (await isMediaUsed(payload, mediaId)) return
    await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true, req })
  } catch {
    // pl. már törölt/nem létező id — nem hiba, csendben kihagyjuk
  }
}

/** Egy relationship/upload mező értékéből media-id-t old ki (szám, string vagy feloldott objektum lehet). */
export function extractMediaId(v: unknown): string | number | null {
  if (v == null) return null
  if (typeof v === 'object') return (v as { id?: string | number }).id ?? null
  return v as string | number
}
