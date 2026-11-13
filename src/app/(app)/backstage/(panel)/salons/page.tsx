import { requireAuth } from '@/lib/auth'
import { Activity, Building2, CalendarDays } from 'lucide-react'
import { Kpi, PageHead, SegmentBar } from '@/components/ui-kit'
import { PlacesView } from '@/components/backstage/BackstageViews'
import { loadBackstageData } from '@/lib/backstageMetrics'
import { placeVMs } from '@/lib/backstageView'

export const dynamic = 'force-dynamic'

/** Backstage › Üzletek (design B.10): minden szalon és étterem, mellette a megnyitott üzlet adatlapja.
 *  `?place=salon:12` / `?place=restaurant:3` — megnyitva érkezik (pl. a Kockázatból vagy a régi szalon-linkről). */
export default async function BackstagePlacesPage({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  await requireAuth('admin')
  const { place } = await searchParams
  const d = await loadBackstageData()
  const places = placeVMs(d.accounts)
  const month = places.reduce((n, p) => n + p.month, 0)
  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Üzletek" sub={`${d.totalSalons} szalon · ${d.totalRestaurants} étterem`}
        bar={<SegmentBar segments={[
          { label: 'Szalon', value: String(d.totalSalons), weight: d.totalPlaces ? d.totalSalons : 50, tone: 'dark' },
          { label: 'Étterem', value: String(d.totalRestaurants), weight: d.totalPlaces ? Math.max(d.totalRestaurants, d.totalPlaces * 0.06) : 50, tone: 'yellow' },
        ]} />}
        kpis={<><Kpi icon={Building2} value={String(d.totalPlaces)} label="Üzlet" /><Kpi icon={CalendarDays} value={month.toLocaleString('hu-HU')} label="Foglalás · 30 nap" /><Kpi icon={Activity} value={`${d.activePlaceRate}%`} label="Aktív" /></>} />
      <PlacesView places={places} initial={place} />
    </div>
  )
}
