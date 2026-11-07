'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCheck, Trash2 } from 'lucide-react'
import { Button, Meta, Segmented } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { usePathname, useRouter } from 'next/navigation'
import { NotificationsInbox, type InboxGroup, type InboxRow } from '@/components/blocks/notify'
import { ApprovalActions, ApprovalButtons, isAwaitingApproval } from './ApprovalActions'
import { OPEN_DIGEST_EVENT } from './DigestAutoPopup'
import { OPEN_BROADCAST_EVENT } from './BroadcastAutoPopup'
import { useNotifications, notificationVisual, timeAgo, type Notification, type DigestMetadata } from '@/lib/useNotifications'

/**
 * Az összes értesítés oldala (design 17.3) — a `NotificationsInbox` blokk élő adattal: napokra bontva (Ma, Tegnap,
 * dátum), szűrő (Mind / Olvasatlan / Jóváhagyás), Összes olvasott / Összes törlése. A Jóváhagyás fül a VALÓBAN
 * várakozó foglalásokat mutatja (/api/attention — ugyanaz a forrás, mint a figyelem-sávé és az Áttekintésé), nem csak
 * azokat, amikről értesítés ment (az csak az online érkezettekről megy). A személyes értesítési beállítások
 * a Beállítások › Értesítések lapon vannak (a fejléc fogaskereke oda visz; mobilon a fejléc ikonja is).
 */

