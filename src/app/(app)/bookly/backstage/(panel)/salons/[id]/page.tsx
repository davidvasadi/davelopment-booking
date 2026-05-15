import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import type { Salon, User, Subscription, Booking, Service } from '@/payload/payload-types'
import {
  Building2, MapPin, Phone, Mail, Globe,
  ArrowLeft, ExternalLink, Clock,
} from 'lucide-react'
import Link from 'next/link'
import SalonToggle from '../SalonToggle'
import SalonNotesForm from './SalonNotesForm'
import ImpersonateButton from './ImpersonateButton'

const PLAN_LABELS: Record<string, string> = { free: 'Ingyenes', starter: 'Starter', pro: 'Pro' }
const STATUS_LABELS: Record<string, string> = {
  trialing: 'Próbaidőszak', active: 'Aktív', past_due: 'Lejárt fizetés',
  canceled: 'Megszakítva', paused: 'Szüneteltetett',
}
const STATUS_COLORS: Record<string, string> = {
  trialing: 'bg-blue-500/10 text-blue-500',
  active: 'bg-emerald-500/10 text-emerald-500',
  past_due: 'bg-red-500/10 text-red-500',
  canceled: 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500',
  paused: 'bg-amber-500/10 text-amber-500',
}

export default async function SalonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const payload = await getPayloadClient()

  const [salonResult, subResult, bookingsResult] = await Promise.all([
    payload.findByID({ collection: 'salons', id, depth: 2, overrideAccess: true }).catch(() => null),
    payload.find({ collection: 'subscriptions', where: { salon: { equals: id } }, limit: 1, overrideAccess: true }),
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
  const sub = subResult.docs[0] as Subscription | undefined

  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const [totalBookings, monthBookings] = await Promise.all([
    payload.find({ collection: 'bookings', where: { salon: { equals: id } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', where: { salon: { equals: id }, createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
  ])

  const recentBookings = bookingsResult.docs as Booking[]

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-10">
      {/* Back */}
      <Link href="/bookly/backstage/salons" className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Szalonok
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div>
            <h1 className="text-zinc-900 dark:text-white font-black text-2xl tracking-tight">{salon.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${salon.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500'}`}>
                {salon.is_active ? 'Aktív' : 'Inaktív'}
              </span>
              {salon.city && (
                <span className="flex items-center gap-1 text-zinc-400 text-xs">
                  <MapPin className="h-3 w-3" />{salon.city}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/bookly/${salon.slug}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 text-sm hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Nyilvános oldal
          </a>
          {owner && <ImpersonateButton userId={owner.id} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Owner */}
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
          <p className="text-zinc-400 dark:text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-3">Tulajdonos</p>
          {owner ? (
            <div>
              <p className="text-zinc-900 dark:text-white font-semibold text-sm">{owner.name}</p>
              <p className="text-zinc-500 text-xs mt-0.5">{owner.email}</p>
              <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-3">
                Regisztrált: {new Date(owner.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          ) : (
            <p className="text-zinc-400 text-sm">—</p>
          )}
        </div>

        {/* Subscription */}
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
          <p className="text-zinc-400 dark:text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-3">Előfizetés</p>
          {sub ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zinc-900 dark:text-white font-bold text-sm">{PLAN_LABELS[sub.plan]}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status]}`}>
                  {STATUS_LABELS[sub.status]}
                </span>
              </div>
              {sub.amount_huf != null && sub.amount_huf > 0 && (
                <p className="text-zinc-500 text-xs">{sub.amount_huf.toLocaleString('hu-HU')} Ft/hó</p>
              )}
              {(sub.trial_ends_at || sub.current_period_end) && (
                <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-2 flex items-center gap-1">
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
              <p className="text-zinc-400 text-sm">Nincs előfizetés</p>
              <Link href="/bookly/backstage/subscriptions" className="text-xs text-zinc-400 underline mt-1 inline-block">Létrehozás →</Link>
            </div>
          )}
        </div>

        {/* Bookings stats */}
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
          <p className="text-zinc-400 dark:text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-3">Foglalások</p>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-zinc-900 dark:text-white font-black text-3xl">{totalBookings.totalDocs}</p>
              <p className="text-zinc-400 text-xs mt-0.5">összesen</p>
            </div>
            <div>
              <p className="text-zinc-700 dark:text-zinc-300 font-black text-xl">{monthBookings.totalDocs}</p>
              <p className="text-zinc-400 text-xs mt-0.5">ebben a hónapban</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact + Active toggle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
          <p className="text-zinc-400 dark:text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-3">Elérhetőség</p>
          <div className="space-y-2">
            {salon.phone && (
              <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                <Phone className="h-3.5 w-3.5 text-zinc-400" />{salon.phone}
              </p>
            )}
            {salon.email && (
              <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />{salon.email}
              </p>
            )}
            {salon.website && (
              <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                <Globe className="h-3.5 w-3.5 text-zinc-400" />{salon.website}
              </p>
            )}
            {salon.address && (
              <p className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 text-sm">
                <MapPin className="h-3.5 w-3.5 text-zinc-400" />{salon.address}
              </p>
            )}
            {!salon.phone && !salon.email && !salon.website && !salon.address && (
              <p className="text-zinc-400 text-sm">—</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
          <p className="text-zinc-400 dark:text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-3">Státusz</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-900 dark:text-white text-sm font-medium">Szalon aktív</p>
              <p className="text-zinc-400 text-xs mt-0.5">Látható az ügyfeleknek</p>
            </div>
            <SalonToggle salonId={salon.id} isActive={salon.is_active ?? false} />
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
            <p className="text-zinc-400 dark:text-zinc-600 text-xs">
              Regisztrált: {new Date(salon.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-0.5">Slug: /{salon.slug}</p>
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      {recentBookings.length > 0 && (
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06]">
            <h2 className="text-zinc-900 dark:text-white font-bold text-sm">Legutóbbi foglalások</h2>
          </div>
          <div>
            {recentBookings.map((b, i) => {
              const service = typeof b.service === 'object' ? (b.service as Service) : null
              const showBorder = i < recentBookings.length - 1
              return (
                <div key={b.id} className={`flex items-center justify-between px-5 py-3 ${showBorder ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}>
                  <div>
                    <p className="text-zinc-900 dark:text-white text-sm font-medium">{b.customer_name}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">{service?.name ?? '—'} · {b.date} {b.start_time}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    b.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-500'
                    : b.status === 'cancelled' ? 'bg-red-500/10 text-red-500'
                    : b.status === 'completed' ? 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500'
                    : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {b.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Admin notes */}
      <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
        <p className="text-zinc-400 dark:text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-3">Belső megjegyzés</p>
        <SalonNotesForm salonId={salon.id} initialNotes={salon.admin_notes ?? ''} />
      </div>
    </div>
  )
}
