/**
 * Backstage „hely"-segéd — a platform kétféle üzletet kezel: **szalon** és **étterem**.
 * Eddig minden backstage-oldal csak a `salon` ágat olvasta, ezért az étterem-előfizetések
 * „—"-ként jelentek meg és az éttermek „hiányoztak". Ez a modul egységesíti a hely-feloldást
 * és a terv/státusz címkéket egy helyen (korábban 3 oldalon duplikálva, eltérő tartalommal).
 */
import type { Subscription, Salon, Restaurant, User } from '@/payload/payload-types'

export type PlaceKind = 'salon' | 'restaurant'

export type Place = {
  kind: PlaceKind
  id: string
  name: string
  slug: string
  city?: string | null
  is_active?: boolean | null
  createdAt: string
  owner: User | null
}

/** A két üzlet-collection közös, UI-hoz releváns mezői egységes alakra hozva. */
export function toPlace(kind: PlaceKind, doc: Salon | Restaurant): Place {
  const owner = doc.owner && typeof doc.owner === 'object' ? (doc.owner as User) : null
  return {
    kind,
    id: String(doc.id),
    name: doc.name,
    slug: doc.slug,
    city: doc.city ?? null,
    is_active: doc.is_active ?? null,
    createdAt: doc.createdAt,
    owner,
  }
}

/**
 * Fiók-szintű modell: az előfizetés a `owner` userhez kötött (nem üzlethez). Innen az owner
 * id-ját adjuk vissza — a backstage ezzel köti a subot a fiók HELYEIHEZ (egy fiók-sub a user
 * összes szalonját + éttermét fedi). String id vagy null.
 */
export function ownerIdOfSubscription(sub: Subscription): string | null {
  const id = sub.owner && typeof sub.owner === 'object' ? sub.owner.id : sub.owner
  return id != null ? String(id) : null
}

/** Egy Place owner-id-ja (a hely tulajdonosa). */
export function ownerIdOfPlace(p: Place): string | null {
  return p.owner?.id != null ? String(p.owner.id) : null
}

/** A publikus oldal mindkét típusnál `/{slug}` ([slug] route szalont és éttermet is kiszolgál). */
export function placePublicUrl(place: Pick<Place, 'slug'>): string {
  return `/${place.slug}`
}

// ── Terv / státusz címkék + színek (egységesen, mindkét típusra) ──────────────

/**
 * Terv-címkék (ár NÉLKÜL — az ár dinamikus, a globális árazásból jön, ezért nem hardcode-oljuk
 * a címkébe). `restaurant_pro` is (eddig hiányzott a backstage selectből → étterem-subnál rossz volt).
 */
export const PLAN_LABELS: Record<string, string> = {
  trial: 'Próbaidőszak',
  paid: 'Fizető',
  // régi kulcsok (kompatibilitás): a fiók-szintű modell előtt üzlet-szintűek voltak
  pro: 'Szalon Pro',
  restaurant_pro: 'Étterem Pro',
}

/**
 * Egy előfizetés tényleges havi díja forintban — az MRR alapja. A `amount_huf` a BEFAGYOTT
 * tényleges ár (amit az ügyfél most fizet): ár-emeléskor a régi ügyfél a ciklusa végéig a
 * régi árat tartja, ezért az MRR a tárolt `amount_huf`-ot tükrözi, NEM a globális plan-árat.
 * Trial alatt 0 (nincs számlázás). Fallback: ha valamiért nincs tárolt összeg.
 */
export function subAmountHuf(sub: { plan?: string | null; status?: string | null; amount_huf?: number | null }): number {
  if (sub.plan === 'trial' || sub.status === 'trialing') return 0
  return sub.amount_huf ?? 0
}

export const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-blue-500/10 text-blue-500',
  paid: 'bg-violet-500/10 text-violet-400',
  pro: 'bg-violet-500/10 text-violet-400',
  restaurant_pro: 'bg-violet-500/10 text-violet-400',
}

export const STATUS_LABELS: Record<string, string> = {
  trialing: 'Próbaidőszak',
  active: 'Aktív',
  past_due: 'Lejárt fizetés',
  canceled: 'Megszakítva',
  paused: 'Szüneteltetett',
}

export const STATUS_COLORS: Record<string, string> = {
  trialing: 'bg-blue-500/10 text-blue-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  past_due: 'bg-red-500/10 text-red-400',
  canceled: 'bg-zinc-100 dark:bg-zinc-500/10 text-zinc-500',
  paused: 'bg-amber-500/10 text-amber-400',
}

/** Egy Tailwind class-stringből kiszedi a `text-*` színt (a badge ikon+szöveg színezéséhez). */
export function textColorOf(classes: string | undefined): string {
  return classes?.split(' ').find(c => c.startsWith('text-')) ?? 'text-zinc-500'
}

/**
 * Több-üzlet (multi-tenant) áttekintés a backstage listákhoz: `ownerId → üzletszám` map.
 * A helyek (szalon+étterem) owner-e alapján számolja, hány üzlet tartozik egy fiókhoz.
 * Így a listákban jelezhető „N üzletből", amikor egy owner több üzletet birtokol.
 */
export function buildOwnerBusinessCount(places: Pick<Place, 'owner'>[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of places) {
    const id = p.owner?.id != null ? String(p.owner.id) : null
    if (!id) continue
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return map
}
