import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRestaurantSlots, getOpeningWindow } from '@/lib/restaurantBooking'
import { getCurrentUser } from '@/lib/auth'

const schema = z.object({
  restaurantId: z.coerce.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.coerce.number().int().min(1).max(50),
  includePast: z.coerce.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const parsed = schema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Érvénytelen paraméterek' }, { status: 400 })
  }
  // A múltbeli időpontok csak a bejelentkezett tulaj saját felületén jöhetnek elő (utólagos
  // rögzítéshez) — a publikus (kijelentkezett) foglaló widget sose kaphatja meg ezt.
  const user = parsed.data.includePast ? await getCurrentUser() : null
  try {
    // A slots mellett a nyitvatartási ablakot is lekérjük: ha `window === null`, a nap
    // TELJESEN zárva van (pl. heti pihenőnap) — ezt a kliens külön, pontosabb üzenettel
    // jelzi, nem az általános "nincs szabad időpont"-tal (ami tele napra utalna).
    const [slots, window] = await Promise.all([
      getRestaurantSlots({ ...parsed.data, includePast: !!user }),
      getOpeningWindow(parsed.data.restaurantId, parsed.data.date),
    ])
    return NextResponse.json({ slots, closed: window === null })
  } catch (err) {
    console.error('[Restaurant Slots API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
