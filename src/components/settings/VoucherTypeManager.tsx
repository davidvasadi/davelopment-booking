'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Pencil, Trash2, ImagePlus, X } from 'lucide-react'
import { PopupModal } from '@/components/ui/popup-modal'
import { compressImage } from '@/lib/compressImage'
import { LocaleEditBar } from './LocaleEditBar'
import { Toggle } from './SettingsToggle'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'

/**
 * Ajándékutalvány-típusok kezelése — a tulaj itt hozza létre a "termékeket" (név + fix Ft-
 * összeg + saját kép), amikből a vendég a publikus vásárlás-oldalon választ. A `ServicesManager`
 * kép-feltöltési mintáját követi (`compressImage` → `POST /api/media`), de saját, egyszerűbb
 * CRUD-ot hív (`/api/gift-voucher-types`), mert itt nincs kategória/staff-kapcsolat.
 */

export interface VoucherTypeData {
  id: string
  name: string
  amount_huf: number
  description?: string | null
  active?: boolean | null
  image?: { id: string; url?: string | null } | string | null
}

interface Props {
  variant: 'salon' | 'restaurant'
  businessId: string
  initialTypes: VoucherTypeData[]
  minAmountHuf: number
  maxAmountHuf: number
  supportedLocales?: (string | null | undefined)[] | null
}

const HUF = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

function imageUrlOf(image: VoucherTypeData['image']): string | null {
  if (image && typeof image === 'object') return image.url ?? null
  return null
}

