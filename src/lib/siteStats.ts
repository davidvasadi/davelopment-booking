import { getPayloadClient } from '@/lib/payload'

/**
 * Beállítások › Telephelyek (design 16.16): telephelyenként a csapat létszáma és az e havi foglalások száma.
 * Szalon: aktív munkatárs-profilok és foglalások; étterem: aktív tagok és asztalfoglalások (lemondott / nem jött nélkül).
 */
export async function getSiteStats(businesses: { id: string; type: 'salon' | 'restaurant' }[]): Promise<Record<string, { team: number; monthBookings: number }>> {
  const payload = await getPayloadClient()
  const now = new Date()
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const from = ymd(new Date(now.getFullYear(), now.getMonth(), 1))
  const to = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const out: Record<string, { team: number; monthBookings: number }> = {}
  await Promise.all(businesses.map(async (b) => {
    const salon = b.type === 'salon'
    const scope = { [b.type]: { equals: b.id } }
    const [team, bookings] = await Promise.all([
      salon
        ? payload.find({ collection: 'staff', where: { and: [scope, { is_active: { not_equals: false } }] }, limit: 0, depth: 0, overrideAccess: true })
        : payload.find({ collection: 'memberships', where: { and: [scope, { status: { equals: 'active' } }] }, limit: 0, depth: 0, overrideAccess: true }),
      payload.find({ collection: salon ? 'bookings' : 'reservations', where: { and: [scope, { date: { greater_than_equal: from } }, { date: { less_than_equal: to } }, { status: { not_in: ['cancelled', 'no_show'] } }] }, limit: 0, depth: 0, overrideAccess: true }),
    ]).catch(() => [{ totalDocs: 0 }, { totalDocs: 0 }] as const)
    out[`${b.type}:${b.id}`] = { team: team.totalDocs, monthBookings: bookings.totalDocs }
  }))
  return out
}
