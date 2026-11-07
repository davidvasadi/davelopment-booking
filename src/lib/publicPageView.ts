import type { Media, Restaurant, Salon } from '@/payload/payload-types'

/**
 * A foglalóoldal megjelenési beállításai (design 21.x; a szerkesztő 21.6 írja) és a galéria — a szalon és az étterem
 * dokumentumából, EGY helyen, hogy a két oldal (`[slug]/page.tsx`, `RestaurantPublicView`) ugyanazt kapja. A hiányzó
 * értékek az alapértékek: az oldal így ugyanúgy néz ki, mint a mezők előtt.
 */
export type PublicPageStyle = {
  /** az üzlet márkaszíne (hex) — null: a davelopment sárgája */
  accent: string | null
  card: 'dark' | 'black' | 'glass' | 'white'
  cardText: 'auto' | 'light' | 'dark'
  buttonText: 'auto' | 'light' | 'dark'
  dim: 'none' | 'soft' | 'strong'
  showRating: boolean
  ratingOpens: boolean
  showSocial: boolean
  /** a foglalás gomb saját felirata (az oldal nyelvén) — null: az alap */
  ctaLabel: string | null
  ctaNextFree: boolean
  ctaDeposit: boolean
  servicesFilter: boolean
  servicesImages: boolean
  servicesPrice: boolean
  servicesOrder: 'manual' | 'popular'
  /** a gomb saját betűszíne (hex) — null: a `buttonText` szerint; csak olvasható szín érvényes (lásd `accentForeground`) */
  buttonTextColor: string | null
  /** a leírás színe: 'white' | 'soft' | 'accent' | hex — null: az alap (halvány fehér) */
  descColor: string | null
  /** az üzlet nevének és címének színe — mint a leírásé; null: az alap (fehér / halvány) */
  nameColor: string | null
  addressColor: string | null
  descSize: 'sm' | 'md' | 'lg'
  /** mobilon a teljes leírás (alapból 2 sor) */
  descFullMobile: boolean
  /** a köszönő cím a foglalás után (az oldal nyelvén) — null: az alap */
  successTitle: string | null
  successTitleColor: string | null
  /** a foglalás lépéseinek saját szövegei (az oldal nyelvén): szöveg-kulcs → saját szöveg */
  texts: Record<string, string>
  /** a főoldal elemeinek sorrendje (a foglalás gomb mindig alul) */
  heroOrder: HeroKey[]
  /** a borító alap színe, ha nincs kép (hex) — a szöveget a sötétítés / a név árnyéka tartja olvashatóan; null: a sötét alap */
  coverColor: string | null
  /** az üzlet nevének stílusa a foglalóoldalon (a név maga jelölés nélkül) */
  nameBold: boolean
  nameItalic: boolean
  /** a foglaló űrlap mezőinek saját helykitöltője (az oldal nyelvén) — null: az alap */
  placeholders: FieldPlaceholders
}
export type FieldPlaceholders = { name: string | null; email: string | null; address: string | null; city: string | null; notes: string | null }
export const PLACEHOLDER_KEYS = ['name', 'email', 'address', 'city', 'notes'] as const
/** a főoldal áthelyezhető elemei, alap sorrendben */
export const HERO_KEYS = ['gallery', 'name', 'address', 'rating', 'social', 'desc', 'gtk'] as const
export type HeroKey = (typeof HERO_KEYS)[number]
/** a tárolt sorrend (vesszős lista) → teljes lista: az ismeretlenek kimaradnak, a hiányzók az alap helyükre a végére */
export const heroOrderOf = (v: string | null | undefined): HeroKey[] => {
  const got = (v ?? '').split(',').map((x) => x.trim()).filter((x): x is HeroKey => (HERO_KEYS as readonly string[]).includes(x))
  const uniq = [...new Set(got)]
  return [...uniq, ...HERO_KEYS.filter((k) => !uniq.includes(k))]
}
export type GalleryItem = { url: string; caption: string }

