import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { getPayloadClient } from '@/lib/payload'
import { NewBusinessForm } from '@/components/business/NewBusinessForm'

export const metadata = { title: 'Új üzlet hozzáadása' }

/**
 * Több-üzlet: új szalon/étterem hozzáadása a MÁR BEJELENTKEZETT felhasználóhoz.
 * Nincs jelszó/újraregisztráció — csak az üzlet adatai. Fiók-szintű előfizetés: az új üzlet
 * a fiók egyetlen előfizetésébe számít be (a díj újraszámol). Ha a fiók már fizető, az új
 * üzlet díja azonnal hozzáadódik; ha még próbaidőn van, a közös próbaidő alá esik.
 */
export default async function NewBusinessPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const payload = await getPayloadClient()
  const sub = await findAccountSubscription({ payload }, user.id)
  const alreadyPaying = sub?.status === 'active'

  return <NewBusinessForm alreadyPaying={alreadyPaying} />
}
