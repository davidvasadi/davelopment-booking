/**
 * VENDÉGEK view-model építő — a `Guest` aggregátumból és a nyers foglalásokból
 * kiszámolja a guests-view.tsx-nek szükséges prezentációs modelleket.
 * Étterem (reservations) ÉS szalon (bookings) egyaránt ezt használja.
 */

import { createHash } from 'crypto'
import { monogram, flagEmoji, TIER_LABEL, guestKeyOf, isRealGuest, displayName, type Guest, type GuestSource, type CountryBucket } from '@/lib/guests'
import { isoFromPhone } from '@/lib/phoneCountry'
import { ISO2_TO_CAPITAL } from '@/lib/geoLookup'
import type { StatusSeg } from '@/components/dashboard/StatusPills'
import type { GuestVM, ArrivalVM, GuestHistoryVM } from '@/components/dashboard/guests-view'

/* Determinisztikus avatar-paletta (a referencia arany/bézs tónusai). */
const AV_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: '#C9A24B', fg: '#1D1C19' },
  { bg: '#E7C765', fg: '#1D1C19' },
  { bg: '#8a8378', fg: '#ffffff' },
  { bg: '#bdb6a6', fg: '#1D1C19' },
  { bg: '#D7C28A', fg: '#1D1C19' },
  { bg: '#A79A7C', fg: '#ffffff' },
]

/**
 * Gravatar-URL az e-mailből (md5 hash). `d=404` → ha nincs profilkép, a kép 404-el,
 * és a UI a monogramos avatarra esik vissza. Sok Google/e-mail fióknak van Gravatarja.
 * (Konkrét Google-profilkép csak OAuth-tal érhető el, puszta e-mailből nem.)
 */
export function gravatarUrl(email?: string | null): string | null {
  const e = email?.trim().toLowerCase()
  if (!e) return null
  const hash = createHash('md5').update(e).digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=160`
}

/** Belföldi/külföldi arány a térkép-bucketekből (foglalás-szinten, HU = belföldi). */
export function originSplit(buckets: CountryBucket[]): { domestic: number; foreign: number } {
  const totalWithCountry = buckets.reduce((a, b) => a + b.count, 0)
  if (totalWithCountry === 0) return { domestic: 0, foreign: 0 }
  const hu = buckets.find((b) => b.iso.toUpperCase() === 'HU')?.count ?? 0
  const domestic = Math.round((hu / totalWithCountry) * 100)
  return { domestic, foreign: 100 - domestic }
}

function avatarFor(key: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return AV_PALETTE[h % AV_PALETTE.length]
}

const MONTHS = ['jan', 'feb', 'már', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szep', 'okt', 'nov', 'dec']

/** Mai dátum YYYY-MM-DD (helyi idő). */
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}. ${MONTHS[d.getMonth()]} ${d.getDate()}.`
}

function sinceYear(guest: Guest, sources: GuestSource[]): string {
  const dates = sources
    .filter((s) => matchKey(s) === guest.key && s.date)
    .map((s) => s.date as string)
    .sort()
  const first = dates[0] ?? guest.lastVisit
  if (!first) return new Date().getFullYear().toString()
  const y = new Date(first).getFullYear()
  return Number.isNaN(y) ? new Date().getFullYear().toString() : y.toString()
}

function matchKey(s: GuestSource): string | null {
  return guestKeyOf(s)
}

/** Relatív, magyar érkezés-idő ("Ma · 18:30" / "Tegnap · 19:00" / "3 napja"). */
function arrivalWhen(date: string | null, time?: string | null): string {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  const today = new Date()
  const midToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const midD = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((midToday.getTime() - midD.getTime()) / 86_400_000)
  const t = time ? time.slice(0, 5) : null
  let head: string
  if (diff <= 0) head = 'Ma'
  else if (diff === 1) head = 'Tegnap'
  else head = `${diff} napja`
  return t ? `${head} · ${t}` : head
}

/** Nap-címke az érkezések fejlécéhez ("Ma" / "Tegnap" / "2026. júl 3."). */
export function relativeDayLabel(day: string | null): string {
  if (!day) return 'Ma'
  const d = new Date(day)
  if (Number.isNaN(d.getTime())) return day
  const today = new Date()
  const mid = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((mid(today) - mid(d)) / 86_400_000)
  if (diff <= 0) return 'Ma'
  if (diff === 1) return 'Tegnap'
  return shortDate(day)
}

/** Loyalty pont: látogatás-alapú, 0–100-ra sapkázva (referencia-érzet). */
function loyaltyPoints(guest: Guest): number {
  return Math.min(100, guest.visits * 18)
}

