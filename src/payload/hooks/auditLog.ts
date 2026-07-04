import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

/**
 * AUDIT-NAPLÓ hook-gyár. Közös afterChange + afterDelete, amit a lényeges collectionökre
 * kötünk (Reservations, Bookings, Services, Staff, Tables, Rooms, OpeningHours,
 * OpeningHoursExceptions, Memberships, Reviews, Waitlist + Salons/Restaurants beállítás).
 *
 * Robusztus: try/catch mindenre, a naplózás hibája SOSE blokkolja a fő műveletet.
 * A `payload_*` belső collectionöket és magát az audit-log-ot NEM naplózzuk.
 *
 * A `scope` mondja meg, honnan jön az üzlet:
 *  - 'salon' / 'restaurant': a doc `salon`/`restaurant` relációmezőjéből
 *  - 'self-salon' / 'self-restaurant': a doc MAGA az üzlet (Salons/Restaurants) → doc.id
 */
type Scope = 'salon' | 'restaurant' | 'auto' | 'self-salon' | 'self-restaurant'

const refId = (ref: unknown): string | number | null => {
  if (ref == null) return null
  if (typeof ref === 'object') {
    const id = (ref as { id?: string | number }).id
    return id ?? null
  }
  return ref as string | number
}

function actorLabelOf(req: PayloadRequest): { actor: string | number | null; actor_label: string } {
  const u = req.user as { id?: string | number; name?: string | null; email?: string | null } | undefined
  if (!u) return { actor: null, actor_label: 'Rendszer' }
  return { actor: u.id ?? null, actor_label: u.name || u.email || 'Ismeretlen' }
}

/** A collection-label + doc rövid azonosítója egy olvasható összegzéshez. */
function summarize(entity: string, action: 'create' | 'update' | 'delete', doc: Record<string, unknown>): string {
  const who =
    (typeof doc.customer_name === 'string' && doc.customer_name) ||
    (typeof doc.name === 'string' && doc.name) ||
    (typeof doc.email === 'string' && doc.email) ||
    (typeof doc.title === 'string' && doc.title) ||
    null
  const when = [doc.date, doc.start_time, doc.time].filter((x) => typeof x === 'string' && x).join(' ')
  const verb = action === 'create' ? 'létrehozva' : action === 'update' ? 'módosítva' : 'törölve'
  const tail = [who, when].filter(Boolean).join(' · ')
  return tail ? `${entity} ${verb} — ${tail}` : `${entity} ${verb}`
}

async function writeAudit(opts: {
  req: PayloadRequest
  scope: Scope
  entity: string
  action: 'create' | 'update' | 'delete'
  doc: Record<string, unknown>
}) {
  const { req, scope, entity, action, doc } = opts
  try {
    let salon: string | number | null = null
    let restaurant: string | number | null = null

    if (scope === 'salon') salon = refId(doc.salon)
    else if (scope === 'restaurant') restaurant = refId(doc.restaurant)
    else if (scope === 'auto') { salon = refId(doc.salon); restaurant = refId(doc.restaurant) }
    else if (scope === 'self-salon') salon = refId(doc.id)
    else if (scope === 'self-restaurant') restaurant = refId(doc.id)

    // Ha se szalon, se étterem nem derül ki, akkor is naplózunk (üzlet nélkül),
    // de a legtöbb collectionnél megvan az egyik.
    const { actor, actor_label } = actorLabelOf(req)

    await req.payload.create({
      collection: 'audit-log',
      overrideAccess: true,
      req,
      data: {
        actor: actor ?? undefined,
        actor_label,
        action,
        collection_name: entity,
        doc_id: String(refId(doc.id) ?? ''),
        summary: summarize(entity, action, doc),
        salon: salon ?? undefined,
        restaurant: restaurant ?? undefined,
      },
    })
  } catch (err) {
    // Best-effort: a naplózás hibája NEM buktathatja el a fő műveletet.
    try {
      req.payload.logger.error(`auditLog (${entity}) hiba: ${String(err)}`)
    } catch {
      /* noop */
    }
  }
}

/** afterChange napló (create/update). */
export function auditAfterChange(entity: string, scope: Scope): CollectionAfterChangeHook {
  return async ({ req, doc, operation }) => {
    if (operation === 'create' || operation === 'update') {
      await writeAudit({ req, scope, entity, action: operation, doc: doc as Record<string, unknown> })
    }
    return doc
  }
}

/** afterDelete napló. */
export function auditAfterDelete(entity: string, scope: Scope): CollectionAfterDeleteHook {
  return async ({ req, doc }) => {
    await writeAudit({ req, scope, entity, action: 'delete', doc: doc as Record<string, unknown> })
    return doc
  }
}
