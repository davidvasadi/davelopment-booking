import type { CollectionAfterDeleteHook } from 'payload'
import { deleteMediaIfOrphan, extractMediaId } from '@/lib/mediaCleanup'

/**
 * Egy hely (szalon/étterem) törlésekor a hozzá tartozó FELTÖLTÖTT KÉPEK (media) is töröljenek,
 * hogy ne maradjon árva fájl a media-collectionben és a lemezen. A `beforeDelete` már törli a
 * kapcsolt rekordokat (foglalások, szolgáltatások, staff…), de a media relationship-ek (logo,
 * cover_image, staff-avatar) nem kaszkádolnak automatikusan — ezt pótolja ez a hook.
 *
 * A "még használt-e máshol" ellenőrzés a közös `deleteMediaIfOrphan`-t hívja (lib/mediaCleanup.ts)
 * — ez explicit lekérdezéssel néz végig minden média-hivatkozó mezőn, NEM a DB FK-viselkedésére
 * támaszkodik (a Payload postgres-adapter relationship mezői alapból SET NULL-oznak törléskor,
 * nem RESTRICT-elnek, tehát egy sima "próbáld törölni, a DB majd elutasítja" trükk itt csendben
 * elárvított volna egy máshol még élő hivatkozást).
 */
export function cleanupPlaceMedia(): CollectionAfterDeleteHook {
  return async ({ req, doc }) => {
    if (!doc) return
    await Promise.all([
      deleteMediaIfOrphan(req.payload, extractMediaId(doc.logo), req),
      deleteMediaIfOrphan(req.payload, extractMediaId(doc.icon), req),
      deleteMediaIfOrphan(req.payload, extractMediaId(doc.cover_image), req),
    ])
  }
}
