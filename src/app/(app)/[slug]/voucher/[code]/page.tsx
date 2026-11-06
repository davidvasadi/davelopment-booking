import { notFound } from 'next/navigation'
import { GuestShell, VoucherView } from '@/components/blocks/guest-pages'
import { getPayloadClient } from '@/lib/payload'
import { formatPrice } from '@/lib/utils'
import type { Salon, Restaurant, GiftVoucher, Media } from '@/payload/payload-types'

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
  const logo = business.logo && typeof business.logo === 'object' ? (business.logo as Media).url ?? null : null
  // a vásárló / megajándékozott neve SZÁNDÉKOSAN nem látszik (bárki lefényképezheti a QR-t) — csak mit, mennyit, meddig
  return (
    <GuestShell biz={{ name: business.name, logo }}>
      <VoucherView amount={formatPrice(voucher.amount_huf)} code={voucher.code} status={STATUS_LABEL[voucher.status] ?? voucher.status} active={voucher.status === 'active'}
        expires={expires} restaurant={kind === 'restaurant'} photo={imageUrl} bookHref={`/${slug}?voucher=${encodeURIComponent(voucher.code)}`} />
    </GuestShell>
  )
}
