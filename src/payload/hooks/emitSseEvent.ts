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
