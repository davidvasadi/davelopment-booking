import type { PayloadRequest } from 'payload'

/**
 * Több-üzlet (multi-tenant) hozzáférés-ellenőrzés a szalon-kapcsolt collection-ökhöz
 * (services, staff, availability, bookings). Egy user TÖBB szalont birtokolhat, ezért
 * NEM a régi `user.salon` fix mezőt nézzük (az csak az „első" szalon volt → másik szalon
 * rekordjának mentésekor 403), hanem azt, hogy a rekordhoz tartozó szalon TULAJDONOSA
 * (`salon.owner`) a bejelentkezett user-e.
 *
 * @param req     a Payload request (a user-rel)
 * @param salonId a rekord szalonja (data.salon create/update-nél, vagy a doc salonja)
 */
export async function userOwnsSalon(
  req: PayloadRequest,
  salonId: number | string | { id: number | string } | null | undefined,
): Promise<boolean> {
  if (!req.user) return false
  if (req.user.role === 'admin') return true

  const sid = salonId && typeof salonId === 'object' ? salonId.id : salonId
  if (sid == null) return false

  try {
    const salon = await req.payload.findByID({
      collection: 'salons',
      id: sid,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const ownerId = salon?.owner && typeof salon.owner === 'object'
      ? (salon.owner as { id: number | string }).id
      : salon?.owner
    return String(ownerId) === String(req.user.id)
  } catch {
    return false
  }
}
