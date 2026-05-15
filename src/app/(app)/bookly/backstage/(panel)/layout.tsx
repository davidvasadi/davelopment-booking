import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { BackstageSidebar } from '@/components/backstage/BackstageSidebar'

export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') redirect('/bookly/backstage/login')

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col lg:flex-row">
      <BackstageSidebar email={user.email} />
      <main className="flex-1 pt-14 pb-28 lg:pt-0 lg:pb-0">
        {children}
      </main>
    </div>
  )
}
