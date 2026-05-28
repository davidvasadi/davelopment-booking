import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Media, Restaurant, Salon } from '@/payload/payload-types'
import {
  emailLayout,
  heroBlock,
  detailsCard,
  infoRow,
  introBlock,
  cancelBlock,
  footerInfoBlock,
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

  const detailRows =
    type === 'salon'
      ? [
          infoRow('user', 'Név', name),
          infoRow('mail', 'Email', guestEmail),
          infoRow('scissors', 'Szolgáltatás', 'Hajvágás + szárítás'),
          infoRow('user', 'Munkatárs', 'Nagy Eszter'),
          infoRow('calendar', 'Dátum', '2026-06-12'),
          infoRow('clock', 'Időpont', '14:30 – 15:15'),
        ].join('')
      : [
          infoRow('user', 'Név', name),
          infoRow('mail', 'Email', guestEmail),
          infoRow('calendar', 'Dátum', '2026-06-12'),
          infoRow('clock', 'Időpont', '19:00 – 21:00'),
          infoRow('people', 'Létszám', '4 fő'),
          infoRow('pin', 'Cím', realAddress || '1051 Budapest, Példa u. 1.'),
        ].join('')
  // A valódi cég foglaló oldalára mutat (ott van a feltétel-modal). Ha nincs
  // bejelentkezett cég (slug), a link nem visz sehova (#) — így nincs 404.
  const bookingUrl = realSlug ? `${APP_URL}/${realSlug}/feltetelek` : '#'
  const cancelUrl = '#' // preview: a lemondás-link nem visz sehova

  // A szerkesztőből élőben átadott bevezető szöveg (ha van), különben minta.
  const customIntro = p.get('intro')
  const introText =
    customIntro != null
      ? customIntro
      : 'Kedves {{name}}!\n\nKöszönjük a foglalást, várunk szeretettel!'

  let content: string
  if (state === 'cancel') {
    content = `
      ${heroBlock({ icon: 'cancel', title: 'Foglalás lemondva', subtitle: `Kedves ${name}, foglalásodat lemondtuk.` })}
      ${detailsCard(detailRows)}
      ${bottomSpacer()}`
  } else if (state === 'notify') {
    content = `
      ${heroBlock({ icon: 'bell', title: 'Új foglalás érkezett', subtitle: `${name} foglalt.` })}
      ${detailsCard(detailRows)}
      ${bottomSpacer()}`
  } else {
    content = `
      ${heroBlock({ icon: 'success', title: 'Foglalás visszaigazolva', subtitle: `Kedves ${name}, foglalásodat rögzítettük.` })}
      ${introBlock(introText, { name, date: '2026-06-12', time: '19:00 – 21:00', pax: '4', service: 'Hajvágás + szárítás' })}
      ${detailsCard(detailRows)}
      ${footerInfoBlock({
        hasTerms: true,
        bookingUrl,
        phone: p.get('phone') !== '0' ? (p.get('contactPhone')?.trim() || realPhone || '+36 1 234 5678') : null,
        email: p.get('cmail') === '1' ? (realEmail || (type === 'salon' ? 'info@szalon.hu' : 'info@etterem.hu')) : null,
        address: p.get('addr') === '1' ? (realAddress || '1051 Budapest, Példa u. 1.') : null,
        directionsAddress: p.get('dir') === '1' ? (p.get('dirAddr')?.trim() || realAddress || '1051 Budapest, Példa u. 1.') : null,
      })}
      ${cancelBlock(cancelUrl)}
      ${bottomSpacer()}`
  }

  const html = emailLayout({ brandName, brandLogoUrl, brandCoverUrl, content })
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
