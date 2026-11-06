import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { GuestsView } from '@/components/dashboard/GuestsView'
import { loadRestaurantGuests, listGuests } from '@/lib/guestsData'
import { APP_URL } from '@/lib/brand'

// A vendégek összerakása a közös adatrétegben (lib/guestsData.ts) van — itt csak az ELSŐ oldal és a legfrissebb vendég
// adatlapja megy le; a többit a lista lapozva kéri (/api/guests).
export default async function RestaurantGuestsPage() {
  const { restaurant, capabilities } = await getOwnedRestaurant()
  requireAnyCapability(capabilities, ['guests.view', 'guests.manage'], '/restaurant')

  const ctx = await loadRestaurantGuests(restaurant.id)
  const initialList = listGuests(ctx, { page: 1 })
  const first = initialList.items[0] ? ctx.guests.find((g) => g.key === initialList.items[0].key) : undefined

  return (
    <GuestsView
      counts={ctx.counts}
      total={ctx.total}
      domestic={ctx.domestic}
      foreign={ctx.foreign}
      returningPct={ctx.returningPct}
      returningNum={ctx.returningNum}
      newNum={ctx.newNum}
      buckets={ctx.buckets}
      arrivals={ctx.arrivals}
      initialList={initialList}
      initialProfile={first ? ctx.toVM(first) : null}
      canManage={can(capabilities, 'guests.manage')}
      restaurant
      base="/restaurant"
      bookingUrl={`${APP_URL}/${restaurant.slug}`}
    />
  )
}
