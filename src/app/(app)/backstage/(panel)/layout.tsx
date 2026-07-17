import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AppShell } from '@/components/dashboard/AppShell'
import { PageTransition } from '@/components/ui/page-transition'
import { expireStaleTrials } from '@/lib/subscriptionSync'

export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') redirect('/backstage/login')

  expireStaleTrials().catch(() => null)

  // A backstage UGYANAZT az egységes app-keretet kapja mint a szalon/étterem dashboard
  // (AppShell: gradientes 34px konténer + felső pill-nav + üveges kártyák). A backstage-nek
  // nincs saját üzlete/előfizetése/nyilvános oldala — az AppNavbar a `variant="backstage"`
  // ágon elrejti a store-switchert, a nyilvános linket és a CSV-exportot; a `subscription`
  // null (nincs lock/banner), a slug üres.
  return (
    <AppShell
      variant="backstage"
      businessName="Backstage"
      businessSlug=""
      subscription={null}
      basePath="/backstage"
      userId={String(user.id)}
      userName={user.name}
      userEmail={user.email}
      userAvatarUrl={user.avatar_url ?? null}
    >
      <PageTransition>{children}</PageTransition>
    </AppShell>
  )
}
