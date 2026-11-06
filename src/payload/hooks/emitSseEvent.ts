import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { isSilentImport } from '../../lib/silentImport'
import { emitBookingChange } from '../../lib/sseEmitter'

function relId(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'object' && val !== null && 'id' in val) return String((val as { id: unknown }).id)
  return String(val)
}

export function sseAfterChange(kind: 'salon' | 'restaurant'): CollectionAfterChangeHook {
  return ({ req, doc, operation }) => {
    // Tömeges importnál soronkénti élő frissítés nincs (a lista a végén úgyis újratöltődik)
    if (isSilentImport(req)) return doc
    const businessId = relId(doc[kind])
    if (businessId) {
      emitBookingChange({ kind, businessId, op: operation === 'create' ? 'create' : 'update' })
    }
    return doc
  }
}

export function sseAfterDelete(kind: 'salon' | 'restaurant'): CollectionAfterDeleteHook {
  return ({ doc }) => {
    const businessId = relId(doc[kind])
    if (businessId) {
      emitBookingChange({ kind, businessId, op: 'delete' })
    }
    return doc
  }
}

/** Olyan rekordnál, ami szalonhoz VAGY étteremhez tartozik (pl. beosztás: salon+staff vagy restaurant+member) — amelyik
 *  ki van töltve, annak az üzletnek a nyitott oldalai frissülnek élőben (pl. a munkatárs a saját oldalán szabadságot
 *  rögzít → a tulaj Naptára és az Új beosztás előnézete azonnal mutatja). */
export function sseAfterChangeAny(): CollectionAfterChangeHook {
  return ({ req, doc, operation }) => {
    if (isSilentImport(req)) return doc
    const kind = doc.restaurant ? 'restaurant' : 'salon'
    const businessId = relId(doc[kind])
    if (businessId) emitBookingChange({ kind, businessId, op: operation === 'create' ? 'create' : 'update' })
    return doc
  }
}

export function sseAfterDeleteAny(): CollectionAfterDeleteHook {
  return ({ doc }) => {
    const kind = doc.restaurant ? 'restaurant' : 'salon'
    const businessId = relId(doc[kind])
    if (businessId) emitBookingChange({ kind, businessId, op: 'delete' })
    return doc
  }
}
