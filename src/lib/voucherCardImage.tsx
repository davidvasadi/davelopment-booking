import { vtxt } from './voucherText'
import type { VoucherDesign } from './voucherDesign'

/**
 * Az utalvány-jegy képként (PNG) a levélbe — a `next/og` (satori) rajzolja, ezért csak inline stílus és flexbox.
 * A képhez a Gmail sötét módja nem nyúl, így a jegy minden levelezőben pontosan így látszik (a szöveges jegynél
 * világos kártyán szürke foltok maradtak). A szelvényes elrendezés: bal oldalt az adatok, jobb oldalt a QR és a kód;
 * a típus képe (ha van) a jegy tetején. Méret: 2× (1104 px széles), a levélben 552 px.
 */

/** a kártya színe: a színátmenet két vége + világos-e (sötét szöveg) — a jegy (money › VBG_STYLE) alapszínei */
export const CARD_COLORS: Record<string, { a: string; b: string; light: boolean }> = {
  midnight: { a: '#2A2A2C', b: '#0B0B0D', light: false },
  sage: { a: '#6E8A72', b: '#3F5646', light: false },
  terracotta: { a: '#C46A4A', b: '#8E3F2C', light: false },
  linen: { a: '#F7F1E6', b: '#EFE6D6', light: true },
}

export const CARD_W = 1104
export function cardHeight(o: { photo?: string | null; message?: string | null }): number {
  // a fotó a háttérszín HELYETT van (háttérképes jegy) — nem növeli a magasságot
  return 600 + (o.message ? 110 : 0)
}

/** sötét szöveg kell-e (világos kártya) — fotós jegyen mindig világos szöveg (a fotót sötétítjük) */
export function cardIsLight(design: VoucherDesign, photo?: boolean): boolean {
  if (photo) return false
  const c = CARD_COLORS[design.color] ?? CARD_COLORS.midnight
  return design.text === 'light' ? false : design.text === 'dark' ? true : c.light
}

export function VoucherCardImage(o: {
  design: VoucherDesign
  amount: string
  code: string
  expires: string
  to?: string | null
  message?: string | null
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
  const fg = light ? '#2B2B2B' : '#FFFFFF'
  const soft = light ? 'rgba(43,43,43,0.62)' : 'rgba(255,255,255,0.7)'
  const line = light ? 'rgba(43,43,43,0.25)' : 'rgba(255,255,255,0.3)'
  return (
    <div style={{ width: CARD_W, height: cardHeight(o), display: 'flex', flexDirection: 'column', borderRadius: 36, overflow: 'hidden', position: 'relative', backgroundColor: c.a, backgroundImage: `linear-gradient(160deg, ${c.a}, ${c.b})`, fontFamily: 'Geist' }}>
      {o.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.photo} alt="" width={CARD_W} height={cardHeight(o)} style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: cardHeight(o), objectFit: 'cover' }} />
      )}
      {/* a fotó sötétítése, hogy a fehér szöveg és a QR olvasható legyen */}
      {o.photo && <div style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: cardHeight(o), backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.62), rgba(0,0,0,0.38))' }} />}
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 640, padding: '48px 40px 44px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {o.bizImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.bizImg} alt="" height={60} style={{ height: 60, marginRight: 20 }} />
            )}
            <div style={{ fontSize: 28, color: fg }}>{o.bizName}</div>
          </div>
          <div style={{ marginTop: 40, fontSize: 24, color: soft }}>{`${L.gift}${o.to ? ` · ${L.forTo(o.to)}` : ''}`}</div>
          <div style={{ marginTop: 8, fontSize: 84, lineHeight: 1.05, color: fg, letterSpacing: -2 }}>{o.amount}</div>
          {o.message && <div style={{ marginTop: 24, fontSize: 28, lineHeight: 1.45, color: fg, fontStyle: 'italic' }}>{`„${o.message}”`}</div>}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', fontSize: 24, lineHeight: 1.5, color: soft }}>
            <div>{`${L.expires}: ${o.expires}`}</div>
            <div>{L.redeem(o.restaurant ? L.rest : L.salon)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, borderLeft: `4px dashed ${line}`, padding: '40px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* fotón a QR mögé nyugodt, sötét alap kell, hogy a telefon biztosan beolvassa */}
          <div style={{ display: 'flex', padding: o.photo ? 28 : 0, borderRadius: 28, backgroundColor: o.photo ? 'rgba(0,0,0,0.55)' : 'transparent' }}>
            <img src={o.qr} alt="" width={300} height={300} style={{ width: 300, height: 300 }} />
          </div>
          <div style={{ marginTop: 20, fontSize: 30, letterSpacing: 4, color: fg }}>{o.code}</div>
        </div>
      </div>
    </div>
  )
}
