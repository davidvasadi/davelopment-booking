import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAvailableSlots, getAvailableSlotsAnyStaff } from '@/lib/availability'
import { openDays } from '@/lib/openDays'

export const dynamic = 'force-dynamic'

const schema = z.object({
  salonId: z.coerce.string(),
  serviceId: z.coerce.string(),
  staffId: z.coerce.string().optional(),
  n: z.coerce.number().int().min(1).max(60).default(14),
})

/** Foglalóoldal › nap-sáv (szalon): a következő `n` napból a foglalhatók (a választott szolgáltatásra és munkatársra / Bárkire). */
export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen paraméterek' }, { status: 400 })
  const { salonId, serviceId, staffId, n } = parsed.data
  try {
    const open = await openDays(n, async (date) => (staffId
      ? await getAvailableSlots({ salonId, staffId, serviceId, date })
      : await getAvailableSlotsAnyStaff({ salonId, serviceId, date })).length > 0)
    return NextResponse.json({ open }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[slots/days]', e)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
