'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Salon, Media } from '@/payload/payload-types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { BookingWindowPicker } from '@/components/dashboard/BookingWindowPicker'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { Camera, Loader2, ImagePlus, X, Trash2, Eye } from 'lucide-react'
import { emailPreviewUrl } from '@/components/settings/emailPreviewUrl'
import { EmailVariablesHelp } from '@/components/settings/EmailVariablesHelp'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TermsSectionsEditor } from '@/components/settings/TermsSectionsEditor'
import { GoodToKnowEditor } from '@/components/settings/GoodToKnowEditor'
import { SupportedLocalesPicker } from '@/components/settings/SupportedLocalesPicker'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { useLocalizedFields } from '@/components/settings/useLocalizedFields'
import { useSettingsFormContext } from '@/components/settings/settingsFormContext'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'

/** davelopment input/label osztályok (közös). Touch-barát 50px magasság, gold focus. */
const inputBase =
  'h-[50px] w-full rounded-[14px] bg-paper border-line text-ink placeholder:text-ink-soft2/70 focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:border-gold/50'
const labelBase = 'text-[12.5px] font-medium text-ink-soft'

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
function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
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

/** Fülenkénti mentés-sáv: csak akkor aktív, ha az adott fülön van változás. */
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

const schema = z.object({
  name: z.string().min(1, 'Kötelező'),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Csak kisbetű, szám és kötőjel'),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  booking_buffer_minutes: z.number().min(0).max(120),
  booking_window_days: z.number().min(1).max(365),
  require_phone: z.boolean(),
  notify_new_bookings: z.boolean(),
  email_show_phone: z.boolean(),
  email_contact_phone: z.string().optional(),
  email_show_email: z.boolean(),
  email_show_address: z.boolean(),
  email_show_directions: z.boolean(),
  email_directions_address: z.string().optional(),
  legal_name: z.string().optional(),
  tax_number: z.string().optional(),
  company_reg_number: z.string().optional(),
  registered_seat: z.string().optional(),
})
type FormData = z.infer<typeof schema>

