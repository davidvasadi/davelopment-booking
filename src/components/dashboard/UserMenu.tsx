'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Bell, LogOut, CreditCard, Settings, X, Check, Loader2, ArrowRight, ArrowUpRight, Globe, Plus, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, IconButton, IconCircle, Pill, Segmented, SheetHandle, MarqueeText } from '@/components/ui-kit'
import { UserAvatar } from './UserAvatar'
import { useNotifications, timeAgo, notifDate, notificationVisual, type Notification, type DigestMetadata } from '@/lib/useNotifications'
import { OPEN_DIGEST_EVENT } from './DigestAutoPopup'
import { OPEN_BROADCAST_EVENT } from './BroadcastAutoPopup'
import type { SwitcherBusiness } from './switcherTypes'
import type { Capability } from '@/lib/permissions'
import { ApprovalActions, isAwaitingApproval } from './ApprovalActions'
import { useExclusivePopover } from '@/lib/exclusivePopover'

/** A panel gyerek-elemeinek „folyami" belépője (a genie-spring stagger alá). */
const PANEL_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
} as const

/**
 * A fejléc jobb oldala: csengő (sárga pötty, ha van olvasatlan) és avatar. A csengő az Értesítések
 * panelt (/design 17.2), az avatar a Fiók menüt (17.1) nyitja — desktopon a gomb alatt,
 * mobilon alulról felcsúszó lapon.
 */
