import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { getTeamRoster } from '@/lib/teamRoster'
import { TeamView } from '@/components/dashboard/TeamView'
import type { Role, User } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

/** Munkatársak — étterem (design 10.6: ugyanaz az oldal; nem foglalható senki, a bér mellett a borravaló-jogosultság). */
export default async function RestaurantStaffPage() {
  const { restaurant, userId, userEmail, capabilities } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['staff.view', 'staff.manage'], '/restaurant')
  const payload = await getPayloadClient()

  const [members, rolesRes] = await Promise.all([
    getTeamRoster('restaurant', restaurant.id),
    payload.find({ collection: 'roles', where: { restaurant: { equals: restaurant.id } }, sort: 'name', depth: 0, limit: 100, overrideAccess: true }),
  ])
  const ownerId = restaurant.owner && typeof restaurant.owner === 'object' ? (restaurant.owner as User).id : restaurant.owner
  const isOwner = String(ownerId) === String(userId)

  return (
    <TeamView
      restaurant
      businessId={String(restaurant.id)}
      members={members}
      roles={(rolesRes.docs as Role[]).map((r) => ({ id: String(r.id), label: r.name, desc: `${r.capabilities?.length ?? 0} jogosultság` }))}
      canManage={can(capabilities, 'staff.manage')}
      // a bér (és a borravaló-jogosultság) a tagnál csak a tulajé (az API is így engedi)
      canSalary={isOwner}
      isOwnerViewer={isOwner}
      viewerEmail={userEmail}
    />
  )
}
