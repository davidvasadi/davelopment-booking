import type { CollectionAfterChangeHook } from 'payload'
import { deleteMediaIfOrphan, extractMediaId } from '@/lib/mediaCleanup'

/**
 * Kép-mező(k) CSERÉJE/törlése után a RÉGI media-fájlt törli, ha már sehol nem használt.
 * Lásd src/lib/mediaCleanup.ts — a Payload upload-mező cseréje önmagában NEM törli az előző
 * fájlt, ezért enélkül a médiatár lassan tele szaladna elavult, senki által nem látott képekkel.
 */
export function cleanupMediaOnChange(fields: string[]): CollectionAfterChangeHook {
  return async ({ doc, previousDoc, req }) => {
    for (const field of fields) {
      const oldId = extractMediaId(previousDoc?.[field])
      const newId = extractMediaId(doc?.[field])
      if (oldId && oldId !== newId) {
        await deleteMediaIfOrphan(req.payload, oldId, req)
      }
    }
    return doc
  }
}
