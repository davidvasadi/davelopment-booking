'use client'

/**
 * Offline foglalás-vázlatok lokális tárolása (localStorage).
 *
 * Netkiesés alatt az étterem nem éri el a szervert, ezért az új foglalás nem
 * mehet azonnal a `manage-reservation` API-ba. Helyette egy "vázlat" készül,
 * ami pontosan azt a payload-ot tárolja, amit online a POST kapna — így a net
 * visszatértekor a vázlat változatlanul továbbküldhető (a szerver validál).
 *
 * A vázlatok éttermenként (restaurantId) szűrve tárolódnak, és túlélik az
 * oldalfrissítést / a böngésző újraindítását, mert localStorage-ban vannak.
 */

const STORAGE_PREFIX = 'schedulio_offline_drafts'

/** Egy vázlat payload-ja = a manage-reservation POST body egy az egyben. */
export interface DraftPayload {
  date: string
  start_time: string
  pax: number
  tableIds: (string | number)[] | null
  customer_name: string
  customer_phone: string
  customer_email: string
  notes: string
  status: string
  /** Vizuális segédlet a nézetekhez (a szerver úgyis újraszámolja). */
  end_time?: string
  /** A választott asztalok nevei a megjelenítéshez (offline nincs lookup). */
  tableNames?: string[]
}

export interface ReservationDraft extends DraftPayload {
  draftId: string
  restaurantId: string
  createdAt: number
}

function keyFor(restaurantId: string): string {
  return `${STORAGE_PREFIX}:${restaurantId}`
}

function safeParse(raw: string | null): ReservationDraft[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as ReservationDraft[]) : []
  } catch {
    return []
  }
}

/** Összes vázlat az adott étteremhez. */
export function getDrafts(restaurantId: string): ReservationDraft[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(keyFor(restaurantId)))
}

/** Az adott napra eső vázlatok (createdAt szerint növekvő). */
export function listDraftsForDate(restaurantId: string, date: string): ReservationDraft[] {
  return getDrafts(restaurantId)
    .filter((d) => d.date === date)
    .sort((a, b) => a.createdAt - b.createdAt)
}

function write(restaurantId: string, drafts: ReservationDraft[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(keyFor(restaurantId), JSON.stringify(drafts))
  // Saját fülön a 'storage' event nem sül el, ezért kézzel is jelzünk.
  window.dispatchEvent(new CustomEvent('schedulio-drafts-changed', { detail: { restaurantId } }))
}

/** Új vázlat mentése. Visszaadja a létrejött vázlatot. */
export function addDraft(restaurantId: string, payload: DraftPayload): ReservationDraft {
  const draft: ReservationDraft = {
    ...payload,
    draftId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    restaurantId,
    createdAt: Date.now(),
  }
  const drafts = getDrafts(restaurantId)
  drafts.push(draft)
  write(restaurantId, drafts)
  return draft
}

/** Meglévő vázlat módosítása draftId alapján (offline szerkesztés a sliderből). */
export function updateDraft(
  restaurantId: string,
  draftId: string,
  patch: Partial<DraftPayload>,
): void {
  write(
    restaurantId,
    getDrafts(restaurantId).map((d) => (d.draftId === draftId ? { ...d, ...patch } : d)),
  )
}

/** Vázlat törlése draftId alapján. */
export function removeDraft(restaurantId: string, draftId: string): void {
  write(restaurantId, getDrafts(restaurantId).filter((d) => d.draftId !== draftId))
}

/**
 * Vázlat-változások figyelése (saját fül CustomEvent + más fül 'storage').
 * Visszaad egy leiratkozó függvényt. A callback friss listát kap.
 */
export function subscribeDrafts(restaurantId: string, cb: (drafts: ReservationDraft[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => cb(getDrafts(restaurantId))
  const storageHandler = (e: StorageEvent) => {
    if (e.key === keyFor(restaurantId)) cb(getDrafts(restaurantId))
  }
  window.addEventListener('schedulio-drafts-changed', handler as EventListener)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener('schedulio-drafts-changed', handler as EventListener)
    window.removeEventListener('storage', storageHandler)
  }
}
