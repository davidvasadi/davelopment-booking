/**
 * Az üzlet képe egy adott helyen (design 24.x): a LOGÓ (széles) vagy az IKON (kicsi helyekre) — mindkettő úgy jelenik meg,
 * ahogy feltöltötték (nem vágjuk, nem kerekítjük). A tulaj a meglévő szerkesztőkben választ helyenként; az alap a hely
 * méretéhez illik. Ha a választott kép nincs feltöltve, a másik jön; `'none'`-nál (QR, utalvány) nincs kép; ha egyik sincs,
 * `null` → a hívó a név kezdőbetűit mutatja.
 */
export type BrandWhere = 'page' | 'email' | 'qr' | 'voucher' | 'dash'
export type BrandChoice = 'logo' | 'icon' | 'none'
export type BrandLogoSize = 'sm' | 'md' | 'lg'

/** az alap helyenként: széles helyen a logó, kicsi / négyzetes helyen az ikon */
export const BRAND_DEFAULT: Record<BrandWhere, BrandChoice> = { page: 'logo', email: 'logo', qr: 'icon', voucher: 'icon', dash: 'icon' }
/** a logó magassága px-ben (kicsi / közepes / nagy) — csak a magasság változik, az arány marad */
export const LOGO_HEIGHT: Record<BrandLogoSize, number> = { sm: 24, md: 32, lg: 44 }

type MediaLike = { url?: string | null } | string | number | null | undefined
export type BrandPlace = {
  logo?: MediaLike
  icon?: MediaLike
  brand_page?: string | null
  brand_email?: string | null
  brand_qr?: string | null
  brand_logo_size?: string | null
}

const urlOf = (m: MediaLike): string | null => (m && typeof m === 'object' && m.url ? m.url : null)
const asChoice = (v: string | null | undefined): BrandChoice | null => (v === 'logo' || v === 'icon' || v === 'none' ? v : null)

/** a tulaj választása az adott helyen (a mentett beállítás, különben az alap); `override`: pl. az utalvány-típus saját */
export function brandChoice(place: BrandPlace | null | undefined, where: BrandWhere, override?: string | null): BrandChoice {
  const saved = where === 'page' ? place?.brand_page : where === 'email' ? place?.brand_email : where === 'qr' ? place?.brand_qr : null
  return asChoice(override) ?? asChoice(saved) ?? BRAND_DEFAULT[where]
}

/** Az adott helyen megjelenő kép URL-je (a média saját URL-je — a hívó teszi abszolúttá, ha kell), vagy `null`. */
export function brandImage(place: BrandPlace | null | undefined, where: BrandWhere, override?: string | null): string | null {
  const choice = brandChoice(place, where, override)
  if (choice === 'none') return null
  const logo = urlOf(place?.logo)
  const icon = urlOf(place?.icon)
  return choice === 'icon' ? icon ?? logo : logo ?? icon
}

/** a választott kép ikon-e (az ikon kicsi helyen nagyobb magasságot kap, hogy felismerhető legyen) */
export function brandIsIcon(place: BrandPlace | null | undefined, where: BrandWhere, override?: string | null): boolean {
  const url = brandImage(place, where, override)
  return !!url && url === urlOf(place?.icon)
}

/** a logó mérete (a levelekben és a foglalóoldal fejlécében) — üres / ismeretlen = közepes */
export function brandLogoSize(place: BrandPlace | null | undefined): BrandLogoSize {
  const v = place?.brand_logo_size
  return v === 'sm' || v === 'lg' ? v : 'md'
}

/** ugyanez abszolút URL-lel (levelekhez) — `base`: az app címe */
export function brandImageAbs(place: BrandPlace | null | undefined, where: BrandWhere, base: string, override?: string | null): string | null {
  const u = brandImage(place, where, override)
  return u ? (u.startsWith('http') ? u : `${base}${u}`) : null
}

/** ahol a logó és az ikon feltölthető: a Foglalóoldal-szerkesztő Arculat része (a `part=brand` rögtön azt nyitja meg) */
export const brandUploadHref = (restaurant: boolean) => `${restaurant ? '/restaurant' : '/dashboard'}/settings?tab=site&part=brand`
