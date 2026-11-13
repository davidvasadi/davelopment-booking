import type { Status } from '@/components/ui-kit'
import type { BsAccount, BsPlace, BsPlaceLite, BsStatus, BsTier } from '@/components/blocks/backstage'
import type { AccountSummary } from './backstageMetrics'
import type { AuditTableRow } from '@/components/blocks/settings'
import { auditView, type AuditAction, type AuditChange } from './auditText'
import { MONTHS, MONTHS_SHORT } from './schedule'

/* Backstage: a szerver-adat (backstageMetrics) átfordítása a blocks/backstage blokkok adatformájára. Dátumok nagy
 * kezdőbetűvel („Ma, 9:12”, „Nov. 3.”), mint az admin többi részén. */

const MS_DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** „Nov. 3.” (más évben „2025. Nov. 3.”). */
export function shortDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}. ` : ''
  return `${y}${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.`
}

/** „Ma, 9:12” · „Tegnap, 18:05” · „Nov. 10., 9:15”. */
export function dayTime(iso: string | Date): string {
  const d = new Date(iso)
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / MS_DAY)
  const t = `${d.getHours()}:${pad(d.getMinutes())}`
  if (diff === 0) return `Ma, ${t}`
  if (diff === 1) return `Tegnap, ${t}`
  return `${shortDate(d)}, ${t}`
}

/** A nap címkéje az idővonalhoz: „Ma” · „Tegnap” · „Nov. 10.”. */
export function dayLabel(iso: string | Date): string {
  const diff = Math.round((startOfDay(new Date()).getTime() - startOfDay(new Date(iso)).getTime()) / MS_DAY)
  return diff === 0 ? 'Ma' : diff === 1 ? 'Tegnap' : shortDate(iso)
}

/** „20 perce” · „3 órája” · „Tegnap” · „Nov. 10.”. */
export function ago(iso: string | Date): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'Most'
  if (s < 3600) return `${Math.floor(s / 60)} perce`
  if (s < 86400) return `${Math.floor(s / 3600)} órája`
  return dayLabel(iso)
}

export const monthName = (ym: string) => { const [, m] = ym.split('-').map(Number); return MONTHS[(m || 1) - 1] ?? ym }
export const monthShort = (ym: string) => { const [, m] = ym.split('-').map(Number); return MONTHS_SHORT[(m || 1) - 1] ?? ym }

export function daysLeft(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / MS_DAY)
}

/** Ezres kerekítés a nagy számokhoz: „343 e”, kis értéknél a pontos szám. */
export function thousands(n: number): string {
  if (Math.abs(n) < 10_000) return n.toLocaleString('hu-HU')
  return `${Math.round(n / 1000).toLocaleString('hu-HU')} e`
}

/** A fiók megjelenő neve: az első üzlete (ha van), különben a tulaj neve / e-mailje. */
export function accountTitle(a: Pick<AccountSummary, 'places' | 'owner'>): string {
  return a.places[0]?.name || a.owner.name || a.owner.email || '—'
}

export function accountVM(a: AccountSummary): BsAccount {
  const sub = a.sub
  const status = (a.status ?? null) as BsStatus | null
  const end = status === 'trialing' ? sub?.trial_ends_at : sub?.current_period_end
  return {
    key: a.ownerId,
    name: a.owner.name || a.owner.email || '—',
    business: accountTitle(a),
    email: a.owner.email ?? '',
    img: a.owner.avatar_url ?? null,
    phone: a.owner.phone ?? null,
    salons: a.salonCount,
    restaurants: a.restaurantCount,
    tier: (a.tier ?? null) as BsTier | null,
    fee: a.mrr || a.potentialFee || 0,
    annual: sub?.billing_cycle === 'annual',
    bookings30: a.recentBookings,
    status,
    trialLeft: status === 'trialing' ? daysLeft(sub?.trial_ends_at) : null,
    since: shortDate(a.createdAt),
    periodEnd: end ? shortDate(end) : null,
    note: sub?.notes || null,
  }
}

export const placeHref = (slug: string) => `/${slug}`

export function accountPlacesLite(a: AccountSummary): BsPlaceLite[] {
  return a.places.map((p) => ({
    key: `${p.kind}:${p.id}`, kind: p.kind, name: p.name,
    meta: [p.city, `${p.recent.toLocaleString('hu-HU')} foglalás / 30 nap`, p.is_active ? null : 'kikapcsolva'].filter(Boolean).join(' · '),
    href: placeHref(p.slug),
  }))
}

export function placeVMs(accounts: AccountSummary[]): (BsPlace & { customFee: number | null })[] {
  return accounts.flatMap((a) => a.places.map((p) => ({ a, p })))
    .sort((x, y) => new Date(y.p.createdAt).getTime() - new Date(x.p.createdAt).getTime())
    .map(({ a, p }) => ({
      key: `${p.kind}:${p.id}`, name: p.name, kind: p.kind, city: p.city ?? '', owner: a.owner.name || a.owner.email || '—', ownerKey: a.ownerId,
      tier: p.tier as BsTier, month: p.recent, total: p.total, since: shortDate(p.createdAt), active: p.is_active,
      status: (a.status ?? null) as BsStatus | null, slug: p.slug, customFee: p.customFee,
    }))
}

/** Foglalás-állapot a listákhoz (szalon és étterem állapotai). */
export function bookingStatus(s: string): { status: Status; label: string } {
  switch (s) {
    case 'confirmed': return { status: 'confirmed', label: 'Megerősített' }
    case 'pending': return { status: 'pending', label: 'Jóváhagyásra vár' }
    case 'completed': case 'seated': case 'arrived': return { status: 'ok', label: s === 'seated' ? 'Leültetve' : 'Megjelent' }
    case 'no_show': return { status: 'bad', label: 'Nem jött' }
    case 'cancelled': case 'canceled': return { status: 'neutral', label: 'Lemondva' }
    default: return { status: 'neutral', label: s || '—' }
  }
}

/** „2026-11-14” + „10:00” → „Nov. 14., 10:00” (Ma / Tegnap / Holnap kiírva). */
export function bookingWhen(date: string, time: string): string {
  if (!date) return time || '—'
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, (m || 1) - 1, d || 1)
  const diff = Math.round((startOfDay(day).getTime() - startOfDay(new Date()).getTime()) / MS_DAY)
  const label = diff === 0 ? 'Ma' : diff === -1 ? 'Tegnap' : diff === 1 ? 'Holnap' : shortDate(day)
  return time ? `${label}, ${time.slice(0, 5)}` : label
}

/* ── Napló ── */

type AuditDoc = { id: string | number; action: string; collection_name?: string | null; summary?: string | null; changes?: unknown; actor?: unknown; actor_label?: string | null; actor_email?: string | null; createdAt: string }

/** Audit-log sorok a közös Napló-táblázathoz (ugyanaz, mint az üzlet Beállítások › Napló lapja). */
export function auditRows(docs: AuditDoc[]): AuditTableRow[] {
  return docs.map((e) => {
    const actor = e.actor && typeof e.actor === 'object' ? (e.actor as { name?: string | null; email?: string | null; avatar_url?: string | null }) : null
    return {
      key: String(e.id), time: dayTime(e.createdAt),
      actor: { name: e.actor_label || actor?.name || 'Rendszer', email: e.actor_email || actor?.email || null, img: actor?.avatar_url ?? null },
      ...auditView({ action: (e.action as AuditAction) || 'update', collection: e.collection_name ?? '', summary: e.summary ?? '', changes: Array.isArray(e.changes) ? (e.changes as AuditChange[]) : [] }),
    }
  })
}

/* ── E-mailek ── */

/** Az email-log típusai magyarul (az EmailLog collection címkéi szerint). */
export const EMAIL_TYPE_LABEL: Record<string, string> = {
  booking_confirmation: 'Foglalás-visszaigazolás', new_booking: 'Új foglalás (a tulajnak)', cancellation: 'Lemondás', reminder: 'Emlékeztető',
  feedback: 'Értékelés-kérés', waitlist_signup: 'Várólista-feliratkozás', waitlist_opening: 'Várólista: felszabadult hely', voucher_purchase: 'Ajándékutalvány-vásárlás',
  marketing_broadcast: 'Hírlevél', modification: 'Foglalás módosítása', digest_morning: 'Reggeli összefoglaló', digest_evening: 'Esti összefoglaló',
  team_invite: 'Csapat-meghívó', password_reset: 'Jelszó / belépési kód', schedule_change: 'Beosztás-értesítő', contact_form: 'Kapcsolat-űrlap',
  booking_window: 'Foglalási időszak', other: 'Egyéb',
}
export const emailTypeLabel = (t: string) => EMAIL_TYPE_LABEL[t] ?? t

/** A Resend angol hibaüzenete egy érthető magyar mondatban. */
export function emailErrorHu(err: string | null | undefined): string {
  const e = (err ?? '').toLowerCase()
  if (!e) return 'Ismeretlen hiba'
  if (e.includes('domain is not verified') || e.includes('verify your domain')) return 'A feladó domain nincs hitelesítve a Resendben — a levél ki sem ment'
  if (e.includes('testing email address') || e.includes('example.com')) return 'Teszt-címre (pl. example.com) ment — a Resend ezt nem kézbesíti'
  if (e.includes('rate limit') || e.includes('too many')) return 'Túl sok levél egyszerre (Resend-korlát) — később újra kell küldeni'
  if (e.includes('api key')) return 'Hibás vagy hiányzó Resend-kulcs'
  if (e.includes('invalid') && (e.includes('to') || e.includes('email'))) return 'Érvénytelen címzett e-mail cím'
  if (e.includes('bounce')) return 'Visszapattant — a címzett postafiókja nem fogadta'
  return err!.length > 90 ? `${err!.slice(0, 90)}…` : err!
}
