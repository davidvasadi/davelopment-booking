import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { autoCompleteBookings } from '@/lib/autoComplete'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
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
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col lg:flex-row">
      <DashboardNav salonName={salon.name} salonSlug={salon.slug} />
      <main className="flex-1 pb-24 lg:pb-0">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}
