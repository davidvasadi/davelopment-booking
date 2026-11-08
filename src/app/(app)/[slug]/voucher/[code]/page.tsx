import { notFound } from 'next/navigation'
import { GuestShell, VoucherView } from '@/components/blocks/guest-pages'
import { getPayloadClient } from '@/lib/payload'
import { formatPrice } from '@/lib/utils'
import type { Salon, Restaurant, GiftVoucher, GiftVoucherType, Media } from '@/payload/payload-types'
import { voucherDesign } from '@/lib/voucherDesign'
import { fixMediaUrl } from '@/lib/utils'
import { generateVoucherQrDataUrl } from '@/lib/voucherQr'

export const metadata = { title: 'Ajándékutalvány' }

/**
 * Önálló, publikus megjelenítő oldal — IDE mutat a QR-kód (nem egyenesen a foglaló-felületre,
 * lásd `src/lib/voucherQr.ts`). Csak azt mutatja meg, MIT vásároltak/kaptak (típus-kép/név,
 * összeg, státusz, lejárat) — a vásárló/megajándékozott nevét/emailjét SZÁNDÉKOSAN nem, mert
 * bárki lefényképezheti/megoszthatja a QR-t (PII-védelem). A "Beváltás" gomb viszi tovább a
 * meglévő `?voucher=` előtöltős linkre.
 */

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktív',
  redeemed: 'Beváltva',
  expired: 'Lejárt',
  refunded: 'Visszatérítve',
}

export default async function VoucherDisplayPage({ params }: { params: Promise<{ slug: string; code: string }> }) {
  const { slug, code } = await params
  const payload = await getPayloadClient()

  const salonRes = await payload.find({
    collection: 'salons',
    where: { and: [{ slug: { equals: slug } }, { is_active: { equals: true } }] },
    limit: 1,
    depth: 0,
  })
  let business: Salon | Restaurant | undefined = salonRes.docs[0] as Salon | undefined
  let kind: 'salon' | 'restaurant' = 'salon'
  if (!business) {
    const restRes = await payload.find({
      collection: 'restaurants',
      where: { and: [{ slug: { equals: slug } }, { is_active: { not_equals: false } }] },
      limit: 1,
      depth: 0,
    })
    business = restRes.docs[0] as Restaurant | undefined
    kind = 'restaurant'
  }
  if (!business) notFound()

  const voucherRes = await payload.find({
    collection: 'gift-vouchers',
    where: {
      and: [
        { code: { equals: code.toUpperCase() } },
        kind === 'salon' ? { salon: { equals: business.id } } : { restaurant: { equals: business.id } },
      ],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const voucher = voucherRes.docs[0] as GiftVoucher | undefined
  if (!voucher) notFound()

  const imageUrl = voucher.image && typeof voucher.image === 'object' ? (voucher.image as Media).url ?? null : null
  const expires = new Date(voucher.expires_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
  // a logó: az üzletet mélység nélkül olvassuk (gyors), így a logó csak azonosító — a médiát külön kérjük le
  const logoRel = business.logo
  const logoDoc = logoRel && typeof logoRel === 'object' ? (logoRel as Media)
    : logoRel != null ? ((await payload.findByID({ collection: 'media', id: logoRel, depth: 0, overrideAccess: true }).catch(() => null)) as Media | null) : null
  const logo = logoDoc?.url ? fixMediaUrl(logoDoc.url) ?? null : null
  // a típus sablonja (forma + szín) és a QR — ugyanaz a jegy, amit a vendég kapott
  const vt = voucher.voucher_type && typeof voucher.voucher_type === 'object' ? (voucher.voucher_type as GiftVoucherType) : null
  const design = voucherDesign(vt?.card_layout, vt?.card_color, vt?.card_text)
  const qr = await generateVoucherQrDataUrl(slug, voucher.code).catch(() => undefined)
  // a vásárló / megajándékozott neve SZÁNDÉKOSAN nem látszik (bárki lefényképezheti a QR-t) — csak mit, mennyit, meddig
  return (
    <GuestShell biz={{ name: business.name, logo }}>
      <VoucherView amount={formatPrice(voucher.amount_huf)} code={voucher.code} status={STATUS_LABEL[voucher.status] ?? voucher.status} tone={voucher.status === 'active' ? 'ok' : voucher.status === 'redeemed' ? 'confirmed' : 'bad'} active={voucher.status === 'active'}
        expires={expires} restaurant={kind === 'restaurant'} photo={imageUrl} design={design} qr={qr} lang={voucher.locale ?? 'hu'} biz={{ name: business.name, logo }} bookHref={`/${slug}?voucher=${encodeURIComponent(voucher.code)}`} />
    </GuestShell>
  )
}
