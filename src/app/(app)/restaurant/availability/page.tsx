import { redirect } from 'next/navigation'

/** A Nyitvatartás a Beállításokon belül van (design 16.8) — a régi külön oldal oda irányít. */
export default function AvailabilityPage() {
  redirect('/restaurant/settings?tab=hours')
}
