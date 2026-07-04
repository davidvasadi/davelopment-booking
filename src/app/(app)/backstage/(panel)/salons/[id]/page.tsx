import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import type { Salon, User, Subscription, Booking, Service } from '@/payload/payload-types'
import {
  Building2, MapPin, Phone, Mail, Globe,
  ArrowLeft, ExternalLink, Clock,
} from 'lucide-react'
import Link from 'next/link'
import PlaceToggle from '../PlaceToggle'
import SalonNotesForm from './SalonNotesForm'
import ImpersonateButton from './ImpersonateButton'
import { PLAN_LABELS, STATUS_LABELS } from '@/lib/backstagePlaces'

/* davelopment státusz-badge (előfizetés + foglalás) */
const SUB_BADGE: Record<string, string> = {
  trialing: 'bg-[#FBF4DC] text-[#7A6A2E]',
  active: 'bg-[#E7F2EA] text-[#1D9D63]',
  past_due: 'bg-[#F8E9E7] text-[#C0392B]',
  canceled: 'bg-[#F0EAD8] text-ink-soft',
  paused: 'bg-[#FBF4DC] text-[#7A6A2E]',
}
function bookingBadge(status: string): string {
  if (status === 'confirmed') return 'bg-[#E7F2EA] text-[#1D9D63]'
  if (status === 'cancelled' || status === 'no_show') return 'bg-[#F8E9E7] text-[#C0392B]'
  if (status === 'completed') return 'bg-[#F0EAD8] text-ink-soft'
  return 'bg-[#FBF4DC] text-[#7A6A2E]'
}

