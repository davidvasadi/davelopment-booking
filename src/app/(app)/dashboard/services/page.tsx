import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { num, rawQuery, sql } from '@/lib/fastRead'
import { fixMediaUrl } from '@/lib/utils'
import { withAvatarFallback } from '@/lib/staffAvatars'
import { BUSINESS_TEMPLATES } from '@/lib/businessTemplates'
import { resolveAvailableLocales } from '@/lib/i18n'
import type { Service, ServiceCategory, StaffMember, Booking, Media } from '@/payload/payload-types'
import { ServicesView, type ServiceVM, type CategoryVM } from '@/components/dashboard/ServicesView'

// a havi számok felirata („foglalás Novemberben”) — a dátum-szavak nagybetűvel (Dave kérése)
const MONTHS_IN = ['Januárban', 'Februárban', 'Márciusban', 'Áprilisban', 'Májusban', 'Júniusban', 'Júliusban', 'Augusztusban', 'Szeptemberben', 'Októberben', 'Novemberben', 'Decemberben']
const relId = (v: unknown): string | null => (v == null ? null : typeof v === 'object' ? String((v as { id: unknown }).id) : String(v))
const mediaOf = (m: unknown): { id: number; url: string } | null => (m && typeof m === 'object' && (m as Media).url ? { id: Number((m as Media).id), url: fixMediaUrl((m as Media).url) ?? (m as Media).url! } : null)

export default async function ServicesPage() {
  const { salon, capabilities } = await getOwnedSalon(1)
  requireAnyCapability(capabilities, ['catalog.view', 'catalog.manage'], '/dashboard')
  const payload = await getPayloadClient()

  // a hónap számai (8.1 legnépszerűbb kártya, 8.3 havi számok) és a heti trend (az elmúlt 7 hét)
  const now = new Date()
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const monthStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1))
  const weekStart = (() => { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 6 * 7); return d })()
  const since = ymd(weekStart) < monthStart ? ymd(weekStart) : monthStart

  const [servicesRes, staffRes, categoriesRes, bookingsRes, invitedRes] = await Promise.all([
    payload.find({ collection: 'services', where: { salon: { equals: salon.id } }, sort: ['sort_order', 'name'], depth: 1, populate: { salons: { name: true } }, limit: 500 }),
    payload.find({ collection: 'staff', where: { salon: { equals: salon.id } }, sort: 'name', depth: 1, populate: { salons: { name: true } }, limit: 200 }),
    payload.find({ collection: 'service-categories', where: { salon: { equals: salon.id } }, sort: 'sort_order', depth: 1, populate: { salons: { name: true } }, limit: 200 }),
    // Sebesség: a foglalások KÖZVETLEN SQL-lel (lib/fastRead, docs/sebesseg) — a Payload itt ~1,5 mp volt, és közben az
    // oldal többi lekérdezése is rá várt
    rawQuery<{ service_id: number | null; date: string; price_snapshot: string | null }>(sql`
      SELECT service_id, date, price_snapshot FROM bookings
      WHERE salon_id = ${Number(salon.id)} AND date >= ${since} AND status NOT IN ('cancelled', 'no_show')`)
      .then((rows) => ({ docs: rows.map((r) => ({ service: r.service_id, date: r.date, price_snapshot: num(r.price_snapshot) })) })),
    // meghívóra váró tagok — amíg nem fogadják el, nem rendelhetők szolgáltatáshoz
    payload.find({ collection: 'memberships', where: { and: [{ salon: { equals: salon.id } }, { status: { equals: 'invited' } }] }, depth: 0, limit: 500, overrideAccess: true }),
  ])
  const staff = await withAvatarFallback(payload, staffRes.docs as StaffMember[])
  const invited = new Set((invitedRes.docs as { email?: string | null }[]).map((m) => (m.email ?? '').toLowerCase()).filter(Boolean))

  const services = servicesRes.docs as Service[]
  const priceById = new Map(services.map((s) => [String(s.id), s.price ?? 0]))
  const stats = new Map<string, { count: number; revenue: number; weeks: number[] }>()
  for (const b of bookingsRes.docs as unknown as Booking[]) {
    const id = relId(b.service)
    if (!id) continue
    const st = stats.get(id) ?? { count: 0, revenue: 0, weeks: [0, 0, 0, 0, 0, 0, 0] }
    const d = String(b.date ?? '').slice(0, 10)
    if (d >= monthStart) { st.count++; st.revenue += typeof b.price_snapshot === 'number' ? b.price_snapshot : priceById.get(id) ?? 0 }
    const w = Math.floor((new Date(`${d}T12:00:00`).getTime() - weekStart.getTime()) / (7 * 86_400_000))
    if (w >= 0 && w < 7) st.weeks[w]++
    stats.set(id, st)
  }

  const serviceVMs: ServiceVM[] = services.map((s) => {
    const st = stats.get(String(s.id))
    return {
      id: String(s.id), name: s.name ?? '', description: s.description ?? '', categoryId: relId(s.category), subcategoryId: relId(s.subcategory),
      image: mediaOf(s.image), staffIds: (s.staff ?? []).map((x) => relId(x)!).filter(Boolean), duration: s.duration_minutes ?? 60, price: s.price ?? 0,
      currency: s.currency === 'EUR' ? 'EUR' : 'HUF', active: s.is_active !== false, monthCount: st?.count ?? 0, monthRevenue: st?.revenue ?? 0, weeks: st?.weeks ?? [0, 0, 0, 0, 0, 0, 0],
    }
  })
  const categoryVMs: CategoryVM[] = (categoriesRes.docs as ServiceCategory[]).map((c) => ({
    id: String(c.id), name: c.name ?? '', durationLabel: c.duration_label ?? '', description: c.description ?? '', image: mediaOf(c.image),
  }))

  // előleg (8.1 / 8.3): csak ha be van kapcsolva és a fizetés (Stripe) be van kötve
  const dep = salon.deposit_settings
  const deposit = dep?.enabled && salon.stripe_connect_onboarded
    ? (dep.type === 'percent' ? { type: 'percent' as const, value: dep.percent_value ?? 0 } : { type: 'fixed' as const, value: dep.fixed_amount_huf ?? 0 })
    : null

  return (
    <ServicesView
      salonId={String(salon.id)}
      services={serviceVMs}
      categories={categoryVMs}
      staff={staff.map((m) => ({
        id: String(m.id), name: m.name ?? '', img: m.avatar && typeof m.avatar === 'object' ? fixMediaUrl((m.avatar as Media).url) ?? null : null,
        ...(m.email && invited.has(m.email.toLowerCase()) ? { disabled: true, title: 'Még nem fogadta el a meghívást' } : {}),
      }))}
      deposit={deposit}
      month={MONTHS_IN[now.getMonth()]}
      templates={BUSINESS_TEMPLATES.map((t) => [t.type, t.label] as [string, string])}
      canManage={can(capabilities, 'catalog.manage')}
      locales={resolveAvailableLocales(salon.supported_locales ?? null)}
    />
  )
}
