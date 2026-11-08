/**
 * Az utalvány sablonjai (design 12.x „Az utalvány (jegy-típusok)”): a jegy formája és a színe. A típus menti
 * (`gift-voucher-types.card_layout` / `card_color`); ha a típusnak van képe, a kép a háttér, a szín csak kép nélkül számít.
 */
export const VOUCHER_LAYOUTS = [
  ['stub', 'Szelvényes'],
  ['postcard', 'Képeslap'],
  ['cinema', 'Mozijegy'],
  ['tag', 'Ajándékcímke'],
  ['wristband', 'Karszalag'],
  ['vertical', 'Álló'],
] as const
export const VOUCHER_COLORS = [
  ['midnight', 'Éjfekete'],
  ['sage', 'Zsálya'],
  ['linen', 'Krém'],
  ['terracotta', 'Terrakotta'],
] as const
/** a szöveg színe: a háttérhez igazodik (alap), világos vagy sötét */
export const VOUCHER_TEXTS = [
  ['auto', 'Automatikus'],
  ['light', 'Világos'],
  ['dark', 'Sötét'],
] as const
/** az üzlet képe a jegy fejlécében (design 24.2): ikon (alap), logó vagy semmi */
export const VOUCHER_BRANDS = [
  ['logo', 'Logó'],
  ['icon', 'Ikon'],
  ['none', 'Nincs'],
] as const
export type VoucherLayout = (typeof VOUCHER_LAYOUTS)[number][0]
export type VoucherColor = (typeof VOUCHER_COLORS)[number][0]
export type VoucherText = (typeof VOUCHER_TEXTS)[number][0]
export type VoucherBrand = (typeof VOUCHER_BRANDS)[number][0]
export type VoucherDesign = { layout: VoucherLayout; color: VoucherColor; text?: VoucherText; brand?: VoucherBrand }

export const DEFAULT_VOUCHER_DESIGN: VoucherDesign = { layout: 'stub', color: 'midnight', text: 'auto', brand: 'icon' }

/** A tárolt (szabad szöveges) értékből érvényes sablon — ismeretlen / üres → az alap. */
export function voucherDesign(layout?: string | null, color?: string | null, text?: string | null, brand?: string | null): VoucherDesign {
  return {
    layout: VOUCHER_LAYOUTS.some(([k]) => k === layout) ? (layout as VoucherLayout) : DEFAULT_VOUCHER_DESIGN.layout,
    color: VOUCHER_COLORS.some(([k]) => k === color) ? (color as VoucherColor) : DEFAULT_VOUCHER_DESIGN.color,
    text: text === 'light' || text === 'dark' ? text : 'auto',
    brand: brand === 'logo' || brand === 'none' ? brand : 'icon',
  }
}