export function VoucherTypeManager({ variant, businessId, initialTypes, minAmountHuf, maxAmountHuf, supportedLocales }: Props) {
  const [types, setTypes] = useState<VoucherTypeData[]>(initialTypes)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<VoucherTypeData | null>(null)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [imageId, setImageId] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Nyelvkészlet + szerkesztési nyelv — a `name`/`description` localizált (ugyanaz a
  // `?locale=` mentés-út, mint a ServicesManagernél), a többi mező (összeg, kép, aktív)
  // nyelvfüggetlen, csak HU-n szerkeszthető.
  const availableLocales = resolveAvailableLocales(supportedLocales)
  const [editLocale, setEditLocale] = useState<Locale>('hu')
  const [localeLoading, setLocaleLoading] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setEditLocale('hu')
    setName('')
    setAmount('')
    setDescription('')
    setActive(true)
    setImageId(null)
    setImagePreview(null)
    setModalOpen(true)
  }

  const openEdit = (t: VoucherTypeData) => {
    setEditing(t)
    setEditLocale('hu')
    setName(t.name)
    setAmount(String(t.amount_huf))
    setDescription(t.description ?? '')
    setActive(t.active ?? true)
    setImageId(typeof t.image === 'object' && t.image ? t.image.id : (typeof t.image === 'string' ? t.image : null))
    setImagePreview(imageUrlOf(t.image))
    setModalOpen(true)
  }

  // Szerkesztési nyelv váltása — HU-ra váltva az alap (editing) érték tér vissza; más
  // nyelvre lekérdezzük az adott nyelvi tartalmat (üres → a mező üres, HU fallback érvényes).
  const selectEditLocale = async (loc: Locale) => {
    if (loc === editLocale) return
    if (loc === 'hu') {
      setEditLocale('hu')
      setName(editing?.name ?? '')
      setDescription(editing?.description ?? '')
      return
    }
    if (!editing) { setEditLocale(loc); return }
    setLocaleLoading(true)
    try {
      const res = await fetch(`/api/gift-voucher-types/${editing.id}?locale=${loc}&fallback-locale=null`, { credentials: 'include' })
      if (res.ok) {
        const doc = await res.json()
        setName(doc?.name ?? '')
        setDescription(doc?.description ?? '')
      }
      setEditLocale(loc)
    } finally {
      setLocaleLoading(false)
    }
  }

  const handleImagePick = async (file: File) => {
    setUploadingImage(true)
    setImagePreview(URL.createObjectURL(file))
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setImageId(json.doc.id)
      setImagePreview(json.doc.url)
    } catch {
      toast.error('Kép feltöltése sikertelen')
      setImagePreview(null)
      setImageId(null)
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = () => {
    setImageId(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const save = async () => {
    // Idegen nyelv szerkesztése: csak a localizált name/description megy, a `?locale=` útvonalon.
    if (editLocale !== 'hu' && editing) {
      setSaving(true)
      try {
        const res = await fetch(`/api/gift-voucher-types/${editing.id}?locale=${editLocale}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ name: name.trim() || undefined, description: description.trim() || undefined }),
        })
        if (!res.ok) throw new Error()
        setModalOpen(false)
        toast.success('Fordítás mentve')
      } catch {
        toast.error('Mentés sikertelen')
      } finally {
        setSaving(false)
      }
      return
    }

    const amountHuf = Math.round(Number(amount))
    if (!name.trim()) return toast.error('A név megadása kötelező.')
    if (!amountHuf || amountHuf <= 0) return toast.error('Adj meg egy érvényes összeget.')

    setSaving(true)
    try {
      const body = {
        ...(variant === 'salon' ? { salon: businessId } : { restaurant: businessId }),
        name: name.trim(),
        amount_huf: amountHuf,
        description: description.trim() || undefined,
        active,
        image: imageId ?? undefined,
      }
      const res = editing
        ? await fetch(`/api/gift-voucher-types/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
        : await fetch('/api/gift-voucher-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const saved: VoucherTypeData = json.doc
      setTypes(prev => editing ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved])
      setModalOpen(false)
      toast.success('Mentve')
    } catch {
      toast.error('Mentés sikertelen')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (t: VoucherTypeData) => {
    const next = !t.active
    setTypes(prev => prev.map(x => x.id === t.id ? { ...x, active: next } : x))
    const res = await fetch(`/api/gift-voucher-types/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ active: next }) })
    if (!res.ok) {
      setTypes(prev => prev.map(x => x.id === t.id ? { ...x, active: t.active } : x))
      toast.error('Nem sikerült frissíteni')
    }
  }

  const remove = async (t: VoucherTypeData) => {
    if (!confirm(`Biztosan törlöd: "${t.name}"?`)) return
    const res = await fetch(`/api/gift-voucher-types/${t.id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) return toast.error('Törlés sikertelen')
    setTypes(prev => prev.filter(x => x.id !== t.id))
    toast.success('Törölve')
  }

  return (
    <div className="space-y-3 border-t border-dashed border-line pt-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Utalvány-típusok</div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-[#EFEFEC]"
        >
          <Plus className="h-3.5 w-3.5" /> Új típus
        </button>
      </div>

      {types.length === 0 ? (
        <p className="text-[13px] text-ink-soft2">Még nincs egy típus sem — a vendégek csak akkor tudnak vásárolni, ha van legalább egy aktív típus.</p>
      ) : (
        <div className="space-y-2">
          {types.map((t) => {
            const url = imageUrlOf(t.image)
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-3 py-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-paper">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-4 w-4 text-ink-soft2" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-ink">{t.name}</div>
                  <div className="text-[12px] text-ink-soft2">{HUF(t.amount_huf)}</div>
                </div>
                <Toggle checked={t.active ?? true} onChange={() => toggleActive(t)} />
                <button type="button" onClick={() => openEdit(t)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => remove(t)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-500/80 transition-colors hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <PopupModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Típus szerkesztése' : 'Új utalvány-típus'}>
        <div className="space-y-4">
          {editing && availableLocales.length > 1 && (
            <LocaleEditBar available={availableLocales} active={editLocale} onSelect={selectEditLocale} loading={localeLoading} />
          )}

          {editLocale === 'hu' && (
          <div className="flex justify-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-[16px] bg-paper">
              {imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={removeImage} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft2"
                >
                  {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <span className="text-[10px]">Kép</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImagePick(f) }} />
            </div>
          </div>
          )}

          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Név</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={editLocale !== 'hu' ? (editing?.name ?? '') : 'pl. 20.000 Ft-os ajándékutalvány'}
              className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
            />
          </div>
          {editLocale === 'hu' && (
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Összeg (Ft)</label>
            <input
              type="number" inputMode="numeric" min={minAmountHuf} max={maxAmountHuf}
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`${minAmountHuf}–${maxAmountHuf}`}
              className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
            />
            <p className="mt-1 text-[11px] text-ink-soft2">{HUF(minAmountHuf)}–{HUF(maxAmountHuf)} között (a fenti sáv-beállítás korlátozza).</p>
          </div>
          )}
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Leírás (opcionális)</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder={editLocale !== 'hu' ? (editing?.description ?? '') : undefined}
              className="mt-1.5 w-full rounded-[12px] border border-line-strong bg-white px-3.5 py-2.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
            />
          </div>
          {editLocale === 'hu' && (
          <div className="flex items-center justify-between rounded-[12px] bg-paper px-3.5 py-3">
            <span className="text-[13px] text-ink">Aktív (megjelenik a vásárlás-oldalon)</span>
            <Toggle checked={active} onChange={() => setActive(a => !a)} />
          </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving || uploadingImage}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-ink-dark text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editLocale !== 'hu' ? 'Fordítás mentése' : 'Mentés'}
          </button>
        </div>
      </PopupModal>
    </div>
  )
}
