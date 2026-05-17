import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getPayloadClient } from '@/lib/payload'
import { getAvailableSlots } from '@/lib/availability'
import { sendBookingConfirmation, sendNewBookingNotification } from '@/lib/email'
import type { Salon, Service, StaffMember, Booking } from '@/payload/payload-types'

const schema = z.object({
  salonId: z.coerce.string(),
  serviceId: z.coerce.string(),
  staffId: z.coerce.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  customer_name: z.string().min(2),
  customer_email: z.string().email(),
  customer_phone: z.string().min(7),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Érvénytelen JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>
    const firstField = Object.keys(fieldErrors)[0]
    const firstMsg = firstField ? `${firstField}: ${fieldErrors[firstField]?.[0]}` : 'Érvénytelen adatok'
    console.error('[Bookings API] Validation error:', fieldErrors)
    return NextResponse.json({ error: firstMsg }, { status: 400 })
  }

  const { salonId, serviceId, staffId, date, start_time, end_time, customer_name, customer_email, customer_phone, notes } = parsed.data

  // Reject bookings in the past
  const today = new Date().toISOString().split('T')[0]
  if (date < today) {
    return NextResponse.json({ error: 'Múltbeli időpontra nem lehet foglalni' }, { status: 400 })
  }
  if (date === today) {
    const [h, m] = start_time.split(':').map(Number)
    const slotMinutes = h * 60 + m
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
    if (slotMinutes <= nowMinutes) {
      return NextResponse.json({ error: 'Ez az időpont már elmúlt' }, { status: 400 })
    }
  }

  try {
    const payload = await getPayloadClient()

    // Double-check slot is still available (race condition guard)
    const availableSlots = await getAvailableSlots({ salonId, staffId, serviceId, date })
    if (!availableSlots.some(s => s.start === start_time)) {
      return NextResponse.json({ error: 'Ez az időpont már foglalt' }, { status: 409 })
    }

    const [salon, service, staff] = await Promise.all([
      payload.findByID({ collection: 'salons', id: salonId }) as Promise<Salon>,
      payload.findByID({ collection: 'services', id: serviceId }) as Promise<Service>,
      payload.findByID({ collection: 'staff', id: staffId }) as Promise<StaffMember>,
    ])

    const booking = (await payload.create({
      collection: 'bookings',
      data: {
        salon: Number(salonId),
        service: Number(serviceId),
        staff: Number(staffId),
        customer_name,
        customer_email,
        customer_phone,
        date,
        start_time,
        end_time,
        status: 'confirmed',
        notes: notes ?? undefined,
        cancellation_token: randomBytes(32).toString('hex'),
      },
    })) as unknown as Booking

    const emailData = { booking, salon, service, staff }
    void sendBookingConfirmation(emailData)
    void sendNewBookingNotification(emailData)

    return NextResponse.json({ booking }, { status: 201 })
  } catch (err) {
    console.error('[Bookings API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
