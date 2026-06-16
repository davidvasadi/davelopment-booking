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
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { SettingsTabsNav } from '@/components/ui/settings-tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TermsSectionsEditor } from '@/components/settings/TermsSectionsEditor'
import { GoodToKnowEditor } from '@/components/settings/GoodToKnowEditor'

/** Fülenkénti mentés-sáv: csak akkor aktív, ha az adott fülön van változás. */
function SaveBar({ dirty, submitting, onSave, onPreview }: { dirty: boolean; submitting: boolean; onSave: () => void; onPreview?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || submitting}
        className="h-11 px-6 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-white/90 dark:text-black font-semibold text-sm transition-colors disabled:opacity-40"
      >
        {submitting ? 'Mentés...' : 'Mentés'}
      </button>
      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          className="h-11 px-5 rounded-full border border-zinc-200 dark:border-white/15 text-zinc-700 dark:text-white/80 hover:bg-zinc-50 dark:hover:bg-white/[0.06] font-semibold text-sm transition-colors inline-flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          Előnézet
        </button>
      )}
      {dirty && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Mentetlen változások</span>}
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
  booking_email_subject: z.string().optional(),
  booking_email_intro: z.string().optional(),
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
  terms_sections: z.array(z.object({ title: z.string(), body: z.string() })),
  good_to_know: z.array(z.object({ icon: z.string(), title: z.string(), body: z.string() })),
})
type FormData = z.infer<typeof schema>

