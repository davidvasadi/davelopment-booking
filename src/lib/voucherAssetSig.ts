import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Aláírás a levélbe kerülő utalvány-képek (jegy, QR) linkjéhez. A jegy-kép a címzett nevét és az üzenetet is mutatja,
 * ezért a kódból magából NE lehessen lekérni (a kód kitalálható formátumú, és a kód-próbálgatás jelzésére sem
 * szabad válaszolnia) — csak a levélben kapott, aláírt linkkel. A PAYLOAD_SECRET a kulcs.
 */
export function voucherAssetSig(code: string): string {
  return createHmac('sha256', process.env.PAYLOAD_SECRET ?? 'dev-secret').update(`voucher-asset:${code.toUpperCase()}`).digest('hex').slice(0, 24)
}

export function voucherAssetSigOk(code: string, sig: string | null): boolean {
  if (!sig) return false
  const a = Buffer.from(voucherAssetSig(code))
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}
