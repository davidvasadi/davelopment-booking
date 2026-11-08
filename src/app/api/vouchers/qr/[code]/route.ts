import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { generateVoucherQrPng } from '@/lib/voucherQr'
import { brandImage, type BrandPlace } from '@/lib/brandImage'
import { fixMediaUrl } from '@/lib/utils'
import type { Restaurant, Salon } from '@/payload/payload-types'

/**
 * Az utalvány QR-kódja PNG-ként — a levélbe kerülő jegy (lib/emailVoucher) ezt linkeli, mert a Gmail a levélbe ágyazott
 * (data-URL) képet nem mutatja. A QR a publikus utalvány-oldalra visz (ugyanaz, mint a jegyen); a kód amúgy is benne van
 * a levélben, így ez nem ad ki új adatot. `?ink=light`: világos modulok (sötét kártyára), különben sötét.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!/^[A-Z0-9-]{4,32}$/i.test(code)) return new NextResponse('Not found', { status: 404 })
  const payload = await getPayloadClient()
  const found = await payload.find({ collection: 'gift-vouchers', where: { code: { equals: code } }, depth: 0, limit: 1, overrideAccess: true, select: { salon: true, restaurant: true } })
  const v = found.docs[0] as { salon?: unknown; restaurant?: unknown } | undefined
  if (!v) return new NextResponse('Not found', { status: 404 })
  const salonId = v.salon && typeof v.salon === 'object' ? (v.salon as { id: string | number }).id : v.salon
  const restId = v.restaurant && typeof v.restaurant === 'object' ? (v.restaurant as { id: string | number }).id : v.restaurant
  const biz = (salonId
    ? await payload.findByID({ collection: 'salons', id: salonId as string, depth: 1, overrideAccess: true }).catch(() => null)
    : restId ? await payload.findByID({ collection: 'restaurants', id: restId as string, depth: 1, overrideAccess: true }).catch(() => null) : null) as Salon | Restaurant | null
  if (!biz?.slug) return new NextResponse('Not found', { status: 404 })
  const logo = brandImage(biz as BrandPlace, 'qr')
  const png = await generateVoucherQrPng(biz.slug, code, logo ? fixMediaUrl(logo) : null, req.nextUrl.searchParams.get('ink') === 'light' ? '#FFFFFF' : '#2B2B2B')
  return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' } })
}
