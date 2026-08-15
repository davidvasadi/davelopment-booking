import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getPayloadClient } from '@/lib/payload'
import { ownsThisSalon, ownsThisRestaurant, authOrUnauthorized } from '@/lib/salonRouteAuth'
import { getPricing } from '@/lib/pricing'
import { monthlyEmailCap, hasActivePackage } from '@/lib/newsletterLimits'
import { logEmail } from '@/lib/emailLog'
import { signUnsubscribeToken } from '@/lib/marketingUnsubscribeToken'
import { emailLayout, brandHeroBlock, richContentBlock, bottomSpacer, COLORS } from '@/lib/emailLayout'
import type { Salon, Restaurant, Customer, Media } from '@/payload/payload-types'

const RESEND_BATCH_SIZE = 100

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@davelopment.hu'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

function startOfMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

function logoUrlOf(logo: Salon['logo'] | Restaurant['logo']): string | null {
  return logo && typeof logo === 'object' ? (logo as Media).url ?? null : null
}

/**
 * A marketing-hírlevél kiküldése — owner-hitelesített. A meglévő tranzakciós Resend-küldés
 * mintáját követi (NEM Resend Audience/Broadcast API, lásd terv), kötegelve (`batch.send`,
 * max 100/hívás). Kemény havi plafon, NINCS részleges küldés — vagy megy az egész lista, vagy
 * elutasítjuk. Minden emailbe egyedi, aláírt leiratkozó-link kerül. A `marketing-campaigns`
 * rekord ELŐBB jön létre, mint a küldés — így minden per-címzett `email-log` sor rá tud
 * mutatni (`campaign` reláció), amiből utólag a nyitási-arány számolható kampányonként.
 */
