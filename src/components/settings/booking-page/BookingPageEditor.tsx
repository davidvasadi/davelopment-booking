'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { useRouter } from 'next/navigation'
import { animate, AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { SHEET_MOBILE, SHEET_SPRING } from '@/lib/motion'
import { toast } from 'sonner'
import { ArrowLeft, ArrowUpRight, Briefcase, Check, ChevronLeft, ChevronRight, GripVertical, Image as ImageIcon, Images, Link2, List, Loader2, MousePointerClick, Palette, PanelTop, Plus, QrCode, Share2, Star, Trash2, Type, Upload, X, type LucideIcon } from 'lucide-react'
import { SocialLinksEditor } from '@/components/settings/SocialLinksEditor'
import { GoodToKnowEditor, type GoodToKnowItem } from '@/components/settings/GoodToKnowEditor'
import { BusinessQrLauncher } from '@/components/settings/BusinessQrLauncher'
import { compressImage } from '@/lib/compressImage'
import { LOCALE_LABELS, LOCALES, resolveAvailableLocales, t, type Locale } from '@/lib/i18n'
import { isEditorMessage, postToPreview, type BarTool, type PreviewToEditor } from '@/lib/editorBridge'
import { reminderOffsets } from '@/lib/reminders'
import { bookableDayCount, budapestToday, daysBetween, effectiveWindowEnd, huDate, periodEndFrom, type BookingWindowSource } from '@/lib/bookingWindow'
import { CustomQuestionsEditor, type CustomQuestion } from '@/components/settings/CustomQuestionsEditor'
import type { EditorView } from '@/components/booking/ProfileCard'
import { EventTypesEditor, type EventTypeItem } from '@/components/settings/EventTypesEditor'
import { cn } from '@/lib/utils'
import { Button, Card, FIELD, Field as KitField, IconButton, IconCircle, Input, ListRow, Modal, Note, Pill, Segmented, SheetHandle, SLIDE_SPRING, StatusPill, UploadBox, MarqueeText } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { UploadTile } from '@/components/blocks/upload'
import { Switch } from '@/components/ui/toggle-switch'
import { ColorPicker } from '@/components/blocks/color-picker'
import { EditorGroup, EditorOverview, EditorPublishBar, EditorRow, EditorStepBar, EditorStepSwitch, Swatches } from '@/components/blocks/editor'
import { DARK_BG, HERO_KEYS, makeReadable, PLACEHOLDER_KEYS, readable, textsOf, type FieldPlaceholders, type HeroKey, type PublicPageStyle } from '@/lib/publicPageView'
import { LOGO_HEIGHT } from '@/lib/brandImage'
import { BrandPicker } from '@/components/blocks/brand-picker'

/**
 * Beállítások → Foglalóoldal: Framer-szerű élő szerkesztő.
 *
 * A vásznon a VALÓDI foglalóoldal fut (`/{slug}?editor=1` iframe, ld. PublicPlaceView),
 * fix szélességen renderelve és a helyre kicsinyítve. Bármire kattintasz → kijelölődik →
 * minden szerkesztés a jobb oldali panelben történik. A még nem mentett állapot (draft)
 * `postMessage`-dzsel azonnal megjelenik az előnézetben; mentés a Beállítások közös
 * „Mentetlen változások” sávjából (`registerApi` / `onDirtyChange`).
 */

export type EditorStaff = {
  id: string
  name: string
  role_title: string
  /** a pozíció látszik-e a foglalásnál (a név alatt) */
  show_role_title: boolean
  bio: string
  social_links: string[]
}

export type BookingPageEditorInitial = {
  /** Szalon vagy étterem — ugyanaz a szerkesztő, csak a mentés-végpont, néhány elem és a
   *  foglalási szabályok térnek el (étteremnél: létszám, alkalmak, foglalás hossza, lépték). */
  variant: 'salon' | 'restaurant'
  /** a heti nyitvatartás rövid sorai (a QR-os nyomtatott laphoz; `lib/hoursRows`) */
  hours?: [string, string][]
  slug: string
  supportedLocales: Locale[]
  name: string
  address: string
  city: string
  postalCode: string
  phone: string
  email: string
  website: string
  description: string
  socialLinks: string[]
  coverId: number | null
  coverUrl: string | null
  coverFocalX: number
  coverFocalY: number
  coverZoom: number
  logoId: number | null
  logoUrl: string | null
  /** az ikon (kicsi helyekre) és hol mi jelenjen meg (design 24.x, lib/brandImage) */
  iconId: number | null
  iconUrl: string | null
  brandLogoSize: 'sm' | 'md' | 'lg'
  brandPage: 'logo' | 'icon'
  brandEmail: 'logo' | 'icon'
  brandQr: 'logo' | 'icon' | 'none'
  goodToKnow: GoodToKnowItem[]
  coverFocalMobileX: number | null
  coverFocalMobileY: number | null
  showServiceCount: boolean
  showStaffCount: boolean
  servicesExpandedOnMain: boolean
  /** A főnézet szakaszainak sorrendje és rejtett szakaszai (services | voucher | staff | reviews). */
  sectionOrder: string[]
  hiddenSections: string[]
  /** Az Adatok lépés mező-blokkjainak sorrendje (name | email | phone | address | questions | notes). */
  fieldOrder: string[]
  /** Üzlet-szintű minimum foglalási idő (óra); null = nincs korlát. */
  minLeadHours: number | null
  /** A teljes `booking_rules` csoport — a Payload PATCH az egész csoportot cseréli, ezért
   *  mentéskor ebbe fésüljük bele a módosított mezőket. */
  bookingRules: Record<string, unknown>
  /** Ugyanígy a teljes `notification_prefs` / `feature_modules` / `consent_settings` csoport. */
  notificationPrefs: Record<string, unknown>
  featureModules: Record<string, unknown>
  staff: EditorStaff[]
  // ── Foglalási folyamat ──
  bookingWindowDays: number
  /** Időszakos megnyitás: N napos időszakok `windowEnd` napig, lejáratkor (opcionálisan) megújul. */
  windowPeriodic: boolean
  windowEnd: string | null
  windowAutoRenew: boolean
  bufferMinutes: number
  requirePhone: boolean
  autoConfirm: boolean
  requireAddress: boolean
  requireAddressNote: string
  /** Teljesen elrejtett Adatok-mezők (nem csak opcionális — EGYÁLTALÁN nem jelenik meg). A
   *  cím-mezőt a saját, finomabb `addressDetailLevel` vezérli, nem ez a lista. */
  hiddenFields: ('phone' | 'notes')[]
  /** Cím-mező részletessége — `off` (nem jelenik meg), `city` (csak város), `full` (város +
   *  pontos cím). Előleg aktív esetén ettől függetlenül mindig `full` érvényesül (ld. `flags.deposit`). */
  addressDetailLevel: 'off' | 'city' | 'full'
  /** A marketing-elfogadó checkbox megjelenjen-e a foglaló űrlapon — a hírlevél-küldés
   *  képessége (ami minden csomagba beépítve jár) ettől FÜGGETLEN, csak az űrlap-mezőt dönti el. */
  showMarketingConsent: boolean
  confirmEmail: boolean
  reminders: { on: boolean; h48: boolean; h24: boolean; h3: boolean; h1: boolean; custom: number | null; chEmail: boolean; chPush: boolean }
  consentEnabled: boolean
  consentTitle: string
  consentText: string
  /** Az Előleg/Ajándékutalvány LÉPÉS be/ki kapcsolója (a `deposit_settings.enabled` /
   *  `voucher_settings.enabled` élő tükre) — a tényleges összeg/visszatérítés/stb. beállítás
   *  továbbra is a Fizetés fülé, de a lépés fel-/lekapcsolása innen is elérhető. */
  depositEnabled: boolean
  voucherEnabled: boolean
  customQuestions: CustomQuestion[]
  /** Csak olvasható állapotok — a részletes beállítás gazdája a Fizetés fül. */
  flags: {
    deposit: boolean; depositLabel: string; voucher: boolean; newsletter: boolean
    /** A nyers `enabled` érték (Stripe-onboarding nélkül) — a kapcsoló ebből indul. */
    depositEnabledRaw: boolean; voucherEnabledRaw: boolean
    /** Kapcsolható-e egyáltalán az előleg/utalvány (Stripe Connect KYC kész). */
    stripeOnboarded: boolean
    /** Előleg bekapcsolásához legalább egy kitöltött foglalási-feltétel szakasz kell. */
    termsFilled: boolean
  }
  /** A teljes `deposit_settings`/`voucher_settings` csoport — mentéskor ebbe fésüljük bele az
   *  `enabled`-kapcsoló változását, hogy a többi (összeg/visszatérítés/stb.) mező ne vesszen el. */
  depositSettingsBase: Record<string, unknown>
  voucherSettingsBase: Record<string, unknown>
  // ── Csak étterem ──
  /** `turn_duration_minutes` — egy foglalás mennyi ideig tartja az asztalt. */
  turnMinutes: number
  /** `slot_step_minutes` — milyen sűrűn kínálunk időpontot. */
  slotStepMinutes: number
  /** `last_seating_buffer_minutes` — mennyivel zárás előtt van az utolsó kezdő időpont. */
  lastSeatingMinutes: number
  /** `event_types` — a vendég által választható alkalmak. */
  eventTypes: EventTypeItem[]
  /** A legnagyobb foglalható létszám (az asztalokból számolva, csak megjelenítéshez). */
  maxPax: number
  // ── A foglalóoldal megjelenése (design 21.6) ──
  /** arculat, borító-sötétítés, borító-elemek, foglalás gomb, szolgáltatás-megjelenítés */
  page: PublicPageStyle
  /** a galéria (legfeljebb 12 kép, az első 3 a borítón); `caption` a magyar felirat */
  gallery: EditorGalleryItem[]
  /** szalon: melyik szolgáltatás látszik a foglalóoldalon */
  services: { id: string; name: string; visible: boolean }[]
}

export type EditorGalleryItem = { key: string; imageId: number; url: string | null; caption: string }

type Draft = Omit<BookingPageEditorInitial, 'variant' | 'maxPax' | 'bookingRules' | 'notificationPrefs' | 'featureModules' | 'flags' | 'depositSettingsBase' | 'voucherSettingsBase'>
/** Nyelvenként fordítható mezők (a magyar a `Draft`-ban él). */
type LocDraft = {
  description: string
  /** a foglalás gomb felirata és a galéria-feliratok (index szerint) ezen a nyelven */
  ctaLabel: string
  /** a köszönő cím ezen a nyelven */
  successTitle: string
  /** a foglaló mezők helykitöltője ezen a nyelven (üres: a magyar / az alap) */
  placeholders: Record<keyof FieldPlaceholders, string>
  /** a foglalás lépéseinek saját szövegei ezen a nyelven */
  texts: Record<string, string>
  captions: string[]
  goodToKnow: GoodToKnowItem[]
  staffBio: Record<string, string>
  consentTitle: string
  consentText: string
  customQuestions: CustomQuestion[]
  /** Étterem: az alkalmak megnevezése ezen a nyelven (index szerint a magyar listához). */
  eventTypeLabels: string[]
}

const STEPS: { id: EditorView; label: string }[] = [
  { id: 'main', label: 'Főoldal' }, { id: 'datetime', label: 'Időpont' }, { id: 'details', label: 'Adatok' },
  { id: 'deposit', label: 'Előleg' }, { id: 'consent', label: 'Nyilatkozat' }, { id: 'summary', label: 'Összegzés' },
  { id: 'success', label: 'Visszaigazolás' }, { id: 'voucher', label: 'Utalvány' },
]


const REMINDER_CHIPS = [['h48', '2 nappal'], ['h24', '24 órával'], ['h3', '3 órával']] as const

type Device = 'desktop' | 'mobile'
const FRAME: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  // a design telefon-mérete (16.10 / 21.6.1): 360 × 780, két kijelző egymás mellett
  mobile: { w: 360, h: 780 },
}

// a panelek mezői: a kit mezője (design 21.6 — minden vezérlő 36 px); a többsoros mezők a szövegükhöz nőnek
const fieldCls = `${FIELD} min-h-9 py-2`

const ELEMENT_TITLES: Record<string, string> = {
  cover: 'Borítókép', logo: 'Logó', name: 'Üzlet neve', address: 'Cím', desc: 'Leírás', counts: 'Számláló sáv', link: 'Link & QR-kód',
  langs: 'Nyelvek', contact: 'Kapcsolat', 'sec:services': 'Szolgáltatások', 'sec:staff': 'Munkatársak',
  'sec:voucher': 'Ajándékutalvány', 'sec:reviews': 'Google-értékelések', gtk: 'Jó tudni', successTitle: 'Köszönő cím', city: 'Város', consentTitle: 'Nyilatkozat címe', consentText: 'Nyilatkozat szövege',
  rules: 'Foglalási szabályok', confirm: 'Visszaigazolás & emlékeztetők', 'field:name': 'Név mező', 'field:email': 'E-mail mező',
  'field:phone': 'Telefonszám mező', 'field:address': 'Cím mező', 'field:notes': 'Megjegyzés mező', questions: 'Egyedi kérdések',
  consent: 'Hozzájáruló nyilatkozat', deposit: 'Előleg', terms: 'Foglalási feltételek', newsletter: 'Hírlevél-feliratkozás',
  summary: 'Összegzés', redeem: 'Utalvány beváltása', 'sec:slots': 'Szabad időpontok & nyitvatartás', pax: 'Létszám', occasions: 'Alkalmak',
}

/** A szerkesztő 9 része (design 21.6): bal oldalt ikonként, kijelölve a beállításai jobbra nyílnak. `panels`: mely
 *  panel-blokkok tartoznak hozzá; `dom`: az előnézetben melyik elemet keretezzük; `note`: a tipp a panel alján. */
const PARTS: { id: string; icon: LucideIcon; title: string; panels: string[]; dom: string; note: string }[] = [
  { id: 'brand', icon: Palette, title: 'Arculat', panels: ['logo', 'brand'], dom: 'logo', note: 'A váz fix: elrendezés, betű, gombformák és a lábléc jele — így minden foglalóoldal rendezett marad.' },
  { id: 'cover', icon: ImageIcon, title: 'Borítókép', panels: ['cover'], dom: 'cover', note: 'Jó kép: az üzlet belső tere vagy egy munka, legalább 1920 px széles.' },
  { id: 'gallery', icon: Images, title: 'Galéria', panels: ['gallery'], dom: 'gallery', note: 'Az első 3 kerül a borítóra. Feltöltéskor 2000 px-re kicsinyítjük és WebP-re alakítjuk, így az oldal gyors marad.' },
  { id: 'header', icon: PanelTop, title: 'Fejléc', panels: ['counts', 'langs'], dom: 'counts', note: 'Bal felül a te logód (az Arculatban cserélhető); a davelopment booking jele csak a foglaló kártya alján van.' },
  { id: 'intro', icon: Type, title: 'Bemutatkozás', panels: ['name', 'address', 'desc', 'gtk'], dom: 'name', note: 'Ugyanez kerül a Google-találat leírásába is — érdemes benne a városrész és a fő szolgáltatások.' },
  { id: 'reviews', icon: Star, title: 'Értékelések', panels: ['reviewsPart', 'sec:reviews'], dom: 'rating', note: 'A pontszám élőben jön (a Google naponta frissül) — kézzel nem írható át.' },
  { id: 'social', icon: Share2, title: 'Közösségi', panels: ['socialPart', 'contact'], dom: 'social', note: 'A platformot a linkből ismeri fel — ugyanezek kerülnek a Google strukturált adatába is (sameAs).' },
  { id: 'cta', icon: MousePointerClick, title: 'Foglalás gomb', panels: ['cta'], dom: 'cta', note: 'A gomb a márkaszínt veszi fel; mobilon alul tapad, és felcsúszó lapon nyitja a foglalót.' },
  { id: 'services', icon: Briefcase, title: 'Szolgáltatások', panels: ['servicesPart', 'sec:services'], dom: 'sec:services', note: 'A képek, árak és időtartamok a Szolgáltatások oldalon szerkeszthetők — itt csak a megjelenés.' },
]
/** az előnézetben kattintott elem → melyik rész nyíljon */
const PICK_TO_PART: Record<string, string> = Object.fromEntries(PARTS.flatMap((p) => [[p.dom, p.id], ...p.panels.map((x) => [x, p.id])]).concat([['rating', 'reviews'], ['social', 'social'], ['city', 'intro']]))
/** az előnézetben kattintott elem → a hozzá tartozó beállítás (rész / elem); a munkatárs bemutatkozása a munkatársé */
const partOf = (id: string) => PICK_TO_PART[id] ?? (id.startsWith('staffbio:') ? `staff:${id.slice(9)}` : id === 'consentTitle' || id === 'consentText' ? 'consent' : id)
/** a foglaló űrlap mezői (a gyors-sáv: kötelező, elrejt, sorrend) — az előnézet azonosítójából a sorrend-kulcs */
const fieldKeyOf = (dom: string) => (dom.startsWith('field:') ? dom.slice(6) : ['questions', 'newsletter', 'occasions'].includes(dom) ? dom : null)
/** a gomb betűszíne: ugyanaz a 4 kör-minta, mint a márkaszínnél (fehér, sötét, sárga, zöld) — csak az olvashatók */
const BUTTON_TEXT_COLORS = ['#FFFFFF', '#383838', '#FFD85F', '#2F5D50'] // ui-allow: a választható betűszínek maguk a minták
/** a szöveg színe a fotón / a kártyán: fehér, halvány (szürke), krém, arany — mind jól olvasható a sötét fotón;
 *  az érték kulcsszó (white / soft) vagy hex. A minták megjelenése: ahogy a sötét háttéren látszanak. */
const TEXT_TONES = ['white', 'soft', 'accent'] as const
const TONE_PALETTE: { v: string; css: string; label: string }[] = [
  { v: 'white', css: '#FFFFFF', label: 'Fehér' }, // ui-allow: a választható szövegszínek maguk a minták
  { v: 'soft', css: '#C3C3C3', label: 'Szürke' }, // ui-allow: a halvány fehér, ahogy a sötét fotón látszik
  { v: '#F1E6CF', css: '#F1E6CF', label: 'Krém' }, // ui-allow
  { v: '#E9C46A', css: '#E9C46A', label: 'Arany' }, // ui-allow
]
/** a márkaszín-minták és a kártya-stílusok (design 21.6 Arculat) */
const ACCENTS = ['#FFD85F', '#2F5D50', '#7A2E3A', '#1F3A5F'] // ui-allow: a márkaszín-minták maguk a választható színek
const CARD_STYLES: { id: PublicPageStyle['card']; fill: string }[] = [{ id: 'dark', fill: 'bg-ui-dark/60' }, { id: 'black', fill: 'bg-ui-dark' }, { id: 'white', fill: 'bg-white' }, { id: 'glass', fill: 'bg-ui-cell/70' }]

