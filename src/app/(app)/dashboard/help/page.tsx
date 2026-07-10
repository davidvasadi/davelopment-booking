import { getOwnedSalon } from '@/lib/salonContext'
import { TipsContent } from '@/components/onboarding/TipsContent'

export const metadata = { title: 'Súgó' }

export default async function SalonHelpPage() {
  // Auth + modul-gate (átirányít, ha nem szalon / nincs bejelentkezve).
  await getOwnedSalon()
  return <TipsContent variant="salon" />
}
