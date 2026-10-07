'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Reorder } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Globe, GripVertical, Loader2, Monitor, Smartphone, Upload, X } from 'lucide-react'
import { Toggle } from '@/components/settings/SettingsToggle'
import { SocialLinksEditor } from '@/components/settings/SocialLinksEditor'
import { GoodToKnowEditor, type GoodToKnowItem } from '@/components/settings/GoodToKnowEditor'
import { SupportedLocalesPicker } from '@/components/settings/SupportedLocalesPicker'
import { BusinessQrCard } from '@/components/settings/BusinessQrCard'
import { compressImage } from '@/lib/compressImage'
import { LOCALE_LABELS, resolveAvailableLocales, type Locale } from '@/lib/i18n'
import { isEditorMessage, postToPreview, type PreviewToEditor } from '@/lib/editorBridge'
import { reminderOffsets } from '@/lib/reminders'
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
  bufferMinutes: number
  requirePhone: boolean
  autoConfirm: boolean
  requireAddress: boolean
  requireAddressNote: string
  confirmEmail: boolean
  reminders: { on: boolean; h48: boolean; h24: boolean; h3: boolean; h1: boolean; custom: number | null; chEmail: boolean; chPush: boolean }
  consentEnabled: boolean
  consentTitle: string
  consentText: string
  customQuestions: CustomQuestion[]
  /** Csak olvasható állapotok — a gazdájuk a Fizetés fül. */
  flags: { deposit: boolean; depositLabel: string; voucher: boolean; newsletter: boolean }
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