/** a foglalóoldal megjelenése → a `public_page` csoport (a PATCH az egész csoportot cseréli, ezért mindig a teljeset küldjük) */
/** a nem i18n-kulcsos (kézzel írt) szövegek alapja — a panel helykitöltőjéhez */
const CUSTOM_TEXT_DEFAULTS: Record<string, string> = {
  'custom.marketing': 'Szeretnék marketing-ajánlatokat, híreket kapni erről az üzletről', 'custom.voucherLink': 'Van ajándékutalványod?',
  'custom.consentAccept': 'Elolvastam és elfogadom a fenti nyilatkozatot', 'custom.unsubscribe': 'Bármikor leiratkozhatok. Részletek:',
  'custom.privacyLink': 'Adatvédelmi tájékoztató', 'custom.voucherValid': 'Érvényes utalvány — jóváírva a foglaláskor.',
}
/** a saját szövegek tárolt alakja: csak a nem üresek, JSON-ként (üresen null) */
const textsJson = (t: Record<string, string>) => { const o = Object.fromEntries(Object.entries(t).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])); return Object.keys(o).length ? JSON.stringify(o) : null }
const publicPageBody = (p: PublicPageStyle, ctaLabel: string | null, successTitle: string | null = p.successTitle, ph: Partial<Record<keyof FieldPlaceholders, string | null>> = p.placeholders, texts: Record<string, string> = p.texts) => ({
  accent_color: p.accent, card_style: p.card, card_text: p.cardText, button_text: p.buttonText, cover_dim: p.dim,
  show_rating: p.showRating, rating_opens: p.ratingOpens, show_social: p.showSocial, cta_label: ctaLabel?.trim() || null,
  cta_next_free: p.ctaNextFree, cta_deposit_badge: p.ctaDeposit, services_filter: p.servicesFilter, services_images: p.servicesImages,
  services_price: p.servicesPrice, services_order: p.servicesOrder,
  button_text_color: p.buttonTextColor, desc_color: p.descColor, name_color: p.nameColor, address_color: p.addressColor, hero_order: p.heroOrder.join(','), cover_color: p.coverColor, name_style: [p.nameBold && 'bold', p.nameItalic && 'italic'].filter(Boolean).join(',') || null, desc_size: p.descSize, desc_full_mobile: p.descFullMobile,
  success_title: successTitle?.trim() || null, success_title_color: p.successTitleColor,
  ph_name: ph.name?.trim() || null, ph_email: ph.email?.trim() || null, ph_address: ph.address?.trim() || null, ph_city: ph.city?.trim() || null, ph_notes: ph.notes?.trim() || null, texts: textsJson(texts),
})

const draftFrom = (i: BookingPageEditorInitial): Draft => {
  const { variant: _v, maxPax: _mp, bookingRules: _br, notificationPrefs: _np, featureModules: _fm, flags: _fl, depositSettingsBase: _dsb, voucherSettingsBase: _vsb, ...rest } = i
  return rest
}

/** A draft emlékeztető-beállításai → az időzítések órában (ugyanaz a logika, mint a cronban). */
const reminderHoursOf = (r: Draft['reminders']) => (r.on
  ? reminderOffsets({ reminder_t_48h: r.h48, reminder_t_24h: r.h24, reminder_t_3h: r.h3, reminder_t_1h: r.h1, reminder_custom_hours: r.custom } as never)
  : [])