function tierNote(guest: Guest): string {
  if (guest.tier === 3) return 'Törzsvendég — kiemelt figyelem, foglaláskor a kedvenc asztala/időpontja ajánlott.'
  if (guest.tier === 2) return 'Visszatérő vendég — pár látogatásra van a törzsvendég-státusztól. Érdemes egy kis figyelmességgel jutalmazni.'
  return 'Új vendég — az első benyomás számít. Egy meleg fogadtatás visszatérővé teheti.'
}

/** Vendéghez tartozó past/upcoming bontás a profil-soroknak. */
export interface GuestSplit {
  past: GuestSource[]
  upcoming: GuestSource[]
}

export interface BuildOptions {
  /** Szalon módban true → nincs ország/térkép. */
  salon?: boolean
  /** Foglalás-forrás → megjelenítendő "esemény" leírás (pl. szolgáltatás neve). */
  labelFor?: (s: GuestSource) => string
  /** Foglalás-forrás → megjelenítendő összeg (pl. ár). Null ha nincs. */
  amountFor?: (s: GuestSource) => string | null
  /** Kedvenc számítása (leggyakoribb szolgáltatás / nap). */
  favFor?: (guest: Guest, own: GuestSource[]) => string
  /** Profil-adatsorok (Látogatások, Összes létszám/költés, Közelgő, Kedvenc). */
  rowsFor?: (guest: Guest, split: GuestSplit) => Array<{ label: string; value: string }>
  /** Alkalmas foglalás dátuma (a legutóbbi occasion-nel jelölt foglalásból), vagy null. */
  birthdayDateFor?: (own: GuestSource[]) => string | null
  /** Vendég- és belső megjegyzés (a legfrissebb nem-üres a foglalásokból). */
  noteFor?: (own: GuestSource[]) => { guest: string | null; internal: string | null }
  /** Tiltólistán van-e a vendég (a Customers-rekordból). */
  blockedFor?: (guest: Guest) => boolean
  /** Tiltás indoka (a Customers-rekordból), ha van. */
  blockReasonFor?: (guest: Guest) => string | null
  /** Egy múltbeli foglalás kibontható részletei (idő, asztal, létszám, státusz…) + jegyzet. */
  historyDetailFor?: (s: GuestSource) => { rows: Array<{ label: string; value: string }>; note?: string | null }
}

export function buildGuestVMs(guests: Guest[], sources: GuestSource[], opts: BuildOptions = {}): GuestVM[] {
  const today = todayYmd()
  return guests.map((g) => {
    const av = avatarFor(g.key)
    const own = sources.filter((s) => matchKey(s) === g.key && s.status !== 'cancelled' && s.status !== 'no_show')
    const past = own.filter((s) => (s.date ?? '') <= today)
    const upcoming = own.filter((s) => (s.date ?? '') > today)
    // Látogatási ELŐZMÉNYEK = szigorúan a mai nap ELŐTTI látogatások. A mai (aktuális) és a
    // közelgő foglalás NEM „előzmény" — így egy először, ma érkező vendég nem kap history-sort.
    const history: GuestHistoryVM[] = own
      .filter((s) => s.date && (s.date as string) < today)
      .sort((a, b) => (b.date as string).localeCompare(a.date as string))
      .slice(0, 5)
      .map((s) => {
        const detail = opts.historyDetailFor ? opts.historyDetailFor(s) : null
        return {
          d: shortDate(s.date ?? null),
          w: opts.labelFor ? opts.labelFor(s) : 'Foglalás',
          a: (opts.amountFor && opts.amountFor(s)) || '',
          details: detail?.rows,
          note: detail?.note ?? null,
        }
      })

    const fav = opts.favFor ? opts.favFor(g, own) : '—'
    const rows = opts.rowsFor
      ? opts.rowsFor(g, { past, upcoming })
      : [{ label: 'Látogatások', value: String(g.visits) }]
    const birthdayDate = opts.birthdayDateFor ? opts.birthdayDateFor(own) : null
    const notes = opts.noteFor ? opts.noteFor(own) : { guest: null, internal: null }

    return {
      key: g.key,
      name: g.name,
      ini: monogram(g.name),
      av: av.bg,
      avText: av.fg,
      avatarUrl: gravatarUrl(g.email),
      tier: g.tier,
      country: g.country?.trim().toUpperCase() || isoFromPhone(g.phone) || null,
      phone: g.phone,
      email: g.email,
      since: sinceYear(g, sources),
      visits: g.visits,
      lastVisit: g.lastVisit,
      fav,
      loyalty: loyaltyPoints(g),
      rows,
      birthdayDate,
      blocked: opts.blockedFor ? opts.blockedFor(g) : false,
      blockReason: opts.blockReasonFor ? opts.blockReasonFor(g) : null,
      guestNote: notes.guest,
      internalNote: notes.internal,
      advice: tierNote(g),
      meta: `${g.visits} látogatás · utolsó: ${shortDate(g.lastVisit)}`,
      note: tierNote(g),
      history,
    }
  })
}

