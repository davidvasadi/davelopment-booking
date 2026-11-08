'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck, CalendarX, CalendarClock, CalendarRange, UserPlus, Sparkles, Sun, Moon, MailWarning, Mail, Megaphone, BriefcaseBusiness, ArrowLeftRight, UserRoundX, Users, Gift, Lightbulb, Hourglass, ShieldAlert, TriangleAlert, Bell, type LucideIcon } from 'lucide-react'
import type { CircleTone } from '@/components/ui-kit'

export type Notification = {
  id: number | string
  type: 'new_booking' | 'cancellation' | 'modification' | 'new_signup' | 'new_subscriber' | 'digest_morning' | 'digest_evening' | 'schedule_change' | 'email_not_opened' | 'contact_message' | 'admin_broadcast' | 'weekly_tip' | 'voucher_purchase' | 'trial_ending' | 'booking_window' | 'dispute_created' | 'fraud_warning'
  title: string
  body?: string | null
  read?: boolean | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  reservation?: number | string | null
  booking?: number | string | null
  voucher?: number | string | null
  salon?: number | string | null
  restaurant?: number | string | null
  /** Jóváhagyásra váró foglalás-értesítésnél a foglalás aktuális státusza (az API teszi hozzá). */
  target_status?: string
}

export type DigestMetadata = {
  bookings: number
  guests: number
  date?: string
  team_count?: number
  occasions?: Record<string, { count: number; icon?: string | null }>
  shift_manager?: { name: string; avatar_url?: string | null }
  staff_breakdown?: { name: string; bookings: number }[]
  /** Esti összefoglalónál: foglalás-forrás breakdown */
  source?: { walk_in?: number; phone?: number; online?: number }
  /** Esti összefoglalónál: státusz breakdown */
  status?: { completed?: number; cancelled?: number; no_show?: number }
  /** Ma beszedett előleg (Ft) — a `deposit_paid` foglalások összege. */
  revenue_huf?: number
  /** Top 3 legtöbbet foglalt szolgáltatás ma (szalon-only). */
  top_services?: { name: string; bookings: number }[]
  /** Ma egyedi vendégei közül hány új (nincs korábbi, nem-lemondott foglalása) / hány visszatérő. */
  new_guests?: number
  returning_guests?: number
  /** Ország-bontás (ISO kód → darabszám) — étterem-only, a `country` mezőből. */
  countries?: Record<string, number>
}

export function notificationVisual(type: Notification['type'], metadata?: Record<string, unknown> | null): { Icon: LucideIcon; tone: CircleTone; color: string; bg: string } {
  // a design (/design 17.2) színei: új foglalás sárga, lemondás piros, módosítás narancs, minden más semleges.
  // `tone`: a kit kör-tónusa (Értesítések oldal); `color` / `bg`: osztályként a fiók-menü saját köréhez.
  const NEW = { tone: 'yellow' as const, color: 'text-ui-dark', bg: 'bg-ui-yellow' }, BAD = { tone: 'bad' as const, color: 'text-ui-bad', bg: 'bg-ui-bad-bg' }, WARN = { tone: 'warn' as const, color: 'text-ui-warn', bg: 'bg-ui-warn-bg' }, NEUTRAL = { tone: 'cell' as const, color: 'text-ui-text', bg: 'bg-ui-cell' }
  // ikon típusonként, hogy egy pillantásra látszódjon, miről szól (nem minden naptár): beosztás = munkatárs/műszak,
  // tipp = izzó, utalvány = ajándék, próbaidő = homokóra, vita / csalás = pajzs / figyelmeztetés.
  if (type === 'schedule_change') {
    const event = metadata?.event as string | undefined
    if (event === 'deleted')  return { Icon: UserRoundX, ...BAD }
    if (event === 'modified') return { Icon: ArrowLeftRight, ...WARN }
    if (event === 'created')  return { Icon: BriefcaseBusiness, ...NEW }
    return { Icon: Users, ...NEUTRAL }
  }
  switch (type) {
    case 'new_booking':      return { Icon: CalendarCheck, ...NEW }
    case 'cancellation':     return { Icon: CalendarX, ...BAD }
    case 'modification':     return { Icon: CalendarClock, ...WARN }
    case 'new_signup':       return { Icon: UserPlus, ...NEUTRAL }
    case 'new_subscriber':   return { Icon: Sparkles, ...NEUTRAL }
    case 'digest_morning':   return { Icon: Sun, ...NEW }
    case 'digest_evening':   return { Icon: Moon, tone: 'dark', color: 'text-white', bg: 'bg-ui-dark' }
    case 'email_not_opened': return { Icon: MailWarning, ...WARN }
    case 'voucher_purchase': return { Icon: Gift, ...NEUTRAL }
    case 'contact_message':  return { Icon: Mail, ...NEUTRAL }
    case 'admin_broadcast':  return { Icon: Megaphone, ...NEUTRAL }
    case 'weekly_tip':       return { Icon: Lightbulb, ...NEUTRAL }
    case 'trial_ending':     return { Icon: Hourglass, ...WARN }
    case 'dispute_created':  return { Icon: ShieldAlert, ...BAD }
    case 'fraud_warning':    return { Icon: TriangleAlert, ...BAD }
    case 'booking_window':   return { Icon: CalendarRange, ...NEUTRAL }
    default:                 return { Icon: Bell, ...NEUTRAL }
  }
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'most'
  if (m < 60) return `${m} perce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} órája`
  const d = Math.floor(h / 24)
  return `${d} napja`
}