export default async function SalonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const payload = await getPayloadClient()

  const [salonResult, bookingsResult] = await Promise.all([
    payload.findByID({ collection: 'salons', id, depth: 2, overrideAccess: true }).catch(() => null),
    payload.find({
      collection: 'bookings',
      where: { salon: { equals: id } },
      sort: '-createdAt',
      limit: 8,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  if (!salonResult) notFound()
  const salon = salonResult as Salon
  const owner = typeof salon.owner === 'object' ? (salon.owner as User) : null
  // Fiók-szintű előfizetés: a hely tulajdonosának (owner) közös előfizetése (a fiók része).
  const ownerId = owner?.id ?? (typeof salon.owner === 'string' ? salon.owner : null)
  const sub = ownerId
    ? ((await payload.find({ collection: 'subscriptions', where: { owner: { equals: ownerId } }, limit: 1, overrideAccess: true })).docs[0] as Subscription | undefined)
    : undefined

  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const [totalBookings, monthBookings] = await Promise.all([
    payload.find({ collection: 'bookings', where: { salon: { equals: id } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', where: { salon: { equals: id }, createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
  ])

  const recentBookings = bookingsResult.docs as Booking[]

  const cardBase = 'rounded-[26px] bg-white border border-line shadow-dav-card'
  const label = 'text-[11px] font-semibold uppercase tracking-wider text-ink-soft'

  return (
    <div className="space-y-[22px] p-5 font-onest lg:p-8">
      {/* Back */}
      <Link href="/backstage/salons" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-soft transition-colors hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Szalonok
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#F6F2E4]">
            <Building2 className="h-6 w-6 text-ink-soft" strokeWidth={1.7} />
          </div>
          <div>
            <h1 className="text-[28px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[34px]">{salon.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${salon.is_active ? 'bg-[#E7F2EA] text-[#1D9D63]' : 'bg-[#F0EAD8] text-ink-soft'}`}>
                {salon.is_active ? 'Aktív' : 'Inaktív'}
              </span>
              {salon.city && (
                <span className="flex items-center gap-1 text-[12px] font-medium text-ink-soft">
                  <MapPin className="h-3 w-3" />{salon.city}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/${salon.slug}`}
            target="_blank"
            className="flex items-center gap-1.5 rounded-[22px] bg-[#F6F2E4] px-[16px] py-[11px] text-[13.5px] font-semibold text-ink transition-colors hover:bg-[#EFE9D6]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Nyilvános oldal
          </a>
          {owner && <ImpersonateButton userId={owner.id} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Owner */}
        <div className={`${cardBase} p-5`}>
          <p className={`${label} mb-3`}>Tulajdonos</p>
          {owner ? (
            <div>
              <p className="text-[14px] font-semibold text-ink">{owner.name}</p>
              <p className="mt-0.5 text-[12px] text-ink-soft">{owner.email}</p>
              <p className="mt-3 text-[12px] text-ink-soft2">
                Regisztrált: {new Date(owner.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          ) : (
            <p className="text-[14px] text-ink-soft">—</p>
          )}
        </div>

        {/* Subscription */}
        <div className={`${cardBase} p-5`}>
          <p className={`${label} mb-3`}>Előfizetés</p>
          {sub ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[14px] font-bold text-ink">{PLAN_LABELS[sub.plan]}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUB_BADGE[sub.status] ?? 'bg-[#F0EAD8] text-ink-soft'}`}>
                  {STATUS_LABELS[sub.status]}
                </span>
              </div>
              {sub.amount_huf != null && sub.amount_huf > 0 && (
                <p className="text-[12px] text-ink-soft">{sub.amount_huf.toLocaleString('hu-HU')} Ft/hó</p>
              )}
              {(sub.trial_ends_at || sub.current_period_end) && (
                <p className="mt-2 flex items-center gap-1 text-[12px] text-ink-soft2">
                  <Clock className="h-3 w-3" />
                  {sub.status === 'trialing' && sub.trial_ends_at
                    ? `Trial vége: ${new Date(sub.trial_ends_at).toLocaleDateString('hu-HU')}`
                    : sub.current_period_end
                      ? `Időszak vége: ${new Date(sub.current_period_end).toLocaleDateString('hu-HU')}`
                      : null}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[14px] text-ink-soft">Nincs előfizetés</p>
              <Link href="/backstage/subscriptions" className="mt-1 inline-block text-[12px] text-ink-soft underline">Létrehozás →</Link>
            </div>
          )}
        </div>

        {/* Bookings stats */}
        <div className={`${cardBase} p-5`}>
          <p className={`${label} mb-3`}>Foglalások</p>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-[38px] font-light leading-none tracking-[-0.02em] text-ink">{totalBookings.totalDocs}</p>
              <p className="mt-1.5 text-[12px] font-medium text-ink-soft">összesen</p>
            </div>
            <div>
              <p className="text-[26px] font-light leading-none tracking-[-0.02em] text-ink">{monthBookings.totalDocs}</p>
              <p className="mt-1.5 text-[12px] font-medium text-ink-soft">ebben a hónapban</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact + Active toggle */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${cardBase} p-5`}>
          <p className={`${label} mb-3`}>Elérhetőség</p>
          <div className="space-y-2">
            {salon.phone && (
              <p className="flex items-center gap-2 text-[13.5px] text-ink">
                <Phone className="h-3.5 w-3.5 text-ink-soft" />{salon.phone}
              </p>
            )}
            {salon.email && (
              <p className="flex items-center gap-2 text-[13.5px] text-ink">
                <Mail className="h-3.5 w-3.5 text-ink-soft" />{salon.email}
              </p>
            )}
            {salon.website && (
              <p className="flex items-center gap-2 text-[13.5px] text-ink">
                <Globe className="h-3.5 w-3.5 text-ink-soft" />{salon.website}
              </p>
            )}
            {salon.address && (
              <p className="flex items-center gap-2 text-[13.5px] text-ink">
                <MapPin className="h-3.5 w-3.5 text-ink-soft" />{salon.address}
              </p>
            )}
            {!salon.phone && !salon.email && !salon.website && !salon.address && (
              <p className="text-[14px] text-ink-soft">—</p>
            )}
          </div>
        </div>

        <div className={`${cardBase} p-5`}>
          <p className={`${label} mb-3`}>Státusz</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13.5px] font-medium text-ink">Szalon aktív</p>
              <p className="mt-0.5 text-[12px] text-ink-soft">Látható az ügyfeleknek</p>
            </div>
            <PlaceToggle kind="salon" placeId={salon.id} isActive={salon.is_active ?? false} />
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[12px] text-ink-soft2">
              Regisztrált: {new Date(salon.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-soft2">Slug: /{salon.slug}</p>
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      {recentBookings.length > 0 && (
        <div className={`${cardBase} overflow-hidden`}>
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[13.5px] font-bold text-ink">Legutóbbi foglalások</h2>
          </div>
          <div>
            {recentBookings.map((b, i) => {
              const service = typeof b.service === 'object' ? (b.service as Service) : null
              const showBorder = i < recentBookings.length - 1
              return (
                <div key={b.id} className={`flex items-center justify-between px-5 py-3 ${showBorder ? 'border-b border-line' : ''}`}>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink">{b.customer_name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-soft">{service?.name ?? '—'} · {b.date} {b.start_time}</p>
                  </div>
                  <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${bookingBadge(b.status)}`}>
                    {b.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Admin notes */}
      <div className={`${cardBase} p-5`}>
        <p className={`${label} mb-3`}>Belső megjegyzés</p>
        <SalonNotesForm salonId={salon.id} initialNotes={salon.admin_notes ?? ''} />
      </div>
    </div>
  )
}