const MONTHS = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (ymd(d) === ymd(now)) return 'Ma'
  if (ymd(d) === ymd(y)) return 'Tegnap'
  return `${d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}. ` : ''}${MONTHS[d.getMonth()]} ${d.getDate()}.`
}
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export function NotificationsPage() {
  const { items, remove, markRead, clearAll, openItem, reload } = useNotifications()
  const pathname = usePathname()
  const router = useRouter()
  const [filter, setFilter] = useState(0)
  // Jóváhagyás fül: a várakozó foglalások (nem az értesítések)
  type Pending = { id: string; name: string; when: string; createdAt: string; service: string; detail: string }
  const [pending, setPending] = useState<{ rows: Pending[]; total: number; restaurant: boolean } | null>(null)
  const loadPending = useCallback(async () => {
    const r = await fetch('/api/attention', { credentials: 'include' }).catch(() => null)
    const j = r?.ok ? ((await r.json().catch(() => null)) as { pending: Pending[]; pendingTotal?: number; kind?: string } | null) : null
    setPending(j ? { rows: j.pending, total: j.pendingTotal ?? j.pending.length, restaurant: j.kind === 'restaurant' } : { rows: [], total: 0, restaurant: false })
  }, [])
  // a jobb oszlop összesítőjéhez a várakozók száma mindig kell
  useEffect(() => { void loadPending() }, [loadPending])
  useEffect(() => {
    if (filter !== 2) return
    void loadPending()
    const on = () => { void loadPending() }
    window.addEventListener('booking-changed', on)
    return () => window.removeEventListener('booking-changed', on)
  }, [filter, loadPending])
  const settingsHref = `${pathname.startsWith('/restaurant') ? '/restaurant' : '/dashboard'}/settings?tab=notifications`

  // mobil: a fejléc szűrő-ikonja (DashboardNav) nyitja — benne a nézet (Mind / Olvasatlan / Jóváhagyás) és a két tömeges művelet
  const [filterOpen, setFilterOpen] = useState(false)
  useEffect(() => {
    const on = () => setFilterOpen(true)
    window.addEventListener('davelopment:open-notifications-filter', on)
    return () => window.removeEventListener('davelopment:open-notifications-filter', on)
  }, [])
  // mobilon a fejléc fogaskereke (DashboardNav) a beállításokra visz
  useEffect(() => {
    const go = () => router.push(settingsHref)
    window.addEventListener('davelopment:open-notifications-tabs', go)
    return () => window.removeEventListener('davelopment:open-notifications-tabs', go)
  }, [router, settingsHref])

  const unread = items.filter((n) => !n.read).length
  const readAll = () => { for (const n of items) if (!n.read) void markRead(n.id) }
  const shown = items.filter((n) => (filter === 1 ? !n.read : filter === 2 ? isAwaitingApproval(n) : true))

  const row = (n: Notification): InboxRow => {
    const { Icon, tone } = notificationVisual(n.type, n.metadata)
    const digest = n.type === 'digest_morning' || n.type === 'digest_evening'
    const meta = digest ? (n.metadata as DigestMetadata | null) : null
    const open = () => {
      if (digest || n.type === 'admin_broadcast') {
        if (!n.read) void markRead(n.id)
        window.dispatchEvent(new CustomEvent(digest ? OPEN_DIGEST_EVENT : OPEN_BROADCAST_EVENT, { detail: n }))
      } else openItem(n)
    }
    return {
      id: String(n.id), icon: Icon, tone, title: n.title,
      body: meta ? [`${meta.bookings} foglalás`, `${meta.guests} fő`, meta.team_count ? `${meta.team_count} munkatárs` : null, n.type === 'digest_evening' && meta.status?.completed != null ? `${meta.status.completed} teljesült` : null].filter(Boolean).join(' · ') : n.body,
      when: `${hhmm(n.createdAt)} · ${timeAgo(n.createdAt)}`, unread: !n.read,
      extra: isAwaitingApproval(n) ? <ApprovalActions n={n} onHandled={() => { if (!n.read) void markRead(n.id); void reload() }} /> : undefined,
      onOpen: open, onRemove: () => void remove(n.id),
    }
  }
  const groups: InboxGroup[] = []
  if (filter === 2) {
    // a várakozó foglalások — a legrégebben érkezett elöl; a sorra kattintva a foglaláshoz visz
    const base = pathname.startsWith('/restaurant') ? '/restaurant' : '/dashboard'
    const rows: InboxRow[] = (pending?.rows ?? []).map((p) => ({
      id: `pending-${p.id}`, icon: CalendarDays, tone: 'yellow', title: `${p.name} — jóváhagyásra vár`,
      body: [p.when, p.service, p.detail].filter(Boolean).join(' · '), when: `beérkezett ${timeAgo(p.createdAt)}`, unread: true,
      extra: <ApprovalButtons restaurant={!!pending?.restaurant} id={p.id} onHandled={() => { window.dispatchEvent(new Event('booking-changed')); void loadPending() }} />,
      onOpen: () => router.push(`${base}/bookings?${pending?.restaurant ? 'reservation' : 'booking'}=${p.id}`),
    }))
    if (rows.length) groups.push({ label: pending && pending.total > rows.length ? `Jóváhagyásra vár · ${pending.total} (az első ${rows.length})` : `Jóváhagyásra vár · ${rows.length}`, rows })
  } else {
    for (const n of shown) {
      const label = dayLabel(n.createdAt)
      const g = groups.find((x) => x.label === label) ?? (groups.push({ label, rows: [] }), groups[groups.length - 1])
      g.rows.push(row(n))
    }
  }

  return (
    <div className="px-4 py-6 lg:px-0">
      <NotificationsInbox groups={groups} total={items.length} unread={unread} approvals={pending?.total ?? 0} filter={filter} onFilter={setFilter}
        onReadAll={readAll} onClearAll={() => void clearAll()} settingsHref={settingsHref} />
      <PopupModal open={filterOpen} onClose={() => setFilterOpen(false)} title="Szűrők" maxWidth="sm:max-w-[440px]">
        <Meta>Nézet</Meta>
        <Segmented full tone="cell" className="mt-1.5" options={['Mind', `Olvasatlan${unread ? ` · ${unread}` : ''}`, 'Jóváhagyás']} active={filter} onSelect={(i) => { setFilter(i); setFilterOpen(false) }} />
        <div className="mt-4 flex gap-1.5">
          <Button variant="cell" className="flex-1" icon={CheckCheck} disabled={!unread} onClick={() => { readAll(); setFilterOpen(false) }}>Összes olvasott</Button>
          <Button variant="danger" className="flex-1" icon={Trash2} disabled={!items.length} onClick={() => { void clearAll(); setFilterOpen(false) }}>Összes törlése</Button>
        </div>
      </PopupModal>
    </div>
  )
}