export const DEFAULT_PAGE_STYLE: PublicPageStyle = {
  accent: null, card: 'dark', cardText: 'auto', buttonText: 'auto', dim: 'soft', showRating: true, ratingOpens: true, showSocial: true,
  ctaLabel: null, ctaNextFree: true, ctaDeposit: false, servicesFilter: true, servicesImages: true, servicesPrice: true, servicesOrder: 'manual',
  buttonTextColor: null, descColor: null, nameColor: null, addressColor: null, descSize: 'md', descFullMobile: false, successTitle: null, successTitleColor: null,
  placeholders: { name: null, email: null, address: null, city: null, notes: null },
  heroOrder: [...HERO_KEYS],
  texts: {},
  coverColor: null,
  nameBold: false,
  nameItalic: false,
}

const HEX = /^#[0-9a-f]{6}$/i

export function pageStyleOf(doc: Pick<Salon | Restaurant, 'public_page'>): PublicPageStyle {
  const p = doc.public_page ?? {}
  return {
    accent: p.accent_color && HEX.test(p.accent_color.trim()) ? p.accent_color.trim() : null,
    card: p.card_style ?? 'dark',
    cardText: p.card_text ?? 'auto',
    buttonText: p.button_text ?? 'auto',
    dim: p.cover_dim ?? 'soft',
    showRating: p.show_rating !== false,
    ratingOpens: p.rating_opens !== false,
    showSocial: p.show_social !== false,
    ctaLabel: p.cta_label?.trim() || null,
    ctaNextFree: p.cta_next_free !== false,
    ctaDeposit: !!p.cta_deposit_badge,
    servicesFilter: p.services_filter !== false,
    servicesImages: p.services_images !== false,
    servicesPrice: p.services_price !== false,
    servicesOrder: p.services_order ?? 'manual',
    buttonTextColor: p.button_text_color && HEX.test(p.button_text_color.trim()) ? p.button_text_color.trim() : null,
    descColor: toneOf(p.desc_color),
    nameColor: toneOf(p.name_color),
    addressColor: toneOf(p.address_color),
    descSize: p.desc_size === 'sm' || p.desc_size === 'lg' ? p.desc_size : 'md',
    descFullMobile: !!p.desc_full_mobile,
    successTitle: p.success_title?.trim() || null,
    successTitleColor: toneOf(p.success_title_color),
    heroOrder: heroOrderOf(p.hero_order),
    nameBold: (p.name_style ?? '').split(',').includes('bold'),
    nameItalic: (p.name_style ?? '').split(',').includes('italic'),
    coverColor: p.cover_color && HEX.test(p.cover_color.trim()) ? p.cover_color.trim() : null,
    texts: textsOf(p.texts),
    placeholders: { name: p.ph_name?.trim() || null, email: p.ph_email?.trim() || null, address: p.ph_address?.trim() || null, city: p.ph_city?.trim() || null, notes: p.ph_notes?.trim() || null },
  }
}

/** A saját szövegek (JSON) — hibás / nem szöveg érték kimarad. */
export const textsOf = (v: string | null | undefined): Record<string, string> => {
  try {
    const o = v ? JSON.parse(v) : null
    return o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([, x]) => typeof x === 'string' && x.trim()).map(([k, x]) => [k, (x as string).slice(0, 300)])) : {}
  } catch { return {} }
}

/** Szöveg-szín beállítás: kulcsszó vagy hex — minden más (üres, hibás) az alap. */
const toneOf = (v: string | null | undefined): string | null => {
  const x = v?.trim()
  return x && (x === 'white' || x === 'soft' || x === 'accent' || HEX.test(x)) ? x : null
}

/** Relatív fényesség (WCAG). */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Két szín kontrasztja (1–21). */
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
/** Olvasható-e a szöveg ezen a háttéren — nagy betűnél / gombon a WCAG 3:1 a határ. */
export const readable = (text: string, bg: string) => HEX.test(text) && HEX.test(bg) && contrast(text, bg) >= 3