type Draft = Omit<BookingPageEditorInitial, 'variant' | 'maxPax' | 'bookingRules' | 'notificationPrefs' | 'featureModules' | 'flags'>
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
  const { variant: _v, maxPax: _mp, bookingRules: _br, notificationPrefs: _np, featureModules: _fm, flags: _fl, ...rest } = i
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
  const [langMenu, setLangMenu] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  // Telefonon (lg alatt) nincs eszközváltó: mindig a mobil előnézet, és a kijelölt elem
  // panelje alulról felcsúszó lapként jelenik meg (a tartalom közös, a desktopra is hat).
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
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
        bookingWindowDays: draft.bookingWindowDays,
        requirePhone: draft.requirePhone,
        addressRequired: draft.requireAddress,
        addressRequiredNote: draft.requireAddressNote || null,
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

  // Az előnézet üzenetei: `ready` → küldjük a draftot + kijelölést; `pick` → kijelölés.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isEditorMessage<PreviewToEditor>(e) || e.source !== frameRef.current?.contentWindow) return
      if (e.data.type === 'ready') setReady(true)
      else if (e.data.type === 'pick') setSel(e.data.id)
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
      if (['showServiceCount', 'showStaffCount', 'servicesExpandedOnMain', 'autoConfirm', 'requireAddress', 'requireAddressNote', 'sectionOrder', 'hiddenSections', 'minLeadHours', 'fieldOrder'].some((k) => changed(k as keyof Draft))) {
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
        }
      }
      if (changed('bookingWindowDays')) body.booking_window_days = d.bookingWindowDays
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
  const scale = canvasW > 0 ? Math.min(1, canvasW / frame.w) : 0
  // A MENTETT azonosítón fut az előnézet (a még nem mentett új URL-en nincs oldal).
  const src = `/${baseline.slug}?editor=1${lang !== 'hu' ? `&lang=${lang}` : ''}`
  // Új nyelv = új iframe-betöltés: a `ready` üzenetig nem küldünk semmit.
  useEffect(() => { setReady(false) }, [src])

  const consentOn = draft.consentEnabled && !!draft.consentText.trim()
  const flow = STEPS.filter((st) =>
    st.id === 'deposit' ? initial.flags.deposit : st.id === 'consent' ? consentOn : st.id === 'voucher' ? initial.flags.voucher : true)
  // Kikapcsolt lépésen maradni nincs értelme — vissza az Adatokra.
  useEffect(() => { if (!flow.some((f) => f.id === step)) setStep('details') }, [flow, step])
  const goStep = (id: EditorView) => { setStep(id); setSel(null) }
  const setRem = (patch: Partial<Draft['reminders']>) => setDraft((d) => ({ ...d, reminders: { ...d.reminders, ...patch } }))
  const remHours = reminderHoursOf(draft.reminders)
  const rulesSummary: { label: string; value: string; step: EditorView; sel: string | null; off?: boolean }[] = [
    { label: 'Foglalható előre', value: `${draft.bookingWindowDays} nap`, step: 'datetime', sel: 'rules' },
    isRestaurant
      ? { label: 'Foglalás hossza', value: `${draft.turnMinutes} perc`, step: 'datetime', sel: 'rules' }
      : { label: 'Szünet a foglalások között', value: draft.bufferMinutes ? `${draft.bufferMinutes} perc` : 'Nincs', step: 'datetime', sel: 'rules', off: !draft.bufferMinutes },
    { label: 'Minimum idő előtte', value: draft.minLeadHours ? `${draft.minLeadHours} óra` : 'Nincs', step: 'datetime', sel: 'rules', off: !draft.minLeadHours },
    { label: 'Automatikus megerősítés', value: draft.autoConfirm ? 'Be' : 'Ki', step: 'success', sel: 'confirm', off: !draft.autoConfirm },
    { label: 'Visszaigazoló e-mail', value: draft.confirmEmail ? 'Be' : 'Ki', step: 'success', sel: 'confirm', off: !draft.confirmEmail },
    { label: 'Emlékeztető', value: remHours.length ? remHours.map((h) => `${h} ó`).join(', ') : 'Ki', step: 'success', sel: 'confirm', off: !remHours.length },
    { label: 'Telefonszám kötelező', value: draft.requirePhone ? 'Igen' : 'Nem', step: 'details', sel: 'field:phone', off: !draft.requirePhone },
    { label: 'Előleg', value: initial.flags.deposit ? initial.flags.depositLabel : 'Ki', step: initial.flags.deposit ? 'deposit' : 'details', sel: initial.flags.deposit ? 'deposit' : null, off: !initial.flags.deposit },
  ]

  const staffId = sel?.startsWith('staff:') ? sel.slice(6) : null
  const member = staffId ? draft.staff.find((m) => m.id === staffId) ?? null : null
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const publicUrl = `${origin}/${baseline.slug}`

  const stepLabel = STEPS.find((st) => st.id === step)?.label ?? ''
  const title = member ? member.name : sel ? ELEMENT_TITLES[sel] ?? 'Elem' : step === 'main' ? 'Az oldal elemei' : stepLabel

  return (
    <div className="space-y-4">
      {/* Fejléc: eszköz + szerkesztett nyelv */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-soft">{narrow ? 'Koppints bármire az oldalon — alulról jön a szerkesztő.' : 'Kattints bármire az oldalon — jobbra szerkesztheted.'}</p>
        <div className="flex items-center gap-2">
          <div className="hidden gap-1 rounded-full border border-line bg-white/60 p-1 lg:flex">
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangMenu((o) => !o)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white/75 px-4 text-[13px] font-semibold text-ink"
            >
              {langLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" strokeWidth={1.8} />}
              {LOCALE_LABELS[lang]}
            </button>
            {langMenu && (
              <div className="absolute right-0 top-12 z-30 w-52 rounded-[18px] border border-line bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(70,60,20,.35)]">
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
            )}
          </div>
        </div>
      </div>

      {/* A foglalás teljes folyamata — a kikapcsolt opcionális lépés nem jelenik meg */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft2">Folyamat</span>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-white/60 p-1">
          {flow.map((st, i) => (
            <span key={st.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => goStep(st.id)}
                className={cn('h-8 rounded-full px-3 text-[12.5px] font-semibold transition-colors', step === st.id ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink')}
              >
                {st.label}
              </button>
              {i < flow.length - 1 && <ChevronRight className="h-3 w-3 text-ink-soft2/60" />}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        {/* Vászon */}
        <div ref={canvasRef} className="min-w-0 flex-1">
          <div className="relative mx-auto" style={{ width: frame.w * scale, height: frame.h * scale }}>
            {scale > 0 && (
              <iframe
                ref={frameRef}
                key={src}
                src={src}
                title="Foglalóoldal előnézet"
                className={cn('absolute left-0 top-0 origin-top-left border-0 bg-[#111]', device === 'mobile' ? 'rounded-[40px] ring-[10px] ring-[#0E0E10]' : 'rounded-[18px] ring-1 ring-line')}
                style={{ width: frame.w, height: frame.h, transform: `scale(${scale})` }}
              />
            )}
          </div>
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
            <div className="-mt-2 flex items-center justify-between">
              <span className="w-9" />
              <span className="h-1 w-10 rounded-full bg-black/15" />
              <button type="button" onClick={() => setSel(null)} aria-label="Bezárás" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-ink-soft">
                <X className="h-4 w-4" />
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
                    <Reorder.Item key={id} value={id} className="flex h-11 cursor-grab items-center gap-2 rounded-[14px] border border-line bg-white pl-2.5 pr-1.5 active:cursor-grabbing">
                      <GripVertical className="h-4 w-4 shrink-0 text-ink-soft2" />
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
                    </Reorder.Item>
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
                      const badge = id === 'name' || id === 'email' ? 'Kötelező'
                        : id === 'phone' ? (draft.requirePhone ? 'Kötelező' : 'Opcionális')
                        : id === 'address' ? (draft.requireAddress || initial.flags.deposit ? 'Kötelező' : 'Opcionális')
                        : id === 'questions' ? `${draft.customQuestions.length} db` : 'Opcionális'
                      return (
                        <Reorder.Item key={id} value={id} className="flex h-11 cursor-grab items-center gap-2 rounded-[14px] border border-line bg-white pl-2.5 pr-1.5 active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 shrink-0 text-ink-soft2" />
                          <button type="button" onClick={() => setSel(selId)} className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium text-ink">
                            {ELEMENT_TITLES[selId]}
                          </button>
                          <span className={cn('shrink-0 rounded-[10px] px-2.5 py-1 text-[11.5px] font-semibold', badge === 'Kötelező' ? 'bg-ink-dark text-gold' : 'bg-black/[0.05] text-ink-soft')}>{badge}</span>
                        </Reorder.Item>
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
              <ToggleRow label="Hozzájáruló nyilatkozat lépés" hint="Elfogadása kötelező a foglaláshoz." checked={draft.consentEnabled} onChange={() => set('consentEnabled', !draft.consentEnabled)} />
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
              <textarea
                rows={5}
                className={cn(fieldCls, 'resize-y leading-relaxed')}
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
                <textarea
                  rows={4}
                  className={cn(fieldCls, 'resize-y leading-relaxed')}
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
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Az utalvány beállításai (összegek, típusok, céges vásárlás) a Fizetés fülön vannak.</p>
              <NavButton onClick={() => onNavigate?.('payments')}>Ajándékutalvány beállításai</NavButton>
            </>
          )}

          {sel === 'rules' && (
            <>
              <Field label="Foglalható napok előre" hint="Naponta automatikusan tovább gördül.">
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={365} className={cn(fieldCls, 'w-24 text-center')} value={draft.bookingWindowDays}
                    onChange={(e) => set('bookingWindowDays', Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
                  <span className="text-[13px] text-ink-soft">nap</span>
                </div>
              </Field>
              <Chips options={[30, 60, 90, 180].map((v) => ({ label: `${v} nap`, on: draft.bookingWindowDays === v, onClick: () => set('bookingWindowDays', v) }))} />
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
              <ToggleRow label="Automatikus megerősítés" hint="Kikapcsolva te hagyod jóvá; a vendég „beérkezett” üzenetet lát." checked={draft.autoConfirm} onChange={() => set('autoConfirm', !draft.autoConfirm)} />
              <ToggleRow label="Visszaigazoló e-mail a vendégnek" hint={draft.autoConfirm ? 'Azonnal a foglalás után.' : 'Amikor jóváhagyod.'} checked={draft.confirmEmail} onChange={() => set('confirmEmail', !draft.confirmEmail)} />
              <div className="border-t border-line pt-4">
                <ToggleRow label="Automata emlékeztetők" hint="A foglalás előtt." checked={draft.reminders.on} onChange={() => setRem({ on: !draft.reminders.on })} />
              </div>
              {draft.reminders.on && (
                <>
                  <Field group label="Időzítés a foglalás előtt">
                    <Chips options={REMINDER_CHIPS.map(([k, label]) => ({ label, on: draft.reminders[k], onClick: () => setRem({ [k]: !draft.reminders[k] }) }))} />
                  </Field>
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
                    Egyedi:
                    <input type="number" min={1} max={336} placeholder="pl. 72" className={cn(fieldCls, 'w-20 text-center')} value={draft.reminders.custom ?? ''}
                      onChange={(e) => setRem({ custom: e.target.value === '' ? null : Math.max(1, Math.min(336, Math.round(Number(e.target.value)) || 1)) })} />
                    órával előtte
                  </div>
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
            <ToggleRow label="Kötelező kitölteni" checked={draft.requirePhone} onChange={() => set('requirePhone', !draft.requirePhone)} />
          )}
          {sel === 'field:address' && (
            <>
              <ToggleRow label="Cím megadása mindig kötelező" hint={initial.flags.deposit ? 'Előleg mellett mindenképp kötelező.' : undefined} checked={draft.requireAddress} onChange={() => set('requireAddress', !draft.requireAddress)} />
              {draft.requireAddress && (
                <Field label="Miért kéred? (a vendég látja a mező alatt)">
                  <input className={fieldCls} value={draft.requireAddressNote} placeholder="Pl. a házhoz menő szolgáltatáshoz kell" onChange={(e) => set('requireAddressNote', e.target.value)} />
                </Field>
              )}
            </>
          )}
          {sel === 'field:notes' && <p className="text-[12.5px] leading-relaxed text-ink-soft">Szabad szöveges megjegyzés — mindig opcionális.</p>}

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
                <textarea rows={6} className={cn(fieldCls, 'resize-y leading-relaxed')} value={loc ? loc.consentText : draft.consentText} placeholder={loc ? draft.consentText : undefined}
                  onChange={(e) => (loc ? setLoc({ consentText: e.target.value }) : set('consentText', e.target.value))} />
              </Field>
            </>
          )}

          {sel === 'deposit' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Előleg: <b className="text-ink">{initial.flags.depositLabel}</b>. Az összeget, a visszatérítést és a Stripe-fiókot a Fizetés fülön állítod.</p>
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
              <NavButton onClick={() => onNavigate?.('payments')}>Hírlevél</NavButton>
            </>
          )}

          {sel === 'summary' && <p className="text-[12.5px] leading-relaxed text-ink-soft">Az összegzés a vendég választásaiból és adataiból áll össze — nincs mit szerkeszteni rajta.</p>}

          {sel === 'redeem' && (
            <>
              <p className="text-[12.5px] leading-relaxed text-ink-soft">Csak akkor látszik, ha az ajándékutalvány be van kapcsolva.</p>
              <NavButton onClick={() => onNavigate?.('payments')}>Ajándékutalvány beállításai</NavButton>
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
        </aside>
      </div>
    </div>
  )
}

/* ── Panel-építőkockák ── */

/** Felirat + mező. `group`: gombcsoportnál (chipek, link-lista) `div`, hogy a feliratra
 *  kattintás ne „nyomja meg” az első gombot (a `<label>` azt tenné). */
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

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
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
