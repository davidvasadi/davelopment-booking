import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import type { StaffMember } from '@/payload/payload-types'
import StaffManager from '@/components/dashboard/StaffManager'

export default async function StaffPage() {
  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

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
