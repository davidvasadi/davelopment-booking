import { getISOWeek } from 'date-fns'
import type { Restaurant, Salon } from '@/payload/payload-types'
import type { DashboardStats } from './dashboardStats'
import type { RestaurantStats } from './restaurantStats'

/**
 * TIPPEK — advisor motor. A `/tips` oldal (Crextio „Tippek — Javaslatok több
 * foglaláshoz és jobb vendégélményhez") szerver-oldali agya. VALÓS adatból dolgozik:
 * a business config-teljességéből health-score-t, a meglévő analitikából (getDashboardStats
 * / getRestaurantStats) determinisztikus „E heti tipp"-et, és kategorizált, akcióképes
 * javaslat-kártyákat állít elő. Tiszta függvények, mock nélkül.
 */

export type TipCategory = 'foglalas' | 'vendegelmeny' | 'marketing' | 'profil'

/** A kártya-akció: vagy azonnali PATCH a business-re (kész body), vagy navigáció. */
export type TipAction =
  | { kind: 'patch'; body: Record<string, unknown>; toast: string }
  | { kind: 'nav'; href: string }

export type ChecklistItem = {
  id: string
  label: string
  category: TipCategory
  done: boolean
  href: string
}

export type WeeklyTip = {
  id: string
  title: string
  body: string
  /** Kiemelt (gold) metrika-frázis a body után, pl. „a legerősebb napod". */
  metric?: string
  actionLabel: string
  action: TipAction
}

export type TipCard = {
  id: string
  category: TipCategory
  title: string
  desc: string
  /** Rövid hatás-hint a kártya alján (pl. „akár 2× több foglalás"). */
  impact?: string
  state: 'apply' | 'enabled'
  action: TipAction
}

export type HealthStatus = 'weak' | 'ok' | 'good' | 'excellent'

export type AdvisorResult = {
  variant: 'salon' | 'restaurant'
  healthScore: number
  healthStatus: HealthStatus
  healthLabel: string
  checklist: ChecklistItem[]
  weeklyTip: WeeklyTip | null
  recommendations: TipCard[]
}

/* ────────────────────────── feature_modules ────────────────────────── */

type FeatureModules = NonNullable<Restaurant['feature_modules']>
/** Csak a boolean modul-kapcsolók (a `google_review_url` string, azt külön őrizzük meg). */
type FeatureBooleans = {
  reminders_on: boolean; reminder_ch_email: boolean; reminder_ch_push: boolean
  reminder_t_24h: boolean; reminder_t_3h: boolean; reminder_t_1h: boolean
  waitlist_on: boolean; waitlist_auto_promote: boolean
  recurring_on: boolean; reviews_on: boolean
}

/** A boolean modul-kapcsolók alapértelmezett-kitöltött változata (a /tips oldal korábbi
 *  defaultjait tükrözi: emlékeztető alapból BE). */
function fullFeatures(fm: FeatureModules | null | undefined): FeatureBooleans {
  return {
    reminders_on: fm?.reminders_on ?? true,
    reminder_ch_email: fm?.reminder_ch_email ?? true,
    reminder_ch_push: fm?.reminder_ch_push ?? false,
    reminder_t_24h: fm?.reminder_t_24h ?? true,
    reminder_t_3h: fm?.reminder_t_3h ?? true,
    reminder_t_1h: fm?.reminder_t_1h ?? false,
    waitlist_on: fm?.waitlist_on ?? false,
    waitlist_auto_promote: fm?.waitlist_auto_promote ?? false,
    recurring_on: fm?.recurring_on ?? false,
    reviews_on: fm?.reviews_on ?? false,
  }
}

/** A TELJES group PATCH-body: normalizált boolean-ök + a MEGŐRZÖTT `google_review_url` +
 *  a kért flip. Mindig a teljes groupot küldjük, hogy egy-mező-flip ne törölje a többit
 *  (a végpont a groupot cserélheti); a `google_review_url` így nem vész el. */
function enableFeatureBody(fm: FeatureModules | null | undefined, changes: Partial<FeatureBooleans>): Record<string, unknown> {
  return {
    feature_modules: { ...fullFeatures(fm), google_review_url: fm?.google_review_url ?? null, ...changes },
  }
}

/* ────────────────────────── helpers ────────────────────────── */

function has(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'object') return true
  return Boolean(v)
}

