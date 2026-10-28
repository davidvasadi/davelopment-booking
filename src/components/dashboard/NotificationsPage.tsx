'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Settings2, X } from 'lucide-react'
import { ApprovalActions, isAwaitingApproval } from './ApprovalActions'
import { cn } from '@/lib/utils'
import { OPEN_DIGEST_EVENT } from './DigestAutoPopup'
import { OPEN_BROADCAST_EVENT } from './BroadcastAutoPopup'
import { listStagger, pageTransition, sheetSpring, SHEET_MOBILE } from '@/lib/motion'
import {
  useNotifications,
  notifDate,
  timeAgo,
  notificationVisual,
  type Notification,
  type DigestMetadata,
} from '@/lib/useNotifications'
import { PersonalNotifPrefsCard } from '@/components/settings/PersonalNotifPrefsCard'

export function NotificationsPage() {
  const { groups, items, remove, markRead, clearAll, openItem, reload } = useNotifications()
  const [tab, setTab] = useState<'inbox' | 'settings'>('inbox')
  // MOBIL: a Beérkező úgyis végig látszik alattuk — a Beállítások egy alulról felcsúszó bottom
  // sheetben jelenik meg fölötte (ua. minta, mint a Beállítások oldal nav-jánál), nem egy külön tab.
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])
  // A mobil fejléc SlidersHorizontal ikonja (DashboardNav) ezt az eventet dispatch-eli.
  useEffect(() => {
    const handler = () => setSettingsSheetOpen(true)
    window.addEventListener('davelopment:open-notifications-tabs', handler)
    return () => window.removeEventListener('davelopment:open-notifications-tabs', handler)
  }, [])

  return (
    <motion.div
      {...pageTransition}
      className="mx-auto max-w-xl px-4 py-8 min-h-[calc(100dvh-220px)] lg:min-h-[calc(100vh-180px)]"
    >
      {/* Fejléc */}
      <div className="mb-5 flex items-center gap-3">
        <h1 className="flex flex-1 items-center gap-2.5 text-2xl font-bold text-ink">
          Értesítések
          <AnimatePresence>
            {tab === 'inbox' && items.length > 0 && (
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
          {tab === 'inbox' && items.length > 0 && (
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

      {/* Tab-váltó — DESKTOP: inline pillek. MOBIL: a fejléc SlidersHorizontal ikonja közvetlenül átvált (nincs extra picker, a Beérkező úgyis végig látszik). */}
      <div className="mb-6 hidden gap-2 lg:flex">
        <button
          type="button"
          onClick={() => setTab('inbox')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors',
            tab === 'inbox' ? 'bg-ink-dark text-white' : 'bg-white/70 text-ink-soft hover:bg-white',
          )}
        >
          <Bell className="h-3.5 w-3.5" strokeWidth={2} />
          Beérkező
        </button>
        <button
          type="button"
          onClick={() => setTab('settings')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors',
            tab === 'settings' ? 'bg-ink-dark text-white' : 'bg-white/70 text-ink-soft hover:bg-white',
          )}
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
          Beállítások
        </button>
      </div>

      {/* MOBIL: Beállítások bottom sheet (portálon keresztül, a fejléc ikonja nyitja — ua. minta, mint a Beállítások oldal nav-jánál). */}
      {isMounted && createPortal(
        <AnimatePresence>
          {settingsSheetOpen && (
            <div className="fixed inset-0 z-[160] lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 bg-ink-dark/40 backdrop-blur-sm"
                onClick={() => setSettingsSheetOpen(false)}
              />
              <motion.div
                variants={SHEET_MOBILE}
                initial="hidden"
                animate="show"
                exit="exit"
                data-lenis-prevent
                className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom,16px)]"
              >
                <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-3">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">Értesítési preferenciák</span>
                    <button
                      type="button"
                      onClick={() => setSettingsSheetOpen(false)}
                      aria-label="Bezárás"
                      className="hidden h-8 w-8 sm:flex items-center justify-center rounded-full bg-[#F4F2EC] text-ink-soft transition-opacity hover:opacity-70"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="px-4 pb-5">
                  <p className="mb-4 text-[12.5px] text-ink-soft2">
                    Válaszd ki, milyen típusú értesítéseket kívánsz kapni.
                  </p>
                  <PersonalNotifPrefsCard />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <AnimatePresence mode="wait">

        {/* ── Beállítások tab ── */}
        {tab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.14 } }}
          >
            <div className="rounded-[22px] dav-card-glass p-5">
              <div className="mb-1 text-[15px] font-semibold text-ink">Értesítési preferenciák</div>
              <p className="mb-4 text-[12.5px] text-ink-soft2">
                Válaszd ki, milyen típusú értesítéseket kívánsz kapni.
              </p>
              <PersonalNotifPrefsCard />
            </div>
          </motion.div>
        )}

        {/* ── Beérkező tab — üres állapot ── */}
        {tab === 'inbox' && items.length === 0 && (
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
        )}

        {/* ── Beérkező tab — lista ── */}
        {tab === 'inbox' && items.length > 0 && (
          <motion.div
            key="list"
            variants={listStagger.container}
            initial="hidden"
            animate="show"
            className="space-y-5"
          >
            {groups.map(({ label, rows }) => (
              <motion.section key={label} variants={listStagger.item} aria-label={label}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft2">{label}</p>
                  <div className="h-px flex-1 bg-line" />
                  <span className="text-[11px] font-medium tabular-nums text-ink-soft2">{rows.length}</span>
                </div>
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
                          : n.type === 'admin_broadcast'
                            ? <FullNotifRow n={n} onOpen={() => { if (!n.read) markRead(n.id); window.dispatchEvent(new CustomEvent(OPEN_BROADCAST_EVENT, { detail: n })) }} onRemove={() => remove(n.id)} />
                            : <FullNotifRow n={n} onOpen={() => openItem(n)} onRemove={() => remove(n.id)} onHandled={() => { if (!n.read) markRead(n.id); void reload() }} />}
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

function FullNotifRow({ n, onOpen, onRemove, onHandled }: {
  n: Notification; onOpen: () => void; onRemove: () => void; onHandled?: () => void
}) {
  const { Icon, color } = notificationVisual(n.type, n.metadata)
  const isUnread = !n.read

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3.5 px-4 py-4 transition-colors hover:bg-black/[0.018]',
      )}
    >
      {/* Ikon — semleges kör, csak a jel színes (a típust az ikon színe mutatja) */}
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4F4F4]">
        <Icon className={cn('h-[18px] w-[18px]', color)} strokeWidth={2.2} />
      </span>

      {/* Tartalom */}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={cn('flex items-center gap-2 text-sm text-ink', isUnread ? 'font-semibold' : 'font-medium')}>{n.title}{isUnread && <span aria-label="Olvasatlan" className="h-2 w-2 shrink-0 rounded-full bg-gold" />}</p>
        {n.body && (
          <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{n.body}</p>
        )}
        <p className="mt-1.5 text-[11px] text-ink-soft2">
          {notifDate(n.createdAt)}
          <span className="mx-1.5 opacity-40">·</span>
          {timeAgo(n.createdAt)}
        </p>
        {isAwaitingApproval(n) && (
          <ApprovalActions n={n} onHandled={onHandled} />
        )}
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
  const { Icon, color } = notificationVisual(n.type, n.metadata)
  const meta = n.metadata as DigestMetadata | null
  const isEvening = n.type === 'digest_evening'
  const isUnread = !n.read

  function openSheet() {
    if (isUnread) onMarkRead()
    window.dispatchEvent(new CustomEvent(OPEN_DIGEST_EVENT, { detail: n }))
  }

  return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`${n.title} — részletek megnyitása`}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? openSheet() : undefined}
        onClick={openSheet}
        className={cn(
          'group relative cursor-pointer px-4 py-4 transition-colors select-none hover:bg-black/[0.018]',
        )}
      >
        <div className="flex items-start gap-3.5">
          {/* Ikon — semleges kör, csak a jel színes */}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4F4F4]">
            <Icon className={cn('h-[18px] w-[18px]', color)} strokeWidth={2.2} />
          </span>

          {/* Szöveg */}
          <div className="min-w-0 flex-1">
            <p className={cn('flex items-center gap-2 text-sm text-ink', isUnread ? 'font-semibold' : 'font-medium')}>{n.title}{isUnread && <span aria-label="Olvasatlan" className="h-2 w-2 shrink-0 rounded-full bg-gold" />}</p>
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
  )
}
