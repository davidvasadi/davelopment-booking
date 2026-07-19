'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { BookingWindowPicker } from '@/components/dashboard/BookingWindowPicker'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { Camera, Loader2, ImagePlus, X, Trash2, Eye } from 'lucide-react'
import { emailPreviewUrl } from '@/components/settings/emailPreviewUrl'
import { EmailTemplatesEditor } from '@/components/settings/EmailTemplatesEditor'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TermsSectionsEditor, type TermsSection } from '@/components/settings/TermsSectionsEditor'
import { GoodToKnowEditor, type GoodToKnowItem } from '@/components/settings/GoodToKnowEditor'
import { EventTypesEditor, type EventTypeItem } from '@/components/settings/EventTypesEditor'
import { SupportedLocalesPicker } from '@/components/settings/SupportedLocalesPicker'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { useLocalizedFields } from '@/components/settings/useLocalizedFields'
import { useSettingsFormContext } from '@/components/settings/settingsFormContext'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import type { Media } from '@/payload/payload-types'

/** Fülenkénti mentés-sáv: csak akkor aktív, ha az adott fülön van változás.
 *  Opcionális `onPreview` esetén a Mentés mellett egy „Előnézet" gomb is megjelenik. */
function SaveBar({ dirty, submitting, onSave, onPreview }: { dirty: boolean; submitting: boolean; onSave: () => void; onPreview?: () => void }) {
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2.5 rounded-[20px] border border-line bg-[var(--dav-glass-strong)] p-2.5 shadow-dav-card backdrop-blur sm:static sm:flex-nowrap sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || submitting}
        className="h-12 flex-1 px-6 rounded-dav-pill bg-ink-dark hover:opacity-90 text-white font-semibold text-sm transition-opacity disabled:opacity-40 sm:h-11 sm:flex-none"
      >
        {submitting ? 'Mentés...' : 'Mentés'}
      </button>
      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          className="h-12 px-5 rounded-dav-pill border border-line-strong text-ink hover:bg-paper font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2 sm:h-11"
        >
          <Eye className="h-4 w-4" />
          Előnézet
        </button>
      )}
      {dirty && <span className="w-full text-center text-xs font-medium text-gold sm:w-auto sm:text-left">Mentetlen változások</span>}
    </div>
  )
}

/** davelopment fül-navigáció (üveg konténer, aktív = ink pill). */
function TabsNav({ tabs, active, onSelect }: { tabs: { id: string; label: string; dirty?: boolean }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div className="-mx-5 flex gap-1 overflow-x-auto rounded-none border-y border-line bg-[var(--dav-glass)] px-5 py-1.5 no-scrollbar sm:mx-0 sm:rounded-2xl sm:border sm:px-1 sm:py-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-dav-pill px-4 py-2.5 text-[13px] font-semibold transition-colors sm:py-2 ${
            active === t.id ? 'bg-ink-dark text-white' : 'text-ink-soft2 hover:text-ink'
          }`}
        >
          {t.label}
          {t.dirty && <span title="Mentetlen változás" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
        </button>
      ))}
    </div>
  )
}

/** davelopment kapcsoló: be = ink track + sárga gomb, ki = világos. */
function ToggleSwitch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-soft">{description}</span>}
      </span>
      <span className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors ${checked ? 'bg-ink-dark' : 'bg-[#DAD6C8]'}`}>
        <span
          className={`absolute top-[3px] h-[21px] w-[21px] rounded-full shadow-sm transition-all ${
            checked ? 'right-[3px] bg-gold' : 'left-[3px] bg-white'
          }`}
        />
      </span>
    </button>
  )
}

type Settings = {
  name: string
  city: string
  address: string
  phone: string
  email: string
  website: string
  turn_duration_minutes: number
  slot_step_minutes: number
  last_seating_buffer_minutes: number
  lead_time_hours: number
  booking_window_days: number
  require_phone: boolean
  notify_new_bookings: boolean
  booking_email_subject: string
  booking_email_intro: string
  cancel_email_subject: string
  cancel_email_intro: string
  reminder_email_subject: string
  reminder_email_intro: string
  feedback_email_subject: string
  feedback_email_intro: string
  email_show_phone: boolean
  email_contact_phone: string
  email_show_email: boolean
  email_show_address: boolean
  email_show_directions: boolean
  email_directions_address: string
  legal_name: string
  tax_number: string
  company_reg_number: string
  registered_seat: string
  terms_sections: TermsSection[]
  good_to_know: GoodToKnowItem[]
  event_types: EventTypeItem[]
}

