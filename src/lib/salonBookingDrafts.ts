'use client'

/**
 * Offline foglalás-vázlatok lokális tárolása (localStorage) — SZALON változat.
 *
 * Az étterem `offlineDrafts.ts`-ének szalon-párja: netkiesés alatt a szalon nem
 * éri el a szervert, ezért az új foglalás nem mehet azonnal a `manage-booking`
 * API-ba. Helyette egy „vázlat" készül, ami pontosan azt a payload-ot tárolja,
 * amit online a POST kapna — így a net visszatértekor a vázlat változatlanul
 * továbbküldhető (a szerver validál).
 *
 * A vázlatok szalononként (salonId) szűrve tárolódnak, és túlélik az
 * oldalfrissítést / a böngésző újraindítását (localStorage). A tároló-prefix
 * elkülönül az étteremétől, hogy a kettő ne keveredjen.
 */

const STORAGE_PREFIX = 'davelopment_salon_booking_drafts'

/** Egy vázlat payload-ja = a manage-booking POST body egy az egyben. */
export interface SalonDraftPayload {
  date: string
  start_time: string
  serviceId: string
  staffId: string
  customer_name: string
  customer_email: string
  customer_phone: string
  notes: string
  status: string
  /** Vizuális segédletek a nézetekhez (a szerver úgyis újraszámolja / feloldja). */
  end_time?: string
  serviceName?: string
  staffName?: string
}

export interface SalonBookingDraft extends SalonDraftPayload {
  draftId: string
  salonId: string
  createdAt: number
}

function keyFor(salonId: string): string {
  return `${STORAGE_PREFIX}:${salonId}`
}

function safeParse(raw: string | null): SalonBookingDraft[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as SalonBookingDraft[]) : []
  } catch {
    return []
  }
}

/** Összes vázlat az adott szalonhoz. */
export function getDrafts(salonId: string): SalonBookingDraft[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(keyFor(salonId)))
}

/** Az adott napra eső vázlatok (createdAt szerint növekvő). */
export function listDraftsForDate(salonId: string, date: string): SalonBookingDraft[] {
  return getDrafts(salonId)
    .filter((d) => d.date === date)
    .sort((a, b) => a.createdAt - b.createdAt)
}

function write(salonId: string, drafts: SalonBookingDraft[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(keyFor(salonId), JSON.stringify(drafts))
  // Saját fülön a 'storage' event nem sül el, ezért kézzel is jelzünk.
  window.dispatchEvent(new CustomEvent('davelopment-salon-drafts-changed', { detail: { salonId } }))
}

/** Új vázlat mentése. Visszaadja a létrejött vázlatot. */
export function addDraft(salonId: string, payload: SalonDraftPayload): SalonBookingDraft {
  const draft: SalonBookingDraft = {
    ...payload,
    draftId: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    salonId,
    createdAt: Date.now(),
  }
  const drafts = getDrafts(salonId)
  drafts.push(draft)
  write(salonId, drafts)
  return draft
}

/** Meglévő vázlat módosítása draftId alapján (offline szerkesztés a sheetből). */
export function updateDraft(
  salonId: string,
  draftId: string,
  patch: Partial<SalonDraftPayload>,
): void {
  write(
    salonId,
    getDrafts(salonId).map((d) => (d.draftId === draftId ? { ...d, ...patch } : d)),
  )
}

/** Vázlat törlése draftId alapján. */
export function removeDraft(salonId: string, draftId: string): void {
  write(salonId, getDrafts(salonId).filter((d) => d.draftId !== draftId))
}

/**
 * Vázlat-változások figyelése (saját fül CustomEvent + más fül 'storage').
 * Visszaad egy leiratkozó függvényt. A callback friss listát kap.
 */
export function subscribeDrafts(salonId: string, cb: (drafts: SalonBookingDraft[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => cb(getDrafts(salonId))
  const storageHandler = (e: StorageEvent) => {
    if (e.key === keyFor(salonId)) cb(getDrafts(salonId))
  }
  window.addEventListener('davelopment-salon-drafts-changed', handler as EventListener)
  window.addEventListener('storage', storageHandler)
  return () => {
    window.removeEventListener('davelopment-salon-drafts-changed', handler as EventListener)
    window.removeEventListener('storage', storageHandler)
  }
}
