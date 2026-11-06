import type { Payload } from 'payload'
import { Resend } from 'resend'
import { getPricing } from '@/lib/pricing'
import { monthlyEmailCapForTier, resolveTier } from '@/lib/tier'
import { logEmail } from '@/lib/emailLog'
import { signUnsubscribeToken } from '@/lib/marketingUnsubscribeToken'
import { emailLayout, richContentBlock, bottomSpacer, COLORS, escapeHtml } from '@/lib/emailLayout'
import { fromHeader } from '@/lib/email'
import type { Salon, Restaurant, Customer, Media } from '@/payload/payload-types'
import { blocksToHtml, coverOf, parseEmailBlocks, type ComposerBlock } from '@/lib/emailBlocks'
import { normalizeLocale, t, type Locale } from '@/lib/i18n'
import { usableTranslation, type CampaignTranslations } from '@/lib/marketingSegments'

const RESEND_BATCH_SIZE = 100
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const startOfMonthIso = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString() }
const logoUrlOf = (logo: Salon['logo'] | Restaurant['logo']) => (logo && typeof logo === 'object' ? (logo as Media).url ?? null : null)

export type DispatchInput = {
  kind: 'salon' | 'restaurant'
  businessId: string | number
  subject: string
  bodyHtml: string
  blocks?: unknown
  customerIds?: string[] | null
  /** ütemezett kampány / piszkozat kiküldésekor a meglévő rekord (különben új jön létre) */
  campaignId?: string | number
  /** a célközönség szegmensei (`lib/marketingSegments`), vesszővel — a „Kinek ment ki” sorhoz */
  audience?: string | null
  /** a többi nyelv változata — a vendég a foglaláskor választott nyelvén kapja (fordítás nélkül magyarul) */
  translations?: CampaignTranslations
}
/** A levélben a `{keresztnév}` helyére a vendég keresztneve — magyar vendégnél (vagy ország nélkül) a név utolsó szava,
 *  külföldinél az első; név nélkül „Vendégünk”. */
export const personalize = (html: string, name?: string | null, country?: string | null, fallback = 'Vendégünk') => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const first = (country && country.toUpperCase() !== 'HU' ? parts[0] : parts[parts.length - 1]) || fallback
  return html.replace(/\{keresztnév\}/g, escapeHtml(first))
}

/** A szerkesztőben feltöltött képek / linkek a saját domainen relatívak (`/api/media/…`) — a levélben abszolút cím kell. */
/** egy cím abszolúttá tétele (a saját domainen relatív média-URL) */
const absUrl = (u: string) => (u.startsWith('/') && !u.startsWith('//') ? `${APP_URL.replace(/\/$/, '')}${u}` : u)
const absolutize = (html: string) => html.replace(/(\s(?:src|href)=")\/(?!\/)/g, `$1${APP_URL.replace(/\/$/, '')}/`)

export type DispatchResult = { ok: true; sent: number; campaignId: string | number } | { ok: false; error: string; status: number }

/** A címzettek (feliratkozott vendégek, opcionálisan szűkítve) és a havi keret — a küldés és az ütemezés is ezt nézi. */
export async function marketingAudience(payload: Payload, kind: 'salon' | 'restaurant', businessId: string | number, customerIds?: string[] | null) {
  const business = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id: businessId, depth: 1, overrideAccess: true }).catch(() => null)) as Salon | Restaurant | null
  if (!business) return null
  const tier = resolveTier(business.tier)
  const cap = monthlyEmailCapForTier(await getPricing(), tier)
  const [already, rec] = await Promise.all([
    payload.find({ collection: 'email-log', where: { and: [{ type: { equals: 'marketing_broadcast' } }, { [kind]: { equals: businessId } }, { createdAt: { greater_than_equal: startOfMonthIso() } }] }, limit: 0, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { and: [{ [kind]: { equals: businessId } }, { marketing_consent: { equals: true } }, ...(customerIds && customerIds.length ? [{ id: { in: customerIds } }] : [])] }, limit: 5000, depth: 0, overrideAccess: true }),
  ])
  return { business, tier, cap, alreadySent: already.totalDocs, recipients: (rec.docs as Customer[]).filter((c) => !!c.customer_email) }
}

