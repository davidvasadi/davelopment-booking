import { getCurrentUser } from '@/lib/auth'
import { getUserBusinesses } from '@/lib/activeBusiness'
import { can } from '@/lib/permissions'

/** Szerkesztheti-e a bejelentkezett felhasználó ennek az üzletnek a foglalóoldalát
 *  (a foglalóoldal-szerkesztő `?editor=1` előnézetéhez): tagja és van `settings.profile` joga. */
export async function canEditPlace(type: 'salon' | 'restaurant', id: string | number): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  const businesses = await getUserBusinesses(user.id)
  const biz = businesses.find((b) => b.type === type && String(b.id) === String(id))
  return !!biz && can(biz.capabilities, 'settings.profile')
}