export function UserMenu({
  name,
  email,
  avatarUrl,
  subscriptionHref,
  settingsHref,
  showPartner = false,
  hideAvatar = false,
  publicUrl,
  businesses = [],
  activeBusinessKey = null,
  capabilities,
  approvals = true,
  notificationsHref,
  trialDaysLeft,
}: {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  /** Linkek a fiók-popover gyorsmenüjéhez (előfizetés + beállítások/számlázás). */
  subscriptionHref?: string
  settingsHref?: string
  /** a sárga „Partnerprogram” sor — csak a tulajnak */
  showPartner?: boolean
  /** a fiók-avatar elrejtése (a csengő marad) — ahol a fejlécben az oldal eszközeinek kell a hely */
  hideAvatar?: boolean
  /** Nyilvános oldal URL — a fiók-menübe (davelopment-design: a top-navból ide került). */
  publicUrl?: string
  /** Összes fiók-üzlet (üzletváltóhoz) — csak ha 2+ üzlet van. */
  businesses?: SwitcherBusiness[]
  activeBusinessKey?: string | null
  /** Effektív képesség-halmaz — eldönti, hogy a settings/billing gyorslinkek látszanak-e. */
  capabilities?: Capability[]
  /** a csengőben a „Jóváhagyás” fül (foglalás-jóváhagyás) — a Backstage-ben nincs mit jóváhagyni */
  approvals?: boolean
  /** Teljes értesítési oldal linkje — a panel fejlécének nyíl gombja ide navigál. */
  notificationsHref?: string
  /** Próbaidőszakban hátralévő napok — ha meg van adva, badge jelenik meg az Előfizetés menüpont mellett. */
  trialDaysLeft?: number
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  useExclusivePopover(open, () => setOpen(false))
  const anchorRef = useRef<HTMLDivElement>(null)
  // A popovert a body-ra portáljuk (a sidebar overflow-ja különben levágja).
  // `sheet`: mobilon (lg alatt) alulról felcsúszó lap a design szerint (17.1, 17.2) — ilyenkor nincs pozíció
  const [pos, setPos] = useState<{ left: number; top?: number; sheet?: boolean } | null>(null)
  // A csengő ÉRTESÍTÉSEKET, az avatar FIÓK-menüt nyit — külön tartalom, nem ugyanaz.
  const [mode, setMode] = useState<'account' | 'notifications'>('account')

  const { items, unread, groups, remove, markRead, openItem, reload } = useNotifications(() => setOpen(false))
  // a design (17.2) fül-váltója: Mind / Jóváhagyás (csak a jóváhagyásra váró foglalások)
  const [onlyApproval, setOnlyApproval] = useState(false)
  const shownGroups = onlyApproval ? groups.map((g) => ({ ...g, rows: g.rows.filter((n) => isAwaitingApproval(n) && n.target_status === 'pending') })).filter((g) => g.rows.length > 0) : groups
  const markAllRead = () => { for (const n of items) if (!n.read) void markRead(n.id) }

  const canSettings = !capabilities || capabilities.includes('settings.profile')
  const canBilling = !capabilities || capabilities.includes('billing.manage')
  const partnerHref = showPartner && settingsHref && /^\/(dashboard|restaurant)\/settings/.test(settingsHref) ? settingsHref.replace(/\/settings.*$/, '/partnerprogram') : undefined

  useEffect(() => setMounted(true), [])

  function positionPanel(m: 'account' | 'notifications') {
    if (!anchorRef.current) return
    if (window.innerWidth < 1024) { setPos({ left: 0, sheet: true }); return }
    const r = anchorRef.current.getBoundingClientRect()
    // a design szerint a fiók-menü 300, az értesítések 400 px széles (kisebb kijelzőn a képernyőhöz igazodik)
    const PANEL_W = Math.min(m === 'notifications' ? 400 : 300, window.innerWidth - 32)
    const EDGE_MARGIN = 16
    const left = Math.min(Math.max(EDGE_MARGIN, r.right - PANEL_W), window.innerWidth - PANEL_W - EDGE_MARGIN)
    setPos({ left, top: r.bottom + 8 })
  }

  // Ugyanarra a gombra kattintva zár; másik gombra vált (a panel nyitva marad, csak a tartalom vált).
  function openMenu(m: 'account' | 'notifications') {
    if (open && mode === m) { setOpen(false); return }
    setMode(m)
    positionPanel(m)
    if (!open) setOpen(true)
  }

  // Az avatar-feltöltés + profil-szerkesztés a Beállítások › Saját profil fülön él (SelfProfileView),
  // így nincs itt duplikált feltöltő-logika.

  const [switching, setSwitching] = useState<string | null>(null)

  async function switchBusiness(b: SwitcherBusiness) {
    const key = `${b.type}:${b.id}`
    if (key === activeBusinessKey || switching) return
    setSwitching(key)
    try {
      const res = await fetch('/api/business/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: b.type, id: b.id }),
      })
      const data = (await res.json().catch(() => null)) as { redirectTo?: string } | null
      if (res.ok && data?.redirectTo) {
        setOpen(false)
        router.push(data.redirectTo)
        router.refresh()
      }
    } finally {
      setSwitching(null)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/signout-payload', { method: 'POST', credentials: 'include' })
    router.push('/login')
    toast.success('Kijelentkezve')
  }

  return (
    <div ref={anchorRef} className="flex items-center gap-1.5">
        <>
          {/* Csengő — a kit 48px üveg ikon-gombja, sárga pöttyel, ha van olvasatlan értesítés */}
          <IconButton icon={Bell} label="Értesítések" size="lg" dot={unread > 0} aria-expanded={open} onClick={() => openMenu('notifications')} className="hover:bg-white" />
          {/* Avatar — kattintásra nyílik a fiók-menü */}
          {!hideAvatar && <motion.button type="button" onClick={() => openMenu('account')} aria-label="Fiók" aria-expanded={open} whileTap={{ scale: 0.86 }} transition={{ type: 'spring', stiffness: 520, damping: 14 }} className="shrink-0 rounded-full outline-none">
            <UserAvatar name={name} src={avatarUrl} size={48} />
          </motion.button>}
        </>

      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              {/* Háttér: desktopon átlátszó (csak a kattintásra zárást fogja meg, a design szerint nincs elmosás); mobilon a lap mögött sötétít, mint a kit Overlay-e. */}
              <motion.div
                key="um-backdrop"
                className={cn('fixed inset-0 z-[99]', pos.sheet && 'backdrop-blur-sm')}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              />
              {/* Panel — erős iOS-„genie" spring: nagy scale-ugrás + overshoot,
                  a triggerből kinőve; a gyerekek staggerrel folyanak be. */}
              <motion.div
                key="um-panel"
                variants={{
                  hidden: pos.sheet ? { opacity: 0, scale: 0.86, y: 70 } : { opacity: 0, scale: 0.7, y: -14 },
                  show: {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: { type: 'spring', stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.035, delayChildren: 0.06 },
                  },
                  exit: pos.sheet ? { opacity: 0, y: 40, transition: { duration: 0.14, ease: 'easeIn' } } : { opacity: 0, scale: 0.9, y: -8, transition: { duration: 0.14, ease: 'easeIn' } },
                }}
                initial="hidden"
                animate="show"
                exit="exit"
                // Korábban nem volt max-magasság: hosszú listánál (fiók mód — sok gyorslink
                // + üzletváltó) a panel a KÉPERNYŐ TELJES magasságát kitöltötte, nem hagyva
                // látható/kattintható hátteret a bezáráshoz. Most max-h + saját görgetés.
                data-lenis-prevent
                className={cn('fixed z-[100] overflow-y-auto overscroll-contain bg-white p-2 shadow-ui-popup', pos.sheet ? 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-ui-card px-3 pb-6' : cn('max-h-[min(80vh,600px)] max-w-[calc(100vw-2rem)] rounded-ui-card', mode === 'notifications' ? 'w-[400px]' : 'w-[300px]'))}
                style={pos.sheet ? { transformOrigin: 'bottom center' } : { left: pos.left, top: pos.top, transformOrigin: 'top right' }}
              >
          {pos.sheet && <SheetHandle className="pb-3 pt-1" />}
          {/* ── FIÓK mód (avatar) — profil + gyorslinkek + téma + kijelentkezés ── */}
          {mode === 'account' && (
          <>
          {/* Profil-sor — mindig kattintható; a Beállítások „self" fülére navigál (saját
              név / avatar / jelszó). A settingsHref üzleti beállítást mutat, de a ?tab=self
              mindenki számára elérhető profil-tab, nem üzleti jog kérdése. */}
          {settingsHref && (
            <motion.div variants={PANEL_ITEM}>
              <Link
                href={`${settingsHref}?tab=self`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-ui-control px-3 py-2.5 transition-colors hover:bg-ui-cell"
              >
                <UserAvatar name={name} src={avatarUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <MarqueeText className="text-ui-body text-ui-text">{name ?? 'Fiók'}</MarqueeText>
                  <MarqueeText className="text-ui-label text-ui-muted">{email ? `${email} · Saját profil` : 'Saját profil'}</MarqueeText>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ui-muted" strokeWidth={1.8} />
              </Link>
            </motion.div>
          )}

          <div className="mx-3 my-1 border-t border-dashed border-ui-divider" />

          {/* Gyorslinkek: nyilvános oldal + előfizetés + beállítások. (CSV export a Vendégek/
              Statisztikák oldalon van, nem a fiók-menüben.) */}
          {(publicUrl || (subscriptionHref && canBilling) || (settingsHref && canSettings) || partnerHref) && (
            <motion.div variants={PANEL_ITEM}>
              {publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-ui-control px-3 py-2.5 text-ui-body text-ui-text transition-colors hover:bg-ui-cell"
                >
                  <Globe className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="flex-1">Nyilvános oldal</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ui-muted" strokeWidth={1.8} />
                </a>
              )}
              {subscriptionHref && canBilling && (
                <Link
                  href={subscriptionHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-ui-control px-3 py-2.5 text-ui-body text-ui-text transition-colors hover:bg-ui-cell"
                >
                  <CreditCard className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="flex-1">Előfizetés</span>
                  {trialDaysLeft !== undefined && (
                    <Pill tone="yellow" size="sm">{trialDaysLeft === 0 ? 'Ma jár le' : `${trialDaysLeft} nap`}</Pill>
                  )}
                </Link>
              )}
              {settingsHref && canSettings && (
                <Link
                  href={settingsHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-ui-control px-3 py-2.5 text-ui-body text-ui-text transition-colors hover:bg-ui-cell"
                >
                  <Settings className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  Beállítások
                </Link>
              )}
              {/* Partnerprogram (design 20.3) — sárga sor, csak a tulajnak (szalon / étterem) */}
              {partnerHref && (
                <Link
                  href={partnerHref}
                  onClick={() => setOpen(false)}
                  className="mt-1 flex items-center gap-2.5 rounded-ui-control bg-ui-yellow px-3 py-2.5 text-ui-body text-ui-text transition-opacity hover:opacity-90"
                >
                  <Gift className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="flex-1">Partnerprogram</span>
                  <Pill tone="white" size="sm">+1 hónap ingyen</Pill>
                </Link>
              )}
            </motion.div>
          )}

          {/* Üzletváltó — 1 üzletnél is (alul „Üzlet hozzáadása”); mobilon ez váltja ki az Áttekintés
              oldali üdvözlő + üzletváltó sort. Accordion trigger az aktív üzlet. */}
          {businesses.length >= 1 && (() => {
            const active = businesses.find((b) => `${b.type}:${b.id}` === activeBusinessKey) ?? businesses[0]
            return (
              <>
                <div className="mx-3 my-1 border-t border-dashed border-ui-divider" />
                <motion.div variants={PANEL_ITEM}>
                  <div className="px-3 pb-1 pt-2 text-ui-label text-ui-muted">Üzlet</div>
                  {businesses.map((b) => {
                    const key = `${b.type}:${b.id}`
                    const isActive = key === activeBusinessKey || (!activeBusinessKey && b === active)
                    const isBusy = switching === key
                    const mono = b.name?.trim()?.[0]?.toUpperCase() ?? '?'
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => switchBusiness(b)}
                        disabled={isBusy || isActive}
                        className={cn('flex w-full items-center gap-2.5 rounded-ui-control px-3 py-2 text-left transition-colors', isActive ? 'cursor-default bg-ui-cell' : 'hover:bg-ui-cell')}
                      >
                        {/* a design (17.1) köre: benne az üzlet logója, ha van; különben a kezdőbetű */}
                        <IconCircle size="sm" tone={b.logoUrl ? 'white' : isActive ? 'dark' : 'cell'} className="overflow-hidden">
                          {b.logoUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={b.logoUrl} alt="" className="h-full w-full object-contain p-1" />
                            : mono}
                        </IconCircle>
                        <span className="min-w-0 flex-1">
                          <MarqueeText className="text-ui-body text-ui-text">{b.name}</MarqueeText>
                          <span className="block text-ui-label text-ui-muted">{b.type === 'restaurant' ? 'Étterem' : 'Szalon'}</span>
                        </span>
                        {isBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ui-muted" /> : isActive ? <Check className="h-4 w-4 shrink-0 text-ui-dark" strokeWidth={2.5} /> : null}
                      </button>
                    )
                  })}
                  {canBilling && (
                    <button
                      type="button"
                      onClick={() => { setOpen(false); router.push('/business/new') }}
                      className="flex items-center gap-2.5 rounded-ui-control px-3 py-2.5 text-ui-body text-ui-text transition-colors hover:bg-ui-cell w-full"
                    >
                      <Plus className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                      Üzlet hozzáadása
                    </button>
                  )}
                </motion.div>
              </>
            )
          })()}

          <div className="mx-3 my-1 border-t border-dashed border-ui-divider" />

          {/* Kijelentkezés. */}
          <motion.button
            variants={PANEL_ITEM}
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-ui-control px-3 py-2.5 text-ui-body text-ui-bad transition-colors hover:bg-ui-cell"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            Kijelentkezés
          </motion.button>
          </>
          )}

          {/* ── ÉRTESÍTÉSEK mód (csengő) ── */}
          {mode === 'notifications' && (
          <>
          <motion.div variants={PANEL_ITEM} className="flex items-center gap-2 px-3 pb-2 pt-2">
            <p className="flex flex-1 items-center gap-2 text-ui-title text-ui-text">
              Értesítések
              {unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ui-yellow px-1.5 text-ui-label text-ui-dark">{unread}</span>
              )}
            </p>
            {approvals && <Segmented options={['Mind', 'Jóváhagyás']} active={onlyApproval ? 1 : 0} onSelect={(i) => setOnlyApproval(i === 1)} tone="glass" size="sm" />}
          </motion.div>
          <motion.div variants={PANEL_ITEM} className="min-h-[220px] max-h-[55vh] lg:min-h-0 lg:max-h-[440px] overflow-y-auto overscroll-contain" data-lenis-prevent>
            {shownGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-3 py-10 text-center">
                <IconCircle icon={Bell} tone="cell" size="lg" />
                <p className="text-ui-body text-ui-muted">{onlyApproval ? 'Nincs jóváhagyásra váró foglalás' : 'Nincs új értesítés'}</p>
              </div>
            ) : (
              shownGroups.map(({ label, rows }) => (
                <div key={label}>
                  <p className="px-3 pb-1 pt-3 text-ui-label text-ui-muted">{label}</p>
                  {rows.map((n) =>
                    n.type === 'digest_morning' || n.type === 'digest_evening'
                      ? <DigestCard key={n.id} n={n} onMarkRead={() => markRead(n.id)} onRemove={() => remove(n.id)} onOpened={() => setOpen(false)} />
                      : n.type === 'admin_broadcast'
                        ? <NotificationRow key={n.id} n={n} onOpen={() => { if (!n.read) markRead(n.id); setOpen(false); window.dispatchEvent(new CustomEvent(OPEN_BROADCAST_EVENT, { detail: n })) }} onRemove={() => remove(n.id)} />
                        : <NotificationRow key={n.id} n={n} onOpen={() => openItem(n)} onRemove={() => remove(n.id)} onHandled={() => { if (!n.read) markRead(n.id); void reload() }} />
                  )}
                </div>
              ))
            )}
          </motion.div>
          {/* alul: mind olvasott, és az összes értesítés oldala (ott a törlés is) */}
          <motion.div variants={PANEL_ITEM} className="mt-1 flex items-center gap-1">
            <Button variant="ghost" onClick={markAllRead} disabled={unread === 0} className="flex-1 text-ui-muted hover:bg-ui-cell hover:text-ui-text">Összes megjelölése olvasottként</Button>
            {notificationsHref && (
              <IconButton icon={ArrowRight} label="Összes értesítés" variant="cell" href={notificationsHref} onClick={() => setOpen(false)} />
            )}
          </motion.div>
          </>
          )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/** Egyetlen értesítés sor a fiók-popoverben: kör ikon-badge + cím/idő + törlés (hoverre). */
function NotificationRow({ n, onOpen, onRemove, onHandled }: { n: Notification; onOpen: () => void; onRemove: () => void; onHandled?: () => void }) {
  const { Icon, color, bg } = notificationVisual(n.type, n.metadata)
  return (
    <div className={cn('group mb-1 flex items-start gap-3 rounded-ui-inner px-3 py-3 transition-colors hover:bg-ui-cell')}>
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', bg)}>
        <Icon className={cn('h-4 w-4', color)} strokeWidth={1.8} />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="text-ui-body font-medium leading-snug text-ui-text">{n.title}</p>
        {n.body && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-ui-meta text-ui-muted">{n.body}</p>}
        <p className="mt-0.5 text-ui-label text-ui-muted/70">
          {notifDate(n.createdAt)}
          <span className="mx-1 opacity-50">·</span>
          {timeAgo(n.createdAt)}
        </p>
        {isAwaitingApproval(n) && <ApprovalActions n={n} onHandled={onHandled} />}
      </button>
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        {!n.read && (
          <span className="absolute h-2 w-2 rounded-full bg-ui-yellow transition-all duration-150 ease-out [@media(hover:hover)]:group-hover:scale-50 [@media(hover:hover)]:group-hover:opacity-0 [@media(hover:none)]:hidden" />
        )}
        <button
          type="button"
          aria-label="Értesítés törlése"
          onClick={onRemove}
          className="absolute inset-0 flex items-center justify-center rounded-full text-ui-muted opacity-0 scale-75 transition-all duration-150 ease-out hover:bg-ui-cell hover:text-ui-text [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:scale-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:scale-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  )
}

/** Digest értesítés kártya — kattintásra a KÖZPONTI `DigestAutoPopup`-mount nyitja meg a
 *  sheetet (esemény-alapú, nem saját, beágyazott portál — ld. `DigestAutoPopup.tsx`). */
function DigestCard({ n, onMarkRead, onRemove, onOpened }: { n: Notification; onMarkRead: () => void; onRemove: () => void; /** a megnyitáskor az értesítő panel bezárul (mobilon különben a lap mögött marad) */ onOpened?: () => void }) {
  const { Icon, color, bg } = notificationVisual(n.type, n.metadata)
  const meta = n.metadata as DigestMetadata | null

  function openSheet() {
    if (!n.read) onMarkRead()
    onOpened?.()
    window.dispatchEvent(new CustomEvent(OPEN_DIGEST_EVENT, { detail: n }))
  }

  return (
    <div className={cn('group relative mb-1 cursor-pointer rounded-ui-inner transition-colors hover:bg-ui-cell')} onClick={openSheet}>
      <div className="flex items-start gap-3 px-3 py-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', bg)}>
          <Icon className={cn('h-4 w-4', color)} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ui-body font-medium leading-snug text-ui-text">{n.title}</p>
          <p className="mt-0.5 text-ui-label text-ui-muted">{notifDate(n.createdAt)}</p>
          {meta && (
            <p className="mt-1 text-ui-meta text-ui-text">
              {meta.bookings} foglalás · {meta.guests} fő
              {meta.team_count ? ` · ${meta.team_count} munkatárs` : ''}
            </p>
          )}
        </div>
        <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          {!n.read && (
            <span className="absolute h-2 w-2 rounded-full bg-ui-yellow transition-all duration-150 ease-out [@media(hover:hover)]:group-hover:scale-50 [@media(hover:hover)]:group-hover:opacity-0 [@media(hover:none)]:hidden" />
          )}
          <span
            role="button"
            aria-label="Értesítés törlése"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full text-ui-muted opacity-0 scale-75 transition-all duration-150 ease-out hover:bg-ui-cell hover:text-ui-text [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:scale-100 [@media(hover:none)]:opacity-100 [@media(hover:none)]:scale-100"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  )
}
