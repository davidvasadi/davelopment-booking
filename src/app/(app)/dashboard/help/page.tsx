import { getOwnedSalon } from '@/lib/salonContext'
import { HelpView } from '@/components/dashboard/HelpView'

export const metadata = { title: 'Súgó' }

export default async function SalonHelpPage() {
  const { capabilities } = await getOwnedSalon()
  return <HelpView variant="salon" capabilities={capabilities} />
}
