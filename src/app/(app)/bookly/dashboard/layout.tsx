import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { autoCompleteBookings } from '@/lib/autoComplete'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import type { Salon } from '@/payload/payload-types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth('salon_owner')

  const payload = await getPayloadClient()
  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })

  if (!salonResult.docs.length) redirect('/bookly/register')
  const salon = salonResult.docs[0] as Salon

  autoCompleteBookings(salon.id).catch(() => null)

  return (
    <div className="flex min-h-screen bg-[#F5F4F2]">
      <DashboardNav salonName={salon.name} salonSlug={salon.slug} />
      <main className="flex-1 overflow-auto pt-14 pb-20 lg:pt-0 lg:pb-0">
        {children}
      </main>
    </div>
  )
}