const MONTHS_HU = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']

export function notifDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const month = MONTHS_HU[d.getMonth()]
  const day = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const yearPrefix = d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}. ` : ''
  return `${yearPrefix}${month} ${day}. · ${hh}:${mm}`
}

/**
 * KÖZÖS értesítés-tár: a harang, az Értesítések oldal és a felugró ablakok (digest, broadcast)
 * ugyanazt a listát használják — korábban mindegyik külön, percenként pollozott (4 kérés/perc,
 * kijelentkezett/lejárt munkamenetnél végtelen 401-sorozat). Most NINCS időzített lekérdezés:
 *  - az élő SSE-csatorna (LiveRefreshProvider → 'notification-changed') azonnal jelez, ha jön valami;
 *  - a fülre visszatéréskor (pl. alvó laptop, megszakadt SSE) egy felzárkózó lekérés, max. 30 mp-enként;
 *  - 401-nél (nincs/lejárt bejelentkezés) a tár leáll, többet nem kérdez.
 */
type StoreState = { items: Notification[]; unread: number; newDigest: Notification | null }
const store = {
  state: { items: [], unread: 0, newDigest: null } as StoreState,
  listeners: new Set<() => void>(),
  seenIds: null as Set<Notification['id']> | null,
  newestSeen: null as string | null,
  inFlight: null as Promise<void> | null,
  stopped: false,
  lastLoad: 0,
  detach: null as null | (() => void),
}

function setState(patch: Partial<StoreState>) {
  store.state = { ...store.state, ...patch }
  store.listeners.forEach((l) => l())
}

async function loadNotifications(): Promise<void> {
  if (store.stopped) return
  if (store.inFlight) return store.inFlight
  store.inFlight = (async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      store.lastLoad = Date.now()
      if (res.status === 401) { store.stopped = true; return }
      if (!res.ok) return
      const data = await res.json()
      const next: Notification[] = data.notifications ?? []
      let newDigest = store.state.newDigest
      if (store.seenIds) {
        // Csak a legfrissebb ismertnél ÚJABB digest számít érkezettnek — törlés után a lista
        // alján felbukkanó régi (eddig a 20-as limiten kívüli) digest ne nyisson popupot.
        const newestSeen = store.newestSeen
        const arrived = next.find(
          (n) => (n.type === 'digest_morning' || n.type === 'digest_evening') && !store.seenIds!.has(n.id)
            && (!newestSeen || n.createdAt > newestSeen),
        )
        if (arrived) newDigest = arrived
      }
      store.seenIds = new Set([...(store.seenIds ?? []), ...next.map((n) => n.id)])
      for (const n of next) if (!store.newestSeen || n.createdAt > store.newestSeen) store.newestSeen = n.createdAt
      setState({ items: next, unread: data.unread ?? 0, newDigest })
    } catch {
      /* csendben — best-effort */
    } finally {
      store.inFlight = null
    }
  })()
  return store.inFlight
}

function attachTriggers() {
  const onChanged = () => { void loadNotifications() }
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - store.lastLoad > 30_000) void loadNotifications()
  }
  window.addEventListener('notification-changed', onChanged)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.removeEventListener('notification-changed', onChanged)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

function subscribe(listener: () => void) {
  store.listeners.add(listener)
  if (store.listeners.size === 1) {
    // Első feliratkozó (pl. a dashboard betöltése, újra-bejelentkezés után is): friss indulás —
    // egy korábbi 401 miatti leállás nem ragadhat be a következő munkamenetre.
    store.stopped = false
    store.detach = attachTriggers()
    void loadNotifications()
  }
  return () => {
    store.listeners.delete(listener)
    if (store.listeners.size === 0) { store.detach?.(); store.detach = null }
  }
}

const getSnapshot = () => store.state

export function useNotifications(onNavigate?: () => void) {
  const router = useRouter()
  const { items, unread, newDigest } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const load = loadNotifications
  const setItems = (fn: (prev: Notification[]) => Notification[]) => setState({ items: fn(store.state.items) })
  const setUnread = (fn: (u: number) => number) => setState({ unread: fn(store.state.unread) })
  const clearNewDigest = useCallback(() => setState({ newDigest: null }), [])

  // A szerver egyszerre csak a legutóbbi 20-at adja: törlés után újratöltünk, hogy a régebbiek
  // a helyükre csússzanak (különben pár törlés után üres lett a lista, holott volt még értesítés).
  // Az olvasatlan-számlálót is az újratöltés állítja be (a szerver-oldali pontos értékre) — a
  // korábbi helyi „-1" olvasott elem törlésekor is csökkentette.
  const remove = useCallback(async (id: number | string) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/notifications?id=${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
    await load()
  }, [load])

  const markRead = useCallback(async (id: number | string) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnread((u) => Math.max(0, u - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null)
  }, [])

  // Az összes törlése szerver-oldalon (`?all=1`) — nem csak a betöltött 20-at.
  const clearAll = useCallback(async () => {
    setState({ items: [], unread: 0 })
    await fetch('/api/notifications?all=1', {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
    await load()
  }, [load])

  const openItem = useCallback((n: Notification) => {
    onNavigate?.()
    // Jóváhagyásra váró (még függő) foglalás értesítése megmarad a gyorsgombokkal, csak olvasott lesz.
    const awaiting = !!(n.metadata as { awaiting_approval?: boolean } | null)?.awaiting_approval && n.target_status === 'pending'
    if (awaiting) { if (!n.read) void markRead(n.id) } else remove(n.id)
    const t = Date.now()
    if (n.reservation != null) {
      router.push(`/restaurant/bookings?reservation=${encodeURIComponent(String(n.reservation))}&t=${t}`)
    } else if (n.booking != null) {
      router.push(`/dashboard/bookings?booking=${encodeURIComponent(String(n.booking))}&t=${t}`)
    } else if (n.type === 'digest_morning' || n.type === 'digest_evening') {
      const isRest = n.restaurant != null
      const base = isRest ? '/restaurant/bookings' : '/dashboard/bookings'
      const date = (n.metadata as { date?: string } | null)?.date
      router.push(date ? `${base}?date=${date}&t=${t}` : `${base}?t=${t}`)
    } else if (n.type === 'schedule_change') {
      const isRest = n.restaurant != null
      const base = isRest ? '/restaurant/schedule' : '/dashboard/schedule'
      const date = (n.metadata as { date?: string } | null)?.date
      router.push(date ? `${base}?date=${date}&t=${t}` : `${base}?t=${t}`)
    } else if (n.type === 'voucher_purchase' && n.voucher != null) {
      // utalvány-vásárlás → az Utalványok oldalon pontosan ez az utalvány nyílik meg
      const base = n.restaurant != null ? '/restaurant/vouchers' : '/dashboard/vouchers'
      router.push(`${base}?voucher=${encodeURIComponent(String(n.voucher))}&t=${t}`)
    } else if (n.type === 'trial_ending') {
      // próbaidő → az Előfizetés lap (ott a „Mielőtt lejár a próbaidő” teendők)
      router.push(`${n.restaurant != null ? '/restaurant' : '/dashboard'}/settings?tab=billing&t=${t}`)
    } else if (n.type === 'booking_window') {
      // foglalási időszak → a foglalóoldal-szerkesztő foglalási szabályai
      router.push(`${n.restaurant != null ? '/restaurant' : '/dashboard'}/settings?tab=site&t=${t}`)
    } else if (n.type === 'weekly_tip') {
      // heti tipp → a Tippek oldal, ott PONTOSAN ez a tipp (metadata.tipId; régi értesítésnél az aktuális)
      const base = n.restaurant != null ? '/restaurant/tips' : '/dashboard/tips'
      const tipId = (n.metadata as { tipId?: string } | null)?.tipId
      router.push(tipId ? `${base}?tip=${encodeURIComponent(tipId)}&t=${t}` : `${base}?t=${t}`)
    } else if (n.type === 'new_signup') {
      router.push(`/backstage/salons?t=${t}`)
    } else if (n.type === 'new_subscriber') {
      router.push(`/backstage/accounts?t=${t}`)
    } else if (n.type === 'contact_message') {
      router.push(`/backstage/contact?t=${t}`)
    }
  }, [onNavigate, remove, markRead, router])

  const groups = [
    { label: 'Új', rows: items.filter((n) => !n.read) },
    { label: 'Korábbi', rows: items.filter((n) => n.read) },
  ].filter((g) => g.rows.length > 0)

  return { items, unread, groups, remove, markRead, clearAll, openItem, reload: load, newDigest, clearNewDigest }
}
