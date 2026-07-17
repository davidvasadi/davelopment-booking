import type { Where } from 'payload'
import { getPayloadClient } from './payload'
import type { Shift } from '@/payload/payload-types'

/**
 * A bejelentkezett (staff/manager) user SAJÁT közelgő műszakjai az adott üzletben.
 * Roster-identitás feloldása üzlet-típusonként:
 *   - étterem: a user membershipje → a shift `member` mezője,
 *   - szalon:  a StaffMember email-egyezéssel → a shift `staff` mezője.
 * Csak a MAI naptól, `type: 'shift'` (a szabadság/beteg külön kezelendő), dátum szerint.
 */
export interface MyShift {
  date: string
  start: string | null
  end: string | null
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export async function getMyUpcomingShifts(
  active: { type: 'salon' | 'restaurant'; id: string | number },
  user: { id: string | number; email?: string | null },
): Promise<MyShift[]> {
  const payload = await getPayloadClient()

  // 1. A roster-személy azonosítása → melyik shift-mezőre szűrünk.
  let personWhere: Where | null = null
  if (active.type === 'restaurant') {
    const mem = await payload.find({
      collection: 'memberships',
      where: { and: [{ user: { equals: user.id } }, { restaurant: { equals: active.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const m = mem.docs[0]
    if (m) personWhere = { member: { equals: m.id } }
  } else {
    if (!user.email) return []
    const st = await payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: active.id } }, { email: { equals: user.email } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const s = st.docs[0]
    if (s) personWhere = { staff: { equals: s.id } }
  }
  if (!personWhere) return []

  // 2. A közelgő műszakok.
  const today = ymd(new Date())
  const res = await payload.find({
    collection: 'shifts',
    where: { and: [personWhere, { type: { equals: 'shift' } }, { date: { greater_than_equal: today } }] },
    sort: 'date',
    limit: 30,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs as Shift[]).map((sh) => ({ date: sh.date, start: sh.start_time ?? null, end: sh.end_time ?? null }))
}
