'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Camera, Loader2, ImagePlus, X, Trash2 } from 'lucide-react'
import type { Media } from '@/payload/payload-types'

type Settings = {
  name: string
  city: string
  address: string
  phone: string
  email: string
  website: string
  capacity_mode: 'tables' | 'flat'
  max_pax: number
  turn_duration_minutes: number
  slot_step_minutes: number
  last_seating_buffer_minutes: number
  lead_time_hours: number
  require_phone: boolean
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
  slug,
  initial,
  logo,
  coverImage,
}: {
  restaurantId: number | string
  restaurantName: string
  slug: string
  initial: Settings
  logo?: string | Media | null
  coverImage?: string | Media | null
}) {
  const router = useRouter()
  const [form, setForm] = useState<Settings>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

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

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
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
      router.push('/login')
    } catch {
      toast.error('Hiba történt a törlés során')
      setDeleting(false)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { ...form }
      if (logoModified) body.logo = logoId ?? null
      if (coverModified) body.cover_image = coverId ?? null
      const res = await fetch(`/api/restaurants/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Beállítások mentve')
      router.refresh()
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">

      {/* Cover image */}
      <Section title="Borítókép" full>
        <button
          type="button"
          onClick={() => coverRef.current?.click()}
          className="relative w-full h-40 rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-colors"
        >
          {uploadingCover ? (
            <Loader2 className="h-6 w-6 text-zinc-400 dark:text-white/40 animate-spin" />
          ) : coverPreview ? (
            <>
              <img src={coverPreview} alt="Borítókép" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
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
            onClick={() => removeImage(coverId, setCoverPreview, setCoverId, setCoverModified, coverRef)}
            className="text-xs text-red-500 hover:text-red-600 font-medium"
          >
            Borítókép eltávolítása
          </button>
        )}
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
        <div className="flex items-start gap-4">
          <div className="shrink-0 space-y-1.5">
            <Label className={labelClass}>Logó</Label>
            <div className="relative w-16">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="relative h-16 w-16 rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-colors"
              >
                {uploadingLogo ? (
                  <Loader2 className="h-5 w-5 text-zinc-400 dark:text-white/40 animate-spin" />
                ) : logoPreview ? (
                  <>
                    <img src={logoPreview} alt="Logó" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
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
          <div className="flex-1 space-y-1.5">
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

      <Section title="Foglalási beállítások" full>
        <div className="space-y-1.5">
          <Label className={labelClass}>Kapacitás mód</Label>
          <div className="flex gap-2 max-w-md">
            {(['tables', 'flat'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => set('capacity_mode', mode)}
                className={`flex-1 h-11 rounded-xl border text-sm font-medium transition-colors ${
                  form.capacity_mode === mode
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white/60'
                }`}
              >
                {mode === 'tables' ? 'Asztalok szerint' : 'Összesített (flat)'}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-400 dark:text-white/30">
            Asztalok szerint: foglalás konkrét asztalhoz. Flat: csak összesített főszám-limit időablakonként.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {form.capacity_mode === 'flat' && (
            <div className="space-y-1.5">
              <Label className={labelClass}>Max. fő / időablak</Label>
              <Input
                type="number"
                min={1}
                className={inputClass}
                value={form.max_pax}
                onChange={(e) => set('max_pax', parseInt(e.target.value, 10) || 0)}
              />
            </div>
          )}
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

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.require_phone}
            onChange={(e) => set('require_phone', e.target.checked)}
            className="h-4 w-4 rounded accent-zinc-900 dark:accent-white"
          />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Telefonszám kötelező a vendégnek</span>
        </label>
      </Section>

      <div className="lg:col-span-2">
        <button
          type="submit"
          disabled={submitting || uploadingLogo || uploadingCover}
          className="h-12 px-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-white/90 dark:text-black font-semibold text-sm transition-colors disabled:opacity-40"
        >
          {submitting ? 'Mentés...' : 'Mentés'}
        </button>
      </div>

      {/* Danger zone */}
      <div className="lg:col-span-2 bg-red-500/[0.04] border border-red-500/20 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-red-500/20">
          <h3 className="font-bold text-sm uppercase tracking-widest text-red-400">Veszélyzóna</h3>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-white/80">Fiók törlése</p>
            <p className="text-xs text-zinc-500 dark:text-white/40 mt-0.5">Minden adat (étterem, foglalások, asztalok, nyitvatartás) véglegesen törlődik.</p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="h-10 px-5 rounded-full border border-red-500/40 text-red-500 hover:bg-red-500/10 text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            Fiók törlése
          </button>
        </div>
      </div>
    </form>

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
          <h3 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white">Fiók törlése</h3>
          <p className="text-sm text-zinc-500 dark:text-white/50 mt-2 leading-relaxed">
            Ez a művelet <span className="font-semibold text-zinc-700 dark:text-white/70">visszafordíthatatlan</span>. Az étterem, a foglalások, asztalok és nyitvatartás véglegesen törlődik.
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
