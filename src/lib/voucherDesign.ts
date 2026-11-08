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
export type VoucherLayout = (typeof VOUCHER_LAYOUTS)[number][0]
export type VoucherColor = (typeof VOUCHER_COLORS)[number][0]
export type VoucherText = (typeof VOUCHER_TEXTS)[number][0]
export type VoucherDesign = { layout: VoucherLayout; color: VoucherColor; text?: VoucherText }

export const DEFAULT_VOUCHER_DESIGN: VoucherDesign = { layout: 'stub', color: 'midnight', text: 'auto' }

/** A tárolt (szabad szöveges) értékből érvényes sablon — ismeretlen / üres → az alap. */
export function voucherDesign(layout?: string | null, color?: string | null, text?: string | null): VoucherDesign {
  return {
    layout: VOUCHER_LAYOUTS.some(([k]) => k === layout) ? (layout as VoucherLayout) : DEFAULT_VOUCHER_DESIGN.layout,
    color: VOUCHER_COLORS.some(([k]) => k === color) ? (color as VoucherColor) : DEFAULT_VOUCHER_DESIGN.color,
    text: text === 'light' || text === 'dark' ? text : 'auto',
  }
}