/** A szalon leírása richText objektum, az étteremé sima string — mindkettőt lefedi. */
function hasDescription(b: Salon | Restaurant): boolean {
  const d = (b as Salon | Restaurant).description as unknown
  if (!d) return false
  if (typeof d === 'string') return d.trim().length > 0
  const children = (d as { root?: { children?: unknown[] } })?.root?.children
  return Array.isArray(children) && children.length > 0
}

function statusFromScore(score: number): HealthStatus {
  if (score < 40) return 'weak'
  if (score < 65) return 'ok'
  if (score < 85) return 'good'
  return 'excellent'
}

const STATUS_WORD: Record<HealthStatus, string> = {
  weak: 'Gyenge',
  ok: 'Közepes',
  good: 'Jó',
  excellent: 'Kiváló',
}

/** A hét sorszáma → determinisztikus kiválasztás (nem random, de hetente forog). */
function currentIsoWeek(): number {
  return getISOWeek(new Date())
}

/* ────────────────────────── config checks (közös) ────────────────────────── */

export type SetupFlags = {
  /** Van-e beállított nyitvatartás (legalább egy nyitott nap). */
  openingHours: boolean
  /** Van-e kínálat (szalon: szolgáltatás, étterem: asztal). */
  catalog: boolean
}

type Weighted = { item: ChecklistItem; weight: number }

/**
 * A közös config-teljességi checklist (health-score + a health-kártya mini-listája),
 * ÉS a hátralévő elemekből képzett javaslat-kártyák.
 */
function buildConfigChecks(
  variant: 'salon' | 'restaurant',
  b: Salon | Restaurant,
  setup: SetupFlags,
): { checks: Weighted[]; cards: TipCard[] } {
  const base = variant === 'salon' ? '/dashboard' : '/restaurant'
  const settings = `${base}/settings`
  const catalogHref = variant === 'salon' ? `${base}/services` : `${base}/tables`
  const catalogWord = variant === 'salon' ? 'szolgáltatás' : 'asztal'
  const locales = b.supported_locales ?? []
  const multilingual = locales.length > 1

  // [id, label, category, done, href, weight, card?]
  const defs: {
    id: string
    label: string
    category: TipCategory
    done: boolean
    href: string
    weight: number
    card?: { title: string; desc: string; impact?: string }
  }[] = [
    {
      id: 'cover',
      label: 'Borítókép feltöltve',
      category: 'profil',
      done: has(b.cover_image),
      href: settings,
      weight: 2,
      card: {
        title: 'Tölts fel borítóképet',
        desc: 'A képes foglaló oldalak jóval több foglalást hoznak.',
        impact: 'akár 2× foglalás',
      },
    },
    {
      id: 'logo',
      label: 'Logó feltöltve',
      category: 'profil',
      done: has(b.logo),
      href: settings,
      weight: 1,
    },
    {
      id: 'description',
      label: 'Bemutatkozás kitöltve',
      category: 'profil',
      done: hasDescription(b),
      href: settings,
      weight: 1,
      card: {
        title: 'Írj rövid bemutatkozást',
        desc: 'Pár mondat a helyről — a vendégek szívesebben foglalnak ismerős helyre.',
      },
    },
    {
      id: 'contact',
      label: 'Cím és telefonszám megadva',
      category: 'profil',
      done: has(b.address) && has(b.phone),
      href: settings,
      weight: 1,
      card: {
        title: 'Add meg a cím és telefon adatokat',
        desc: 'A vendégek megtalálnak és el tudnak érni.',
      },
    },
    {
      id: 'hours',
      label: 'Nyitvatartás beállítva',
      category: 'foglalas',
      done: setup.openingHours,
      href: `${base}/availability`,
      weight: 2,
      card: {
        title: 'Állítsd be a nyitvatartást',
        desc: 'Nyitvatartás nélkül a vendégek nem tudnak online foglalni.',
      },
    },
    {
      id: 'catalog',
      label: variant === 'salon' ? 'Szolgáltatás hozzáadva' : 'Asztal hozzáadva',
      category: 'foglalas',
      done: setup.catalog,
      href: catalogHref,
      weight: 2,
      card: {
        title: variant === 'salon' ? 'Vegyél fel szolgáltatásokat' : 'Vegyél fel asztalokat',
        desc: `Legalább egy ${catalogWord} kell, hogy induljon a foglalás.`,
      },
    },
    {
      id: 'good_to_know',
      label: '„Jó tudni" pontok kitöltve',
      category: 'foglalas',
      done: (b.good_to_know ?? []).length > 0,
      href: settings,
      weight: 1,
      card: {
        title: 'Töltsd ki a „Jó tudni" pontokat',
        desc: 'Parkolás, érkezés, dress code — kevesebb kérdés telefonon.',
      },
    },
    {
      id: 'languages',
      label: 'Többnyelvű oldal bekapcsolva',
      category: 'marketing',
      done: multilingual,
      href: settings,
      weight: 1,
      card: {
        title: 'Kapcsold be a többnyelvű oldalt',
        desc: 'Angol és német nyelvvel a külföldi vendégeket is eléred.',
      },
    },
  ]

  const checks: Weighted[] = defs.map((d) => ({
    item: { id: d.id, label: d.label, category: d.category, done: d.done, href: d.href },
    weight: d.weight,
  }))

  const cards: TipCard[] = defs
    .filter((d) => d.card && !d.done)
    .map((d) => ({
      id: `cfg-${d.id}`,
      category: d.category,
      title: d.card!.title,
      desc: d.card!.desc,
      impact: d.card!.impact,
      state: 'apply' as const,
      action: { kind: 'nav', href: d.href } as TipAction,
    }))

  return { checks, cards }
}

