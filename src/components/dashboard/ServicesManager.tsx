'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'
import type { Service, StaffMember, Media } from '@/payload/payload-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Camera, Loader2, X, Clock } from 'lucide-react'

const schema = z.object({
  name: z.string().min(1, 'Kötelező'),
  description: z.string().optional(),
  duration_minutes: z.number().min(5),
  price: z.number().min(0),
  currency: z.enum(['HUF', 'EUR']),
  is_active: z.boolean(),
})
type FormData = z.infer<typeof schema>

interface Props {
  salonId: string
  initialServices: Service[]
  staffList: StaffMember[]
}

function serviceImageUrl(s: Service): string | null {
  const img = s.image
  if (!img) return null
  if (typeof img === 'object') return (img as Media).url ?? null
  return null
}

export default function ServicesManager({ salonId, initialServices }: Props) {
  const [services, setServices] = useState(initialServices)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [imageId, setImageId] = useState<number | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageModified, setImageModified] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'HUF', is_active: true, duration_minutes: 60, price: 0 },
  })

  const openAdd = () => {
    reset({ name: '', description: '', duration_minutes: 60, price: 0, currency: 'HUF', is_active: true })
    setEditing(null)
    setImageId(null)
    setImagePreview(null)
    setImageModified(false)
    setOpen(true)
  }

  const openEdit = (s: Service) => {
    reset({
      name: s.name,
      description: s.description ?? '',
      duration_minutes: s.duration_minutes,
      price: s.price,
      currency: s.currency ?? 'HUF',
      is_active: s.is_active ?? true,
    })
    setEditing(s)
    const url = serviceImageUrl(s)
    setImagePreview(url)
    const media = s.image && typeof s.image === 'object' ? (s.image as Media) : null
    setImageId(media ? Number(media.id) : null)
    setImageModified(false)
    setOpen(true)
  }

  const handleImagePick = async (file: File) => {
    setUploadingImage(true)
    setImagePreview(URL.createObjectURL(file))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setImageId(json.doc.id)
      setImagePreview(json.doc.url)
      setImageModified(true)
    } catch {
      toast.error('Kép feltöltése sikertelen')
      setImagePreview(null)
      setImageId(null)
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = async () => {
    if (imageId) {
      await fetch(`/api/media/${imageId}`, { method: 'DELETE', credentials: 'include' })
    }
    setImagePreview(null)
    setImageId(null)
    setImageModified(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { ...data, salon: salonId }
      if (imageModified) body.image = imageId ?? null
      const url = editing ? `/api/services/${editing.id}` : '/api/services'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved: Service = json.doc
      setServices(prev => editing ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved])
      setOpen(false)
      toast.success(editing ? 'Frissítve' : 'Létrehozva')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteService = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt a szolgáltatást?')) return
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setServices(prev => prev.filter(s => s.id !== id))
      toast.success('Törölve')
    } catch {
      toast.error('Hiba történt')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Katalógus</p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Szolgáltatások</h1>
        </div>
        <button
          onClick={openAdd}
          className="h-10 px-5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />Új
        </button>
      </div>

      {services.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm px-6 py-12 text-center">
          <p className="text-zinc-400 text-sm">Még nincs szolgáltatás. Add hozzá az elsőt!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {services.map((s, i) => {
            const imgUrl = serviceImageUrl(s)
            return (
              <div
                key={s.id}
                className={`flex items-center gap-4 px-5 py-4 ${i < services.length - 1 ? 'border-b border-zinc-100' : ''}`}
              >
                {/* Thumbnail */}
                <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-zinc-100 flex items-center justify-center">
                  {imgUrl
                    ? <img src={imgUrl} alt={s.name} className="h-full w-full object-cover object-top" />
                    : <span className="text-xl font-black text-zinc-300">{s.name[0]}</span>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-zinc-900 truncate">{s.name}</p>
                    {!s.is_active && (
                      <span className="text-xs text-zinc-400 border border-zinc-200 rounded-full px-2 py-0.5 shrink-0">Inaktív</span>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">{s.description}</p>
                  )}
                  <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{s.duration_minutes} perc · {formatPrice(s.price, s.currency)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(s)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteService(s.id)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-black tracking-tight">
              {editing ? 'Szerkesztés' : 'Új szolgáltatás'}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">

            {/* Image upload */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Kép</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative w-full h-32 rounded-2xl overflow-hidden bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors"
                >
                  {uploadingImage ? (
                    <Loader2 className="h-6 w-6 text-zinc-400 animate-spin" />
                  ) : imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Előnézet" className="h-full w-full object-cover object-top" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-zinc-400">
                      <Camera className="h-6 w-6" />
                      <span className="text-xs font-medium">Kép hozzáadása</span>
                    </div>
                  )}
                </button>
                {imagePreview && !uploadingImage && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImagePick(f) }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Név *</Label>
              <Input className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Leírás</Label>
              <Textarea className="rounded-xl bg-zinc-50 border-zinc-200" {...register('description')} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">Időtartam (perc) *</Label>
                <Input type="number" min={5} step={5} className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('duration_minutes', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">Ár *</Label>
                <Input type="number" min={0} className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('price', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Pénznem</Label>
              <Select value={watch('currency')} onValueChange={v => setValue('currency', v as 'HUF' | 'EUR')}>
                <SelectTrigger className="h-11 rounded-xl bg-zinc-50 border-zinc-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HUF">HUF (Ft)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" className="h-4 w-4 rounded" {...register('is_active')} />
              <Label htmlFor="active" className="text-sm text-zinc-700">Aktív (foglalható)</Label>
            </div>
            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Mentés...' : 'Mentés'}
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
