import type { Booking, StaffMember } from '@/payload/payload-types'
import type { getPayloadClient } from '@/lib/payload'
import { fixMediaUrl } from '@/lib/utils'

/** Fallback-avatar EMAIL alapján (lásd `dashboard/schedule/page.tsx` azonos komment) — ha a
 *  tulaj sosem töltött fel külön staff-avatart, de a személy a SAJÁT profiljában igen, a
 *  Foglalások és az Áttekintés enélkül sosem tudta megjeleníteni a fotót. */
export async function withAvatarFallback(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  staff: StaffMember[],
): Promise<StaffMember[]> {
  const emails = staff.map((s) => s.email).filter((e): e is string => !!e)
  if (emails.length === 0) return staff
  const usersRes = await payload.find({
    collection: 'users',
    where: { email: { in: emails } },
    depth: 0, limit: 500, overrideAccess: true,
  })
  const avatarByEmail: Record<string, string> = {}
  for (const u of usersRes.docs as { email?: string | null; avatar_url?: string | null }[]) {
    const fixed = fixMediaUrl(u.avatar_url)
    if (u.email && fixed) avatarByEmail[u.email.toLowerCase()] = fixed
  }
  return staff.map((s) => {
    if (s.avatar || !s.email) return s
    const fallback = avatarByEmail[s.email.toLowerCase()]
    return fallback ? { ...s, avatar: { url: fallback } as unknown as StaffMember['avatar'] } : s
  })
}

/** A foglalási kártyák a `booking.staff`-ból veszik az avatart — ez viszont a nyers staff-rekord,
 *  a fenti email-alapú fallback nélkül. Ezért a kártyán nem jelent meg az a fotó, ami a fejlécben
 *  igen. A kifejtett `booking.staff` avatarját a (fallbackkel dúsított) staff-listából pótoljuk. */
export function withBookingStaffAvatars(bookings: Booking[], staff: StaffMember[]): Booking[] {
  const avatarById = new Map<string, StaffMember['avatar']>()
  for (const s of staff) if (s.avatar && typeof s.avatar === 'object') avatarById.set(String(s.id), s.avatar)
  return bookings.map((b) => {
    const st = b.staff
    if (!st || typeof st !== 'object' || (st.avatar && typeof st.avatar === 'object')) return b
    const avatar = avatarById.get(String(st.id))
    return avatar ? { ...b, staff: { ...st, avatar } } : b
  })
}
