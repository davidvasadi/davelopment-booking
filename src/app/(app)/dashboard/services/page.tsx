import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { fixMediaUrl } from '@/lib/utils'
import type { Service, ServiceCategory, StaffMember, Booking, Media } from '@/payload/payload-types'
import ServicesManager from '@/components/dashboard/ServicesManager'

export default async function ServicesPage() {
  const { salon, capabilities } = await getOwnedSalon(1)
  requireAnyCapability(capabilities, ['catalog.view', 'catalog.manage'], '/dashboard')
  const payload = await getPayloadClient()

  const yearStart = `${new Date().getFullYear()}-01-01`
  const logoUrl = salon.logo && typeof salon.logo === 'object' ? fixMediaUrl((salon.logo as Media).url ?? null) : null

  const [servicesResult, staffResult, categoriesResult, bookingsResult] = await Promise.all([
    payload.find({
      collection: 'services',
      where: { salon: { equals: salon.id } },
      sort: ['sort_order', 'name'],
      depth: 1,
      limit: 200,
    }),
    payload.find({
      collection: 'staff',
      where: { salon: { equals: salon.id } },
      sort: 'name',
      // depth:0 mellett a `staff.avatar` nyers ID marad (nem { url }-os objektum), így az
      // avatar-kép SOSEM jelent meg a szolgáltatás-kártyák szakember-kupacán, még akkor sem,
      // ha az adott staff-nak ténylegesen volt feltöltött avatarja.
      depth: 1,
      limit: 100,
    }),
    payload.find({
      collection: 'service-categories',
      where: { salon: { equals: salon.id } },
      sort: 'sort_order',
      depth: 1,
      limit: 100,
    }),
    // Idei (nem lemondott) foglalások a „Bevétel kategóriánként" csíkhoz — a szolgáltatás
    // aktuális árát összegezzük kategóriánként (a Booking nem tárol árat).
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salon.id } },
          { date: { greater_than_equal: yearStart } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      depth: 1, // service kifejtve (ár + kategória-ID)
      limit: 5000,
      overrideAccess: true,
    }),
  ])

  // Fallback-avatar EMAIL alapján (lásd `dashboard/schedule/page.tsx` azonos komment) — ha a
  // staff-rekordnak nincs külön avatarja, de a személy a SAJÁT profiljában feltöltött egyet.
  const staffEmails = (staffResult.docs as StaffMember[]).map((s) => s.email).filter((e): e is string => !!e)
  const avatarUrlByEmail: Record<string, string> = {}
  if (staffEmails.length > 0) {
    const usersRes = await payload.find({
      collection: 'users',
      where: { email: { in: staffEmails } },
      depth: 0, limit: 500, overrideAccess: true,
    })
    for (const u of usersRes.docs as { email?: string | null; avatar_url?: string | null }[]) {
      const fixed = fixMediaUrl(u.avatar_url)
      if (u.email && fixed) avatarUrlByEmail[u.email.toLowerCase()] = fixed
    }
  }

  // Meghívóra váró (még nem elfogadott) tagok — amíg nem fogadják el, nem rendelhetők
  // szolgáltatáshoz sem (lakat + UX infó a szakember-választón).
  const invitedRes = await payload.find({
    collection: 'memberships',
    where: { and: [{ salon: { equals: salon.id } }, { status: { equals: 'invited' } }] },
    depth: 0, limit: 500, overrideAccess: true,
  })
  const invitedEmails = new Set((invitedRes.docs as { email?: string | null }[]).map((m) => (m.email ?? '').toLowerCase()).filter(Boolean))

  // Bevétel kategóriánként (kategória-ID → Ft; besorolatlan → '__none__').
  const revenueByCategory: Record<string, number> = {}
  for (const b of bookingsResult.docs as Booking[]) {
    const svc = b.service
    if (!svc || typeof svc !== 'object') continue
    const price = (svc as Service).price || 0
    const cat = (svc as Service).category
    const catId = cat == null ? '__none__' : typeof cat === 'object' ? String(cat.id) : String(cat)
    revenueByCategory[catId] = (revenueByCategory[catId] ?? 0) + price
  }

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <ServicesManager
        salonId={salon.id}
        initialServices={servicesResult.docs as Service[]}
        staffList={staffResult.docs as StaffMember[]}
        initialCategories={categoriesResult.docs as ServiceCategory[]}
        supportedLocales={salon.supported_locales ?? null}
        revenueByCategory={revenueByCategory}
        avatarUrlByEmail={avatarUrlByEmail}
        invitedEmails={invitedEmails}
        canManage={can(capabilities, 'catalog.manage')}
        logoUrl={logoUrl}
        uncategorizedSortOrder={salon.services_uncategorized_sort_order ?? null}
      />
    </div>
  )
}