export function BookingPageEditor({
  initial,
  onDirtyChange,
  registerApi,
  onNavigate,
  onExit,
}: {
  initial: BookingPageEditorInitial
  onDirtyChange?: (dirty: boolean) => void
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
  /** Másik Beállítások-fülre ugrás (pl. Ajándékutalvány → Fizetés). */
  onNavigate?: (tab: string) => void
  /** kilépés a teljes képernyős szerkesztőből (vissza a Beállításokhoz) */
  onExit?: () => void
}) {
  const router = useRouter()
  const isRestaurant = initial.variant === 'restaurant'
  const apiBase = isRestaurant ? '/api/restaurant/settings' : '/api/salon/settings'
  const adminBase = isRestaurant ? '/restaurant' : '/dashboard'
  const [baseline, setBaseline] = useState<Draft>(() => draftFrom(initial))
  const [draft, setDraft] = useState<Draft>(baseline)
  // az Adatok lépés húzható elemei: a hírlevél-pipa csak élő hírlevél-csomagnál, az alkalmak csak étteremnél
  const shownFields = draft.fieldOrder.filter((id) => (id !== 'newsletter' || initial.flags.newsletter) && (id !== 'occasions' || isRestaurant))
  const [locBaseline, setLocBaseline] = useState<Partial<Record<Locale, LocDraft>>>({})
  const [locDrafts, setLocDrafts] = useState<Partial<Record<Locale, LocDraft>>>({})
  const [lang, setLang] = useState<Locale>('hu')
  const [langLoading, setLangLoading] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  const [stepsOpen, setStepsOpen] = useState(false)
  // Telefonon (lg alatt) nincs eszközváltó: mindig a mobil előnézet, és a kijelölt elem
  // panelje alulról felcsúszó lapként jelenik meg (a tartalom közös, a desktopra is hat).
  const [narrow, setNarrow] = useState(false)
  // a portál csak a böngészőben (a <body> kell hozzá) — a layout effectben, az első kirajzolás előtt
  const [portalReady, setPortalReady] = useState(false)
  useLayoutEffect(() => { setPortalReady(true) }, [])
  // belépő animáció — a portál miatt a Beállítások panel-váltó animációja már nem éri el, ezért ugyanazt itt kapja:
  // desktopon oldalról becsúszik és előtűnik (SLIDE_SPRING), mobilon felúszik (a lapok rugója, SHEET_SPRING)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!portalReady || !el) return
    // a végén a transform törlése: a gyökérben lévő `fixed` elemek (közzétételi sáv, lapok) különben a gyökérhez kötődnének
    const done = () => { el.style.transform = '' }
    if (window.matchMedia('(min-width: 1024px)').matches) void animate(el, { x: [56, 0] }, SLIDE_SPRING).then(done)
    else void animate(el, { y: [40, 0] }, SHEET_SPRING).then(done)
    animate(el, { opacity: [0, 1] }, { duration: 0.2, ease: 'easeOut' })
  }, [portalReady])
  // az első kirajzolás ELŐTT (layout effect): különben telefonon egy pillanatra a desktop elrendezés villanna fel
  useLayoutEffect(() => {
    // Ugyanaz a töréspont, mint a vászon+panel `xl:flex-row` egymás-mellé-kerülése (lásd
    // lentebb) — amíg a kettő egymás ALATT van (oszlopban), addig "keskeny" (mobil-szerű,
    // teljes szélességű, keret/sticky nélküli) nézetet kapsz, utána a tényleges desktop-
    // szimulációt. Enélkül egy közbülső (tablet-szélességű) sávban a kettő logika
    // összecsúszna (sticky kép egy még oszlopos elrendezésben).
    const mq = window.matchMedia('(max-width: 1279px)')
    const update = () => { setNarrow(mq.matches); if (mq.matches) setDevice('mobile') }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const [sel, setSel] = useState<string | null>(null)
  // az előnézetben pontosan erre az elemre kattintottak (pl. `desc`) — a keret és a gyors-sáv ezen van, nem a rész fő elemén
  const [picked, setPicked] = useState<string | null>(null)
  /** kijelölés a szerkesztőből (sáv, lista, áttekintő) — nem az előnézetben kattintott elem, így mobilon a lap nyílik */
  // mobil: a beállító lap — a gyors-sáv fogaskerekére, vagy ha a listából / a sávból választanak
  const [sheetOpen, setSheetOpen] = useState(false)
  const selectPart = (id: string | null) => { setPicked(null); setSel(id); setSheetOpen(true) }
  // link máshonnan (pl. „Ikon · nincs → feltöltés”): `?part=brand` — rögtön az Arculat rész nyílik meg
  useEffect(() => { const p = new URLSearchParams(window.location.search).get('part'); if (p) { setSel(p); setSheetOpen(true) } }, [])
  // mobil: az „Elemek” gomb — az oldal elemei felcsúszó lapon
  const [elemsOpen, setElemsOpen] = useState(false)
  useEffect(() => { if (sel) setElemsOpen(false) }, [sel])
  const [step, setStep] = useState<EditorView>('main')
  const [ready, setReady] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  // telefon-nézetben a második kijelző: a felcsúszó foglaló, az adott lépéssel
  const frame2Ref = useRef<HTMLIFrameElement>(null)
  const [ready2, setReady2] = useState(false)

  const languages = useMemo(() => resolveAvailableLocales(draft.supportedLocales), [draft.supportedLocales])
  const loc = lang === 'hu' ? null : locDrafts[lang] ?? null

  // ── Mentetlen állapot ──
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || JSON.stringify(locDrafts) !== JSON.stringify(locBaseline)
  // Más fülön (Előleg, Ajándékutalvány, Dokumentumok) mentett beállítás a `router.refresh()` után
  // friss `initial`-t ad — a draft eddig csak MOUNT-kor olvasta be, ezért pl. a bekapcsolt Előleg
  // lépés csak oldal-újratöltés után jelent meg. Mentetlen szerkesztés nélkül teljesen újraalapozunk;
  // ha van szerkesztés, csak a máshol kezelt kapcsolókat szinkronizáljuk (a többi munkát nem írjuk felül).
  const initialKey = JSON.stringify(draftFrom(initial))
  const lastInitialKey = useRef(initialKey)
  useEffect(() => {
    if (lastInitialKey.current === initialKey) return
    lastInitialKey.current = initialKey
    const fresh = draftFrom(initial)
    if (!dirty) { setBaseline(fresh); setDraft(fresh); return }
    const ext = { depositEnabled: fresh.depositEnabled, voucherEnabled: fresh.voucherEnabled, consentEnabled: fresh.consentEnabled, consentTitle: fresh.consentTitle, consentText: fresh.consentText }
    setBaseline((b) => ({ ...b, ...ext }))
    setDraft((d) => ({ ...d, ...ext }))
  }, [initialKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

  // visszavonás / újra (a Közzététel-sávon): minden módosítás előtt eltesszük a vázlatot (legfeljebb 60 lépés)
  const [past, setPast] = useState<Draft[]>([])
  const [future, setFuture] = useState<Draft[]>([])
  const remember = () => { setPast((p) => [...p.slice(-59), draft]); setFuture([]) }
  const undo = () => { if (!past.length) return; setFuture((f) => [draft, ...f]); setDraft(past[past.length - 1]); setPast((p) => p.slice(0, -1)) }
  const redo = () => { if (!future.length) return; setPast((p) => [...p, draft]); setDraft(future[0]); setFuture((f) => f.slice(1)) }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { remember(); setDraft((d) => ({ ...d, [key]: value })) }
  const setPage = (patch: Partial<PublicPageStyle>) => { remember(); setDraft((d) => ({ ...d, page: { ...d.page, ...patch } })) }
  const setLoc = (patch: Partial<LocDraft>) => setLocDrafts((all) => ({ ...all, [lang]: { ...(all[lang] as LocDraft), ...patch } }))
  // helyben írt szöveg az előnézetből: név, leírás (a szerkesztett nyelven), munkatárs bemutatkozása
  const onTextRef = useRef<(id: string, value: string) => void>(() => {})
  onTextRef.current = (id, value) => {
    if (id === 'name') set('name', value)
    else if (id === 'address') {
      // a cím és a város egy szövegként írható („Hajós utca 25., Budapest VI.”) — az utolsó vessző után a város
      const v = value.replace(/\n/g, ' ')
      const at = v.lastIndexOf(',')
      remember()
      setDraft((d) => ({ ...d, address: (at < 0 ? v : v.slice(0, at)).trim(), city: at < 0 ? d.city : v.slice(at + 1).trim() }))
    }
    else if (id === 'cta') { const v = value.replace(/\n/g, ' ').slice(0, 24); if (loc) setLoc({ ctaLabel: v }); else setPage({ ctaLabel: v || null }) }
    else if (id === 'consentTitle') { const v = value.replace(/\n/g, ' '); if (loc) setLoc({ consentTitle: v }); else set('consentTitle', v) }
    else if (id === 'consentText') { if (loc) setLoc({ consentText: value }); else set('consentText', value) }
    else if (id.startsWith('txt:')) {
      // a foglalás egy szövege (cím, magyarázó sor, gomb) — a szerkesztett nyelven
      const k = id.slice(4)
      const v = value.replace(/\n/g, ' ').slice(0, 300)
      if (loc) setLoc({ texts: { ...loc.texts, [k]: v } }); else setPage({ texts: { ...draft.page.texts, [k]: v } })
    }
    else if (id.startsWith('ph:')) {
      // a foglaló mező helykitöltője (a kijelölt mezőbe írva) — a szerkesztett nyelven
      const k = id.slice(3) as keyof FieldPlaceholders
      if (!(PLACEHOLDER_KEYS as readonly string[]).includes(k)) return
      const v = value.replace(/\n/g, ' ').slice(0, k === 'notes' ? 120 : 60)
      if (loc) setLoc({ placeholders: { ...loc.placeholders, [k]: v } }); else setPage({ placeholders: { ...draft.page.placeholders, [k]: v || null } })
    }
    else if (id === 'successTitle') { const v = value.replace(/\n/g, ' ').slice(0, 60); if (loc) setLoc({ successTitle: v }); else setPage({ successTitle: v || null }) }
    else if (id === 'desc') { if (loc) setLoc({ description: value }); else set('description', value) }
    else if (id.startsWith('staffbio:')) { const sid = id.slice(9); if (loc) setLoc({ staffBio: { ...loc.staffBio, [sid]: value } }); else setStaff(sid, { bio: value }) }
  }
  // a gyors-sáv gombjai az előnézetből: szín, kötelező / elrejt / sorrend, beállítások (mobilon a lap), megnyitás
  const onActionRef = useRef<(id: string, action: string, value: string | null) => void>(() => {})
  onActionRef.current = (id, action, value) => {
    if (action === 'settings') { setSheetOpen(true); return }
    if (action === 'brand') { setDraft((d) => ({ ...d, brandPage: value === 'icon' ? 'icon' : 'logo' })); return }
    if (action === 'step') { const first = flow.find((f) => f.id !== 'main'); if (first) goStep(first.id); return }
    if (action === 'hours') { router.push(`${adminBase}/availability`); return }
    if (action === 'color') {
      // kulcsszó (fehér / halvány / márkaszín) vagy saját hex — a saját csak ha olvasható a háttéren
      const bg = id === 'successTitle' && draft.page.card === 'white' ? '#FFFFFF' : DARK_BG // ui-allow: a háttér, amihez mérünk
      // saját szín: ha nem lenne olvasható, a rendszer annyit igazít rajta, amennyi kell
      const v = !value ? null : (TEXT_TONES as readonly string[]).includes(value) ? value : makeReadable(value, bg)
      if (id === 'desc') setPage({ descColor: v === 'soft' ? null : v })
      else if (id === 'name') setPage({ nameColor: v === 'white' ? null : v })
      else if (id === 'address') setPage({ addressColor: v === 'soft' ? null : v })
      else if (id === 'successTitle') setPage({ successTitleColor: v === 'white' ? null : v })
      return
    }
    if (action === 'name-bold') { setPage({ nameBold: !draft.page.nameBold }); return }
    if (action === 'name-italic') { setPage({ nameItalic: !draft.page.nameItalic }); return }
    if (action === 'hero-up' || action === 'hero-down') {
      // csere a legközelebbi LÁTHATÓ szomszéddal (ami üres — pl. nincs galéria —, azt átugorjuk)
      const shown: Record<HeroKey, boolean> = {
        gallery: draft.gallery.some((g) => g.url), name: true, address: !!(draft.address || draft.city), rating: draft.page.showRating,
        social: draft.page.showSocial && draft.socialLinks.some((u) => u.trim()), desc: !!draft.description.trim(), gtk: true,
      }
      const order = [...draft.page.heroOrder]
      const i = order.indexOf(id as HeroKey)
      if (i < 0) return
      let j = i
      do { j += action === 'hero-up' ? -1 : 1 } while (j >= 0 && j < order.length && !shown[order[j]])
      if (j < 0 || j >= order.length) return
      ;[order[i], order[j]] = [order[j], order[i]]
      setPage({ heroOrder: order })
      return
    }
    const fk = fieldKeyOf(id)
    if (!fk) return
    if (action === 'required') { if (fk === 'phone') set('requirePhone', !draft.requirePhone); else if (fk === 'address') set('requireAddress', !draft.requireAddress) }
    else if (action === 'hide' && (fk === 'phone' || fk === 'notes')) set('hiddenFields', draft.hiddenFields.includes(fk) ? draft.hiddenFields.filter((f) => f !== fk) : [...draft.hiddenFields, fk])
    else if (action === 'up' || action === 'down') {
      // sorrend a látható mezők közt (mint a panel húzható listája)
      const vis = [...shownFields]; const i = vis.indexOf(fk); const j = i + (action === 'up' ? -1 : 1)
      if (i < 0 || j < 0 || j >= vis.length) return
      ;[vis[i], vis[j]] = [vis[j], vis[i]]
      set('fieldOrder', [...vis, ...draft.fieldOrder.filter((x) => !vis.includes(x))])
    }
  }
  const setStaff = (id: string, patch: Partial<EditorStaff>) =>
    setDraft((d) => ({ ...d, staff: d.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))

  // ── Nyelvváltás: a fordítható mezők lusta betöltése az adott nyelven (fallback nélkül) ──
  const selectLang = async (next: Locale) => {
    if (next === lang) return
    if (next === 'hu' || locDrafts[next]) { setLang(next); return }
    setLangLoading(true)
    try {
      const res = await fetch(`${apiBase}?locale=${next}&fallback-locale=null`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const doc = await res.json()
      const staffBio: Record<string, string> = {}
      await Promise.all(draft.staff.map(async (m) => {
        const r = await fetch(`/api/staff/${m.id}?locale=${next}`, { credentials: 'include' })
        const s = r.ok ? await r.json() : null
        staffBio[m.id] = typeof s?.bio === 'string' ? s.bio : ''
      }))
      const loaded: LocDraft = {
        description: typeof doc.description === 'string' ? doc.description : '',
        goodToKnow: (Array.isArray(doc.good_to_know) ? doc.good_to_know : []).map((g: Record<string, unknown>) => ({
          icon: (g.icon as string) ?? 'info', title: (g.title as string) ?? '', body: (g.body as string) ?? '',
        })),
        staffBio,
        consentTitle: typeof doc.consent_settings?.title === 'string' ? doc.consent_settings.title : '',
        consentText: typeof doc.consent_settings?.template_text === 'string' ? doc.consent_settings.template_text : '',
        customQuestions: (Array.isArray(doc.custom_questions) ? doc.custom_questions : []).map((q: Record<string, unknown>) => ({
          id: (q.id as string) ?? crypto.randomUUID(),
          label: (q.label as string) ?? '',
          type: (q.type as CustomQuestion['type']) ?? 'text',
          options: Array.isArray(q.options) ? (q.options as Record<string, unknown>[]).map((o) => ({ value: (o.value as string) ?? '' })) : [],
          required: !!q.required,
        })),
        ctaLabel: typeof doc.public_page?.cta_label === 'string' ? doc.public_page.cta_label : '',
        successTitle: typeof doc.public_page?.success_title === 'string' ? doc.public_page.success_title : '',
        placeholders: Object.fromEntries(PLACEHOLDER_KEYS.map((k) => { const v = doc.public_page?.[`ph_${k}`]; return [k, typeof v === 'string' ? v : ''] })) as LocDraft['placeholders'],
        texts: textsOf(typeof doc.public_page?.texts === 'string' ? doc.public_page.texts : null),
        captions: draft.gallery.map((g) => {
          const row = Array.isArray(doc.gallery) ? (doc.gallery as { id?: string; caption?: string | null }[]).find((x) => x.id === g.key) : null
          return typeof row?.caption === 'string' ? row.caption : ''
        }),
        eventTypeLabels: draft.eventTypes.map((_, i) => {
          const e = Array.isArray(doc.event_types) ? doc.event_types[i] : null
          return typeof e?.label === 'string' ? e.label : ''
        }),
      }
      setLocBaseline((b) => ({ ...b, [next]: loaded }))
      setLocDrafts((d) => ({ ...d, [next]: loaded }))
      setLang(next)
    } catch {
      toast.error('A nyelv betöltése nem sikerült')
    } finally {
      setLangLoading(false)
    }
  }

  // ── Előnézet: a draft → PlaceViewData-patch ──
  const previewPatch = useMemo(() => {
    const description = (loc?.description || draft.description).trim() || null
    const goodToKnow = loc && loc.goodToKnow.some((g) => g.title || g.body) ? loc.goodToKnow : draft.goodToKnow
    const staffEdits: Record<string, unknown> = {}
    for (const m of draft.staff) {
      staffEdits[m.id] = {
        name: m.name,
        role_title: m.role_title,
        show_role_title: m.show_role_title,
        bio: (loc?.staffBio[m.id] || m.bio) || null,
        social_links: m.social_links.filter((u) => u.trim()).map((url) => ({ url })),
      }
    }
    return {
      // a megjelenés (design 21.x) — az élő oldal ugyanezt kapja a szervertől
      page: { ...draft.page, ctaLabel: (loc?.ctaLabel || draft.page.ctaLabel || '').trim() || null, // a saját szövegek (köszönő cím, helykitöltők, a lépések szövegei) más nyelven CSAK az ott írt változat — ami nincs
        // lefordítva, ott az adott nyelv alapszövege látszik, nem a magyar (ugyanígy, mint élesben: ownLocaleTexts)
        successTitle: ((loc ? loc.successTitle : draft.page.successTitle) || '').trim() || null,
        placeholders: Object.fromEntries(PLACEHOLDER_KEYS.map((k) => [k, ((loc ? loc.placeholders[k] : draft.page.placeholders[k]) || '').trim() || null])) as FieldPlaceholders,
        texts: Object.fromEntries(Object.entries(loc ? loc.texts : draft.page.texts).filter(([, v]) => v.trim())) },
      gallery: draft.gallery.filter((g) => g.url).map((g, i) => ({ url: g.url as string, caption: (loc?.captions[i] || g.caption || '').trim() })),
      socialLinks: draft.socialLinks.filter((u) => u.trim()),
      goodToKnow,
      phone: draft.phone || null,
      name: draft.name,
      address: draft.address || null,
      city: draft.city || null,
      description,
      coverUrl: draft.coverUrl,
      coverFocalX: draft.coverFocalX,
      coverFocalY: draft.coverFocalY,
      coverZoom: draft.coverZoom,
      coverFocalMobileX: draft.coverFocalMobileX,
      coverFocalMobileY: draft.coverFocalMobileY,
      // a fejléc képe a választás szerint (logó / ikon), a logó méretével (design 24.2)
      logoUrl: draft.brandPage === 'icon' ? draft.iconUrl ?? draft.logoUrl : draft.logoUrl ?? draft.iconUrl,
      logoH: LOGO_HEIGHT[draft.brandLogoSize],
      showServiceCount: draft.showServiceCount,
      showStaffCount: draft.showStaffCount,
      card: {
        phone: draft.phone || null,
        email: draft.email || null,
        website: draft.website || null,
        socialLinks: draft.socialLinks.filter((u) => u.trim()),
        goodToKnow,
        servicesExpandedOnMain: draft.servicesExpandedOnMain,
        sectionOrder: draft.sectionOrder,
        hiddenSections: draft.hiddenSections,
        fieldOrder: draft.fieldOrder,
        bookingWindowDays: bookableDayCount({ booking_window_days: draft.bookingWindowDays, booking_window_periodic: draft.windowPeriodic, booking_window_end: draft.windowEnd, booking_window_auto_renew: draft.windowAutoRenew }),
        requirePhone: draft.requirePhone,
        addressRequired: draft.requireAddress,
        addressRequiredNote: draft.requireAddressNote || null,
        hiddenFields: draft.hiddenFields,
        addressDetailLevel: draft.addressDetailLevel,
        showMarketingConsent: draft.showMarketingConsent,
        consentEnabled: draft.consentEnabled && !!(loc?.consentText || draft.consentText).trim(),
        consentTitle: loc?.consentTitle || draft.consentTitle || null,
        consentText: loc?.consentText || draft.consentText || null,
        customQuestions: (loc && loc.customQuestions.length === draft.customQuestions.length ? loc.customQuestions.map((q, i) => ({ ...draft.customQuestions[i], label: q.label || draft.customQuestions[i].label, options: q.options })) : draft.customQuestions),
        confirmEmailEnabled: draft.confirmEmail,
        reminderHours: reminderHoursOf(draft.reminders),
        editorAutoConfirm: draft.autoConfirm,
        ...(isRestaurant ? {
          eventTypes: draft.eventTypes
            .map((e, i) => ({ ...e, label: loc?.eventTypeLabels[i] || e.label }))
            .filter((e) => e.enabled !== false && e.label)
            .map((e) => ({ icon: e.icon, label: e.label })),
        } : {}),
      },
      staffEdits,
    }
  }, [draft, loc])

  // Az előnézet üzenetei: `ready` → küldjük a draftot + kijelölést; `pick` → kijelölés; `step` → lépésváltás.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isEditorMessage<PreviewToEditor>(e)) return
      if (e.source === frame2Ref.current?.contentWindow && e.data.type === 'ready') { setReady2(true); return }
      if (e.source !== frameRef.current?.contentWindow && e.source !== frame2Ref.current?.contentWindow) return
      if (e.data.type === 'ready') setReady(true)
      // a foglalás egy lépésében kattintott elem (mező, munkatárs, feltételek…) a lépésen marad — csak az oldal elemei visznek az Oldalra
      else if (e.data.type === 'pick') { if (PICK_TO_PART[e.data.id]) setStep('main'); setSel(partOf(e.data.id)); setPicked(e.data.id); setSheetOpen(false) }
      else if (e.data.type === 'step') { setStep(e.data.view as EditorView); setSel(null) }
      else if (e.data.type === 'close') setSel(null)
      else if (e.data.type === 'text') onTextRef.current(e.data.id, e.data.value)
      else if (e.data.type === 'action') onActionRef.current(e.data.id, e.data.action, e.data.value ?? null)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  useEffect(() => { if (ready) postToPreview(frameRef.current, { type: 'draft', patch: previewPatch }) }, [ready, previewPatch])
  // a keretezett elem: amire kattintottak (ha ehhez a részhez tartozik), különben a rész fő eleme; a neve a gyors-sáv elejére
  const selDom = sel ? (picked && partOf(picked) === sel ? picked : PARTS.find((x) => x.id === sel)?.dom ?? sel) : null
  const sheet = narrow && ((!!sel && sheetOpen) || elemsOpen)
  const closeSheet = () => { setSel(null); setElemsOpen(false); setSheetOpen(false) }
  const staffOf = (dom: string | null) => dom ? draft.staff.find((m) => dom === `staff:${m.id}` || dom === `staffbio:${m.id}`) ?? null : null
  // a gyors-sávon rövid név (a panel címe lehet hosszabb) — hogy a sáv kiférjen a telefonon is
  const selLabel = sel ? (selDom === 'sec:slots' ? 'Időpontok' : selDom?.startsWith('txt:') ? 'Szöveg' : selDom?.startsWith('staffbio:') ? `${staffOf(selDom)?.name ?? ''} — bemutatkozás` : sel.startsWith('staff:') ? staffOf(sel)?.name : ELEMENT_TITLES[selDom ?? ''] ?? PARTS.find((x) => x.id === sel)?.title) ?? null : null

  // ── a kijelölt elem gyors-sávja (design 21.6.3): az elem eszközei; mobilon a végén a beállítások (a lap) ──
  const accentHex = draft.page.accent ?? '#FFD85F' // ui-allow: a davelopment sárgája, ha nincs saját márkaszín
  const toneOptions = TONE_PALETTE
  const barTools: BarTool[] = (() => {
    if (!selDom) return []
    const t: BarTool[] = []
    if (selDom === 'name') t.push({ t: 'icon', action: 'name-bold', label: 'Félkövér', icon: 'bold', on: draft.page.nameBold }, { t: 'icon', action: 'name-italic', label: 'Dőlt', icon: 'italic', on: draft.page.nameItalic }, { t: 'color', value: draft.page.nameColor ?? 'white', options: toneOptions })
    else if (selDom === 'address') t.push({ t: 'color', value: draft.page.addressColor ?? 'soft', options: toneOptions })
    else if (selDom === 'desc') t.push({ t: 'format' }, { t: 'color', value: draft.page.descColor ?? 'soft', options: toneOptions })
    else if (selDom === 'successTitle') t.push({ t: 'format' }, { t: 'color', value: draft.page.successTitleColor ?? 'white', options: toneOptions })
    else if (selDom.startsWith('staffbio:')) t.push({ t: 'format' })
    else if (selDom === 'cta') t.push({ t: 'button', action: 'step', label: 'Foglalás megnyitása' })
    // a fejléc képe: logó / ikon (a feltöltött képekkel — design 24.2)
    else if (selDom === 'logo') t.push({ t: 'brand', action: 'brand', value: draft.brandPage, logo: draft.logoUrl, icon: draft.iconUrl })
    else if (selDom === 'sec:slots') t.push({ t: 'button', action: 'hours', label: 'Nyitvatartás' })
    // a főoldal elemei: áthelyezhetők (a foglalás gomb mindig alul)
    if ((HERO_KEYS as readonly string[]).includes(selDom) && step === 'main') t.push({ t: 'icon', action: 'hero-up', label: 'Feljebb', icon: 'up' }, { t: 'icon', action: 'hero-down', label: 'Lejjebb', icon: 'down' })
    const fk = fieldKeyOf(selDom)
    if (fk) {
      if (fk === 'phone') t.push({ t: 'toggle', action: 'required', label: 'Kötelező', on: draft.requirePhone })
      if (fk === 'address') t.push({ t: 'toggle', action: 'required', label: 'Kötelező', on: draft.requireAddress })
      if (fk === 'phone' || fk === 'notes') t.push({ t: 'toggle', action: 'hide', label: 'Elrejt', on: draft.hiddenFields.includes(fk) })
      t.push({ t: 'icon', action: 'up', label: 'Feljebb', icon: 'up' }, { t: 'icon', action: 'down', label: 'Lejjebb', icon: 'down' })
    }
    if (narrow) t.push({ t: 'icon', action: 'settings', label: 'Beállítások', icon: 'settings' })
    return t
  })()
  const toolsKey = JSON.stringify(barTools)
  useEffect(() => { if (ready) postToPreview(frameRef.current, { type: 'select', id: selDom, label: selLabel, tools: JSON.parse(toolsKey) }) }, [ready, selDom, selLabel, toolsKey])
  useEffect(() => { if (ready2) postToPreview(frame2Ref.current, { type: 'select', id: selDom, label: selLabel, tools: JSON.parse(toolsKey) }) }, [ready2, selDom, selLabel, toolsKey])
  // telefon-nézetben a bal kijelző az oldalt mutatja, a jobb a foglalót (az adott lépéssel, vagy az 1. lépéssel)
  const twoUp = device === 'mobile' && !narrow
  useEffect(() => { if (ready) postToPreview(frameRef.current, { type: 'view', view: twoUp ? 'main' : step }) }, [ready, step, twoUp])
  useEffect(() => { if (ready2) postToPreview(frame2Ref.current, { type: 'draft', patch: previewPatch }) }, [ready2, previewPatch])
  useEffect(() => { if (ready2) postToPreview(frame2Ref.current, { type: 'view', view: step === 'main' ? 'start' : step }) }, [ready2, step])

  // ── Mentés ──
  const save = useCallback(async (): Promise<boolean> => {
    const patchJson = async (url: string, body: Record<string, unknown>) => {
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? `HTTP ${res.status}`)
      }
    }
    try {
      const b = baseline
      const d = draft
      const body: Record<string, unknown> = {}
      const changed = <K extends keyof Draft>(k: K) => JSON.stringify(d[k]) !== JSON.stringify(b[k])
      if (changed('postalCode')) body.postal_code = d.postalCode
      if (changed('name')) body.name = d.name
      if (changed('address')) body.address = d.address
      if (changed('city')) body.city = d.city
      if (changed('phone')) body.phone = d.phone
      if (changed('email')) body.email = d.email
      if (changed('website')) body.website = d.website
      if (changed('description')) body.description = d.description
      if (changed('socialLinks')) body.social_links = d.socialLinks.filter((u) => u.trim()).map((url) => ({ url: url.trim() }))
      if (changed('coverId')) body.cover_image = d.coverId
      if (changed('coverFocalX') || changed('coverFocalY') || changed('coverZoom')) {
        body.cover_focal_x = d.coverFocalX
        body.cover_focal_y = d.coverFocalY
        body.cover_zoom = d.coverZoom
      }
      if (changed('coverFocalMobileX') || changed('coverFocalMobileY')) {
        body.cover_focal_mobile_x = d.coverFocalMobileX
        body.cover_focal_mobile_y = d.coverFocalMobileY
      }
      if (changed('logoId')) body.logo = d.logoId
      if (changed('iconId')) body.icon = d.iconId
      if (changed('brandLogoSize')) body.brand_logo_size = d.brandLogoSize
      if (changed('brandPage')) body.brand_page = d.brandPage
      if (changed('brandEmail')) body.brand_email = d.brandEmail
      if (changed('brandQr')) body.brand_qr = d.brandQr
      if (changed('goodToKnow')) body.good_to_know = d.goodToKnow
      if (changed('supportedLocales')) body.supported_locales = d.supportedLocales
      if (['showServiceCount', 'showStaffCount', 'servicesExpandedOnMain', 'autoConfirm', 'requireAddress', 'requireAddressNote', 'sectionOrder', 'hiddenSections', 'minLeadHours', 'fieldOrder', 'hiddenFields', 'addressDetailLevel', 'showMarketingConsent'].some((k) => changed(k as keyof Draft))) {
        body.booking_rules = {
          ...initial.bookingRules,
          show_service_count_on_public: d.showServiceCount,
          show_staff_count_on_public: d.showStaffCount,
          services_expanded_on_main: d.servicesExpandedOnMain,
          public_section_order: d.sectionOrder,
          public_sections_hidden: d.hiddenSections,
          form_field_order: d.fieldOrder,
          ...(isRestaurant ? {} : { min_lead_hours: d.minLeadHours }),
          auto_confirm: d.autoConfirm,
          require_address: d.requireAddress,
          require_address_note: d.requireAddressNote.trim() || null,
          hidden_booking_fields: d.hiddenFields,
          address_detail_level: d.addressDetailLevel,
          show_marketing_consent_field: d.showMarketingConsent,
        }
      }
      if (changed('bookingWindowDays')) body.booking_window_days = d.bookingWindowDays
      if (changed('windowPeriodic')) body.booking_window_periodic = d.windowPeriodic
      if (changed('windowEnd')) { body.booking_window_end = d.windowEnd; body.booking_window_notice_for = null }
      if (changed('windowAutoRenew')) body.booking_window_auto_renew = d.windowAutoRenew
      if (!isRestaurant && changed('bufferMinutes')) body.booking_buffer_minutes = d.bufferMinutes
      if (isRestaurant) {
        if (changed('turnMinutes')) body.turn_duration_minutes = d.turnMinutes
        if (changed('slotStepMinutes')) body.slot_step_minutes = d.slotStepMinutes
        if (changed('lastSeatingMinutes')) body.last_seating_buffer_minutes = d.lastSeatingMinutes
        // Étteremnél a saját `lead_time_hours` mező a minimum foglalási idő.
        if (changed('minLeadHours')) body.lead_time_hours = d.minLeadHours ?? 0
        if (changed('eventTypes')) body.event_types = d.eventTypes
      }
      if (changed('requirePhone')) body.require_phone = d.requirePhone
      if (changed('confirmEmail')) body.notification_prefs = { ...initial.notificationPrefs, confirm_email: d.confirmEmail }
      if (changed('reminders')) {
        const r = d.reminders
        body.feature_modules = {
          ...initial.featureModules,
          reminders_on: r.on, reminder_t_48h: r.h48, reminder_t_24h: r.h24, reminder_t_3h: r.h3, reminder_t_1h: r.h1,
          reminder_custom_hours: r.custom, reminder_ch_email: r.chEmail, reminder_ch_push: r.chPush,
        }
      }
      if (changed('consentEnabled') || changed('consentTitle') || changed('consentText')) {
        body.consent_settings = { enabled: d.consentEnabled, title: d.consentTitle, template_text: d.consentText }
      }
      // A csoportot a PATCH egészében cseréli — a mentett (nem szerkesztett) összeg/
      // visszatérítés/stb. mezőket a `*SettingsBase`-ből fésüljük bele, csak az `enabled`-et
      // módosítjuk innen.
      if (changed('depositEnabled')) body.deposit_settings = { ...initial.depositSettingsBase, enabled: d.depositEnabled }
      if (changed('voucherEnabled')) body.voucher_settings = { ...initial.voucherSettingsBase, enabled: d.voucherEnabled }
      if (changed('customQuestions')) body.custom_questions = d.customQuestions
      if (changed('page')) body.public_page = publicPageBody(d.page, d.page.ctaLabel)
      // a galéria: a sorok azonosítója megmarad, így a többi nyelv felirata sem vész el
      if (changed('gallery')) body.gallery = d.gallery.map((g) => ({ id: g.key, image: g.imageId, caption: g.caption.trim() || null }))
      if (Object.keys(body).length > 0) {
        try {
          await patchJson(apiBase, body)
        } catch (e) {
          // Foglalt URL-azonosító: a szerver egyediségi hibát ad vissza.
          const msg = e instanceof Error ? e.message.toLowerCase() : ''
          if ('slug' in body && (msg.includes('unique') || msg.includes('slug'))) throw new Error('Ez az URL már foglalt — próbálj másik azonosítót')
          throw e
        }
      }

      // Szolgáltatások: melyik látszik a foglalóoldalon (szalon)
      for (const sv of d.services) {
        const before = b.services.find((x) => x.id === sv.id)
        if (before && before.visible !== sv.visible) await patchJson(`/api/services/${sv.id}`, { online_visible: sv.visible })
      }

      for (const m of d.staff) {
        const before = b.staff.find((x) => x.id === m.id)
        if (!before || JSON.stringify(before) === JSON.stringify(m)) continue
        await patchJson(`/api/staff/${m.id}`, {
          name: m.name,
          role_title: m.role_title,
          show_role_title: m.show_role_title,
          bio: m.bio,
          social_links: m.social_links.filter((u) => u.trim()).map((url) => ({ url: url.trim() })),
        })
      }

      for (const [code, value] of Object.entries(locDrafts) as [Locale, LocDraft][]) {
        const before = locBaseline[code]
        if (!before || JSON.stringify(before) === JSON.stringify(value)) continue
        const { staffBio: _a, ...beforeSalon } = before
        const { staffBio: _b, ...valueSalon } = value
        if (JSON.stringify(beforeSalon) !== JSON.stringify(valueSalon)) {
          await patchJson(`${apiBase}?locale=${code}`, {
            description: value.description,
            good_to_know: value.goodToKnow,
            // A csoportot a PATCH egészében cseréli — az `enabled` (nem fordított) mezőt is küldjük.
            consent_settings: { enabled: d.consentEnabled, title: value.consentTitle, template_text: value.consentText },
            custom_questions: value.customQuestions,
            ...(isRestaurant ? { event_types: d.eventTypes.map((e, i) => ({ ...e, label: value.eventTypeLabels[i] ?? '' })) } : {}),
            // a gomb felirata és a képfeliratok ezen a nyelven (a csoport / a tömb többi mezője a mentett állapot)
            public_page: publicPageBody(d.page, value.ctaLabel, value.successTitle, value.placeholders, value.texts),
            gallery: d.gallery.map((g, i) => ({ id: g.key, image: g.imageId, caption: value.captions[i]?.trim() || null })),
          })
        }
        for (const [id, bio] of Object.entries(value.staffBio)) {
          if (before.staffBio[id] !== bio) await patchJson(`/api/staff/${id}?locale=${code}`, { bio })
        }
      }

      setBaseline(d)
      setLocBaseline(locDrafts)
      router.refresh()
      // Az előnézet a mentett állapotot a szerverről is újratölti (cache-invalidálás után).
      setReady(false)
      frameRef.current?.contentWindow?.location.reload()
      setReady2(false)
      frame2Ref.current?.contentWindow?.location.reload()
      return true
    } catch (e) {
      toast.error(`Mentés sikertelen${e instanceof Error && e.message ? `: ${e.message}` : ''}`)
      return false
    }
  }, [baseline, draft, locBaseline, locDrafts, initial.bookingRules, initial.notificationPrefs, initial.featureModules, router])

  const discard = useCallback(() => {
    setDraft(baseline)
    setLocDrafts(locBaseline)
  }, [baseline, locBaseline])

  useEffect(() => { registerApi?.({ save, discard }) }, [registerApi, save, discard])

  // ── Kép feltöltése (borító / logó) — ugyanaz az út, mint a régi profil-űrlapon ──
  const [uploading, setUploading] = useState<'cover' | 'logo' | 'icon' | null>(null)
  const upload = async (kind: 'cover' | 'logo' | 'icon', file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('A kép mérete legfeljebb 10 MB lehet.'); return }
    setUploading(kind)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.errors?.[0]?.message ?? `HTTP ${res.status}`)
      }
      const { doc } = await res.json()
      if (kind === 'cover') setDraft((d) => ({ ...d, coverId: doc.id, coverUrl: doc.url, coverFocalX: 50, coverFocalY: 50, coverZoom: 1 }))
      else if (kind === 'icon') setDraft((d) => ({ ...d, iconId: doc.id, iconUrl: doc.url }))
      else setDraft((d) => ({ ...d, logoId: doc.id, logoUrl: doc.url }))
    } catch (e) {
      toast.error(`Kép feltöltése sikertelen: ${e instanceof Error ? e.message : 'ismeretlen hiba'}`)
    } finally {
      setUploading(null)
    }
  }

  // ── Galéria (design 21.6.2): több kép egyszerre — a feltöltés alatt a saját előnézetük sötétítve, hiba esetén az ok ──
  const [galleryUp, setGalleryUp] = useState<{ key: string; src: string; error?: string }[]>([])
  const [gallerySel, setGallerySel] = useState(0)
  const uploadGallery = async (files: File[]) => {
    const room = 12 - draft.gallery.length
    if (room <= 0) { toast.error('A galériában legfeljebb 12 kép lehet.'); return }
    const list = files.slice(0, room)
    const tmp = list.map((f) => ({ key: crypto.randomUUID(), src: URL.createObjectURL(f) }))
    setGalleryUp((u) => [...u, ...tmp])
    await Promise.all(list.map(async (file, i) => {
      const t = tmp[i]
      try {
        if (!file.type.startsWith('image/')) throw new Error('Ez nem kép.')
        if (file.size > 15 * 1024 * 1024) throw new Error(`Túl nagy (${Math.round(file.size / 1048576)} MB, legfeljebb 15 MB).`)
        const compressed = await compressImage(file)
        const fd = new FormData(); fd.append('file', compressed); fd.set('_payload', JSON.stringify({ alt: file.name }))
        const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
        if (!res.ok) throw new Error('A feltöltés nem sikerült.')
        const { doc } = await res.json()
        remember()
        setDraft((d) => ({ ...d, gallery: [...d.gallery, { key: crypto.randomUUID().replace(/-/g, '').slice(0, 24), imageId: Number(doc.id), url: doc.url ?? null, caption: '' }].slice(0, 12) }))
        setGalleryUp((u) => u.filter((x) => x.key !== t.key))
      } catch (e) {
        setGalleryUp((u) => u.map((x) => (x.key === t.key ? { ...x, error: e instanceof Error ? e.message : 'A feltöltés nem sikerült.' } : x)))
      }
    }))
  }
  const moveGallery = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= draft.gallery.length) return
    const g = [...draft.gallery]; [g[i], g[j]] = [g[j], g[i]]
    set('gallery', g); setGallerySel(j)
  }

  // ── Vászon-méretezés: az előnézet a valódi szélességen fut, a helyre kicsinyítve ──
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasW, setCanvasW] = useState(0)
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setCanvasW(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [portalReady])
  const frame = FRAME[device]
  // Ez a `scale` KIZÁRÓLAG a desktopos szimulált (mobil VAGY asztali) előnézethez kell —
  // ott 100%-nál sose nagyítunk fel (különben egy egérrel nézett "mobil szimuláció" óriásira
  // torzulna egy széles monitoron), csak zsugorítunk, ha a vászon szűkebb a kerethez képest.
  // A valódi, keskeny mobil-eszközön ez a változó nem is használt (ld. `narrow` külön ág),
  // ott az iframe mindig a tényleges elérhető szélességet kapja, skálázás nélkül.
  // telefon-nézetben két kijelző fér el egymás mellett (24 px réssel)
  const GAP = 24
  // a desktop-előnézet magassága — telefon-nézetben a két kijelző is pontosan ilyen magas (ha szélességben elfér)
  const desktopH = FRAME.desktop.h * Math.min(1, canvasW / FRAME.desktop.w)
  const scale = canvasW <= 0 ? 0 : device === 'mobile' && !narrow
    ? Math.min(desktopH / frame.h, (canvasW - GAP) / (frame.w * 2))
    : Math.min(1, canvasW / frame.w)
  // A MENTETT azonosítón fut az előnézet (a még nem mentett új URL-en nincs oldal).
  const src = `/${baseline.slug}?editor=1${lang !== 'hu' ? `&lang=${lang}` : ''}`
  // Új nyelv = új iframe-betöltés: a `ready` üzenetig nem küldünk semmit.
  useEffect(() => { setReady(false); setReady2(false) }, [src])

  const consentOn = draft.consentEnabled && !!draft.consentText.trim()
  // A lépés akkor él ténylegesen, ha a kapcsoló (élőben szerkeszthető) ÉS a Stripe-fiók
  // onboardolva van — enélkül a kapcsoló "be" állása a vendég felé még nem működne.
  const depositOn = draft.depositEnabled && initial.flags.stripeOnboarded
  const voucherOn = draft.voucherEnabled && initial.flags.stripeOnboarded
  const flow = STEPS.filter((st) =>
    st.id === 'deposit' ? depositOn : st.id === 'consent' ? consentOn : st.id === 'voucher' ? voucherOn : true)
  // Kikapcsolt lépésen maradni nincs értelme — vissza az Adatokra.
  useEffect(() => { if (!flow.some((f) => f.id === step)) setStep('details') }, [flow, step])
  const goStep = (id: EditorView) => { setStep(id); setSel(null) }
  // Előleg/Utalvány lépés be/ki — kikapcsolni mindig lehet, bekapcsolni csak akkor, ha a
  // Stripe-fiók onboardolva van (előlegnél plusz: van kitöltött foglalási-feltétel), mert
  // a szerver ugyanezt a két feltételt kéri (ld. /api/salon|restaurant/settings) — itt előre
  // jelezzük, ne csak mentéskor derüljön ki egy hibaüzenetből.
  const toggleDeposit = () => {
    if (!draft.depositEnabled) {
      if (!initial.flags.stripeOnboarded) { toast.error('Előbb kösd össze a Stripe-fiókot a Fizetés & számlázás fülön.'); onNavigate?.('payments'); return }
      if (!initial.flags.termsFilled) { toast.error('Előbb töltsd ki a foglalási feltételeket a Dokumentumok & jogi fülön.'); onNavigate?.('documents'); return }
    }
    // Előleg mellett kötelező az automatikus megerősítés (fizetett foglalást nem hagyunk függőben).
    if (!draft.depositEnabled && !draft.autoConfirm) {
      setDraft((d) => ({ ...d, depositEnabled: true, autoConfirm: true }))
      toast('Az automatikus megerősítés bekapcsolt — előleg mellett kötelező.')
      return
    }
    set('depositEnabled', !draft.depositEnabled)
  }
  // Automatikus megerősítés: előleg mellett nem kapcsolható ki — próbálkozáskor figyelmeztetés alá.
  const [autoConfirmWarn, setAutoConfirmWarn] = useState(false)
  const toggleAutoConfirm = () => {
    if (depositOn && draft.autoConfirm) { setAutoConfirmWarn(true); return }
    setAutoConfirmWarn(false)
    set('autoConfirm', !draft.autoConfirm)
  }
  const autoConfirmBlocked = depositOn && (autoConfirmWarn || !draft.autoConfirm)
  const toggleVoucher = () => {
    if (!draft.voucherEnabled && !initial.flags.stripeOnboarded) { toast.error('Előbb kösd össze a Stripe-fiókot a Fizetés & számlázás fülön.'); onNavigate?.('payments'); return }
    set('voucherEnabled', !draft.voucherEnabled)
  }
  const setRem = (patch: Partial<Draft['reminders']>) => setDraft((d) => ({ ...d, reminders: { ...d.reminders, ...patch } }))
  const remHours = reminderHoursOf(draft.reminders)
  const draftWindow: BookingWindowSource = { booking_window_days: draft.bookingWindowDays, booking_window_periodic: draft.windowPeriodic, booking_window_end: draft.windowEnd, booking_window_auto_renew: draft.windowAutoRenew }
  const draftWindowEnd = effectiveWindowEnd(draftWindow)
  const rulesSummary: { label: string; value: string; step: EditorView; sel: string | null; off?: boolean }[] = [
    { label: 'Foglalható előre', value: draft.windowPeriodic ? (draftWindowEnd ? `${huDate(draftWindowEnd)}-ig` : 'Lejárt') : `${draft.bookingWindowDays} nap`, step: 'datetime', sel: 'rules', off: draft.windowPeriodic && !draftWindowEnd },
    isRestaurant
      ? { label: 'Foglalás hossza', value: `${draft.turnMinutes} perc`, step: 'datetime', sel: 'rules' }
      : { label: 'Szünet a foglalások között', value: draft.bufferMinutes ? `${draft.bufferMinutes} perc` : 'Nincs', step: 'datetime', sel: 'rules', off: !draft.bufferMinutes },
    { label: 'Minimum idő előtte', value: draft.minLeadHours ? `${draft.minLeadHours} óra` : 'Nincs', step: 'datetime', sel: 'rules', off: !draft.minLeadHours },
    { label: 'Automatikus megerősítés', value: draft.autoConfirm ? 'Be' : 'Ki', step: 'success', sel: 'confirm', off: !draft.autoConfirm },
    { label: 'Visszaigazoló e-mail', value: draft.confirmEmail ? 'Be' : 'Ki', step: 'success', sel: 'confirm', off: !draft.confirmEmail },
    { label: 'Emlékeztető', value: remHours.length ? remHours.map((h) => `${h} ó`).join(', ') : 'Ki', step: 'success', sel: 'confirm', off: !remHours.length },
    { label: 'Telefonszám kötelező', value: draft.requirePhone ? 'Igen' : 'Nem', step: 'details', sel: 'field:phone', off: !draft.requirePhone },
    { label: 'Előleg', value: depositOn ? initial.flags.depositLabel : 'Ki', step: depositOn ? 'deposit' : 'details', sel: depositOn ? 'deposit' : null, off: !depositOn },
    { label: 'Ajándékutalvány', value: voucherOn ? 'Be' : 'Ki', step: voucherOn ? 'voucher' : 'details', sel: voucherOn ? 'sec:voucher' : null, off: !voucherOn },
  ]

  const staffId = sel?.startsWith('staff:') ? sel.slice(6) : null
  const member = staffId ? draft.staff.find((m) => m.id === staffId) ?? null : null
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const publicUrl = `${origin}/${baseline.slug}`

  const stepLabel = STEPS.find((st) => st.id === step)?.label ?? ''
  const title = member ? member.name : sel ? (sel.startsWith('txt:') ? 'Szöveg' : ELEMENT_TITLES[sel] ?? 'Elem') : step === 'main' ? 'Az oldal elemei' : stepLabel

  // `compact`: a mobil fejlécbe portálozott gomb — pontosan ugyanaz a méret/forma
  // (h-[52px] w-[52px], kör, ugyanaz a háttér/árnyék/press-animáció), mint a DashboardNav
  // többi fejléc-ikonja (szűrő/csengő/avatar), hogy ne üssön el a sorban. Desktopon (a
  // szerkesztő saját fejléc-sorában) marad a szöveges "HU" pill, ott bőven van hely.
  // ── a design 21.6 kerete ──
  const part = PARTS.find((x) => x.id === sel) ?? null
  const shown = (id: string) => sel === id || (!!part && part.panels.includes(id))
  const flowIdx = Math.max(0, flow.findIndex((f) => f.id === step))
  const changes = (Object.keys(draft) as (keyof Draft)[]).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(baseline[k])).length + (JSON.stringify(locDrafts) !== JSON.stringify(locBaseline) ? 1 : 0)
  const [publishing, setPublishing] = useState(false)
  const publish = async () => { setPublishing(true); try { if (await save()) { setPast([]); setFuture([]); toast.success('Közzétéve — a foglalóoldal frissült') } } finally { setPublishing(false) } }
  const copyLink = () => { void navigator.clipboard?.writeText(publicUrl).then(() => toast.success('Link másolva')).catch(() => toast.error('A másolás nem sikerült')) }
  // kilépés: ha van közzé nem tett módosítás, előbb a közös felugró ablakban kérdezünk (közzéteszi / elveti / marad)
  const [exitAsk, setExitAsk] = useState(false)
  const exit = () => { if (changes) { setExitAsk(true); return } onExit?.() }
  const exitDiscard = () => { setExitAsk(false); discard(); onExit?.() }
  const exitPublish = async () => { setPublishing(true); try { if (await save()) { setExitAsk(false); onExit?.() } } finally { setPublishing(false) } }
  // a részek állapota az áttekintőhöz (mennyire kész az oldal)
  const overview = PARTS.map((x) => {
    const st: Record<string, [string, boolean?]> = {
      brand: [[draft.logoUrl ? 'Logó' : 'Nincs logó', draft.page.accent ? 'saját szín' : 'alap sárga', { dark: 'sötét kártya', black: 'fekete kártya', glass: 'világos üveg', white: 'fehér kártya' }[draft.page.card]].join(', '), !draft.logoUrl],
      cover: [draft.coverUrl ? (draft.coverFocalMobileX == null ? 'Mobilon még nincs fókuszpont' : 'Kép, fókuszponttal') : 'Nincs borítókép', !draft.coverUrl || draft.coverFocalMobileX == null],
      gallery: [draft.gallery.length ? `${draft.gallery.length} / 12 kép · ${Math.min(3, draft.gallery.length)} a borítón` : 'Még nincs kép', !draft.gallery.length],
      header: [[draft.showServiceCount || draft.showStaffCount ? 'Számlálók' : 'Számlálók nélkül', languages.map((l) => l.toUpperCase()).join(', ')].join(' · ')],
      intro: [draft.description.trim() ? `Leírás ${draft.description.trim().length} / 160${draft.description.trim().length < 80 ? '— írhatsz még' : ''}` : 'Nincs leírás', draft.description.trim().length < 80],
      reviews: [draft.page.showRating ? 'A borítón' : 'Rejtve'],
      social: [draft.socialLinks.filter((u) => u.trim()).length ? `${draft.socialLinks.filter((u) => u.trim()).length} link` : 'Nincs link', !draft.socialLinks.some((u) => u.trim())],
      cta: [draft.page.ctaLabel?.trim() || (isRestaurant ? 'Asztalfoglalás' : 'Időpontfoglalás')],
      services: [draft.services.length ? `${draft.services.filter((x) => x.visible).length} látszik${draft.services.some((x) => !x.visible) ? `, ${draft.services.filter((x) => !x.visible).length} rejtve` : ''}` : 'A megjelenésük'],
    }
    const [status, todo] = st[x.id] ?? ['']
    return { id: x.id, icon: x.icon, title: x.title, status, todo: !!todo }
  }).filter((x) => !(isRestaurant && x.id === 'services'))

  // a teljes képernyős szerkesztő a <body>-ba kerül (portál): a Beállítások oldal nyitó animációja (transform) különben a
  // szülő dobozához kötné a `fixed` réteget, és megnyitáskor csak egy levágott csík látszana belőle
  if (!portalReady) return null
  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[90] overflow-y-auto bg-ui-page font-onest" data-lenis-prevent>
      <div className="mx-auto w-full max-w-[1760px] p-[5px] pb-28">
      {/* fejléc: vissza a Beállításokhoz, cím, Élő, Telefon / Desktop */}
      {/* keskeny kijelzőn ragadós (görgetéskor is fent marad), benne a lépés-váltó is — helyet spórolva */}
      <div className={cn('flex items-center justify-between gap-3 px-3 py-3', narrow ? 'sticky top-0 z-30' : 'flex-wrap')}>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton icon={ArrowLeft} label="Vissza a Beállításokhoz" variant="cell" size="sm" onClick={exit} />
          <span className="text-ui-title font-normal text-ui-text">Foglalóoldal</span>
          {/* mobilon nincs hely: az „Élő” jelzés és a megnyitás gomb csak desktopon */}
          {!narrow && <StatusPill status="ok">Élő</StatusPill>}
        </div>
        {/* jobbra: (keskenyen) a lépés-váltó, a foglalóoldal megnyitása (keskenyen csak ikon), Telefon / Desktop */}
        <div className={cn('flex min-w-0 items-center gap-2', narrow && 'flex-1 justify-end')}>
          {/* keskenyen tömör lépés-váltó (‹ lépés neve ›) — ha nem fér ki, a név elúszik */}
          {narrow && <EditorStepSwitch compact onLabel={() => setStepsOpen(true)} className="min-w-0 max-w-[220px] flex-1" active={flowIdx} onSelect={(i) => goStep(flow[i].id)} steps={flow.map((f) => ({ label: f.id === 'main' ? 'Oldal' : f.label }))} />}
          {/* mobil: az aktuális lépés elemei felcsúszó lapon (design 21.6.4) */}
          {narrow && <IconButton icon={List} label="Elemek" variant="dark" size="sm" onClick={() => { setSel(null); setElemsOpen(true) }} />}
          {!narrow && <Button variant="glass" href={publicUrl} className="min-w-0 shrink">{publicUrl.replace(/^https?:\/\//, '')} <ArrowUpRight className="h-3.5 w-3.5" /></Button>}
          {!narrow && <Segmented options={['Telefon', 'Desktop']} active={device === 'mobile' ? 0 : 1} onSelect={(i) => setDevice(i === 0 ? 'mobile' : 'desktop')} />}
        </div>
      </div>
      {/* a lépés-sáv (a foglaló minden lépése megnézhető és szerkeszthető) — keskeny kijelzőn előző / következő váltó */}
      {/* mobil: a lépés nevére koppintva a lépések listája — bármelyikre ugorhatsz */}
      <PopupModal open={stepsOpen} onClose={() => setStepsOpen(false)} title="Lépések" maxWidth="sm:max-w-[440px]">
        {flow.map((f, i) => (
          <button key={f.id} type="button" onClick={() => { goStep(f.id); setStepsOpen(false) }} className="block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
            <ListRow open={i === flowIdx} filled={i === flowIdx} className="px-3" leading={<IconCircle size="sm" tone={i === flowIdx ? 'dark' : 'cell'}>{i + 1}</IconCircle>} title={f.id === 'main' ? 'Oldal' : f.label} />
          </button>
        ))}
      </PopupModal>
      {!narrow && (
        <div className="mx-[5px] mb-[5px]">
          <EditorStepBar className="w-fit max-w-full" active={flowIdx} onSelect={(i) => goStep(flow[i].id)} steps={flow.map((f) => ({ label: f.id === 'main' ? 'Oldal' : f.label }))} />
        </div>
      )}
      <div className="grid gap-[5px] xl:grid-cols-[56px_minmax(0,1fr)_340px]">
        {/* bal: az oldal részei — kijelölve jobbra nyílik a beállításuk */}
        <Card pad="none" className="hidden flex-col items-center gap-1.5 self-start py-3 xl:flex">
          {PARTS.filter((x) => !(isRestaurant && x.id === 'services')).map((x) => (
            <IconButton key={x.id} icon={x.icon} label={x.title} variant={sel === x.id ? 'dark' : 'ghost'} size="sm" onClick={() => { setStep('main'); selectPart(x.id) }} />
          ))}
        </Card>
        {/* Vászon — a vastag telefon-keret (ring) csak akkor indokolt, ha egy NAGYOBB
            kijelzőn szimulálunk mobil-nézetet; magán a mobilon ez csak "telefon a
            telefonban" felesleges keret lenne, ott inkább plusz függőleges légzőteret
            adunk a keret helyett. */}
        {/* Valódi mobilon: nincs keret, nincs transform, teljes szélesség. Desktopon
            (szimulált mobil/desktop nézet): skálázott keret, ÉS sticky — görgetéskor a
            hosszabb jobb oldali panel mellett a helyén marad, nem marad le. */}
        <div ref={canvasRef} className={cn('min-w-0 flex-1', !narrow && 'xl:sticky xl:top-6 xl:self-start')}>
          {narrow ? (
            canvasW > 0 && (
              <iframe
                ref={frameRef}
                key={src}
                src={src}
                title="Foglalóoldal előnézet"
                // betöltés közben nem látszik (nincs félkész kép) — a `ready` üzenetre úszik be
                className={cn('w-full rounded-ui-container border-0 transition-opacity duration-300', ready ? 'opacity-100' : 'opacity-0')}
                // telefonon az élő kép a fejléc alatti hely — ha látszik a közzétételi sáv, az alja fölötte ér véget (12 px közzel:
                // fejléc ~70 px, a sáv 20 px-re az aljától, ~56 px magas), hogy a sáv ne takarja; az oldal benne görgethető
                style={{ width: canvasW, height: `min(${frame.h}px, calc(100dvh - ${changes > 0 || publishing ? 160 : 86}px - env(safe-area-inset-bottom)))`, transition: 'height .25s ease' }}
              />
            )
          ) : (
            <div className="flex items-start justify-center" style={{ gap: device === 'mobile' ? GAP * scale : 0 }}>
              <div className="relative" style={{ width: frame.w * scale, height: frame.h * scale }}>
                {scale > 0 && (
                  // keret nélkül, a valódi képarányban (design 21.6) — nincs telefon-keret
                  <iframe ref={frameRef} key={src} src={src} title="Foglalóoldal előnézet"
                    className={cn('absolute left-0 top-0 origin-top-left rounded-ui-container border-0 bg-ui-dark transition-opacity duration-300', ready ? 'opacity-100' : 'opacity-0')}
                    style={{ width: frame.w, height: frame.h, transform: `scale(${scale})` }} />
                )}
              </div>
              {/* telefon-nézet: mellette a felcsúszó foglaló (design 16.10) — a lépései a lépés-sávból */}
              {device === 'mobile' && scale > 0 && (
                <div className="relative" style={{ width: frame.w * scale, height: frame.h * scale }}>
                  <iframe ref={frame2Ref} key={`${src}-2`} src={src} title="Foglaló előnézet"
                    className={cn('absolute left-0 top-0 origin-top-left rounded-ui-container border-0 bg-ui-dark transition-opacity duration-300', ready2 ? 'opacity-100' : 'opacity-0')}
                    style={{ width: frame.w, height: frame.h, transform: `scale(${scale})` }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tulajdonság-panel */}
        {/* mobilon a kijelölt elem lapja a közös felugró ablak mobil-lapjának kinézetével (sötétítés, fehér lap, fogantyú) */}
        {/* mobilon a lap ugyanúgy nyílik, mint a közös felugró ablak (PopupModal): elhalványuló háttér, rugós felcsúszás */}
        <AnimatePresence>
          {sheet && <motion.div key="sheet-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-[92] bg-ui-dark/25 backdrop-blur-sm" onClick={closeSheet} aria-hidden />}
        </AnimatePresence>
        <AnimatePresence initial={false}>
        {(!narrow || sheet) && (
        <motion.aside
          key={sheet ? 'sheet' : 'panel'}
          variants={sheet ? SHEET_MOBILE : undefined}
          initial={sheet ? 'hidden' : false}
          animate={sheet ? 'show' : undefined}
          exit={sheet ? 'exit' : undefined}
          className={cn(
            'w-full space-y-4 p-5',
            sheet
              ? 'fixed inset-x-0 bottom-0 z-[93] max-h-[85dvh] overflow-y-auto rounded-t-ui-card bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-ui-popup'
              : 'self-start rounded-ui-card bg-white',
          )}
        >
          {sheet && (
            /* mobil: csak fogantyú (koppintásra zár) — X nélkül, mint a többi alulról nyíló lap */
            <div className="-mt-2 flex items-center justify-center">
              <button type="button" onClick={closeSheet} aria-label="Bezárás" className="w-full py-2">
                <SheetHandle />
              </button>
            </div>
          )}
          {/* a panel fejléce (design 21.6): kijelölt elemnél „Kijelölt elem” + név és bezárás; lépésnél a lépés neve */}
          {sel ? (
            <div className="flex items-start justify-between">
              <div><div className="text-ui-label text-ui-muted">Kijelölt elem</div><div className="mt-0.5 text-ui-sub font-light text-ui-text">{part?.title ?? title}</div></div>
              {!narrow && <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={() => setSel(null)} />}
            </div>
          ) : step !== 'main' && (
            <div><div className="text-ui-label text-ui-muted">Foglalás folyamata</div><div className="mt-0.5 text-ui-sub font-light text-ui-text">{stepLabel}</div></div>
          )}
          {/* a szerkesztett nyelv — a közzétételi sáv csak módosításnál jelenik meg, ezért itt is váltható */}
          {!sel && languages.length > 1 && (
            <EditorRow label="Szerkesztett nyelv">
              <Segmented tone="cell" size="sm" options={languages.map((l) => l.toUpperCase())} active={languages.indexOf(lang)} onSelect={(i) => void selectLang(languages[i] as Locale)} />
            </EditorRow>
          )}
          {/* a foglalás egy kijelölt szövege (cím, magyarázó sor, gomb) — az előnézetben helyben is írható */}
          {selDom?.startsWith('txt:') && (() => {
            const k = selDom.slice(4)
            const own = loc ? loc.texts[k] ?? '' : draft.page.texts[k] ?? ''
            const base = CUSTOM_TEXT_DEFAULTS[k] ?? t(lang, k as Parameters<typeof t>[1])
            const setText = (v: string) => (loc ? setLoc({ texts: { ...loc.texts, [k]: v } }) : setPage({ texts: { ...draft.page.texts, [k]: v } }))
            return (
              <div>
                <KitField label={`Szöveg (${LOCALE_LABELS[lang]})`} hint="Üresen: az alap szöveg. Az előnézetben rákattintva helyben is írhatod.">
                  <Input size="sm" maxLength={300} value={own} placeholder={base} onChange={(e) => setText(e.target.value)} />
                </KitField>
                {own.trim() && <Button variant="cell" size="sm" className="mt-2" onClick={() => setText('')}>Alap szöveg visszaállítása</Button>}
              </div>
            )
          })()}
          {/* a kijelölt foglaló mező helykitöltője (név, e-mail, cím, megjegyzés) — az előnézetben a mezőbe írva is */}
          {(() => {
            const fk = selDom ? fieldKeyOf(selDom) : null
            if (!fk || !(PLACEHOLDER_KEYS as readonly string[]).includes(fk)) return null
            // a cím-mezőnek két fele van: utca, házszám és város
            const keys: (keyof FieldPlaceholders)[] = fk === 'address' ? ['city', 'address'] : [fk as keyof FieldPlaceholders]
            return keys.map((k) => (
              <KitField key={k} label={`Helykitöltő${keys.length > 1 ? (k === 'city' ? ' — város' : ' — utca, házszám') : ''} (${LOCALE_LABELS[lang]})`} hint={k === keys[keys.length - 1] ? 'Halványan látszik a mezőben, amíg a vendég nem ír bele. Üresen: az alap. Az előnézetben a mezőbe kattintva is írhatod.' : undefined}>
                <Input size="sm" maxLength={k === 'notes' ? 120 : 60} value={loc ? loc.placeholders[k] : draft.page.placeholders[k] ?? ''} placeholder={loc ? draft.page.placeholders[k] ?? '' : undefined}
                  onChange={(e) => (loc ? setLoc({ placeholders: { ...loc.placeholders, [k]: e.target.value } }) : setPage({ placeholders: { ...draft.page.placeholders, [k]: e.target.value || null } }))} />
              </KitField>
            ))
          })()}

          {/* A panel tartalma kijelölés/lépés-váltáskor villanás helyett rövid, mobilbarát
              crossfade+csúszás animációval cserélődik (ugyanaz az easing, mint a többi
              davelopment-mozgásnyelvben). */}
          <AnimatePresence mode="wait">
          <motion.div
            key={sel ?? step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >

          {/* ── Arculat (design 21.6): márkaszín, a foglaló kártya, a betűszín a kártyán és a gombokon ── */}
          {shown('brand') && (
            <div>
              <EditorRow label="Márkaszín" hint="minden kiemelés: fő gomb, kiválasztott sor, időpont">
                <Swatches fills={ACCENTS} on={ACCENTS.indexOf(draft.page.accent ?? '#FFD85F')} onSelect={(i) => setPage({ accent: i === 0 ? null : ACCENTS[i] })}
                  add={
                    <ColorPicker value={draft.page.accent && !ACCENTS.includes(draft.page.accent) ? draft.page.accent : null} onChange={(c) => setPage({ accent: c })} />
                  } />
              </EditorRow>
              <EditorRow label="Foglaló kártya" hint={{ dark: 'sötét üveg', black: 'fekete', white: 'fehér', glass: 'világos üveg' }[draft.page.card]}>
                <Swatches fills={CARD_STYLES.map((x) => x.fill)} on={CARD_STYLES.findIndex((x) => x.id === draft.page.card)} onSelect={(i) => setPage({ card: CARD_STYLES[i].id })} />
              </EditorRow>
              <EditorRow label="Betűszín a gombokon" hint={draft.page.buttonTextColor ? 'a kijelöltre kattintva: magától' : 'magától (a márkaszínhez igazodik)'}><ButtonTextSwatches value={draft.page.buttonTextColor} accent={accentHex} onChange={(v) => setPage({ buttonTextColor: v })} /></EditorRow>
              <div className="mt-3 border-t border-dashed border-ui-divider pt-3"><span className="text-ui-label text-ui-muted">Logó</span></div>
            </div>
          )}

          {/* ── Borító: sötétítés (a kép és a fókuszpont a borító-panelen) ── */}
          {shown('cover') && (
            // a váltó a felirat alatt, teljes szélességben — mellette a magyarázat nem fér el (a három fül lelógna)
            <div>
              <span className="block text-ui-body text-ui-muted">Sötétítés</span>
              <span className="block text-ui-label text-ui-muted">Kikapcsolva a fotón nincs semmi; a név finom árnyékot kap.</span>
              <Segmented tone="cell" size="sm" full className="mt-2" options={['Ki', 'Enyhe', 'Erős']} active={['none', 'soft', 'strong'].indexOf(draft.page.dim)} onSelect={(i) => setPage({ dim: (['none', 'soft', 'strong'] as const)[i] })} />
            </div>
          )}
          {/* a borító alap színe, ha nincs kép: sötét tónusok (a fehér szöveg mindig olvasható rajta) + saját */}
          {shown('cover') && (
            <EditorRow label="Alap szín" hint="ha nincs borítókép">
              <CoverColorSwatches value={draft.page.coverColor} onChange={(v) => setPage({ coverColor: v })} />
            </EditorRow>
          )}

          {/* ── Galéria (design 21.6 / 21.6.2): legfeljebb 12 kép, az első 3 a borítón; a kijelölt kép felirata, sorrendje, törlése ── */}
          {shown('gallery') && (
            <div>
              <span className="text-ui-label text-ui-muted">{draft.gallery.length} / 12 kép{galleryUp.some((x) => !x.error) && ` · ${galleryUp.filter((x) => !x.error).length} feltöltés folyamatban`}</span>
              {([['A borítón', 0, 3], ['Csak a galériában', 3, 12]] as const).map(([t, from, to]) => (
                <div key={t} className="mt-2">
                  <span className="mb-1.5 block text-ui-label text-ui-muted">{t}</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {draft.gallery.slice(from, to).map((g, k) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <button key={g.key} type="button" onClick={() => setGallerySel(from + k)} className="ui-press rounded-ui-control"><img src={g.url ?? ''} alt={g.caption} className={`aspect-square w-full rounded-ui-control object-cover ${gallerySel === from + k ? 'ring-2 ring-ui-dark ring-offset-2' : ''}`} /></button>
                    ))}
                    {from === 3 && galleryUp.map((u) => <UploadTile key={u.key} src={u.src} proc={!u.error} error={!!u.error} />)}
                    {from === 3 && draft.gallery.length + galleryUp.filter((x) => !x.error).length < 12 && (
                      <label className="ui-press block cursor-pointer">
                        <UploadBox className="aspect-square">Feltöltés</UploadBox>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) void uploadGallery(f) }} />
                      </label>
                    )}
                  </div>
                </div>
              ))}
              {galleryUp.filter((x) => x.error).map((u) => <Note key={u.key} warn className="mt-2">{u.error} <button type="button" className="underline" onClick={() => setGalleryUp((x) => x.filter((y) => y.key !== u.key))}>Rendben</button></Note>)}
              {draft.gallery[gallerySel] && (
                <div className="mt-4">
                  <EditorGroup title="Kijelölt kép">
                    <KitField label="Felirat" hint={`A galériában a kép alatt — és ez az alt-szöveg is (Google-képkeresés).${lang !== 'hu' ? ` (${LOCALE_LABELS[lang]})` : ''}`} className="mt-1">
                      <Input size="sm" maxLength={120} value={loc ? loc.captions[gallerySel] ?? '' : draft.gallery[gallerySel].caption}
                        placeholder={loc ? draft.gallery[gallerySel].caption : 'Pl. A pult és a váróterem'}
                        onChange={(e) => {
                          if (loc) setLoc({ captions: draft.gallery.map((_, x) => (x === gallerySel ? e.target.value : loc.captions[x] ?? '')) })
                          else set('gallery', draft.gallery.map((g, x) => (x === gallerySel ? { ...g, caption: e.target.value } : g)))
                        }} />
                    </KitField>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button variant="cell" size="sm" icon={ChevronLeft} disabled={gallerySel === 0} onClick={() => moveGallery(gallerySel, -1)}>Előbbre</Button>
                      <Button variant="cell" size="sm" icon={ChevronRight} disabled={gallerySel >= draft.gallery.length - 1} onClick={() => moveGallery(gallerySel, 1)}>Hátrébb</Button>
                      <Button variant="cell" size="sm" icon={Trash2} onClick={() => { set('gallery', draft.gallery.filter((_, x) => x !== gallerySel)); setGallerySel(Math.max(0, gallerySel - 1)) }}>Törlés</Button>
                    </div>
                  </EditorGroup>
                </div>
              )}
            </div>
          )}

          {/* ── Értékelések: a borítón; kattintásra a vélemények ── */}
          {shown('reviewsPart') && (
            <div>
              <EditorRow label="Értékelés a borítón"><Switch checked={draft.page.showRating} onChange={(v) => setPage({ showRating: v })} ariaLabel="Értékelés a borítón" /></EditorRow>
              <EditorRow label="Kattintásra megnyitja" hint="a Google-véleményeket, új lapon"><Switch checked={draft.page.ratingOpens} onChange={(v) => setPage({ ratingOpens: v })} ariaLabel="Kattintásra megnyitja" /></EditorRow>
            </div>
          )}

          {/* ── Közösségi: a borítón (a linkek alább, a kapcsolat-adatokkal) ── */}
          {shown('socialPart') && (
            <EditorRow label="A borítón" hint="a linkek ikonként, az értékelés mellett"><Switch checked={draft.page.showSocial} onChange={(v) => setPage({ showSocial: v })} ariaLabel="Közösségi linkek a borítón" /></EditorRow>
          )}

          {/* ── Foglalás gomb: felirat (nyelvenként), „Legközelebb szabad”, előleg-jelzés ── */}
          {shown('cta') && (
            <div>
              <KitField label="Felirat" hint={`Üresen: „${isRestaurant ? 'Asztalfoglalás' : 'Időpontfoglalás'}”. Minden nyelvre külön — a Közzététel-sávban váltható.${lang !== 'hu' ? ` (${LOCALE_LABELS[lang]})` : ''}`}>
                <Input size="sm" maxLength={24} value={loc ? loc.ctaLabel : draft.page.ctaLabel ?? ''} placeholder={loc ? draft.page.ctaLabel ?? '' : isRestaurant ? 'Asztalfoglalás' : 'Időpontfoglalás'}
                  onChange={(e) => (loc ? setLoc({ ctaLabel: e.target.value }) : setPage({ ctaLabel: e.target.value || null }))} />
              </KitField>
              <div className="mt-2">
                <EditorRow label="Márkaszín" hint="gomb, kiválasztott sor, időpont"><Swatches fills={ACCENTS} on={ACCENTS.indexOf(accentHex)} onSelect={(i) => setPage({ accent: i === 0 ? null : ACCENTS[i] })} /></EditorRow>
                <EditorRow label="Betűszín a gombon" hint={draft.page.buttonTextColor ? 'a kijelöltre kattintva: magától' : 'magától (a márkaszínhez igazodik)'}><ButtonTextSwatches value={draft.page.buttonTextColor} accent={accentHex} onChange={(v) => setPage({ buttonTextColor: v })} /></EditorRow>
                <EditorRow label="Legközelebb szabad" hint="a gomb mellett, a legkorábbi szabad időponttal"><Switch checked={draft.page.ctaNextFree} onChange={(v) => setPage({ ctaNextFree: v })} ariaLabel="Legközelebb szabad" /></EditorRow>
              </div>
            </div>
          )}

          {/* ── Szolgáltatások (szalon): kategória-szűrő, képek, ár · időtartam, és melyik látszik ── */}
          {shown('servicesPart') && !isRestaurant && (
            <div>
              <EditorRow label="Kategória-szűrő"><Switch checked={draft.page.servicesFilter} onChange={(v) => setPage({ servicesFilter: v })} ariaLabel="Kategória-szűrő" /></EditorRow>
              <EditorRow label="Képek"><Switch checked={draft.page.servicesImages} onChange={(v) => setPage({ servicesImages: v })} ariaLabel="Képek" /></EditorRow>
              <EditorRow label="Ár · időtartam"><Switch checked={draft.page.servicesPrice} onChange={(v) => setPage({ servicesPrice: v })} ariaLabel="Ár és időtartam" /></EditorRow>
              {draft.services.length > 0 && (
                <EditorGroup title="Mely szolgáltatások látszanak">
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {draft.services.map((x) => (
                      <button key={x.id} type="button" aria-pressed={x.visible} onClick={() => set('services', draft.services.map((y) => (y.id === x.id ? { ...y, visible: !y.visible } : y)))} className="ui-press rounded-full">
                        <Pill tone={x.visible ? 'dark' : 'cell'} size="sm">{x.visible && <Check className="h-3 w-3" strokeWidth={2.5} />}{x.name}</Pill>
                      </button>
                    ))}
                  </div>
                </EditorGroup>
              )}
            </div>
          )}

          {/* default nézet (még nincs kijelölve semmi): mennyire kész az oldal, a részek az állapotukkal, megosztás */}
          {!sel && step === 'main' && (
            <EditorOverview parts={overview} onOpen={(id) => selectPart(id)}
              share={<EditorRow label="Link és QR-kód"><span className="flex gap-1.5"><IconButton icon={Link2} label="Link másolása" size="sm" variant="cell" onClick={copyLink} /><Button variant="cell" size="sm" icon={QrCode} onClick={() => selectPart('link')}>QR-kód</Button></span></EditorRow>} />
          )}

          {!sel && step !== 'main' && (
            <div className="space-y-2">
              <p className="text-ui-meta leading-relaxed text-ui-muted">Így halad végig a vendég a foglaláson. Kattints egy elemre az előnézetben a szerkesztéséhez.</p>
              {step === 'details' && (
                <>
                  <div className="pt-1 text-ui-label font-medium text-ui-muted">Űrlap mezői · húzd a sorrendhez</div>
                  {/* a hírlevél-pipa (ha van csomag) és az alkalmak (étterem) is húzható elem — a foglalón ebben a sorrendben */}
                  <Reorder.Group axis="y" values={shownFields} onReorder={(v) => set('fieldOrder', [...v, ...draft.fieldOrder.filter((x) => !v.includes(x))])} className="space-y-2">
                    {shownFields.map((id) => {
                      const selId = id === 'questions' || id === 'newsletter' || id === 'occasions' ? id : `field:${id}`
                      // A cím mező saját, 3-fokozatú szabálya (off/city/full) — előleg aktív
                      // esetén FÜGGETLENÜL mindig 'full'-ra kényszerítjük (számlázáshoz kell).
                      const addressForcedFull = id === 'address' && initial.flags.deposit
                      const effectiveAddressLevel = addressForcedFull ? 'full' : draft.addressDetailLevel
                      const hiddenByChoice = (id === 'phone' || id === 'notes') && draft.hiddenFields.includes(id)
                        || (id === 'address' && effectiveAddressLevel === 'off')
                        || (id === 'newsletter' && !draft.showMarketingConsent)
                      const badge = hiddenByChoice ? 'Kikapcsolva'
                        : id === 'name' || id === 'email' ? 'Kötelező'
                        : id === 'phone' ? (draft.requirePhone ? 'Kötelező' : 'Opcionális')
                        : id === 'address' ? (effectiveAddressLevel === 'city' ? 'Csak város' : draft.requireAddress || addressForcedFull ? 'Kötelező' : 'Opcionális')
                        : id === 'questions' ? `${draft.customQuestions.length} db`
                        : id === 'occasions' ? `${draft.eventTypes.filter((e) => e.enabled).length} db` : 'Opcionális'
                      return (
                        <GripReorderItem key={id} id={id}>
                          <button type="button" onClick={() => selectPart(selId)} className={cn('min-w-0 flex-1 truncate text-left text-ui-body font-medium', hiddenByChoice ? 'text-ui-muted' : 'text-ui-text')}>
                            {ELEMENT_TITLES[selId]}
                          </button>
                          <Pill tone={badge === 'Kötelező' ? 'dark' : 'cell'} size="sm" className="shrink-0">{badge}</Pill>
                        </GripReorderItem>
                      )
                    })}
                  </Reorder.Group>
                </>
              )}
              {(step === 'details'
                // a hírlevél-pipa és az alkalmak a fenti, húzható listában vannak
                ? ([] as const)
                : step === 'datetime' ? (isRestaurant ? (['pax', 'rules'] as const) : (['rules'] as const))
                : step === 'consent' ? (['consent'] as const)
                : step === 'summary' ? (['summary', 'gtk', 'terms'] as const)
                : step === 'success' ? (['confirm'] as const)
                : step === 'deposit' ? (['deposit'] as const)
                : (['sec:voucher'] as const)
              ).map((id) => <Row key={id} label={ELEMENT_TITLES[id]} onClick={() => selectPart(id)} />)}
              {/* Bekapcsoláskor az előnézet RÖGTÖN a nyilatkozat-lépésre ugrik (különben az Adatokon
                  maradva úgy tűnt, mintha meg sem jelenne); szöveg nélkül a lépés nem él → a szövegszerkesztő nyílik. */}
              <ToggleRow
                label="Hozzájáruló nyilatkozat lépés"
                hint={draft.consentEnabled && !draft.consentText.trim() ? 'Nincs még szövege — add meg, különben a lépés nem jelenik meg.' : 'Elfogadása kötelező a foglaláshoz.'}
                warn={draft.consentEnabled && !draft.consentText.trim()}
                checked={draft.consentEnabled}
                onChange={() => {
                  const next = !draft.consentEnabled
                  set('consentEnabled', next)
                  if (next) { if (draft.consentText.trim()) goStep('consent'); else selectPart('consent') }
                }}
                onView={consentOn ? () => goStep('consent') : draft.consentEnabled ? () => selectPart('consent') : undefined}
                viewLabel={consentOn ? 'Megnézem' : 'Szöveg megadása'}
              />
              <ToggleRow
                label="Előleg lépés"
                hint={!initial.flags.stripeOnboarded ? 'A bekapcsoláshoz kösd össze a Stripe-fiókot (Fizetés & számlázás fül).' : !initial.flags.termsFilled ? 'A bekapcsoláshoz töltsd ki a foglalási feltételeket (Dokumentumok & jogi fül).' : 'Az összeget és a visszatérítést az Előleg fülön állítod.'}
                checked={draft.depositEnabled}
                onChange={toggleDeposit}
                onView={depositOn ? () => goStep('deposit') : undefined}
              />
              <ToggleRow
                label="Ajándékutalvány lépés"
                hint={!initial.flags.stripeOnboarded ? 'A bekapcsoláshoz kösd össze a Stripe-fiókot (Fizetés & számlázás fül).' : 'A típusokat és összegeket az Ajándékutalvány fülön állítod.'}
                checked={draft.voucherEnabled}
                onChange={toggleVoucher}
                onView={voucherOn ? () => goStep('voucher') : undefined}
              />
            </div>
          )}

          {!sel && step !== 'main' && (
            <div className="space-y-2 border-t border-ui-divider pt-4">
              <div className="text-ui-label font-medium text-ui-muted">Foglalási szabályok</div>
              {/* a kit listasorai (szaggatott elválasztó), keretes doboz helyett */}
              <div>
                {[...rulesSummary.map((r) => ({ key: r.label, label: r.label, value: r.value, off: r.off, go: () => { setStep(r.step); selectPart(r.sel) } })),
                  { key: 'notif', label: 'Új foglalás értesítés neked', value: 'Értesítések', off: false, go: () => onNavigate?.('notifications') }].map((r) => (
                  <button key={r.key} type="button" onClick={r.go} className="block w-full rounded-ui-inner text-left outline-none transition-colors hover:bg-ui-cell/60 focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                    <ListRow className="px-0" title={r.label} trailing={<span className={cn('flex shrink-0 items-center gap-1 text-ui-meta', r.off ? 'text-ui-muted' : 'text-ui-text')}>{r.value}<ChevronRight className="h-3.5 w-3.5 text-ui-muted" /></span>} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {shown('name') && (
            <>
              <Field label="Üzlet neve"><input className={fieldCls} value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <EditorRow label="A név stílusa">
                <span className="flex gap-1.5">
                  <button type="button" aria-pressed={draft.page.nameBold} onClick={() => setPage({ nameBold: !draft.page.nameBold })} className="ui-press rounded-full"><Pill size="sm" tone={draft.page.nameBold ? 'dark' : 'cell'}>{draft.page.nameBold && <Check className="h-3 w-3" strokeWidth={2.5} />}Félkövér</Pill></button>
                  <button type="button" aria-pressed={draft.page.nameItalic} onClick={() => setPage({ nameItalic: !draft.page.nameItalic })} className="ui-press rounded-full"><Pill size="sm" tone={draft.page.nameItalic ? 'dark' : 'cell'}>{draft.page.nameItalic && <Check className="h-3 w-3" strokeWidth={2.5} />}Dőlt</Pill></button>
                </span>
              </EditorRow>
              <EditorRow label="A név színe" hint="a fotón csak olvasható szín"><TextToneSwatches value={draft.page.nameColor ?? 'white'} accent={accentHex} bg={DARK_BG} onChange={(v) => setPage({ nameColor: v === 'white' ? null : v })} /></EditorRow>
            </>
          )}

          {shown('address') && (
            <>
              <Field label="Cím"><input className={fieldCls} value={draft.address} placeholder="Utca, házszám" onChange={(e) => set('address', e.target.value)} /></Field>
              <EditorRow label="A cím színe" hint="a fotón csak olvasható szín"><TextToneSwatches value={draft.page.addressColor ?? 'soft'} accent={accentHex} bg={DARK_BG} onChange={(v) => setPage({ addressColor: v === 'soft' ? null : v })} /></EditorRow>
              {isRestaurant ? (
                <Field label="Város"><input className={fieldCls} value={draft.city} onChange={(e) => set('city', e.target.value)} /></Field>
              ) : (
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <Field label="Irányítószám"><input className={fieldCls} value={draft.postalCode} onChange={(e) => set('postalCode', e.target.value)} /></Field>
                  <Field label="Város"><input className={fieldCls} value={draft.city} onChange={(e) => set('city', e.target.value)} /></Field>
                </div>
              )}
            </>
          )}

          {shown('desc') && (
            <Field label={`Leírás (${LOCALE_LABELS[lang]})`} hint="A foglalóoldalon az első 160 karakter látszik.">
              <AutoGrowTextarea
                rows={3}
                className={cn(fieldCls, 'leading-relaxed')}
                value={loc ? loc.description : draft.description}
                placeholder={loc ? draft.description : undefined}
                onChange={(e) => (loc ? setLoc({ description: e.target.value }) : set('description', e.target.value))}
              />
            </Field>
          )}
          {shown('desc') && (
            <div>
              <EditorRow label="Szöveg színe" hint="a fotón csak olvasható szín"><TextToneSwatches value={draft.page.descColor ?? 'soft'} accent={accentHex} bg={DARK_BG} onChange={(v) => setPage({ descColor: v === 'soft' ? null : v })} /></EditorRow>
              <EditorRow label="Betűméret"><Segmented tone="cell" size="sm" options={['Kicsi', 'Normál', 'Nagy']} active={['sm', 'md', 'lg'].indexOf(draft.page.descSize)} onSelect={(i) => setPage({ descSize: (['sm', 'md', 'lg'] as const)[i] })} /></EditorRow>
              <EditorRow label="Mobilon"><Segmented tone="cell" size="sm" options={['2 sor', 'Teljes']} active={draft.page.descFullMobile ? 1 : 0} onSelect={(i) => setPage({ descFullMobile: i === 1 })} /></EditorRow>
              <p className="mt-2 text-ui-label text-ui-muted">A szöveget az oldalon is írhatod: kijelölve félkövér, dőlt és link a sávon.</p>
            </div>
          )}

          {/* ── Köszönő cím (a foglalás után, Kész lépés): saját szöveg nyelvenként és színe ── */}
          {shown('successTitle') && (
            <div>
              <KitField label={`Felirat (${LOCALE_LABELS[lang]})`} hint="Üresen: az alap („Lefoglaltuk!”). Az oldalon is írhatod.">
                <Input size="sm" maxLength={60} value={loc ? loc.successTitle : draft.page.successTitle ?? ''} placeholder={loc ? draft.page.successTitle ?? '' : 'Lefoglaltuk!'}
                  onChange={(e) => (loc ? setLoc({ successTitle: e.target.value }) : setPage({ successTitle: e.target.value || null }))} />
              </KitField>
              <div className="mt-2"><EditorRow label="Szöveg színe" hint="a kártyán csak olvasható szín"><TextToneSwatches value={draft.page.successTitleColor ?? 'white'} accent={accentHex} bg={draft.page.card === 'white' ? '#FFFFFF' : DARK_BG} onChange={(v) => setPage({ successTitleColor: v === 'white' ? null : v })} /></EditorRow></div>
            </div>
          )}

          {shown('cover') && (
            <>
              <ImagePicker
                url={draft.coverUrl}
                busy={uploading === 'cover'}
                onPick={(f) => upload('cover', f)}
                onRemove={() => setDraft((d) => ({ ...d, coverId: null, coverUrl: null }))}
                tall
              />
              {draft.coverUrl && (
                <>
                  <p className="text-ui-label leading-relaxed text-ui-muted">
                    {device === 'mobile'
                      ? 'Mobil fókusz — telefonon álló a kivágás, ezért külön állítható. Asztali nézetben a desktop fókuszt állítod.'
                      : 'Asztali fókusz. Telefonra külön fókuszpont adható: válts mobil nézetre.'}
                  </p>
                  {device === 'mobile' ? (
                    <>
                      <Slider label="Fókusz vízszintesen (mobil)" value={draft.coverFocalMobileX ?? draft.coverFocalX} min={0} max={100} onChange={(v) => set('coverFocalMobileX', v)} />
                      <Slider label="Fókusz függőlegesen (mobil)" value={draft.coverFocalMobileY ?? draft.coverFocalY} min={0} max={100} onChange={(v) => set('coverFocalMobileY', v)} />
                    </>
                  ) : (
                    <>
                      <Slider label="Fókusz vízszintesen" value={draft.coverFocalX} min={0} max={100} onChange={(v) => set('coverFocalX', v)} />
                      <Slider label="Fókusz függőlegesen" value={draft.coverFocalY} min={0} max={100} onChange={(v) => set('coverFocalY', v)} />
                    </>
                  )}
                  <Slider label="Nagyítás" value={Math.round(draft.coverZoom * 100)} min={100} max={200} suffix="%" onChange={(v) => set('coverZoom', v / 100)} />
                </>
              )}
            </>
          )}

          {/* Arculat (design 24.1–24.2): a LOGÓ és az IKON — mindkettő a feltöltött alakjában; a fejléc képe (logó / ikon),
              a logó mérete, és hogy a levelekben melyik jelenjen meg. A kép mindenhol változatlan alakú (nem vágjuk). */}
          {shown('logo') && (
            <div className="space-y-3">
              <EditorRow label="Logó" hint="széles helyekre — a fejléc, a levelek, a hírlevél">
                <ImagePicker url={draft.logoUrl} busy={uploading === 'logo'} onPick={(f) => upload('logo', f)} onRemove={() => setDraft((d) => ({ ...d, logoId: null, logoUrl: null }))} />
              </EditorRow>
              <EditorRow label="Ikon" hint="kicsi helyekre — utalvány, QR-kód, vezérlőpult (négyzetes ajánlott)">
                <ImagePicker url={draft.iconUrl} busy={uploading === 'icon'} onPick={(f) => upload('icon', f)} onRemove={() => setDraft((d) => ({ ...d, iconId: null, iconUrl: null }))} />
              </EditorRow>
              <EditorRow label="A fejlécben" hint={draft.brandPage === 'icon' && !draft.iconUrl ? 'nincs ikon — a logót használjuk' : undefined}>
                <BrandPicker value={draft.brandPage} logo={draft.logoUrl} icon={draft.iconUrl} onChange={(v) => setDraft((d) => ({ ...d, brandPage: v === 'icon' ? 'icon' : 'logo' }))} />
              </EditorRow>
              <EditorRow label="Méret" hint="a fejlécben és a levelekben — csak a magasság változik">
                <Segmented size="sm" tone="cell" options={['S', 'M', 'L']} active={['sm', 'md', 'lg'].indexOf(draft.brandLogoSize)} onSelect={(i) => setDraft((d) => ({ ...d, brandLogoSize: (['sm', 'md', 'lg'] as const)[i] }))} />
              </EditorRow>
              <EditorRow label="A levelekben" hint={draft.brandEmail === 'icon' && !draft.iconUrl ? 'nincs ikon — a logót használjuk' : 'vendég- és csapatlevelek, vendég-oldalak'}>
                <BrandPicker value={draft.brandEmail} logo={draft.logoUrl} icon={draft.iconUrl} onChange={(v) => setDraft((d) => ({ ...d, brandEmail: v === 'icon' ? 'icon' : 'logo' }))} />
              </EditorRow>
            </div>
          )}

          {shown('link') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">Ezen a linken tudnak a vendégek online időpontot foglalni.</p>
              <div className="flex gap-2">
                <code className="flex h-11 min-w-0 flex-1 items-center truncate rounded-ui-control border border-ui-divider bg-white px-3 text-ui-meta text-ui-text">{publicUrl}</code>
                <a href={`/${baseline.slug}`} target="_blank" rel="noopener noreferrer" className="flex h-11 shrink-0 items-center rounded-full border border-ui-divider bg-white px-4 text-ui-meta font-medium text-ui-text">Megnyitás</a>
              </div>
              {/* az URL azonosító (slug) itt NEM módosítható — átírva minden régi link, QR-kód és e-mail elromlana */}
              {/* a QR-kód közepe (design 24.2): ikon (alap) / logó / nincs — a nyomtatható QR-kártya és az utalvány QR-kódja is ezt követi */}
              <EditorRow label="A QR-kód közepén" hint={draft.brandQr === 'icon' && !draft.iconUrl ? 'nincs ikon — a logót használjuk' : 'a nyomtatható QR-kártyán és az utalványon'}>
                <BrandPicker none value={draft.brandQr} logo={draft.logoUrl} icon={draft.iconUrl} onChange={(v) => setDraft((d) => ({ ...d, brandQr: v }))} />
              </EditorRow>
              <BusinessQrLauncher url={publicUrl} businessName={draft.name} restaurant={isRestaurant} logoUrl={draft.brandQr === 'none' ? null : draft.brandQr === 'icon' ? draft.iconUrl ?? draft.logoUrl : draft.logoUrl ?? draft.iconUrl} hours={initial.hours ?? []} socialLinks={draft.socialLinks} />
            </>
          )}

          {shown('counts') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">A foglalóoldal tetején, középen (mobilon a logó alatt).</p>
              <EditorRow label={isRestaurant ? 'Asztalok száma' : 'Szolgáltatások száma'}><Switch checked={draft.showServiceCount} onChange={(v) => set('showServiceCount', v)} ariaLabel={isRestaurant ? 'Asztalok száma' : 'Szolgáltatások száma'} /></EditorRow>
              <EditorRow label={isRestaurant ? 'Férőhely' : 'Munkatársak száma'}><Switch checked={draft.showStaffCount} onChange={(v) => set('showStaffCount', v)} ariaLabel={isRestaurant ? 'Férőhely' : 'Munkatársak száma'} /></EditorRow>
            </>
          )}

          {/* Nyelvek (design 21.6 Fejléc): pillek pipával — a magyar mindig él; a szerkesztés nyelve a Közzététel-sávban vált */}
          {shown('langs') && (
            <EditorRow label="Nyelvek" hint="a vendég ezek közül választ; hiányzó fordításnál a magyar látszik">
              <span className="flex flex-wrap justify-end gap-1.5">
                {LOCALES.map((code) => {
                  const on = code === 'hu' || draft.supportedLocales.includes(code)
                  const pill = <Pill tone={on ? 'dark' : 'cell'} size="sm">{on && <Check className="h-3 w-3" strokeWidth={2.5} />}{code.toUpperCase()}</Pill>
                  return code === 'hu' ? <span key={code} title="Az alap nyelv — mindig elérhető">{pill}</span> : (
                    <button key={code} type="button" aria-pressed={on} title={LOCALE_LABELS[code]} className="ui-press rounded-full"
                      onClick={() => set('supportedLocales', LOCALES.filter((l) => l !== 'hu' && (l === code ? !on : draft.supportedLocales.includes(l))))}>{pill}</button>
                  )
                })}
              </span>
            </EditorRow>
          )}

          {shown('contact') && (
            <>
              <Field label="Telefon"><input className={fieldCls} value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="E-mail"><input className={fieldCls} value={draft.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Weboldal"><input className={fieldCls} value={draft.website} onChange={(e) => set('website', e.target.value)} /></Field>
              <Field group label="Közösségi linkek" hint="Csak illeszd be a linket — az ikont felismerjük.">
                <SocialLinksEditor value={draft.socialLinks} onChange={(v) => set('socialLinks', v)} inputClassName={fieldCls} />
              </Field>
            </>
          )}

          {shown('sec:services') && (
            <>
              <ToggleRow label="Kibontva a főnézeten" hint="Rögtön látszik a teljes katalógus, külön gomb nélkül." checked={draft.servicesExpandedOnMain} onChange={() => set('servicesExpandedOnMain', !draft.servicesExpandedOnMain)} />
              <LinkButton href="/dashboard/services">Szolgáltatások és árak</LinkButton>
            </>
          )}

          {shown('sec:staff') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">Kattints egy munkatársra a bemutatkozása és a közösségi linkjei szerkesztéséhez. Csak azok látszanak, akikhez legalább egy szolgáltatás tartozik.</p>
              <div className="space-y-2">
                {draft.staff.map((m) => <Row key={m.id} label={m.name} onClick={() => selectPart(`staff:${m.id}`)} />)}
              </div>
              <LinkButton href="/dashboard/staff">Munkatársak kezelése</LinkButton>
            </>
          )}

          {member && (
            <>
              <Field label="Név"><input className={fieldCls} value={member.name} onChange={(e) => setStaff(member.id, { name: e.target.value })} /></Field>
              <ToggleRow label="Pozíció megjelenítése" hint="A foglalásnál a név alatt." checked={member.show_role_title} onChange={() => setStaff(member.id, { show_role_title: !member.show_role_title })} />
              <Field label="Titulus"><input className={fieldCls} value={member.role_title} onChange={(e) => setStaff(member.id, { role_title: e.target.value })} /></Field>
              <Field label={`Bemutatkozás (${LOCALE_LABELS[lang]})`} hint="Foglaláskor a kiválasztott szakember csíkjára koppintva kinyílik.">
                <AutoGrowTextarea
                  rows={3}
                  className={cn(fieldCls, 'leading-relaxed')}
                  value={loc ? loc.staffBio[member.id] ?? '' : member.bio}
                  placeholder={loc ? member.bio : undefined}
                  onChange={(e) => (loc ? setLoc({ staffBio: { ...loc.staffBio, [member.id]: e.target.value } }) : setStaff(member.id, { bio: e.target.value }))}
                />
              </Field>
              <Field group label="Közösségi linkek">
                <SocialLinksEditor value={member.social_links} onChange={(v) => setStaff(member.id, { social_links: v })} inputClassName={fieldCls} />
              </Field>
              <LinkButton href="/dashboard/staff">Munkaidő, szolgáltatások, min. foglalási idő</LinkButton>
            </>
          )}

          {shown('gtk') && (
            <GoodToKnowEditor
              value={loc ? loc.goodToKnow : draft.goodToKnow}
              onChange={(v) => (loc ? setLoc({ goodToKnow: v }) : set('goodToKnow', v))}
              locale={lang}
            />
          )}

          {shown('sec:voucher') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">Az utalvány beállításai (összegek, típusok, céges vásárlás) az Ajándékutalvány fülön vannak.</p>
              <NavButton onClick={() => onNavigate?.('vouchers')}>Ajándékutalvány beállításai</NavButton>
            </>
          )}

          {shown('rules') && (
            <>
              <Field label={draft.windowPeriodic ? 'Egy időszak hossza' : 'Foglalható napok előre'} hint={draft.windowPeriodic ? 'Ennyi nap nyílik meg egyszerre.' : 'Naponta automatikusan tovább gördül.'}>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" min={1} max={365} className={cn(fieldCls, 'w-24 text-center')} value={draft.bookingWindowDays}
                    onChange={(e) => set('bookingWindowDays', Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
                  <span className="text-ui-meta text-ui-muted">nap</span>
                </div>
              </Field>
              <Chips options={[30, 60, 90, 180].map((v) => ({ label: `${v} nap`, on: draft.bookingWindowDays === v, onClick: () => set('bookingWindowDays', v) }))} />
              <Field group label="Megnyitás módja" hint={draft.windowPeriodic ? 'Egyszerre egy időszak nyílik meg; lejárat előtt 7 nappal értesítést kapsz.' : 'Mindig a következő napok foglalhatók, nincs lejárat.'}>
                <Chips options={[
                  { label: 'Folyamatos', on: !draft.windowPeriodic, onClick: () => set('windowPeriodic', false) },
                  { label: 'Időszakonként', on: draft.windowPeriodic, onClick: () => setDraft((d) => ({ ...d, windowPeriodic: true, windowEnd: d.windowEnd ?? periodEndFrom({ booking_window_days: d.bookingWindowDays }, budapestToday()) })) },
                ]} />
              </Field>
              {draft.windowPeriodic && (
                <div className="space-y-3 rounded-ui-inner bg-black/[0.03] p-3.5">
                  <p className="text-ui-meta leading-relaxed text-ui-muted">
                    {draftWindowEnd
                      ? <>Jelenlegi időszak: <b className="font-medium text-ui-text">ma – {huDate(draftWindowEnd)}</b> (még {daysBetween(budapestToday(), draftWindowEnd) + 1} nap).</>
                      : <>Az időszak lejárt — a vendégek most nem tudnak foglalni.</>}
                  </p>
                  <ToggleRow label="Automatikus megújítás" hint={`Lejáratkor újabb ${draft.bookingWindowDays} nap nyílik meg.`} checked={draft.windowAutoRenew} onChange={() => set('windowAutoRenew', !draft.windowAutoRenew)} />
                  <button type="button" onClick={() => set('windowEnd', periodEndFrom({ booking_window_days: draft.bookingWindowDays }, budapestToday()))}
                    className="h-9 rounded-full border border-ui-divider bg-white px-4 text-ui-meta font-medium text-ui-text">
                    Új időszak indítása mától
                  </button>
                </div>
              )}
              {isRestaurant ? (
                <>
                  <Field group label="Foglalás hossza" hint="Ennyi ideig tartja a foglalás az asztalt.">
                    <Chips options={[60, 90, 120, 150, 180].map((v) => ({ label: `${v} perc`, on: draft.turnMinutes === v, onClick: () => set('turnMinutes', v) }))} />
                  </Field>
                  <Field group label="Időpont-lépték" hint="Milyen sűrűn kínálunk kezdő időpontot.">
                    <Chips options={[15, 30, 60].map((v) => ({ label: `${v} perc`, on: draft.slotStepMinutes === v, onClick: () => set('slotStepMinutes', v) }))} />
                  </Field>
                  <Field group label="Utolsó foglalás zárás előtt" hint="0 = zárásig lehet kezdeni (a foglalás belelóghat a zárásba).">
                    <Chips options={[0, 30, 60, 90, 120].map((v) => ({ label: v ? `${v} perc` : 'Zárásig', on: draft.lastSeatingMinutes === v, onClick: () => set('lastSeatingMinutes', v) }))} />
                  </Field>
                </>
              ) : (
                <Field group label="Szünet a foglalások között" hint="A szabad időpontok a mentés után igazodnak hozzá.">
                  <Chips options={[0, 5, 10, 15, 30].map((v) => ({ label: v ? `${v} perc` : 'Nincs', on: draft.bufferMinutes === v, onClick: () => set('bufferMinutes', v) }))} />
                </Field>
              )}
              <Field group label="Minimum idő a foglalás előtt" hint={isRestaurant ? 'Ennél korábbra nem lehet asztalt foglalni.' : 'Alapértelmezés — munkatársanként felülírható.'}>
                <Chips options={[[null, 'Nincs'], [1, '1 óra'], [2, '2 óra'], [4, '4 óra'], [24, '1 nap']].map(([v, label]) => ({ label: label as string, on: (draft.minLeadHours || null) === v, onClick: () => set('minLeadHours', v as number | null) }))} />
              </Field>
              {isRestaurant
                ? <LinkButton href={`${adminBase}/availability`}>Nyitvatartás</LinkButton>
                : <LinkButton href="/dashboard/staff">Munkatársankénti beállítások</LinkButton>}
            </>
          )}

          {shown('confirm') && (
            <>
              <ToggleRow
                label="Automatikus megerősítés"
                hint={autoConfirmBlocked
                  ? 'Előleg mellett nem kapcsolható ki: az előleggel fizetett foglalás mindig azonnal megerősített. Kikapcsoláshoz előbb az előleget kell kikapcsolni.'
                  : 'Kikapcsolva te hagyod jóvá; a vendég „beérkezett” üzenetet lát.'}
                warn={autoConfirmBlocked}
                checked={draft.autoConfirm || depositOn}
                onChange={toggleAutoConfirm}
                onView={autoConfirmBlocked ? () => onNavigate?.('deposit') : undefined}
                viewLabel="Előleg beállításai"
              />
              <ToggleRow label="Visszaigazoló e-mail a vendégnek" hint={draft.autoConfirm ? 'Azonnal a foglalás után.' : 'Amikor jóváhagyod.'} checked={draft.confirmEmail} onChange={() => set('confirmEmail', !draft.confirmEmail)} />
              <div className="border-t border-ui-divider pt-4">
                <ToggleRow label="Automata emlékeztetők" hint="A foglalás előtt." checked={draft.reminders.on} onChange={() => setRem({ on: !draft.reminders.on })} />
              </div>
              {draft.reminders.on && (
                <>
                  <Field group label="Időzítés a foglalás előtt">
                    <Chips options={REMINDER_CHIPS.map(([k, label]) => ({ label, on: draft.reminders[k], onClick: () => setRem({ [k]: !draft.reminders[k] }) }))} />
                  </Field>
                </>
              )}
              <NavButton onClick={() => onNavigate?.('email')}>E-mail sablonok</NavButton>
              <p className="rounded-ui-control bg-black/[0.03] px-3.5 py-3 text-ui-meta leading-relaxed text-ui-muted">Az új foglalásról neked szóló értesítést az Értesítések között állítod.</p>
            </>
          )}

          {(shown('field:name') || shown('field:email')) && (
            <p className="text-ui-meta leading-relaxed text-ui-muted">{sel === 'field:name' ? 'A név mindig kötelező.' : 'Az e-mail mindig kötelező — ide megy a visszaigazolás és az emlékeztető.'}</p>
          )}
          {shown('field:phone') && (
            <>
              <ToggleRow
                label="Mező megjelenítése"
                hint={draft.hiddenFields.includes('phone') ? undefined : 'Kikapcsolva a telefonszám egyáltalán nem jelenik meg a foglaló űrlapon.'}
                checked={!draft.hiddenFields.includes('phone')}
                onChange={() => set('hiddenFields', draft.hiddenFields.includes('phone') ? draft.hiddenFields.filter((f) => f !== 'phone') : [...draft.hiddenFields, 'phone'])}
              />
              {!draft.hiddenFields.includes('phone') && (
                <ToggleRow label="Kötelező kitölteni" checked={draft.requirePhone} onChange={() => set('requirePhone', !draft.requirePhone)} />
              )}
            </>
          )}
          {shown('field:address') && (() => {
            const addressForcedFull = initial.flags.deposit
            const effectiveAddressLevel = addressForcedFull ? 'full' : draft.addressDetailLevel
            return (
              <>
                <div className="space-y-1.5">
                  <div className="text-ui-body font-medium text-ui-text">Mennyit kérjünk be?</div>
                  {addressForcedFull ? (
                    <p className="text-ui-label leading-relaxed text-ui-muted">Előleg aktív — a számlázáshoz a teljes cím (város + utca, házszám) mindig kötelező, nem állítható vissza.</p>
                  ) : (
                    <Chips options={[
                      { label: 'Kikapcsolva', on: draft.addressDetailLevel === 'off', onClick: () => set('addressDetailLevel', 'off') },
                      { label: 'Csak város', on: draft.addressDetailLevel === 'city', onClick: () => set('addressDetailLevel', 'city') },
                      { label: 'Város + pontos cím', on: draft.addressDetailLevel === 'full', onClick: () => set('addressDetailLevel', 'full') },
                    ]} />
                  )}
                </div>
                {effectiveAddressLevel === 'full' && (
                  <>
                    <ToggleRow label="Cím megadása mindig kötelező" hint={addressForcedFull ? 'Előleg mellett mindenképp kötelező.' : undefined} checked={draft.requireAddress || addressForcedFull} disabled={addressForcedFull} onChange={() => set('requireAddress', !draft.requireAddress)} />
                    {(draft.requireAddress || addressForcedFull) && (
                      <Field label="Miért kéred? (a vendég látja a mező alatt)">
                        <input className={fieldCls} value={draft.requireAddressNote} placeholder="Pl. a házhoz menő szolgáltatáshoz kell" onChange={(e) => set('requireAddressNote', e.target.value)} />
                      </Field>
                    )}
                  </>
                )}
              </>
            )
          })()}
          {shown('field:notes') && (
            <ToggleRow
              label="Mező megjelenítése"
              hint={draft.hiddenFields.includes('notes') ? undefined : 'Szabad szöveges megjegyzés a vendégtől — mindig opcionális, ha megjelenik.'}
              checked={!draft.hiddenFields.includes('notes')}
              onChange={() => set('hiddenFields', draft.hiddenFields.includes('notes') ? draft.hiddenFields.filter((f) => f !== 'notes') : [...draft.hiddenFields, 'notes'])}
            />
          )}

          {shown('questions') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">Saját kérdések az Adatok lépésen ({LOCALE_LABELS[lang]}).</p>
              {loc ? (
                <CustomQuestionsEditor
                  value={loc.customQuestions.length === draft.customQuestions.length ? loc.customQuestions : draft.customQuestions.map((q) => ({ ...q, label: '', options: q.options.map(() => ({ value: '' })) }))}
                  onChange={(v) => setLoc({ customQuestions: v })}
                />
              ) : (
                <CustomQuestionsEditor value={draft.customQuestions} onChange={(v) => set('customQuestions', v)} />
              )}
            </>
          )}

          {shown('consent') && (
            <>
              <ToggleRow label="Nyilatkozat bekérése" hint="Külön lépés; elfogadása kötelező." checked={draft.consentEnabled} onChange={() => set('consentEnabled', !draft.consentEnabled)} />
              <Field label={`Cím (${LOCALE_LABELS[lang]})`}>
                <input className={fieldCls} value={loc ? loc.consentTitle : draft.consentTitle} placeholder={loc ? draft.consentTitle : 'Hozzájáruló nyilatkozat'}
                  onChange={(e) => (loc ? setLoc({ consentTitle: e.target.value }) : set('consentTitle', e.target.value))} />
              </Field>
              <Field label="Szöveg">
                <AutoGrowTextarea rows={4} className={cn(fieldCls, 'leading-relaxed')} value={loc ? loc.consentText : draft.consentText} placeholder={loc ? draft.consentText : undefined}
                  onChange={(e) => (loc ? setLoc({ consentText: e.target.value }) : set('consentText', e.target.value))} />
              </Field>
            </>
          )}

          {shown('deposit') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">Előleg: <b className="text-ui-text">{initial.flags.depositLabel}</b>. Az összeget és a visszatérítést az Előleg fülön állítod.</p>
              <NavButton onClick={() => onNavigate?.('deposit')}>Előleg beállításai</NavButton>
            </>
          )}

          {shown('terms') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">A foglalási feltételek szakaszait (lemondás, késés, adatkezelés) a Dokumentumok & jogi fülön szerkesztheted.</p>
              <NavButton onClick={() => onNavigate?.('documents')}>Foglalási feltételek</NavButton>
            </>
          )}

          {shown('newsletter') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">A hírlevél-feliratkozás minden csomagban be van kapcsolva — a vendég az Adatok lépésen iratkozhat fel.</p>
              <ToggleRow
                label="Feliratkozó checkbox megjelenítése"
                hint={draft.showMarketingConsent ? 'A vendég az Adatok lépésen látja és pipálhatja.' : 'Kikapcsolva a checkbox nem jelenik meg — senki nem iratkozhat fel a foglalás közben.'}
                checked={draft.showMarketingConsent}
                onChange={() => set('showMarketingConsent', !draft.showMarketingConsent)}
              />
              <NavButton onClick={() => onNavigate?.('newsletter')}>Hírlevél</NavButton>
            </>
          )}

          {shown('summary') && <p className="text-ui-meta leading-relaxed text-ui-muted">Az összegzés a vendég választásaiból és adataiból áll össze — nincs mit szerkeszteni rajta.</p>}

          {shown('redeem') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">Csak akkor látszik, ha az ajándékutalvány be van kapcsolva.</p>
              <NavButton onClick={() => onNavigate?.('vouchers')}>Ajándékutalvány beállításai</NavButton>
            </>
          )}

          {shown('pax') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">A legnagyobb foglalható létszám az asztalaidból jön: most <b className="text-ui-text">{initial.maxPax} fő</b>.</p>
              <LinkButton href={`${adminBase}/tables`}>Asztalok kezelése</LinkButton>
            </>
          )}

          {shown('occasions') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">Milyen alkalomból foglalhat a vendég ({LOCALE_LABELS[lang]}). Kikapcsolva nem jelenik meg; ha mind ki van kapcsolva, az alapkészlet látszik.</p>
              {loc ? (
                <div className="space-y-2">
                  {draft.eventTypes.map((e, i) => (
                    <input
                      key={i}
                      className={fieldCls}
                      value={loc.eventTypeLabels[i] ?? ''}
                      placeholder={e.label}
                      onChange={(ev) => setLoc({ eventTypeLabels: draft.eventTypes.map((_, x) => (x === i ? ev.target.value : loc.eventTypeLabels[x] ?? '')) })}
                    />
                  ))}
                </div>
              ) : (
                <EventTypesEditor value={draft.eventTypes} onChange={(v) => set('eventTypes', v)} />
              )}
            </>
          )}

          {shown('sec:slots') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">A legközelebbi szabad időpontok és a nyitvatartás a beállított nyitvatartásból és az asztalokból számolódnak.</p>
              <LinkButton href={`${adminBase}/availability`}>Nyitvatartás</LinkButton>
            </>
          )}

          {shown('sec:reviews') && (
            <>
              <p className="text-ui-meta leading-relaxed text-ui-muted">A megjelenő értékelések az összekapcsolt Google-profilból jönnek.</p>
              <NavButton onClick={() => onNavigate?.('google')}>Google-profil</NavButton>
            </>
          )}
          </motion.div>
          </AnimatePresence>
          {part?.note && <div className="border-t border-dashed border-ui-divider pt-3 text-ui-label text-ui-muted">{part.note}</div>}
        </motion.aside>
        )}
        </AnimatePresence>
      </div>
      </div>
      <PopupModal open={exitAsk} onClose={() => setExitAsk(false)} panel={exitAsk ? (
        <Modal size="sm" title="Kilépsz a szerkesztőből?" subtitle={`${changes} módosítás még nincs közzétéve — a vendégek még a korábbi oldalt látják.`} onClose={() => setExitAsk(false)}
          footer={<>
            <Button variant="ghost" className="mr-auto text-ui-bad" onClick={exitDiscard}>Elvetés és kilépés</Button>
            <Button variant="cell" onClick={() => setExitAsk(false)}>Mégse</Button>
            <Button variant="yellow" loading={publishing} onClick={() => void exitPublish()}>Közzététel és kilépés</Button>
          </>}>
          <p className="text-ui-body text-ui-muted">Közzététellel a módosítások azonnal megjelennek a foglalóoldalon. Elvetéssel a legutóbbi közzétett állapot marad.</p>
        </Modal>
      ) : undefined} />

      {/* alul lebeg: visszavonás, nyelv, módosítások, Közzététel — csak ha van mit közzétenni (felcsúszik, mint a lapok) */}
      <AnimatePresence>
        {(changes > 0 || publishing) && (
          <motion.div variants={SHEET_MOBILE} initial="hidden" animate="show" exit="exit" className="pointer-events-none fixed inset-x-0 bottom-5 z-[92] flex justify-center px-3">
            <div className="pointer-events-auto max-w-full">
              <EditorPublishBar compact={narrow} onClose={exit} onUndo={undo} onRedo={redo} canUndo={past.length > 0} canRedo={future.length > 0}
                langs={languages.map((l) => ({ code: l, active: l === lang }))} onLang={(l) => void selectLang(l as Locale)}
                changes={changes} onPublish={() => void publish()} busy={publishing || langLoading} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

/* ── Panel-építőkockák ── */

/** Felirat + mező. `group`: gombcsoportnál (chipek, link-lista) `div`, hogy a feliratra
 *  kattintás ne „nyomja meg” az első gombot (a `<label>` azt tenné). */
/** `Reorder.Item`, de a húzás KIZÁRÓLAG a bal szélen lévő fogantyú-ikonról indul
 *  (`dragListener={false}` + `dragControls`) — ha a teljes sor húzható lenne, mobilon egy
 *  függőleges swipe a listán BÁRHOL húzásnak (nem lapgörgetésnek) minősülne, és lehetetlenné
 *  tenné a normál görgetést a Foglalóoldal-szerkesztőben. */
function GripReorderItem({ id, children }: { id: string; children: ReactNode }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className="flex min-h-11 items-center gap-2 rounded-ui-control bg-ui-cell pl-2.5 pr-1.5">
      <span onPointerDown={(e) => controls.start(e)} className="-ml-1 flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-ui-muted" />
      </span>
      {children}
    </Reorder.Item>
  )
}

/** Önmagát a tartalomhoz igazító textarea — sosem görgetős belül, a doboz nő/zsugorodik
 *  gépeléskor (és nyelv-váltáskor is, mert a `value` külsőleg is változhat). */
function AutoGrowTextarea({ className, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return <textarea ref={ref} value={value} className={className} {...rest} />
}

/** Felirat + mező (a kit mezőjének felirata). `group`: gombcsoportnál `div`, hogy a feliratra kattintás ne „nyomja meg”
 *  az első gombot (a `<label>` azt tenné). */
function Field({ label, hint, group = false, children }: { label: string; hint?: string; group?: boolean; children: ReactNode }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="block">
      <span className="mb-1.5 block text-ui-meta text-ui-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-ui-label text-ui-muted">{hint}</span>}
    </Tag>
  )
}

