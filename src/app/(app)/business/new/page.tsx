import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ownerHasActivePaidSubscription } from '@/payload/lib/newPlaceSubscription'
import { getPayloadClient } from '@/lib/payload'
import { NewBusinessForm } from '@/components/business/NewBusinessForm'

export const metadata = { title: 'Új üzlet hozzáadása' }

/**
 * Több-üzlet: új szalon/étterem hozzáadása a MÁR BEJELENTKEZETT felhasználóhoz.
 * Nincs jelszó/újraregisztráció — csak az üzlet adatai. A próbaidő-szabályt jelezzük is
 * (ha a fiók már fizet, az új üzlet egyből fizetős lesz).
 */
export default async function NewBusinessPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // A próbaidő-szabály előzetes jelzéséhez: a fiók már fizet-e bárhol?
  const payload = await getPayloadClient()
  const alreadyPaying = await ownerHasActivePaidSubscription({ payload }, user.id)

  return <NewBusinessForm alreadyPaying={alreadyPaying} />
}
