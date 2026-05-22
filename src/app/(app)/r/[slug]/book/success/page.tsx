import Link from 'next/link'
import { Check } from 'lucide-react'

export default async function RestaurantBookSuccessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="inline-flex h-16 w-16 rounded-full bg-[#00bb88]/10 items-center justify-center mb-6">
          <Check className="h-8 w-8 text-[#00bb88]" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Foglalás megerősítve!</h1>
        <p className="text-zinc-500 dark:text-white/50 mb-8">
          A visszaigazolást elküldtük emailben a foglalás részleteivel és egy naptár-melléklettel.
        </p>
        <Link
          href={`/r/${slug}`}
          className="inline-flex h-12 px-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 transition-opacity items-center"
        >
          Vissza az étterem oldalára
        </Link>
      </div>
    </main>
  )
}
