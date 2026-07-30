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
