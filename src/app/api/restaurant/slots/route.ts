import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getRestaurantSlotGrid, getOpeningWindow } from '@/lib/restaurantBooking'
import { getCurrentUser } from '@/lib/auth'

const schema = z.object({
  restaurantId: z.coerce.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.coerce.number().int().min(1).max(50),
  includePast: z.coerce.boolean().optional(),
  excludeReservationId: z.string().optional(),
  tableIds: z.string().optional(),
  duration: z.coerce.number().int().min(15).max(600).optional(),
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
    const [grid, window] = await Promise.all([
      getRestaurantSlotGrid({ ...parsed.data, online: !user, includePast: !!user, excludeReservationId: user ? parsed.data.excludeReservationId : undefined, tableIds: user && parsed.data.tableIds ? parsed.data.tableIds.split(',') : undefined }),
      getOpeningWindow(parsed.data.restaurantId, parsed.data.date),
    ])
    // a tulaj (bejelentkezve) a nap összes jelölt kezdését is megkapja — a szerkesztő rácsán a nem szabad foglalt
    return NextResponse.json(user ? { ...grid, closed: window === null } : { slots: grid.slots, closed: window === null })
  } catch (err) {
    console.error('[Restaurant Slots API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
