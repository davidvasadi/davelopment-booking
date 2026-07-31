'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarDays, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from './UserAvatar'
import { notificationVisual, notifDate, timeAgo, type Notification, type DigestMetadata } from '@/lib/useNotifications'

const OCCASION_LABELS: Record<string, string> = {
  birthday: 'Születésnap',
  anniversary: 'Évforduló',
  business: 'Üzleti',
  date: 'Randevú',
  celebration: 'Ünneplés',
}

function occLabel(key: string) {
  return OCCASION_LABELS[key] ?? key
}

/**
 * Bottom sheet a reggeli/esti digest értesítéshez. Helyben nyílik (nem navigál),
 * a „Napi foglalások" gomb visz a foglalás-oldalra.
 */
export function DigestSheet({
  n,
  open,
  onClose,
}: {
  n: Notification
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { Icon, color, bg } = notificationVisual(n.type, n.metadata)
  const meta = n.metadata as DigestMetadata | null
  const isEvening = n.type === 'digest_evening'
  const isRest = n.restaurant != null
  const bookingsHref = isRest ? '/restaurant/bookings' : '/dashboard/bookings'

  function goToBookings() {
    onClose()
    const date = meta?.date
    router.push(date ? `${bookingsHref}?date=${date}` : bookingsHref)
  }

  // Portal mount — SSR-safe (createPortal csak kliens-oldalon)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Sheet — alulról csúszik fel */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-[201] max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(0,0,0,.18)]"
            data-lenis-prevent
          >
        {/* Húzó fül */}
        <div className="sticky top-0 flex justify-center pt-3 pb-1 bg-white">
          <div className="h-[4px] w-10 rounded-full bg-[#e0ddd6]" />
        </div>

        {/* Fejléc */}
        <div className={cn('mx-4 mb-4 rounded-[20px] p-4', isEvening ? 'bg-[#f0f4ff]' : 'bg-[#fffdf0]')}>
          <div className="flex items-start gap-3">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', bg)}>
              <Icon className={cn('h-5 w-5', color)} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-[#2a2620] leading-tight">{n.title}</p>
              <p className="mt-0.5 text-xs text-[#b0ac9e]">
                {notifDate(n.createdAt)}
                <span className="mx-1.5 opacity-40">·</span>
                {timeAgo(n.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#b0ac9e] transition-colors hover:bg-black/[0.06] hover:text-[#3a352a]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Fő statisztikák */}
          {meta && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#2a2620] shadow-[0_1px_4px_rgba(0,0,0,.06)]">
                <CalendarDays className="h-3.5 w-3.5 text-[#8a8779]" />
                {meta.bookings} foglalás
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#2a2620] shadow-[0_1px_4px_rgba(0,0,0,.06)]">
                <Users className="h-3.5 w-3.5 text-[#8a8779]" />
                {meta.guests} fő
              </span>
              {meta.team_count != null && meta.team_count > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#2a2620] shadow-[0_1px_4px_rgba(0,0,0,.06)]">
                  {meta.team_count} munkatárs
                </span>
              )}
            </div>
          )}
        </div>

        <div className="px-4 pb-6 space-y-4">
          {/* Alkalmak — étterem */}
          {meta?.occasions && Object.keys(meta.occasions).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#b0ac9e]">Alkalmak</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(meta.occasions).map(([occ, cnt]) => (
                  <span key={occ} className="inline-flex items-center gap-1.5 rounded-full border border-[#e8e7e2] bg-[#fafaf8] px-3 py-1 text-sm font-medium text-[#3a352a]">
                    {occLabel(occ)}
                    <span className="ml-0.5 tabular-nums text-[#b0ac9e]">· {cnt}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Staff breakdown — szalon */}
          {meta?.staff_breakdown && meta.staff_breakdown.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#b0ac9e]">Munkatársak</p>
              <div className="overflow-hidden rounded-[16px] border border-[#efefef] bg-white">
                {meta.staff_breakdown.map((s, i) => (
                  <div key={s.name} className={cn('flex items-center justify-between px-4 py-3', i > 0 && 'border-t border-[#f4f4f5]')}>
                    <span className="text-sm font-medium text-[#2a2620]">{s.name}</span>
                    <span className="text-sm tabular-nums text-[#9b9788]">{s.bookings} foglalás</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Esti: forrás breakdown */}
          {isEvening && meta?.source && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#b0ac9e]">Foglalás forrása</p>
              <div className="grid grid-cols-3 gap-2">
                {meta.source.walk_in != null && (
                  <div className="rounded-[16px] border border-[#efefef] bg-white px-3 py-3 text-center">
                    <p className="text-xl font-bold tabular-nums text-[#2a2620]">{meta.source.walk_in}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[#b0ac9e]">Beeső</p>
                  </div>
                )}
                {meta.source.phone != null && (
                  <div className="rounded-[16px] border border-[#efefef] bg-white px-3 py-3 text-center">
                    <p className="text-xl font-bold tabular-nums text-[#2a2620]">{meta.source.phone}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[#b0ac9e]">Telefon</p>
                  </div>
                )}
                {meta.source.online != null && (
                  <div className="rounded-[16px] border border-[#efefef] bg-white px-3 py-3 text-center">
                    <p className="text-xl font-bold tabular-nums text-[#2a2620]">{meta.source.online}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[#b0ac9e]">Online</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Esti: státusz */}
          {isEvening && meta?.status && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#b0ac9e]">Státusz</p>
              <div className="flex gap-3">
                {meta.status.completed != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F6EF] px-3 py-1.5 text-sm font-semibold text-[#1D9D63]">
                    ✓ {meta.status.completed} teljesült
                  </span>
                )}
                {meta.status.cancelled != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBE9E7] px-3 py-1.5 text-sm font-semibold text-[#C0392B]">
                    ✕ {meta.status.cancelled} lemondva
                  </span>
                )}
                {meta.status.no_show != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f4f5] px-3 py-1.5 text-sm font-semibold text-[#9b9788]">
                    ? {meta.status.no_show} nem jött
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Műszak vezető */}
          {meta?.shift_manager && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#b0ac9e]">Műszak vezető</p>
              <div className="flex items-center gap-3 rounded-[16px] border border-[#efefef] bg-white px-4 py-3">
                <UserAvatar name={meta.shift_manager.name} src={meta.shift_manager.avatar_url ?? null} size={36} />
                <span className="text-sm font-semibold text-[#2a2620]">{meta.shift_manager.name}</span>
              </div>
            </div>
          )}

          {/* CTA — foglalások oldal */}
          <button
            type="button"
            onClick={goToBookings}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#1d1c19] px-4 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Napi foglalások megtekintése
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