/* ────────────────────────── feature-toggle kártyák (közös) ────────────────────────── */

function buildFeatureCards(b: Salon | Restaurant, variant: 'salon' | 'restaurant'): TipCard[] {
  const full = fullFeatures(b.feature_modules)
  const visitWord = variant === 'salon' ? 'kezelés' : 'látogatás'

  const defs: {
    id: string
    on: boolean
    changes: Partial<FeatureBooleans>
    category: TipCategory
    title: string
    desc: string
    impact?: string
    toast: string
  }[] = [
    {
      id: 'reminders',
      on: full.reminders_on,
      changes: { reminders_on: true, reminder_ch_email: true, reminder_t_24h: true },
      category: 'vendegelmeny',
      title: 'Állíts be emlékeztetőt',
      desc: 'Automatikus emlékeztető 24 órával a foglalás előtt, e-mailben.',
      impact: 'kevesebb elmaradás',
      toast: 'Emlékeztetők bekapcsolva',
    },
    {
      id: 'reviews',
      on: full.reviews_on,
      changes: { reviews_on: true },
      category: 'vendegelmeny',
      title: 'Kérj értékelést',
      desc: `Automatikus értékelés-kérő a ${visitWord} után — több visszajelzés, jobb hírnév.`,
      impact: 'jobb hírnév',
      toast: 'Értékeléskérés bekapcsolva',
    },
    {
      id: 'waitlist',
      on: full.waitlist_on,
      changes: { waitlist_on: true, waitlist_auto_promote: true },
      category: 'foglalas',
      title: 'Kapcsold be a várólistát',
      desc: 'Telt házkor automatikus sorba állítás — ne veszíts el egy vendéget se.',
      impact: 'nulla elveszett vendég',
      toast: 'Várólista bekapcsolva',
    },
  ]

  return defs.map((d) => ({
    id: `feat-${d.id}`,
    category: d.category,
    title: d.title,
    desc: d.desc,
    impact: d.impact,
    state: d.on ? ('enabled' as const) : ('apply' as const),
    action: d.on
      ? ({ kind: 'nav', href: `${variant === 'salon' ? '/dashboard' : '/restaurant'}/settings` } as TipAction)
      : ({ kind: 'patch', body: enableFeatureBody(b.feature_modules, d.changes), toast: d.toast } as TipAction),
  }))
}

/* require_phone külön top-level flag (nem feature_modules). */
function requirePhoneCard(b: Salon | Restaurant): TipCard {
  const on = b.require_phone === true
  return {
    id: 'flag-require_phone',
    category: 'vendegelmeny',
    title: 'Kérj telefonszámot',
    desc: 'Kötelező telefonszámmal jóval kevesebb a meg nem jelenő vendég.',
    impact: 'kevesebb no-show',
    state: on ? 'enabled' : 'apply',
    action: on
      ? { kind: 'nav', href: '#' }
      : { kind: 'patch', body: { require_phone: true }, toast: 'Telefonszám mostantól kötelező' },
  }
}

/* ────────────────────────── összegzés (közös) ────────────────────────── */

