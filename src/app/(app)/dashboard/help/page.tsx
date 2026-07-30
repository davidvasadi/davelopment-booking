import { getOwnedSalon } from '@/lib/salonContext'
import { TipsContent } from '@/components/onboarding/TipsContent'

export const metadata = { title: 'Súgó' }

export default async function SalonHelpPage() {
  const { capabilities } = await getOwnedSalon()
  return <TipsContent variant="salon" capabilities={capabilities} />
}