/**
 * A marketing-hírlevél kiküldése (azonnal a küldés-végpontból, vagy az ütemezett időpontban a cronból). A tranzakciós
 * Resend-küldés mintája, kötegelve (max 100/hívás). Kemény havi plafon, nincs részleges küldés. Minden levélben egyedi,
 * aláírt leiratkozó-link (GDPR). Az üzletenkénti `newsletter_settings.sending` zár két egyidejű küldést nem enged.
 */
export async function dispatchCampaign(payload: Payload, input: DispatchInput): Promise<DispatchResult> {
  const { kind, subject, bodyHtml, blocks, customerIds } = input
  const businessId = typeof input.businessId === 'string' && /^\d+$/.test(input.businessId) ? Number(input.businessId) : input.businessId
  const collection = kind === 'salon' ? 'salons' : 'restaurants'
  const plainText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  // ATOMIKUS zár — csak akkor talál, ha a `sending` flag épp false (két majdnem egyidejű küldés ne lépje túl a keretet)
  const lock = await payload.update({ collection, where: { and: [{ id: { equals: businessId } }, { 'newsletter_settings.sending': { equals: false } }] }, data: { newsletter_settings: { sending: true } }, overrideAccess: true })
  if (lock.docs.length === 0) return { ok: false, error: 'Már folyamatban van egy kampány küldése ennél az üzletnél. Várd meg, amíg befejeződik.', status: 409 }

  try {
    const aud = await marketingAudience(payload, kind, businessId, customerIds)
    if (!aud) return { ok: false, error: 'Üzlet nem található', status: 404 }
    const { business, tier, cap, alreadySent, recipients } = aud
    if (recipients.length === 0) return { ok: false, error: 'Nincs feliratkozott vendég, akinek küldeni lehetne.', status: 400 }
    if (alreadySent + recipients.length > cap) return { ok: false, error: `A küldés túllépné a havi keretet (${alreadySent}/${cap} már felhasználva, ez a küldés ${recipients.length} címzettet érintene). Csökkentsd a listát, vagy várd meg a következő hónapot.`, status: 400 }
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
    if (!resend) return { ok: false, error: 'A levélküldés nincs konfigurálva (hiányzó Resend API-kulcs).', status: 503 }

    const businessName = business.name
    const logoUrl = logoUrlOf(business.logo)
    const from = fromHeader(businessName, business.slug)

    // ha piszkozatból / ütemezettből küldünk, sikertelen küldés után az előző állapot áll vissza
    const prevStatus = input.campaignId ? ((await payload.findByID({ collection: 'marketing-campaigns', id: input.campaignId, depth: 0, overrideAccess: true }).catch(() => null))?.status ?? 'draft') : null

    // a kampány-rekord előbb (a per-címzett email-log erre mutat); ütemezettnél a meglévő, „Kiküldve”-re állítva
    const campaign = input.campaignId
      ? await payload.update({
          collection: 'marketing-campaigns', id: input.campaignId, overrideAccess: true,
          data: {
            status: 'sent', recipient_count: recipients.length, body_text: plainText, subject: subject.trim(), package: tier,
            ...(blocks !== undefined ? { blocks_json: blocks } : {}), target_customer_ids: customerIds && customerIds.length ? customerIds : null,
            ...(input.audience !== undefined ? { audience: input.audience } : {}),
            ...(input.translations !== undefined ? { translations: input.translations } : {}),
          },
        })
      : await payload.create({
          collection: 'marketing-campaigns', overrideAccess: true,
          data: {
            ...(kind === 'salon' ? { salon: businessId as number } : { restaurant: businessId as number }),
            subject: subject.trim(), body_text: plainText, recipient_count: recipients.length, package: tier,
            blocks_json: blocks ?? [], target_customer_ids: customerIds && customerIds.length ? customerIds : null, audience: input.audience ?? null, translations: input.translations ?? null,
          },
        })

    // a vendég nyelve: a legutóbbi foglalásán választott nyelv (a foglaló nyelvváltója) — fordítás nélkül magyar
    const translations = input.translations ?? {}
    const localeOf = Object.keys(translations).length ? await recipientLocales(payload, kind, businessId, recipients) : new Map<string, Locale>()
    // a levél nyelvenként: a fejléc (a fő képen az üzlet neve / logója) + a többi blokk — ugyanaz, mint a szerkesztő előnézete
    const huBlocks = parseEmailBlocks(blocks)
    const logo = logoUrl ? absUrl(logoUrl) : null
    const build = (list: ComposerBlock[], loc: Locale) => {
      const { cover, rest } = coverOf(list)
      return { header: letterHeader(cover?.url ? absUrl(cover.url) : null, logo, businessName), html: blocksToHtml(rest, { voucherLabel: t(loc, 'marketing.voucher') }) }
    }
    // régi, blokk nélküli kampány (csak HTML): fejléc kép nélkül, a kész HTML
    const huVersion = huBlocks.length ? build(huBlocks, 'hu') : { header: letterHeader(null, logo, businessName), html: bodyHtml }
    const built = new Map<Locale, { header: string; html: string }>()
    const versionFor = (loc: Locale) => {
      const tr = usableTranslation(translations, loc)
      if (!tr) return { loc: 'hu' as Locale, subject: subject.trim(), ...huVersion }
      if (!built.has(loc)) built.set(loc, build(tr.blocks, loc))
      return { loc, subject: tr.subject.trim(), ...built.get(loc)! }
    }

    const items = await Promise.all(recipients.map(async (c) => {
      const v = versionFor(localeOf.get((c.customer_email ?? '').toLowerCase()) ?? 'hu')
      const token = await signUnsubscribeToken(c.id)
      const unsubscribeUrl = `${APP_URL}/api/marketing/unsubscribe/${token}`
      const html = emailLayout({
        brandName: businessName, brandLogoUrl: logoUrl,
        header: v.header,
        content: [richContentBlock(personalize(absolutize(v.html), c.customer_name, c.customer_country, t(v.loc, 'marketing.guestFallback'))), `<tr><td style="background:${COLORS.surface};padding:18px 28px;text-align:center"><a href="${unsubscribeUrl}" style="color:#9A9A9A;font-size:11px;text-decoration:underline">${escapeHtml(t(v.loc, 'marketing.unsubscribe'))}</a></td></tr>`, bottomSpacer()].join(''),
      })
      return { to: c.customer_email as string, subject: v.subject, html }
    }))

    let sent = 0
    for (let i = 0; i < items.length; i += RESEND_BATCH_SIZE) {
      const chunk = items.slice(i, i + RESEND_BATCH_SIZE)
      const owner = kind === 'salon' ? { salonId: businessId } : { restaurantId: businessId }
      try {
        const { data, error } = await resend.batch.send(chunk.map((it) => ({ from, ...(business.email ? { reply_to: business.email } : {}), to: it.to, subject: it.subject, html: it.html })))
        if (error) throw new Error(error.message)
        chunk.forEach((it, idx) => { sent += 1; void logEmail('marketing_broadcast', it.to, it.subject, true, undefined, { resendId: data?.data?.[idx]?.id, campaignId: campaign.id, ...owner }) })
      } catch (e) {
        console.error('[marketing] batch error', e)
        chunk.forEach((it) => { void logEmail('marketing_broadcast', it.to, it.subject, false, e instanceof Error ? e.message : 'batch hiba', { campaignId: campaign.id, ...owner }) })
      }
    }

    if (sent === 0) {
      if (input.campaignId) await payload.update({ collection: 'marketing-campaigns', id: campaign.id, data: { status: prevStatus === 'scheduled' ? 'scheduled' : 'draft' }, overrideAccess: true }).catch(() => null)
      else await payload.delete({ collection: 'marketing-campaigns', id: campaign.id, overrideAccess: true }).catch(() => null)
      return { ok: false, error: 'A küldés nem sikerült egyetlen címzettnek sem.', status: 502 }
    }
    if (sent !== recipients.length) await payload.update({ collection: 'marketing-campaigns', id: campaign.id, data: { recipient_count: sent }, overrideAccess: true }).catch(() => null)
    return { ok: true, sent, campaignId: campaign.id }
  } finally {
    await payload.update({ collection, id: businessId, data: { newsletter_settings: { sending: false } }, overrideAccess: true }).catch((e) => console.error('[marketing] a küldés-zár feloldása sikertelen — kézi javítás kellhet:', e))
  }
}

