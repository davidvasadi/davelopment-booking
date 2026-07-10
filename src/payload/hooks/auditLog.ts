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

function actorLabelOf(req: PayloadRequest): {
  actor: string | number | null
  actor_label: string
  actor_email: string | null
} {
  const u = req.user as { id?: string | number; name?: string | null; email?: string | null } | undefined
  // Bejelentkezett user: a NEVET adjuk feliratnak és az EMAIL-t külön (snapshot — túléli a törlést).
  if (u) return { actor: u.id ?? null, actor_label: u.name || u.email || 'Ismeretlen', actor_email: u.email || null }
  // Nincs bejelentkezett user (publikus route vagy cron). A route a `context.auditActor`-ral
  // adhat értelmes címkét (pl. 'Online foglalás', 'Vendég'); alapból 'Rendszer' (automatizmus).
  const ctxLabel = (req.context as { auditActor?: unknown } | undefined)?.auditActor
  if (typeof ctxLabel === 'string' && ctxLabel) return { actor: null, actor_label: ctxLabel, actor_email: null }
  return { actor: null, actor_label: 'Rendszer', actor_email: null }
}

/** Zajos / belső mezők, amiket a diffből kihagyunk. */
const DIFF_SKIP = new Set([
  'id', 'createdAt', 'updatedAt', 'updated_at', 'created_at',
  'invite_token', 'sizes', 'position_history', 'documents',
])

/** Egy mező összehasonlítható skalár-értéke: primitív marad, reláció → id, más → kihagyva (null). */
function scalarOf(v: unknown): string | number | boolean | null | undefined {
  if (v == null) return null
  const t = typeof v
  if (t === 'string' || t === 'number' || t === 'boolean') return v as string | number | boolean
  if (t === 'object') {
    const id = (v as { id?: string | number }).id
    return id != null ? id : undefined // relációt id-vel hasonlítunk; egyéb objektum/tömb → skip
  }
  return undefined
}

const clip = (v: string | number | boolean | null): string | number | boolean | null =>
  typeof v === 'string' && v.length > 120 ? `${v.slice(0, 117)}…` : v

export type AuditChange = { field: string; from: string | number | boolean | null; to: string | number | boolean | null }

/** before→after diff a változott, skalárrá redukálható mezőkről (max 12, klippelt értékek). */
function computeDiff(prev: Record<string, unknown> | undefined, next: Record<string, unknown>): AuditChange[] {
  if (!prev) return []
  const out: AuditChange[] = []
  for (const key of Object.keys(next)) {
    if (DIFF_SKIP.has(key)) continue
    const a = scalarOf(prev[key])
    const b = scalarOf(next[key])
    if (a === undefined || b === undefined) continue // nem összehasonlítható (objektum/tömb)
    // Üres string és null ugyanaz → ne generáljon „üres → üres" zaj-diffet.
    if ((a ?? '') === (b ?? '')) continue
    if (a !== b) {
      out.push({ field: key, from: clip(a), to: clip(b) })
      if (out.length >= 12) break
    }
  }
  return out
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
  previousDoc?: Record<string, unknown>
}) {
  const { req, scope, entity, action, doc, previousDoc } = opts
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
    const { actor, actor_label, actor_email } = actorLabelOf(req)
    const changes = action === 'update' ? computeDiff(previousDoc, doc) : []

    await req.payload.create({
      collection: 'audit-log',
      overrideAccess: true,
      req,
      data: {
        actor: actor ?? undefined,
        actor_label,
        actor_email: actor_email ?? undefined,
        action,
        collection_name: entity,
        doc_id: String(refId(doc.id) ?? ''),
        summary: summarize(entity, action, doc),
        changes: changes.length ? changes : undefined,
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
  return async ({ req, doc, previousDoc, operation }) => {
    if (operation === 'create' || operation === 'update') {
      await writeAudit({
        req,
        scope,
        entity,
        action: operation,
        doc: doc as Record<string, unknown>,
        previousDoc: previousDoc as Record<string, unknown> | undefined,
      })
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