function Section({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden ${full ? 'lg:col-span-2' : ''}`}>
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06]">
        <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500 dark:text-white/60">{title}</h3>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  )
}

function mediaUrl(field: string | Media | null | undefined): string | null {
  if (!field) return null
  if (typeof field === 'object') return (field as Media).url ?? null
  return null
}

// Megegyezik az RestaurantSettingsForm input-stílusával (egységes Veszélyzóna modal).
const inputClass =
  'h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20'

export default function SalonSettingsForm({ salon, businessCount = 1 }: { salon: Salon; businessCount?: number }) {
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
    booking_email_subject: salon.booking_email_subject ?? '',
    booking_email_intro: salon.booking_email_intro ?? '',
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
    terms_sections: (salon.terms_sections ?? []).map((s) => ({ title: s.title ?? '', body: s.body ?? '' })),
    good_to_know: (salon.good_to_know ?? []).map((g) => ({ icon: g.icon ?? 'info', title: g.title ?? '', body: g.body ?? '' })),
  }
  const { register, handleSubmit, watch, setValue, getValues, reset, formState: { errors, dirtyFields } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })
  // Utoljára elmentett baseline (az „Elvetés"-hez fülenként). Mentéskor frissül.
  const defaultsRef = useRef<FormData>(initialValues)

  // ── Fülek + mentetlen-változás védelem ──────────────────────────
  const TAB_FIELDS: Record<string, (keyof FormData)[]> = {
    general: ['name', 'slug', 'postal_code', 'city', 'address', 'phone', 'email', 'website', 'good_to_know'],
    booking: ['booking_buffer_minutes', 'booking_window_days', 'require_phone', 'notify_new_bookings'],
    email: ['booking_email_subject', 'booking_email_intro', 'email_show_phone', 'email_contact_phone', 'email_show_email', 'email_show_address', 'email_show_directions', 'email_directions_address'],
    documents: ['legal_name', 'tax_number', 'company_reg_number', 'registered_seat', 'terms_sections'],
  }
  const [activeTab, setActiveTab] = useState('general')
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  const tabDirty = (tab: string): boolean => {
    const fieldDirty = (TAB_FIELDS[tab] ?? []).some((k) => dirtyFields[k])
    if (tab === 'general') return fieldDirty || logoModified || coverModified
    return fieldDirty
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

  const saveTab = (tab: string) => persist(TAB_FIELDS[tab] ?? [], tab === 'general')

  const requestTab = (id: string) => {
    if (id === activeTab) return
    if (tabDirty(activeTab)) setPendingTab(id)
    else setActiveTab(id)
  }

  const tabs = [
    { id: 'general', label: 'Általános', dirty: tabDirty('general') },
    { id: 'booking', label: 'Foglalás', dirty: tabDirty('booking') },
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
      <SettingsTabsNav tabs={tabs} active={activeTab} onSelect={requestTab} />

      {activeTab === 'general' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

      {/* Cover image */}
      <Section title="Borítókép" full>
        <p className="text-xs text-zinc-400 dark:text-white/30 -mt-1">A nyilvános oldalon a felső sötét sávon jelenik meg háttérként.</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="relative w-full h-36 rounded-2xl overflow-hidden bg-zinc-50 border border-zinc-200 dark:bg-white/[0.04] dark:border-white/[0.08] flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {uploadingCover ? (
              <Loader2 className="h-6 w-6 text-zinc-400 dark:text-white/40 animate-spin" />
            ) : coverPreview ? (
              <>
                <img src={coverPreview} alt="Borítókép" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                <div className="relative flex flex-col items-center gap-1.5 text-zinc-500 dark:text-white/60">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs font-medium">Csere</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-zinc-400 dark:text-white/30">
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
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Logó</Label>
            {/* object-contain + rugalmas szélesség: a teljes logó látszik (nem négyzetbe vágva). */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="group relative flex h-16 min-w-16 max-w-[220px] items-center justify-center rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/[0.06] px-3 hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-colors"
              >
                {uploadingLogo ? (
                  <Loader2 className="h-5 w-5 text-zinc-400 dark:text-white/40 animate-spin" />
                ) : logoPreview ? (
                  <>
                    <img src={logoPreview} alt="Logó" className="h-full w-auto max-w-full object-contain" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="h-4 w-4 text-white" />
                    </div>
                  </>
                ) : (
                  <Camera className="h-5 w-5 text-zinc-400 dark:text-white/30" />
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
              <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Szalon neve *</Label>
              <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">URL azonosító</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-zinc-400 dark:text-white/30">/</span>
                <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20 flex-1" {...register('slug')} />
              </div>
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Elérhetőség">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Irányítószám</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('postal_code')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Város</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('city')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Cím</Label>
          <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('address')} placeholder="Utca, házszám" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Telefon</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('phone')} type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Email</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('email')} type="email" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Weboldal</Label>
          <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('website')} type="url" placeholder="https://" />
        </div>
      </Section>

      <Section title="Jó tudni (foglaló oldal)" full>
        <p className="text-xs text-zinc-400 dark:text-white/30 -mt-1">
          Saját „Jó tudni" pontok (ikon + cím + szöveg) a nyilvános foglaló oldalon. Pl. „Parkolás: az udvarban ingyenes" vagy „Lemondás: legkésőbb a foglalás előtt 24 órával".
        </p>
        <GoodToKnowEditor value={watch('good_to_know')} onChange={(v) => setValue('good_to_know', v, { shouldDirty: true })} />
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
              <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Puffer foglalások között (perc)</Label>
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
              <p className="text-xs text-zinc-400 dark:text-white/30">Mennyi szünet legyen két foglalás között</p>
            </div>

            <div className="space-y-4 border-t border-zinc-100 dark:border-white/[0.06] pt-4">
              <ToggleSwitch
                checked={watch('require_phone')}
                onChange={(v) => setValue('require_phone', v, { shouldDirty: true })}
                label="Telefonszám kötelező az ügyfélnek"
              />
              <ToggleSwitch
                checked={watch('notify_new_bookings')}
                onChange={(v) => setValue('notify_new_bookings', v, { shouldDirty: true })}
                label="Értesítés új foglalásokról"
                description="Értesítést kapsz az alkalmazáson belül új foglalásról és lemondásról."
              />
            </div>
          </div>

          {/* Jobb oszlop: naptár (full a saját oszlopában) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Foglalható napok előre</Label>
            <BookingWindowPicker
              value={watch('booking_window_days') ?? 60}
              onChange={(days) => setValue('booking_window_days', days, { shouldDirty: true })}
            />
            <p className="text-xs text-zinc-400 dark:text-white/30">Jelöld ki a naptárban az utolsó napot, ameddig a vendégek előre foglalhatnak.</p>
          </div>
        </div>
      </Section>

      <SaveBar dirty={tabDirty('booking')} submitting={submitting} onSave={() => saveTab('booking')} />
      </div>
      )}

      {activeTab === 'email' && (
      <div className="space-y-4 lg:space-y-6">
        {/* Tartalom */}
        <Section title="Tartalom">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Email tárgya</Label>
            <Input
              className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20"
              {...register('booking_email_subject')}
              placeholder="Foglalás visszaigazolva — {{name}}"
            />
            <p className="text-xs text-zinc-400 dark:text-white/30">Üresen hagyva az alapértelmezett tárgy jelenik meg.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Bevezető szöveg</Label>
            <Textarea
              className="min-h-28 py-3 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20"
              {...register('booking_email_intro')}
              placeholder={'Kedves {{name}}!\n\nKöszönjük a foglalást, várunk szeretettel!'}
            />
            <p className="text-xs text-zinc-400 dark:text-white/30">A visszaigazoló email tetejére, a foglalás részletei elé kerül.</p>
          </div>
          <EmailVariablesHelp type="salon" />
        </Section>

        {/* Kapcsolat & útvonal */}
        <Section title="Kapcsolat & útvonal">
          <p className="text-xs text-zinc-400 dark:text-white/30">
            A visszaigazoló email alján egy „Módosítanád a foglalást? Keress minket" blokk jelenik meg a bekapcsolt elemekkel.
          </p>

          <div className="rounded-xl border border-zinc-100 dark:border-white/[0.06] divide-y divide-zinc-100 dark:divide-white/[0.06]">
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={watch('email_show_phone')} onChange={(v) => setValue('email_show_phone', v, { shouldDirty: true })} label="Telefonszám" />
              {watch('email_show_phone') && (
                <div className="space-y-1.5 mt-3">
                  <Input
                    className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20"
                    {...register('email_contact_phone')}
                    placeholder="Módosítási telefonszám (ha üres, a nyilvános)"
                  />
                </div>
              )}
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={watch('email_show_email')} onChange={(v) => setValue('email_show_email', v, { shouldDirty: true })} label="Email cím" />
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={watch('email_show_address')} onChange={(v) => setValue('email_show_address', v, { shouldDirty: true })} label="Cím" />
            </div>
            <div className="px-4 py-3.5">
              <ToggleSwitch checked={watch('email_show_directions')} onChange={(v) => setValue('email_show_directions', v, { shouldDirty: true })} label="Útvonaltervezés gomb" description="Google Mapsben nyitja meg a helyet." />
              {watch('email_show_directions') && (
                <div className="space-y-1.5 mt-3">
                  <Input
                    className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20"
                    {...register('email_directions_address')}
                    placeholder="Cím vagy Google Maps-link (ha üres, a fenti cím)"
                  />
                </div>
              )}
            </div>
          </div>
        </Section>

        <SaveBar dirty={tabDirty('email')} submitting={submitting} onSave={() => saveTab('email')} onPreview={() => window.open(emailPreviewUrl('salon', watch()), '_blank', 'noopener')} />
      </div>
      )}

      {activeTab === 'documents' && (
      <div className="space-y-4 lg:space-y-6">
      <Section title="Cégadatok">
        <p className="text-xs text-zinc-400 dark:text-white/30">
          A „Szolgáltató adatai" blokk ezekből áll össze a Foglalási feltételek elején (a foglaló oldalon és emailben). Üres mezők kimaradnak.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Hivatalos cégnév</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('legal_name')} placeholder="pl. Példa Kft." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Adószám</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('tax_number')} placeholder="12345678-2-42" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Cégjegyzékszám</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('company_reg_number')} placeholder="01-09-123456" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-600 dark:text-white/60">Székhely</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20" {...register('registered_seat')} placeholder="1051 Budapest, Példa u. 1." />
          </div>
        </div>
      </Section>

      <Section title="Foglalási feltételek">
        <p className="text-xs text-zinc-400 dark:text-white/30">
          Szakaszonként add meg a feltételeket (cím + szöveg). Megjelenik a nyilvános foglaló oldalon és a visszaigazoló emailben. Hagyd üresen, ha nincs.
        </p>
        <TermsSectionsEditor
          value={watch('terms_sections')}
          onChange={(v) => setValue('terms_sections', v, { shouldDirty: true })}
        />
      </Section>

      <SaveBar dirty={tabDirty('documents')} submitting={submitting} onSave={() => saveTab('documents')} />
      </div>
      )}

      {activeTab === 'danger' && (
      <div className="bg-red-500/[0.04] border border-red-500/20 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-red-500/20">
          <h3 className="font-bold text-sm uppercase tracking-widest text-red-400">Veszélyzóna</h3>
        </div>
        <div className="px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-800 dark:text-white/80">{isLastBusiness ? 'Fiók törlése' : 'Szalon törlése'}</p>
            <p className="text-xs text-zinc-500 dark:text-white/40 mt-0.5">
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
          className="w-full max-w-md bg-white/95 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl border border-white/40 dark:border-white/[0.08] shadow-2xl p-7 lg:p-9"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
            <Trash2 className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">
            {isLastBusiness ? 'Fiók törlése' : 'Szalon törlése'}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-white/50 mt-2 leading-relaxed">
            Ez a művelet <span className="font-semibold text-zinc-700 dark:text-white/70">visszafordíthatatlan</span>.{' '}
            {isLastBusiness
              ? 'A szalon, a foglalások és a munkatársak véglegesen törlődnek — ez az utolsó üzleted, ezért a teljes fiók is megszűnik.'
              : 'Csak ez a szalon törlődik (a foglalásaival és munkatársaival együtt); a fiókod és a többi üzleted megmarad.'}
          </p>
          <p className="text-xs text-zinc-600 dark:text-white/50 mt-5 mb-2">
            A megerősítéshez írd be a szalon nevét: <span className="font-bold text-zinc-800 dark:text-white/80">{salon.name}</span>
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
              className="h-11 px-5 rounded-full border border-zinc-200 dark:border-white/[0.1] text-sm font-semibold text-zinc-600 dark:text-white/60 hover:border-zinc-400 transition-colors"
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
