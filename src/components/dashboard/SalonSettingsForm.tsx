'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { Salon, Media } from '@/payload/payload-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Camera, Loader2, ImagePlus, X, Trash2 } from 'lucide-react'

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
})
type FormData = z.infer<typeof schema>

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-900">{title}</h3>
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

export default function SalonSettingsForm({ salon }: { salon: Salon }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: salon.name,
      slug: salon.slug,
      address: salon.address ?? '',
      city: salon.city ?? '',
      postal_code: salon.postal_code ?? '',
      phone: salon.phone ?? '',
      email: salon.email ?? '',
      website: salon.website ?? '',
      booking_buffer_minutes: salon.booking_buffer_minutes ?? 0,
    },
  })

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
    if (!confirm(`Biztosan törlöd a(z) „${salon.name}" szalonhoz tartozó fiókot? Ez a művelet visszafordíthatatlan — minden adat törlődik.`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/bookly/delete-account', { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      router.push('/bookly/login')
    } catch {
      toast.error('Hiba történt a törlés során')
      setDeleting(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { ...data }
      if (logoModified) body.logo = logoId ?? null
      if (coverModified) body.cover_image = coverId ?? null
      const res = await fetch(`/api/salons/${salon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Beállítások mentve')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

      {/* Cover image */}
      <Section title="Borítókép">
        <p className="text-xs text-zinc-400 -mt-1">A nyilvános oldalon a felső sötét sávon jelenik meg háttérként.</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="relative w-full h-36 rounded-2xl overflow-hidden bg-zinc-950 flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {uploadingCover ? (
              <Loader2 className="h-6 w-6 text-zinc-400 animate-spin" />
            ) : coverPreview ? (
              <>
                <img src={coverPreview} alt="Borítókép" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                <div className="relative flex flex-col items-center gap-1.5 text-white/60">
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-xs font-medium">Csere</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-zinc-500">
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
        <div className="flex items-start gap-4">
          <div className="shrink-0 space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">Logó</Label>
            <div className="relative w-16">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="relative h-16 w-16 rounded-xl overflow-hidden bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors"
              >
                {uploadingLogo ? (
                  <Loader2 className="h-5 w-5 text-zinc-400 animate-spin" />
                ) : logoPreview ? (
                  <>
                    <img src={logoPreview} alt="Logó" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="h-4 w-4 text-white" />
                    </div>
                  </>
                ) : (
                  <Camera className="h-5 w-5 text-zinc-400" />
                )}
              </button>
              {logoPreview && !uploadingLogo && (
                <button
                  type="button"
                  onClick={() => removeImage(logoId, setLogoPreview, setLogoId, setLogoModified, logoRef)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center hover:bg-red-500 transition-colors"
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
          <div className="flex-1 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Szalon neve *</Label>
              <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">URL azonosító</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-zinc-400">/bookly/</span>
                <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200 flex-1" {...register('slug')} />
              </div>
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Elérhetőség">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">Irányítószám</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('postal_code')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">Város</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('city')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-zinc-700">Cím</Label>
          <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('address')} placeholder="Utca, házszám" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">Telefon</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('phone')} type="tel" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">Email</Label>
            <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('email')} type="email" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-zinc-700">Weboldal</Label>
          <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('website')} type="url" placeholder="https://" />
        </div>
      </Section>

      <Section title="Foglalási beállítások">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-zinc-700">Puffer foglalások között (perc)</Label>
          <Input
            type="number"
            min={0}
            max={120}
            step={5}
            className="h-11 rounded-xl bg-zinc-50 border-zinc-200 w-32"
            {...register('booking_buffer_minutes', { valueAsNumber: true })}
          />
          <p className="text-xs text-zinc-500">Mennyi szünet legyen két foglalás között</p>
        </div>
      </Section>

      <button
        type="submit"
        disabled={submitting || uploadingLogo || uploadingCover}
        className="h-12 px-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors disabled:opacity-40"
      >
        {submitting ? 'Mentés...' : 'Mentés'}
      </button>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-red-100">
        <div className="px-6 py-4 border-b border-red-100">
          <h3 className="font-bold text-sm uppercase tracking-widest text-red-500">Veszélyzóna</h3>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Fiók törlése</p>
            <p className="text-xs text-zinc-500 mt-0.5">Minden adat (szalon, foglalások, munkatársak) véglegesen törlődik.</p>
          </div>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleting}
            className="h-10 px-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Törlés...' : 'Fiók törlése'}
          </button>
        </div>
      </div>
    </form>
  )
}