function Section({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-white border border-line rounded-[24px] shadow-dav-card overflow-hidden font-onest ${full ? 'lg:col-span-2' : ''}`}>
      <div className="px-5 pt-5 pb-3.5 sm:px-6">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      </div>
      <div className="px-5 pb-6 space-y-4 sm:px-6">{children}</div>
    </div>
  )
}

function mediaUrl(field: string | Media | null | undefined): string | null {
  if (!field) return null
  if (typeof field === 'object') return (field as Media).url ?? null
  return null
}

// Megegyezik az RestaurantSettingsForm input-stílusával (egységes Veszélyzóna modal).
const inputClass = inputBase

export default function SalonSettingsForm({ salon, businessCount = 1, controlledTab, hideTabsNav = false }: { salon: Salon; businessCount?: number; controlledTab?: string; hideTabsNav?: boolean }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  // Több-üzlet: ha a fióknak több üzlete van, csak EZT a szalont töröljük (a fiók marad).
  const isLastBusiness = businessCount <= 1

  const [logoId, setLogoId] = useState<number | null>(
    salon.logo && typeof salon.logo === 'object' ? Number((salon.logo as Media).id) : null
  )
  const [logoPreview, setLogoPreview] = useState<string | null>(mediaUrl(salon.logo))
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoModified, setLogoModified] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  const [coverId, setCoverId] = useState<number | null>(
    salon.cover_image && typeof salon.cover_image === 'object' ? Number((salon.cover_image as Media).id) : null
  )
  const [coverPreview, setCoverPreview] = useState<string | null>(mediaUrl(salon.cover_image))
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverModified, setCoverModified] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)

  const initialValues: FormData = {
    name: salon.name,
    slug: salon.slug,
    address: salon.address ?? '',
    city: salon.city ?? '',
    postal_code: salon.postal_code ?? '',
    phone: salon.phone ?? '',
    email: salon.email ?? '',
    website: salon.website ?? '',
    booking_buffer_minutes: salon.booking_buffer_minutes ?? 0,
    booking_window_days: salon.booking_window_days ?? 60,
    require_phone: salon.require_phone ?? true,
    notify_new_bookings: salon.notify_new_bookings ?? true,
    email_show_phone: salon.email_show_phone ?? true,
    email_contact_phone: salon.email_contact_phone ?? '',
    email_show_email: salon.email_show_email ?? false,
    email_show_address: salon.email_show_address ?? false,
    email_show_directions: salon.email_show_directions ?? false,
    email_directions_address: salon.email_directions_address ?? '',
    legal_name: salon.legal_name ?? '',
    tax_number: salon.tax_number ?? '',
    company_reg_number: salon.company_reg_number ?? '',
    registered_seat: salon.registered_seat ?? '',
  }
  const { register, handleSubmit, watch, setValue, getValues, reset, formState: { errors, dirtyFields } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })
  // Utoljára elmentett baseline (az „Elvetés"-hez fülenként). Mentéskor frissül.
  const defaultsRef = useRef<FormData>(initialValues)

  // ── Nyelvek: a tulaj által a foglalón kínált nyelvkészlet (HU mindig fix alap) ──
  const [supportedExtras, setSupportedExtras] = useState<Locale[]>(
    resolveAvailableLocales(salon.supported_locales).filter((l) => l !== 'hu'),
  )
  const [savedSupported, setSavedSupported] = useState<Locale[]>(supportedExtras)
  const supportedDirty = JSON.stringify(supportedExtras) !== JSON.stringify(savedSupported)

  // ── Localizált tartalom (email tárgy/intro, „jó tudni", feltételek) per-nyelv ──
  const loc = useLocalizedFields({
    collection: 'salons',
    id: salon.id,
    supported: ['hu', ...savedSupported],
    huValues: {
      booking_email_subject: salon.booking_email_subject ?? '',
      booking_email_intro: salon.booking_email_intro ?? '',
      terms_sections: (salon.terms_sections ?? []).map((s) => ({ title: s.title ?? '', body: s.body ?? '' })),
      good_to_know: (salon.good_to_know ?? []).map((g) => ({ icon: g.icon ?? 'info', title: g.title ?? '', body: g.body ?? '' })),
    },
  })

  const saveSupported = async (): Promise<boolean> => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/salons/${salon.id}`, {
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
  // A localizált mezőket (good_to_know, terms_sections, booking_email_*) a `loc` hook
  // kezeli per-nyelv — NEM kerülnek a normál fülmentésbe.
  const TAB_FIELDS: Record<string, (keyof FormData)[]> = {
    general: ['name', 'slug', 'postal_code', 'city', 'address', 'phone', 'email', 'website'],
    booking: ['booking_buffer_minutes', 'booking_window_days', 'require_phone', 'notify_new_bookings'],
    email: ['email_show_phone', 'email_contact_phone', 'email_show_email', 'email_show_address', 'email_show_directions', 'email_directions_address'],
    documents: ['legal_name', 'tax_number', 'company_reg_number', 'registered_seat'],
  }
  // Mely fülön van localizált tartalom (a `loc.dirty` is számít a fül „mentetlen" jelzésénél).
  const LOC_TABS = new Set(['general', 'email', 'documents'])
  const [internalTab, setActiveTab] = useState('general')
  // Vezérelt mód: ha a Beállítások-hub Providere körénk renderel, a context/prop dönt a fülről
  // ÉS elrejtjük a saját vízszintes fül-sort; különben a belső állapot + saját fülsor.
  const hubCtx = useSettingsFormContext()
  const embedded = hubCtx != null
  const activeTab = hubCtx?.controlledTab ?? controlledTab ?? internalTab
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  const tabDirty = (tab: string): boolean => {
    const fieldDirty = (TAB_FIELDS[tab] ?? []).some((k) => dirtyFields[k])
    const locDirty = LOC_TABS.has(tab) && loc.dirty
    if (tab === 'general') return fieldDirty || logoModified || coverModified || locDirty
    if (tab === 'languages') return supportedDirty
    return fieldDirty || locDirty
  }

  // Az adott fül mezőit (+ az „Általános" fülön a médiát) menti.
  const persist = async (fields: (keyof FormData)[], includeMedia: boolean): Promise<boolean> => {
    setSubmitting(true)
    try {
      const values = getValues()
      const body: Record<string, unknown> = {}
      for (const k of fields) body[k] = values[k]
      if (includeMedia && logoModified) body.logo = logoId ?? null
      if (includeMedia && coverModified) body.cover_image = coverId ?? null
      const res = await fetch(`/api/salons/${salon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      // A baseline frissítése: a mentett értékekkel resetelünk (dirty nullázódik).
      reset(values, { keepValues: true })
      defaultsRef.current = values
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
    // A localizált tartalmat (ha az aktív szerkesztési nyelv ≠ HU vagy dirty) is mentjük.
    let okLoc = true
    if (LOC_TABS.has(tab) && loc.dirty) okLoc = await loc.saveLocale()
    return okFields && okLoc
  }

  const requestTab = (id: string) => {
    if (id === activeTab) return
    if (tabDirty(activeTab)) setPendingTab(id)
    else setActiveTab(id)
  }

  const tabs = [
    { id: 'general', label: 'Általános', dirty: tabDirty('general') },
    { id: 'booking', label: 'Foglalás', dirty: tabDirty('booking') },
    { id: 'languages', label: 'Nyelvek', dirty: tabDirty('languages') },
    { id: 'email', label: 'Email', dirty: tabDirty('email') },
    { id: 'documents', label: 'Dokumentumok', dirty: tabDirty('documents') },
    { id: 'danger', label: 'Veszélyzóna' },
  ]

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
    setDeleting(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = (await res.json().catch(() => null)) as { accountDeleted?: boolean } | null
      // Ha csak egy üzletet töröltünk (van még másik), maradunk a dashboardon az új aktív
      // üzlettel; ha a teljes fiók törlődött, megyünk a login-ra.
      if (data?.accountDeleted) {
        router.push('/login')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('Hiba történt a törlés során')
      setDeleting(false)
    }
  }

  // Globális mentés: minden fül mezője egyben.
  const onSubmit = () => persist(Object.values(TAB_FIELDS).flat(), true)

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {!embedded && !hideTabsNav && <TabsNav tabs={tabs} active={activeTab} onSelect={requestTab} />}

      {activeTab === 'general' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

      {/* Cover image */}
      <Section title="Borítókép" full>
        <p className="text-xs text-ink-soft -mt-1">A nyilvános oldalon a felső sötét sávon jelenik meg háttérként.</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="relative w-full h-36 rounded-2xl overflow-hidden bg-paper border border-line flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {uploadingCover ? (
              <Loader2 className="h-6 w-6 text-ink-soft animate-spin" />
            ) : coverPreview ? (
              <>
                <img src={coverPreview} alt="Borítókép" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                <div className="relative flex flex-col items-center gap-1.5 text-ink-soft">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs font-medium">Csere</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-ink-soft">
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-medium">Borítókép feltöltése</span>
              </div>
            )}
          </button>
          {coverPreview && !uploadingCover && (
            <button
              type="button"
              onClick={() => removeImage(coverId, setCoverPreview, setCoverId, setCoverModified, coverRef)}
              className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-white" />
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

      {/* Logo + basic info */}
      <Section title="Alap adatok">
        <div className="flex flex-col gap-4">
          <div className="shrink-0 space-y-1.5">
            <Label className={labelBase}>Logó</Label>
            {/* object-contain + rugalmas szélesség: a teljes logó látszik (nem négyzetbe vágva). */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="group relative flex h-16 min-w-16 max-w-[220px] items-center justify-center rounded-xl overflow-hidden bg-paper border border-line px-3 hover:bg-paper/70 transition-colors"
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
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/80 flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
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
          <div className="w-full space-y-3">
            <div className="space-y-1.5">
              <Label className={labelBase}>Szalon neve *</Label>
              <Input className={inputBase} {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className={labelBase}>URL azonosító</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-ink-soft">/</span>
                <Input className={`${inputBase} flex-1`} {...register('slug')} />
              </div>
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Elérhetőség">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelBase}>Irányítószám</Label>
            <Input className={inputBase} {...register('postal_code')} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelBase}>Város</Label>
            <Input className={inputBase} {...register('city')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className={labelBase}>Cím</Label>
          <Input className={inputBase} {...register('address')} placeholder="Utca, házszám" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelBase}>Telefon</Label>
            <Input className={inputBase} {...register('phone')} type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelBase}>Email</Label>
            <Input className={inputBase} {...register('email')} type="email" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className={labelBase}>Weboldal</Label>
          <Input className={inputBase} {...register('website')} type="url" placeholder="https://" />
        </div>
      </Section>

      <Section title="Jó tudni (foglaló oldal)" full>
        <p className="text-xs text-ink-soft -mt-1">
          Saját „Jó tudni" pontok (ikon + cím + szöveg) a nyilvános foglaló oldalon. Pl. „Parkolás: az udvarban ingyenes" vagy „Lemondás: legkésőbb a foglalás előtt 24 órával".
        </p>
        <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
        <GoodToKnowEditor value={loc.current.good_to_know} onChange={(v) => loc.setField('good_to_know', v)} locale={loc.editLocale} />
      </Section>

      <div className="lg:col-span-2">
        <SaveBar dirty={tabDirty('general')} submitting={submitting} onSave={() => saveTab('general')} />
      </div>
      </div>
      )}

      {activeTab === 'booking' && (
      <div className="space-y-4 lg:space-y-6">
      <Section title="Foglalási beállítások">
        {/* Desktopon kétoszlopos: BAL = a beállítók + kapcsolók; JOBB = a naptár.
            Mobilon egymás alatt, a naptár full. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Bal oszlop */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className={labelBase}>Puffer foglalások között (perc)</Label>
              <div className="max-w-xs">
                <NumberStepper
                  value={watch('booking_buffer_minutes') ?? 0}
                  onChange={(n) => setValue('booking_buffer_minutes', n, { shouldDirty: true })}
                  min={0}
                  max={120}
                  step={5}
                  suffix="perc"
                  presets={[0, 5, 10, 15, 30]}
                />
              </div>
              <p className="text-xs text-ink-soft">Mennyi szünet legyen két foglalás között</p>
            </div>

            <div className="space-y-4 border-t border-line pt-4">
              <Toggle
                checked={watch('require_phone')}
                onChange={(v) => setValue('require_phone', v, { shouldDirty: true })}
                label="Telefonszám kötelező az ügyfélnek"
              />
              <Toggle
                checked={watch('notify_new_bookings')}
                onChange={(v) => setValue('notify_new_bookings', v, { shouldDirty: true })}
                label="Értesítés új foglalásokról"
                description="Értesítést kapsz az alkalmazáson belül új foglalásról és lemondásról."
              />
            </div>
          </div>

          {/* Jobb oszlop: naptár (full a saját oszlopában) */}
          <div className="space-y-1.5">
            <Label className={labelBase}>Foglalható napok előre</Label>
            <BookingWindowPicker
              value={watch('booking_window_days') ?? 60}
              onChange={(days) => setValue('booking_window_days', days, { shouldDirty: true })}
            />
            <p className="text-xs text-ink-soft">Jelöld ki a naptárban az utolsó napot, ameddig a vendégek előre foglalhatnak.</p>
          </div>
        </div>
      </Section>

      <SaveBar dirty={tabDirty('booking')} submitting={submitting} onSave={() => saveTab('booking')} />
      </div>
      )}

      {activeTab === 'languages' && (
      <div className="space-y-4 lg:space-y-6">
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
      <SaveBar dirty={tabDirty('languages')} submitting={submitting} onSave={() => saveTab('languages')} />
      </div>
      )}

      {activeTab === 'email' && (
      <div className="space-y-4 lg:space-y-6">
        {/* Tartalom */}
        <Section title="Tartalom">
          <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
          <div className="space-y-1.5">
            <Label className={labelBase}>Email tárgya</Label>
            <Input
              className={inputBase}
              value={loc.current.booking_email_subject}
              onChange={(e) => loc.setField('booking_email_subject', e.target.value)}
              placeholder="Foglalás visszaigazolva — {{name}}"
            />
            <p className="text-xs text-ink-soft">Üresen hagyva az alapértelmezett tárgy jelenik meg.</p>
          </div>
          <div className="space-y-1.5">
            <Label className={labelBase}>Bevezető szöveg</Label>
            <Textarea
              className={`${inputBase} min-h-28 py-3`}
              value={loc.current.booking_email_intro}
              onChange={(e) => loc.setField('booking_email_intro', e.target.value)}
              placeholder={'Kedves {{name}}!\n\nKöszönjük a foglalást, várunk szeretettel!'}
            />
            <p className="text-xs text-ink-soft">A visszaigazoló email tetejére, a foglalás részletei elé kerül.</p>
          </div>
          <EmailVariablesHelp type="salon" />
        </Section>

        {/* Kapcsolat & útvonal */}
        <Section title="Kapcsolat & útvonal">
          <p className="text-xs text-ink-soft">
            A visszaigazoló email alján egy „Módosítanád a foglalást? Keress minket" blokk jelenik meg a bekapcsolt elemekkel.
          </p>

          <div className="rounded-[16px] border border-line divide-y divide-line">
            <div className="px-4 py-3.5">
              <Toggle checked={watch('email_show_phone')} onChange={(v) => setValue('email_show_phone', v, { shouldDirty: true })} label="Telefonszám" />
              {watch('email_show_phone') && (
                <div className="space-y-1.5 mt-3">
                  <Input
                    className={inputBase}
                    {...register('email_contact_phone')}
                    placeholder="Módosítási telefonszám (ha üres, a nyilvános)"
                  />
                </div>
              )}
            </div>
            <div className="px-4 py-3.5">
              <Toggle checked={watch('email_show_email')} onChange={(v) => setValue('email_show_email', v, { shouldDirty: true })} label="Email cím" />
            </div>
            <div className="px-4 py-3.5">
              <Toggle checked={watch('email_show_address')} onChange={(v) => setValue('email_show_address', v, { shouldDirty: true })} label="Cím" />
            </div>
            <div className="px-4 py-3.5">
              <Toggle checked={watch('email_show_directions')} onChange={(v) => setValue('email_show_directions', v, { shouldDirty: true })} label="Útvonaltervezés gomb" description="Google Mapsben nyitja meg a helyet." />
              {watch('email_show_directions') && (
                <div className="space-y-1.5 mt-3">
                  <Input
                    className={inputBase}
                    {...register('email_directions_address')}
                    placeholder="Cím vagy Google Maps-link (ha üres, a fenti cím)"
                  />
                </div>
              )}
            </div>
          </div>
        </Section>

        <SaveBar dirty={tabDirty('email')} submitting={submitting} onSave={() => saveTab('email')} onPreview={() => window.open(emailPreviewUrl('salon', { ...watch(), booking_email_intro: loc.current.booking_email_intro }, loc.editLocale), '_blank', 'noopener')} />
      </div>
      )}

      {activeTab === 'documents' && (
      <div className="space-y-4 lg:space-y-6">
      <Section title="Cégadatok">
        <p className="text-xs text-ink-soft">
          A „Szolgáltató adatai" blokk ezekből áll össze a Foglalási feltételek elején (a foglaló oldalon és emailben). Üres mezők kimaradnak.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelBase}>Hivatalos cégnév</Label>
            <Input className={inputBase} {...register('legal_name')} placeholder="pl. Példa Kft." />
          </div>
          <div className="space-y-1.5">
            <Label className={labelBase}>Adószám</Label>
            <Input className={inputBase} {...register('tax_number')} placeholder="12345678-2-42" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelBase}>Cégjegyzékszám</Label>
            <Input className={inputBase} {...register('company_reg_number')} placeholder="01-09-123456" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelBase}>Székhely</Label>
            <Input className={inputBase} {...register('registered_seat')} placeholder="1051 Budapest, Példa u. 1." />
          </div>
        </div>
      </Section>

      <Section title="Foglalási feltételek">
        <p className="text-xs text-ink-soft">
          Szakaszonként add meg a feltételeket (cím + szöveg). Megjelenik a nyilvános foglaló oldalon és a visszaigazoló emailben. Hagyd üresen, ha nincs.
        </p>
        <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
        <TermsSectionsEditor
          value={loc.current.terms_sections}
          onChange={(v) => loc.setField('terms_sections', v)}
          locale={loc.editLocale}
        />
      </Section>

      <SaveBar dirty={tabDirty('documents')} submitting={submitting} onSave={() => saveTab('documents')} />
      </div>
      )}

      {activeTab === 'danger' && (
      <div className="bg-red-500/[0.04] border border-red-500/20 rounded-[24px] overflow-hidden font-onest">
        <div className="px-5 py-4 border-b border-red-500/20 sm:px-6">
          <h3 className="font-bold text-sm uppercase tracking-widest text-red-400">Veszélyzóna</h3>
        </div>
        <div className="px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{isLastBusiness ? 'Fiók törlése' : 'Szalon törlése'}</p>
            <p className="text-xs text-ink-soft mt-0.5">
              {isLastBusiness
                ? 'Minden adat (szalon, foglalások, munkatársak) véglegesen törlődik.'
                : `Csak ezt a szalont törli (foglalások, munkatársak). A fiókod és a többi üzleted megmarad.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="h-10 px-5 rounded-full border border-red-500/40 text-red-500 hover:bg-red-500/10 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4" />
            {isLastBusiness ? 'Fiók törlése' : 'Szalon törlése'}
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
        for (const k of (TAB_FIELDS[activeTab] ?? [])) {
          setValue(k, defaultsRef.current[k], { shouldDirty: false })
        }
        if (activeTab === 'general') { setLogoModified(false); setCoverModified(false) }
        if (activeTab === 'languages') setSupportedExtras(savedSupported)
        if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null) }
      }}
      onCancel={() => setPendingTab(null)}
    />

    {deleteOpen && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-2xl"
        onClick={() => { if (!deleting) { setDeleteOpen(false); setDeleteConfirm('') } }}
      >
        <div
          className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl border border-line shadow-2xl p-7 lg:p-9"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
            <Trash2 className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-xl font-black tracking-tight text-ink">
            {isLastBusiness ? 'Fiók törlése' : 'Szalon törlése'}
          </h3>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed">
            Ez a művelet <span className="font-semibold text-ink">visszafordíthatatlan</span>.{' '}
            {isLastBusiness
              ? 'A szalon, a foglalások és a munkatársak véglegesen törlődnek — ez az utolsó üzleted, ezért a teljes fiók is megszűnik.'
              : 'Csak ez a szalon törlődik (a foglalásaival és munkatársaival együtt); a fiókod és a többi üzleted megmarad.'}
          </p>
          <p className="text-xs text-ink-soft mt-5 mb-2">
            A megerősítéshez írd be a szalon nevét: <span className="font-bold text-ink">{salon.name}</span>
          </p>
          <Input
            className={inputClass}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={salon.name}
            autoComplete="off"
            autoFocus
          />
          <div className="flex items-center gap-2 mt-6">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleting || deleteConfirm.trim() !== (salon.name ?? '').trim()}
              className="flex-1 h-11 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Törlés...' : 'Végleges törlés'}
            </button>
            <button
              type="button"
              onClick={() => { setDeleteOpen(false); setDeleteConfirm('') }}
              disabled={deleting}
              className="h-11 px-5 rounded-full border border-line-strong text-sm font-semibold text-ink-soft hover:border-ink/40 transition-colors"
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
