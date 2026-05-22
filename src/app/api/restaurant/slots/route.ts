import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRestaurantSlots } from '@/lib/restaurantBooking'

const schema = z.object({
  restaurantId: z.coerce.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.coerce.number().int().min(1).max(50),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const parsed = schema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvénytelen paraméterek' }, { status: 400 })
  }
  try {
    const slots = await getRestaurantSlots(parsed.data)
    return NextResponse.json({ slots })
  } catch (err) {
    console.error('[Restaurant Slots API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
