/**
 * VENDÉGEK view-model építő — a `Guest` aggregátumból és a nyers foglalásokból a Vendégek oldal (design 7.1–7.8)
 * modelljei. Étterem (reservations) ÉS szalon (bookings) egyaránt ezt használja; ami üzlet-függő, azt a hívó adja
 * (`BuildOptions`).
 */

import { createHash } from 'crypto'
import { guestKeyOf, isRealGuest, displayName, type Guest, type GuestSource, type CountryBucket } from '@/lib/guests'
import { isoFromPhone } from '@/lib/phoneCountry'
import type { Customer } from '@/payload/payload-types'
import type { ArrivalVM, GuestHistoryVM, GuestVM } from '@/lib/guestsTypes'

/**
 * Gravatar-URL az e-mailből (md5 hash). `d=blank` → ha nincs profilkép, átlátszó képet ad, így az Avatar alatta lévő
 * monogramja látszik (törött kép-ikon helyett). (Konkrét Google-profilkép csak OAuth-tal érhető el, puszta e-mailből nem.)
 */
export function gravatarUrl(email?: string | null): string | null {
  const e = email?.trim().toLowerCase()
  if (!e) return null
  const hash = createHash('md5').update(e).digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?d=blank&s=160`
}

/** Belföldi/külföldi arány a térkép-bucketekből (foglalás-szinten, HU = belföldi). */
export function originSplit(buckets: CountryBucket[]): { domestic: number; foreign: number } {
  const totalWithCountry = buckets.reduce((a, b) => a + b.count, 0)
  if (totalWithCountry === 0) return { domestic: 0, foreign: 0 }
  const hu = buckets.find((b) => b.iso.toUpperCase() === 'HU')?.count ?? 0
  const domestic = Math.round((hu / totalWithCountry) * 100)
  return { domestic, foreign: 100 - domestic }
}

/** Mai dátum YYYY-MM-DD (helyi idő). */
export function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const realVisit = (s: GuestSource) => s.status !== 'cancelled' && s.status !== 'no_show'

/** Az üzlet-függő részek: mi egy foglalás (szolgáltatás · munkatárs / asztal · létszám), mennyi, mikor stb. */
export interface BuildOptions {
  /** „Balayage · Viktória” / „T5 · 4 fő” */
  whatFor: (s: GuestSource) => string
  /** „48 000 Ft” (szalon), étteremnél null */
  amountFor: (s: GuestSource) => string | null
  timeFor: (s: GuestSource) => string | null
  /** szalon: költés eddig */
  spendFor?: (g: Guest, past: GuestSource[]) => string | null
  /** étterem: átlagos létszám */
  avgPaxFor?: (g: Guest, past: GuestSource[]) => string | null
  /** étterem: a leggyakoribb asztal */
  favTableFor?: (own: GuestSource[]) => string | null
  /** étterem: a foglalás alkalma (évforduló, születésnap…) és ikonja */
  occasionOf?: (s: GuestSource) => { label: string; icon: string | null } | null
  /** egy foglalás megjegyzése (a közelgő foglalás kártyáján) */
  noteOf?: (s: GuestSource) => string | null
  /** a foglaláskor kitöltött egyéni kérdések válaszai */
  answersOf?: (s: GuestSource) => Record<string, { question: string; answer: string }> | null
  /** vendég- és belső megjegyzés (a legfrissebb nem-üres a foglalásokból) */
  noteFor: (own: GuestSource[]) => { guest: string | null; internal: string | null }
  /** a vendég Customers-rekordja (tiltás, kézi adatok, import) */
  customerFor: (g: Guest) => Customer | null
  rating?: (g: Guest) => { average: number; count: number; latestComment?: string | null } | null
}

/** A vendég teljes adatlapja (7.2 / 7.8) és a szerkesztő (7.4) adatai. */
export function buildGuestVM(g: Guest, sources: GuestSource[], opts: BuildOptions): GuestVM {
  const today = todayYmd()
  const all = sources.filter((s) => guestKeyOf(s) === g.key)
  const own = all.filter(realVisit)
  const past = own.filter((s) => (s.date ?? '') < today).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const upcoming = own.filter((s) => (s.date ?? '') >= today).sort((a, b) => `${a.date}${opts.timeFor(a) ?? ''}`.localeCompare(`${b.date}${opts.timeFor(b) ?? ''}`))
  const cust = opts.customerFor(g)
  const first = [...own].map((s) => s.date ?? '').filter(Boolean).sort()[0] ?? g.lastVisit
  const since = first ? String(new Date(first).getFullYear()) : String(new Date().getFullYear())
  const nx = upcoming[0]
  const occ = nx && opts.occasionOf ? opts.occasionOf(nx) : null
  const history: GuestHistoryVM[] = past.slice(0, 5).map((s) => ({ date: s.date ?? '', what: opts.whatFor(s), amount: opts.amountFor(s) }))
  // alkalmak (étterem): alkalmanként a legutóbbi foglalás napja — ebből jön az emlékeztető
  const occasions = new Map<string, { label: string; date: string; icon: string | null }>()
  if (opts.occasionOf) {
    for (const s of [...own].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
      const o = opts.occasionOf(s)
      if (o && s.date) occasions.set(o.label, { label: o.label, date: s.date, icon: o.icon })
    }
  }
  const notes = opts.noteFor(own)
  const rating = opts.rating?.(g) ?? null
  const gender = cust?.gender
  return {
    key: g.key,
    name: g.name,
    avatarUrl: gravatarUrl(g.email),
    tier: g.tier,
    country: g.country?.trim().toUpperCase() || isoFromPhone(g.phone) || null,
    phone: g.phone,
    email: g.email,
    since,
    visits: g.visits,
    lastVisit: g.lastVisit,
    spend: opts.spendFor ? opts.spendFor(g, past) : null,
    noShow: cust?.no_show_count ?? all.filter((s) => s.status === 'no_show').length,
    cancels: cust?.cancellation_count ?? all.filter((s) => s.status === 'cancelled').length,
    avgPax: opts.avgPaxFor ? opts.avgPaxFor(g, past) : null,
    next: nx ? { date: nx.date ?? '', time: opts.timeFor(nx)?.slice(0, 5) ?? null, what: opts.whatFor(nx), occasion: occ?.label ?? null, occasionIcon: occ?.icon ?? null, note: opts.noteOf?.(nx)?.trim() || null } : null,
    // a közelgő foglalás megjegyzése a kártyáján látszik — a „vendégtől” csak ha más
    guestNote: notes.guest && notes.guest !== (nx ? opts.noteOf?.(nx)?.trim() : null) ? notes.guest : null,
    internalNote: cust?.notes?.trim() || notes.internal,
    answers: (() => {
      // kérdés-azonosítónként a legfrissebb válasz (átfogalmazásnál sem szakad ketté)
      const byId = new Map<string, { label: string; value: string }>()
      for (const s of [...own].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
        for (const [id, qa] of Object.entries(opts.answersOf?.(s) ?? {})) if (qa?.answer) byId.set(id, { label: qa.question, value: qa.answer })
      }
      return [...byId.values()]
    })(),
    history,
    rating: rating ? { average: rating.average, count: rating.count, comment: rating.latestComment ?? null } : null,
    blocked: !!cust?.blocked,
    blockReason: cust?.block_reason ?? null,
    favTable: opts.favTableFor ? opts.favTableFor(own) : null,
    occasions: [...occasions.values()],
    record: {
      birthday: cust?.birthday ? cust.birthday.slice(0, 10) : null,
      gender: gender === 'female' || gender === 'male' || gender === 'other' ? gender : null,
      tag: cust?.group_tag ?? null,
      billing: cust && (cust.billing_name || cust.billing_tax_number)
        ? { name: cust.billing_name ?? '', taxNumber: cust.billing_tax_number ?? '', email: cust.billing_email ?? '', postalCode: cust.billing_postal_code ?? '', city: cust.billing_city ?? '', street: cust.billing_street ?? '' }
        : null,
      newsletter: { on: !!cust?.marketing_consent, since: cust?.marketing_consent_at ? cust.marketing_consent_at.slice(0, 10) : null },
      imported: cust && (cust.visit_count != null || cust.cancellation_count != null || cust.total_revenue_huf != null)
        ? { visits: cust.visit_count ?? null, cancels: cust.cancellation_count ?? null, revenue: cust.total_revenue_huf ?? null }
        : null,
    },
  }
}

/** A MAI nap érkezései (7.1 sötét lista) a nyers foglalásokból, idő szerint; minden elem hordozza a vendég kulcsát
 *  (adatlaphoz) és az országot (térkép-fókusz). Beeső / névtelen nem vendég, kimarad. */
export function buildArrivals(guests: Guest[], sources: GuestSource[], opts: { whatFor: (s: GuestSource) => string; timeFor: (s: GuestSource) => string | null }): ArrivalVM[] {
  const byKey = new Map(guests.map((g) => [g.key, g]))
  const day = todayYmd()
  return sources
    .filter((s) => realVisit(s) && s.date === day && isRealGuest(s))
    .sort((a, b) => (opts.timeFor(a) ?? '').localeCompare(opts.timeFor(b) ?? ''))
    .map((s, i) => {
      const guestKey = guestKeyOf(s) ?? ''
      const g = guestKey ? byKey.get(guestKey) : undefined
      return {
        key: `${guestKey}-${i}`,
        guestKey,
        name: g?.name ?? displayName(s),
        time: opts.timeFor(s)?.slice(0, 5) ?? '',
        what: opts.whatFor(s),
        iso: s.country?.trim().toUpperCase() || isoFromPhone(s.phone) || null,
      }
    })
}

/** A fejléc csíkja (7.1): törzsvendég / visszatérő / új / tiltott darabszám. */
export function tierCounts(guests: Guest[], blockedOf: (g: Guest) => boolean) {
  return {
    regular: guests.filter((g) => g.tier === 3).length,
    returning: guests.filter((g) => g.tier === 2).length,
    fresh: guests.filter((g) => g.tier === 1).length,
    blocked: guests.filter(blockedOf).length,
  }
}

export function returningPct(guests: Guest[]): number {
  if (guests.length === 0) return 0
  const pct = (guests.filter((g) => g.returning).length / guests.length) * 100
  // 10% alatt egy tizedes — különben pl. 7 visszatérő / 1883 vendég „0%”-nak látszik
  return pct < 10 ? Math.round(pct * 10) / 10 : Math.round(pct)
}
