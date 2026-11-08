import { ImageResponse } from 'next/og'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { getPayloadClient } from '@/lib/payload'
import { generateVoucherQrPng } from '@/lib/voucherQr'
import { brandImage, type BrandPlace } from '@/lib/brandImage'
import { fixMediaUrl, formatPrice } from '@/lib/utils'
import { voucherDesign } from '@/lib/voucherDesign'
import { CARD_W, VoucherCardImage, cardHeight, cardIsLight } from '@/lib/voucherCardImage'
import type { GiftVoucher, GiftVoucherType, Media, Restaurant, Salon } from '@/payload/payload-types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
const abs = (u: string) => (u.startsWith('http') ? u : `${APP_URL}${u}`)

/** egy kép PNG / JPEG data-URL-ként (a satori a WebP-t nem tudja), adott szélességre */
async function asDataUrl(url: string | null | undefined, width: number, jpeg = false): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(abs(fixMediaUrl(url) ?? url))
    if (!res.ok) return null
    const img = sharp(Buffer.from(await res.arrayBuffer())).resize({ width, withoutEnlargement: true })
    const buf = jpeg ? await img.jpeg({ quality: 82 }).toBuffer() : await img.png().toBuffer()
    return `data:image/${jpeg ? 'jpeg' : 'png'};base64,${buf.toString('base64')}`
  } catch { return null }
}

/**
 * Az utalvány-jegy PNG-ként — a levél ezt a képet mutatja (lib/emailVoucher), mert a képhez a Gmail sötét módja nem
 * nyúl. A jegy adatai (összeg, címzett, üzenet, lejárat, QR, kód) amúgy is a levélben vannak, új adatot nem ad ki.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  const code = raw.replace(/\.png$/i, '')
  if (!/^[A-Z0-9-]{4,32}$/i.test(code)) return new NextResponse('Not found', { status: 404 })
  const payload = await getPayloadClient()
  const v = (await payload.find({ collection: 'gift-vouchers', where: { code: { equals: code } }, depth: 1, limit: 1, overrideAccess: true })).docs[0] as GiftVoucher | undefined
  if (!v) return new NextResponse('Not found', { status: 404 })
  const restaurant = !!v.restaurant && !v.salon
  const bizRef = (v.salon ?? v.restaurant) as Salon | Restaurant | string | number | null
  const biz = (typeof bizRef === 'object' && bizRef ? bizRef : bizRef
    ? await payload.findByID({ collection: restaurant ? 'restaurants' : 'salons', id: bizRef as string, depth: 1, overrideAccess: true }).catch(() => null)
    : null) as Salon | Restaurant | null
  if (!biz?.slug) return new NextResponse('Not found', { status: 404 })
  // a média (logó / ikon) kell a választáshoz — depth 1-gyel jön, ha a fenti még csak azonosítót adott
  const place = (typeof biz.logo === 'object' || typeof (biz as { icon?: unknown }).icon === 'object' ? biz : await payload.findByID({ collection: restaurant ? 'restaurants' : 'salons', id: biz.id, depth: 1, overrideAccess: true })) as Salon | Restaurant
  const type = (typeof v.voucher_type === 'object' ? v.voucher_type : null) as GiftVoucherType | null
  const design = voucherDesign(type?.card_layout, type?.card_color, type?.card_text, type?.card_brand)
  const photoMedia = (typeof v.image === 'object' && v.image ? v.image : typeof type?.image === 'object' ? type?.image : null) as Media | null
  const logo = brandImage(place as BrandPlace, 'qr')
  const [bizImg, photo] = await Promise.all([
    asDataUrl(brandImage(place as BrandPlace, 'voucher', design.brand), 240),
    asDataUrl(photoMedia?.url, CARD_W, true),
  ])
  const light = cardIsLight(design, !!photo)
  const qrPng = await generateVoucherQrPng(biz.slug, code, logo ? fixMediaUrl(logo) : null, light ? '#2B2B2B' : '#FFFFFF')
  const message = v.message ? (v.message.length > 140 ? `${v.message.slice(0, 137)}…` : v.message) : null
  const lang = (v as { locale?: string | null }).locale ?? 'hu'
  const expires = new Intl.DateTimeFormat(lang === 'hu' ? 'hu-HU' : lang, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(v.expires_at))
  const o = { photo, message }
  return new ImageResponse(
    <VoucherCardImage design={design} amount={formatPrice(v.amount_huf, 'HUF')} code={code} expires={expires} to={v.recipient_name} message={message} bizName={place.name} bizImg={bizImg} photo={photo} qr={`data:image/png;base64,${qrPng.toString('base64')}`} lang={lang} restaurant={restaurant} />,
    { width: CARD_W, height: cardHeight(o), headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
