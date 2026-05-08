import { parseISO } from 'date-fns'
import type { Where } from 'payload'
import { hhmmToMinutes, minutesToHHMM, getDayName } from './utils'
import { getPayloadClient } from './payload'

interface SlotParams {
  salonId: string
  staffId?: string
  serviceId: string
  date: string // YYYY-MM-DD
}

export interface TimeSlot {
  start: string
  end: string
}

export async function getAvailableSlots(params: SlotParams): Promise<TimeSlot[]> {
  const { salonId, staffId, serviceId, date } = params
  const payload = await getPayloadClient()

  // 1. Fetch service to get duration
  const service = await payload.findByID({ collection: 'services', id: serviceId })
  const durationMinutes = service.duration_minutes

  // 2. Fetch salon to get buffer
  const salon = await payload.findByID({ collection: 'salons', id: salonId })
  const bufferMinutes = salon.booking_buffer_minutes ?? 15

  // 3. Determine the day name
  const dateObj = parseISO(date)
  const dayName = getDayName(dateObj)

  // 4. Fetch availability records — priority: exception > staff recurring > salon recurring
  const [exceptions, staffAllRecurring, salonAvail] = await Promise.all([
    payload.find({
      collection: 'availability',
      where: {
        and: [
          { salon: { equals: salonId } },
          { recurring: { equals: false } },
          { exception_date: { equals: date } },
        ],
      },
    }),
    // Fetch ALL recurring records for this staff (any day) so we know if they have a custom schedule
    staffId ? payload.find({
      collection: 'availability',
      where: {
        and: [
          { salon: { equals: salonId } },
          { staff: { equals: staffId } },
          { recurring: { equals: true } },
        ],
      },
      limit: 10,
    }) : Promise.resolve({ docs: [] }),
    payload.find({
      collection: 'availability',
      where: {
        and: [
          { salon: { equals: salonId } },
          { staff: { exists: false } },
          { day_of_week: { equals: dayName } },
          { recurring: { equals: true } },
        ],
      },
    }),
  ])

  // Apply priority: exception first (for this staff or salon-wide)
  const staffException = staffId ? exceptions.docs.find((e) => {
    if (!e.staff) return false
    const refId = typeof e.staff === 'object' ? (e.staff as { id: number | string }).id : e.staff
    return String(refId) === String(staffId)
  }) : undefined
  const salonException = exceptions.docs.find((e) => !e.staff)
  const activeException = staffException ?? salonException

  // Staff-specific recurring record for this exact day
  const staffDayRecord = staffAllRecurring.docs.find(r => r.day_of_week === dayName)
  // If staff has any recurring records configured, missing days = closed (don't fall back to salon)
  const staffHasCustomSchedule = staffAllRecurring.docs.length > 0

  let workStart: string
  let workEnd: string

  if (activeException) {
    if (!activeException.is_available) return []
    workStart = activeException.start_time
    workEnd = activeException.end_time
  } else if (staffDayRecord) {
    if (!staffDayRecord.is_available) return []
    workStart = staffDayRecord.start_time
    workEnd = staffDayRecord.end_time
  } else if (staffHasCustomSchedule) {
    // Staff has a schedule but this day isn't in it → closed for this day
    return []
  } else if (salonAvail.docs.length > 0) {
    // Staff has no schedule at all → inherit salon-level hours
    const rule = salonAvail.docs[0]
    if (!rule.is_available) return []
    workStart = rule.start_time
    workEnd = rule.end_time
  } else {
    // No rule anywhere → closed
    return []
  }

  const openMin = hhmmToMinutes(workStart)
  const closeMin = hhmmToMinutes(workEnd)

  // 5. Generate candidate slots stepping by service duration
  const candidates: number[] = []
  let cursor = openMin
  while (cursor + durationMinutes <= closeMin) {
    candidates.push(cursor)
    cursor += durationMinutes
  }

  // 6. Fetch existing bookings for this staff on this date
  const bookingWhere: Where = staffId
    ? { and: [{ staff: { equals: staffId } }, { date: { equals: date } }, { status: { not_equals: 'cancelled' } }] }
    : { and: [{ salon: { equals: salonId } }, { date: { equals: date } }, { status: { not_equals: 'cancelled' } }] }
  const existing = await payload.find({ collection: 'bookings', where: bookingWhere })

  // 7. Filter out conflicting slots + past slots for today
  const occupied = existing.docs.map((b) => ({
    start: hhmmToMinutes(b.start_time),
    end: hhmmToMinutes(b.end_time) + bufferMinutes,
  }))

  const todayStr = new Date().toISOString().split('T')[0]
  const nowMinutes = date === todayStr
    ? new Date().getHours() * 60 + new Date().getMinutes()
    : 0

  const free = candidates.filter((slotStart) => {
    if (slotStart <= nowMinutes && date === todayStr) return false
    const slotEnd = slotStart + durationMinutes
    return !occupied.some((o) => slotStart < o.end && slotEnd > o.start)
  })

  return free.map((start) => ({
    start: minutesToHHMM(start),
    end: minutesToHHMM(start + durationMinutes),
  }))
}
