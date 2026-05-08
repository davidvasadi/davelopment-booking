import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAvailableSlots } from '@/lib/availability'

const schema = z.object({
  salonId: z.coerce.string(),
  serviceId: z.coerce.string(),
  staffId: z.coerce.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const parsed = schema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvénytelen paraméterek' }, { status: 400 })
  }

  const { salonId, staffId, serviceId, date } = parsed.data

  try {
    const slots = await getAvailableSlots({ salonId, staffId, serviceId, date })
    return NextResponse.json({ slots })
  } catch (err) {
    console.error('[Slots API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
