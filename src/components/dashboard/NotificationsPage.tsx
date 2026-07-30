'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DigestSheet } from './DigestSheet'
import { listStagger, pageTransition, sheetSpring } from '@/lib/motion'
import {
  useNotifications,
  notifDate,
  timeAgo,
  notificationVisual,
  type Notification,
  type DigestMetadata,
} from '@/lib/useNotifications'

export function NotificationsPage() {
  const { groups, items, remove, markRead, clearAll, openItem } = useNotifications()

  return (
    <motion.div
      {...pageTransition}
      className="mx-auto max-w-xl px-4 py-8 min-h-[calc(100dvh-220px)] lg:min-h-[calc(100vh-180px)]"
    >
      {/* Fejléc */}
      <div className="mb-7 flex items-center gap-3">
        <h1 className="flex flex-1 items-center gap-2.5 text-2xl font-bold text-ink">
          Értesítések
          <AnimatePresence>
            {items.length > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-2 text-sm font-bold text-ink-dark"
              >
                {items.length}
              </motion.span>
            )}
          </AnimatePresence>
        </h1>
        <AnimatePresence>
          {items.length > 0 && (
            <motion.button
              key="clear"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              type="button"
              onClick={clearAll}
              className="text-sm font-medium text-ink-soft2 transition-colors hover:text-ink"
            >
              Összes törlése
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Lista vagy üres állapot */}
      <AnimatePresence mode="wait">
        {items.length === 0 ? (
          <motion.div
            key="empty"
            {...sheetSpring}
            className="flex flex-col items-center gap-4 py-24 text-center"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f3ef]">
              <Bell className="h-7 w-7 text-ink-soft2" strokeWidth={1.4} />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink-soft">Nincs értesítés</p>
              <p className="mt-1 text-sm text-ink-soft2">Foglalások és rendszer-események megjelennek itt</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            variants={listStagger.container}
            initial="hidden"
            animate="show"
            className="space-y-5"
          >
            {groups.map(({ label, rows }) => (
              <motion.section key={label} variants={listStagger.item} aria-label={label}>
                {/* Csoport-fejléc */}
                <div className="mb-2 flex items-center gap-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft2">{label}</p>
                  <div className="h-px flex-1 bg-line" />
                  <span className="text-[11px] font-medium tabular-nums text-ink-soft2">{rows.length}</span>
                </div>

                {/* Kártya */}
                <div className="dav-card-glass overflow-hidden rounded-[22px]" role="list">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {rows.map((n, i) => (
                      <motion.div
                        key={n.id}
                        role="listitem"
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden', paddingTop: 0, paddingBottom: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {i > 0 && <div className="mx-4 h-px bg-line/60" />}
                        {n.type === 'digest_morning' || n.type === 'digest_evening'
                          ? <FullDigestCard n={n} onMarkRead={() => markRead(n.id)} onRemove={() => remove(n.id)} />
                          : <FullNotifRow n={n} onOpen={() => openItem(n)} onRemove={() => remove(n.id)} />}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.section>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── Egyszerű értesítés-sor ────────────────────────────────────────────── */

function FullNotifRow({ n, onOpen, onRemove }: {
  n: Notification; onOpen: () => void; onRemove: () => void
}) {
  const { Icon, color, bg } = notificationVisual(n.type)
  const isUnread = !n.read

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3.5 px-4 py-4 transition-colors',
        isUnread ? 'bg-gold/[0.035]' : 'hover:bg-black/[0.018]',
      )}
    >
      {/* Olvasatlan jelző */}
      {isUnread && (
        <span
          aria-label="Olvasatlan"
          className="absolute left-0 top-0 h-full w-[3px] rounded-r-full bg-gold opacity-80"
        />
      )}

      {/* Ikon */}
      <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full', bg)}>
        <Icon className={cn('h-[18px] w-[18px]', color)} strokeWidth={2.2} />
      </span>

      {/* Tartalom */}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={cn('text-sm text-ink', isUnread ? 'font-semibold' : 'font-medium')}>{n.title}</p>
        {n.body && (
          <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{n.body}</p>
        )}
        <p className="mt-1.5 text-[11px] text-ink-soft2">
          {notifDate(n.createdAt)}
          <span className="mx-1.5 opacity-40">·</span>
          {timeAgo(n.createdAt)}
        </p>
      </button>

      {/* Törlés — mobilon halvány, desktopOn hover-re látszik */}
      <button
        type="button"
        aria-label="Értesítés törlése"
        onClick={onRemove}
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft2 opacity-40 transition-all hover:bg-black/[0.06] hover:text-ink hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ── Digest kártya (reggeli / esti összefoglaló) ────────────────────────── */

function FullDigestCard({ n, onMarkRead, onRemove }: {
  n: Notification; onMarkRead: () => void; onRemove: () => void
}) {
  const { Icon, color, bg } = notificationVisual(n.type)
  const meta = n.metadata as DigestMetadata | null
  const isEvening = n.type === 'digest_evening'
  const isUnread = !n.read
  const [sheetOpen, setSheetOpen] = useState(false)

  function openSheet() {
    if (isUnread) onMarkRead()
    setSheetOpen(true)
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${n.title} — részletek megnyitása`}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? openSheet() : undefined}
        onClick={openSheet}
        className={cn(
          'group relative cursor-pointer px-4 py-4 transition-colors select-none',
          isEvening ? 'bg-[#f0f5ff]/60 hover:bg-[#e8efff]/70' : 'bg-[#fffdf0]/70 hover:bg-[#fffbe8]/80',
          isUnread && 'ring-l',
        )}
      >
        {/* Olvasatlan jelző */}
        {isUnread && (
          <span className="absolute left-0 top-0 h-full w-[3px] rounded-r-full bg-gold opacity-80" />
        )}

        <div className="flex items-start gap-3.5">
          {/* Ikon */}
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', bg)}>
            <Icon className={cn('h-[18px] w-[18px]', color)} strokeWidth={2.2} />
          </span>

          {/* Szöveg */}
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm text-ink', isUnread ? 'font-semibold' : 'font-medium')}>{n.title}</p>
            <p className="mt-0.5 text-[11px] text-ink-soft2">
              {notifDate(n.createdAt)}
              <span className="mx-1.5 opacity-40">·</span>
              {timeAgo(n.createdAt)}
            </p>
            {meta && (
              <p className="mt-1.5 text-sm text-ink-soft">
                <span className="font-medium text-ink">{meta.bookings}</span> foglalás
                {' · '}
                <span className="font-medium text-ink">{meta.guests}</span> fő
                {meta.team_count ? (
                  <> · <span className="font-medium text-ink">{meta.team_count}</span> munkatárs</>
                ) : null}
                {isEvening && meta.status?.completed != null ? (
                  <> · <span className="font-medium text-[#1D9D63]">{meta.status.completed} teljesült</span></>
                ) : null}
              </p>
            )}
          </div>

          {/* Törlés */}
          <button
            type="button"
            aria-label="Értesítés törlése"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft2 opacity-40 transition-all hover:bg-black/[0.06] hover:text-ink hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* "Részletek" hint — csak desktopOn */}
        <p className="mt-2 hidden text-[11px] font-medium text-ink-soft2 sm:block">
          Kattints a részletekért →
        </p>
      </div>

      <DigestSheet n={n} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
