'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { BookingWindowPicker } from '@/components/dashboard/BookingWindowPicker'
import { Camera, Loader2, ImagePlus, X, Trash2, Eye } from 'lucide-react'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { emailPreviewUrl } from '@/components/settings/emailPreviewUrl'
import { EmailVariablesHelp } from '@/components/settings/EmailVariablesHelp'
import { SettingsTabsNav } from '@/components/ui/settings-tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TermsSectionsEditor, type TermsSection } from '@/components/settings/TermsSectionsEditor'
import { GoodToKnowEditor, type GoodToKnowItem } from '@/components/settings/GoodToKnowEditor'
import type { Media } from '@/payload/payload-types'

/** Fülenkénti mentés-sáv: csak akkor aktív, ha az adott fülön van változás.
 *  Opcionális `onPreview` esetén a Mentés mellett egy „Előnézet" gomb is megjelenik. */
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
}

const inputClass =
  'h-11 rounded-xl bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20'
const labelClass = 'text-sm font-medium text-zinc-600 dark:text-white/60'

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
  logo,
  coverImage,
}: {
  restaurantId: number | string
  restaurantName: string
  businessCount?: number
  slug: string
  initial: Settings
  logo?: string | Media | null
  coverImage?: string | Media | null
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

  // ── Fülek + mentetlen-változás védelem ──────────────────────────
  // Melyik mező melyik fülhöz tartozik (dirty-követés + per-tab mentés).
  const TAB_FIELDS: Record<string, (keyof Settings)[]> = {
    general: ['name', 'city', 'address', 'phone', 'email', 'website', 'good_to_know'],
    booking: [
      'turn_duration_minutes', 'slot_step_minutes', 'last_seating_buffer_minutes',
      'lead_time_hours', 'booking_window_days', 'require_phone', 'notify_new_bookings',
    ],
    email: ['booking_email_subject', 'booking_email_intro', 'email_show_phone', 'email_contact_phone', 'email_show_email', 'email_show_address', 'email_show_directions', 'email_directions_address'],
    documents: ['legal_name', 'tax_number', 'company_reg_number', 'registered_seat', 'terms_sections'],
  }
  const [activeTab, setActiveTab] = useState('general')
  // Fülváltáskor, ha van mentetlen változás, ide tesszük a célfület és rákérdezünk.
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  // Az „Általános" fülön a logó/borító képváltozás is dirty-nek számít.
  const tabDirty = (tab: string): boolean => {
    const fields = TAB_FIELDS[tab] ?? []
    const fieldDirty = fields.some((k) => form[k] !== saved[k])
    if (tab === 'general') return fieldDirty || logoModified || coverModified
    return fieldDirty
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

  const saveTab = (tab: string) => persist(TAB_FIELDS[tab] ?? [], tab === 'general')
  const saveAll = () =>
    persist(Object.values(TAB_FIELDS).flat(), true)

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
    { id: 'email', label: 'Email', dirty: tabDirty('email') },
    { id: 'documents', label: 'Dokumentumok', dirty: tabDirty('documents') },
    { id: 'danger', label: 'Veszélyzóna' },
  ]

  return (
    <>
    <form onSubmit={onSubmit} className="space-y-5">
      <SettingsTabsNav tabs={tabs} active={activeTab} onSelect={requestTab} />

      {activeTab === 'general' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

      {/* Cover image */}
      <Section title="Borítókép" full>
        <div className="relative">
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="group relative w-full h-40 rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-colors"
          >
            {uploadingCover ? (
              <Loader2 className="h-6 w-6 text-zinc-400 dark:text-white/40 animate-spin" />
            ) : coverPreview ? (
              <>
                <img src={coverPreview} alt="Borítókép" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-zinc-400 dark:text-white/30">
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
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/80 flex items-center justify-center hover:bg-red-500 transition-colors"
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
      <Section title="Alap adatok">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className={labelClass}>Logó</Label>
            <div className="flex items-center gap-4">
              {/* object-contain előnézet egy elhatárolt kártyában: a teljes logó látszik,
                  a host tudja hogyan jelenik meg a foglaló oldalon/emailben. */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  className="group relative flex h-20 w-40 items-center justify-center rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 px-4 hover:border-zinc-300 dark:border-white/[0.1] dark:bg-white/[0.04] dark:hover:border-white/[0.2] transition-colors"
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-5 w-5 text-zinc-400 dark:text-white/40 animate-spin" />
                  ) : logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logó" className="max-h-full max-w-full object-contain" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-zinc-400 dark:text-white/30">
                      <Camera className="h-5 w-5" />
                      <span className="text-[11px] font-medium">Feltöltés</span>
                    </div>
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
              <p className="text-xs text-zinc-400 dark:text-white/30 leading-relaxed">
                Így jelenik meg a foglaló oldal fejlécében és a visszaigazoló emailben.<br className="hidden sm:block" />
                PNG vagy SVG, áttetsző háttérrel a legjobb.
              </p>
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
          <div className="space-y-1.5">
            <Label className={labelClass}>Étterem neve *</Label>
            <Input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Elérhetőség">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelClass}>Város</Label>
            <Input className={inputClass} value={form.city} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Cím</Label>
            <Input className={inputClass} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Utca, házszám" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelClass}>Telefon</Label>
            <Input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Email</Label>
            <Input className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} type="email" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className={labelClass}>Weboldal</Label>
          <Input className={inputClass} value={form.website} onChange={(e) => set('website', e.target.value)} type="url" placeholder="https://" />
        </div>
      </Section>

      {/* Public booking URL */}
      <Section title="Nyilvános foglaló oldal" full>
        <p className="text-xs text-zinc-400 dark:text-white/30">Ezen a linken tudnak a vendégek online asztalt foglalni.</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 h-11 flex items-center px-4 rounded-xl bg-zinc-50 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.1] text-sm text-zinc-700 dark:text-white/70 truncate">
            {publicUrl}
          </code>
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-5 rounded-full border border-zinc-200 dark:border-white/[0.1] text-sm font-semibold text-zinc-700 dark:text-white/70 hover:border-zinc-400 transition-colors flex items-center"
          >
            Megnyitás
          </a>
        </div>
      </Section>

      <Section title="Jó tudni (foglaló oldal)" full>
        <p className="text-xs text-zinc-400 dark:text-white/30">
          Saját „Jó tudni" pontok (cím + szöveg) a nyilvános foglaló oldalon, az automatikus kártyák (foglalási idő, legkorábbi foglalás) alatt. Pl. „Módosítás: az adott napon csak telefonon".
        </p>
        <GoodToKnowEditor value={form.good_to_know} onChange={(v) => set('good_to_know', v)} />
      </Section>

      <div className="lg:col-span-2">
        <SaveBar dirty={tabDirty('general')} submitting={submitting} onSave={() => saveTab('general')} />
      </div>
      </div>
      )}

      {activeTab === 'booking' && (
      <div className="space-y-4 lg:space-y-6">
      <Section title="Foglalási beállítások">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <Label className={labelClass}>Foglalás hossza (perc)</Label>
            <Input
              type="number"
              min={30}
              step={15}
              className={inputClass}
              value={form.turn_duration_minutes}
              onChange={(e) => set('turn_duration_minutes', parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Időpont-lépték (perc)</Label>
            <Input
              type="number"
              min={5}
              step={5}
              className={inputClass}
              value={form.slot_step_minutes}
              onChange={(e) => set('slot_step_minutes', parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Utolsó foglalás zárás előtt (perc)</Label>
            <Input
              type="number"
              min={0}
              step={15}
              className={inputClass}
              value={form.last_seating_buffer_minutes}
              onChange={(e) => set('last_seating_buffer_minutes', parseInt(e.target.value, 10) || 0)}
            />
            <p className="text-xs text-zinc-400 dark:text-white/30">
              0 = zárásig foglalható. Ha a foglalás hosszára állítod, csak az fér be, ami zárásig véget ér.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Min. előfoglalás (óra)</Label>
            <Input
              type="number"
              min={0}
              className={inputClass}
              value={form.lead_time_hours}
              onChange={(e) => set('lead_time_hours', parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>

        {/* A naptáros „foglalható napok előre" külön sorban (nem szám-input, nem fér a gridbe). */}
        <div className="space-y-1.5">
          <Label className={labelClass}>Foglalható napok előre</Label>
          <BookingWindowPicker
            value={form.booking_window_days}
            onChange={(days) => set('booking_window_days', days)}
          />
          <p className="text-xs text-zinc-400 dark:text-white/30">Jelöld ki a naptárban az utolsó napot, ameddig a vendégek előre foglalhatnak.</p>
        </div>

        <div className="space-y-4 border-t border-zinc-100 dark:border-white/[0.06] pt-4">
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
      </Section>

      <SaveBar dirty={tabDirty('booking')} submitting={submitting} onSave={() => saveTab('booking')} />
      </div>
      )}

      {activeTab === 'email' && (
      <div className="space-y-4 lg:space-y-6">
        {/* Tartalom */}
        <Section title="Tartalom">
          <div className="space-y-1.5">
            <Label className={labelClass}>Email tárgya</Label>
            <Input
              className={inputClass}
              value={form.booking_email_subject}
              onChange={(e) => set('booking_email_subject', e.target.value)}
              placeholder="Asztalfoglalás visszaigazolva — {{name}}"
            />
            <p className="text-xs text-zinc-400 dark:text-white/30">Üresen hagyva az alapértelmezett tárgy jelenik meg.</p>
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Bevezető szöveg</Label>
            <Textarea
              className={inputClass + ' min-h-28 py-3'}
              value={form.booking_email_intro}
              onChange={(e) => set('booking_email_intro', e.target.value)}
              placeholder={'Kedves {{name}}!\n\nKöszönjük a foglalást, várunk szeretettel!'}
            />
            <p className="text-xs text-zinc-400 dark:text-white/30">A visszaigazoló email tetejére, a foglalás részletei elé kerül.</p>
          </div>
          <EmailVariablesHelp type="restaurant" />
        </Section>

        {/* Kapcsolat & útvonal */}
        <Section title="Kapcsolat & útvonal">
          <p className="text-xs text-zinc-400 dark:text-white/30">
            A visszaigazoló email alján egy „Módosítanád a foglalást? Keress minket" blokk jelenik meg a bekapcsolt elemekkel.
          </p>

          <div className="rounded-xl border border-zinc-100 dark:border-white/[0.06] divide-y divide-zinc-100 dark:divide-white/[0.06]">
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

        <SaveBar dirty={tabDirty('email')} submitting={submitting} onSave={() => saveTab('email')} onPreview={() => window.open(emailPreviewUrl('restaurant', form), '_blank', 'noopener')} />
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
        <p className="text-xs text-zinc-400 dark:text-white/30">
          Szakaszonként add meg a feltételeket (cím + szöveg). Megjelenik a nyilvános foglaló oldalon és a visszaigazoló emailben. Hagyd üresen, ha nincs.
        </p>
        <TermsSectionsEditor value={form.terms_sections} onChange={(v) => set('terms_sections', v)} />
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
            <p className="text-sm font-semibold text-zinc-800 dark:text-white/80">{isLastBusiness ? 'Fiók törlése' : 'Étterem törlése'}</p>
            <p className="text-xs text-zinc-500 dark:text-white/40 mt-0.5">
              {isLastBusiness
                ? 'Minden adat (étterem, foglalások, asztalok, nyitvatartás) véglegesen törlődik.'
                : 'Csak ezt az éttermet törli (foglalások, asztalok, nyitvatartás). A fiókod és a többi üzleted megmarad.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="h-10 px-5 rounded-full border border-red-500/40 text-red-500 hover:bg-red-500/10 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 w-full sm:w-auto"
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
        setForm((f) => {
          const next = { ...f }
          for (const k of (TAB_FIELDS[activeTab] ?? [])) (next[k] as Settings[keyof Settings]) = saved[k]
          return next
        })
        if (activeTab === 'general') {
          setLogoModified(false); setLogoPreview(mediaUrl(logo)); setLogoId(mediaId(logo))
          setCoverModified(false); setCoverPreview(mediaUrl(coverImage)); setCoverId(mediaId(coverImage))
        }
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
            {isLastBusiness ? 'Fiók törlése' : 'Étterem törlése'}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-white/50 mt-2 leading-relaxed">
            Ez a művelet <span className="font-semibold text-zinc-700 dark:text-white/70">visszafordíthatatlan</span>.{' '}
            {isLastBusiness
              ? 'Az étterem, a foglalások, asztalok és nyitvatartás véglegesen törlődnek — ez az utolsó üzleted, ezért a teljes fiók is megszűnik.'
              : 'Csak ez az étterem törlődik (a foglalásaival, asztalaival, nyitvatartásával); a fiókod és a többi üzleted megmarad.'}
          </p>
          <p className="text-xs text-zinc-600 dark:text-white/50 mt-5 mb-2">
            A megerősítéshez írd be az étterem nevét: <span className="font-bold text-zinc-800 dark:text-white/80">{restaurantName}</span>
          </p>
          <Input
            className={inputClass}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={restaurantName}
            autoComplete="off"
            autoFocus
          />
          <div className="flex items-center gap-2 mt-6">
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleting || deleteConfirm.trim() !== restaurantName.trim()}
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
