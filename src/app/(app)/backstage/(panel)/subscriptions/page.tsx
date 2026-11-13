import { redirect } from 'next/navigation'

/**
 * Az "Előfizetések" oldal összevonva az "Előfizetők"-be (2026-08-25); a gazdátlan előfizetések állapota ott, a
 * „Gazdátlan előfizetés” kártyából állítható (`/api/backstage/subscriptions/[subId]`).
 */
export default async function SubscriptionsRedirect({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams
  redirect(status ? `/backstage/accounts?status=${status}` : '/backstage/accounts')
}
