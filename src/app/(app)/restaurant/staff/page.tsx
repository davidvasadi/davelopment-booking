import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import RestaurantTeamManager, { type TeamCard } from '@/components/restaurant/RestaurantTeamManager'
import { getTeamRoster } from '@/lib/teamRoster'
import type { Membership, User, Role } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

function mediaUrl(m: unknown): string | null {
  return m && typeof m === 'object' && 'url' in m && typeof (m as { url?: unknown }).url === 'string' ? (m as { url: string }).url : null
}

/**
 * ÉTTEREM MUNKATÁRSAK — a csapat (memberships) táblázatos nézete.
 * A tulaj mindig az első sor („Tulajdonos"), az `owner` mezőből.
 * Meghívás/szerep/eltávolítás a MEGLÉVŐ /api/team flow-n. SMS sehol.
 */
export default async function RestaurantStaffPage() {
  const { restaurant, userId, capabilities } = await getOwnedRestaurant()
  requireCapability(capabilities, 'staff.view', '/restaurant')
  const payload = await getPayloadClient()

  const ownerRelId = restaurant.owner && typeof restaurant.owner === 'object'
    ? (restaurant.owner as User).id
    : restaurant.owner as string | number
  const isOwner = String(ownerRelId) === String(userId)

  const [membersRes, ownerUserRaw] = await Promise.all([
    payload.find({
      collection: 'memberships',
      where: { restaurant: { equals: restaurant.id } },
      sort: 'createdAt',
      depth: 1,
      limit: 500,
      overrideAccess: true,
    }),
    ownerRelId ? payload.findByID({ collection: 'users', id: ownerRelId, depth: 0, overrideAccess: true }).catch(() => null) : null,
  ])

  const owner = ownerUserRaw as (User & { createdAt?: string }) | null
  const ownerCard: TeamCard = {
    id: null,
    name: owner?.name || owner?.email || 'Tulajdonos',
    email: owner?.email ?? '',
    avatarUrl: owner?.avatar_url ?? null,
    roleTone: 'owner',
    pending: false,
    status: 'active',
    joinDate: (owner?.join_date ?? owner?.createdAt ?? '').slice(0, 10) || null,
  }

  const memberDocs = (membersRes.docs as Membership[]).filter((m) => m.role !== 'owner')
  const memberEmails = memberDocs.map((m) => m.email).filter((e): e is string => !!e)
  const userAvatarByEmail: Record<string, string> = {}
  if (memberEmails.length > 0) {
    const userRes = await payload.find({ collection: 'users', where: { email: { in: memberEmails } }, depth: 0, limit: 500, overrideAccess: true })
    for (const u of userRes.docs as User[]) {
      if (u.email && u.avatar_url) userAvatarByEmail[u.email] = u.avatar_url
    }
  }

  const memberCards: TeamCard[] = memberDocs.map((m) => {
    const u = typeof m.user === 'object' ? (m.user as User) : null
    const custom = m.custom_role && typeof m.custom_role === 'object' ? (m.custom_role as Role) : null
    return {
      id: String(m.id),
      name: m.name || u?.name || m.email,
      email: m.email,
      avatarUrl: mediaUrl(m.avatar) ?? (u?.avatar_url ?? null) ?? (m.email ? (userAvatarByEmail[m.email] ?? null) : null),
      roleTone: (m.role === 'manager' ? 'manager' : 'staff') as 'manager' | 'staff',
      roleName: custom ? custom.name : null,
      pending: m.status === 'invited',
      status: (m.status ?? 'invited') as 'active' | 'invited' | 'suspended',
      joinDate: (m.join_date ?? m.createdAt ?? '').slice(0, 10) || null,
    }
  })

  // ── Egyedi szerepek — a meghívó szerep-választójához és az adatlap pozíció-listájához.
  const rolesRes = await payload.find({ collection: 'roles', where: { restaurant: { equals: restaurant.id } }, sort: 'name', limit: 100, overrideAccess: true })
  const customRoles = rolesRes.docs.map((r) => ({ id: String(r.id), name: r.name }))

  const roster = await getTeamRoster('restaurant', restaurant.id)

  return (
    <div className="p-5 lg:p-0">
      <RestaurantTeamManager
        initialTeam={[ownerCard, ...memberCards]}
        canManage={can(capabilities, 'staff.manage')}
        canEditSalary={isOwner}
        employees={roster}
        customRoles={customRoles}
      />
    </div>
  )
}
