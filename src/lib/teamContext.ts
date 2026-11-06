import { getPayloadClient } from './payload'
import { roleLabel } from './permissions'
import { fixMediaUrl } from './utils'
import type { Membership, User, Role, StaffMember } from '@/payload/payload-types'
import type { TeamMember } from '@/components/settings/SettingsHub'

/**
 * A CSAPAT & JOGOK panel VALÓS adata egy üzlethez: a tulajdonos (owner) mindig az első sor
 * „Tulajdonos"-ként, alatta a membershipök (aktív tagok + függő meghívók). DEFENZÍV: a
 * tulaj-sor az `owner` mezőből jön, nem a memberships-ből — így sosem tűnik el.
 */
export async function getTeamForBusiness(opts: {
  type: 'salon' | 'restaurant'
  businessId: string | number
  ownerName: string
  ownerEmail: string
  /** A tulajdonos SAJÁT profilképe (`Users.avatar_url`) — a hívó (Settings page.tsx) adja át,
   *  mert ott már úgyis betöltött, depth:1-es `owner`-objektum van. */
  ownerAvatarUrl?: string | null
  /** A tulajdonos User-id-je — a linkelt Staff-rekord (ha van) pozíciójának megkereséséhez. */
  ownerUserId?: string | number | null
}): Promise<TeamMember[]> {
  const payload = await getPayloadClient()

  // Ha a tulaj a Munkatársak oldalon "Ez a saját fiókom"-mal linkelte magát egy valódi
  // staff-rekordhoz (mert maga is dolgozik szakemberként), annak a rekordnak a pozíciója
  // (`role_title`) jelenik meg itt is — eddig a tulaj-sornak SOSEM volt pozíciója.
  let ownerPosition: string | null = null
  let ownerStaff: string | null = null
  if (opts.type === 'salon' && opts.ownerUserId != null) {
    const linkedStaff = await payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: opts.businessId } }, { user: { equals: opts.ownerUserId } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    ownerPosition = (linkedStaff.docs[0] as StaffMember | undefined)?.role_title ?? null
    ownerStaff = (linkedStaff.docs[0] as StaffMember | undefined)?.name ?? null
  }
  const ownerUser = opts.ownerUserId != null ? ((await payload.findByID({ collection: 'users', id: opts.ownerUserId, depth: 0, overrideAccess: true }).catch(() => null)) as User | null) : null

  const owner: TeamMember = {
    name: opts.ownerName,
    email: opts.ownerEmail,
    role: 'Tulajdonos',
    roleTone: 'owner',
    avatarUrl: fixMediaUrl(opts.ownerAvatarUrl),
    position: ownerPosition,
    lastLogin: ownerUser?.last_login_at ?? null,
    staffName: ownerStaff,
  }

  let members: TeamMember[] = []
  try {
    const res = await payload.find({
      collection: 'memberships',
      where: opts.type === 'salon' ? { salon: { equals: opts.businessId } } : { restaurant: { equals: opts.businessId } },
      limit: 200,
      depth: 1,
      overrideAccess: true,
      sort: 'createdAt',
    })
    // a tagok fiókjához kötött munkatárs-profilok (szalon: foglalható profil) — user-id → név
    const docs = res.docs as Membership[]
    const userIds = docs.map((m) => (typeof m.user === 'object' ? (m.user as User | null)?.id : m.user)).filter((x): x is string => x != null).map(String)
    const staffByUser = new Map<string, string>()
    if (opts.type === 'salon' && userIds.length) {
      const st = await payload.find({ collection: 'staff', where: { and: [{ salon: { equals: opts.businessId } }, { user: { in: userIds } }] }, limit: 500, depth: 0, overrideAccess: true })
      for (const s of st.docs as StaffMember[]) { const uid = typeof s.user === 'object' ? (s.user as User | null)?.id : s.user; if (uid != null) staffByUser.set(String(uid), s.name ?? '') }
    }
    members = docs.map((m) => {
      const u = typeof m.user === 'object' ? (m.user as User) : null
      const custom = m.custom_role && typeof m.custom_role === 'object' ? (m.custom_role as Role) : null
      const tone = m.role === 'manager' ? 'manager' : 'staff'
      return {
        id: String(m.id),
        name: m.name || u?.name || m.email,
        email: m.email,
        // Egyedi szerep esetén a szerep NEVE a megjelenített cím/pozíció (nincs külön kategória).
        role: custom ? custom.name : roleLabel(m.role),
        roleTone: tone,
        customRoleId: custom ? String(custom.id) : null,
        pending: m.status === 'invited',
        suspended: m.status === 'suspended',
        position: m.position ?? null,
        // A tag SAJÁT profilképe (`Users.avatar_url`, `depth:1` miatt már betöltve `m.user`-be) —
        // ez a fiók-szintű kép, nem üzletenkénti (a Staff.avatar-tól függetlenül).
        avatarUrl: fixMediaUrl(u?.avatar_url),
        lastLogin: u?.last_login_at ?? null,
        staffName: u ? staffByUser.get(String(u.id)) ?? null : null,
        invitedAt: m.status === 'invited' ? m.createdAt : null,
      }
    })
  } catch {
    members = []
  }

  return [owner, ...members]
}