/**
 * A MAI nap érkezései a nyers foglalásokból (idő szerint növekvő). Görgethető, kattintható:
 * minden elem hordozza a vendég `guestKey`-ét (profilhoz) és az `iso` országot (térkép-fókusz).
 */
/** A legutolsó nap, amelyre van érkezés (ha ma nincs, a legfrissebb létező nap). */
export function latestArrivalDay(sources: GuestSource[]): string | null {
  let max: string | null = null
  for (const s of sources) {
    if (s.status === 'cancelled' || s.status === 'no_show' || !s.date || !isRealGuest(s)) continue
    if (!max || s.date > max) max = s.date
  }
  return max
}

export function buildArrivals(
  guests: Guest[],
  sources: GuestSource[],
  opts: { salon?: boolean; day?: string | null; timeFor?: (s: GuestSource) => string | null; cityFor?: (s: GuestSource) => string | null } = {},
): ArrivalVM[] {
  const byKey = new Map(guests.map((g) => [g.key, g]))
  const day = opts.day ?? todayYmd()
  return sources
    // Csak VALÓS vendéget mérünk itt: a beeső és a telefonos placeholder is kimarad.
    .filter((s) => s.status !== 'cancelled' && s.status !== 'no_show' && s.date === day && isRealGuest(s))
    .sort((a, b) => {
      const ta = opts.timeFor ? opts.timeFor(a) ?? '' : ''
      const tb = opts.timeFor ? opts.timeFor(b) ?? '' : ''
      return ta.localeCompare(tb)
    })
    .map((s, i) => {
      const guestKey = matchKey(s) ?? ''
      const g = guestKey ? byKey.get(guestKey) : undefined
      const av = avatarFor(guestKey || s.name || String(i))
      // Ország: az étteremnél az explicit mező, egyébként (szalon is) a telefonból.
      const iso = s.country?.trim().toUpperCase() || isoFromPhone(s.phone) || null
      // A vendég által beírt város (ha van) előnyt élvez; egyébként az ország fővárosa a fallback.
      const city = opts.cityFor ? opts.cityFor(s) : (s.city?.trim() || (iso ? (ISO2_TO_CAPITAL[iso]?.city ?? null) : null))
      const shownName = g?.name ?? displayName(s)
      return {
        key: `${guestKey}-${i}`,
        guestKey,
        name: shownName,
        ini: monogram(shownName),
        av: av.bg,
        avText: av.fg,
        avatarUrl: gravatarUrl(g?.email ?? s.email),
        time: (opts.timeFor ? opts.timeFor(s) : null)?.slice(0, 5) ?? '',
        when: arrivalWhen(s.date ?? null, opts.timeFor ? opts.timeFor(s) : null),
        country: iso,
        iso,
        city,
      }
    })
}

/** Segéd: HU-arány a látogatásokból (belföldi %). */
export function domesticPct(guests: Guest[]): number {
  let hu = 0
  let known = 0
  for (const g of guests) {
    if (!g.country) continue
    known += g.visits
    if (g.country === 'HU') hu += g.visits
  }
  if (known === 0) return 0
  return Math.round((hu / known) * 100)
}

/** Az e hónapban ELŐSZÖR járt vendégek száma (első foglalás dátuma alapján). */
export function newThisMonth(guests: Guest[], sources: GuestSource[]): number {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstByKey = new Map<string, string>()
  for (const s of sources) {
    if (s.status === 'cancelled' || s.status === 'no_show' || !s.date) continue
    const key = matchKey(s)
    if (!key) continue
    const prev = firstByKey.get(key)
    if (!prev || (s.date as string) < prev) firstByKey.set(key, s.date as string)
  }
  let n = 0
  for (const g of guests) {
    const first = firstByKey.get(g.key)
    if (first && first.startsWith(ym)) n += 1
  }
  return n
}

/** Tier-megoszlás a fejléc StatusPills-éhez (Törzsvendég / Visszatérő / Új). */
export function tierSegments(guests: Guest[]): StatusSeg[] {
  const total = guests.length || 1
  const pct = (n: number) => Math.round((n / total) * 100)
  const t3 = guests.filter((g) => g.tier === 3).length
  const t2 = guests.filter((g) => g.tier === 2).length
  const t1 = guests.filter((g) => g.tier === 1).length
  return [
    { label: 'Törzsvendég', pct: pct(t3), background: '#1D1C19', color: '#fff' },
    { label: 'Visszatérő', pct: pct(t2), background: '#F1CE45', color: '#1D1C19' },
    {
      label: 'Új',
      pct: pct(t1),
      background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)',
      color: '#57564f',
      border: '1px solid var(--dav-line-strong)',
      align: 'end',
    },
  ]
}

export function returningPct(guests: Guest[]): number {
  if (guests.length === 0) return 0
  return Math.round((guests.filter((g) => g.returning).length / guests.length) * 100)
}

export { flagEmoji, TIER_LABEL }
