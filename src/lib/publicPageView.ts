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
}
export type GalleryItem = { url: string; caption: string }

export const DEFAULT_PAGE_STYLE: PublicPageStyle = {
  accent: null, card: 'dark', cardText: 'auto', buttonText: 'auto', dim: 'soft', showRating: true, ratingOpens: true, showSocial: true,
  ctaLabel: null, ctaNextFree: true, ctaDeposit: false, servicesFilter: true, servicesImages: true, servicesPrice: true, servicesOrder: 'manual',
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
  }
}

export function galleryOf(doc: Pick<Salon | Restaurant, 'gallery'>): GalleryItem[] {
  return (doc.gallery ?? []).flatMap((g) => {
    const m = g.image && typeof g.image === 'object' ? (g.image as Media) : null
    return m?.url ? [{ url: m.url, caption: g.caption?.trim() || m.alt || '' }] : []
  })
}

/** A márkaszín betűszíne: világos színen sötét, sötéten fehér (relatív fényesség szerint) — a `button_text` felülírja. */
export function accentForeground(accent: string | null, pref: PublicPageStyle['buttonText']): string {
  if (pref === 'light') return '#FFFFFF'
  if (pref === 'dark') return '#383838'
  const hex = accent ?? '#FFD85F'
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#383838' : '#FFFFFF'
}