function assemble(
  variant: 'salon' | 'restaurant',
  checks: Weighted[],
  weeklyTip: WeeklyTip | null,
  recommendations: TipCard[],
): AdvisorResult {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
  const doneWeight = checks.reduce((s, c) => s + (c.item.done ? c.weight : 0), 0)
  const healthScore = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0
  const healthStatus = statusFromScore(healthScore)
  const pending = checks.filter((c) => !c.item.done).length
  const healthLabel =
    pending === 0 ? `${STATUS_WORD[healthStatus]} · minden kész` : `${STATUS_WORD[healthStatus]} · ${pending} teendő van`

  // A kártyák közül a már „enabled" feature-kártyák a lista VÉGÉRE, a tennivalók előre.
  const recs = [...recommendations].sort((a, b) => (a.state === b.state ? 0 : a.state === 'apply' ? -1 : 1))

  return {
    variant,
    healthScore,
    healthStatus,
    healthLabel,
    checklist: checks.map((c) => c.item),
    weeklyTip,
    recommendations: recs,
  }
}

/* ────────────────────────── E heti tipp — determinisztikus kiválasztás ────────────────────────── */

type Candidate = WeeklyTip & { priority: number }

function pickWeekly(candidates: Candidate[]): WeeklyTip | null {
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => b.priority - a.priority)
  // A top-3 közül hetente forgatva (ISO-hét) — így nem ugyanaz minden héten, de mindig releváns.
  const topN = sorted.slice(0, Math.min(3, sorted.length))
  const pick = topN[currentIsoWeek() % topN.length]
  const { priority: _p, ...tip } = pick
  return tip
}

/* ────────────────────────── SZALON advisor ────────────────────────── */

export function buildSalonAdvisor(salon: Salon, setup: SetupFlags, stats: DashboardStats): AdvisorResult {
  const { checks, cards: configCards } = buildConfigChecks('salon', salon, setup)
  const featureCards = buildFeatureCards(salon, 'salon')
  const recommendations = [...configCards, ...featureCards, requirePhoneCard(salon)]

  const base = '/dashboard'
  const candidates: Candidate[] = []
  const enoughData = stats.periodBookings >= 5

  if (enoughData && stats.bestDay) {
    const max = Math.max(...stats.byDayOfWeek.map((d) => d.bookings))
    const total = stats.byDayOfWeek.reduce((s, d) => s + d.bookings, 0)
    const share = total > 0 ? Math.round((max / total) * 100) : 0
    candidates.push({
      id: 'busy-day',
      title: `${stats.bestDay} a legerősebb napod`,
      body: `A foglalásaid ${share}%-a erre a napra esik. Erősítsd meg más napokat egy akcióval, vagy nyiss több idősávot ${stats.bestDay.toLowerCase()}re.`,
      metric: `${share}% egy napon`,
      actionLabel: 'Nyitvatartás megnyitása',
      action: { kind: 'nav', href: `${base}/availability` },
      priority: 40 + share,
    })
  }

  if (enoughData && stats.completionRate < 80) {
    const off = !(salon.feature_modules?.reminders_on ?? true)
    candidates.push({
      id: 'low-completion',
      title: 'Csökkentsd a lemondásokat emlékeztetővel',
      body: `A teljesítési arányod ${stats.completionRate}%. Egy automatikus emlékeztető a foglalás előtt érezhetően csökkenti a lemondást és a meg nem jelenést.`,
      metric: `${stats.completionRate}% teljesítés`,
      actionLabel: off ? 'Emlékeztető bekapcsolása' : 'Beállítások',
      action: off
        ? { kind: 'patch', body: enableFeatureBody(salon.feature_modules, { reminders_on: true, reminder_ch_email: true, reminder_t_24h: true }), toast: 'Emlékeztetők bekapcsolva' }
        : { kind: 'nav', href: `${base}/settings` },
      priority: 60 + (80 - stats.completionRate),
    })
  }

  if (enoughData && stats.byService[0]) {
    candidates.push({
      id: 'top-service',
      title: `A(z) „${stats.byService[0].name}" viszi a foglalásokat`,
      body: 'A legnépszerűbb szolgáltatásod — emeld ki a foglaló oldal tetején, és ajánld a visszatérő vendégeknek.',
      metric: `${stats.byService[0].bookings} foglalás`,
      actionLabel: 'Szolgáltatások',
      action: { kind: 'nav', href: `${base}/services` },
      priority: 30,
    })
  }

  // Kevés adat → onboarding-tipp (a legfontosabb hiányzó config).
  const firstMissing = checks.find((c) => !c.item.done)
  if (candidates.length === 0 && firstMissing) {
    candidates.push({
      id: `setup-${firstMissing.item.id}`,
      title: 'Fejezd be a beüzemelést',
      body: `Még hiányzik: ${firstMissing.item.label.toLowerCase()}. Ezzel máris profibb a foglaló oldalad, és jöhetnek a foglalások.`,
      actionLabel: 'Beállítás',
      action: { kind: 'nav', href: firstMissing.item.href },
      priority: 10,
    })
  }

  return assemble('salon', checks, pickWeekly(candidates), recommendations)
}

