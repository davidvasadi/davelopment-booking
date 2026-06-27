import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Media, Restaurant, Salon } from '@/payload/payload-types'
import { t, normalizeLocale } from '@/lib/i18n'
import {
  emailLayout,
  heroBlock,
  detailsCard,
  infoRow,
  introBlock,
  cancelBlock,
  footerInfoBlock,
  calendarBlock,
  formatBookingDate,
  bottomSpacer,
} from '@/lib/emailLayout'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function mediaUrl(field: string | Media | null | undefined): string | null {
  const url = field && typeof field === 'object' ? (field as Media).url : null
  if (!url) return null
  return url.startsWith('http') ? url : `${APP_URL}${url}`
}

/**
 * Email-sablon előnézet a böngészőben (a settings „Email" fül „Előnézet" gombja).
 * A bejelentkezett tulaj TÉNYLEGES logóját/borítóját/címét tölti be, hogy a
 * preview megegyezzen a valódival; csak a foglalási adatok (név, dátum) minta.
 * A szöveges beállításokat (intro, kapcsoló-állapotok) a query-ből kapja, így a
 * mentetlen módosítások is azonnal látszanak.
 *   ?type=salon|restaurant · ?state=confirm|notify|cancel
 *   ?intro=… · ?phone/cmail/addr/dir=1|0 · ?contactPhone/dirAddr=…
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const type = p.get('type') === 'salon' ? 'salon' : 'restaurant'
  const state = p.get('state') ?? 'confirm' // confirm | notify | cancel
  // A szerkesztési nyelv (a settings nyelvváltójából) — a preview ezen rendereli a vázat,
  // hogy megegyezzen a vendég nyelvén ténylegesen kiküldött emaillel.
  const locale = normalizeLocale(p.get('locale'))

  // A bejelentkezett tulaj tényleges cégének brandingje (logó/borító/név/cím).
  let brandName = type === 'salon' ? 'A szalonod' : 'Az éttermed'
  let brandLogoUrl: string | null = null
  let brandCoverUrl: string | null = null
  let realAddress: string | null = null
  let realPhone: string | null = null
  let realEmail: string | null = null
  let realSlug: string | null = null

  try {
    const user = await getCurrentUser()
    if (user) {
      const payload = await getPayloadClient()
      const collection = type === 'salon' ? 'salons' : 'restaurants'
      const res = await payload.find({
        collection,
        where: { owner: { equals: user.id } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
      const biz = res.docs[0] as Restaurant | Salon | undefined
      if (biz) {
        brandName = biz.name
        brandLogoUrl = mediaUrl(biz.logo)
        brandCoverUrl = mediaUrl(biz.cover_image)
        realPhone = biz.phone ?? null
        realEmail = biz.email ?? null
        realAddress = biz.address ? `${biz.address}${biz.city ? ', ' + biz.city : ''}` : null
        realSlug = biz.slug ?? null
      }
    }
  } catch {
    // Auth/DB hiba esetén megy tovább a fallback brand-névvel.
  }

  const name = type === 'salon' ? 'Tóth Béla' : 'Kovács Anna'
  const guestEmail = type === 'salon' ? 'toth.bela@example.com' : 'kovacs.anna@example.com'

  const PREVIEW_DATE = '2026-06-12'
  const detailRows =
    type === 'salon'
      ? [
          infoRow('user', t(locale, 'email.label.name'), name),
          infoRow('mail', t(locale, 'email.label.email'), guestEmail),
          infoRow('scissors', t(locale, 'email.label.service'), 'Hajvágás + szárítás'),
          infoRow('user', t(locale, 'email.label.staff'), 'Nagy Eszter'),
          infoRow('calendar', t(locale, 'email.label.date'), formatBookingDate(PREVIEW_DATE, locale)),
          infoRow('clock', t(locale, 'email.label.time'), '14:30 – 15:15'),
        ].join('')
      : [
          infoRow('user', t(locale, 'email.label.name'), name),
          infoRow('mail', t(locale, 'email.label.email'), guestEmail),
          infoRow('calendar', t(locale, 'email.label.date'), formatBookingDate(PREVIEW_DATE, locale)),
          infoRow('clock', t(locale, 'email.label.time'), '19:00 – 21:00'),
          infoRow('people', t(locale, 'email.label.guests'), '4 fő'),
          infoRow('pin', t(locale, 'email.label.address'), realAddress || '1051 Budapest, Példa u. 1.'),
        ].join('')
  // A valódi cég foglaló oldalára mutat (ott van a feltétel-modal). Ha nincs
  // bejelentkezett cég (slug), a link nem visz sehova (#) — így nincs 404.
  const bookingUrl = realSlug ? `${APP_URL}/${realSlug}/terms` : '#'
  const cancelUrl = '#' // preview: a lemondás-link nem visz sehova

  // A szerkesztőből élőben átadott bevezető szöveg (ha van, akár üres), különben minta.
  const customIntro = p.get('intro')
  const introText =
    customIntro != null && customIntro.trim() !== ''
      ? customIntro
      : t(locale, 'email.confirm.intro')

  let content: string
  if (state === 'cancel') {
    content = `
      ${heroBlock({ icon: 'cancel', title: t(locale, 'email.cancel.title'), subtitle: t(locale, 'email.cancel.body') })}
      ${detailsCard(detailRows)}
      ${bottomSpacer()}`
  } else if (state === 'notify') {
    // Az értesítő a tulajnak megy (HU dashboard) — magyar marad, mint a valódi.
    content = `
      ${heroBlock({ icon: 'bell', title: 'Új foglalás érkezett', subtitle: `${name} foglalt.` })}
      ${detailsCard(detailRows)}
      ${bottomSpacer()}`
  } else {
    content = `
      ${heroBlock({ icon: 'success', title: t(locale, 'email.confirm.title'), subtitle: t(locale, 'email.greeting', { name }) })}
      ${introBlock(introText, { name, date: '2026-06-12', time: '19:00 – 21:00', pax: '4', service: 'Hajvágás + szárítás' })}
      ${detailsCard(detailRows)}
      ${calendarBlock({
        title: type === 'salon' ? `Hajvágás + szárítás – ${brandName}` : `${t(locale, 'rbooking.header')} – ${brandName}`,
        date: PREVIEW_DATE,
        startTime: type === 'salon' ? '14:30' : '19:00',
        endTime: type === 'salon' ? '15:15' : '21:00',
        location: realAddress,
        locale,
      })}
      ${footerInfoBlock({
        hasTerms: true,
        bookingUrl,
        phone: p.get('phone') !== '0' ? (p.get('contactPhone')?.trim() || realPhone || '+36 1 234 5678') : null,
        email: p.get('cmail') === '1' ? (realEmail || (type === 'salon' ? 'info@szalon.hu' : 'info@etterem.hu')) : null,
        address: p.get('addr') === '1' ? (realAddress || '1051 Budapest, Példa u. 1.') : null,
        directionsAddress: p.get('dir') === '1' ? (p.get('dirAddr')?.trim() || realAddress || '1051 Budapest, Példa u. 1.') : null,
        locale,
      })}
      ${cancelBlock(cancelUrl, locale)}
      ${bottomSpacer()}`
  }

  const html = emailLayout({ brandName, brandLogoUrl, brandCoverUrl, content })
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