/** Egy elem a listában (rákattintva a beállítása nyílik) — a kit sora, nyíllal. */
function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ui-press flex min-h-11 w-full items-center justify-between gap-2 rounded-ui-control bg-ui-cell px-3.5 text-left text-ui-body text-ui-text">
      <MarqueeText>{label}</MarqueeText>
      <ChevronRight className="h-4 w-4 shrink-0 text-ui-muted" />
    </button>
  )
}

/** Igen/nem beállítás: a design sora (balra a neve és a tipp, jobbra a kapcsoló); bekapcsolt lépésnél ugrás oda. */
function ToggleRow({ label, hint, checked, onChange, disabled, onView, viewLabel = 'Megnézem', warn = false }: { label: string; hint?: string; checked: boolean; onChange: () => void; disabled?: boolean; onView?: () => void; viewLabel?: string; warn?: boolean }) {
  return (
    <EditorRow label={label} hint={(hint || (checked && onView)) ? (
      <>
        {hint && <span className={warn ? 'text-ui-bad' : ''}>{hint}</span>}
        {checked && onView && <button type="button" onClick={onView} className="ml-1 inline-flex items-center gap-0.5 text-ui-text underline-offset-2 hover:underline">{viewLabel}<ChevronRight className="h-3.5 w-3.5" /></button>}
      </>
    ) : undefined}>
      <Switch checked={checked} onChange={() => onChange()} ariaLabel={label} disabled={disabled} />
    </EditorRow>
  )
}

