import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import { PageTransition } from '@/components/ui/page-transition'
import { RestaurantUIProvider } from '@/components/restaurant/RestaurantUIContext'
import { expireStaleTrials } from '@/lib/subscriptionSync'

export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') redirect('/backstage/login')

  expireStaleTrials().catch(() => null)

  // Ugyanaz a layout-keret mint a szalon/étterem dashboardon (DashboardNav + MobileBottomNav),
  // `backstage` varianttal — így egységes az érzés. A backstage-nek nincs szalonja/előfizetése,
  // ezért a salon-prop placeholder, a subscription null (a nav elrejti a store/sub részeket).
  // A RestaurantUIProvider az étterivel azonos összecsukható sidebar állapotát (navCollapsed)
  // szolgálja ki — nélküle a nav összecsukás-gombja no-op lenne.
  return (
    <RestaurantUIProvider>
      <div className="min-h-screen bg-paper font-onest flex flex-col lg:flex-row">
        <DashboardNav
          variant="backstage"
          salonName="Backstage"
          salonSlug=""
          subscription={null}
          userName={user.name}
          userEmail={user.email}
          userAvatarUrl={user.avatar_url ?? null}
        />
        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
        <MobileBottomNav variant="backstage" userName={user.name} userEmail={user.email} userAvatarUrl={user.avatar_url ?? null} />
      </div>
    </RestaurantUIProvider>
  )
}
