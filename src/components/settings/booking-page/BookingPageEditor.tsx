'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Globe, GripVertical, Loader2, Monitor, Smartphone, Upload, X } from 'lucide-react'
import { Toggle } from '@/components/settings/SettingsToggle'
import { HoverButton } from '@/components/shared/HoverButton'
import { SocialLinksEditor } from '@/components/settings/SocialLinksEditor'
import { GoodToKnowEditor, type GoodToKnowItem } from '@/components/settings/GoodToKnowEditor'
import { SupportedLocalesPicker } from '@/components/settings/SupportedLocalesPicker'
import { BusinessQrCard } from '@/components/settings/BusinessQrCard'
import { compressImage } from '@/lib/compressImage'
import { LOCALE_LABELS, resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { isEditorMessage, postToPreview, type PreviewToEditor } from '@/lib/editorBridge'
import { reminderOffsets } from '@/lib/reminders'
import { sheetSpring } from '@/lib/motion'
import { bookableDayCount, budapestToday, daysBetween, effectiveWindowEnd, huDate, periodEndFrom, type BookingWindowSource } from '@/lib/bookingWindow'
import { CustomQuestionsEditor, type CustomQuestion } from '@/components/settings/CustomQuestionsEditor'
import type { EditorView } from '@/components/booking/ProfileCard'
import { EventTypesEditor, type EventTypeItem } from '@/components/settings/EventTypesEditor'
import { cn } from '@/lib/utils'

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
  bio: string
  social_links: string[]
}

export type BookingPageEditorInitial = {
  /** Szalon vagy étterem — ugyanaz a szerkesztő, csak a mentés-végpont, néhány elem és a
   *  foglalási szabályok térnek el (étteremnél: létszám, alkalmak, foglalás hossza, lépték). */
  variant: 'salon' | 'restaurant'
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
}

