import Link from 'next/link'
import { getOwnedSalon } from '@/lib/salonContext'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getPayloadClient } from '@/lib/payload'
import { formatPrice } from '@/lib/utils'
import { getDashboardStats } from '@/lib/dashboardStats'
import { StoreSwitcher } from '@/components/dashboard/StoreSwitcher'
import BookingActions from '@/components/dashboard/BookingActions'
import { CARD, HeroKpi, StatusPill, CardIcon, Dashed, AccRow } from '@/components/dashboard/overview-ui'
import { CalendarDays, Banknote, CheckCircle2, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import type { Booking, Service, StaffMember, Media } from '@/payload/payload-types'

export default async function DashboardPage() {
  const [{ salon }, user] = await Promise.all([getOwnedSalon(), getCurrentUser()])
  const payload = await getPayloadClient()

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const hour = now.getHours()
  const nowHM = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const todayLabel = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })

  const logoUrl = salon.logo && typeof salon.logo === 'object' ? (salon.logo as Media).url ?? null : null
  const coverUrl = salon.cover_image && typeof salon.cover_image === 'object' ? (salon.cover_image as Media).url ?? null : null
  const { active, businesses } = user ? await getActiveBusiness(user) : { active: null, businesses: [] }

  const [stats, todayAll] = await Promise.all([
    getDashboardStats(salon.id),
    payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { equals: today } }] },
      sort: 'start_time',
      depth: 2,
      limit: 100,
      overrideAccess: true,
    }),
  ])

  const all = todayAll.docs as Booking[]
  const activeBookings = all.filter((b) => b.status !== 'cancelled')
  const fromNow = activeBookings.filter((b) => (b.start_time ?? '') >= nowHM)
  const upcoming = (fromNow.length > 0 ? fromNow : activeBookings).slice(0, 6)

  // ── Státusz-csík ──
  const total = all.length || 1
  const confirmedCount = all.filter((b) => b.status === 'confirmed').length
  const pendingCount = all.filter((b) => b.status === 'pending').length
  const completedCount = all.filter((b) => b.status === 'completed').length
  const confirmedPct = Math.round((confirmedCount / total) * 100)
  const pendingPct = Math.round((pendingCount / total) * 100)
  const completedPct = Math.round((completedCount / total) * 100)

  // ── Heti oszlopdiagram (utolsó 7 nap) ──
  const week = stats.trend.slice(-7)
  const weekMax = Math.max(1, ...week.map((d) => d.bookings))
  const weekTotal = week.reduce((s, d) => s + d.bookings, 0)
  const peakIdx = week.reduce((mi, d, i, a) => (d.bookings > a[mi].bookings ? i : mi), 0)

  // ── Teljesítés donut ──
  const R = 62
  const CIRC = 2 * Math.PI * R
  const donutOffset = CIRC * (1 - stats.completionRate / 100)

  return (
    <div className="space-y-6 p-5 lg:p-0">
      {/* ── HERO ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[15px] text-ink-soft">Üdv újra,</p>
          <h1 className="mt-0.5 text-4xl lg:text-[46px] font-light tracking-[-0.02em] text-ink leading-[1.05]">{salon.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <div className="flex gap-1 rounded-2xl border border-line bg-[var(--dav-glass)] p-1">
              <span className="rounded-xl bg-ink-dark px-4 py-1.5 text-[13px] font-semibold text-white">Szalon</span>
              <span className="rounded-xl px-4 py-1.5 text-[13px] font-medium text-ink-soft2">Étterem</span>
            </div>
            <StoreSwitcher name={salon.name} logoUrl={logoUrl} businesses={businesses} activeKey={active ? `${active.type}:${active.id}` : null} />
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          <HeroKpi icon={CalendarDays} value={String(stats.bookingsToday)} label="Mai foglalás" />
          <HeroKpi icon={Banknote} value={formatPrice(stats.revenueToday, 'HUF')} label="Mai bevétel" />
          <HeroKpi icon={CheckCircle2} value={`${stats.completionRate}%`} label="Teljesítés" />
        </div>
      </div>

      {/* ── STÁTUSZ-CSÍK ── */}
      <div className="flex flex-wrap items-end gap-2.5 sm:flex-nowrap">
        <StatusPill label="Megerősített" value={`${confirmedPct}%`} className="bg-ink-dark text-white" />
        <StatusPill label="Függő" value={`${pendingPct}%`} className="bg-gold text-ink-dark" />
        <div className="order-last min-w-0 flex-1 basis-full sm:order-none sm:basis-0">
          <p className="mb-2 text-xs font-medium text-ink-soft">Mai nap</p>
          <div className="h-11 rounded-[21px] border border-line-strong" style={{ background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)' }} />
        </div>
        <StatusPill label="Befejezett" value={`${completedPct}%`} className="border border-line-strong text-ink-soft2" />
      </div>

      {/* ── BENTO ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:grid-rows-[354px_286px]">

        {/* Borító */}
        <div className="relative min-h-[240px] overflow-hidden rounded-[26px] lg:col-start-1 lg:row-start-1" style={{ background: 'linear-gradient(160deg,#8f8a82,#3f3c37)' }}>
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={salon.name} className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 44%, rgba(0,0,0,.6) 100%)' }} />
          <div className="absolute inset-x-5 bottom-5 min-h-[200px] lg:min-h-0">
            <div className="text-[22px] font-medium tracking-[-0.01em] text-white">Ma</div>
            <div className="mt-2 flex items-center justify-between gap-2.5">
              <div className="text-[13px] text-white/70">{stats.bookingsToday} foglalás</div>
              <div className="whitespace-nowrap rounded-[18px] border-[1.5px] border-gold/90 px-3.5 py-2 text-[13px] font-semibold text-gold">{formatPrice(stats.revenueToday, 'HUF')}</div>
            </div>
          </div>
        </div>

        {/* Foglalások — heti oszlop */}
        <div className={`${CARD} flex flex-col p-[22px] lg:col-start-2 lg:row-start-1`}>
          <div className="flex items-start justify-between">
            <div className="text-[19px] font-medium text-ink">Foglalások</div>
            <CardIcon />
          </div>
          <div className="mt-3 flex items-baseline gap-2.5">
            <div className="text-[38px] font-light tracking-[-0.02em] text-ink">{weekTotal}</div>
            <div className="text-xs leading-tight text-ink-soft">foglalás<br />ezen a héten</div>
          </div>
          <div className="mt-2 flex flex-1 items-end gap-1">
            {week.map((d, i) => {
              const h = Math.max(8, Math.round((d.bookings / weekMax) * 88))
              const peak = i === peakIdx && d.bookings > 0
              return (
                <div key={i} className="relative flex flex-1 flex-col items-center gap-2">
                  {peak && <span className="absolute -top-7 whitespace-nowrap rounded-[9px] bg-gold px-2.5 py-1 text-[11px] font-semibold text-ink-dark">{d.bookings}</span>}
                  <div className="w-[9px] rounded-md" style={{ height: h, background: peak ? 'var(--dav-accent)' : '#26241F' }} />
                  <span className={`text-[11px] ${peak ? 'font-semibold text-ink' : 'font-medium text-[#A8A496]'}`}>{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Teljesítés donut */}
        <div className={`${CARD} flex flex-col p-[22px] lg:col-start-3 lg:row-start-1`}>
          <div className="flex items-start justify-between">
            <div className="text-[19px] font-medium text-ink">Teljesítés</div>
            <CardIcon />
          </div>
          <div className="relative flex flex-1 items-center justify-center">
            <svg width="150" height="150" viewBox="0 0 158 158">
              <circle cx="79" cy="79" r={R} fill="none" stroke="#EEEAD8" strokeWidth="15" />
              <circle cx="79" cy="79" r={R} fill="none" stroke="var(--dav-accent)" strokeWidth="15" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={donutOffset} transform="rotate(-90 79 79)" />
            </svg>
            <div className="absolute text-center">
              <div className="text-[36px] font-light tracking-[-0.02em] text-ink">{stats.completionRate}%</div>
              <div className="mt-0.5 text-xs text-ink-soft">teljesítési arány</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6">
            <div className="text-center"><div className="text-base font-semibold text-ink">{stats.bookingsToday}</div><div className="text-[11px] text-[#A8A496]">foglalás ma</div></div>
            <div className="h-[26px] w-px bg-line-strong" />
            <div className="text-center"><div className="text-base font-semibold text-ink">{formatPrice(stats.avgBookingValue, 'HUF')}</div><div className="text-[11px] text-[#A8A496]">átlag érték</div></div>
          </div>
        </div>

        {/* Mai feladatok — PLACEHOLDER */}
        <div className="flex flex-col rounded-[26px] bg-ink-dark p-[22px] text-white shadow-[0_20px_44px_-26px_rgba(40,35,15,.5)] lg:col-start-4 lg:row-start-1 lg:row-span-2">
          <div className="flex items-center justify-between gap-2.5">
            <div className="text-[19px] font-medium">Mai feladatok</div>
            <div className="whitespace-nowrap text-2xl font-light">0<span className="text-white/40">/0</span></div>
          </div>
          <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
            <Clock className="h-8 w-8 text-white/20" />
            <p className="mt-3 text-sm text-white/45">A feladatkezelő hamarosan</p>
            <p className="mt-1 text-xs text-white/30">Napi teendők a csapatnak</p>
          </div>
        </div>

        {/* Részletek-akkordeon */}
        <div className={`${CARD} flex flex-col px-[22px] py-1 lg:col-start-1 lg:row-start-2`}>
          <AccRow label="Nyitvatartás" />
          <Dashed />
          <div className="py-2.5">
            <div className="flex items-center justify-between"><span className="text-[15px] font-semibold text-ink">Mai bevétel</span><ChevronDown className="h-4 w-4 rotate-180 text-ink-soft" /></div>
            <div className="flex items-end gap-2 pb-1 pt-0.5">
              <div className="text-[30px] font-light tracking-[-0.02em] text-ink">{formatPrice(stats.revenueToday, 'HUF')}</div>
              {stats.revenueTodayDiff !== 0 && (
                <div className={`ml-auto pb-1.5 text-xs font-semibold ${stats.revenueTodayDiff >= 0 ? 'text-[#1D9D63]' : 'text-bad'}`}>{stats.revenueTodayDiff >= 0 ? '+' : ''}{stats.revenueTodayDiff}%</div>
              )}
            </div>
          </div>
          <Dashed />
          <AccRow label="Szolgáltatások" />
          <Dashed />
          <AccRow label="Munkatársak" />
        </div>

        {/* Mai idővonal */}
        <div className={`${CARD} flex flex-col p-[22px] lg:col-start-2 lg:col-span-2 lg:row-start-2`}>
          <div className="flex items-center justify-between gap-2">
            <span className="shrink-0 rounded-[18px] bg-[#F4F0E2] px-3 py-1.5 text-xs font-medium text-ink-soft sm:px-3.5 sm:text-[13px]">Tegnap</span>
            <span className="truncate text-center text-sm font-medium text-ink sm:text-base">Ma · {todayLabel}</span>
            <span className="shrink-0 rounded-[18px] bg-[#F4F0E2] px-3 py-1.5 text-xs font-medium text-ink-soft sm:px-3.5 sm:text-[13px]">Holnap</span>
          </div>
          <div className="mt-3 flex-1 divide-y divide-line">
            {upcoming.length === 0 ? (
              <div className="flex h-full items-center justify-center py-10 text-sm text-ink-soft">Nincs több mai foglalás</div>
            ) : (
              upcoming.map((b) => {
                const service = b.service as Service | null
                const staff = b.staff as StaffMember | null
                return (
                  <div key={b.id} className="flex items-center gap-3 py-3">
                    <span className="w-12 shrink-0 font-mono text-sm font-bold text-ink-soft">{b.start_time}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{b.customer_name}</p>
                      <p className="truncate text-xs text-ink-soft">
                        {typeof service === 'object' && service ? service.name : '—'}
                        {typeof staff === 'object' && staff ? ` · ${staff.name}` : ''}
                      </p>
                    </div>
                    <BookingActions bookingId={b.id} status={b.status} />
                  </div>
                )
              })
            )}
          </div>
          <Link href="/dashboard/bookings" className="group mt-2 flex items-center justify-center gap-1.5 border-t border-line pt-3 text-sm font-semibold text-ink-soft2 hover:text-ink">
            Összes foglalás
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