/** A fotón és a sötét kártyán a háttér (a sötétítés után) ennyi — ehhez mérjük a szöveg színét. */
export const DARK_BG = '#383838'
/** Egy szöveg-szín beállítás CSS-színe a háttéren (`bg`): fehér, halvány, márkaszín vagy saját — ha nem lenne olvasható,
 *  null (marad az alap). A rendszer így nem enged olvashatatlan szöveget. */
export function toneColor(tone: string | null, accent: string | null, bg: string = DARK_BG): string | null {
  if (!tone) return null
  const light = luminance(bg) < 0.5
  if (tone === 'white') return light ? '#FFFFFF' : '#383838'
  if (tone === 'soft') return light ? 'rgba(255,255,255,.7)' : '#828282'
  const hex = tone === 'accent' ? accent ?? '#FFD85F' : tone
  return readable(hex, bg) ? hex : null
}

export function galleryOf(doc: Pick<Salon | Restaurant, 'gallery'>): GalleryItem[] {
  return (doc.gallery ?? []).flatMap((g) => {
    const m = g.image && typeof g.image === 'object' ? (g.image as Media) : null
    return m?.url ? [{ url: m.url, caption: g.caption?.trim() || m.alt || '' }] : []
  })
}

/** A márkaszín betűszíne: világos színen sötét, sötéten fehér (relatív fényesség szerint) — a `button_text` felülírja. */
export function accentForeground(accent: string | null, pref: PublicPageStyle['buttonText'], custom: string | null = null): string {
  // saját gomb-betűszín: csak ha olvasható a márkaszínen
  if (custom && readable(custom, accent ?? '#FFD85F')) return custom
  if (pref === 'light') return '#FFFFFF'
  if (pref === 'dark') return '#383838'
  const hex = accent ?? '#FFD85F'
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#383838' : '#FFFFFF'
}

/**
 * A foglalóoldal saját szövegei (a lépések szövegei, a helykitöltők, a köszönő cím) egy nem magyar oldalon: CSAK az
 * adott nyelven mentett változat — ami ott nincs lefordítva, ott az adott nyelv alapszövege látszik, nem a magyar
 * saját szöveg (a dokumentumot a hívó magyar visszaeséssel olvassa, ezért ezeket külön, visszaesés nélkül olvassuk).
 * A magyar oldalon nincs mit tenni (`null`).
 */
export async function ownLocaleTexts(
  payload: { findByID: (a: Record<string, unknown>) => Promise<unknown> },
  collection: 'salons' | 'restaurants', id: number | string, locale: string,
): Promise<Pick<PublicPageStyle, 'texts' | 'placeholders' | 'successTitle'> | null> {
  if (locale === 'hu') return null
  try {
    const doc = (await payload.findByID({ collection, id, locale, fallbackLocale: false, depth: 0, overrideAccess: true, select: { public_page: true } })) as Pick<Salon, 'public_page'>
    const own = pageStyleOf(doc)
    return { texts: own.texts, placeholders: own.placeholders, successTitle: own.successTitle }
  } catch {
    return null
  }
}

/** Egy szín igazítása, hogy olvasható legyen a háttéren: lépésenként a fekete vagy a fehér felé keverjük (amelyik felé
 *  javul a kontraszt), amíg el nem éri a `min` arányt. Így bármilyen saját szín választható — a rendszer annyit
 *  sötétít / világosít rajta, amennyi kell (hibaüzenet helyett). */
export function makeReadable(hex: string, against: string, min = 3): string {
  if (!HEX.test(hex) || !HEX.test(against)) return hex
  if (contrast(hex, against) >= min) return hex.toUpperCase()
  const toward = luminance(against) > 0.5 ? 0 : 255
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  for (let t = 0.05; t <= 1; t += 0.05) {
    const mix = [r, g, b].map((c) => Math.round(c + (toward - c) * t))
    const out = '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()
    if (contrast(out, against) >= min) return out
  }
  return toward ? '#FFFFFF' : '#000000'
}
