import { redirect } from 'next/navigation'

/**
 * Az "Előfizetések" oldal összevonva az "Előfizetők"-be (2026-08-25) — két, majdnem 1:1
 * ugyanazt mutató nézet volt (lásd docs/planning/backstage-feature-roadmap.md). A
 * `SubscriptionStatusSelect` komponens és a mögötte lévő API-végpont megmaradt — az
 * `accounts/OrphanSubscriptions.tsx` újrahasznosítja owner nélküli előfizetéseknél.
 */
export default async function SubscriptionsRedirect({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams
  redirect(status ? `/backstage/accounts?status=${status}` : '/backstage/accounts')
}
