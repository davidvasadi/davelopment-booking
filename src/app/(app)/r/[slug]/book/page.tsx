import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPayloadClient } from '@/lib/payload'
import { RestaurantBookingWizard } from '@/components/restaurant/RestaurantBookingWizard'
import type { Restaurant } from '@/payload/payload-types'

export default async function RestaurantBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'restaurants',
    where: { and: [{ slug: { equals: slug } }, { is_active: { not_equals: false } }] },
    limit: 1,
  })
  if (!result.docs.length) notFound()
  const restaurant = result.docs[0] as Restaurant

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-lg mx-auto px-6 py-8">
        <Link
          href={`/r/${restaurant.slug}`}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-white/70 transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />{restaurant.name}
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white mb-1">Asztalfoglalás</h1>
        <p className="text-zinc-500 dark:text-white/40 text-sm mb-8">Válaszd ki a létszámot, dátumot és időpontot.</p>

        <RestaurantBookingWizard
          restaurantId={restaurant.id}
          slug={restaurant.slug}
          requirePhone={restaurant.require_phone ?? true}
          maxPax={restaurant.capacity_mode === 'flat' ? (restaurant.max_pax ?? 20) : 20}
        />
      </div>
    </main>
  )
}
