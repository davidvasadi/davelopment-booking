import { readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { vtxt } from './voucherText'
import type { VoucherDesign } from './voucherDesign'

/**
 * Az utalvány-jegy képként (PNG) a levélbe — a `next/og` (satori) rajzolja. Pontosan a „Szelvényes” jegy
 * (components/blocks/money › SingleLayout `stub`) mása, 2× méretben: fekvő, szögletes sarkú kártya, jobbra a letéphető
 * szelvény (szaggatott vágásvonal, a két végén félkör bevágás — a bevágás ÁTLÁTSZÓ, a levél háttere látszik át), balra
 * az üzlet, a címzett, az összeg (sötét / fotós kártyán sárga), a lejárat, hol váltható és a „Foglalási rendszer” sor.
 * A képhez a Gmail sötét módja nem nyúl, így a jegy minden levelezőben pontosan így látszik.
 */

/** a kártya színe: a színátmenet két vége + világos-e (sötét szöveg) — a jegy (money › VBG_STYLE) alapszínei */
export const CARD_COLORS: Record<string, { a: string; b: string; light: boolean }> = {
  midnight: { a: '#2A2A2C', b: '#0B0B0D', light: false },
  sage: { a: '#6E8A72', b: '#3F5646', light: false },
  terracotta: { a: '#C46A4A', b: '#8E3F2C', light: false },
  linen: { a: '#F7F1E6', b: '#EFE6D6', light: true },
}

/** 2× a webes jegy méretéhez (a levélben fele akkora jelenik meg) */
const X = 2
export const CARD_W = 552 * X
export const CARD_H = 236 * X
/** a szelvény szélessége (a QR-oszlop, a vágásvonallal) */
const STUB_W = 150 * X
const PAD = 20 * X
const NOTCH = 9 * X

/** sötét szöveg kell-e (világos kártya) — fotós jegyen mindig világos szöveg (a fotót sötétítjük) */
export function cardIsLight(design: VoucherDesign, photo?: boolean): boolean {
  if (photo) return false
  const c = CARD_COLORS[design.color] ?? CARD_COLORS.midnight
  return design.text === 'light' ? false : design.text === 'dark' ? true : c.light
}

/** a davelopment booking logó (a „Foglalási rendszer” sorhoz) — sötét kártyán a világos változat */
function poweredByLogo(onDark: boolean): string {
  const file = path.join(process.cwd(), 'public', onDark ? 'logo_davelopment_booking_dark.svg' : 'logo_davelopment_booking_light.svg')
  try { return `data:image/svg+xml;base64,${readFileSync(file).toString('base64')}` } catch { return '' }
}

export function VoucherCardImage(o: {
  design: VoucherDesign
  amount: string
  code: string
  expires: string
  to?: string | null
  bizName: string
  bizImg?: string | null
  photo?: string | null
  qr: string
  lang?: string | null
  restaurant?: boolean
}) {
  const L = vtxt(o.lang)
  const c = CARD_COLORS[o.design.color] ?? CARD_COLORS.midnight
  const light = cardIsLight(o.design, !!o.photo)
  const fg = light ? '#383838' : '#FFFFFF'
  const soft = light ? 'rgba(56,56,56,0.55)' : 'rgba(255,255,255,0.55)'
  const line = light ? 'rgba(56,56,56,0.25)' : 'rgba(255,255,255,0.3)'
  const logo = poweredByLogo(!light)
  return (
    <div style={{ width: CARD_W, height: CARD_H, display: 'flex', position: 'relative', backgroundColor: c.a, backgroundImage: `linear-gradient(160deg, ${c.a}, ${c.b})`, fontFamily: 'Geist', color: fg }}>
      {o.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.photo} alt="" width={CARD_W} height={CARD_H} style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, objectFit: 'cover' }} />
      )}
      {/* a fotó sötétítése — mint a jegyen (bg-ui-dark/45) */}
      {o.photo && <div style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, backgroundColor: 'rgba(56,56,56,0.45)' }} />}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: PAD }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {o.bizImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.bizImg} alt="" height={32 * X} style={{ height: 32 * X, marginRight: 10 * X }} />
          )}
          <div style={{ fontSize: 12 * X, lineHeight: 1.25 }}>{o.bizName}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11 * X, color: soft }}>{o.to ? `${L.gift} · ${L.forTo(o.to)}` : L.gift}</div>
          <div style={{ fontSize: 34 * X, lineHeight: 1, letterSpacing: -0.68 * X, color: light ? fg : '#FFD85F', marginTop: 2 * X }}>{o.amount}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 11 * X, lineHeight: 1.6, color: soft }}>
          <div>{`${L.expires}: ${o.expires}`}</div>
          <div>{L.redeem(o.restaurant ? L.rest : L.salon)}</div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 * X }}>
            <span style={{ marginRight: 8 * X }}>{L.system}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="" height={16 * X} width={Math.round((16 * X * 2098) / 770)} style={{ height: 16 * X }} />}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: STUB_W, borderLeft: `${2 * X}px dashed ${line}`, padding: `${PAD}px 0 ${PAD}px ${PAD}px` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={o.qr} alt="" width={100 * X} height={100 * X} style={{ width: 100 * X, height: 100 * X }} />
        <div style={{ marginTop: 10 * X, fontSize: 12 * X, letterSpacing: 1 * X }}>{o.code}</div>
      </div>
    </div>
  )
}

/** A kész PNG-n a vágásvonal két végén a félkör bevágás kivágása (átlátszó — a levél háttere látszik át, sötét módban is). */
export async function cutNotches(png: Buffer): Promise<Buffer> {
  const cx = CARD_W - STUB_W + X // a szaggatott vonal közepe
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}"><circle cx="${cx}" cy="0" r="${NOTCH}" fill="#000"/><circle cx="${cx}" cy="${CARD_H}" r="${NOTCH}" fill="#000"/></svg>`
  return sharp(png).composite([{ input: Buffer.from(svg), blend: 'dest-out' }]).png().toBuffer()
}
