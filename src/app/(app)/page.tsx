import { getPricing } from '@/lib/pricing'
import HomeClient from './HomeClient'

// Vékony szerver-wrapper: betölti a globális árazást (a backstage-ben szerkeszthető), és
// propként adja a kliens-landingnek — így a publikus árak SSR-rel, villódzás nélkül frissek.
export default async function Home() {
  const pricing = await getPricing()
  return <HomeClient pricing={pricing} />
}