/** Csúszka (pl. a borító nagyítása): felirat, érték, a csúszka a kit sötét színében. */
function Slider({ label, value, min, max, suffix = '%', onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-ui-meta text-ui-muted"><span>{label}</span><span className="tabular-nums text-ui-text">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-ui-dark" />
    </label>
  )
}

/** Kép (borító / logó): az előnézete, alatta Csere és Eltávolítás — a kit gombjai. */
function ImagePicker({ url, busy, onPick, onRemove, tall = false }: { url: string | null; busy: boolean; onPick: (f: File) => void; onRemove: () => void; tall?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      {/* borító: kitölti a dobozt; logó: keret és háttér NÉLKÜL, kicsiben, ahogy feltöltötték (üresen a feltöltő-doboz) */}
      <div className={cn('relative', tall ? cn('h-32 overflow-hidden rounded-ui-inner', url && 'bg-ui-dark') : url ? 'inline-block' : 'h-20 w-20 overflow-hidden rounded-ui-inner')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* üresen maga a doboz a feltöltés (rákattintva tallóz) — nincs külön gomb */}
        {url ? <img src={url} alt="" className={tall ? 'h-full w-full object-cover' : 'block h-12 w-auto max-w-[200px] object-contain'} />
          : <button type="button" onClick={() => input.current?.click()} disabled={busy} className="ui-press block h-full w-full rounded-ui-inner outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><UploadBox className="h-full w-full">Kép feltöltése</UploadBox></button>}
        {busy && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
      {url && <div className="flex gap-1.5">
        <Button variant="cell" size="sm" icon={Upload} loading={busy} onClick={() => input.current?.click()}>Csere</Button>
        <Button variant="danger" size="sm" icon={Trash2} onClick={onRemove}>Eltávolítás</Button>
      </div>}
    </div>
  )
}

/** Több választás: pillek pipával (a bekapcsolt sötét) — design 21.6. */
function Chips({ options }: { options: { label: string; on: boolean; onClick: () => void }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.label} type="button" onClick={o.onClick} aria-pressed={o.on} className="ui-press rounded-full">
          <Pill tone={o.on ? 'dark' : 'cell'} size="sm">{o.on && <Check className="h-3 w-3" strokeWidth={2.5} />}{o.label}</Pill>
        </button>
      ))}
    </div>
  )
}