/** A címzettek nyelve: e-mailenként a legutóbbi foglalás (szalon) / asztalfoglalás (étterem) nyelve. */
async function recipientLocales(payload: Payload, kind: 'salon' | 'restaurant', businessId: string | number, recipients: Customer[]): Promise<Map<string, Locale>> {
  const emails = [...new Set(recipients.map((c) => (c.customer_email ?? '').toLowerCase()).filter(Boolean))]
  const out = new Map<string, Locale>()
  if (!emails.length) return out
  const rows = (await payload.find({
    collection: kind === 'salon' ? 'bookings' : 'reservations', where: { and: [{ [kind]: { equals: businessId } }, { customer_email: { in: emails } }] },
    sort: 'createdAt', limit: 50000, depth: 0, overrideAccess: true, select: { customer_email: true, locale: true } as never,
  })).docs as { customer_email?: string | null; locale?: string | null }[]
  // időrendben: a későbbi foglalás felülírja a korábbit
  for (const r of rows) if (r.customer_email && r.locale) out.set(r.customer_email.toLowerCase(), normalizeLocale(r.locale))
  return out
}

/** A levél fejléce, mint a szerkesztőben: a fő képen alul az üzlet logója és neve (sötét átmeneten); fő kép nélkül egy
 *  sor felül. A háttérkép két lépcsőben — ahol az átmenet nem megy, ott is marad a kép; ahol a kép sem, sötét háttér. */
