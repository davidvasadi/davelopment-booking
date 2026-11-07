import type { Payload } from 'payload'
import type { Salon, Restaurant, Subscription, User } from '@/payload/payload-types'
import { authQuery, sql } from './authDb'
import { BRAND_NAME } from './brand'
import { emailLayout, COLORS, escapeHtml } from './emailLayout'

/**
 * A próbaidő levelei (design 18.4) — a tulajdonosnak, a notifications cronból (idempotens: a `trial_notices` tábla
 * jegyzi, mi ment már ki, így percenként is futhat).
 *  - 7 / 3 / 1 nappal a vége előtt, ha még van hiányzó lépés (számlázási adatok, kártya) — egy ablakban csak a
 *    legközelebbi megy (a 3 napos ablakban már nem küldjük utólag a 7 naposat);
 *  - ha minden kész: egyetlen levél az utolsó napon („holnaptól indul az előfizetés”);
 *  - lejáratkor (a próbaidő lejárt, nincs fizetés): mi történt, mi marad meg, mi áll, egy gomb.
 * A küldés előtt lefoglaljuk a sort (INSERT … ON CONFLICT DO NOTHING RETURNING), hiba esetén visszaengedjük.
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001').replace(/\/$/, '')
const DAY = 86_400_000
type Kind = 'd7' | 'd3' | 'd1' | 'ready' | 'expired'
type Biz = { type: 'salon' | 'restaurant'; doc: Salon | Restaurant }

const BILLING_KEYS = ['legal_name', 'billing_email', 'billing_postal_code', 'billing_city', 'billing_street'] as const
const billingComplete = (b: Biz | null) => !!b && BILLING_KEYS.every((k) => String((b.doc as unknown as Record<string, unknown>)[k] ?? '').trim())

async function firstBusiness(payload: Payload, ownerId: number | string): Promise<Biz | null> {
  for (const type of ['salon', 'restaurant'] as const) {
    const r = await payload.find({ collection: type === 'salon' ? 'salons' : 'restaurants', where: { owner: { equals: ownerId } }, limit: 1, depth: 0, overrideAccess: true }).catch(() => null)
    if (r?.docs[0]) return { type, doc: r.docs[0] as Salon | Restaurant }
  }
  return null
}

const fmtDay = (iso: string) => {
  const s = new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function stepsTable(rows: [string, boolean][]): string {
  const row = ([label, ok]: [string, boolean], i: number) => `<tr>
    <td style="padding:12px 0;${i ? `border-top:1px dashed ${COLORS.border};` : ''}font-size:14px;color:${COLORS.textSoft}">${escapeHtml(label)}</td>
    <td style="padding:12px 0;${i ? `border-top:1px dashed ${COLORS.border};` : ''}text-align:right">
      <span style="display:inline-block;border-radius:999px;padding:4px 10px;font-size:12px;${ok ? 'background:#E6F2DF;color:#4C7A2E' : 'background:#FFF1CC;color:#8A6A12'}">${ok ? 'Kész' : 'Hiányzik'}</span>
    </td></tr>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;background:#EEEEEE;border-radius:16px;padding:4px 16px">${rows.map(row).join('')}</table>`
}

export function trialEmail(kind: Kind, o: { plan: string; amount: string; end: string; billing: boolean; card: boolean; href: string }) {
  const t = {
    d7: { subject: 'Még 7 nap a próbaidődből', label: 'Próbaidő · még 7 nap', title: 'Egy hét múlva lejár a próbaidőd', text: `Hogy minden zökkenőmentesen menjen tovább, add meg a számlázási adatokat és a kártyát — terhelni csak ${o.end} után fogunk.`, btn: 'Beállítom' },
    d3: { subject: 'Még 3 nap a próbaidődből', label: 'Próbaidő · még 3 nap', title: 'Három nap múlva lejár a próbaidőd', text: `Add meg a hiányzó adatokat, hogy ${o.end} után se álljon meg semmi.`, btn: 'Beállítom' },
    d1: { subject: 'Holnap lejár a próbaidőd', label: 'Próbaidő · holnap lejár', title: o.billing || o.card ? 'Már csak egy lépés hiányzik' : 'Holnap lejár a próbaidőd', text: 'Ha holnapig nem állítod be, a fiók zárolódik, és a foglalóoldalad nem fogad új foglalást. Az adataid megmaradnak.', btn: 'Beállítom' },
    ready: { subject: 'Holnaptól indul az előfizetésed', label: 'Minden kész', title: `Holnaptól indul a ${o.plan} csomag`, text: `Nincs több teendőd: ${o.end}-án ${o.amount}-ot terhelünk a kártyádra, a számlát e-mailben küldjük. Bármikor lemondhatod.`, btn: 'Előfizetés' },
    expired: { subject: 'Lejárt a próbaidőd — a foglalóoldal szünetel', label: 'Lejárt', title: 'Lejárt a próbaidőd', text: 'A fiókod zárolva, a foglalóoldalad most nem fogad új foglalást. Amint aktiválod, minden azonnal folytatódik.', btn: 'Előfizetés aktiválása' },
  }[kind]
  const box = kind === 'expired'
    ? stepsTable([['Az adataid megmaradnak', true], ['A meglévő foglalások érvényesek', true], ['Új online foglalás — szünetel', false]])
    : stepsTable([[`Csomag · ${o.plan}, ${o.amount} / hó`, true], ['Számlázási adatok', o.billing], ['Fizetési mód (kártya)', o.card]])
  const pillBg = kind === 'ready' ? '#E6F2DF;color:#4C7A2E' : kind === 'd7' ? '#EEEEEE;color:#6E6E6E' : '#FBE3E1;color:#B4423A'
  const content = `<tr>
    <td style="background:${COLORS.surface};padding:34px 32px 6px">
      <span style="display:inline-block;border-radius:999px;padding:5px 12px;font-size:12px;background:${pillBg}">${escapeHtml(t.label)}</span>
      <h1 style="margin:14px 0 0;font-size:22px;font-weight:300;color:${COLORS.text};letter-spacing:-0.3px">${escapeHtml(t.title)}</h1>
      <p style="margin:8px 0 0;color:${COLORS.textSoft};font-size:14px;line-height:1.6">${escapeHtml(t.text)}</p>
      ${box}
      <a href="${o.href}" style="display:inline-block;margin:22px 0 0;background:${COLORS.ink};color:#FFFFFF;text-decoration:none;border-radius:999px;padding:12px 22px;font-size:14px">${escapeHtml(t.btn)}</a>
    </td>
  </tr>
  <tr><td style="background:${COLORS.surface};height:30px;line-height:30px;font-size:0">&nbsp;</td></tr>`
  return { subject: t.subject, html: emailLayout({ brandName: BRAND_NAME, content }) }
}

/** Melyik levél esedékes most (null: semmi). */
function dueKind(sub: Subscription, setupDone: boolean, now: number): Kind | null {
  if (!sub.trial_ends_at) return null
  const left = Math.ceil((new Date(sub.trial_ends_at).getTime() - now) / DAY)
  if (sub.status === 'trialing') {
    if (setupDone) return left <= 1 ? 'ready' : null
    return left <= 1 ? 'd1' : left <= 3 ? 'd3' : left <= 7 ? 'd7' : null
  }
  // a próbaidő lejárt, nincs fizetés (az expireOneTrial past_due-ra billentette) — csak a lejárat utáni 3 napban
  if (sub.status === 'past_due' && sub.plan === 'trial' && !sub.stripe_subscription_id && left > -3) return 'expired'
  return null
}

