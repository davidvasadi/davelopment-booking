import type { Payload } from 'payload'
import type { Customer } from '@/payload/payload-types'
import type { ComposerBlock } from '@/lib/emailBlocks'
import { LOCALES, type Locale } from '@/lib/i18n'

/**
 * A Marketing „Kinek megy” szegmensei (design 13.4). `all` = minden feliratkozott; a többi szűkít, és egymással
 * VAGY-kapcsolatban áll (pl. Törzsvendégek + 90 napja nem járt = aki bármelyikbe beletartozik).
 * - Törzsvendég: legalább 4 nem lemondott foglalás (ugyanaz a határ, mint a Vendégek oldalon — `lib/guests` tierFor);
 * - 90 napja nem járt: volt már foglalása, de az utolsó 90 napnál régebbi;
 * - Szülinaposok (szalon): a születésnapja a következő 30 napba esik;
 * - Céges vendégek (étterem): van számlázási adószáma.
 */
export type Segment = 'all' | 'regular' | 'lapsed' | 'birthday' | 'company'
export const SEGMENT_LABEL: Record<Segment, string> = { all: 'Feliratkozottak', regular: 'Törzsvendégek', lapsed: '90 napja nem járt', birthday: 'Szülinaposok', company: 'Céges vendégek' }
export const segmentsFor = (kind: 'salon' | 'restaurant'): Segment[] => ['all', 'regular', 'lapsed', kind === 'salon' ? 'birthday' : 'company']

export const parseSegments = (v: unknown): Segment[] => {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []
  const ok = arr.map((x) => String(x).trim()).filter((x): x is Segment => x in SEGMENT_LABEL)
  return ok.length ? [...new Set(ok)] : ['all']
}
export const audienceLabel = (segs: Segment[], picked = 0) => (picked ? `${picked} kijelölt vendég` : segs.map((s) => SEGMENT_LABEL[s]).join(', '))

/** A kampány más nyelvű változatai (a magyar a fő mezőkben). Üres tárgyú nyelv = nincs fordítás → a vendég magyarul kapja. */
export type CampaignTranslations = Partial<Record<Exclude<Locale, 'hu'>, { subject: string; blocks: ComposerBlock[] }>>
export function parseTranslations(v: unknown): CampaignTranslations {
  const out: CampaignTranslations = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (k === 'hu' || !(LOCALES as string[]).includes(k) || !x || typeof x !== 'object') continue
    const { subject, blocks } = x as { subject?: unknown; blocks?: unknown }
    out[k as Exclude<Locale, 'hu'>] = { subject: typeof subject === 'string' ? subject : '', blocks: Array.isArray(blocks) ? (blocks as ComposerBlock[]) : [] }
  }
  return out
}
/** a nyelv, amin a fordítás tényleg küldhető (van tárgya és tartalma) */
export const usableTranslation = (tr: CampaignTranslations, loc: Locale) => (loc !== 'hu' && tr[loc]?.subject.trim() && tr[loc]!.blocks.length ? tr[loc]! : null)

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** A szegmensekbe tartozó feliratkozott vendégek azonosítói; `null` = mindenki (nincs szűkítés). */
export async function resolveSegmentIds(payload: Payload, kind: 'salon' | 'restaurant', businessId: string | number, segs: Segment[]): Promise<string[] | null> {
  if (!segs.length || segs.includes('all')) return null
  const subs = (await payload.find({
    collection: 'customers', where: { and: [{ [kind]: { equals: businessId } }, { marketing_consent: { equals: true } }] }, limit: 5000, depth: 0, overrideAccess: true,
    select: { customer_email: true, birthday: true, billing_tax_number: true, visit_count: true } as never,
  })).docs as Customer[]
  const needVisits = segs.includes('regular') || segs.includes('lapsed')
  const visits = new Map<string, { n: number; last: string }>()
  if (needVisits) {
    const emails = [...new Set(subs.map((c) => (c.customer_email ?? '').toLowerCase()).filter(Boolean))]
    if (emails.length) {
      const rows = (await payload.find({
        collection: kind === 'salon' ? 'bookings' : 'reservations', where: { and: [{ [kind]: { equals: businessId } }, { customer_email: { in: emails } }, { status: { not_in: ['cancelled', 'no_show'] } }] },
        limit: 50000, depth: 0, overrideAccess: true, select: { customer_email: true, date: true } as never,
      })).docs as { customer_email?: string | null; date?: string | null }[]
      for (const r of rows) {
        const e = (r.customer_email ?? '').toLowerCase(); const d = (r.date ?? '').slice(0, 10)
        const v = visits.get(e) ?? { n: 0, last: '' }
        v.n += 1; if (d > v.last) v.last = d
        visits.set(e, v)
      }
    }
  }
  const today = new Date()
  const cutoff = ymd(new Date(today.getTime() - 90 * 86_400_000))
  const todayYmd = ymd(today)
  const inNext30 = (b?: string | null) => {
    if (!b) return false
    const bd = new Date(b); if (Number.isNaN(bd.getTime())) return false
    for (let i = 0; i <= 30; i++) { const d = new Date(today.getTime() + i * 86_400_000); if (d.getMonth() === bd.getMonth() && d.getDate() === bd.getDate()) return true }
    return false
  }
  return subs.filter((c) => {
    const v = visits.get((c.customer_email ?? '').toLowerCase())
    // törzsvendég: legalább 4 látogatás — a nálunk lévő foglalások, vagy (importált vendégnél) a régi rendszer
    // látogatásszáma, ha az több (az import csak az első és az utolsó látogatást hozza át foglalásként)
    const visitsTotal = Math.max(v?.n ?? 0, Number(c.visit_count ?? 0))
    return (segs.includes('regular') && visitsTotal >= 4)
      || (segs.includes('lapsed') && !!v && v.last < cutoff && v.last <= todayYmd)
      || (segs.includes('birthday') && inNext30(c.birthday))
      || (segs.includes('company') && !!c.billing_tax_number?.trim())
  }).map((c) => String(c.id))
}
