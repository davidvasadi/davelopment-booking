import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Gift } from 'lucide-react'
import { getPayloadClient } from '@/lib/payload'
import { formatPrice } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
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
  const expiresAt = new Date(voucher.expires_at).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
  const statusLabel = STATUS_LABEL[voucher.status] ?? voucher.status

  return (
    <div
      className="min-h-[100dvh] px-4 py-10"
      style={{ background: 'linear-gradient(160deg, #161512 0%, #1c1a16 60%, #161512 100%)' }}
    >
      <div className="mx-auto max-w-md">
        <Link href={`/${slug}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Vissza
        </Link>

        <div className="mb-6 flex justify-center">
          <BrandLogo variant="dark" className="h-6" />
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.04] backdrop-blur-[10px]">
          <div className="h-44 w-full bg-white/[0.06]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Gift className="h-10 w-10 text-white/25" />
              </div>
            )}
          </div>

          <div className="px-6 py-6 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">{business.name}</p>
            <h1 className="mt-1.5 text-[22px] font-light tracking-[-0.02em] text-white">{voucher.type_name ?? 'Ajándékutalvány'}</h1>
            <p className="mt-2 text-3xl font-semibold text-gold">{formatPrice(voucher.amount_huf, 'HUF')}</p>

            <div className="mt-5 flex items-center justify-center gap-2 text-[13px] text-white/55">
              <span className={voucher.status === 'active' ? 'text-emerald-400' : 'text-white/45'}>{statusLabel}</span>
              <span className="text-white/20">•</span>
              <span>Érvényes: {expiresAt}</span>
            </div>

            {voucher.status === 'active' && (
              <Link
                href={`/${slug}?voucher=${encodeURIComponent(voucher.code)}`}
                className="mt-6 flex h-13 w-full items-center justify-center rounded-full text-[15px] font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'white', color: 'var(--ink-dark)', height: '3.25rem' }}
              >
                Beváltás foglaláskor
              </Link>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-white/30">Kód: {voucher.code}</p>
      </div>
    </div>
  )
}
