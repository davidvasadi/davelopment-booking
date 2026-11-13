import { getPayloadClient } from '@/lib/payload'
import { fixMediaUrl } from '@/lib/utils'
import { getPricing } from '@/lib/pricing'
import { monthlyEmailCapForTier, resolveTier } from '@/lib/tier'
import { parseEmailBlocks, type ComposerBlock } from '@/lib/emailBlocks'
import { audienceLabel, parseSegments, parseTranslations, type CampaignTranslations, type Segment } from '@/lib/marketingSegments'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import type { Customer, EmailLogEntry, MarketingCampaign, Salon, Restaurant, Media } from '@/payload/payload-types'

/**
 * A Marketing oldal (design 13.1–13.8) adatai VALÓS adatból — szalon és étterem közös.
 * - fejléc: e havi kiküldött / megnyitott levelek a csomag keretéhez;
 * - kampányok: kiküldöttnél megnyitás, kattintás, „foglalás belőle” (2026-11-13-tól pontos: a levél foglalás-linkjéről
 *   `?c=` jelöléssel jött foglalások — lib/campaignAttribution; korábban a „7 napon belül foglalt” becslés), naponkénti megnyitás, linkenkénti kattintás (Resend click tracking), leiratkozók;
 * - feliratkozók: foglalás-szám, utoljára megnyitott levél.
 */

export type CampaignStatus = 'sent' | 'scheduled' | 'draft'
export interface CampaignVM {
  id: string
  subject: string
  status: CampaignStatus
  /** kiküldés / létrehozás ideje */
  at: string
  scheduledAt: string | null
  updatedAt: string
  recipients: number
  targeted: boolean
  /** a „Kinek megy” szegmensei és a felirat (pl. „Feliratkozottak, Törzsvendégek” / „12 kijelölt vendég”) */
  segments: Segment[]
  audience: string
  /** kézzel kijelölt címzettek (a 13.5 ablakból) — szegmensnél üres */
  pickedIds: string[]
  blocks: ComposerBlock[]
  /** a többi nyelv változata (tárgy + blokkok) */
  translations: CampaignTranslations
  targetIds: string[] | null
  stats: null | {
    opened: number; clicked: number; booked: number; unsubscribed: number
    /** a kiküldés napjától 6 nap, naponta a megnyitók */
    perDay: { d: string; v: number }[]
    links: { url: string; label: string; n: number }[]
    notOpened: number
    /** az azóta feliratkozottak (akiknek még nem ment ki) */
    newSince: number
  }
}
/** `lastVisit`: a legutóbbi (nem lemondott) foglalás napja; `received` / `opened`: hány kampányt kapott, hányat nyitott meg */
export interface SubscriberVM { id: string; name: string; email: string; city: string; country: string | null; since: string; bookings: number; lastVisit: string | null; received: number; opened: number; lastOpen: { at: string; subject: string } | null }
export interface MarketingVM {
  month: { used: number; opened: number; cap: number; tier: string }
  subscribers: number
  unsubscribed: number
  campaigns: CampaignVM[]
  subscriberPage: SubscriberVM[]
  subscriberMore: boolean
  countries: string[]
  bookingUrl: string
  /** az üzlet nyelvei (HU mindig az első) — a kampány ezeken írható */
  locales: Locale[]
  /** a „Foglalta már” szűrő elemei — szalonnál a szolgáltatások, étteremnél a foglalt alkalmak (születésnap, randi…) */
  services: { id: string; name: string }[]
}

const DAY = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']
const startOfMonthIso = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString() }
const relId = (v: unknown) => (v == null ? null : typeof v === 'object' ? String((v as { id: unknown }).id) : String(v))
/** a link rövid neve: a gomb felirata, ha ismert, különben a cím (domain + útvonal) */
const linkLabel = (url: string, blocks: ComposerBlock[]) => {
  const btn = blocks.find((b) => b.type === 'button' && (b as { url?: string }).url === url) as { label?: string } | undefined
  if (btn?.label) return btn.label
  try { const u = new URL(url); return (u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '')).slice(0, 40) } catch { return url.slice(0, 40) }
}

