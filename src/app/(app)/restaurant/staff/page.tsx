import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import RestaurantTeamManager, { type TeamCard } from '@/components/restaurant/RestaurantTeamManager'
import type { Membership, User } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/**
 * ÉTTEREM MUNKATÁRSAK — a csapat (memberships) táblázatos nézete.
 * A tulaj mindig az első sor („Tulajdonos"), az `owner` mezőből.
 * Meghívás/szerep/eltávolítás a MEGLÉVŐ /api/team flow-n. SMS sehol.
 */
export default async function RestaurantStaffPage() {
  const { restaurant } = await getOwnedRestaurant()
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
  const ownerCard: TeamCard = {
    id: null,
    name: owner?.name || owner?.email || 'Tulajdonos',
    email: owner?.email ?? '',
    roleTone: 'owner',
    pending: false,
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
        roleTone: (m.role === 'manager' ? 'manager' : 'staff') as 'manager' | 'staff',
        pending: m.status !== 'active',
        joinDate: m.createdAt ? m.createdAt.slice(0, 10) : null,
      }
    })

  return (
    <div className="p-5 lg:p-0">
      <RestaurantTeamManager initialTeam={[ownerCard, ...memberCards]} />
    </div>
  )
}
