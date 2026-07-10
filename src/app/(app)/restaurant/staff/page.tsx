import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import RestaurantTeamManager, { type TeamCard } from '@/components/restaurant/RestaurantTeamManager'
import { getTeamRoster } from '@/lib/teamRoster'
import type { Membership, User } from '@/payload/payload-types'

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
  const { restaurant, userId } = await getOwnedRestaurant()
  const payload = await getPayloadClient()

  const membersRes = await payload.find({
    collection: 'memberships',
    where: { restaurant: { equals: restaurant.id } },
    sort: 'createdAt',
    depth: 1,
    limit: 500,
    overrideAccess: true,
  })

  const owner = restaurant.owner && typeof restaurant.owner === 'object' ? (restaurant.owner as User) : null
  // Bér/borravaló + a TULAJ adatlapjának szerkesztése CSAK a valódi tulajé (nem elég az aktív tagság).
  const ownerId = owner?.id ?? restaurant.owner
  const isOwner = String(ownerId) === String(userId)
  const ownerCard: TeamCard = {
    id: null,
    name: owner?.name || owner?.email || 'Tulajdonos',
    email: owner?.email ?? '',
    avatarUrl: owner?.avatar_url ?? null,
    roleTone: 'owner',
    pending: false,
    status: 'active',
    joinDate: null,
  }

  const memberCards: TeamCard[] = (membersRes.docs as Membership[])
    // a tulaj-membershipet kiszűrjük — külön owner-sor jeleníti meg
    .filter((m) => m.role !== 'owner')
    .map((m) => {
      const u = typeof m.user === 'object' ? (m.user as User) : null
      return {
        id: String(m.id),
        name: m.name || u?.name || m.email,
        email: m.email,
        avatarUrl: mediaUrl(m.avatar) ?? (u?.avatar_url ?? null),
        roleTone: (m.role === 'manager' ? 'manager' : 'staff') as 'manager' | 'staff',
        pending: m.status === 'invited',
        status: (m.status ?? 'invited') as 'active' | 'invited' | 'suspended',
        joinDate: m.createdAt ? m.createdAt.slice(0, 10) : null,
      }
    })

  const roster = await getTeamRoster('restaurant', restaurant.id)

  return (
    <div className="p-5 lg:p-0">
      <RestaurantTeamManager
        initialTeam={[ownerCard, ...memberCards]}
        canManage
        canEditSalary={isOwner}
        employees={roster}
        positions={(restaurant.positions ?? [])
          .filter((p) => !!p.label)
          .map((p) => ({ label: p.label, level: (p.level ?? 'staff') as 'lead' | 'staff' }))}
      />
    </div>
  )
}
