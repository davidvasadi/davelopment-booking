import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { getTeamRoster } from '@/lib/teamRoster'
import { getPricing } from '@/lib/pricing'
import { SALON_INCLUDED_STAFF } from '@/lib/tier'
import { resolveAvailableLocales } from '@/lib/i18n'
import { TeamView } from '@/components/dashboard/TeamView'
import type { Role, Service, User } from '@/payload/payload-types'

/** Munkatársak — szalon (design 10.1–10.5). */
export default async function StaffPage() {
  const { salon, capabilities, userEmail, userId } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['staff.view', 'staff.manage'], '/dashboard')
  const payload = await getPayloadClient()

  const [members, servicesRes, rolesRes, pricing] = await Promise.all([
    getTeamRoster('salon', salon.id),
    payload.find({ collection: 'services', where: { salon: { equals: salon.id } }, sort: 'name', depth: 0, limit: 500, overrideAccess: true, select: { name: true } }),
    payload.find({ collection: 'roles', where: { salon: { equals: salon.id } }, sort: 'name', depth: 0, limit: 100, overrideAccess: true }),
    getPricing(),
  ])
  const ownerId = salon.owner && typeof salon.owner === 'object' ? (salon.owner as User).id : salon.owner

  return (
    <TeamView
      staffInvoicing={salon.invoice_settings?.issuer === 'staff'}
      businessId={String(salon.id)}
      members={members}
      services={(servicesRes.docs as Service[]).map((s) => ({ id: String(s.id), name: s.name }))}
      roles={(rolesRes.docs as Role[]).map((r) => ({ id: String(r.id), label: r.name, desc: `${r.capabilities?.length ?? 0} jogosultság` }))}
      locales={resolveAvailableLocales(salon.supported_locales ?? null)}
      canManage={can(capabilities, 'staff.manage')}
      canSalary={can(capabilities, 'staff.salary')}
      isOwnerViewer={String(ownerId) === String(userId)}
      canEditAvailability={can(capabilities, 'availability.manage')}
      viewerEmail={userEmail}
      extraFee={{ fee: pricing.salon_extra_staff_huf, included: SALON_INCLUDED_STAFF }}
    />
  )
}