export async function POST(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  let body: { kind?: 'salon' | 'restaurant'; businessId?: string | number; subject?: string; bodyHtml?: string; blocks?: unknown; customerIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const { kind, subject, bodyHtml, blocks, customerIds } = body
  // A relationship-mezők (Customers.salon/restaurant, MarketingCampaigns.salon/restaurant)
  // Postgres integer PK-ra mutatnak — a JSON-ból jövő string businessId-t Payload elutasítja
  // `create()`-nél, ha nem a mező tényleges típusa (szám), ezért itt egységesen konvertáljuk.
  const rawBusinessId = body.businessId
  const businessId = typeof rawBusinessId === 'string' && /^\d+$/.test(rawBusinessId) ? Number(rawBusinessId) : rawBusinessId
  const plainText = bodyHtml?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? ''
  if (!kind || !businessId || !subject?.trim() || !plainText) {
    return NextResponse.json({ error: 'Tárgy és szöveg megadása kötelező' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const owns = kind === 'salon' ? await ownsThisSalon(payload, user, businessId) : await ownsThisRestaurant(payload, user, businessId)
  if (!owns) return NextResponse.json({ error: 'Hozzáférés megtagadva' }, { status: 403 })

  const business = (await payload.findByID({ collection: kind === 'salon' ? 'salons' : 'restaurants', id: businessId, depth: 1, overrideAccess: true }).catch(() => null)) as (Salon | Restaurant | null)
  if (!business) return NextResponse.json({ error: 'Üzlet nem található' }, { status: 404 })

  const pkg = business.newsletter_settings?.package
  if (!hasActivePackage(pkg)) {
    return NextResponse.json({ error: 'Nincs aktív hírlevél-csomag ennél az üzletnél.' }, { status: 400 })
  }

  const pricing = await getPricing()
  const cap = monthlyEmailCap(pricing, pkg)

  const [alreadySentResult, recipientsResult] = await Promise.all([
    payload.find({
      collection: 'email-log',
      where: { and: [{ type: { equals: 'marketing_broadcast' } }, { [kind]: { equals: businessId } }, { createdAt: { greater_than_equal: startOfMonthIso() } }] },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'customers',
      where: {
        and: [
          { [kind]: { equals: businessId } },
          { marketing_consent: { equals: true } },
          ...(customerIds && customerIds.length > 0 ? [{ id: { in: customerIds } }] : []),
        ],
      },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const alreadySent = alreadySentResult.totalDocs
  const recipients = (recipientsResult.docs as Customer[]).filter((c) => !!c.customer_email)

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Nincs feliratkozott vendég, akinek küldeni lehetne.' }, { status: 400 })
  }
  if (alreadySent + recipients.length > cap) {
    return NextResponse.json({
      error: `A küldés túllépné a havi keretet (${alreadySent}/${cap} már felhasználva, ez a küldés ${recipients.length} címzettet érintene). Csökkentsd a listát, vagy várd meg a következő hónapot.`,
    }, { status: 400 })
  }

  const resend = getResend()
  if (!resend) {
    return NextResponse.json({ error: 'A levélküldés nincs konfigurálva (hiányzó Resend API-kulcs).' }, { status: 503 })
  }

  const businessName = business.name
  const logoUrl = logoUrlOf(business.logo)
  const from = `"${businessName.replace(/"/g, '\\"')}" <${FROM}>`

  // A kampány-rekord ELŐBB jön létre (recipient_count = szándékolt címzett-szám) — a per-
  // címzett email-log sorok erre mutatnak, a küldés végén a tényleges sikeres darabszámra
  // frissítjük (vagy töröljük, ha egyáltalán nem sikerült semmi).
  const campaign = await payload.create({
    collection: 'marketing-campaigns',
    overrideAccess: true,
    data: {
      ...(kind === 'salon' ? { salon: businessId } : { restaurant: businessId }),
      subject: subject.trim(),
      body_text: plainText,
      recipient_count: recipients.length,
      package: pkg,
      // A strukturált blokk-tartalom is elmentődik (nem csak a sima szöveg) — így a kiküldött
      // kampány utólag megnyitható/újrafelhasználható a szerkesztőben (lásd Kampányok lista).
      blocks_json: blocks ?? [],
      target_customer_ids: customerIds && customerIds.length > 0 ? customerIds : null,
    },
  })

  // Egyedi, aláírt leiratkozó-linkkel minden email — a batch.send minden elemnek saját HTML-t enged.
  // A leiratkozó-link MINDIG automatikusan itt kerül a levél aljára (jogi kötelezettség, GDPR) —
  // a szerkesztőben nincs kézzel beszúrható "leiratkozás" blokk, hogy ne lehessen véletlenül
  // kihagyni vagy duplikálni.
  const items = await Promise.all(recipients.map(async (c) => {
    const token = await signUnsubscribeToken(c.id)
    const unsubscribeUrl = `${APP_URL}/api/marketing/unsubscribe/${token}`
    const html = emailLayout({
      brandName: businessName,
      brandLogoUrl: logoUrl,
      header: brandHeroBlock({ brandName: businessName, brandLogoUrl: logoUrl, icon: 'logo', title: subject.trim(), subtitle: '' }),
      content: [
        richContentBlock(bodyHtml),
        `<tr><td style="background:${COLORS.surface};padding:18px 28px;text-align:center"><a href="${unsubscribeUrl}" style="color:#9A9A9A;font-size:11px;text-decoration:underline">Leiratkozás a hírlevélről</a></td></tr>`,
        bottomSpacer(),
      ].join(''),
    })
    return { to: c.customer_email as string, customerId: c.id, html }
  }))

  let sentCount = 0
  for (let i = 0; i < items.length; i += RESEND_BATCH_SIZE) {
    const chunk = items.slice(i, i + RESEND_BATCH_SIZE)
    try {
      const { data, error } = await resend.batch.send(
        chunk.map((it) => ({ from, to: it.to, subject: subject.trim(), html: it.html })),
      )
      if (error) throw new Error(error.message)
      chunk.forEach((it, idx) => {
        sentCount += 1
        void logEmail('marketing_broadcast', it.to, subject.trim(), true, undefined, {
          resendId: data?.data?.[idx]?.id,
          campaignId: campaign.id,
          ...(kind === 'salon' ? { salonId: businessId } : { restaurantId: businessId }),
        })
      })
    } catch (e) {
      console.error('[api/marketing/send] batch error', e)
      chunk.forEach((it) => {
        void logEmail('marketing_broadcast', it.to, subject.trim(), false, e instanceof Error ? e.message : 'batch hiba', {
          campaignId: campaign.id,
          ...(kind === 'salon' ? { salonId: businessId } : { restaurantId: businessId }),
        })
      })
    }
  }

  if (sentCount === 0) {
    await payload.delete({ collection: 'marketing-campaigns', id: campaign.id, overrideAccess: true }).catch(() => null)
    return NextResponse.json({ error: 'A küldés nem sikerült egyetlen címzettnek sem.' }, { status: 502 })
  }
  if (sentCount !== recipients.length) {
    await payload.update({ collection: 'marketing-campaigns', id: campaign.id, data: { recipient_count: sentCount }, overrideAccess: true }).catch(() => null)
  }

  return NextResponse.json({ ok: true, sent: sentCount })
}