function letterHeader(cover: string | null, logo: string | null, name: string): string {
  const n = escapeHtml(name)
  if (cover) {
    // a logó a saját formájában, lekerekített sarokkal (mint a szerkesztőben) — háttér / keret nélkül
    const brand = `${logo ? `<td style="padding:0 12px 18px 24px;vertical-align:middle"><img src="${logo}" alt="${n}" height="40" style="height:40px;width:auto;max-width:140px;display:block;border:0;border-radius:10px" /></td>` : ''}<td style="padding:0 24px 18px ${logo ? 0 : 24}px;vertical-align:middle;color:#FFFFFF;font-size:15px;line-height:1.3;text-shadow:0 1px 4px rgba(0,0,0,.45)">${n}</td>`
    return `<tr><td background="${cover}" bgcolor="#383838" height="220" valign="bottom" style="height:220px;padding:0;vertical-align:bottom;background-color:#383838;background-image:url('${cover}');background-image:linear-gradient(to top,rgba(0,0,0,.55),rgba(0,0,0,0) 60%),url('${cover}');background-size:cover;background-position:center"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${brand}</tr></table></td></tr>`
  }
  return `<tr><td style="background:${COLORS.surface};padding:16px 28px;border-bottom:1px dashed ${COLORS.border}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${logo ? `<td style="padding-right:10px;vertical-align:middle"><img src="${logo}" alt="${n}" height="28" style="height:28px;width:auto;max-width:140px;display:block;border:0" /></td>` : ''}<td style="vertical-align:middle;color:#828282;font-size:13px">${n}</td></tr></table></td></tr>`
}
