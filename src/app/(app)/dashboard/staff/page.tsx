import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, StaffMember } from '@/payload/payload-types'
import StaffManager from '@/components/dashboard/StaffManager'

export default async function StaffPage() {
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon

  const staffResult = await payload.find({
    collection: 'staff',
    where: { salon: { equals: salon.id } },
    sort: 'name',
    depth: 1,
    limit: 100,
  })

  return (
    <div className="p-5 lg:p-8">
      <StaffManager salonId={salon.id} initialStaff={staffResult.docs as StaffMember[]} />
    </div>
  )
}
