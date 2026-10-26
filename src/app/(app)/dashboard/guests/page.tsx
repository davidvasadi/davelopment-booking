import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { GuestsView, type MetricVM } from '@/components/dashboard/guests-view'
import { loadSalonGuests, listGuests } from '@/lib/guestsData'

// A vendégek összerakása a közös adatrétegben (lib/guestsData.ts) van — itt csak az ELSŐ oldal
// (20 sor) és a legfrissebb vendég profilja megy le; a többit a lista görgetve kéri (/api/guests).
export default async function SalonGuestsPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['guests.view', 'guests.manage'], '/dashboard')

  const ctx = await loadSalonGuests(salon.id)
  const initialList = listGuests(ctx, { page: 1 })
  const first = initialList.items[0] ? ctx.guests.find((g) => g.key === initialList.items[0].key) : undefined
  const initialProfile = first ? ctx.toVM(first) : null

  const metrics: MetricVM[] = [
    { icon: 'users', value: ctx.total, label: 'Összes vendég' },
    { icon: 'home', value: ctx.domestic, label: 'Belföldi', suffix: '%' },
    { icon: 'globe', value: ctx.foreign, label: 'Külföldi', suffix: '%' },
  ]

  const mapEmpty = (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#f2eee2] to-[#e7e2d4] p-6 text-center">
      <p className="text-base font-medium text-ink">Helyadat hamarosan</p>
      <p className="mt-1 max-w-xs text-sm text-ink-soft">
        A foglaláskor megadott telefonszám országából töltődik fel a vendégtérkép.
      </p>
    </div>
  )

  return (
    <GuestsView
      dayLoadEndpoint="/api/salon/day-load"
      pills={ctx.pills}
      metrics={metrics}
      initialList={initialList}
      initialProfile={initialProfile}
      arrivals={ctx.arrivals}
      arrivalsDateLabel="Ma"
      returningPct={ctx.returningPct}
      returningNum={ctx.returningNum}
      newNum={ctx.newNum}
      buckets={ctx.buckets}
      mapLabel="Honnan érkeznek"
      mapEmpty={mapEmpty}
      canManage={can(capabilities, 'guests.manage')}
    />
  )
}