// Crextio/Apple mező: tiszta fehér + meleg hajszálvékony keret + arany fókusz-gyűrű (NINCS krém fill).
const inputClass =
  'h-[50px] w-full rounded-[14px] bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 transition-colors focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:border-gold/60'
const labelClass = 'text-[12.5px] font-medium text-ink-soft'

// A Nyitvatartás/Foglalások kártya-mintája: bordered + fejléc-elválasztó + 15px semibold cím.
function Section({ title, children, full, id }: { title: string; children: React.ReactNode; full?: boolean; id?: string }) {
  return (
    <div id={id} className={`rounded-[26px] dav-card-glass overflow-hidden font-onest scroll-mt-6 ${full ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
        <span className="text-[15px] font-semibold text-ink">{title}</span>
      </div>
      <div className="px-5 py-5 space-y-4 sm:px-6">{children}</div>
    </div>
  )
}

function mediaUrl(field: string | Media | null | undefined): string | null {
  if (!field || typeof field !== 'object') return null
  return (field as Media).url ?? null
}
function mediaId(field: string | Media | null | undefined): number | null {
  if (!field || typeof field !== 'object') return null
  return Number((field as Media).id)
}

export function RestaurantSettingsForm({
  restaurantId,
  restaurantName,
  businessCount = 1,
  slug,
  initial,
  supportedLocales,
  logo,
  coverImage,
  controlledTab,
  hideTabsNav = false,
}: {
  restaurantId: number | string
  restaurantName: string
  businessCount?: number
  slug: string
  initial: Settings
  supportedLocales?: (Locale | string)[] | null
  logo?: string | Media | null
  coverImage?: string | Media | null
  /** Ha megadva, a Beállítások-hub bal listája vezérli az aktív fület (nincs belső fül-sor). */
  controlledTab?: string
  hideTabsNav?: boolean
}) {
  // Több-üzlet: ha a fióknak több üzlete van, csak EZT az éttermet töröljük (a fiók marad).
  const isLastBusiness = businessCount <= 1
  const router = useRouter()
  const [form, setForm] = useState<Settings>(initial)
  const [saved, setSaved] = useState<Settings>(initial) // utoljára elmentett állapot (dirty-hez)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  // ── Nyelvek: a tulaj által a foglalón kínált nyelvkészlet (HU mindig fix alap) ──
  const [supportedExtras, setSupportedExtras] = useState<Locale[]>(
    resolveAvailableLocales(supportedLocales).filter((l) => l !== 'hu'),
  )
  const [savedSupported, setSavedSupported] = useState<Locale[]>(supportedExtras)
  const supportedDirty = JSON.stringify(supportedExtras) !== JSON.stringify(savedSupported)

  // ── Localizált tartalom (email tárgy/intro, „jó tudni", feltételek) per-nyelv ──
  const loc = useLocalizedFields({
    collection: 'restaurants',
    id: restaurantId,
    supported: ['hu', ...savedSupported],
    huValues: {
      booking_email_subject: initial.booking_email_subject,
      booking_email_intro: initial.booking_email_intro,
      cancel_email_subject: initial.cancel_email_subject,
      cancel_email_intro: initial.cancel_email_intro,
      reminder_email_subject: initial.reminder_email_subject,
      reminder_email_intro: initial.reminder_email_intro,
      feedback_email_subject: initial.feedback_email_subject,
      feedback_email_intro: initial.feedback_email_intro,
      terms_sections: initial.terms_sections.map((s) => ({ title: s.title ?? '', body: s.body ?? '' })),
      good_to_know: initial.good_to_know.map((g) => ({ icon: g.icon ?? 'info', title: g.title ?? '', body: g.body ?? '' })),
      event_types: initial.event_types.map((e) => ({ icon: e.icon ?? 'party', label: e.label ?? '', enabled: e.enabled ?? true })),
    },
  })

  const saveSupported = async (): Promise<boolean> => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/restaurants/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ supported_locales: ['hu', ...supportedExtras] }),
      })
      if (!res.ok) throw new Error()
      setSavedSupported(supportedExtras)
      toast.success('Nyelvek mentve')
      router.refresh()
      return true
    } catch {
      toast.error('Hiba történt')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  // ── Fülek + mentetlen-változás védelem ──────────────────────────
  // Melyik mező melyik fülhöz tartozik (dirty-követés + per-tab mentés).
  // A localizált mezőket (good_to_know, terms_sections, booking_email_*) a `loc` hook kezeli.
  const TAB_FIELDS: Record<string, (keyof Settings)[]> = {
    general: ['name', 'city', 'address', 'phone', 'email', 'website'],
    booking: [
      'turn_duration_minutes', 'slot_step_minutes', 'last_seating_buffer_minutes',
      'lead_time_hours', 'booking_window_days', 'require_phone', 'notify_new_bookings',
    ],
    email: ['email_show_phone', 'email_contact_phone', 'email_show_email', 'email_show_address', 'email_show_directions', 'email_directions_address'],
    documents: ['legal_name', 'tax_number', 'company_reg_number', 'registered_seat'],
  }
  const LOC_TABS = new Set(['general', 'email', 'documents'])
  const [internalTab, setActiveTab] = useState('general')
  // Vezérelt mód: ha a Beállítások-hub Providere körénk renderel, a context/prop dönt a fülről
  // ÉS elrejtjük a saját vízszintes fül-sort; különben a belső állapot + saját fülsor.
  const hubCtx = useSettingsFormContext()
  const embedded = hubCtx != null
  const activeTab = hubCtx?.controlledTab ?? controlledTab ?? internalTab
  // Fülváltáskor, ha van mentetlen változás, ide tesszük a célfület és rákérdezünk.
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  // Az „Általános" fülön a logó/borító képváltozás is dirty-nek számít.
  const tabDirty = (tab: string): boolean => {
    const fields = TAB_FIELDS[tab] ?? []
    const fieldDirty = fields.some((k) => form[k] !== saved[k])
    const locDirty = LOC_TABS.has(tab) && loc.dirty
    if (tab === 'general') return fieldDirty || logoModified || coverModified || locDirty
    if (tab === 'languages') return supportedDirty
    return fieldDirty || locDirty
  }

  const [logoId, setLogoId] = useState<number | null>(mediaId(logo))
  const [logoPreview, setLogoPreview] = useState<string | null>(mediaUrl(logo))
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoModified, setLogoModified] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  const [coverId, setCoverId] = useState<number | null>(mediaId(coverImage))
  const [coverPreview, setCoverPreview] = useState<string | null>(mediaUrl(coverImage))
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverModified, setCoverModified] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)

  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const publicUrl = `${origin}/${slug}`

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const uploadImage = async (
    file: File,
    setPreview: (url: string | null) => void,
    setId: (id: number | null) => void,
    setUploading: (v: boolean) => void,
    setModified: (v: boolean) => void,
  ) => {
    setUploading(true)
    setPreview(URL.createObjectURL(file))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setId(json.doc.id)
      setPreview(json.doc.url)
      setModified(true)
    } catch {
      toast.error('Kép feltöltése sikertelen')
      setPreview(null)
      setId(null)
    } finally {
      setUploading(false)
    }
  }

  const removeImage = async (
    currentId: number | null,
    setPreview: (url: string | null) => void,
    setId: (id: number | null) => void,
    setModified: (v: boolean) => void,
    ref: React.RefObject<HTMLInputElement | null>,
  ) => {
    if (currentId) {
      await fetch(`/api/media/${currentId}`, { method: 'DELETE', credentials: 'include' })
    }
    setPreview(null)
    setId(null)
    setModified(true)
    if (ref.current) ref.current.value = ''
  }

  const deleteAccount = async () => {
    if (deleteConfirm.trim() !== restaurantName.trim()) return
    setDeleting(true)
    try {
      const res = await fetch('/api/restaurant/delete-account', { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = (await res.json().catch(() => null)) as { accountDeleted?: boolean } | null
      // Több-üzlet: ha csak ezt az éttermet töröltük, maradunk a dashboardon a következő
      // aktív üzlettel; ha a teljes fiók törlődött, megyünk a login-ra.
      if (data?.accountDeleted) {
        router.push('/login')
      } else {
        router.push('/restaurant')
        router.refresh()
      }
    } catch {
      toast.error('Hiba történt a törlés során')
      setDeleting(false)
    }
  }

  // A megadott mezőket (+ opcionálisan a médiát) PATCH-eli, majd frissíti a
  // `saved` baseline-t és nullázza az érintett dirty-jelzőket.
  const persist = async (fields: (keyof Settings)[], includeMedia: boolean): Promise<boolean> => {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {}
      for (const k of fields) body[k] = form[k]
      if (includeMedia && logoModified) body.logo = logoId ?? null
      if (includeMedia && coverModified) body.cover_image = coverId ?? null
      const res = await fetch(`/api/restaurants/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setSaved((s) => {
        const next = { ...s }
        for (const k of fields) (next[k] as Settings[keyof Settings]) = form[k]
        return next
      })
      if (includeMedia) { setLogoModified(false); setCoverModified(false) }
      toast.success('Beállítások mentve')
      router.refresh()
      return true
    } catch {
      toast.error('Hiba történt')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const saveTab = async (tab: string): Promise<boolean> => {
    if (tab === 'languages') return saveSupported()
    const okFields = await persist(TAB_FIELDS[tab] ?? [], tab === 'general')
    let okLoc = true
    if (LOC_TABS.has(tab) && loc.dirty) okLoc = await loc.saveLocale()
    return okFields && okLoc
  }
  const saveAll = () =>
    persist(Object.values(TAB_FIELDS).flat(), true)

  // Egy fül változásainak elvetése — vissza az utoljára mentett állapotra. A hub közös mentés-sávja
  // ÉS a fülváltás-ConfirmDialog is ezt hívja (a localizált mezőket a `loc` hook kezeli, nem itt).
  const discardTab = (tab: string) => {
    setForm((f) => {
      const next = { ...f }
      for (const k of (TAB_FIELDS[tab] ?? [])) (next[k] as Settings[keyof Settings]) = saved[k]
      return next
    })
    if (tab === 'general') {
      setLogoModified(false); setLogoPreview(mediaUrl(logo)); setLogoId(mediaId(logo))
      setCoverModified(false); setCoverPreview(mediaUrl(coverImage)); setCoverId(mediaId(coverImage))
    }
    if (tab === 'languages') setSupportedExtras(savedSupported)
  }

  // Fülváltás: ha az aktuális fülön van mentetlen változás, rákérdezünk.
  const requestTab = (id: string) => {
    if (id === activeTab) return
    if (tabDirty(activeTab)) setPendingTab(id)
    else setActiveTab(id)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void saveAll()
  }

  const tabs = [
    { id: 'general', label: 'Általános', dirty: tabDirty('general') },
    { id: 'booking', label: 'Foglalás', dirty: tabDirty('booking') },
    { id: 'languages', label: 'Nyelvek', dirty: tabDirty('languages') },
    { id: 'email', label: 'Email', dirty: tabDirty('email') },
    { id: 'documents', label: 'Dokumentumok', dirty: tabDirty('documents') },
    { id: 'danger', label: 'Veszélyzóna' },
  ]

  // ── Beágyazott mód: az aktív fül mentetlen-állapotát FELFELÉ jelezzük a hub közös mentés-sávjának,
  //    és regisztráljuk a mentés/elvetés műveletet. A műveletek friss closure-t olvasnak ref-en át,
  //    így az egyszeri regisztráció is a legutóbbi állapottal (aktív fül, mezők) fut.
  const currentDirty = tabDirty(activeTab)
  const activeTabRef = useRef(activeTab); activeTabRef.current = activeTab
  const saveTabRef = useRef(saveTab); saveTabRef.current = saveTab
  const discardRef = useRef(discardTab); discardRef.current = discardTab
  const reportDirty = hubCtx?.reportDirty
  const registerApi = hubCtx?.registerApi
  useEffect(() => { reportDirty?.(currentDirty) }, [currentDirty, reportDirty])
  useEffect(() => {
    registerApi?.({
      save: () => saveTabRef.current(activeTabRef.current),
      discard: () => discardRef.current(activeTabRef.current),
    })
  }, [registerApi])

  return (
    <>
    <form onSubmit={onSubmit} className="space-y-5">
      {!embedded && !hideTabsNav && <TabsNav tabs={tabs} active={activeTab} onSelect={requestTab} />}

      {activeTab === 'general' && (
      <div className="flex flex-col gap-[5px]">

      {/* Cover image */}
      <Section id="cover" title="Borítókép" full>
        <div className="relative">
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="group relative w-full h-40 rounded-2xl overflow-hidden bg-white border border-dashed border-line-strong flex items-center justify-center hover:border-ink/25 transition-colors"
          >
            {uploadingCover ? (
              <Loader2 className="h-6 w-6 text-ink-soft animate-spin" />
            ) : coverPreview ? (
              <>
                <img src={coverPreview} alt="Borítókép" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-ink-soft">
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs">Borítókép feltöltése</span>
              </div>
            )}
          </button>
          {coverPreview && !uploadingCover && (
            <button
              type="button"
              aria-label="Borítókép eltávolítása"
              onClick={() => removeImage(coverId, setCoverPreview, setCoverId, setCoverModified, coverRef)}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/80 flex items-center justify-center hover:bg-bad transition-colors"
            >
              <X className="h-3 w-3 text-white" />
            </button>
          )}
        </div>
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) uploadImage(f, setCoverPreview, setCoverId, setUploadingCover, setCoverModified)
          }}
        />
      </Section>

      {/* Logo + name */}
      <Section id="general" title="Alap adatok">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className={`${labelClass} block`}>Logó</Label>
            <div className="relative w-fit">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="group relative flex h-20 min-w-20 max-w-[220px] items-center justify-center rounded-2xl overflow-hidden bg-white border border-dashed border-line-strong px-3 hover:border-ink/25 transition-colors"
              >
                {uploadingLogo ? (
                  <Loader2 className="h-5 w-5 text-ink-soft animate-spin" />
                ) : logoPreview ? (
                  <>
                    <img src={logoPreview} alt="Logó" className="h-full w-auto max-w-full object-contain" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="h-4 w-4 text-white" />
                    </div>
                  </>
                ) : (
                  <Camera className="h-5 w-5 text-ink-soft" />
                )}
              </button>
              {logoPreview && !uploadingLogo && (
                <button
                  type="button"
                  onClick={() => removeImage(logoId, setLogoPreview, setLogoId, setLogoModified, logoRef)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/80 flex items-center justify-center hover:bg-bad transition-colors"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              PNG vagy SVG, áttetsző háttérrel a legjobb.
            </p>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) uploadImage(f, setLogoPreview, setLogoId, setUploadingLogo, setLogoModified)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Étterem neve *</Label>
            <Input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
        </div>
      </Section>

      <Section id="contact" title="Elérhetőség">
        <div className="space-y-1.5">
          <Label className={labelClass}>Város</Label>
          <Input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass}>Cím</Label>
          <Input className={inputClass} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Utca, házszám" />
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass}>Telefon</Label>
          <Input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" />
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass}>Email</Label>
          <Input className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} type="email" />
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass}>Weboldal</Label>
          <Input className={inputClass} value={form.website} onChange={(e) => set('website', e.target.value)} type="url" placeholder="https://" />
        </div>
      </Section>

      {/* Public booking URL */}
      <Section id="booking-url" title="Nyilvános foglaló oldal" full>
        <p className="text-xs text-ink-soft">Ezen a linken tudnak a vendégek online asztalt foglalni.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 h-11 flex items-center px-4 rounded-[14px] bg-paper border border-line text-sm text-ink truncate">
            {publicUrl}
          </code>
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-5 rounded-dav-pill border border-line-strong text-sm font-semibold text-ink hover:border-ink/40 transition-colors flex items-center justify-center shrink-0"
          >
            Megnyitás
          </a>
        </div>
      </Section>

      <Section id="good-to-know" title="Jó tudni (foglaló oldal)" full>
        <p className="text-xs text-ink-soft">
          Saját „Jó tudni" pontok (cím + szöveg) a nyilvános foglaló oldalon, az automatikus kártyák (foglalási idő, legkorábbi foglalás) alatt. Pl. „Módosítás: az adott napon csak telefonon".
        </p>
        <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
        <GoodToKnowEditor value={loc.current.good_to_know} onChange={(v) => loc.setField('good_to_know', v)} locale={loc.editLocale} />
      </Section>

      <Section title="Esemény-típusok (alkalmak)" full>
        <p className="text-xs text-ink-soft">
          Milyen alkalomból foglalhat a vendég — a foglaláskor választhat ezekből (pl. Születésnap, Évforduló, Céges vacsora). A kikapcsoltak nem jelennek meg. Ha egy sincs, az alapkészletet kínáljuk fel.
        </p>
        <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
        <EventTypesEditor value={loc.current.event_types} onChange={(v) => loc.setField('event_types', v)} />
      </Section>

      {!embedded && (
        <div className="lg:col-span-2">
          <SaveBar dirty={tabDirty('general')} submitting={submitting} onSave={() => saveTab('general')} />
        </div>
      )}
      </div>
      )}

      {activeTab === 'booking' && (
      <div className="space-y-[5px]">
      <Section id="booking-settings" title="Foglalási beállítások">
        {/* Desktopon kétoszlopos: BAL = a 4 szám-beállító (egymás alatt) + alattuk a
            kapcsolók; JOBB = a naptár. Mobilon/tableten egymás alatt, a naptár full. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Bal oszlop */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label className={labelClass}>Foglalás hossza (perc)</Label>
                <NumberStepper
                  value={form.turn_duration_minutes}
                  onChange={(n) => set('turn_duration_minutes', n)}
                  min={30}
                  max={480}
                  step={15}
                  suffix="perc"
                  presets={[60, 90, 120, 150, 180]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Időpont-lépték (perc)</Label>
                <NumberStepper
                  value={form.slot_step_minutes}
                  onChange={(n) => set('slot_step_minutes', n)}
                  min={5}
                  max={120}
                  step={5}
                  suffix="perc"
                  presets={[15, 30, 45, 60]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Utolsó foglalás zárás előtt (perc)</Label>
                <NumberStepper
                  value={form.last_seating_buffer_minutes}
                  onChange={(n) => set('last_seating_buffer_minutes', n)}
                  min={0}
                  max={240}
                  step={15}
                  suffix="perc"
                  presets={[0, 30, 60, 90, 120]}
                />
                <p className="text-xs text-ink-soft">
                  0 = zárásig foglalható. Ha a foglalás hosszára állítod, csak az fér be, ami zárásig véget ér.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>Min. előfoglalás (óra)</Label>
                <NumberStepper
                  value={form.lead_time_hours}
                  onChange={(n) => set('lead_time_hours', n)}
                  min={0}
                  max={168}
                  step={1}
                  suffix="óra"
                  presets={[0, 1, 2, 4, 12, 24]}
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-line pt-4">
              <ToggleSwitch
                checked={form.require_phone}
                onChange={(v) => set('require_phone', v)}
                label="Telefonszám kötelező a vendégnek"
              />
              <ToggleSwitch
                checked={form.notify_new_bookings}
                onChange={(v) => set('notify_new_bookings', v)}
                label="Értesítés új foglalásokról"
                description="Értesítést kapsz az alkalmazáson belül új foglalásról és lemondásról."
              />
            </div>
          </div>

          {/* Jobb oszlop: naptár (full a saját oszlopában) */}
          <div className="space-y-1.5">
            <Label className={labelClass}>Foglalható napok előre</Label>
            <BookingWindowPicker
              value={form.booking_window_days}
              onChange={(days) => set('booking_window_days', days)}
            />
            <p className="text-xs text-ink-soft">Jelöld ki a naptárban az utolsó napot, ameddig a vendégek előre foglalhatnak.</p>
          </div>
        </div>
      </Section>

      {!embedded && <SaveBar dirty={tabDirty('booking')} submitting={submitting} onSave={() => saveTab('booking')} />}
      </div>
      )}

      {activeTab === 'languages' && (
      <div className="space-y-[5px]">
      <Section title="Foglalón kínált nyelvek">
        <p className="text-xs text-ink-soft -mt-1">
          Mely nyelveken választhatnak a vendégek a foglaló oldalon. A magyar mindig elérhető (alap, és tartalék
          azokra a szövegekre, amiket egy másik nyelven nem adsz meg). A bekapcsolt nyelvekhez az „Email",
          „Dokumentumok" és a „Jó tudni" résznél tudsz nyelvenkénti szöveget beírni a nyelvváltóval.
        </p>
        <SupportedLocalesPicker value={supportedExtras} onChange={setSupportedExtras} />
        {supportedExtras.length === 0 && (
          <p className="text-xs text-ink-soft">
            Csak magyar — a foglalón nem jelenik meg nyelvválasztó.
          </p>
        )}
      </Section>
      {!embedded && <SaveBar dirty={tabDirty('languages')} submitting={submitting} onSave={() => saveTab('languages')} />}
      </div>
      )}

      {activeTab === 'email' && (
      <div className="space-y-[5px]">
        {/* Email-sablonok — típusonkénti (visszaigazolás/lemondás/emlékeztető/visszajelzés) tárgy + bevezető */}
        <Section title="Email-sablonok">
          <EmailTemplatesEditor
            variant="restaurant"
            loc={loc}
            onPreview={(state, intro) => window.open(emailPreviewUrl('restaurant', form, loc.editLocale, state, intro), '_blank', 'noopener')}
          />
        </Section>

        {/* Kapcsolat & útvonal */}
        <Section title="Kapcsolat & útvonal">
          <p className="text-xs text-ink-soft">
            A visszaigazoló email alján egy „Módosítanád a foglalást? Keress minket" blokk jelenik meg a bekapcsolt elemekkel.
          </p>

          <div className="rounded-[16px] border border-line divide-y divide-line">
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_phone} onChange={(v) => set('email_show_phone', v)} label="Telefonszám" />
              {form.email_show_phone && (
                <div className="space-y-1.5 mt-3">
                  <Input
                    className={inputClass}
                    value={form.email_contact_phone}
                    onChange={(e) => set('email_contact_phone', e.target.value)}
                    placeholder="Módosítási telefonszám (ha üres, a nyilvános)"
                  />
                </div>
              )}
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_email} onChange={(v) => set('email_show_email', v)} label="Email cím" />
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_address} onChange={(v) => set('email_show_address', v)} label="Cím" />
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={form.email_show_directions} onChange={(v) => set('email_show_directions', v)} label="Útvonaltervezés gomb" description="Google Mapsben nyitja meg a helyet." />
              {form.email_show_directions && (
                <div className="space-y-1.5 mt-3">
                  <Input
                    className={inputClass}
                    value={form.email_directions_address}
                    onChange={(e) => set('email_directions_address', e.target.value)}
                    placeholder="Cím vagy Google Maps-link (ha üres, a fenti cím)"
                  />
                </div>
              )}
            </div>
          </div>
        </Section>

        {!embedded && <SaveBar dirty={tabDirty('email')} submitting={submitting} onSave={() => saveTab('email')} onPreview={() => window.open(emailPreviewUrl('restaurant', { ...form, booking_email_intro: loc.current.booking_email_intro }, loc.editLocale), '_blank', 'noopener')} />}
      </div>
      )}

      {activeTab === 'documents' && (
      <div className="space-y-[5px]">
      <Section title="Cégadatok">
        <p className="text-xs text-ink-soft">
          A „Szolgáltató adatai" blokk ezekből áll össze a Foglalási feltételek elején (a foglaló oldalon és emailben). Üres mezők kimaradnak.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelClass}>Hivatalos cégnév</Label>
            <Input className={inputClass} value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} placeholder="pl. Példa Kft." />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Adószám</Label>
            <Input className={inputClass} value={form.tax_number} onChange={(e) => set('tax_number', e.target.value)} placeholder="12345678-2-42" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Cégjegyzékszám</Label>
            <Input className={inputClass} value={form.company_reg_number} onChange={(e) => set('company_reg_number', e.target.value)} placeholder="01-09-123456" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Székhely</Label>
            <Input className={inputClass} value={form.registered_seat} onChange={(e) => set('registered_seat', e.target.value)} placeholder="1051 Budapest, Példa u. 1." />
          </div>
        </div>
      </Section>

      <Section title="Foglalási feltételek">
        <p className="text-xs text-ink-soft">
          Szakaszonként add meg a feltételeket (cím + szöveg). Megjelenik a nyilvános foglaló oldalon és a visszaigazoló emailben. Hagyd üresen, ha nincs.
        </p>
        <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
        <TermsSectionsEditor value={loc.current.terms_sections} onChange={(v) => loc.setField('terms_sections', v)} locale={loc.editLocale} />
      </Section>

      {!embedded && <SaveBar dirty={tabDirty('documents')} submitting={submitting} onSave={() => saveTab('documents')} />}
      </div>
      )}

      {activeTab === 'danger' && (
      <div className="overflow-hidden rounded-[26px] border border-bad/30 bg-white font-onest shadow-dav-card">
        <div className="border-b border-bad/20 px-5 py-4 sm:px-6">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-bad">Veszélyzóna</h3>
        </div>
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{isLastBusiness ? 'Fiók törlése' : 'Étterem törlése'}</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {isLastBusiness
                ? 'Minden adat (étterem, foglalások, asztalok, nyitvatartás) véglegesen törlődik.'
                : 'Csak ezt az éttermet törli (foglalások, asztalok, nyitvatartás). A fiókod és a többi üzleted megmarad.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-dav-pill border-[1.5px] border-bad/40 px-5 text-sm font-semibold text-bad transition-colors hover:bg-bad-bg sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            {isLastBusiness ? 'Fiók törlése' : 'Étterem törlése'}
          </button>
        </div>
      </div>
      )}
    </form>

    {/* Fülváltás mentetlen változással — Mentés / Elvetés / Mégse */}
    <ConfirmDialog
      open={pendingTab !== null}
      title="Mentetlen változások"
      description="Ezen a fülön van mentetlen módosításod. Mit szeretnél tenni, mielőtt átváltasz?"
      destructive={false}
      confirmLabel="Mentés"
      tertiaryLabel="Elvetés"
      cancelLabel="Mégse"
      busy={submitting}
      onConfirm={async () => {
        const ok = await saveTab(activeTab)
        if (ok && pendingTab) { setActiveTab(pendingTab); setPendingTab(null) }
      }}
      onTertiary={() => {
        // Elvetés: az aktuális fül mezőit visszaállítjuk az utoljára mentett állapotra.
        discardTab(activeTab)
        if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null) }
      }}
      onCancel={() => setPendingTab(null)}
    />

    {deleteOpen && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-xl"
        onClick={() => { if (!deleting) { setDeleteOpen(false); setDeleteConfirm('') } }}
      >
        <div
          className="w-full max-w-md rounded-[26px] border border-line bg-white p-7 shadow-dav-card lg:p-9"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[16px] bg-bad-bg">
            <Trash2 className="h-6 w-6 text-bad" />
          </div>
          <h3 className="text-[22px] font-medium tracking-[-0.01em] text-ink">
            {isLastBusiness ? 'Fiók törlése' : 'Étterem törlése'}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Ez a művelet <span className="font-semibold text-ink">visszafordíthatatlan</span>.{' '}
            {isLastBusiness
              ? 'Az étterem, a foglalások, asztalok és nyitvatartás véglegesen törlődnek — ez az utolsó üzleted, ezért a teljes fiók is megszűnik.'
              : 'Csak ez az étterem törlődik (a foglalásaival, asztalaival, nyitvatartásával); a fiókod és a többi üzleted megmarad.'}
          </p>
          <p className="mb-2 mt-5 text-xs text-ink-soft">
            A megerősítéshez írd be az étterem nevét: <span className="font-semibold text-ink">{restaurantName}</span>
          </p>
          <Input
            className={inputClass}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={restaurantName}
            autoComplete="off"
            autoFocus
          />
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleting || deleteConfirm.trim() !== restaurantName.trim()}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-dav-pill bg-bad text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Törlés...' : 'Végleges törlés'}
            </button>
            <button
              type="button"
              onClick={() => { setDeleteOpen(false); setDeleteConfirm('') }}
              disabled={deleting}
              className="h-11 rounded-dav-pill border-[1.5px] border-line-strong px-5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink/40"
            >
              Mégse
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}
