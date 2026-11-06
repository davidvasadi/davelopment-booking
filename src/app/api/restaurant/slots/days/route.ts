import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRestaurantSlots } from '@/lib/restaurantBooking'
import { openDays } from '@/lib/openDays'

export const dynamic = 'force-dynamic'

const schema = z.object({
  restaurantId: z.coerce.string(),
  pax: z.coerce.number().int().min(1).max(50),
  n: z.coerce.number().int().min(1).max(60).default(14),
})

/** Foglalóoldal › nap-sáv (étterem): a következő `n` napból azok, ahol a létszámnak van online foglalható asztal. */
export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen paraméterek' }, { status: 400 })
  const { restaurantId, pax, n } = parsed.data
  try {
    const open = await openDays(n, async (date) => (await getRestaurantSlots({ restaurantId, date, pax, online: true })).length > 0)
    return NextResponse.json({ open }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[restaurant/slots/days]', e)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