export async function getMarketingVM(kind: 'salon' | 'restaurant', business: Salon | Restaurant, bookingUrl: string): Promise<MarketingVM> {
  const payload = await getPayloadClient()
  const scope = { [kind]: { equals: business.id } }
  const [pricing, monthRes, campaignsRes, subsRes, unsubRes, countryRes] = await Promise.all([
    getPricing(),
    payload.find({ collection: 'email-log', where: { and: [{ type: { equals: 'marketing_broadcast' } }, scope, { createdAt: { greater_than_equal: startOfMonthIso() } }] }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'marketing-campaigns', where: scope, sort: '-createdAt', limit: 200, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { and: [scope, { marketing_consent: { equals: true } }] }, sort: '-marketing_consent_at', limit: 20, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { and: [scope, { marketing_consent: { equals: false } }, { marketing_unsubscribed_at: { exists: true } }] }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { and: [scope, { marketing_consent: { equals: true } }] }, select: { customer_country: true } as never, limit: 2000, depth: 0, overrideAccess: true }),
  ])
  const openedMonth = await payload.find({ collection: 'email-log', where: { and: [{ type: { equals: 'marketing_broadcast' } }, scope, { createdAt: { greater_than_equal: startOfMonthIso() } }, { status: { in: ['opened', 'clicked'] } }] }, limit: 0, depth: 0, overrideAccess: true })
  const tier = resolveTier(business.tier)

  // ── a kiküldött kampányok statisztikája (az utolsó 30) ──
  const campaigns = campaignsRes.docs as MarketingCampaign[]
  const sent = campaigns.filter((c) => c.status === 'sent').slice(0, 30)
  const logs = sent.length ? ((await payload.find({ collection: 'email-log', where: { campaign: { in: sent.map((c) => c.id) } }, limit: 20000, depth: 0, overrideAccess: true, select: { to: true, status: true, opened_at: true, clicked_links: true, campaign: true } as never })).docs as EmailLogEntry[]) : []
  const byCampaign = new Map<string, EmailLogEntry[]>()
  for (const l of logs) { const c = relId(l.campaign); if (c) (byCampaign.get(c) ?? byCampaign.set(c, []).get(c)!).push(l) }
  // foglalás a levélből (pontos): a levél foglalás-linkjének `?c=` jelölésével jött foglalások (lib/campaignAttribution)
  const attributed = sent.length
    ? ((await payload.find({ collection: kind === 'salon' ? 'bookings' : 'reservations', where: { and: [scope, { marketing_campaign: { in: sent.map((c) => c.id) } }, { status: { not_equals: 'cancelled' } }] }, limit: 20000, depth: 0, overrideAccess: true, select: { marketing_campaign: true } as never })).docs as { marketing_campaign?: unknown }[])
    : []
  const bookedByCampaign = new Map<string, number>()
  for (const b of attributed) { const c = relId(b.marketing_campaign); if (c) bookedByCampaign.set(c, (bookedByCampaign.get(c) ?? 0) + 1) }
  const unsubs = (await payload.find({ collection: 'customers', where: { and: [scope, { marketing_unsubscribed_at: { exists: true } }] }, limit: 5000, depth: 0, overrideAccess: true, select: { customer_email: true, marketing_unsubscribed_at: true } as never })).docs as Customer[]
  const consentAfter = (await payload.find({ collection: 'customers', where: { and: [scope, { marketing_consent: { equals: true } }] }, limit: 5000, depth: 0, overrideAccess: true, select: { marketing_consent_at: true, createdAt: true } as never })).docs as Customer[]

  const vms: CampaignVM[] = campaigns.map((c) => {
    const blocks = parseEmailBlocks(c.blocks_json ?? [])
    const base: CampaignVM = {
      id: String(c.id), subject: c.subject, status: (c.status ?? 'sent') as CampaignStatus, at: c.createdAt, scheduledAt: c.scheduled_at ?? null, updatedAt: c.updatedAt,
      recipients: c.recipient_count ?? 0, targeted: Array.isArray(c.target_customer_ids) && (c.target_customer_ids as unknown[]).length > 0, blocks,
      translations: parseTranslations(c.translations), segments: parseSegments(c.audience), pickedIds: c.audience ? [] : ((c.target_customer_ids as string[] | null) ?? []).map(String), audience: audienceLabel(parseSegments(c.audience), c.audience ? 0 : Array.isArray(c.target_customer_ids) ? (c.target_customer_ids as unknown[]).length : 0),
      targetIds: (c.target_customer_ids as string[] | null) ?? null, stats: null,
    }
    // kiküldött kampánynak mindig van statisztikája (napló nélkül nullákkal) — különben üres maradna a mérő és a Részletek
    const ls = byCampaign.get(String(c.id)) ?? []
    if (c.status !== 'sent') return base
    const sentAt = new Date(c.createdAt).getTime()
    const week = sentAt + 7 * 86_400_000
    const to = new Set(ls.map((l) => (l.to ?? '').toLowerCase()))
    const opened = ls.filter((l) => l.status === 'opened' || l.status === 'clicked' || l.opened_at).length
    const clicked = ls.filter((l) => l.status === 'clicked' || (Array.isArray(l.clicked_links) && l.clicked_links.length)).length
    // a levél linkjéről jött foglalások (pontos) — a korábbi „7 napon belül foglalt” becslés helyett
    const booked = bookedByCampaign.get(String(c.id)) ?? 0
    const unsubscribed = unsubs.filter((u) => { const t = u.marketing_unsubscribed_at ? new Date(u.marketing_unsubscribed_at).getTime() : 0; return t >= sentAt && t <= week && to.has((u.customer_email ?? '').toLowerCase()) }).length
    const perDay = Array.from({ length: 6 }, (_, i) => {
      const d0 = new Date(sentAt); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() + i)
      const d1 = d0.getTime() + 86_400_000
      return { d: DAY[d0.getDay()], v: ls.filter((l) => l.opened_at && new Date(l.opened_at).getTime() >= d0.getTime() && new Date(l.opened_at).getTime() < d1).length }
    })
    const linkCount = new Map<string, number>()
    for (const l of ls) for (const k of Array.isArray(l.clicked_links) ? l.clicked_links : []) linkCount.set(k.url, (linkCount.get(k.url) ?? 0) + 1)
    const links = [...linkCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([url, n]) => ({ url, n, label: linkLabel(url, blocks) }))
    const newSince = consentAfter.filter((x) => new Date(x.marketing_consent_at ?? x.createdAt).getTime() > sentAt).length
    return { ...base, stats: { opened, clicked, booked, unsubscribed, perDay, links, notOpened: Math.max(0, ls.length - opened), newSince } }
  })

  // ── feliratkozók: foglalás-szám és utolsó megnyitás ──
  const subs = subsRes.docs as Customer[]
  const subscriberPage = await subscriberRows(kind, business.id, subs)

  return {
    month: { used: monthRes.totalDocs, opened: openedMonth.totalDocs, cap: monthlyEmailCapForTier(pricing, tier), tier },
    subscribers: subsRes.totalDocs, unsubscribed: unsubRes.totalDocs, campaigns: vms, subscriberPage, subscriberMore: subsRes.hasNextPage ?? false,
    countries: [...new Set((countryRes.docs as Customer[]).map((c) => c.customer_country).filter((c): c is string => !!c))].sort(),
    bookingUrl,
    locales: resolveAvailableLocales((business as { supported_locales?: string[] | null }).supported_locales),
    services: kind === 'salon'
      ? ((await payload.find({ collection: 'services', where: { salon: { equals: business.id } }, sort: 'name', limit: 200, depth: 0, overrideAccess: true, select: { name: true } as never })).docs as { id: number; name?: string | null }[]).map((x) => ({ id: String(x.id), name: x.name ?? '' })).filter((x) => x.name)
      : [...new Set(((await payload.find({ collection: 'reservations', where: { and: [{ restaurant: { equals: business.id } }, { occasion: { exists: true } }] }, limit: 20000, depth: 0, overrideAccess: true, select: { occasion: true } as never })).docs as { occasion?: string | null }[]).map((r) => (r.occasion ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hu')).map((o) => ({ id: o, name: o })),
  }
}

/** A feliratkozó-sorok kiegészítése: hány foglalása van, és mikor nyitott meg utoljára hírlevelet (melyiket). */
export async function subscriberRows(kind: 'salon' | 'restaurant', businessId: string | number, subs: Customer[]): Promise<SubscriberVM[]> {
  if (!subs.length) return []
  const payload = await getPayloadClient()
  const emails = subs.map((s) => (s.customer_email ?? '').toLowerCase()).filter(Boolean)
  const [bk, opens] = await Promise.all([
    payload.find({ collection: kind === 'salon' ? 'bookings' : 'reservations', where: { and: [{ [kind]: { equals: businessId } }, { customer_email: { in: emails } }, { status: { not_in: ['cancelled', 'no_show'] } }] }, limit: 20000, depth: 0, overrideAccess: true, select: { customer_email: true, date: true } as never }),
    payload.find({ collection: 'email-log', where: { and: [{ type: { equals: 'marketing_broadcast' } }, { [kind]: { equals: businessId } }, { to: { in: emails } }] }, sort: '-opened_at', limit: 20000, depth: 0, overrideAccess: true, select: { to: true, opened_at: true, subject: true, status: true } as never }),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const nBk = new Map<string, number>()
  const visit = new Map<string, string>()
  for (const b of bk.docs as { customer_email?: string | null; date?: string | null }[]) {
    const e = (b.customer_email ?? '').toLowerCase(); nBk.set(e, (nBk.get(e) ?? 0) + 1)
    const d = (b.date ?? '').slice(0, 10); if (d && d <= today && d > (visit.get(e) ?? '')) visit.set(e, d)
  }
  const last = new Map<string, { at: string; subject: string }>()
  const got = new Map<string, { received: number; opened: number }>()
  for (const o of opens.docs as EmailLogEntry[]) {
    const e = (o.to ?? '').toLowerCase()
    const g = got.get(e) ?? { received: 0, opened: 0 }
    g.received += 1; if (o.opened_at || o.status === 'opened' || o.status === 'clicked') g.opened += 1
    got.set(e, g)
    if (!last.has(e) && o.opened_at) last.set(e, { at: o.opened_at, subject: o.subject ?? '' })
  }
  // látogatásszám: a nálunk lévő foglalások, vagy (importált vendégnél) a régi rendszer látogatásszáma, ha az több —
  // az import csak az első és az utolsó látogatást hozza át foglalásként (törzsvendég-szűrő, lista)
  return subs.map((c) => {
    const e = (c.customer_email ?? '').toLowerCase()
    const g = got.get(e)
    return { id: String(c.id), name: c.customer_name ?? '', email: c.customer_email ?? '', city: c.customer_city ?? '', country: c.customer_country ?? null, since: c.marketing_consent_at ?? c.createdAt, bookings: Math.max(nBk.get(e) ?? 0, Number(c.visit_count ?? 0)), lastVisit: visit.get(e) ?? null, received: g?.received ?? 0, opened: g?.opened ?? 0, lastOpen: last.get(e) ?? null }
  })
}

/** Az üzlet logójának címe a levélhez — a rekordban a logó lehet csak azonosító (mélység nélküli lekérés), ilyenkor a
 *  médiából olvassuk ki. */
export async function businessLogoUrl(logo: unknown): Promise<string | null> {
  if (!logo) return null
  if (typeof logo === 'object') return fixMediaUrl((logo as Media).url) ?? null
  const payload = await getPayloadClient()
  const m = await payload.findByID({ collection: 'media', id: logo as number, depth: 0, overrideAccess: true }).catch(() => null)
  return m ? fixMediaUrl((m as Media).url) ?? null : null
}