/* ────────────────────────── ÉTTEREM advisor ────────────────────────── */

export function buildRestaurantAdvisor(
  restaurant: Restaurant,
  setup: SetupFlags,
  stats: RestaurantStats,
): AdvisorResult {
  const { checks, cards: configCards } = buildConfigChecks('restaurant', restaurant, setup)
  const featureCards = buildFeatureCards(restaurant, 'restaurant')
  const recommendations = [...configCards, ...featureCards, requirePhoneCard(restaurant)]

  const base = '/restaurant'
  const candidates: Candidate[] = []
  const enoughData = stats.periodReservations >= 5

  if (enoughData && stats.bestDay) {
    const max = Math.max(...stats.byDayOfWeek.map((d) => d.bookings))
    const total = stats.byDayOfWeek.reduce((s, d) => s + d.bookings, 0)
    const share = total > 0 ? Math.round((max / total) * 100) : 0
    candidates.push({
      id: 'busy-day',
      title: `Növeld a ${stats.bestDay.toLowerCase()}i kihasználtságot egy korai idősávval`,
      body: `A ${stats.bestDay.toLowerCase()} a legerősebb napod — a foglalásaid ${share}%-a ekkor van, sok vendég nem fér be. Nyiss egy korábbi sávot, hogy több asztalt fordíts.`,
      metric: `${share}% egy napon`,
      actionLabel: 'Idősáv megnyitása',
      action: { kind: 'nav', href: `${base}/availability` },
      priority: 45 + share,
    })
  }

  if (enoughData && stats.noShowRate >= 6) {
    const phoneOff = restaurant.require_phone !== true
    candidates.push({
      id: 'high-noshow',
      title: 'Magas a meg nem jelenők aránya',
      body: `A vendégek ${stats.noShowRate}%-a nem jelenik meg. ${phoneOff ? 'Tedd kötelezővé a telefonszámot' : 'Kapcsold be az emlékeztetőt'} — ez a leggyorsabb módja csökkenteni a no-show-t.`,
      metric: `${stats.noShowRate}% no-show`,
      actionLabel: phoneOff ? 'Telefonszám kötelező' : 'Emlékeztető bekapcsolása',
      action: phoneOff
        ? { kind: 'patch', body: { require_phone: true }, toast: 'Telefonszám mostantól kötelező' }
        : { kind: 'patch', body: enableFeatureBody(restaurant.feature_modules, { reminders_on: true, reminder_ch_email: true, reminder_t_24h: true }), toast: 'Emlékeztetők bekapcsolva' },
      priority: 70 + stats.noShowRate,
    })
  }

  if (enoughData && stats.periodPax > 0) {
    const onlineShare = Math.round((stats.onlineReservations / stats.periodPax) * 100)
    if (onlineShare < 50) {
      candidates.push({
        id: 'low-online',
        title: 'Terelj több foglalást online',
        body: `A vendégeidnek csak ${onlineShare}%-a foglal online — a többi telefon/beeső. Oszd meg a foglaló linkedet a közösségi oldalakon és a Google-profilodon.`,
        metric: `${onlineShare}% online`,
        actionLabel: 'Foglaló oldal',
        action: { kind: 'nav', href: `${base}/settings` },
        priority: 35 + (50 - onlineShare),
      })
    }
  }

  const firstMissing = checks.find((c) => !c.item.done)
  if (candidates.length === 0 && firstMissing) {
    candidates.push({
      id: `setup-${firstMissing.item.id}`,
      title: 'Fejezd be a beüzemelést',
      body: `Még hiányzik: ${firstMissing.item.label.toLowerCase()}. Ezzel kész a foglaló oldalad, és indulhatnak a foglalások.`,
      actionLabel: 'Beállítás',
      action: { kind: 'nav', href: firstMissing.item.href },
      priority: 10,
    })
  }

  return assemble('restaurant', checks, pickWeekly(candidates), recommendations)
}
