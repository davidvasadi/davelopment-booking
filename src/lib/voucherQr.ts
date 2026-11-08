import QRCode from 'qrcode'
import sharp from 'sharp'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/** Az önálló, publikus utalvány-megjelenítő oldal (típus-kép/név/összeg/státusz, PII nélkül) —
 *  ide mutat a QR-kód, NEM egyenesen a foglaló-felületre. Onnan a "Beváltás" gomb viszi tovább
 *  a `?voucher=` előtöltős linkre (lásd `voucherBookingRedeemUrl`). */
export function voucherDisplayUrl(slug: string, code: string): string {
  return `${APP_URL}/${slug}/voucher/${encodeURIComponent(code)}`
}

/** A beváltó link, amit a ProfileCard/RestaurantCard `?voucher=` query-paramként olvas ki,
 *  és automatikusan megnyitja/előtölti vele a beváltás-mezőt a foglaló-varázsló details lépésén. */
export function voucherBookingRedeemUrl(slug: string, code: string): string {
  return `${APP_URL}/${slug}?voucher=${encodeURIComponent(code)}`
}

/**
 * PNG data-URL egy stílusozott (lekerekített modulok, opcionálisan a szalon/étterem logójával a
 * közepén) QR-kódról a megjelenítő oldal linkjéről. Szándékosan ÁTLÁTSZÓ hátterű — így email/
 * dashboard bármilyen (fehér vagy krém) háttérszínébe simán beleolvad, nincs éles fehér doboz
 * körülötte. `sharp`-pal rasterizált SVG-ből épül, nincs szükség fájl-tárolásra/media-collection
 * bejegyzésre egy ilyen kis, egyszer-generált képhez. Ha van logó, `H` hibajavítási szintet
 * használunk, hogy a középső takarás (~22%) ne rontsa a beolvashatóságot.
 */
export async function generateVoucherQrDataUrl(slug: string, code: string, logoUrl?: string | null): Promise<string> {
  const pngBuffer = await generateVoucherQrPng(slug, code, logoUrl)
  return `data:image/png;base64,${pngBuffer.toString('base64')}`
}

/** Ugyanez PNG-ként (a levélbe linkkel kerül — a Gmail a data-URL-es képet nem mutatja). `ink`: a modulok színe
 *  (a levélbe kerülő jegyen a kártya színéhez illik: sötét kártyán világos). */
export async function generateVoucherQrPng(slug: string, code: string, logoUrl?: string | null, ink = '#181818'): Promise<Buffer> {
  const qr = QRCode.create(voucherDisplayUrl(slug, code), { errorCorrectionLevel: logoUrl ? 'H' : 'M' })
  const { modules } = qr
  const size = modules.size
  const quiet = 4
  const targetDim = 440
  const cell = Math.max(6, Math.floor(targetDim / (size + quiet * 2)))
  const dim = (size + quiet * 2) * cell
  const dotRadius = cell * 0.32

  let dots = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(y, x)) {
        const px = (x + quiet) * cell
        const py = (y + quiet) * cell
        dots += `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="${dotRadius}" ry="${dotRadius}" fill="${ink}"/>`
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">${dots}</svg>`

  let image = sharp(Buffer.from(svg))

  if (logoUrl) {
    try {
      const res = await fetch(logoUrl)
      if (res.ok) {
        const logoBuffer = Buffer.from(await res.arrayBuffer())
        const logoSize = Math.round(dim * 0.2)
        const frameSize = Math.round(logoSize * 1.35)
        const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frameSize}" height="${frameSize}">` +
          `<rect width="${frameSize}" height="${frameSize}" rx="${frameSize * 0.3}" ry="${frameSize * 0.3}" fill="#ffffff"/></svg>`
        const [frameBuffer, logoResized] = await Promise.all([
          sharp(Buffer.from(frameSvg)).png().toBuffer(),
          sharp(logoBuffer).resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer(),
        ])
        const frameOffset = Math.round((dim - frameSize) / 2)
        const logoOffset = Math.round((dim - logoSize) / 2)
        image = image.composite([
          { input: frameBuffer, left: frameOffset, top: frameOffset },
          { input: logoResized, left: logoOffset, top: logoOffset },
        ])
      }
    } catch {
      // A logó nélküli QR is teljesen érvényes — ne bukjon el rajta az utalvány kiállítása.
    }
  }

  return image.png().toBuffer()
}
