import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon } from '@/payload/payload-types'
import SalonSettingsForm from '@/components/dashboard/SalonSettingsForm'

export default async function SettingsPage() {
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    depth: 1,
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon

  return (
    <div className="p-5 lg:p-8 max-w-2xl">
      <div className="mb-8">
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Szalon adatok</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Beállítások</h1>
      </div>
      <SalonSettingsForm salon={salon} />
    </div>
  )
}
