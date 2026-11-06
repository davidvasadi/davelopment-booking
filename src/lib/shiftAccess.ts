import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'
import type { Shift } from '@/payload/payload-types'

/** Egy műszak betöltése jogosultság-ellenőrzéssel — a `/api/shifts/[id]` és a táppénzes papír végpontja közös. */
const relId = (v: string | { id: string | number } | null | undefined) =>
  v == null ? null : typeof v === 'object' ? v.id : v

export async function loadManageableShift(id: string, userId: string | number) {
  const payload = await getPayloadClient()
  let shift: Shift | undefined
  try {
    shift = (await payload.findByID({ collection: 'shifts', id, depth: 0, overrideAccess: true })) as Shift
  } catch {
    return { error: 'A műszak nem található', status: 404 as const }
  }
  // Az üzlet-típus + id a műszak rekordjából (salon VAGY restaurant).
  const restaurantId = relId(shift.restaurant)
  const salonId = relId(shift.salon)
  const bizType: 'salon' | 'restaurant' | null = restaurantId ? 'restaurant' : salonId ? 'salon' : null
  const bizId = restaurantId ?? salonId
  if (!bizType || !bizId) return { error: 'Érvénytelen műszak', status: 400 as const }
  const denied = await assertCapability(userId, bizType, bizId, 'schedule.manage')
  if (!denied) return { payload, shift, bizType, bizId, isSelfOnly: false }
  // Nincs schedule.manage — de a SAJÁT (linkelt) staff-rekordja a napi szünetét attól függetlenül
  // szerkesztheti (önkiszolgáló, ld. `default_break_*`); minden más mezőnél marad a tiltás.
  if (bizType === 'salon' && shift.staff) {
    const staffId = relId(shift.staff)
    const staffDoc = staffId ? await payload.findByID({ collection: 'staff', id: staffId, depth: 0, overrideAccess: true }).catch(() => null) : null
    const isSelf = staffDoc?.user != null && String(typeof staffDoc.user === 'object' ? staffDoc.user.id : staffDoc.user) === String(userId)
    if (isSelf) return { payload, shift, bizType, bizId, isSelfOnly: true }
  }
  return { error: denied.error, status: denied.status }
}

