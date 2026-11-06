import { redirect } from 'next/navigation'
import { getOwnedSalon } from '@/lib/salonContext'
import { PartnerProgramView } from '@/components/dashboard/PartnerProgramView'

export const metadata = { title: 'Partnerprogram' }

export default async function SalonPartnerProgramPage() {
  const { role } = await getOwnedSalon()
  if (role !== 'owner') redirect('/dashboard')
  return <PartnerProgramView />
}
