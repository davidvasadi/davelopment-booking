import { getPayloadClient } from './payload'
import { roleLabel } from './permissions'
import type { Membership, User } from '@/payload/payload-types'
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
}): Promise<TeamMember[]> {
  const payload = await getPayloadClient()

  const owner: TeamMember = {
    name: opts.ownerName,
    email: opts.ownerEmail,
    role: 'Tulajdonos',
    roleTone: 'owner',
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
    members = (res.docs as Membership[]).map((m) => {
      const u = typeof m.user === 'object' ? (m.user as User) : null
      const tone = m.role === 'manager' ? 'manager' : 'staff'
      return {
        id: String(m.id),
        name: m.name || u?.name || m.email,
        email: m.email,
        role: roleLabel(m.role),
        roleTone: tone,
        pending: m.status === 'invited',
      }
    })
  } catch {
    members = []
  }

  return [owner, ...members]
}