type Draft = Omit<BookingPageEditorInitial, 'variant' | 'maxPax' | 'bookingRules' | 'notificationPrefs' | 'featureModules' | 'flags' | 'depositSettingsBase' | 'voucherSettingsBase'>
/** Nyelvenként fordítható mezők (a magyar a `Draft`-ban él). */
type LocDraft = {
  description: string
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

const SECTION_LABELS: Record<string, string> = { services: 'Szolgáltatások', voucher: 'Ajándékutalvány', staff: 'Munkatársak', reviews: 'Google-értékelések', slots: 'Szabad időpontok & nyitvatartás' }

const REMINDER_CHIPS = [['h48', '2 nappal'], ['h24', '24 órával'], ['h3', '3 órával'], ['h1', '1 órával']] as const

type Device = 'desktop' | 'mobile'
const FRAME: Record<Device, { w: number; h: number }> = {
  desktop: { w: 1280, h: 800 },
  mobile: { w: 390, h: 844 },
}

const fieldCls =
  'w-full rounded-[12px] border border-line-strong bg-white px-3 py-2.5 text-[16px] text-ink placeholder:text-ink-soft2/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25 lg:text-[14px]'

const ELEMENT_TITLES: Record<string, string> = {
  cover: 'Borítókép', logo: 'Logó', name: 'Üzlet neve', address: 'Cím', desc: 'Leírás', counts: 'Számláló sáv', link: 'Link & QR-kód',
  langs: 'Nyelvek', contact: 'Kapcsolat', 'sec:services': 'Szolgáltatások', 'sec:staff': 'Munkatársak',
  'sec:voucher': 'Ajándékutalvány', 'sec:reviews': 'Google-értékelések', gtk: 'Jó tudni',
  rules: 'Foglalási szabályok', confirm: 'Visszaigazolás & emlékeztetők', 'field:name': 'Név mező', 'field:email': 'E-mail mező',
  'field:phone': 'Telefonszám mező', 'field:address': 'Cím mező', 'field:notes': 'Megjegyzés mező', questions: 'Egyedi kérdések',
  consent: 'Hozzájáruló nyilatkozat', deposit: 'Előleg', terms: 'Foglalási feltételek', newsletter: 'Hírlevél-feliratkozás',
  summary: 'Összegzés', redeem: 'Utalvány beváltása', 'sec:slots': 'Szabad időpontok & nyitvatartás', pax: 'Létszám', occasions: 'Alkalmak',
}

const draftFrom = (i: BookingPageEditorInitial): Draft => {
  const { variant: _v, maxPax: _mp, bookingRules: _br, notificationPrefs: _np, featureModules: _fm, flags: _fl, depositSettingsBase: _dsb, voucherSettingsBase: _vsb, ...rest } = i
  return rest
}

/** A draft emlékeztető-beállításai → az időzítések órában (ugyanaz a logika, mint a cronban). */
const reminderHoursOf = (r: Draft['reminders']) => (r.on && r.chEmail
  ? reminderOffsets({ reminder_t_48h: r.h48, reminder_t_24h: r.h24, reminder_t_3h: r.h3, reminder_t_1h: r.h1, reminder_custom_hours: r.custom } as never)
  : [])

export function BookingPageEditor({
  initial,
  onDirtyChange,
  registerApi,
  onNavigate,
}: {
  initial: BookingPageEditorInitial
  onDirtyChange?: (dirty: boolean) => void
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
  /** Másik Beállítások-fülre ugrás (pl. Ajándékutalvány → Fizetés). */
  onNavigate?: (tab: string) => void
}) {
  const router = useRouter()
  const isRestaurant = initial.variant === 'restaurant'
  const apiBase = isRestaurant ? '/api/restaurant/settings' : '/api/salon/settings'
  const adminBase = isRestaurant ? '/restaurant' : '/dashboard'
  const [baseline, setBaseline] = useState<Draft>(() => draftFrom(initial))
  const [draft, setDraft] = useState<Draft>(baseline)
  const [locBaseline, setLocBaseline] = useState<Partial<Record<Locale, LocDraft>>>({})
  const [locDrafts, setLocDrafts] = useState<Partial<Record<Locale, LocDraft>>>({})
  const [lang, setLang] = useState<Locale>('hu')
  const [langLoading, setLangLoading] = useState(false)
  // melyik példány nyitotta: 'compact' (mobil fejléc) | 'full' (asztali sor) — a kettő egyszerre
  // renderelődik (CSS dönti el, melyik látszik), a menü csak a megnyitónál jelenjen meg
  const [langMenu, setLangMenu] = useState<false | 'compact' | 'full'>(false)
  // A nyelv-választó a valódi oldal-fejlécbe (SettingsHub "Beállítások" cím mellé) portálozódik,
  // hogy a usernek ez tűnjön a tényleges fejlécnek, ne egy a szerkesztő belsejében elbújó gomb.
  const [langSlot, setLangSlot] = useState<HTMLElement | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setLangSlot(document.getElementById('settings-subnav-slot'))
    setIsMounted(true)
  }, [])
  const [stepMenu, setStepMenu] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  // Telefonon (lg alatt) nincs eszközváltó: mindig a mobil előnézet, és a kijelölt elem
  // panelje alulról felcsúszó lapként jelenik meg (a tartalom közös, a desktopra is hat).
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
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
  const [step, setStep] = useState<EditorView>('main')
  const [ready, setReady] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

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

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setLoc = (patch: Partial<LocDraft>) => setLocDrafts((all) => ({ ...all, [lang]: { ...(all[lang] as LocDraft), ...patch } }))
  const setStaff = (id: string, patch: Partial<EditorStaff>) =>
    setDraft((d) => ({ ...d, staff: d.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))

  // ── Nyelvváltás: a fordítható mezők lusta betöltése az adott nyelven (fallback nélkül) ──
  const selectLang = async (next: Locale) => {
    setLangMenu(false)
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
    const description = (loc?.description || draft.description).trim().slice(0, 160) || null
    const goodToKnow = loc && loc.goodToKnow.some((g) => g.title || g.body) ? loc.goodToKnow : draft.goodToKnow
    const staffEdits: Record<string, unknown> = {}
    for (const m of draft.staff) {
      staffEdits[m.id] = {
        name: m.name,
        role_title: m.role_title,
        bio: (loc?.staffBio[m.id] || m.bio) || null,
        social_links: m.social_links.filter((u) => u.trim()).map((url) => ({ url })),
      }
    }
    return {
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
      logoUrl: draft.logoUrl,
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
      if (!isEditorMessage<PreviewToEditor>(e) || e.source !== frameRef.current?.contentWindow) return
      if (e.data.type === 'ready') setReady(true)
      else if (e.data.type === 'pick') setSel(e.data.id)
      else if (e.data.type === 'step') { setStep(e.data.view as EditorView); setSel(null) }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  useEffect(() => { if (ready) postToPreview(frameRef.current, { type: 'draft', patch: previewPatch }) }, [ready, previewPatch])
  useEffect(() => { if (ready) postToPreview(frameRef.current, { type: 'select', id: sel }) }, [ready, sel])
  useEffect(() => { if (ready) postToPreview(frameRef.current, { type: 'view', view: step }) }, [ready, step])

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
      if (changed('slug')) {
        if (!/^[a-z0-9-]+$/.test(d.slug)) throw new Error('Az URL azonosító csak kisbetűt, számot és kötőjelet tartalmazhat')
        body.slug = d.slug
      }
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

      for (const m of d.staff) {
        const before = b.staff.find((x) => x.id === m.id)
        if (!before || JSON.stringify(before) === JSON.stringify(m)) continue
        await patchJson(`/api/staff/${m.id}`, {
          name: m.name,
          role_title: m.role_title,
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
  const [uploading, setUploading] = useState<'cover' | 'logo' | null>(null)
  const upload = async (kind: 'cover' | 'logo', file: File) => {
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
      else setDraft((d) => ({ ...d, logoId: doc.id, logoUrl: doc.url }))
    } catch (e) {
      toast.error(`Kép feltöltése sikertelen: ${e instanceof Error ? e.message : 'ismeretlen hiba'}`)
    } finally {
      setUploading(null)
    }
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
  }, [])
  const frame = FRAME[device]
  // Ez a `scale` KIZÁRÓLAG a desktopos szimulált (mobil VAGY asztali) előnézethez kell —
  // ott 100%-nál sose nagyítunk fel (különben egy egérrel nézett "mobil szimuláció" óriásira
  // torzulna egy széles monitoron), csak zsugorítunk, ha a vászon szűkebb a kerethez képest.
  // A valódi, keskeny mobil-eszközön ez a változó nem is használt (ld. `narrow` külön ág),
  // ott az iframe mindig a tényleges elérhető szélességet kapja, skálázás nélkül.
  const scale = canvasW > 0 ? Math.min(1, canvasW / frame.w) : 0
  // A MENTETT azonosítón fut az előnézet (a még nem mentett új URL-en nincs oldal).
  const src = `/${baseline.slug}?editor=1${lang !== 'hu' ? `&lang=${lang}` : ''}`
  // Új nyelv = új iframe-betöltés: a `ready` üzenetig nem küldünk semmit.
  useEffect(() => { setReady(false) }, [src])

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
      if (!initial.flags.stripeOnboarded) { toast.error('Előbb kösd össze a Stripe-fiókot a Fizetés fülön.'); onNavigate?.('payments'); return }
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
    if (!draft.voucherEnabled && !initial.flags.stripeOnboarded) { toast.error('Előbb kösd össze a Stripe-fiókot a Fizetés fülön.'); onNavigate?.('payments'); return }
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
  const title = member ? member.name : sel ? ELEMENT_TITLES[sel] ?? 'Elem' : step === 'main' ? 'Az oldal elemei' : stepLabel

  // `compact`: a mobil fejlécbe portálozott gomb — pontosan ugyanaz a méret/forma
  // (h-[52px] w-[52px], kör, ugyanaz a háttér/árnyék/press-animáció), mint a DashboardNav
  // többi fejléc-ikonja (szűrő/csengő/avatar), hogy ne üssön el a sorban. Desktopon (a
  // szerkesztő saját fejléc-sorában) marad a szöveges "HU" pill, ott bőven van hely.
  const renderLangControl = (compact: boolean) => (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setLangMenu((o) => (o ? false : 'compact'))}
          aria-label="Nyelv"
          className="flex items-center justify-center h-[52px] w-[52px] shrink-0 rounded-full bg-[var(--dav-glass-strong)] text-ink shadow-[0_2px_8px_rgba(0,0,0,.05)] backdrop-blur-lg outline-none transition-colors hover:bg-white/70 active:scale-95"
        >
          {langLoading ? <Loader2 className="h-[19px] w-[19px] animate-spin" /> : <Globe className="h-[19px] w-[19px]" strokeWidth={2} />}
        </button>
      ) : (
        <HoverButton
          onClick={() => setLangMenu((o) => (o ? false : 'full'))}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white/75 px-4 text-[13px] font-semibold text-ink"
        >
          {langLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" strokeWidth={1.8} />}
          {LOCALE_LABELS[lang]}
        </HoverButton>
      )}
      {langMenu === 'full' && !compact && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setLangMenu(false)} />
          <div className="absolute right-0 top-14 z-30 w-52 rounded-[18px] border border-line bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(70,60,20,.35)]">
            {languages.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => selectLang(code)}
                className={cn('flex h-10 w-full items-center justify-between rounded-[12px] px-3 text-left text-[13.5px] font-medium', lang === code ? 'bg-ink-dark text-white' : 'text-ink hover:bg-black/[0.04]')}
              >
                {LOCALE_LABELS[code]}<span className="text-[11px] opacity-60">{code.toUpperCase()}</span>
              </button>
            ))}
            <div className="my-1 h-px bg-line" />
            <button type="button" onClick={() => { setLangMenu(false); setSel('langs') }} className="flex h-10 w-full items-center rounded-[12px] px-3 text-left text-[13px] font-semibold text-ink-soft hover:bg-black/[0.04]">
              Nyelvek kezelése…
            </button>
          </div>
        </>
      )}
      {/* Mobilon (compact) NEM kis sarok-dropdown, hanem ugyanaz az alulról felcsúszó sheet,
          mint a fejléc többi menüpontja (pl. a Beállítások-menü ikonja, SettingsHub
          mobileNavOpen) — egységes interakciós nyelv, nem egy eltérő mini-dropdown. */}
      {compact && isMounted && createPortal(
        <AnimatePresence>
          {langMenu === 'compact' && (
            <div className="fixed inset-0 z-[160] font-onest">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 bg-ink-dark/40 backdrop-blur-sm"
                onClick={() => setLangMenu(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={sheetSpring.transition}
                className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              >
                <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-3">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">Nyelv</span>
                    <button type="button" onClick={() => setLangMenu(false)} aria-label="Bezárás" className="hidden h-8 w-8 sm:flex items-center justify-center rounded-full bg-[#F4F2EC] text-ink-soft transition-opacity hover:opacity-70">
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="px-3 pb-4">
                  {languages.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => { selectLang(code); setLangMenu(false) }}
                      className={cn('flex h-12 w-full items-center justify-between rounded-[14px] px-3.5 text-left text-[14px] font-medium', lang === code ? 'bg-ink-dark text-white' : 'text-ink hover:bg-black/[0.04]')}
                    >
                      {LOCALE_LABELS[code]}<span className="text-[12px] opacity-60">{code.toUpperCase()}</span>
                    </button>
                  ))}
                  <div className="my-1 h-px bg-line" />
                  <button type="button" onClick={() => { setLangMenu(false); setSel('langs') }} className="flex h-12 w-full items-center rounded-[14px] px-3.5 text-left text-[14px] font-semibold text-ink-soft hover:bg-black/[0.04]">
                    Nyelvek kezelése…
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )

  return (
    <div className="space-y-4">
      {/* Mobil fejléc-slot: csak lg alatt látszik (a slot asztalon is létezik, csak rejtett) */}
      {langSlot && createPortal(<div className="relative lg:hidden">{renderLangControl(true)}</div>, langSlot)}
      {/* Fejléc: eszköz + szerkesztett nyelv */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Mobilon elrejtve — a hosszú szöveg lenyomná a léptetőt/nyelv-gombot egy külön,
            lejjebb csúszott sorra; desktopon van hely mindkettőnek egy sorban. */}
        {!narrow && <p className="text-[13px] font-medium text-ink-soft">Kattints bármire az oldalon — jobbra szerkesztheted.</p>}
        <div className="flex flex-wrap items-center gap-2">
          {/* A foglalás teljes folyamata — kompakt "előző/aktuális/következő" vezérlő, a label
              kattintva legördülő listát nyit; minden méreten ez fut (nincs külön széles
              lépéssor), a nyelvválasztó mellett, azt megelőzve. Rugalmas szélesség (nem fix
              px), hogy szűk helyen a pill zsugorodjon/a sor tördelődjön, ne csúszzon ki. */}
          {(() => {
            const idx = Math.max(0, flow.findIndex((f) => f.id === step))
            return (
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-white/60 p-1">
                <HoverButton
                  onClick={() => idx > 0 && goStep(flow[idx - 1].id)}
                  disabled={idx === 0}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft2 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </HoverButton>
                <div className="relative shrink-0">
                  <HoverButton
                    onClick={() => setStepMenu((v) => !v)}
                    className="flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[12.5px] font-semibold text-ink"
                  >
                    <span className="shrink-0 text-ink-soft2">{idx + 1}/{flow.length}</span>
                    <span>{flow[idx]?.label}</span>
                  </HoverButton>
                  {stepMenu && (
                    <>
                      {/* Kattintás a vezérlőn kívül zárja a listát. */}
                      <div className="fixed inset-0 z-20" onClick={() => setStepMenu(false)} />
                      <div className="absolute left-0 top-10 z-30 max-h-64 w-max min-w-full overflow-y-auto rounded-[18px] border border-line bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(70,60,20,.35)]">
                        {flow.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => { goStep(st.id); setStepMenu(false) }}
                            className={cn('flex h-10 w-full items-center whitespace-nowrap rounded-[12px] px-3 text-left text-[13.5px] font-medium', step === st.id ? 'bg-ink-dark text-white' : 'text-ink hover:bg-black/[0.04]')}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <HoverButton
                  onClick={() => idx < flow.length - 1 && goStep(flow[idx + 1].id)}
                  disabled={idx === flow.length - 1}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft2 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </HoverButton>
              </div>
            )
          })()}
          <div className="hidden gap-1 rounded-full border border-line bg-white/60 p-1 xl:flex">
            {([['mobile', Smartphone, 'Mobil nézet'], ['desktop', Monitor, 'Asztali nézet']] as const).map(([d, Icon, label]) => (
              <button
                key={d}
                type="button"
                aria-label={label}
                onClick={() => setDevice(d)}
                className={cn('flex h-9 w-9 items-center justify-center rounded-full transition-colors', device === d ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink')}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </button>
            ))}
          </div>
          {/* Asztali nézetben (lg+) a nyelvváltó a szerkesztő saját sorában van. Korábban CSAK a
              mobil fejléc-slotba került, ha az létezett — de a slot asztalon is ott van (rejtve),
              így desktopon eltűnt a nyelvváltó. lg alatt a mobil fejléc-ikon veszi át. */}
          <div className={cn('relative', langSlot && 'hidden lg:block')}>{renderLangControl(false)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
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
                className="w-full rounded-[18px] border-0 ring-1 ring-line"
                style={{ width: canvasW, height: frame.h }}
              />
            )
          ) : (
            <div className="relative mx-auto" style={{ width: frame.w * scale, height: frame.h * scale }}>
              {scale > 0 && (
                <iframe
                  ref={frameRef}
                  key={src}
                  src={src}
                  title="Foglalóoldal előnézet"
                  className={cn(
                    'absolute left-0 top-0 origin-top-left border-0 bg-[#111]',
                    device === 'mobile' ? 'rounded-[40px] ring-[10px] ring-[#0E0E10]' : 'rounded-[18px] ring-1 ring-line',
                  )}
                  style={{ width: frame.w, height: frame.h, transform: `scale(${scale})` }}
                />
              )}
            </div>
          )}
        </div>

        {/* Tulajdonság-panel */}
        {narrow && sel && <div className="fixed inset-0 z-[60] bg-black/25" onClick={() => setSel(null)} aria-hidden />}
        <aside
          className={cn(
            'w-full shrink-0 space-y-4 p-5 xl:w-[340px]',
            narrow && sel
              ? 'fixed inset-x-0 bottom-0 z-[61] max-h-[72dvh] overflow-y-auto rounded-t-[26px] bg-[#F4F3EF] pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-20px_rgba(40,35,15,.45)]'
              : 'rounded-[26px] dav-card-glass',
          )}
        >
          {narrow && sel && (
            /* mobil: csak fogantyú (koppintásra zár) — X nélkül, mint a többi alulról nyíló lap */
            <div className="-mt-2 flex items-center justify-center">
              <button type="button" onClick={() => setSel(null)} aria-label="Bezárás" className="w-full py-2">
                <span className="mx-auto block h-1 w-10 rounded-full bg-black/15" />
              </button>
            </div>
          )}
          {sel && (
            <button type="button" onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
              <ChevronLeft className="h-3.5 w-3.5" /> {step === 'main' ? 'Az oldal elemei' : `${stepLabel} lépés`}
            </button>
          )}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft2">{sel ? 'Kijelölt elem' : step === 'main' ? 'Foglalóoldal' : 'Foglalás folyamata'}</div>
            <div className="mt-1 text-[21px] font-normal tracking-[-0.01em] text-ink">{title}</div>
          </div>

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

          {!sel && step === 'main' && (
            <div className="space-y-2">
              {(isRestaurant
                ? (['cover', 'logo', 'name', 'address', 'desc', 'contact', 'langs', 'link'] as const)
                : (['cover', 'logo', 'name', 'address', 'desc', 'counts', 'contact', 'langs', 'link'] as const)
              ).map((id) => (
                <Row key={id} label={ELEMENT_TITLES[id]} onClick={() => setSel(id)} />
              ))}
              <div className="pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft2">Szakaszok · húzd a sorrendhez</div>
              <Reorder.Group axis="y" values={draft.sectionOrder} onReorder={(v) => set('sectionOrder', v)} className="space-y-2">
                {draft.sectionOrder.map((id) => {
                  const hidden = draft.hiddenSections.includes(id)
                  return (
                    <GripReorderItem key={id} id={id}>
                      <button type="button" onClick={() => setSel(`sec:${id}`)} className={cn('min-w-0 flex-1 truncate text-left text-[13.5px] font-medium', hidden ? 'text-ink-soft2' : 'text-ink')}>
                        {SECTION_LABELS[id]}
                      </button>
                      <button
                        type="button"
                        aria-label={hidden ? 'Megjelenítés' : 'Elrejtés'}
                        onClick={() => set('hiddenSections', hidden ? draft.hiddenSections.filter((x) => x !== id) : [...draft.hiddenSections, id])}
                        className={cn('flex h-8 shrink-0 items-center gap-1 rounded-[10px] px-2.5 text-[12px] font-semibold', hidden ? 'bg-black/[0.05] text-ink-soft' : 'bg-ok-bg text-ok')}
                      >
                        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{hidden ? 'Rejtve' : 'Látható'}
                      </button>
                    </GripReorderItem>
                  )
                })}
              </Reorder.Group>
            </div>
          )}

          {!sel && step !== 'main' && (
            <div className="space-y-2">
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Így halad végig a vendég a foglaláson. Kattints egy elemre az előnézetben a szerkesztéséhez.</p>
              {step === 'details' && (
                <>
                  <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft2">Űrlap mezői · húzd a sorrendhez</div>
                  <Reorder.Group axis="y" values={draft.fieldOrder} onReorder={(v) => set('fieldOrder', v)} className="space-y-2">
                    {draft.fieldOrder.map((id) => {
                      const selId = id === 'questions' ? 'questions' : `field:${id}`
                      // A cím mező saját, 3-fokozatú szabálya (off/city/full) — előleg aktív
                      // esetén FÜGGETLENÜL mindig 'full'-ra kényszerítjük (számlázáshoz kell).
                      const addressForcedFull = id === 'address' && initial.flags.deposit
                      const effectiveAddressLevel = addressForcedFull ? 'full' : draft.addressDetailLevel
                      const hiddenByChoice = (id === 'phone' || id === 'notes') && draft.hiddenFields.includes(id)
                        || (id === 'address' && effectiveAddressLevel === 'off')
                      const badge = hiddenByChoice ? 'Kikapcsolva'
                        : id === 'name' || id === 'email' ? 'Kötelező'
                        : id === 'phone' ? (draft.requirePhone ? 'Kötelező' : 'Opcionális')
                        : id === 'address' ? (effectiveAddressLevel === 'city' ? 'Csak város' : draft.requireAddress || addressForcedFull ? 'Kötelező' : 'Opcionális')
                        : id === 'questions' ? `${draft.customQuestions.length} db` : 'Opcionális'
                      return (
                        <GripReorderItem key={id} id={id}>
                          <button type="button" onClick={() => setSel(selId)} className={cn('min-w-0 flex-1 truncate text-left text-[13.5px] font-medium', hiddenByChoice ? 'text-ink-soft2' : 'text-ink')}>
                            {ELEMENT_TITLES[selId]}
                          </button>
                          <span className={cn('shrink-0 rounded-[10px] px-2.5 py-1 text-[11.5px] font-semibold', badge === 'Kötelező' ? 'bg-ink-dark text-gold' : 'bg-black/[0.05] text-ink-soft')}>{badge}</span>
                        </GripReorderItem>
                      )
                    })}
                  </Reorder.Group>
                  {isRestaurant && <Row label={ELEMENT_TITLES.occasions} onClick={() => setSel('occasions')} />}
                </>
              )}
              {(step === 'details'
                ? ([] as const)
                : step === 'datetime' ? (isRestaurant ? (['pax', 'rules'] as const) : (['rules'] as const))
                : step === 'consent' ? (['consent'] as const)
                : step === 'summary' ? (['summary', 'gtk', 'terms', ...(initial.flags.newsletter ? ['newsletter' as const] : [])] as const)
                : step === 'success' ? (['confirm'] as const)
                : step === 'deposit' ? (['deposit'] as const)
                : (['sec:voucher'] as const)
              ).map((id) => <Row key={id} label={ELEMENT_TITLES[id]} onClick={() => setSel(id)} />)}
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
                  if (next) { if (draft.consentText.trim()) goStep('consent'); else setSel('consent') }
                }}
                onView={consentOn ? () => goStep('consent') : draft.consentEnabled ? () => setSel('consent') : undefined}
                viewLabel={consentOn ? 'Megnézem' : 'Szöveg megadása'}
              />
              <ToggleRow
                label="Előleg lépés"
                hint={!initial.flags.stripeOnboarded ? 'A bekapcsoláshoz kösd össze a Stripe-fiókot (Fizetés fül).' : !initial.flags.termsFilled ? 'A bekapcsoláshoz töltsd ki a foglalási feltételeket (Dokumentumok & jogi fül).' : 'Az összeget és a visszatérítést a Fizetés fülön állítod.'}
                checked={draft.depositEnabled}
                onChange={toggleDeposit}
                onView={depositOn ? () => goStep('deposit') : undefined}
              />
              <ToggleRow
                label="Ajándékutalvány lépés"
                hint={!initial.flags.stripeOnboarded ? 'A bekapcsoláshoz kösd össze a Stripe-fiókot (Fizetés fül).' : 'A típusokat és összegeket az Ajándékutalvány fülön állítod.'}
                checked={draft.voucherEnabled}
                onChange={toggleVoucher}
                onView={voucherOn ? () => goStep('voucher') : undefined}
              />
            </div>
          )}

          {!sel && (
            <div className="space-y-2 border-t border-line pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft2">Foglalási szabályok</div>
              <div className="overflow-hidden rounded-[16px] border border-line bg-white">
                {rulesSummary.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => { setStep(r.step); setSel(r.sel) }}
                    className="flex h-11 w-full items-center justify-between gap-3 border-b border-line px-3.5 text-left text-[13px] text-ink last:border-0 hover:bg-black/[0.02]"
                  >
                    <span className="min-w-0 truncate">{r.label}</span>
                    <span className={cn('shrink-0 font-semibold', r.off ? 'text-ink-soft2' : 'text-ink')}>{r.value} ›</span>
                  </button>
                ))}
                <button type="button" onClick={() => onNavigate?.('notifications')} className="flex h-11 w-full items-center justify-between gap-3 px-3.5 text-left text-[13px] text-ink hover:bg-black/[0.02]">
                  <span className="min-w-0 truncate">Új foglalás értesítés neked</span>
                  <span className="shrink-0 font-semibold text-ink">Értesítések ›</span>
                </button>
              </div>
            </div>
          )}

          {sel === 'name' && (
            <Field label="Üzlet neve"><input className={fieldCls} value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
          )}

          {sel === 'address' && (
            <>
              <Field label="Cím"><input className={fieldCls} value={draft.address} placeholder="Utca, házszám" onChange={(e) => set('address', e.target.value)} /></Field>
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

          {sel === 'desc' && (
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

          {sel === 'cover' && (
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
                  <p className="text-[12px] leading-relaxed text-ink-soft">
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

          {sel === 'logo' && (
            <ImagePicker url={draft.logoUrl} busy={uploading === 'logo'} onPick={(f) => upload('logo', f)} onRemove={() => setDraft((d) => ({ ...d, logoId: null, logoUrl: null }))} />
          )}

          {sel === 'link' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Ezen a linken tudnak a vendégek online időpontot foglalni.</p>
              <div className="flex gap-2">
                <code className="flex h-11 min-w-0 flex-1 items-center truncate rounded-[12px] border border-line bg-white px-3 text-[13px] text-ink">{publicUrl}</code>
                <a href={`/${baseline.slug}`} target="_blank" rel="noopener noreferrer" className="flex h-11 shrink-0 items-center rounded-full border border-line-strong bg-white px-4 text-[13px] font-semibold text-ink">Megnyitás</a>
              </div>
              <Field label="URL azonosító" hint="Csak kisbetű, szám és kötőjel.">
                <div className="flex items-center gap-1"><span className="text-[14px] text-ink-soft">/</span><input className={fieldCls} value={draft.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} /></div>
              </Field>
              {draft.slug !== baseline.slug && (
                <p className="rounded-[14px] border border-amber-300 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
                  <b>A foglalási link megváltozik!</b> A régi URL-en (/{baseline.slug}) érkező vendégek hibát kapnak. Mentés után értesítsd őket az új linkről.
                </p>
              )}
              <BusinessQrCard url={publicUrl} businessName={draft.name} subtitle="Foglalj időpontot online" />
            </>
          )}

          {sel === 'counts' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">A foglalóoldal tetején, középen (mobilon a logó alatt).</p>
              <ToggleRow label="Szolgáltatások száma" checked={draft.showServiceCount} onChange={() => set('showServiceCount', !draft.showServiceCount)} />
              <ToggleRow label="Szakemberek száma" checked={draft.showStaffCount} onChange={() => set('showStaffCount', !draft.showStaffCount)} />
            </>
          )}

          {sel === 'langs' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Ezeken a nyelveken választhat a vendég. Hiányzó fordítás helyén a magyar szöveg látszik.</p>
              <SupportedLocalesPicker value={draft.supportedLocales} onChange={(v) => set('supportedLocales', v)} />
              {/* A „HU” gombra kattintva ide jutunk — innen is lehessen átváltani az előnézet/szerkesztés nyelvét */}
              {languages.length > 1 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Előnézet és szerkesztés nyelve</p>
                  <div className="flex flex-wrap gap-1.5">
                    {languages.map((code) => (
                      <button key={code} type="button" onClick={() => selectLang(code)} className={cn('h-8 rounded-full border px-3 text-[12.5px] font-semibold transition-colors', lang === code ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink hover:border-line-strong')}>
                        {LOCALE_LABELS[code]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {sel === 'contact' && (
            <>
              <Field label="Telefon"><input className={fieldCls} value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="E-mail"><input className={fieldCls} value={draft.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Weboldal"><input className={fieldCls} value={draft.website} onChange={(e) => set('website', e.target.value)} /></Field>
              <Field group label="Közösségi linkek" hint="Csak illeszd be a linket — az ikont felismerjük.">
                <SocialLinksEditor value={draft.socialLinks} onChange={(v) => set('socialLinks', v)} inputClassName={fieldCls} />
              </Field>
            </>
          )}

          {sel === 'sec:services' && (
            <>
              <ToggleRow label="Kibontva a főnézeten" hint="Rögtön látszik a teljes katalógus, külön gomb nélkül." checked={draft.servicesExpandedOnMain} onChange={() => set('servicesExpandedOnMain', !draft.servicesExpandedOnMain)} />
              <LinkButton href="/dashboard/services">Szolgáltatások és árak</LinkButton>
            </>
          )}

          {sel === 'sec:staff' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Kattints egy munkatársra a bemutatkozása és a közösségi linkjei szerkesztéséhez. Csak azok látszanak, akikhez legalább egy szolgáltatás tartozik.</p>
              <div className="space-y-2">
                {draft.staff.map((m) => <Row key={m.id} label={m.name} onClick={() => setSel(`staff:${m.id}`)} />)}
              </div>
              <LinkButton href="/dashboard/staff">Munkatársak kezelése</LinkButton>
            </>
          )}

          {member && (
            <>
              <Field label="Név"><input className={fieldCls} value={member.name} onChange={(e) => setStaff(member.id, { name: e.target.value })} /></Field>
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

          {sel === 'gtk' && (
            <GoodToKnowEditor
              value={loc ? loc.goodToKnow : draft.goodToKnow}
              onChange={(v) => (loc ? setLoc({ goodToKnow: v }) : set('goodToKnow', v))}
              locale={lang}
            />
          )}

          {sel === 'sec:voucher' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Az utalvány beállításai (összegek, típusok, céges vásárlás) az Ajándékutalvány fülön vannak.</p>
              <NavButton onClick={() => onNavigate?.('vouchers')}>Ajándékutalvány beállításai</NavButton>
            </>
          )}

          {sel === 'rules' && (
            <>
              <Field label={draft.windowPeriodic ? 'Egy időszak hossza' : 'Foglalható napok előre'} hint={draft.windowPeriodic ? 'Ennyi nap nyílik meg egyszerre.' : 'Naponta automatikusan tovább gördül.'}>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" min={1} max={365} className={cn(fieldCls, 'w-24 text-center')} value={draft.bookingWindowDays}
                    onChange={(e) => set('bookingWindowDays', Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
                  <span className="text-[13px] text-ink-soft">nap</span>
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
                <div className="space-y-3 rounded-[16px] bg-black/[0.03] p-3.5">
                  <p className="text-[12.5px] leading-relaxed text-ink-soft">
                    {draftWindowEnd
                      ? <>Jelenlegi időszak: <b className="font-semibold text-ink">ma – {huDate(draftWindowEnd)}</b> (még {daysBetween(budapestToday(), draftWindowEnd) + 1} nap).</>
                      : <>Az időszak lejárt — a vendégek most nem tudnak foglalni.</>}
                  </p>
                  <ToggleRow label="Automatikus megújítás" hint={`Lejáratkor újabb ${draft.bookingWindowDays} nap nyílik meg.`} checked={draft.windowAutoRenew} onChange={() => set('windowAutoRenew', !draft.windowAutoRenew)} />
                  <button type="button" onClick={() => set('windowEnd', periodEndFrom({ booking_window_days: draft.bookingWindowDays }, budapestToday()))}
                    className="h-9 rounded-full border border-line-strong bg-white px-4 text-[12.5px] font-semibold text-ink hover:border-ink/40">
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

          {sel === 'confirm' && (
            <>
              <ToggleRow
                label="Automatikus megerősítés"
                hint={autoConfirmBlocked
                  ? 'Előleg mellett nem kapcsolható ki: az előleggel fizetett foglalás mindig azonnal megerősített. Kikapcsoláshoz előbb az előleget kell kikapcsolni.'
                  : 'Kikapcsolva te hagyod jóvá; a vendég „beérkezett” üzenetet lát.'}
                warn={autoConfirmBlocked}
                checked={draft.autoConfirm || depositOn}
                onChange={toggleAutoConfirm}
                onView={autoConfirmBlocked ? () => onNavigate?.('payments') : undefined}
                viewLabel="Előleg beállításai"
              />
              <ToggleRow label="Visszaigazoló e-mail a vendégnek" hint={draft.autoConfirm ? 'Azonnal a foglalás után.' : 'Amikor jóváhagyod.'} checked={draft.confirmEmail} onChange={() => set('confirmEmail', !draft.confirmEmail)} />
              <div className="border-t border-line pt-4">
                <ToggleRow label="Automata emlékeztetők" hint="A foglalás előtt." checked={draft.reminders.on} onChange={() => setRem({ on: !draft.reminders.on })} />
              </div>
              {draft.reminders.on && (
                <>
                  <Field group label="Időzítés a foglalás előtt">
                    <Chips options={REMINDER_CHIPS.map(([k, label]) => ({ label, on: draft.reminders[k], onClick: () => setRem({ [k]: !draft.reminders[k] }) }))} />
                  </Field>
                  <Field group label="Csatorna">
                    <Chips options={[
                      { label: 'E-mail', on: draft.reminders.chEmail, onClick: () => setRem({ chEmail: !draft.reminders.chEmail }) },
                      { label: 'Push', on: draft.reminders.chPush, onClick: () => setRem({ chPush: !draft.reminders.chPush }) },
                    ]} />
                  </Field>
                </>
              )}
              <NavButton onClick={() => onNavigate?.('email')}>E-mail sablonok</NavButton>
              <p className="rounded-[14px] bg-black/[0.03] px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">Az új foglalásról neked szóló értesítést az Értesítések között állítod.</p>
            </>
          )}

          {(sel === 'field:name' || sel === 'field:email') && (
            <p className="text-[12.5px] leading-relaxed text-ink-soft">{sel === 'field:name' ? 'A név mindig kötelező.' : 'Az e-mail mindig kötelező — ide megy a visszaigazolás és az emlékeztető.'}</p>
          )}
          {sel === 'field:phone' && (
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
          {sel === 'field:address' && (() => {
            const addressForcedFull = initial.flags.deposit
            const effectiveAddressLevel = addressForcedFull ? 'full' : draft.addressDetailLevel
            return (
              <>
                <div className="space-y-1.5">
                  <div className="text-[13.5px] font-medium text-ink">Mennyit kérjünk be?</div>
                  {addressForcedFull ? (
                    <p className="text-[12px] leading-relaxed text-ink-soft">Előleg aktív — a számlázáshoz a teljes cím (város + utca, házszám) mindig kötelező, nem állítható vissza.</p>
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
          {sel === 'field:notes' && (
            <ToggleRow
              label="Mező megjelenítése"
              hint={draft.hiddenFields.includes('notes') ? undefined : 'Szabad szöveges megjegyzés a vendégtől — mindig opcionális, ha megjelenik.'}
              checked={!draft.hiddenFields.includes('notes')}
              onChange={() => set('hiddenFields', draft.hiddenFields.includes('notes') ? draft.hiddenFields.filter((f) => f !== 'notes') : [...draft.hiddenFields, 'notes'])}
            />
          )}

          {sel === 'questions' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Saját kérdések az Adatok lépésen ({LOCALE_LABELS[lang]}).</p>
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

          {sel === 'consent' && (
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

          {sel === 'deposit' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Előleg: <b className="text-ink">{initial.flags.depositLabel}</b>. Az összeget és a visszatérítést a Fizetés fülön állítod.</p>
              <NavButton onClick={() => onNavigate?.('payments')}>Előleg beállításai</NavButton>
            </>
          )}

          {sel === 'terms' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">A foglalási feltételek szakaszait (lemondás, késés, adatkezelés) a Dokumentumok & jogi fülön szerkesztheted.</p>
              <NavButton onClick={() => onNavigate?.('documents')}>Foglalási feltételek</NavButton>
            </>
          )}

          {sel === 'newsletter' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">A hírlevél-feliratkozás minden csomagban be van kapcsolva — a vendég az Adatok lépésen iratkozhat fel.</p>
              <ToggleRow
                label="Feliratkozó checkbox megjelenítése"
                hint={draft.showMarketingConsent ? 'A vendég az Adatok lépésen látja és pipálhatja.' : 'Kikapcsolva a checkbox nem jelenik meg — senki nem iratkozhat fel a foglalás közben.'}
                checked={draft.showMarketingConsent}
                onChange={() => set('showMarketingConsent', !draft.showMarketingConsent)}
              />
              <NavButton onClick={() => onNavigate?.('newsletter')}>Hírlevél</NavButton>
            </>
          )}

          {sel === 'summary' && <p className="text-[12.5px] leading-relaxed text-ink-soft">Az összegzés a vendég választásaiból és adataiból áll össze — nincs mit szerkeszteni rajta.</p>}

          {sel === 'redeem' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Csak akkor látszik, ha az ajándékutalvány be van kapcsolva.</p>
              <NavButton onClick={() => onNavigate?.('vouchers')}>Ajándékutalvány beállításai</NavButton>
            </>
          )}

          {sel === 'pax' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">A legnagyobb foglalható létszám az asztalaidból jön: most <b className="text-ink">{initial.maxPax} fő</b>.</p>
              <LinkButton href={`${adminBase}/tables`}>Asztalok kezelése</LinkButton>
            </>
          )}

          {sel === 'occasions' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Milyen alkalomból foglalhat a vendég ({LOCALE_LABELS[lang]}). Kikapcsolva nem jelenik meg; ha mind ki van kapcsolva, az alapkészlet látszik.</p>
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

          {sel === 'sec:slots' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">A legközelebbi szabad időpontok és a nyitvatartás a beállított nyitvatartásból és az asztalokból számolódnak.</p>
              <LinkButton href={`${adminBase}/availability`}>Nyitvatartás</LinkButton>
            </>
          )}

          {sel === 'sec:reviews' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">A megjelenő értékelések az összekapcsolt Google-profilból jönnek.</p>
              <NavButton onClick={() => onNavigate?.('google')}>Google-profil</NavButton>
            </>
          )}
          </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </div>
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
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className="flex h-11 items-center gap-2 rounded-[14px] border border-line bg-white pl-2.5 pr-1.5">
      <span
        onPointerDown={(e) => controls.start(e)}
        className="flex h-7 w-7 shrink-0 -ml-1 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-ink-soft2" />
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

function Field({ label, hint, group = false, children }: { label: string; hint?: string; group?: boolean; children: ReactNode }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="block space-y-1.5">
      <span className="block text-[12px] font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] leading-relaxed text-ink-soft2">{hint}</span>}
    </Tag>
  )
}

function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center justify-between rounded-[14px] border border-line bg-white px-3.5 text-left text-[13.5px] font-medium text-ink transition-colors hover:border-ink/20"
    >
      <span className="min-w-0 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft2" />
    </button>
  )
}

function ToggleRow({ label, hint, checked, onChange, disabled, onView, viewLabel = 'Megnézem', warn = false }: { label: string; hint?: string; checked: boolean; onChange: () => void; disabled?: boolean; onView?: () => void; viewLabel?: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {hint && <div className={cn('mt-0.5 text-[12px] leading-relaxed', warn ? 'font-semibold text-amber-600' : 'text-ink-soft')}>{hint}</div>}
        {/* bekapcsolt lépésnél: ugrás az előnézetben arra a lépésre */}
        {checked && onView && (
          <button type="button" onClick={onView} className="mt-1 inline-flex items-center gap-0.5 text-[12px] font-semibold text-ink underline-offset-2 hover:underline">
            {viewLabel} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  )
}

function Slider({ label, value, min, max, suffix = '%', onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-[12px] font-semibold text-ink-soft"><span>{label}</span><span className="tabular-nums">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#1D1C19]" />
    </label>
  )
}

function ImagePicker({ url, busy, onPick, onRemove, tall = false }: { url: string | null; busy: boolean; onPick: (f: File) => void; onRemove: () => void; tall?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      <div className={cn('relative overflow-hidden rounded-[18px] border border-line bg-[#3A3830]', tall ? 'h-32' : 'h-20 w-20')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" className={cn('h-full w-full', tall ? 'object-cover' : 'object-contain bg-white')} />}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
      <div className="flex gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-white text-[13px] font-semibold text-ink">
          <Upload className="h-4 w-4" /> {url ? 'Kép cseréje' : 'Kép feltöltése'}
        </button>
        {url && (
          <button type="button" onClick={onRemove} aria-label="Kép eltávolítása" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#F3C9C2] bg-white text-bad">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function Chips({ options }: { options: { label: string; on: boolean; onClick: () => void }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={o.onClick}
          className={cn('h-9 rounded-[12px] border px-3 text-[12.5px] font-semibold transition-colors', o.on ? 'border-ink-dark bg-ink-dark text-white' : 'border-line-strong bg-white text-ink-soft hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-ink-dark px-4 text-center text-[13px] font-semibold text-white">
      {children} <ChevronRight className="h-4 w-4" />
    </a>
  )
}

function NavButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-ink-dark px-4 text-[13px] font-semibold text-white">
      {children} <ChevronRight className="h-4 w-4" />
    </button>
  )
}