export async function processTrialNotices(payload: Payload): Promise<{ sent: number; errors: number }> {
  const now = Date.now()
  const res = await payload.find({
    collection: 'subscriptions',
    where: { and: [{ trial_ends_at: { exists: true } }, { or: [{ status: { equals: 'trialing' } }, { and: [{ status: { equals: 'past_due' } }, { plan: { equals: 'trial' } }] }] }] },
    limit: 500, depth: 0, overrideAccess: true,
  })
  let sent = 0, errors = 0
  for (const sub of res.docs as Subscription[]) {
    try {
      const setupDone = !!sub.stripe_subscription_id
      const kind = dueKind(sub, setupDone, now)
      if (!kind) continue
      const ownerId = typeof sub.owner === 'object' ? sub.owner?.id : sub.owner
      if (ownerId == null) continue
      const owner = (await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true }).catch(() => null)) as User | null
      if (!owner?.email) continue
      // a 7 / 3 / 1 napos ablakban csak egy levél (a korábbi ablak levelét utólag nem küldjük)
      const claimed = await authQuery<{ kind: string }>(sql`INSERT INTO trial_notices (subscription_id, kind) VALUES (${Number(sub.id)}, ${kind}) ON CONFLICT DO NOTHING RETURNING kind`)
      if (!claimed.length) continue
      const biz = await firstBusiness(payload, ownerId)
      const base = biz?.type === 'restaurant' ? '/restaurant' : '/dashboard'
      const mail = trialEmail(kind, {
        plan: ((biz?.doc as { tier?: string | null } | undefined)?.tier === 'starter' ? 'Starter' : (biz?.doc as { tier?: string | null } | undefined)?.tier === 'egyedi' ? 'Egyedi' : 'Pro'), amount: `${Math.round(Number(sub.amount_huf ?? 0)).toLocaleString('hu-HU')} Ft`,
        end: sub.trial_ends_at ? fmtDay(sub.trial_ends_at) : 'a próbaidő vége',
        billing: billingComplete(biz), card: setupDone, href: `${APP_URL}${base}/settings?tab=billing`,
      })
      try {
        await payload.sendEmail({ to: owner.email, subject: mail.subject, html: mail.html })
        sent++
      } catch (e) {
        await authQuery(sql`DELETE FROM trial_notices WHERE subscription_id = ${Number(sub.id)} AND kind = ${kind}`)
        throw e
      }
    } catch (e) {
      errors++
      console.error('[trialNotices] failed for subscription', sub.id, e)
    }
  }
  return { sent, errors }
}