/** Ugrás egy másik oldalra / témára — a kit cella-gombja nyíllal. */
function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return <Button variant="cell" size="sm" href={href}>{children}<ArrowUpRight className="h-3.5 w-3.5" /></Button>
}

function NavButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <Button variant="cell" size="sm" onClick={onClick}>{children}<ChevronRight className="h-4 w-4" /></Button>
}

/** A gomb betűszíne (design 21.6.3): ugyanaz a 4 kör-minta, mint a márkaszínnél + saját szín — csak ami olvasható a
 *  márkaszínen (WCAG 3:1); a kijelöltre újra kattintva vissza a „magától”-ra. */
function ButtonTextSwatches({ value, accent, onChange }: { value: string | null; accent: string; onChange: (v: string | null) => void }) {
  const fills = BUTTON_TEXT_COLORS.filter((c) => readable(c, accent))
  const custom = value && !fills.includes(value) ? value : null
  return (
    <Swatches fills={fills} on={value ? fills.indexOf(value) : -1} onSelect={(i) => onChange(fills[i] === value ? null : fills[i])}
      add={
        <ColorPicker value={custom} label="Saját betűszín" onChange={(c) => onChange(makeReadable(c, accent))} />
      } />
  )
}

/** A szöveg színe (design 21.6.3): fehér · szürke · krém · arany + saját — a minták úgy, ahogy a sötét fotón / kártyán
 *  látszanak; a saját szín (ha van) külön mintaként a „+” előtt, a „+” mindig ott van. Csak olvasható szín választható (`bg`). */
