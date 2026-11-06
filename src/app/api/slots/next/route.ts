import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAvailableSlots, getAvailableSlotsAnyStaff } from '@/lib/availability'

export const dynamic = 'force-dynamic'

const schema = z.object({
  salonId: z.coerce.string(),
  serviceId: z.coerce.string(),
  /** vesszővel elválasztott munkatárs-azonosítók */
  staffIds: z.string().max(400).optional(),
})
const DAYS = 14
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Foglalóoldal › „Kihez szeretnél menni?” (design 21.7): munkatársanként (és „Bárki”-re) a legközelebbi szabad időpont a
 * következő 14 napban — a sor jobb oldalán („ma 14:30”), hogy a vendég még választás előtt lássa, kinél van hely.
 * Ugyanaz a számítás, mint a foglalóé (`getAvailableSlots`); nincs: null.
 */
export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Érvénytelen paraméterek' }, { status: 400 })
  const { salonId, serviceId } = parsed.data
  const staffIds = (parsed.data.staffIds ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20)
  const today = new Date()
  const firstFree = async (staffId: string | null) => {
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
      const date = ymd(d)
      const slots = staffId ? await getAvailableSlots({ salonId, staffId, serviceId, date }) : await getAvailableSlotsAnyStaff({ salonId, serviceId, date })
      if (slots.length) return { date, time: slots[0].start }
    }
    return null
  }
  try {
    const [any, ...each] = await Promise.all([firstFree(null), ...staffIds.map((id) => firstFree(id))])
    return NextResponse.json({ any, staff: Object.fromEntries(staffIds.map((id, i) => [id, each[i]])) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[slots/next]', e)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
