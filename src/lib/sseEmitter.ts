import { EventEmitter } from 'events'

// global pattern: Next.js dev hot-reload esetén is egyetlen példány él a process-ben
const g = globalThis as typeof globalThis & { __sseEmitter?: EventEmitter }
if (!g.__sseEmitter) {
  g.__sseEmitter = new EventEmitter()
  g.__sseEmitter.setMaxListeners(500)
}
export const sseEmitter = g.__sseEmitter

export interface SseBookingEvent {
  kind: 'salon' | 'restaurant'
  businessId: string
  op: 'create' | 'update' | 'delete'
}

export function emitBookingChange(event: SseBookingEvent): void {
  sseEmitter.emit('booking-change', event)
}

export interface SseNotificationEvent {
  audience: 'owner' | 'member' | 'admin'
  userId?: string | number | null
  salonId?: string | number | null
  restaurantId?: string | number | null
}

/** Bármelyik `notifications` rekord létrejöttekor — a harang azonnal frissül, nem kell rá várni a pollingra. */
export function emitNotificationCreated(event: SseNotificationEvent): void {
  sseEmitter.emit('notification-change', event)
}