function TextToneSwatches({ value, bg, onChange }: { value: string; accent?: string; bg: string; onChange: (v: string) => void }) {
  const v = value.toUpperCase() === '#FFFFFF' ? 'white' : value
  const idx = TONE_PALETTE.findIndex((x) => x.v.toLowerCase() === v.toLowerCase())
  const custom = idx < 0 && v.startsWith('#') ? v : null
  const fills = [...TONE_PALETTE.map((x) => x.css), ...(custom ? [custom] : [])]
  return (
    <Swatches fills={fills} on={custom ? fills.length - 1 : idx} onSelect={(i) => onChange(i < TONE_PALETTE.length ? TONE_PALETTE[i].v : custom!)}
      add={
        <ColorPicker value={null} onChange={(c) => onChange(makeReadable(c, bg))} />
      } />
  )
}

/** A borító alap színei (ha nincs kép): a davelopment sötétje (alap), éjkék, erdőzöld, bordó + saját (bármilyen — a
 *  szöveg alatt ott a sötétítés, sötétítés nélkül a név árnyékot kap). */
const COVER_COLORS = ['#383838', '#1F2A3A', '#22332B', '#3A1F24'] // ui-allow: a választható borító-színek maguk a minták
function CoverColorSwatches({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const idx = value ? COVER_COLORS.findIndex((c) => c.toLowerCase() === value.toLowerCase()) : 0
  const custom = value && idx < 0 ? value : null
  const fills = [...COVER_COLORS, ...(custom ? [custom] : [])]
  return (
    <Swatches fills={fills} on={custom ? fills.length - 1 : idx} onSelect={(i) => onChange(i === 0 ? null : fills[i])}
      add={
        <ColorPicker value={null} label="Saját borító-szín" onChange={(c) => onChange(c)} />
      } />
  )
}
