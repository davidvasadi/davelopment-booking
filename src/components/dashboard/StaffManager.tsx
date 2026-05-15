'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import type { StaffMember, Media } from '@/payload/payload-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus, Pencil, Trash2, CalendarDays, Camera, Loader2, X } from 'lucide-react'
import StaffCalendarSheet from './StaffCalendarSheet'

const schema = z.object({
  name: z.string().min(1, 'Kötelező'),
  bio: z.string().optional(),
  is_active: z.boolean(),
})
type FormData = z.infer<typeof schema>

interface Props {
  salonId: string
  initialStaff: StaffMember[]
}

function avatarUrl(m: StaffMember): string | null {
  if (!m.avatar) return null
  if (typeof m.avatar === 'object') return (m.avatar as Media).url ?? null
  return null
}

export default function StaffManager({ salonId, initialStaff }: Props) {
  const [staff, setStaff] = useState(initialStaff)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [avatarId, setAvatarId] = useState<number | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarModified, setAvatarModified] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [calendarStaff, setCalendarStaff] = useState<StaffMember | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_active: true },
  })

  const openAdd = () => {
    reset({ name: '', bio: '', is_active: true })
    setEditing(null)
    setAvatarId(null)
    setAvatarPreview(null)
    setAvatarModified(false)
    setOpen(true)
  }

  const openEdit = (m: StaffMember) => {
    reset({ name: m.name, bio: m.bio ?? '', is_active: m.is_active ?? true })
    setEditing(m)
    const url = avatarUrl(m)
    setAvatarPreview(url)
    const media = m.avatar && typeof m.avatar === 'object' ? (m.avatar as Media) : null
    setAvatarId(media ? Number(media.id) : null)
    setAvatarModified(false)
    setOpen(true)
  }

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarPreview(URL.createObjectURL(file))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.set('_payload', JSON.stringify({ alt: 'Staff avatar' }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setAvatarId(json.doc.id)
      setAvatarPreview(json.doc.url)
      setAvatarModified(true)
    } catch {
      toast.error('Kép feltöltése sikertelen')
      setAvatarPreview(null)
      setAvatarId(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const removeAvatar = async () => {
    if (avatarId) {
      await fetch(`/api/media/${avatarId}`, { method: 'DELETE', credentials: 'include' })
    }
    setAvatarPreview(null)
    setAvatarId(null)
    setAvatarModified(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { ...data, salon: salonId }
      if (avatarModified) body.avatar = avatarId ?? null
      else if (avatarId) body.avatar = avatarId
      const url = editing ? `/api/staff/${editing.id}` : '/api/staff'
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved: StaffMember = json.doc
      setStaff(prev => editing ? prev.map(m => m.id === saved.id ? saved : m) : [...prev, saved])
      setOpen(false)
      toast.success(editing ? 'Frissítve' : 'Munkatárs hozzáadva')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteMember = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt a munkatársat?')) return
    try {
      const res = await fetch(`/api/staff/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setStaff(prev => prev.filter(m => m.id !== id))
      toast.success('Törölve')
    } catch {
      toast.error('Hiba történt')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Csapat</p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Munkatársak</h1>
        </div>
        <button
          onClick={openAdd}
          className="h-10 px-5 rounded-full bg-white hover:bg-white/90 text-black text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />Új
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl px-6 py-12 text-center">
          <p className="text-zinc-400 dark:text-white/30 text-sm">Még nincs munkatárs. Add hozzá az elsőt!</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
          {staff.map((m, i) => {
            const url = avatarUrl(m)
            return (
              <div
                key={m.id}
                className={`flex items-center justify-between px-6 py-4 ${i < staff.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.06]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 bg-zinc-100 dark:bg-white/[0.08] flex items-center justify-center">
                    {url ? (
                      <img src={url} alt={m.name} className="h-full w-full object-cover object-top" />
                    ) : (
                      <span className="text-xs font-bold text-zinc-500 dark:text-white/60">{m.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-zinc-800 dark:text-white/80">{m.name}</p>
                      {!m.is_active && (
                        <span className="text-xs text-zinc-400 dark:text-white/30 border border-zinc-200 dark:border-white/[0.1] rounded-full px-2 py-0.5">Inaktív</span>
                      )}
                    </div>
                    {m.bio && <p className="text-xs text-zinc-500 dark:text-white/40">{m.bio}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCalendarStaff(m)}
                    title="Elérhetőség naptár"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 dark:text-white/30 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => openEdit(m)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 dark:text-white/30 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMember(m.id)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit / Add sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="text-xl font-black tracking-tight">
              {editing ? 'Szerkesztés' : 'Új munkatárs'}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-6">

            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-24 w-24 rounded-2xl overflow-hidden bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-6 w-6 text-zinc-400 animate-spin" />
                  ) : avatarPreview ? (
                    <>
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera className="h-6 w-6 text-zinc-400" />
                  )}
                </button>
                {avatarPreview && !uploadingAvatar && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-500">Kattints a profilkép feltöltéséhez</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarPick}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Név *</Label>
              <Input className="h-11 rounded-xl" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Bemutatkozás</Label>
              <Textarea className="rounded-xl" {...register('bio')} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="staff_active" className="h-4 w-4 rounded" {...register('is_active')} />
              <Label htmlFor="staff_active" className="text-sm">Aktív (foglalható)</Label>
            </div>
            <button
              type="submit"
              disabled={submitting || uploadingAvatar}
              className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Mentés...' : 'Mentés'}
            </button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Availability calendar sheet */}
      {calendarStaff && (
        <StaffCalendarSheet
          open={!!calendarStaff}
          onClose={() => setCalendarStaff(null)}
          staffId={String(calendarStaff.id)}
          staffName={calendarStaff.name}
          salonId={salonId}
        />
      )}
    </>
  )
}
